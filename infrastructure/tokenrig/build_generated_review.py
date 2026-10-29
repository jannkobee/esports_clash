"""Prepare an immutable Colab review of a recorded generated-body raw rig."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import uuid

PIPELINE=Path(__file__).resolve().parent.parent/'avatar-evolution'
SUPERVISOR='''import fcntl,hashlib,json,os,pathlib,signal,subprocess,time
r=pathlib.Path(__file__).resolve().parent.parent
plan=json.loads((r/'plan.json').read_text())
state={'id':plan['id'],'compute':'google','status':'queued','publication_eligible':False}
def save():
 p=r/'state.tmp.json';p.write_text(json.dumps(state,indent=2));p.replace(r/'state.json')
save()
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Google Colab required')
with pathlib.Path('/content/esports-trellis2/gpu-lease/inference.lock').open('a+') as lease:
 try:fcntl.flock(lease,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:
  state.update(status='waiting_resources');save();raise SystemExit(0)
 process=None
 try:
  for name,expected in plan['files'].items():
   if hashlib.sha256((r/name).read_bytes()).hexdigest()!=expected:raise RuntimeError('Frozen review input changed')
  installed=json.loads(pathlib.Path('/content/teamfight-preparation/installation.json').read_text())
  state.update(status='running',started_unix=time.time(),runtime_id=installed['runtime_id'],environment_sha256=installed['environment_sha256']);save()
  with (r/'review.log').open('ab') as log:
   process=subprocess.Popen(['/content/teamfight-preparation/venv/bin/python',str(r/'tools/review_generated_rig.py'),str(r)],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   state['process_pid']=process.pid;save()
   result=process.wait(timeout=900)
  if result:raise RuntimeError('Controlled raw-rig review failed; inspect retained log')
  report=r/'output/report.json'
  state.update(status='completed',artifact={'sha256':hashlib.sha256(report.read_bytes()).hexdigest(),'bytes':report.stat().st_size})
 except Exception as error:state.update(status='failed',error=str(error))
 finally:
  if process:
   try:os.killpg(process.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   process.wait()
  state['completed_unix']=time.time();save()
'''


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--generation-id',required=True);p.add_argument('--rig-attempt-id',required=True)
    p.add_argument('--source-sha256',required=True);p.add_argument('--rig-sha256',required=True)
    p.add_argument('--output',type=Path,required=True)
    args=p.parse_args()
    for value in (args.generation_id,args.rig_attempt_id):assert str(uuid.UUID(value))==value
    run=str(uuid.uuid4())
    scripts={name:(PIPELINE/name).read_bytes() for name in ('review_generated_rig.py','bone_mapping.py','mesh_validation.py','asset_pipeline/__init__.py','asset_pipeline/edge_deformation.py')}
    scripts['supervise.py']=SUPERVISOR.encode()
    plan={'id':run,'schema':'generated-body-raw-rig-review-v1','compute':'google','generation_id':args.generation_id,
          'rig_attempt_id':args.rig_attempt_id,'source_sha256':args.source_sha256,'rig_sha256':args.rig_sha256,
          'publication_eligible':False,'files':{'source.glb':args.source_sha256,'raw-rig.glb':args.rig_sha256,
          **{'tools/'+n:hashlib.sha256(b).hexdigest() for n,b in scripts.items()}}}
    cell=f'''def _start_generated_review():
 import base64,hashlib,json,os,pathlib,subprocess
 if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Google Colab required')
 plan={plan!r}
 original=pathlib.Path('/content/teamfight-preparation/data/jobs')/plan['rig_attempt_id']
 state=json.loads((original/'state.json').read_text())
 if state['status']!='rigged_unqualified' or state['plan']['source_sha256']!=plan['source_sha256'] or state['artifact']['sha256']!=plan['rig_sha256']:raise RuntimeError('Recorded rig lineage mismatch')
 root=pathlib.Path('/content/teamfight-preparation/reviews')/plan['id']
 root.mkdir(parents=True,exist_ok=False)
 for name in ('source.glb','raw-rig.glb'):
  b=(original/name).read_bytes()
  if hashlib.sha256(b).hexdigest()!=plan['files'][name]:raise RuntimeError('Input identity mismatch')
  (root/name).write_bytes(b)
 for name,encoded in { {n:base64.b64encode(b).decode() for n,b in scripts.items()}!r}.items():
  dest=root/'tools'/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(base64.b64decode(encoded,validate=True))
 (root/'plan.json').write_text(json.dumps(plan,indent=2))
 with (root/'supervisor.log').open('ab') as log:
  process=subprocess.Popen(['/content/teamfight-preparation/venv/bin/python',str(root/'tools/supervise.py')],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 print('GENERATED_REVIEW='+json.dumps({{'id':plan['id'],'pid':process.pid,'source_sha256':plan['source_sha256'],'rig_sha256':plan['rig_sha256']}}))
_start_generated_review()
del _start_generated_review
'''
    compile(cell,'generated-review','exec')
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/'plan.json').write_text(json.dumps(plan,indent=2))
    (args.output/'start.py').write_text(cell)
    print(json.dumps({'id':run,'output':str(args.output)}))


if __name__=='__main__':main()
