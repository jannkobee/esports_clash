"""Colab-only independent joint validation and full-rig sparse fitting."""
import os,sys,json,hashlib,time
from pathlib import Path
import bpy
import numpy as np
from mathutils import Quaternion,Vector
from review_generated_rig import load,surface
from review_combined_joint_candidate import reset_pose
from sparse_pose_fit import fit_four
from joint_pose_contract import apply_pose
from hip_contour_field import blend
from mesh_validation import collision_summary,rest_keys

root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Colab required')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
r={'method':'whole-rig-sparse-fit-v1','compute':'google','publication_eligible':False,'qualification_complete':False,'started_unix':time.time()}
try:
 for n,h in json.loads((root/'export-manifest.json').read_text()).items():
  if sha(root/n)!=h:raise ValueError('Frozen input changed: '+n)
 if sha(root/'current-four-weights.npz')!='713a8fb6144c9b0b0c3e9dfd7614bfa837e005c4e60367baf7988efedb2ea880':raise ValueError('Wrong prior candidate')
 rigs,meshes=load(root/'raw.glb');rig=rigs[0];rig.animation_data_clear();points,faces,regions=surface(meshes);points=np.array(points)
 data=np.load(root/'bounded-weights.npz');dense=data['weights'];old=np.load(root/'current-four-weights.npz')['weights'];sculpt=np.load(root/'approved/hip-sculpt.npz')
 names=[b.name for b in rig.data.bones];height=float(np.ptp(points[:,2]));inv=rig.matrix_world.inverted();mapping=json.loads((root/'baseline-report.json').read_text())['bone_map']
 if list(data['bone_names'])!=names or not np.array_equal(points,sculpt['rest_positions']):raise ValueError('Body/rig mismatch')
 ids=np.flatnonzero(np.count_nonzero(dense>0,axis=1)>4);pool=np.argsort(-dense[ids],axis=1)[:,:12]
 axes=np.eye(3);keys=rest_keys([Vector(p) for p in points])
 def feature(case):
  reset_pose(rig);q=points
  if case[0]=='hip':
   angle=case[1];apply_pose(rig,mapping,'ThighL',angle,'world_target');a,b=blend(angle);q=points+a*sculpt['rest_delta_45']+b*sculpt['rest_delta_90']
  else:
   for j,axis,angle in case:
    pb=rig.pose.bones[names[j]];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion(Vector(axes[axis]),np.deg2rad(angle))
  bpy.context.view_layer.update()
  matrices=np.array([rig.matrix_world@rig.pose.bones[n].matrix@rig.data.bones[n].matrix_local.inverted()@inv for n in names])[:,:3,:]
  return np.einsum('bxy,ny->nbx',matrices,np.c_[q,np.ones(len(q))])
 def errors(f,w):
  target=np.einsum('nbx,nb->nx',f,dense);actual=np.einsum('nbx,nb->nx',f,w);e=np.linalg.norm(actual-target,axis=1)
  return {'max_error':float(e.max()),'rms_error':float(np.sqrt(np.mean(e**2))),'max_relative_error':float((e/np.maximum(np.linalg.norm(target-points,axis=1),height*.01)).max())}
 training=[[(j,a,30)] for j in range(len(names)) for a in range(3)]+[['hip',a] for a in (30,60,90)]
 held=[[(j,a,-17)] for j in range(len(names)) for a in range(3)]+[['hip',a] for a in (22.5,45,67.5,78.75)]
 # Independent parent/child combinations expose compensating weights.
 held += [[(j,0,23),(j+1,2,-19)] for j in range(0,len(names)-1,2)]
 oldchecks=[]
 for role in ['UpperArmL','UpperArmR','ForearmL','ForearmR','ThighR','CalfL','CalfR']:
  f=feature([(names.index(mapping[role]),0,45)]);oldchecks.append({'role':role,**errors(f,old)})
 r['previous_hip_only_checks']=oldchecks;print('old_checks',json.dumps(oldchecks),flush=True)
 limited=[];targets=[]
 for case in training:
  f=(feature(case)[ids]-points[ids,None,:]).transpose(0,2,1)
  targets.append(np.einsum('ndb,nb->nd',f,dense[ids]));limited.append(np.take_along_axis(f,pool[:,None,:],axis=2))
 limited=np.concatenate(limited,axis=1);targets=np.concatenate(targets,axis=1);prior=np.take_along_axis(dense[ids],pool,axis=1)
 fitted=dense.copy();fitted[ids]=0
 for start in range(0,len(ids),128):
  stop=min(start+128,len(ids));w=fit_four(limited[start:stop],targets[start:stop],prior[start:stop],height)
  fitted[ids[start:stop,None],pool[start:stop]]=w;print('fit',stop,len(ids),flush=True)
 del limited,targets
 checks=[]
 for i,case in enumerate(held):
  checks.append({'case':case,**errors(feature(case),fitted)})
  if i%30==0:print('heldout',i,len(held),flush=True)
 r.update(heldout=checks,training=training,body_height=height,bones=len(names),vertices=len(points),max_influences=int(np.count_nonzero(fitted>0,axis=1).max()),checks_scope='All52 bones, three local axes; diagnostic rotations, not anatomical motion or game clip qualification.')
 r['limits']={'max_error_height':.002,'rms_error_height':.0005,'max_relative_error':.05}
 passed=all(c['max_error']<=height*.002 and c['rms_error']<=height*.0005 and c['max_relative_error']<=.05 for c in checks)
 r['hip_contacts']=[]
 for angle in (11.25,22.5,33.75,45,56.25,67.5,78.75,90):
  f=feature(['hip',angle]);q=np.einsum('nbx,nb->nx',f,fitted)
  contacts=collision_summary([Vector(p) for p in q],faces,keys,regions)['self_intersections'];r['hip_contacts'].append({'degrees':angle,'intersections':contacts});print('contacts',angle,contacts,flush=True)
  passed=passed and contacts==0
 out=root/'whole-body-four-weights.npz';np.savez_compressed(out,weights=fitted,bone_names=names,body_positions=points)
 r.update(status='ready_for_export_review' if passed else 'blocked_representation_error',artifact_sha256=sha(out),input_manifest_sha256=sha(root/'export-manifest.json'))
except Exception as e:
 r.update(status='failed',error=str(e));raise
finally:
 r['completed_unix']=time.time();(root/'whole-body-report.json').write_text(json.dumps(r,indent=2))
