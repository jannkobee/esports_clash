"""Package a source-bound Colab shoulder study; performs no local 3D processing."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import uuid
import zipfile

repo = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--source-dir', type=Path, required=True)
parser.add_argument('--output-dir', type=Path, required=True)
parser.add_argument('--variant', choices=['arm-favoring', 'torso-return'], default='arm-favoring')
args = parser.parse_args()
proof = json.loads((args.source_dir / 'backoffice-proof.json').read_text())
contact_proof = proof['contact_map'];parent = proof['candidates']['current'];reference = proof['candidates']['parent']
files = {name: (args.source_dir / source).read_bytes() for name, source in {
    'candidate.glb': 'current.glb', 'reference.glb': 'parent.glb',
    'candidate-report.json': 'current-report.json', 'reference-report.json': 'parent-report.json',
    'baseline-report.json': 'baseline-report.json', 'contact-map.json': 'contact-map.json',
    'backoffice-proof.json': 'backoffice-proof.json'}.items()}
sha = lambda value: hashlib.sha256(value).hexdigest()
assert sha(files['candidate.glb']) == parent['artifact_sha256']
assert sha(files['reference.glb']) == reference['artifact_sha256']
assert sha(files['contact-map.json']) == contact_proof['exported_report_sha256']
assert contact_proof['source_candidate_id'] == parent['id'] and contact_proof['source_candidate_sha256'] == parent['artifact_sha256']
for name in ('review_shoulder_contact_candidate.py', 'contact_patch_mask.py', 'test_contact_patch_mask.py',
        'review_collision_weight_candidate.py', 'review_tapered_weight_candidate.py', 'review_generated_rig.py',
        'mesh_validation.py', 'bone_mapping.py', 'asset_pipeline/__init__.py', 'asset_pipeline/edge_deformation.py'):
    files['tools/' + name] = (repo / 'infrastructure/avatar-evolution' / name).read_bytes()
rid = str(uuid.uuid4());out = args.output_dir / rid;out.mkdir(parents=True, exist_ok=False)
supervisor = '''import fcntl,hashlib,json,os,pathlib,subprocess,time
r=pathlib.Path(__file__).parent;s={'id':r.name,'compute':'google','publication_eligible':False,'qualification_complete':False,'status':'queued'}
def save():
 p=r/'state.tmp.json';p.write_text(json.dumps(s,indent=2));p.replace(r/'state.json')
assert os.environ.get('COLAB_RELEASE_TAG');save()
lease=pathlib.Path('/content/esports-trellis2/gpu-lease/inference.lock');lease.parent.mkdir(parents=True,exist_ok=True)
with lease.open('a+') as lock:
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:s.update(status='waiting_resources');save();raise SystemExit()
 try:
  i=json.loads(pathlib.Path('/content/teamfight-preparation/installation.json').read_text());assert i['status']=='installed_unqualified' and i['profile']=='t4-fp32'
  s.update(status='running',runtime_id=i['runtime_id'],environment_sha256=i['environment_sha256'],started_unix=time.time());save()
  python='/content/teamfight-preparation/venv/bin/python'
  stages=[('contact-contract-checks',[python,'-m','unittest','discover','-s',str(r/'tools'),'-p','test_contact_patch_mask.py','-v']),
   ('repair-study',[python,'-u',str(r/'tools/review_shoulder_contact_candidate.py'),str(r)])]
  for stage,command in stages:
   s['stage']=stage;save()
   with (r/(stage+'.log')).open('ab') as log:p=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,timeout=1200)
   s['exit_code']=p.returncode;save()
   if p.returncode:raise RuntimeError(stage+' exited '+str(p.returncode))
  report=r/'output/report.json';d=json.loads(report.read_text())
  if d['status']!='review_required':raise RuntimeError(d.get('error','Incomplete shoulder study'))
  s.update(status='completed',report_sha256=hashlib.sha256(report.read_bytes()).hexdigest())
 except Exception as error:s.update(status='failed',error=f'{type(error).__name__}: {error}')
 finally:s['completed_unix']=time.time();save()
'''
files['supervisor.py'] = supervisor.encode()
config = {'donor': 'bone_2', 'roles': ['UpperArmL', 'UpperArmR'], 'maximum_donor_fraction': .12,
    'falloff_rings': 3, 'target_weight_gate': [.25, .5], 'seed_pair_policy': 'only-donor-target-contact-pair'}
method = 'signed-contact-shoulder-bone2-transfer-v1'
if args.variant == 'torso-return':
    method = 'signed-contact-shoulder-torso-return-v1'
    config = {'donor': 'mapped_upper_arm', 'target': 'bone_2', 'roles': ['UpperArmL', 'UpperArmR'],
        'maximum_donor_fraction': .12, 'falloff_rings': 3, 'torso_weight_gate': [.5, .75],
        'torso_groups': ['Spine', 'bone_2', 'Chest'], 'seed_pair_policy': 'only-donor-target-contact-pair'}
plan = {'id': rid, 'compute': 'google', 'publication_eligible': False, 'qualification_complete': False,
    'method': method, 'rig_attempt_id': proof['preparation_id'],
    'parent_candidate_id': parent['id'], 'parent_candidate_sha256': parent['artifact_sha256'],
    'reference_candidate_id': reference['id'], 'reference_candidate_sha256': reference['artifact_sha256'],
    'contact_map_id': contact_proof['id'], 'registered_contact_report_sha256': contact_proof['report_sha256'],
    'repair_config': config, 'files': {name: sha(data) for name, data in files.items()}}
files['plan.json'] = json.dumps(plan, indent=2).encode();buffer = io.BytesIO()
with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name, data in files.items():archive.writestr(name, data)
(out / 'input.zip').write_bytes(buffer.getvalue());(out / 'plan.json').write_bytes(files['plan.json'])
launch = f'''import hashlib,json,os,pathlib,shutil,subprocess,zipfile
assert os.environ.get('COLAB_RELEASE_TAG');rid={rid!r};root=pathlib.Path('/content/teamfight-preparation');incoming=root/('incoming-'+rid+'.zip');r=root/'reviews'/rid
assert hashlib.sha256(incoming.read_bytes()).hexdigest()=={sha(buffer.getvalue())!r};r.mkdir(parents=True,exist_ok=False);shutil.copy2(incoming,r/'input.zip')
with zipfile.ZipFile(incoming) as z:
 assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in z.namelist());z.extractall(r)
plan=json.loads((r/'plan.json').read_text());assert plan['id']==rid
for n,h in plan['files'].items():assert hashlib.sha256((r/n).read_bytes()).hexdigest()==h,n
with (r/'supervisor.log').open('ab') as log:p=subprocess.Popen(['/content/teamfight-preparation/venv/bin/python','-u',str(r/'supervisor.py')],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
print(json.dumps({{'id':rid,'pid':p.pid,'status':'queued'}}))
'''
(out / 'launch.py').write_text(launch)
print(json.dumps({'id': rid, 'bytes': len(buffer.getvalue()), 'folder': str(out.resolve())}))
