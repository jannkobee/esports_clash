"""Provision the pinned native TRELLIS.2 profile in an isolated Python environment.

Run audit first. Installation is explicit, checks real GPU/DINOv3 access before
large downloads, and never installs into the notebook kernel or starts a paid VM.
"""
import argparse
import hashlib
import json
import os
import secrets
import shutil
import subprocess
import sys
import time
from pathlib import Path
import importlib.util
import urllib.error
import urllib.request

HERE = Path(__file__).resolve().parent
REPOS = {
    'ComfyUI': ('comfyanonymous/ComfyUI', '30c259cac8c08ff8d015f9aff3151cb525c9b702'),
    'nodes': ('Aero-Ex/ComfyUI-Trellis2-GGUF', 'b3b9e951874c5fb5c936566c93b908299be08b2c'),
    'utils3d': ('EasternJournalist/utils3d', '35a17ba705d921c7a559ec6067c8eaa5c03ddb37'),
    'nvdiffrast': ('NVlabs/nvdiffrast', '253ac4fcea7de5f396371124af597e6cc957bfae'),
    'FlexGEMM': ('JeffreyXiang/FlexGEMM', '6dd94a859c26ee8246888502eada3dd8ad85532e'),
    'TrellisNative': ('visualbruno/TRELLIS.2', '65d1e13b4a92296036044df0633242bb9e95abf6'),
    'CuMesh': ('visualbruno/CuMesh', 'd10e54c30ddd03d11472c1431693f985501c7966'),
    'ComfyUI-GGUF': ('city96/ComfyUI-GGUF', '6ea2651e7df66d7585f6ffee804b20e92fb38b8a'),
}


def credential():
    token_file = os.environ.get('HF_TOKEN_FILE')
    if token_file and Path(token_file).is_file():
        return Path(token_file).read_text().strip()
    colab_token = Path('/content/esports-trellis2/hf-token.txt')
    if colab_token.is_file():
        return colab_token.read_text().strip()
    default_token_file = HERE.parent.parent / '.local-tools/trellis2/hf-token.txt'
    if default_token_file.is_file():
        return default_token_file.read_text().strip()
    return os.environ.get('HF_TOKEN') or os.environ.get('HUGGING_FACE_HUB_TOKEN', '')


def official_access(token):
    pins = json.loads((HERE / 'model-pins.json').read_text())
    item = next(f for f in pins['files'] if f['repo'].startswith('facebook/') and f['remote'].endswith('.safetensors'))
    spec = importlib.util.spec_from_file_location('trellis_model_provisioning', HERE / 'prepare-models.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    request = urllib.request.Request(module.url(item), method='HEAD',
        headers={'Authorization': 'Bearer ' + token} if token else {})
    try:
        with module.OPENER.open(request, timeout=15) as response:
            return response.status == 200
    except (OSError, urllib.error.HTTPError):
        return False


