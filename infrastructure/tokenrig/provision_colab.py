"""Provision the retained TokenRig tools inside Google Colab, without admitting jobs.

This is a separate environment from TRELLIS. It never restores historical avatar
assets and never reports an installed engine as a qualified character.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import time

ROOT = Path('/content/teamfight-preparation')
TOOLS = Path(__file__).resolve().parent


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024**2), b''):
            value.update(chunk)
    return value.hexdigest()


def require_colab():
    import google.colab  # noqa: F401 - deliberate environment admission
    if not Path('/content').is_dir() or not os.environ.get('COLAB_RELEASE_TAG'):
        raise RuntimeError('Preparation provisioning is restricted to Google Colab.')


def receipt(value):
    ROOT.mkdir(parents=True, exist_ok=True)
    temporary = ROOT / 'installation.tmp.json'
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(ROOT / 'installation.json')


def run(args, timeout=1800):
    subprocess.run([str(arg) for arg in args], check=True, timeout=timeout)


def install():
    require_colab()
    # Large CUDA wheels can exceed uv's default inactivity timeout on Colab.
    # Keep explicit operator settings and all package/model pins unchanged.
    os.environ.setdefault('UV_HTTP_TIMEOUT', '300')
    pins = json.loads((TOOLS / 'model-pins.json').read_text())
    state = {'provider': 'tokenrig', 'compute': 'google', 'status': 'installing',
             'publication_eligible': False, 'started_unix': time.time(),
             'source_commit': pins['commit'], 'model_revision': pins['huggingface']['revision']}
    receipt(state)
    try:
        for name in ('rig.pid', 'animation.pid'):
            if (ROOT / name).exists():
                try:
                    os.kill(int((ROOT / name).read_text()), 0)
                except ProcessLookupError:
                    pass
                else:
                    raise RuntimeError('A preparation service is active; preserve its jobs before provisioning.')
        run([sys.executable, '-m', 'pip', 'install', 'uv==0.9.5'])
        python = ROOT / 'venv/bin/python'
        if not python.is_file():
            run([sys.executable, '-m', 'uv', 'venv', '--python', '3.11', ROOT / 'venv'])

        def pip(*args):
            run([sys.executable, '-m', 'uv', 'pip', 'install', '--python', python, *args])

        pip('torch==2.7.0', 'torchvision==0.22.0', 'torchaudio==2.7.0',
            '--index-url', 'https://download.pytorch.org/whl/cu128')
        checkout = ROOT / 'SkinTokens'
        if not (checkout / '.git').is_dir():
            run(['git', 'init', checkout])
            run(['git', '-C', checkout, 'fetch', '--depth', '1', pins['repository'], pins['commit']])
            run(['git', '-C', checkout, 'checkout', '--detach', 'FETCH_HEAD'])
        commit = subprocess.check_output(['git', '-C', str(checkout), 'rev-parse', 'HEAD'], text=True).strip()
        if commit != pins['commit']:
            raise RuntimeError('Existing TokenRig checkout has a different frozen identity.')
        # Pin the versions used by the successful isolated T4 trial. Torch stays
        # constrained while upstream's remaining public dependencies resolve.
        constraints = ROOT / 'constraints.txt'
        constraints.write_text('torch==2.7.0\ntorchvision==0.22.0\ntorchaudio==2.7.0\n'
                               'bpy==4.5.3\ntransformers==4.57.6\ndiffusers==0.35.1\n'
                               'lightning==2.6.1\nnumpy==1.26.4\n')
        # SciPy is imported by the upstream geometry modules but is absent from
        # its requirements file; keep it explicit instead of relying on extras.
        pip('-r', checkout / 'requirements.txt', '-c', constraints,
            'scipy==1.15.2', 'aiohttp==3.11.16', 'psutil==7.0.0')
        hardware_code = ("import torch,json; assert torch.cuda.is_available(),'Colab GPU required'; "
                         "print(json.dumps(dict(name=torch.cuda.get_device_name(),"
                         "major=torch.cuda.get_device_capability()[0],bf16=torch.cuda.is_bf16_supported(),"
                         "free_mib=torch.cuda.mem_get_info()[0]//1048576)))")
        hardware = json.loads(subprocess.check_output([str(python), '-c', hardware_code], text=True))
        profile = 'native' if hardware['major'] >= 8 and hardware['bf16'] else 't4-fp32'
        if profile == 'native':
            # The current deployment is the measured T4 profile. A new GPU family
            # needs its own pinned FlashAttention build and readiness evidence.
            raise RuntimeError('This deployment supports the measured T4 profile only; native GPU provisioning is pending.')
        patched = checkout / 'teamfight-trial-engine.json'
        if not patched.is_file():
            run([python, TOOLS / 'prepare_t4_trial.py', checkout])
        else:
            manifest = json.loads(patched.read_text())
            if manifest['patch_sha256'] != digest(TOOLS / 'prepare_t4_trial.py') or any(
                    digest(checkout / name) != expected for name, expected in manifest['files'].items()):
                raise RuntimeError('Existing compatibility patch changed; no partial replacement was applied.')
        run([python, TOOLS / 'verify_attention.py', checkout])
        run([python, TOOLS / 'download_models.py', checkout])
        freeze = subprocess.check_output([sys.executable, '-m', 'uv', 'pip', 'freeze', '--python', str(python)], text=True)
        (ROOT / 'environment.txt').write_text(freeze)
        state.update(status='installed_unqualified', completed_unix=time.time(), profile=profile,
                     hardware=hardware, environment_sha256=digest(ROOT / 'environment.txt'),
                     runtime_id=hashlib.sha256(platform.node().encode()).hexdigest(),
                     tools={name: digest(TOOLS / name) for name in (
                         'provision_colab.py', 'model-pins.json', 'prepare_t4_trial.py',
                         'verify_attention.py', 'download_models.py', 'run_trial.py')},
                     scope='Pinned tool/model installation and attention diagnostics only. No avatar job or deformation qualification.')
        receipt(state)
        print(json.dumps(state), flush=True)
    except Exception as error:
        state.update(status='failed', error=f'{type(error).__name__}: {error}', completed_unix=time.time())
        receipt(state)
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install', action='store_true', required=True)
    parser.parse_args()
    install()
