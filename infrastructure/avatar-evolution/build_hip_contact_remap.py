"""Freeze canonical hip and native target inputs for a Colab-only remap."""
import argparse,hashlib,io,json,pathlib,uuid,zipfile
repo=pathlib.Path(__file__).resolve().parents[2];p=argparse.ArgumentParser()
for name in ['source-dir','corrected-dir','hybrid-dir','hip-dir','hip-proof-dir','installation','environment','output-dir']:p.add_argument('--'+name,type=pathlib.Path,required=True)
a=p.parse_args();sha=lambda b:hashlib.sha256(b).hexdigest()
proof=json.loads((a.source_dir/'backoffice-proof.json').read_text());native=proof['candidates']['current'];hip_proof=json.loads((a.hip_proof_dir/'proof.json').read_text())
files={'native.glb':(a.source_dir/'current.glb').read_bytes(),'corrected.glb':(a.corrected_dir/'current.glb').read_bytes(),
 'hybrid-targets.npz':(a.hybrid_dir/'output/corrective-targets.npz').read_bytes(),'hybrid-report.json':(a.hybrid_dir/'output/report.json').read_bytes(),
 'hip-target.npz':(a.hip_proof_dir/'hip-contact-target.npz').read_bytes(),'hip-report.json':(a.hip_dir/'output/report.json').read_bytes(),
 'hip-proof.json':(a.hip_proof_dir/'proof.json').read_bytes(),'installation.json':a.installation.read_bytes(),'environment.txt':a.environment.read_bytes()}
hybrid=json.loads(files['hybrid-report.json']);hip=json.loads(files['hip-report.json']);installed=json.loads(files['installation.json'])
if (sha(files['native.glb'])!=native['artifact_sha256'] or sha(files['corrected.glb'])!=hip_proof['source_candidate_sha256']
 or hip_proof['report_sha256']!=sha(files['hip-report.json']) or hip_proof['target_sha256']!=sha(files['hip-target.npz'])
 or hybrid['rig_sha256']!=native['artifact_sha256'] or hybrid['target_surface_artifact']['sha256']!=sha(files['hybrid-targets.npz'])
 or installed.get('status')!='installed_unqualified' or installed.get('compute')!='google' or installed.get('environment_sha256')!=sha(files['environment.txt'])):raise ValueError('Canonical source, target or environment mismatch')
for name in ['derive_hip_contact_bake_target.py','review_generated_rig.py','review_collision_weight_candidate.py','review_shoulder_socket_study.py','inspect_shoulder_sockets.py','gltf_joint_pivots.py','review_tapered_weight_candidate.py','mesh_validation.py','bone_mapping.py','asset_pipeline/__init__.py','asset_pipeline/edge_deformation.py']:
 files['tools/'+name]=(repo/'infrastructure/avatar-evolution'/name).read_bytes()
t=(repo/'infrastructure/avatar-evolution/build_candidate_contact_map.py').read_text();start=t.index("supervisor='''")+len("supervisor='''");end=t.index("'''",start)
supervisor=t[start:end].replace('diagnose_collision_influences.py','derive_hip_contact_bake_target.py').replace("stage='contact-map'","stage='hip-target-remap'").replace('contact-map.log','hip-target-remap.log').replace('73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105',installed['environment_sha256'])
supervisor=supervisor.replace("assert i['status']=='installed_unqualified'", "assert i['runtime_id']=="+repr(installed['runtime_id'])+" and i['status']=='installed_unqualified'");files['supervisor.py']=supervisor.encode()
rid=str(uuid.uuid4());out=a.output_dir/rid;out.mkdir(parents=True,exist_ok=False)
plan={'id':rid,'method':'corrective-hip-contact-remapped-target-v1','compute':'google','qualification_complete':False,'publication_eligible':False,'rig_attempt_id':proof['preparation_id'],
 'source_sha256':proof['source_sha256'],'parent_candidate_id':native['id'],'parent_candidate_sha256':native['artifact_sha256'],'hip_probe_id':hip['id'],'hybrid_probe_id':hybrid['id'],
 'runtime_id':installed['runtime_id'],'environment_sha256':installed['environment_sha256'],'files':{n:sha(b) for n,b in files.items()}}
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
