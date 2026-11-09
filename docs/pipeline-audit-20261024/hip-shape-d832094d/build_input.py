"""Byte-only packaging of existing Colab inputs and the authored trial."""
import hashlib,json,uuid,zipfile
from pathlib import Path
root=Path(__file__).parent;prior=root.parent/'pose-contract-work/af0a65d4-25d0-4715-9ad1-8a35dfa743b5/input.zip'
with zipfile.ZipFile(prior) as z:files={n:z.read(n) for n in z.namelist() if not n.endswith('/')}
plan=json.loads(files.pop('plan.json'));rid=str(uuid.uuid4())
policy={'version':'left-hip-front-crease-handle-v1','joint':'ThighL','handle_offset_height':[0,-.065,0],'radii_height':[.065,.045,.085],
 'posed_direction':[0,-2**-.5,2**-.5],'amplitude_height':.025,'max_rest_delta_height':.04,'max_posed_delta_height':.03,'max_inverse_condition':10,
 'activation':'sin(angle)^2','authored_degrees':90,'check_degrees':[22.5,45,67.5,90],'scope':'Authored local sculpt hypothesis; no anatomical or production qualification.'}
files['tools/hip_shape_trial.py']=(root/'hip_shape_trial.py').read_bytes()
files['tools/render_joint_pose_contract.py']=(root.parent/'pose-contract-work/render_joint_pose_contract.py').read_bytes()
files['site/index.html']=files['site/index.html'].replace(b'/snapshots/legacy-UpperArmL-45.glb',b'/snapshots/baseline-ThighL-22.5.glb')
plan.update(id=rid,method='localized-hip-sculpt-pilot-v1',policy=policy,parent_pose_review_id='af0a65d4-25d0-4715-9ad1-8a35dfa743b5',
 parent_pose_report_sha256='cf8e49df8564921540f1a1a34eb1968b2e9b8a4018da503e0ae1df5161294c71',orbits=[1,3,5])
plan.pop('contract',None);plan['files']={n:hashlib.sha256(b).hexdigest() for n,b in files.items()}
plan['reproduces_geometry_review_id']='e2906020-ded5-44a2-9f30-a1bc5ac21d43'
plan['prior_render_unretrieved_id']='1edfc83c-96f8-4ca1-8203-2b81ff478664'
files['plan.json']=json.dumps(plan,indent=2).encode();out=root/rid;out.mkdir()
with zipfile.ZipFile(out/'input.zip','w',zipfile.ZIP_DEFLATED) as z:
 for n,b in files.items():z.writestr(n,b)
(root/'current-id.txt').write_text(rid);print(rid)
