"""Colab diagnostic bake of retained contour trial; always preserve all weights."""
import os,sys,json,hashlib,subprocess
from pathlib import Path
import bpy
import numpy as np
from scipy.spatial import cKDTree
from mathutils import Quaternion,Vector
from review_generated_rig import surface,load
from review_combined_joint_candidate import reset_pose,TARGETS
from joint_pose_contract import apply_pose,direction,rotate_world
from hip_contour_field import blend
from glb_morph_animation import read_glb,write_glb
from mesh_validation import collision_summary,rest_keys
from evaluated_points import world_points
root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Colab required')
report=json.loads((root/'repair-report.json').read_text());r={'compute':'google','publication_eligible':False,'qualification_complete':False,'roundtrip':[]}
if report['status']!='requires_visual_review':raise ValueError('Incomplete contour trial')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
try:
 bpy.ops.wm.open_mainfile(filepath=str(root/'contour-candidate.blend'))
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');obj=next(o for o in bpy.context.scene.objects if o.type=='MESH')
 mapping=json.loads((root/'baseline-report.json').read_text())['bone_map'];scene=bpy.context.scene
 if not np.array_equal(world_points([obj]),np.array(surface([obj])[0])):raise ValueError('Point-only evaluator differs from full surface evaluator')
 r['point_evaluator_matches_surface']=True
 scene.render.fps=30;scene.frame_start=0;scene.frame_end=len(report['poses'])*12
 targets=list(obj.data.shape_keys.key_blocks)[1:];expected={};samples=[]
 for i,row in enumerate(report['poses']):
  role=row['role'];angle=row['bend'];child=row['child'];twist=row['twist'];reset_pose(rig)
  for k in targets:k.value=0
  if role!='Rest':
   apply_pose(rig,mapping,role,angle,'world_target');name=mapping[role];ch=mapping[TARGETS[role]]
   rotate_world(rig,name,direction(rig,name,ch),twist)
   rig.pose.bones[ch].rotation_mode='QUATERNION';rig.pose.bones[ch].rotation_quaternion=Quaternion(Vector((1,0,0)),np.deg2rad(child))
   if role=='ThighL':
    for k,v in zip(('HipL_45','HipL_90'),blend(angle)):obj.data.shape_keys.key_blocks[k].value=v
    obj.data.shape_keys.key_blocks['HipL_Twist20'].value=float(blend(angle)[1]*np.clip(twist/20,0,1))
   if role.startswith('UpperArm'):
    t=np.clip(angle/60,0,1);a=t*t*(3-2*t);t=np.clip((angle-60)/30,0,1);b=t*t*(3-2*t)
    obj.data.shape_keys.key_blocks[role+'_60'].value=float(a*(1-b));obj.data.shape_keys.key_blocks[role+'_90'].value=float(b)
    if report['policy'].get('right_twist_target') and role=='UpperArmR':obj.data.shape_keys.key_blocks['UpperArmR_TwistMinus20'].value=float(a*(1-b)*np.clip(-twist/20,0,1))
  qs={pb.name:pb.rotation_quaternion.copy() for pb in rig.pose.bones};values={k.name:k.value for k in targets}
  for j in range(13):
   frame=i*12+j;factor=(j if j<=6 else 12-j)/6
   # Explicit diagnostic interpolation from bind pose to authored pose and back.
   for pb in rig.pose.bones:
    pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion().slerp(qs[pb.name],factor)
    pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('scale',frame=frame)
   for k in targets:k.value=values[k.name]*factor;k.keyframe_insert('value',frame=frame)
   if j in (0,3,6,9,12):
    bpy.context.view_layer.update();expected[frame]=world_points([obj])
   if j==6:samples.append({'case':row['case'],'frame':frame,'phase':frame/scene.frame_end,'morphs':dict(values),'camera_target_gltf':row['camera_target_gltf']})
 scene.frame_set(0);bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);obj.select_set(True);bpy.context.view_layer.objects.active=rig
 path=Path('/content/teamfight-preparation/venv/lib/python3.11/site-packages/bpy/4.5/scripts/addons_core/io_scene_gltf2/blender/exp/primitive_extract.py')
 original=path.read_bytes()
 if sha(path)!='884ba7f2691f1c69874c148a3058791b0621740dc5c7123799f6785fc3c87fa7':raise ValueError('Exporter changed')
 out=root/'contour-diagnostic.glb'
 try:
  path.write_bytes(original.replace(b'min_influence = 0.0001',b'min_influence = 0.0'))
  bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,
    export_animation_mode='SCENE',export_frame_range=True,export_force_sampling=True,export_skins=True,export_morph=True,export_all_influences=True)
 finally:
  path.write_bytes(original);r['exporter_dependency_restored']=path.read_bytes()==original
 doc,binary=read_glb(out);merged={'name':'Mirelle_ContourTrial','samplers':[],'channels':[]};seen=set()
 for anim in doc.get('animations',[]):
  offset=len(merged['samplers']);merged['samplers'].extend(anim['samplers'])
  for c in anim['channels']:
   key=(c['target']['node'],c['target']['path'])
   if key in seen:raise ValueError('Duplicate animation target')
   seen.add(key);merged['channels'].append({**c,'sampler':c['sampler']+offset})
 doc['animations']=[merged];write_glb(out,doc,binary)
 if len(doc['skins'][0]['joints'])!=52:raise ValueError('Skeleton changed')
 rigs,meshes=load(out)
 if any(len(p.vertices)!=3 for obj in meshes for p in obj.data.polygons) or any(m.type!='ARMATURE' for obj in meshes for m in obj.modifiers):raise ValueError('Cached face topology requires triangle skin/morph meshes only')
 bpy.context.scene.frame_set(0);rest,faces,regions=surface(meshes);keys=rest_keys(rest);r['reimported_contacts']=[]
 peaks={i*12+6:p for i,p in enumerate(report['poses'])}
 for frame,want in expected.items():
  sample=frame*bpy.context.scene.render.fps/30;bpy.context.scene.frame_set(int(sample),subframe=sample-int(sample));actual=world_points(meshes)
  error=float(max(cKDTree(actual).query(want)[0].max(),cKDTree(want).query(actual)[0].max()));r['roundtrip'].append({'frame':frame,'surface_error':error})
  if frame in peaks:
   collision=collision_summary([Vector(p) for p in actual],faces,keys,regions)
   r['reimported_contacts'].append({'case':peaks[frame]['case'],'collision':collision,'authored_contacts':peaks[frame]['candidate']['collision']['self_intersections']})
 if max(x['surface_error'] for x in r['roundtrip'])>report['body_height']*1e-5:raise ValueError('Export changed surface')
 r.update(status='ready_for_babylon_review',sha256=sha(out),samples=samples,bones=52,clip='Mirelle_ContourTrial',morph_targets=len(targets),
   scope='Sampled diagnostic surface preservation only; no anatomy/game motion/device qualification.')
except Exception as e:r.update(status='failed',error=str(e));raise
finally:(root/'export-report.json').write_text(json.dumps(r,indent=2))
