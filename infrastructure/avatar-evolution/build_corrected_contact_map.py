"""Freeze exact canonical corrective assets for a Colab-only contact map."""
import argparse,hashlib,io,json,pathlib,uuid,zipfile
repo=pathlib.Path(__file__).resolve().parents[2];p=argparse.ArgumentParser()
p.add_argument('--source-dir',type=pathlib.Path,required=True);p.add_argument('--clip',type=pathlib.Path,required=True);p.add_argument('--visual-review-id',required=True)
p.add_argument('--installation',type=pathlib.Path,required=True);p.add_argument('--environment',type=pathlib.Path,required=True);p.add_argument('--output-dir',type=pathlib.Path,required=True)
p.add_argument('--contact-map',type=pathlib.Path);p.add_argument('--contact-api-proof',type=pathlib.Path);p.add_argument('--native-control',type=pathlib.Path);p.add_argument('--native-control-proof',type=pathlib.Path);p.add_argument('--native-report',type=pathlib.Path);p.add_argument('--local-arap',action='store_true');a=p.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest();proof=json.loads((a.source_dir/'backoffice-proof.json').read_text());candidate=proof['candidates']['current']
files={n:(a.source_dir/s).read_bytes() for n,s in {'candidate.glb':'current.glb','candidate-report.json':'current-report.json','baseline-report.json':'baseline-report.json','backoffice-proof.json':'backoffice-proof.json'}.items()}
files['candidate-stress.glb']=a.clip.read_bytes();files['installation.json']=a.installation.read_bytes();files['environment.txt']=a.environment.read_bytes();installed=json.loads(files['installation.json']);report=json.loads(files['candidate-report.json'])
if (sha(files['candidate.glb'])!=candidate['artifact_sha256'] or report['corrective_stress_artifact']['sha256']!=sha(files['candidate-stress.glb'])
 or installed.get('status')!='installed_unqualified' or installed.get('compute')!='google' or installed.get('profile')!='t4-fp32'
 or installed.get('publication_eligible') is not False or installed.get('environment_sha256')!=sha(files['environment.txt'])):raise ValueError('Candidate/clip/runtime mismatch')
for n in ['diagnose_corrected_contacts.py','diagnose_collision_influences.py','candidate_animation.py','review_generated_rig.py','mesh_validation.py','bone_mapping.py','asset_pipeline/__init__.py','asset_pipeline/edge_deformation.py']:
 files['tools/'+n]=(repo/'infrastructure/avatar-evolution'/n).read_bytes()
separation=a.contact_map is not None
if separation:
 if not all([a.contact_api_proof,a.native_control,a.native_control_proof,a.native_report]):raise ValueError('Registered contact and native control proofs required')
 files['contact-map.json']=a.contact_map.read_bytes();files['contact-api-proof.json']=a.contact_api_proof.read_bytes();files['native-stress.glb']=a.native_control.read_bytes();files['native-report.json']=a.native_report.read_bytes()
 files['native-control-proof.json']=a.native_control_proof.read_bytes();control=json.loads(files['native-control-proof.json'])
 files['corrected-stress.glb']=files['candidate-stress.glb'];files['corrected-report.json']=files['candidate-report.json']
 contact=json.loads(files['contact-map.json']);api=json.loads(files['contact-api-proof.json']);native=json.loads(files['native-report.json'])
 if (contact['rig_sha256']!=candidate['artifact_sha256'] or api['candidate_sha256']!=candidate['artifact_sha256']
     or not any(d['id']==contact['id'] and d['report_sha256']==sha(files['contact-map.json']) for d in api['diagnostics'])
     or native['artifact']['sha256']!=proof['candidates']['parent']['artifact_sha256']
     or control['source_candidate_sha256']!=native['artifact']['sha256'] or control['control_sha256']!=sha(files['native-stress.glb'])):raise ValueError('Contact/native proof mismatch')
 for n in ['diagnose_contact_separation.py','contact_patch_mask.py','diagnose_skinning_modes.py','review_shoulder_contact_candidate.py','review_tapered_weight_candidate.py','review_collision_weight_candidate.py']:
  files['tools/'+n]=(repo/'infrastructure/avatar-evolution'/n).read_bytes()
 if a.local_arap:files['tools/corrective_local_arap.py']=(repo/'infrastructure/avatar-evolution/corrective_local_arap.py').read_bytes()
elif a.local_arap:raise ValueError('Local ARAP requires a signed contact map and controls')
t=(repo/'infrastructure/avatar-evolution/build_candidate_contact_map.py').read_text();start=t.index("supervisor='''")+len("supervisor='''");end=t.index("'''",start)
supervisor=t[start:end].replace('diagnose_collision_influences.py','diagnose_corrected_contacts.py').replace("stage='contact-map'","stage='corrected-contact-map'").replace('contact-map.log','corrected-contact-map.log').replace('73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105',installed['environment_sha256'])
supervisor=supervisor.replace("assert i['status']=='installed_unqualified'", "assert i['runtime_id']=="+repr(installed['runtime_id'])+" and i['status']=='installed_unqualified'")
if separation:supervisor=supervisor.replace('diagnose_corrected_contacts.py','diagnose_contact_separation.py').replace('corrected-contact-map','contact-separation')
files['supervisor.py']=supervisor.encode();rid=str(uuid.uuid4());out=a.output_dir/rid;out.mkdir(parents=True,exist_ok=False)
plan={'id':rid,'method':'corrected-morph-contact-map-v1','compute':'google','qualification_complete':False,'publication_eligible':False,
 'rig_attempt_id':proof['preparation_id'],'parent_candidate_id':candidate['id'],'parent_candidate_sha256':candidate['artifact_sha256'],
 'visual_review_id':a.visual_review_id,'runtime_id':installed['runtime_id'],'environment_sha256':installed['environment_sha256'],'files':{n:sha(b) for n,b in files.items()}}
if separation:
 plan.update(method='rest-sign-shoulder-separation-v1',source_sha256=proof['source_sha256'],contact_map_id=contact['id'],
  registered_contact_report_sha256=sha(files['contact-map.json']),
  config={'joint':'UpperArmL','region_pair':['bone_2','bone_26'],'max_added_height_fraction':0.003,'falloff_rings':3,'minimum_rest_side_height_fraction':0.00001})
 if a.local_arap:plan.update(method='contact-bound-local-arap-v1',config={'joint':'UpperArmL','region_pair':['bone_2','bone_26'],'max_added_height_fraction':0.001,'falloff_rings':3,'anchor_strength':2.0})
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
