"""Package canonical artifact bytes for the Colab-only fixed-weight socket study."""
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
parser.add_argument('--study', choices=['axial', 'combined', 'hip', 'hip-forward'], default='axial')
args = parser.parse_args()
proof = json.loads((args.source_dir/'backoffice-proof.json').read_text())
parent, reference = proof['candidates']['current'], proof['candidates']['parent']
sha = lambda data: hashlib.sha256(data).hexdigest()
files = {name:(args.source_dir/source).read_bytes() for name, source in {
    'candidate.glb':'current.glb', 'reference.glb':'parent.glb', 'candidate-report.json':'current-report.json',
    'reference-report.json':'parent-report.json', 'baseline-report.json':'baseline-report.json',
    'backoffice-proof.json':'backoffice-proof.json'}.items()}
assert sha(files['candidate.glb']) == parent['artifact_sha256']
assert sha(files['reference.glb']) == reference['artifact_sha256']
for name in ('review_shoulder_socket_study.py','gltf_joint_pivots.py','inspect_shoulder_sockets.py','review_generated_rig.py',
        'review_collision_weight_candidate.py','review_tapered_weight_candidate.py','mesh_validation.py',
        'bone_mapping.py','asset_pipeline/__init__.py','asset_pipeline/edge_deformation.py'):
    files['tools/'+name] = (repo/'infrastructure/avatar-evolution'/name).read_bytes()
rid = str(uuid.uuid4());out = args.output_dir/rid;out.mkdir(parents=True, exist_ok=False)
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
  i=json.loads(pathlib.Path('/content/teamfight-preparation/installation.json').read_text())
  assert i['status']=='installed_unqualified' and i['profile']=='t4-fp32' and i['environment_sha256']=='73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105'
  s.update(status='running',stage='socket-study',runtime_id=i['runtime_id'],environment_sha256=i['environment_sha256'],started_unix=time.time());save()
  with (r/'socket-study.log').open('ab') as log:
   p=subprocess.run(['/content/teamfight-preparation/venv/bin/python','-u',str(r/'tools/review_shoulder_socket_study.py'),str(r)],stdout=log,stderr=subprocess.STDOUT,timeout=2400)
  s['exit_code']=p.returncode;save()
  if p.returncode:raise RuntimeError('Socket study exited '+str(p.returncode))
  report=r/'output/report.json';d=json.loads(report.read_text());assert d['status']=='diagnostic_complete'
  s.update(status='completed',report_sha256=hashlib.sha256(report.read_bytes()).hexdigest())
 except Exception as error:s.update(status='failed',error=f'{type(error).__name__}: {error}')
 finally:s['completed_unix']=time.time();save()
'''
files['supervisor.py'] = supervisor.encode()
variants = ['lateral_0p5pct','medial_0p5pct','anterior_0p5pct','posterior_0p5pct','superior_0p5pct','inferior_0p5pct','section_bounds_center']
method = 'weight-fixed-shoulder-socket-placement-v1'
if args.study == 'combined':
    variants = ['outward_forward_0p5pct'];method = 'weight-fixed-shoulder-socket-combined-v2'
elif args.study == 'hip':method = 'weight-fixed-hip-socket-placement-v1'
elif args.study == 'hip-forward':
    variants=['anterior_0p99pct'];method='weight-fixed-hip-forward-extent-v2'
plan = {'id':rid,'compute':'google','publication_eligible':False,'qualification_complete':False,
    'method':method,'rig_attempt_id':proof['preparation_id'],
    'parent_candidate_id':parent['id'],'parent_candidate_sha256':parent['artifact_sha256'],
    'reference_candidate_id':reference['id'],'reference_candidate_sha256':reference['artifact_sha256'],
    'variants':variants,'candidate_ids':{name:str(uuid.uuid5(uuid.UUID(rid),name)) for name in variants},
    'constraints':{'maximum_head_displacement_to_height':.01,'axial_offset_to_height':.0099 if args.study=='hip-forward' else .005,
        'inside_source_section_bounds':True,'weights_fixed':True,'unrelated_rest_joints_fixed':True,
        'section_plane_offsets_to_height':[-.01,0,.01,.02],'section_radius_to_height':.055,
        'roundtrip_surface_max_m':1e-6,'weight_match_max_error':2e-6},
    'files':{name:sha(data) for name,data in files.items()}}
files['plan.json'] = json.dumps(plan,indent=2).encode();buffer = io.BytesIO()
with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as archive:
    for name,data in files.items():archive.writestr(name,data)
(out/'input.zip').write_bytes(buffer.getvalue());(out/'plan.json').write_bytes(files['plan.json'])
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
(out/'launch.py').write_text(launch)
print(json.dumps({'id':rid,'bytes':len(buffer.getvalue()),'folder':str(out.resolve())}))
