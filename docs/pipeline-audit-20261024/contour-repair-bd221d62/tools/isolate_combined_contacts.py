"""Colab controls isolate correction activation and parent/child joint effects."""
import os,sys,json,hashlib
from pathlib import Path
import bpy
import numpy as np
from mathutils import Quaternion,Vector
from review_generated_rig import load,surface
from review_combined_joint_candidate import reset_pose,TARGETS
from joint_pose_contract import apply_pose,direction,rotate_world
from hip_contour_field import blend
from mesh_validation import collision_summary,rest_keys
root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
source=root/'current-hip-animation.glb'
if hashlib.sha256(source.read_bytes()).hexdigest()!='42ac17a5740ab76878ca88d49e4b03cbb2d5998e7483acce91160bc0dc6ee597':raise ValueError('Wrong avatar')
rigs,meshes=load(source);rig=rigs[0];obj=meshes[0]
for o in bpy.data.objects:o.animation_data_clear()
obj.data.shape_keys.animation_data_clear();reset_pose(rig)
for k in obj.data.shape_keys.key_blocks:k.value=0
points,faces,regions=surface(meshes);keys=rest_keys(points);mapping=json.loads((root/'baseline-report.json').read_text())['bone_map']
cases=[('ThighL',90,90,20,'world_target',strength) for strength in (0,.25,.5,.75,1)]
cases += [(role,angle,child,0,mode,0) for role in ('UpperArmL','UpperArmR') for angle in (60,90) for child in (0,60) for mode in ('world_target','coordinated')]
r={'compute':'google','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'publication_eligible':False,'qualification_complete':False,'controls':[],
   'scope':'Isolation controls only; changing correction activation is not an accepted replacement or adaptive runtime fix.'}
for role,angle,childbend,twist,mode,strength in cases:
 for k in obj.data.shape_keys.key_blocks:k.value=0
 proof=apply_pose(rig,mapping,role,angle,mode);name=mapping[role];child=mapping[TARGETS[role]]
 rotate_world(rig,name,direction(rig,name,child),twist)
 pb=rig.pose.bones[child];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion(Vector((1,0,0)),np.deg2rad(childbend))
 if role=='ThighL':
  for key,value in zip(('HipL_45','HipL_90'),blend(angle)):obj.data.shape_keys.key_blocks[key].value=value*strength
 moved,posedfaces,_=surface(meshes);contacts=collision_summary(moved,posedfaces,keys,regions)
 row={'role':role,'angle':angle,'child_local_x':childbend,'twist':twist,'mode':mode,'corrective_strength':strength,'collision':contacts,'pose_proof':proof}
 r['controls'].append(row);print(role,angle,childbend,mode,strength,contacts['self_intersections'],flush=True)
 (root/'combined-control-report.json').write_text(json.dumps(r,indent=2))
r['status']='controls_complete';(root/'combined-control-report.json').write_text(json.dumps(r,indent=2))
