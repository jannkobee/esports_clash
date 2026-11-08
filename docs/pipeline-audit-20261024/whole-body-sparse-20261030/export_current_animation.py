"""Colab-only diagnostic animation export on the original avatar skeleton."""
import os,sys,json,hashlib
from pathlib import Path
import bpy
import numpy as np
from scipy.spatial import cKDTree
from review_generated_rig import load,surface
from review_combined_joint_candidate import reset_pose
from joint_pose_contract import apply_pose
from hip_contour_field import blend
from glb_morph_animation import read_glb

root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
report=json.loads((root/'whole-body-report.json').read_text())
# The four-influence experiment failed; use the exact validated <=8 field instead.
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
if sha(root/'bounded-weights.npz')!='e42afed24f19eefef5e715f5378b10b805e4994523e6d63a4c931bd12eac7438':raise ValueError('Weight hash mismatch')
r={'compute':'google','publication_eligible':False,'qualification_complete':False,'scope':'Diagnostic left-hip animation; not game clip or full-body visual qualification.'}
try:
 rigs,meshes=load(root/'raw.glb');rig=rigs[0];obj=meshes[0];rig.animation_data_clear()
 weights=dict(np.load(root/'bounded-weights.npz'));sculpt=np.load(root/'approved/hip-sculpt.npz');names=list(weights['bone_names'])
 points=np.array(surface(meshes)[0]);height=float(np.ptp(points[:,2]));mapping=json.loads((root/'baseline-report.json').read_text())['bone_map']
 if not np.array_equal(points,sculpt['rest_positions']):raise ValueError('Body changed')
 if np.count_nonzero(weights['weights']>0,axis=1).max()>8:raise ValueError('Exceeds Babylon influence capacity')
 r['weight_sha256']=sha(root/'bounded-weights.npz');r['max_influences']=int(np.count_nonzero(weights['weights']>0,axis=1).max())
 obj.vertex_groups.clear()
 for j,name in enumerate(names):
  group=obj.vertex_groups.new(name=str(name))
  for i in np.flatnonzero(weights['weights'][:,j]>0):group.add([int(i)],float(weights['weights'][i,j]),'REPLACE')
 obj.shape_key_add(name='Basis');targets=[]
 for angle in (45,90):
  target=obj.shape_key_add(name='HipL_'+str(angle))
  for v,co in zip(target.data,points+sculpt['rest_delta_'+str(angle)]):v.co=co
  targets.append(target)
 scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=0;scene.frame_end=120
 expected={}
 for frame in range(121):
  scene.frame_set(frame);angle=90*np.sin(np.pi*frame/120)**2
  if frame in (0,120):reset_pose(rig);angle=0
  else:apply_pose(rig,mapping,'ThighL',float(angle),'world_target')
  for pb in rig.pose.bones:
   pb.rotation_mode='QUATERNION';pb.keyframe_insert('rotation_quaternion',frame=frame)
   pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('scale',frame=frame)
  for target,value in zip(targets,blend(float(angle))):target.value=value;target.keyframe_insert('value',frame=frame)
  if frame%15==0:bpy.context.view_layer.update();expected[frame]=np.array(surface(meshes)[0])
 scene.frame_set(0);bpy.ops.object.select_all(action='DESELECT')
 for o in [rig,obj]:o.select_set(True)
 bpy.context.view_layer.objects.active=rig
 out=root/'current-hip-animation.glb'
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,
  export_animation_mode='SCENE',export_frame_range=True,export_force_sampling=True,export_skins=True,export_morph=True,export_all_influences=True)
 doc,_=read_glb(out)
 paths={c['target']['path'] for a in doc.get('animations',[]) for c in a['channels']}
 if 'weights' not in paths or 'rotation' not in paths or len(doc.get('skins',[]))!=1:raise ValueError('Missing skin/morph animation')
 if len(doc['skins'][0]['joints'])!=52:raise ValueError('Skeleton changed')
 rigs,meshes=load(out);rows=[]
 for frame,want in expected.items():
  bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();actual=np.array(surface(meshes)[0])
  error=max(cKDTree(actual).query(want)[0].max(),cKDTree(want).query(actual)[0].max())
  rows.append({'frame':frame,'surface_error':float(error)})
 if max(x['surface_error'] for x in rows)>height*1e-5:raise ValueError('Animated roundtrip changed surface')
 r.update(status='ready_for_babylon_review',sha256=sha(out),roundtrip=rows,animations=[a.get('name') for a in doc['animations']],bones=52)
 np.savez_compressed(root/'animation-expected.npz',**{'frame_'+str(f):p for f,p in expected.items()})
except Exception as e:r.update(status='failed',error=str(e));raise
finally:(root/'animation-export-report.json').write_text(json.dumps(r,indent=2))
