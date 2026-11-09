"""Package frozen target bytes for the Colab-only shoulder-shape experiment."""
import argparse,hashlib,io,json,pathlib,uuid,zipfile
repo=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--source-dir',type=pathlib.Path,required=True);p.add_argument('--target-dir',type=pathlib.Path,required=True);p.add_argument('--installation',type=pathlib.Path,required=True);p.add_argument('--environment',type=pathlib.Path,required=True);p.add_argument('--output-dir',type=pathlib.Path,required=True);a=p.parse_args()
sha=lambda x:hashlib.sha256(x).hexdigest();proof=json.loads((a.source_dir/'backoffice-proof.json').read_text());parent=proof['candidates']['parent']
files={n:(a.source_dir/source).read_bytes() for n,source in {'candidate.glb':'parent.glb','candidate-report.json':'parent-report.json','baseline-report.json':'baseline-report.json','backoffice-proof.json':'backoffice-proof.json'}.items()}
for n,s in {'target-report.json':'output/report.json','corrective-targets.npz':'output/corrective-targets.npz','target-plan.json':'plan.json','target-state.json':'state.json'}.items():files[n]=(a.target_dir/s).read_bytes()
files['installation.json']=a.installation.read_bytes();files['environment.txt']=a.environment.read_bytes();installed=json.loads(files['installation.json']);target=json.loads(files['target-report.json']);state=json.loads(files['target-state.json'])
if (installed.get('status')!='installed_unqualified' or installed.get('profile')!='t4-fp32' or installed.get('compute')!='google' or installed.get('environment_sha256')!=sha(files['environment.txt'])
 or sha(files['candidate.glb'])!=parent['artifact_sha256'] or target['rig_sha256']!=parent['artifact_sha256'] or state['status']!='completed' or state['report_sha256']!=sha(files['target-report.json'])
 or target['target_surface_artifact']['sha256']!=sha(files['corrective-targets.npz'])):raise ValueError('Target/source/environment proof mismatch')
for n in ['diagnose_corrective_shape_blend.py','diagnose_skinning_modes.py','contact_patch_mask.py','review_shoulder_contact_candidate.py','review_tapered_weight_candidate.py','review_collision_weight_candidate.py','review_generated_rig.py','mesh_validation.py','bone_mapping.py','asset_pipeline/__init__.py','asset_pipeline/edge_deformation.py']:
 files['tools/'+n]=(repo/'infrastructure/avatar-evolution'/n).read_bytes()
t=(repo/'infrastructure/avatar-evolution/build_candidate_contact_map.py').read_text();start=t.index("supervisor='''")+len("supervisor='''");end=t.index("'''",start)
supervisor=t[start:end].replace('diagnose_collision_influences.py','diagnose_corrective_shape_blend.py').replace("stage='contact-map'","stage='shoulder-shape-blend'").replace('contact-map.log','shoulder-shape-blend.log').replace('73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105',installed['environment_sha256'])
supervisor=supervisor.replace("assert i['status']=='installed_unqualified'", "assert i['runtime_id']=="+repr(installed['runtime_id'])+" and i['status']=='installed_unqualified'")
files['supervisor.py']=supervisor.encode();rid=str(uuid.uuid4());out=a.output_dir/rid;out.mkdir(parents=True,exist_ok=False)
plan={'id':rid,'method':'half-strength-shoulder-target-v1','compute':'google','qualification_complete':False,'publication_eligible':False,
 'rig_attempt_id':proof['preparation_id'],'source_sha256':proof['source_sha256'],'parent_candidate_id':parent['id'],'parent_candidate_sha256':parent['artifact_sha256'],
 'target_probe_id':target['id'],'registered_target_report_sha256':sha(files['target-report.json']),
 'blend_policy':{'UpperArmL':.5,'UpperArmR':.5,'ThighL':1.,'ThighR':1.},'runtime_id':installed['runtime_id'],'environment_sha256':installed['environment_sha256'],
 'files':{n:sha(b) for n,b in files.items()}}
files['plan.json']=json.dumps(plan,indent=2).encode();buf=io.BytesIO()
with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as z:
 for n,b in files.items():z.writestr(n,b)
data=buf.getvalue();(out/'input.zip').write_bytes(data);(out/'plan.json').write_bytes(files['plan.json'])
launch=f'''import hashlib,json,os,pathlib,shutil,subprocess,zipfile
assert os.environ.get('COLAB_RELEASE_TAG');rid={rid!r};root=pathlib.Path('/content/teamfight-preparation');incoming=root/('incoming-'+rid+'.zip');r=root/'reviews'/rid
assert hashlib.sha256(incoming.read_bytes()).hexdigest()=={sha(data)!r};r.mkdir(parents=True,exist_ok=False);shutil.copy2(incoming,r/'input.zip')
with zipfile.ZipFile(incoming) as z:
 assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in z.namelist());z.extractall(r)
plan=json.loads((r/'plan.json').read_text())
for n,h in plan['files'].items():assert hashlib.sha256((r/n).read_bytes()).hexdigest()==h,n
with (r/'supervisor.log').open('ab') as log:p=subprocess.Popen(['/content/teamfight-preparation/venv/bin/python','-u',str(r/'supervisor.py')],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
print(json.dumps({{'id':rid,'pid':p.pid,'status':'queued'}}))
'''
(out/'launch.py').write_text(launch);print(json.dumps({'id':rid,'bytes':len(data),'folder':str(out.resolve())}))
