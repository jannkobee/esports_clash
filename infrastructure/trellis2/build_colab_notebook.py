"""Build a small self-contained Colab setup notebook from reviewed source files."""
import base64
import io
import json
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = ['provision_native.py','service.py','control.py','diagnose.py','export_node.py','patch_nodes.py',
         'prepare-models.py','requirements.txt','workflow-v1.json','limits.json','model-pins.json',
         'catalog.json','reference-index.json','Dockerfile.native']


def build():
    archive = io.BytesIO()
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as bundle:
        for name in FILES:
            item = zipfile.ZipInfo(name, date_time=(2026,10,21,0,0,0))
            item.compress_type = zipfile.ZIP_DEFLATED
            bundle.writestr(item,(HERE/name).read_bytes())
    encoded = base64.b64encode(archive.getvalue()).decode()
    def markdown(text):
        return {'cell_type':'markdown','metadata':{},'source':text.splitlines(keepends=True)}
    def code(text):
        return {'cell_type':'code','metadata':{},'source':text.splitlines(keepends=True),'outputs':[],'execution_count':None}
    cells = [markdown('''# Esports Clash — native TRELLIS.2 setup

This installs the pinned quantized TRELLIS.2 generator used by Local into an
isolated Python 3.12 environment. It does not use Shap-E or saved donor geometry.

1. Connect your allocated NVIDIA GPU runtime. The pinned CUDA/BF16 diagnostics
   must pass; a T4 is not assumed compatible. No paid runtime is selected here.
2. Obtain official access to `facebook/dinov3-vitl16-pretrain-lvd1689m` and add an
   approved Hugging Face token to **Colab Secrets** as `HF_TOKEN`.
3. Run the cells in order. Installation may download several GB and compile CUDA
   extensions. Diagnostics and model hashes must pass before the UI reports ready.
4. Reconnect this runtime to the application's `asset-quality` Colab CLI session.
   Keep the private worker token and session credentials out of chat/source control.

The native worker binds only to loopback. Generated sources still require visual,
rigging and game-runtime qualification before publication.
'''),code(f'''import base64, io, json, os, pathlib, subprocess, sys, zipfile
root = pathlib.Path('/content/esports-trellis2')
if (root / 'native.pid').exists():
    try:
        os.kill(int((root / 'native.pid').read_text()), 0)
    except ProcessLookupError:
        pass
    else:
        raise RuntimeError('An existing native worker is active. Preserve it before replacing setup sources.')
source = root / 'src'
source.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(io.BytesIO(base64.b64decode('{encoded}'))) as bundle:
    for entry in bundle.infolist():
        destination = (source / entry.filename).resolve()
        if not destination.is_relative_to(source.resolve()):
            raise ValueError('Unexpected setup path')
        destination.write_bytes(bundle.read(entry))
print('Reviewed TRELLIS.2 setup files are ready.')
'''),code('''from google.colab import userdata
try:
    os.environ['HF_TOKEN'] = userdata.get('HF_TOKEN')
    subprocess.run([sys.executable, str(source / 'provision_native.py'), '--root', str(root), '--install'], check=True)
finally:
    os.environ.pop('HF_TOKEN', None)
'''),code('''subprocess.run([sys.executable, str(source / 'provision_native.py'), '--root', str(root), '--start'], check=True)
'''),code('''import time, urllib.request
for attempt in range(20):
    try:
        request = urllib.request.Request('http://127.0.0.1:8096/operations', headers={
            'Authorization': 'Bearer ' + (root / '.worker-token').read_text().strip()})
        with urllib.request.urlopen(request, timeout=5) as response:
            status = json.load(response)
        print(json.dumps({'provider':status['provider'], 'models':status['models'], 'gpu_validated':status['gpu_validated']}, indent=2))
        break
    except OSError:
        time.sleep(1)
else:
    raise RuntimeError('Native worker did not start. Inspect /content/esports-trellis2/native.log privately.')
''')]
    notebook={'nbformat':4,'nbformat_minor':5,'metadata':{'kernelspec':{'display_name':'Python 3','language':'python','name':'python3'}},'cells':cells}
    target=HERE.parent.parent/'EsportsClash.Api/resources/avatars/trellis2-colab.ipynb'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(notebook,indent=1)+'\n')
    print('Built native TRELLIS.2 Colab notebook:',target)


if __name__=='__main__':build()
