"""Build a self-contained interactive notebook from the retained trial tools."""
import hashlib
import json
from pathlib import Path
import textwrap

root = Path(__file__).resolve().parent
cells = []
def markdown(source):
    cells.append({'cell_type': 'markdown', 'metadata': {}, 'source': source.splitlines(True)})
def code(source):
    cells.append({'cell_type': 'code', 'metadata': {}, 'execution_count': None,
                  'outputs': [], 'source': textwrap.dedent(source).strip().splitlines(True)})

markdown('''# Teamfight: isolated TokenRig inference

Select **Runtime → Change runtime type → GPU**. Run cells interactively in order.
This notebook creates a new raw rig, not a qualified combat character. Retargeting
and outfit fitting remain separate local stages. Download the result before the
session ends. No tunnels, daemon, API credentials, Drive access, or deployment.

The T4 compatibility profile was measured on Stafford; this notebook's fresh
bootstrap recipe has not yet been executed end to end. Upstream requires 14 GB
VRAM for its native profile. Hardware availability and runtime limits vary.
''')
scripts = {name: (root / name).read_text() for name in [
    'model-pins.json', 'download_models.py', 'prepare_t4_trial.py', 'verify_attention.py', 'run_trial.py']}
code('''
from pathlib import Path
import hashlib, json, os, signal, subprocess, sys, time, uuid, zipfile
BASE = Path('/content') / ('teamfight-tokenrig-' + uuid.uuid4().hex)
BASE.mkdir(exist_ok=False)
TOOLS = BASE / 'tools'
TOOLS.mkdir()
'''+ '\nSCRIPTS = ' + repr(scripts) + '''
for name, source in SCRIPTS.items():
    (TOOLS / name).write_text(source)
pins = json.loads(SCRIPTS['model-pins.json'])
print('Isolated workspace:', BASE)
print('Pinned upstream:', pins['commit'])
''')
markdown('Install a separate Python 3.11 environment; the notebook kernel is unchanged. Downloads require internet access.')
code('''
def run(args, timeout=1800):
    subprocess.run([str(a) for a in args], check=True, timeout=timeout)
run([sys.executable, '-m', 'pip', 'install', 'uv==0.9.5'])
run([sys.executable, '-m', 'uv', 'venv', '--python', '3.11', BASE / 'venv'])
PY = BASE / 'venv/bin/python'
def install(*args):
    run([sys.executable, '-m', 'uv', 'pip', 'install', '--python', PY, *args])
install('torch==2.7.0', 'torchvision==0.22.0', 'torchaudio==2.7.0',
        '--index-url', 'https://download.pytorch.org/whl/cu128')
CHECKOUT = BASE / 'SkinTokens'
run(['git', 'clone', pins['repository'], CHECKOUT])
run(['git', '-C', CHECKOUT, 'checkout', '--detach', pins['commit']])
install('-r', str(CHECKOUT / 'requirements.txt'), 'bpy==4.5.3',
        'transformers==4.57.6', 'diffusers==0.35.1', 'lightning==2.6.1', 'numpy<3')
hardware = json.loads(subprocess.check_output([str(PY), '-c',
    "import torch,json; assert torch.cuda.is_available(),'GPU runtime required'; print(json.dumps(dict(name=torch.cuda.get_device_name(),free_mib=torch.cuda.mem_get_info()[0]//1048576,major=torch.cuda.get_device_capability()[0],bf16=torch.cuda.is_bf16_supported())))"], text=True))
PROFILE = 'native' if hardware['major'] >= 8 and hardware['bf16'] else 't4-fp32'
minimum = 14*1024 if PROFILE == 'native' else 6*1024
assert hardware['free_mib'] >= minimum, 'Insufficient free VRAM; release other GPU work first'
print(hardware, PROFILE)
if PROFILE == 'native':
    install('packaging', 'ninja', 'wheel', 'setuptools', 'psutil')
    install('flash-attn', '--no-build-isolation')
else:
    run([PY, TOOLS / 'prepare_t4_trial.py', CHECKOUT])
    run([PY, TOOLS / 'verify_attention.py', CHECKOUT])
run([PY, TOOLS / 'download_models.py', CHECKOUT])
''')
markdown('Upload one clean A-pose base GLB. Preserve species anatomy. Clothing, hair and weapons belong to later stages.')
code('''
from google.colab import files
uploaded = files.upload()
assert len(uploaded) == 1, 'Upload exactly one base GLB'
name, data = next(iter(uploaded.items()))
assert name.lower().endswith('.glb') and data[:4] == b'glTF', 'A binary glTF mesh is required'
assert len(data) <= 32*1024**2, 'Input exceeds 32 MiB'
SOURCE = BASE / 'source.glb'
SOURCE.write_bytes(data)
SOURCE_SHA = hashlib.sha256(data).hexdigest()
print('Frozen source SHA-256:', SOURCE_SHA)
''')
markdown('Run one bounded inference. The supervisor also terminates the local Blender helper on timeout. Output remains unqualified.')
code('''
OUTPUT = BASE / 'raw-rig.glb'
LOG = BASE / 'inference.log'
command = [str(PY), str(TOOLS / 'run_trial.py'), str(CHECKOUT), str(SOURCE), str(OUTPUT),
           '--source-sha256', SOURCE_SHA, '--profile', PROFILE]
with LOG.open('w') as log:
    process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        result = process.wait(timeout=900)
    finally:
        try: os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError: pass
        time.sleep(1)
        try: os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError: pass
print(LOG.read_text()[-5000:])
assert result == 0 and OUTPUT.exists(), 'Inference failed; retain the log'
print((BASE / 'raw-rig.report.json').read_text())
''')
code('''
freeze = subprocess.check_output([str(sys.executable), '-m', 'uv', 'pip', 'freeze', '--python', str(PY)], text=True)
(BASE / 'environment.txt').write_text(freeze)
(BASE / 'manifest.json').write_text(json.dumps({
    'provider': 'tokenrig', 'qualified': False, 'source_sha256': SOURCE_SHA,
    'upstream_commit': pins['commit'], 'profile': PROFILE, 'hardware': hardware,
    'tools': {name: hashlib.sha256(source.encode()).hexdigest() for name, source in SCRIPTS.items()},
    'raw_sha256': hashlib.sha256(OUTPUT.read_bytes()).hexdigest()}, indent=2))
archive = BASE / 'tokenrig-result.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name in ['raw-rig.glb', 'raw-rig.report.json', 'manifest.json', 'environment.txt', 'inference.log']:
        bundle.write(BASE / name, name)
files.download(str(archive))
''')
notebook = {'nbformat': 4, 'nbformat_minor': 5, 'metadata': {
    'accelerator': 'GPU', 'kernelspec': {'name':'python3','display_name':'Python 3'},
    'language_info': {'name':'python'}}, 'cells': cells}
for index, cell in enumerate(cells):
    cell['id'] = 'teamfight-' + str(index)
    if cell['cell_type'] == 'code':
        compile(''.join(cell['source']), f'cell-{index}', 'exec')
(root / 'tokenrig_colab.ipynb').write_text(json.dumps(notebook, indent=2)+'\n')
print('Wrote notebook; every Python cell compiled successfully.')
