"""Freeze a Colab-only roll diagnostic from retained failed-candidate evidence."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import uuid

HERE = Path(__file__).resolve().parent
PIPELINE = HERE.parent / 'avatar-evolution'

SUPERVISOR = '''import fcntl, hashlib, json, os, pathlib, signal, subprocess, time
root=pathlib.Path(__file__).resolve().parent.parent
plan=json.loads((root/'plan.json').read_text())
state={'id':plan['id'],'status':'queued','compute':'google','publication_eligible':False}
def save():
 temp=root/'state.tmp.json'
 temp.write_text(json.dumps(state,indent=2))
 temp.replace(root/'state.json')
save()
if not os.environ.get('COLAB_RELEASE_TAG'):
 raise RuntimeError('Google Colab is required.')
lease=pathlib.Path('/content/esports-trellis2/gpu-lease')
lease.mkdir(parents=True,exist_ok=True)
with (lease/'inference.lock').open('a+') as lock:
 try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:
  state.update(status='waiting_resources',reason='Another cloud stage owns the shared runtime.')
  save()
  raise SystemExit(0)
 python='/content/teamfight-preparation/venv/bin/python'
 process=None
 try:
  installed=json.loads(pathlib.Path('/content/teamfight-preparation/installation.json').read_text())
  state.update(status='running',started_unix=time.time(),runtime_id=installed['runtime_id'],environment_sha256=installed['environment_sha256'])
  save()
  for name,expected in plan['tools'].items():
   if hashlib.sha256((root/'tools'/name).read_bytes()).hexdigest()!=expected:
    raise RuntimeError('Frozen diagnostic source changed.')
  with (root/'analysis.log').open('ab') as log:
   process=subprocess.Popen([python,str(root/'tools/analyze_bind_twist.py'),'--source',str(root/'source.glb'),
    '--output',str(root/'output'),'--source-sha256',plan['source_sha256'],'--variant-set',plan.get('variant_set','isolated')],
    stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   state['process_pid']=process.pid
   save()
   result=process.wait(timeout=600)
  if result: raise RuntimeError('Controlled diagnostic failed; cloud log and frozen source retained.')
  report=root/'output/report.json'
  payload=json.loads(report.read_text())
  if payload['source_sha256']!=plan['source_sha256'] or payload['publication_eligible'] is not False:
   raise RuntimeError('Diagnostic output identity mismatch.')
  state.update(status='completed',completed_unix=time.time(),artifact={'sha256':hashlib.sha256(report.read_bytes()).hexdigest(),'bytes':report.stat().st_size},report=payload)
 except Exception as error:
  state.update(status='failed',error=str(error),completed_unix=time.time())
 finally:
  if process:
   try: os.killpg(process.pid,signal.SIGKILL)
   except ProcessLookupError: pass
   process.wait()
  save()
'''


def build(source, candidate_id, expected, attempt_id, variant_set='isolated'):
    if str(uuid.UUID(candidate_id)) != candidate_id or str(uuid.UUID(attempt_id)) != attempt_id:
        raise ValueError('Exact candidate/attempt UUIDs are required')
    content = source.read_bytes()
    if hashlib.sha256(content).hexdigest() != expected:
        raise ValueError('The failed candidate does not match its backoffice artifact hash')
    names = ('analyze_bind_twist.py', 'mesh_validation.py',
             'asset_pipeline/__init__.py', 'asset_pipeline/edge_deformation.py')
    scripts = {name: (PIPELINE / name).read_bytes() for name in names}
    scripts['supervise.py'] = SUPERVISOR.encode()
    plan = {'schema': 'failed-rig-roll-isolation-v1', 'id': attempt_id,
            'avatar_id': 'c_invoker', 'source_candidate_id': candidate_id,
            'source_file': 'mirelle-base-animated.glb', 'source_sha256': expected,
            'source_role': 'failed_candidate_diagnostic_only', 'compute': 'google',
            'publication_eligible': False, 'status': 'started',
            'variant_set': variant_set,
            'tools': {name: hashlib.sha256(code).hexdigest() for name, code in scripts.items()},
            'hypothesis': 'Authored arm aim-frame roll or handedness causes shoulder/elbow intersections independently of joint positions; compare isolated changes without altering skin or topology.'}
    encoded = {name: base64.b64encode(code).decode() for name, code in scripts.items()}
    cell = f'''def _teamfight_start_roll_diagnostic():
 import base64,hashlib,json,os,pathlib,subprocess
 import google.colab
 if not os.environ.get('COLAB_RELEASE_TAG'): raise RuntimeError('Google Colab required.')
 root=pathlib.Path('/content/teamfight-preparation/diagnostics')/{attempt_id!r}
 root.mkdir(parents=True,exist_ok=False)
 plan={plan!r}
 source=base64.b64decode({base64.b64encode(content).decode()!r},validate=True)
 if hashlib.sha256(source).hexdigest()!=plan['source_sha256']: raise RuntimeError('Failed source integrity check.')
 (root/'source.glb').write_bytes(source)
 (root/'plan.json').write_text(json.dumps(plan,indent=2))
 for name,encoded in {encoded!r}.items():
  code=base64.b64decode(encoded,validate=True)
  if hashlib.sha256(code).hexdigest()!=plan['tools'][name]: raise RuntimeError('Diagnostic tool integrity mismatch.')
  destination=root/'tools'/name
  destination.parent.mkdir(parents=True,exist_ok=True)
  destination.write_bytes(code)
 with (root/'supervisor.log').open('ab') as log:
  process=subprocess.Popen(['/content/teamfight-preparation/venv/bin/python',str(root/'tools/supervise.py')],
   cwd=root,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 (root/'supervisor.pid').write_text(str(process.pid))
 print('DIAGNOSTIC_STARTED='+json.dumps({{'id':plan['id'],'compute':'google','pid':process.pid,'source_sha256':plan['source_sha256'],'publication_eligible':False}}))
_teamfight_start_roll_diagnostic()
del _teamfight_start_roll_diagnostic
'''
    return plan, cell


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--candidate-id', required=True)
    parser.add_argument('--source-sha256', required=True)
    parser.add_argument('--attempt-id', default=None)
    parser.add_argument('--variant-set', choices=('isolated','coherent'), default='isolated')
    parser.add_argument('--output-cell', type=Path, required=True)
    parser.add_argument('--output-plan', type=Path, required=True)
    args = parser.parse_args()
    plan, cell = build(args.source, args.candidate_id, args.source_sha256, args.attempt_id or str(uuid.uuid4()), args.variant_set)
    args.output_cell.parent.mkdir(parents=True, exist_ok=True)
    args.output_cell.write_text(cell)
    args.output_plan.write_text(json.dumps(plan, indent=2) + '\n')
    compile(cell, 'colab-diagnostic-cell', 'exec')
    print(json.dumps({'id': plan['id'], 'source_sha256': plan['source_sha256']}))
