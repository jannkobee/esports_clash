"""Package bytes for Colab-only interpolation diagnosis; never process assets locally."""
import argparse,hashlib,io,json,pathlib,uuid,zipfile
repo=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--review-dir',type=pathlib.Path,required=True);p.add_argument('--output-dir',type=pathlib.Path,required=True);p.add_argument('--installation',type=pathlib.Path,required=True);p.add_argument('--environment',type=pathlib.Path,required=True);a=p.parse_args()
source=a.review_dir;visual=json.loads((source/'visual-report.json').read_text());proof=json.loads((source/'backoffice-proof.json').read_text())
assert visual['status']=='rendered_for_review' and not visual['errors']
files={n:(source/n).read_bytes() for n in ['backoffice-proof.json','baseline-report.json','parent-report.json','current-report.json','bend-export-report.json']}
files['installation.json']=a.installation.read_bytes();files['environment.txt']=a.environment.read_bytes();installed=json.loads(files['installation.json'])
if (installed.get('status')!='installed_unqualified' or installed.get('profile')!='t4-fp32' or installed.get('compute')!='google'
 or installed.get('publication_eligible') is not False or installed.get('environment_sha256')!=hashlib.sha256(files['environment.txt']).hexdigest()):raise ValueError('Exact installed Google T4 receipt and environment required')
for label in ['parent','current']:files[label+'-stress.glb']=(source/'site'/(label+'-stress.glb')).read_bytes()
for name in ['diagnose_corrective_motion.py','candidate_animation.py','glb_morph_animation.py','diagnose_skinning_modes.py','contact_patch_mask.py','diagnose_collision_influences.py','review_generated_rig.py','mesh_validation.py','bone_mapping.py','review_shoulder_contact_candidate.py','review_tapered_weight_candidate.py','review_collision_weight_candidate.py','asset_pipeline/__init__.py','asset_pipeline/edge_deformation.py']:
 files['tools/'+name]=(repo/'infrastructure/avatar-evolution'/name).read_bytes()
template=(repo/'infrastructure/avatar-evolution/build_candidate_contact_map.py').read_text()
start=template.index("supervisor='''")+len("supervisor='''");end=template.index("'''",start)
supervisor=template[start:end].replace('diagnose_collision_influences.py','diagnose_corrective_motion.py').replace("stage='contact-map'","stage='corrective-motion'").replace('contact-map.log','corrective-motion.log')
supervisor=supervisor.replace('73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105',installed['environment_sha256'])
supervisor=supervisor.replace("assert i['status']=='installed_unqualified'", "assert i['runtime_id']=="+repr(installed['runtime_id'])+" and i['status']=='installed_unqualified'")
files['supervisor.py']=supervisor.encode();rid=str(uuid.uuid4());out=a.output_dir/rid;out.mkdir(parents=True,exist_ok=False)
sha=lambda b:hashlib.sha256(b).hexdigest()
current=json.loads(files['current-report.json']);clips=json.loads(files['bend-export-report.json'])
for asset in clips['assets']:assert sha(files[asset['label']+'-stress.glb'])==asset['stress_sha256']
assert current['corrective_stress_artifact']['sha256']==sha(files['current-stress.glb'])
plan={'id':rid,'method':'retained-corrective-cycle-interpolation-v1','compute':'google','qualification_complete':False,'publication_eligible':False,
 'rig_attempt_id':proof['preparation_id'],'source_sha256':proof['source_sha256'],'raw_rig_sha256':proof['raw_rig_sha256'],
 'visual_review_id':visual['id'],'candidate_id':proof['candidates']['current']['id'],'candidate_sha256':proof['candidates']['current']['artifact_sha256'],
 'native_control_candidate_id':proof['candidates']['parent']['id'],'runtime_id':installed['runtime_id'],'environment_sha256':installed['environment_sha256'],
 'samples_per_cycle':13,'joint_cycles':4,'files':{n:sha(b) for n,b in files.items()}}
files['plan.json']=json.dumps(plan,indent=2).encode();buffer=io.BytesIO()
with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as z:
 for n,b in files.items():z.writestr(n,b)
data=buffer.getvalue();(out/'input.zip').write_bytes(data);(out/'plan.json').write_bytes(files['plan.json'])
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
