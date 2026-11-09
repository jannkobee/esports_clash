"""Package canonical rig bytes and retained Colab targets for a portable bake."""
import argparse,hashlib,io,json,pathlib,uuid,zipfile
repo=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--source-dir',type=pathlib.Path,required=True);p.add_argument('--target-dir',type=pathlib.Path,required=True);p.add_argument('--control-dir',type=pathlib.Path,required=True);p.add_argument('--output-dir',type=pathlib.Path,required=True);p.add_argument('--installation',type=pathlib.Path,required=True);p.add_argument('--environment',type=pathlib.Path,required=True);a=p.parse_args()
sha=lambda data:hashlib.sha256(data).hexdigest()
proof=json.loads((a.source_dir/'backoffice-proof.json').read_text());parent=proof['candidates']['current'];reference=proof['candidates']['parent']
files={name:(a.source_dir/source).read_bytes() for name,source in {'candidate.glb':'current.glb','reference.glb':'parent.glb','candidate-report.json':'current-report.json','reference-report.json':'parent-report.json','baseline-report.json':'baseline-report.json','backoffice-proof.json':'backoffice-proof.json'}.items()}
for name,source in {'target-plan.json':'plan.json','target-state.json':'state.json','target-report.json':'output/report.json','corrective-targets.npz':'output/corrective-targets.npz'}.items():files[name]=(a.target_dir/source).read_bytes()
for name in ('native-control.glb','control-proof.json'):files[name]=(a.control_dir/name).read_bytes()
files['installation.json']=a.installation.read_bytes();files['environment.txt']=a.environment.read_bytes();installed=json.loads(files['installation.json'])
if (installed.get('status')!='installed_unqualified' or installed.get('compute')!='google' or installed.get('profile')!='t4-fp32'
    or installed.get('publication_eligible') is not False or installed.get('environment_sha256')!=sha(files['environment.txt'])):raise ValueError('Exact Google T4 installation receipt required')
control=json.loads(files['control-proof.json']);assert control['source_candidate_sha256']==parent['artifact_sha256'] and control['control_sha256']==sha(files['native-control.glb'])
target=json.loads(files['target-report.json']);state=json.loads(files['target-state.json'])
assert sha(files['candidate.glb'])==parent['artifact_sha256'] and sha(files['reference.glb'])==reference['artifact_sha256']
assert target['rig_sha256']==parent['artifact_sha256'] and target['parent_candidate_id']==parent['id']
assert state['status']=='completed' and state['report_sha256']==sha(files['target-report.json']) and target['target_surface_artifact']['sha256']==sha(files['corrective-targets.npz'])
for name in ('bake_pose_corrective_candidate.py','glb_morph_animation.py','candidate_animation.py','review_generated_rig.py',
        'review_collision_weight_candidate.py','review_shoulder_socket_study.py','inspect_shoulder_sockets.py','gltf_joint_pivots.py',
        'review_tapered_weight_candidate.py','diagnose_skinning_modes.py','contact_patch_mask.py','review_shoulder_contact_candidate.py',
        'mesh_validation.py','bone_mapping.py','asset_pipeline/__init__.py','asset_pipeline/edge_deformation.py'):
    files['tools/'+name]=(repo/'infrastructure/avatar-evolution'/name).read_bytes()