def audit(check_access=True):
    code = '''import json
try:
 import torch
 if not torch.cuda.is_available(): raise RuntimeError("No CUDA GPU is visible")
 x=torch.ones((4,4),device="cuda",dtype=torch.bfloat16)
 assert (x@x).float().mean().item()==4
 print(json.dumps({"available":True,"name":torch.cuda.get_device_name(0),"architecture":"%d.%d"%torch.cuda.get_device_capability(0),"native_bf16_test":True}))
except Exception as e: print(json.dumps({"available":False,"reason":type(e).__name__+": "+str(e)[:300]}))'''
    result = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True, timeout=30)
    try:
        gpu = json.loads(result.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        gpu = {'available': False, 'reason': 'Unable to test native CUDA support.'}
    cuda = next((path for path in [os.environ.get('CUDA_HOME'), '/usr/local/cuda-12.8', '/usr/local/cuda']
                 if path and (Path(path) / 'bin/nvcc').is_file()), None)
    cuda_ok = False
    if cuda:
        version = subprocess.run([str(Path(cuda) / 'bin/nvcc'), '--version'], capture_output=True, text=True, timeout=5)
        cuda_ok = 'release 12.' in version.stdout
    token = credential()
    access = official_access(token) if check_access else None
    blockers = []
    if not gpu['available']:
        blockers.append('Native CUDA/BF16 GPU test failed: ' + gpu.get('reason', 'unknown GPU error'))
    if not cuda_ok:
        blockers.append('The pinned Torch/cu128 profile needs a CUDA 12.x toolkit (12.8 recommended).')
    if check_access and not access:
        blockers.append('Official gated DINOv3 weights are unavailable. Configure approved Hugging Face access using HF_TOKEN_FILE or Colab Secrets; never paste tokens into chat.')
    if shutil.which('git') is None:
        blockers.append('git is required.')
    return {'ready_to_install': not blockers, 'gpu': gpu, 'cuda_home': cuda, 'official_dinov3_access': access,
            'credential_present': bool(token), 'blockers': blockers}


def install(root, report):
    if not report['ready_to_install']:
        raise RuntimeError('; '.join(report['blockers']))
    root.mkdir(parents=True, exist_ok=True)
    source = root / 'src'
    source.mkdir(exist_ok=True)
    names = ['service.py','control.py','diagnose.py','export_node.py','patch_nodes.py','prepare-models.py',
             'requirements.txt','workflow-v1.json','limits.json','model-pins.json','catalog.json','reference-index.json','Dockerfile.native']
    for name in names:
        if (HERE / name).resolve() != (source / name).resolve():
            shutil.copy2(HERE / name, source / name)
    receipt_path = root / 'installation.json'
    config = hashlib.sha256((HERE / 'model-pins.json').read_bytes() + Path(__file__).read_bytes()).hexdigest()
    receipt = json.loads(receipt_path.read_text()) if receipt_path.is_file() else {'config': config, 'stages': []}
    if receipt['config'] != config:
        raise RuntimeError('Provisioning configuration changed. Use a new installation root to preserve the previous environment.')
    environment = dict(os.environ)
    for key in ('HF_TOKEN','HUGGING_FACE_HUB_TOKEN','HF_TOKEN_FILE'):
        environment.pop(key, None)
    environment.update(CUDA_HOME=report['cuda_home'], TORCH_CUDA_ARCH_LIST=report['gpu']['architecture'] + '+PTX', MAX_JOBS='1',
        TRELLIS_COMFY=str(root / 'ComfyUI'), TRELLIS_DATA=str(root / 'data'), HF_HUB_DISABLE_TELEMETRY='1')
    log = root / 'provision.log'
    def command(args, cwd=None, env=None):
        with log.open('ab') as stream:
            subprocess.run([str(item) for item in args], cwd=cwd, env=env or environment,
                           stdout=stream, stderr=subprocess.STDOUT, check=True, timeout=3600)
    def stage(name, action):
        if name in receipt['stages']:
            return
        print('TRELLIS provisioning: ' + name, flush=True)
        receipt.update(stage=name, status='installing', updated_unix=time.time())
        receipt_path.write_text(json.dumps(receipt, indent=2))
        action()
        receipt['stages'].append(name)
        receipt_path.write_text(json.dumps(receipt, indent=2))
    bootstrap = root / 'bootstrap'
    stage('uv', lambda: command([sys.executable, '-m', 'pip', 'install', '--no-cache-dir', '--target', bootstrap, 'uv==0.9.5']))
    uv = bootstrap / 'bin/uv'
    stage('python312', lambda: command([uv, 'venv', '--seed', '--python', '3.12.12', root / 'env']))
    python = root / 'env/bin/python'
    def checkout(name, destination):
        repo, revision = REPOS[name]
        destination.mkdir(parents=True, exist_ok=True)
        command(['git','init',destination])
        command(['git','-C',destination,'fetch','--depth','1','https://github.com/' + repo + '.git',revision])
        command(['git','-C',destination,'checkout','--detach','FETCH_HEAD'])
    paths = {name: root / name for name in REPOS}
    paths['nodes'] = root / 'ComfyUI/custom_nodes/ComfyUI-Trellis2-GGUF'
    paths['ComfyUI-GGUF'] = root / 'ComfyUI/custom_nodes/ComfyUI-GGUF'
    for name, destination in paths.items():
        stage('git-' + name, lambda name=name, destination=destination: checkout(name,destination))
    stage('torch', lambda: command([python,'-m','pip','install','torch==2.9.1','torchvision==0.24.1','torchaudio==2.9.1','--index-url','https://download.pytorch.org/whl/cu128']))
    stage('python-dependencies', lambda: command([python,'-m','pip','install','-r',source / 'requirements.txt']))
    stage('utils3d', lambda: command([python,'-m','pip','install','--no-deps',paths['utils3d']]))
    wheels = paths['nodes'] / 'wheels/Linux/Torch291'
    # Keep the pinned auxiliary raster/export wheel; build GPU kernels for the
    # measured architecture instead of assuming the old RTX 3060 wheel works.
    stage('nvdiffrec', lambda: command([python,'-m','pip','install','--no-deps',*sorted(wheels.glob('nvdiffrec_render*.whl'))]))
    for name in ['nvdiffrast','FlexGEMM','CuMesh']:
        stage('submodules-' + name, lambda name=name: command(['git','-C',paths[name],'submodule','update','--init','--recursive','--depth','1']))
        stage('build-' + name, lambda name=name: command([python,'-m','pip','install','--no-build-isolation','--no-deps',paths[name]]))
    stage('eigen', lambda: command(['git','-C',paths['TrellisNative'],'submodule','update','--init','--depth','1','o-voxel/third_party/eigen']))
    stage('build-o-voxel', lambda: command([python,'-m','pip','install','--no-build-isolation','--no-deps',paths['TrellisNative'] / 'o-voxel']))
    stage('reviewed-pipeline-patch', lambda: command([python,source / 'patch_nodes.py']))
    exporter = root / 'ComfyUI/custom_nodes/esports_trellis_export'
    exporter.mkdir(exist_ok=True)
    shutil.copy2(source / 'export_node.py', exporter / '__init__.py')
    data = root / 'data'
    for name in ['models','jobs','staging','input','output']:
        (data / name).mkdir(parents=True, exist_ok=True)
    model_link = root / 'ComfyUI/models'
    if not model_link.is_symlink():
        if model_link.exists():
            model_link.rename(root / 'ComfyUI/models.upstream')
        model_link.symlink_to(data / 'models', target_is_directory=True)
    def models():
        token_path = root / '.provision-token'
        if token_path.exists():
            raise RuntimeError('A previous provisioning token file exists; resolve that interrupted run before continuing.')
        fd = os.open(token_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, 'w') as stream:
            stream.write(credential())
        try:
            command([python,source / 'prepare-models.py'], env={**environment,'HF_TOKEN_FILE':str(token_path)})
        finally:
            token_path.unlink(missing_ok=True)
    stage('verified-checkpoints', models)
    packages = subprocess.check_output([str(python),'-m','pip','freeze'], env=environment)
    (source / 'installed-packages.txt').write_bytes(packages)
    receipt.update(status='installed_unvalidated', stage='complete', gpu=report['gpu'], sources=REPOS,
        environment_id='sha256:' + hashlib.sha256(packages + config.encode()).hexdigest())
    receipt_path.write_text(json.dumps(receipt, indent=2))
    return receipt


def runtime_environment(root):
    receipt = json.loads((root / 'installation.json').read_text())
    environment = dict(os.environ)
    for key in ('HF_TOKEN','HUGGING_FACE_HUB_TOKEN','HF_TOKEN_FILE'):
        environment.pop(key, None)
    token_file = root / '.worker-token'
    if not token_file.exists():
        fd = os.open(token_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd,'w') as stream:
            stream.write(secrets.token_urlsafe(48))
    environment.update(TRELLIS_DATA=str(root / 'data'), TRELLIS_COMFY=str(root / 'ComfyUI'),
        TRELLIS_GPU_LEASE=str(root / 'gpu-lease'), TRELLIS_BIND='127.0.0.1',
        TRELLIS_ENVIRONMENT_ID=receipt['environment_id'], TRELLIS_WORKER_TOKEN=token_file.read_text().strip(),
        HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', ATTN_BACKEND='sdpa', PYTHONUNBUFFERED='1')
    return environment


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('/content/esports-trellis2'))
    parser.add_argument('--install', action='store_true')
    parser.add_argument('--start', action='store_true')
    parser.add_argument('--skip-access-check', action='store_true', help='Audit hardware only; cannot install with this flag.')
    args = parser.parse_args()
    if args.start:
        environment = runtime_environment(args.root)
        python = args.root / 'env/bin/python'
        # Diagnostics must pass before an authenticated native service is ready.
        subprocess.run([str(python), str(args.root / 'src/diagnose.py')], env=environment, check=True, timeout=600)
        with (args.root / 'native.log').open('ab') as log:
            process = subprocess.Popen([str(python),str(args.root / 'src/control.py')], env=environment,
                cwd=args.root / 'src', stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        (args.root / 'native.pid').write_text(str(process.pid))
        print(json.dumps({'status':'starting_native_trellis2','pid':process.pid}))
        return
    report = audit(not args.skip_access_check)
    print(json.dumps(report, indent=2), flush=True)
    if args.install:
        if args.skip_access_check:
            raise SystemExit('Installation requires the official access check.')
        install(args.root, report)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.SubprocessError) as error:
        # Build commands never contain a credential value; credentials are only
        # present in the one-shot checkpoint provisioner's private token file.
        print('TRELLIS provisioning stopped: ' + str(error), file=sys.stderr)
        raise SystemExit(1)
