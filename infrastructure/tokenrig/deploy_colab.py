"""Emit a private Colab CLI provisioning cell; this command performs no inference."""
import argparse
import base64
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = ('provision_colab.py', 'model-pins.json', 'prepare_t4_trial.py',
         'verify_attention.py', 'download_models.py', 'run_trial.py', 'sync_drive_cache.py')


def cell(mode='install'):
    if mode == 'install':
        files = FILES
    elif mode == 'start':
        files = ('cloud_service.py', 'diagnose_colab.py')
    else:
        files = ('sync_drive_cache.py', 'model-pins.json')
    sources = {name: base64.b64encode((HERE / name).read_bytes()).decode() for name in files}
    manifest = {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in files}
    launch = '''
 token_file=root/'.worker-token'
 if not token_file.exists():
  import secrets
  fd=os.open(token_file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as stream: stream.write(secrets.token_urlsafe(48))
 environment=dict(os.environ)
 for name in ('HF_TOKEN','HUGGING_FACE_HUB_TOKEN','HF_TOKEN_FILE'):
  environment.pop(name,None)
 environment.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',WANDB_MODE='disabled')
 python=root/'venv/bin/python'
 with (root/'rig-service.log').open('ab') as log:
  subprocess.run([str(python),str(tools/'diagnose_colab.py')],env=environment,
   stdout=log,stderr=subprocess.STDOUT,check=True,timeout=120)
  process=subprocess.Popen([str(python),str(tools/'cloud_service.py')],env=environment,
   stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
''' if mode == 'start' else ('''
 with (root/'drive-cache.log').open('ab') as log:
  process=subprocess.Popen([str(root/'venv/bin/python'),str(tools/'sync_drive_cache.py')],
   stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
''' if mode == 'cache' else '''
 with (root/'provision.log').open('ab') as log:
  process=subprocess.Popen([sys.executable,str(tools/'provision_colab.py'),'--install'],
   stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
''')
    return f'''def _teamfight_provision_preparation():
 import base64, hashlib, json, os, pathlib, subprocess, sys
 import google.colab
 if not os.environ.get('COLAB_RELEASE_TAG'):
  raise RuntimeError('Google Colab is required.')
 root=pathlib.Path('/content/teamfight-preparation')
 tools=root/'tools'
 tools.mkdir(parents=True,exist_ok=True)
 pid_file=root/{'rig.pid' if mode == 'start' else 'cache.pid' if mode == 'cache' else 'provision.pid'!r}
 if pid_file.is_file():
  proc=pathlib.Path('/proc')/pid_file.read_text().strip()
  command=(proc/'cmdline').read_bytes() if (proc/'cmdline').exists() else b''
  if {b'cloud_service.py' if mode == 'start' else b'sync_drive_cache.py' if mode == 'cache' else b'provision_colab.py'!r} in command:
   print('PREPARATION_SETUP='+json.dumps({{'status':'already_active'}}))
   return
 sources={sources!r}
 expected={manifest!r}
 for name,encoded in sources.items():
  content=base64.b64decode(encoded,validate=True)
  if hashlib.sha256(content).hexdigest()!=expected[name]:
   raise RuntimeError('Provisioning source integrity failed.')
  destination=tools/name
  if destination.is_file() and destination.read_bytes()!=content:
   for guard in ('rig.pid','animation.pid','provision.pid'):
    guard_file=root/guard
    if guard_file.is_file():
     proc=pathlib.Path('/proc')/guard_file.read_text().strip()
     command=(proc/'cmdline').read_bytes() if (proc/'cmdline').exists() else b''
     if any(script in command for script in (b'cloud_service.py',b'animation_service.py',b'provision_colab.py')):
      raise RuntimeError('An active preparation service owns these sources. Stop it after preserving its jobs before updating.')
   previous=destination.read_bytes()
   history=root/'source-history'/hashlib.sha256(previous).hexdigest()
   history.mkdir(parents=True,exist_ok=True)
   archived=history/name
   if archived.exists() and archived.read_bytes()!=previous:
    raise RuntimeError('Historical source integrity mismatch.')
   archived.write_bytes(previous)
   installed=root/'installation.json'
   if installed.is_file():
    receipt_history=root/'installation-history'
    receipt_history.mkdir(exist_ok=True)
    (receipt_history/(hashlib.sha256(installed.read_bytes()).hexdigest()+'.json')).write_bytes(installed.read_bytes())
 for name,encoded in sources.items():
  (tools/name).write_bytes(base64.b64decode(encoded,validate=True))
{launch}
 pid_file.write_text(str(process.pid))
 print('PREPARATION_SETUP='+json.dumps({{'status':{'starting' if mode == 'start' else 'caching_models' if mode == 'cache' else 'installing'!r},'pid':process.pid,'tools':expected}}))
_teamfight_provision_preparation()
del _teamfight_provision_preparation
'''


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--mode', choices=('install', 'start', 'cache'), default='install')
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(cell(args.mode), encoding='utf-8')