rid=str(uuid.uuid4());out=a.output_dir/rid;out.mkdir(parents=True,exist_ok=False)
supervisor='''import fcntl,hashlib,json,os,pathlib,subprocess,time
r=pathlib.Path(__file__).parent;s={'id':r.name,'compute':'google','publication_eligible':False,'qualification_complete':False,'status':'queued'}
def save():
 p=r/'state.tmp.json';p.write_text(json.dumps(s,indent=2));p.replace(r/'state.json')
assert os.environ.get('COLAB_RELEASE_TAG');save()
lease=pathlib.Path('/content/esports-trellis2/gpu-lease/inference.lock');lease.parent.mkdir(parents=True,exist_ok=True)
with lease.open('a+') as lock:
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:s.update(status='waiting_resources');save();raise SystemExit()
 try:
  i=json.loads(pathlib.Path('/content/teamfight-preparation/installation.json').read_text());assert i['status']=='installed_unqualified' and i['profile']=='t4-fp32' and i['environment_sha256']=='73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105'
  s.update(status='running',stage='portable-corrective-bake',runtime_id=i['runtime_id'],environment_sha256=i['environment_sha256'],started_unix=time.time());save()
  with (r/'corrective-bake.log').open('ab') as log:
   p=subprocess.run(['/content/teamfight-preparation/venv/bin/python','-u',str(r/'tools/bake_pose_corrective_candidate.py'),str(r)],stdout=log,stderr=subprocess.STDOUT,timeout=1800)
  s['exit_code']=p.returncode;save()
  if p.returncode:raise RuntimeError('Corrective bake exited '+str(p.returncode))
  report=r/'output/report.json';d=json.loads(report.read_text());assert d['status']=='review_required'
  s.update(status='completed',report_sha256=hashlib.sha256(report.read_bytes()).hexdigest())
 except Exception as error:s.update(status='failed',error=f'{type(error).__name__}: {error}')
 finally:s['completed_unix']=time.time();save()
'''
supervisor=supervisor.replace('73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105',installed['environment_sha256'])
supervisor=supervisor.replace("assert i['status']=='installed_unqualified'", "assert i['runtime_id']=="+repr(installed['runtime_id'])+" and i['status']=='installed_unqualified'")
files['supervisor.py']=supervisor.encode()
plan={'id':rid,'compute':'google','publication_eligible':False,'qualification_complete':False,'method':'contact-bound-portable-pose-correctives-v3',
    'rig_attempt_id':proof['preparation_id'],'parent_candidate_id':parent['id'],'parent_candidate_sha256':parent['artifact_sha256'],
    'reference_candidate_id':reference['id'],'reference_candidate_sha256':reference['artifact_sha256'],'target_probe_id':target['id'],
    'runtime_id':installed['runtime_id'],'environment_sha256':installed['environment_sha256'],
    'constraints':{'morph_targets':4,'maximum_posed_delta_to_height':.02,'maximum_rest_delta_to_height':.04,'maximum_inverse_skin_condition':10,
        'rest_surface_max_m':1e-6,'native_target_match_max_m':1e-6,'canonical_skeleton_matrix_max_error':1e-6,'seam_spread_max_m':1e-6,
        'canonical_skeleton_comparison':'exact-retained-native-control','skinned_mesh_layout':'static-identity-root-mesh-v1'},
    'files':{name:sha(data) for name,data in files.items()}}
files['plan.json']=json.dumps(plan,indent=2).encode();buffer=io.BytesIO()
with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in files.items():z.writestr(name,data)
(out/'input.zip').write_bytes(buffer.getvalue());(out/'plan.json').write_bytes(files['plan.json'])
launch=f'''import hashlib,json,os,pathlib,shutil,subprocess,zipfile
assert os.environ.get('COLAB_RELEASE_TAG');rid={rid!r};root=pathlib.Path('/content/teamfight-preparation');incoming=root/('incoming-'+rid+'.zip');r=root/'reviews'/rid
assert hashlib.sha256(incoming.read_bytes()).hexdigest()=={sha(buffer.getvalue())!r};r.mkdir(parents=True,exist_ok=False);shutil.copy2(incoming,r/'input.zip')
with zipfile.ZipFile(incoming) as z:
 assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in z.namelist());z.extractall(r)
plan=json.loads((r/'plan.json').read_text());assert plan['id']==rid
for n,h in plan['files'].items():assert hashlib.sha256((r/n).read_bytes()).hexdigest()==h,n
with (r/'supervisor.log').open('ab') as log:p=subprocess.Popen(['/content/teamfight-preparation/venv/bin/python','-u',str(r/'supervisor.py')],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
print(json.dumps({{'id':rid,'pid':p.pid,'status':'queued'}}))
'''
(out/'launch.py').write_text(launch);print(json.dumps({'id':rid,'bytes':len(buffer.getvalue()),'folder':str(out.resolve())}))
