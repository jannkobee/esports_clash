"""Colab diagnostic: exact exported avatar under combined joint controls."""
import os,sys,json,hashlib,time
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix,Quaternion,Vector
from review_generated_rig import load,surface
from review_combined_joint_candidate import reset_pose,TARGETS
from joint_pose_contract import apply_pose,direction,rotate_world
from hip_contour_field import blend
from mesh_validation import collision_summary,rest_keys
root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Colab required')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=root/'current-hip-animation.glb'
if sha(source)!='42ac17a5740ab76878ca88d49e4b03cbb2d5998e7483acce91160bc0dc6ee597':raise ValueError('Wrong exported avatar')
r={'method':'exported-combined-motion-v1','compute':'google','source_sha256':sha(source),'publication_eligible':False,'qualification_complete':False,'poses':[],
   'scope':'Combined diagnostic controls on the exported avatar. Not gameplay clips, anatomical motion limits or continuous collision proof.'}
try:
 rigs,meshes=load(source);rig=rigs[0];obj=meshes[0]
 for o in bpy.data.objects:o.animation_data_clear()
 obj.data.shape_keys.animation_data_clear();reset_pose(rig)
 for k in obj.data.shape_keys.key_blocks:k.value=0
 points,faces,regions=surface(meshes);points=np.array(points);keys=rest_keys([Vector(p) for p in points]);height=float(np.ptp(points[:,2]))
 mapping=json.loads((root/'baseline-report.json').read_text())['bone_map'];edges=np.array([e.vertices[:] for e in obj.data.edges]);restlen=np.linalg.norm(points[edges[:,0]]-points[edges[:,1]],axis=1)
 valid=restlen>height*1e-6
 r.update(vertices=len(points),bones=len(rig.data.bones),body_height=height,max_influences=max(len(v.groups) for v in obj.data.vertices))
 cases=[('ThighL',60,60,t) for t in (-20,0,20)]+[('ThighL',90,90,t) for t in (-20,0,20)]
 cases += [('ThighR',60,60,t) for t in (-20,0,20)]
 cases += [(role,60,60,t) for role in ('UpperArmL','UpperArmR') for t in (-20,0,20)]
 cases += [(role,90,90,0) for role in ('UpperArmL','UpperArmR')]
 output=root/'site/combined';output.mkdir(parents=True,exist_ok=True)
 for index,(role,bend,child_bend,twist) in enumerate(cases):
  for k in obj.data.shape_keys.key_blocks:k.value=0
  proof=apply_pose(rig,mapping,role,bend,'world_target')
  name=mapping[role];child=mapping[TARGETS[role]]
  rotate_world(rig,name,direction(rig,name,child),twist)
  # Explicit local-X child control. It follows the parent orientation; this is
  # a reproducible stress control, not a claim of anatomical flexion axes.
  pb=rig.pose.bones[child];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=pb.rotation_quaternion@Quaternion(Vector((1,0,0)),np.deg2rad(child_bend))
  if role=='ThighL':
   for key,value in zip(('HipL_45','HipL_90'),blend(bend)):obj.data.shape_keys.key_blocks[key].value=value
  moved,posedfaces,_=surface(meshes);moved=np.array(moved)
  if not np.isfinite(moved).all():raise ValueError('Nonfinite posed geometry')
  contacts=collision_summary([Vector(p) for p in moved],posedfaces,keys,regions)
  ratio=np.linalg.norm(moved[edges[:,0]]-moved[edges[:,1]],axis=1)[valid]/restlen[valid]
  label=f'{index:02d}-{role}-{bend}-child{child_bend}-twist{twist}'
  center=rig.matrix_world@rig.pose.bones[name].head
  # Snapshot evaluated geometry, retaining materials and UVs, with no live rig.
  graph=bpy.context.evaluated_depsgraph_get();mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(graph),depsgraph=graph)
  snapshot=bpy.data.objects.new(label,mesh);bpy.context.collection.objects.link(snapshot);snapshot.matrix_world=obj.matrix_world.copy()
  bpy.ops.object.select_all(action='DESELECT');snapshot.select_set(True);bpy.context.view_layer.objects.active=snapshot
  path=output/(label+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_skins=False,export_morph=False)
  bpy.data.objects.remove(snapshot,do_unlink=True);bpy.data.meshes.remove(mesh)
  row={'case':label,'role':role,'bend':bend,'child_local_x_degrees':child_bend,'twist':twist,'pose_proof':proof,'collision':contacts,
       'edge_ratio_min':float(ratio.min()),'edge_ratio_max':float(ratio.max()),'edge_ratio_p99':float(np.quantile(ratio,.99)),
       'snapshot':'combined/'+label+'.glb','sha256':sha(path),'camera_target_gltf':[center.x,center.z,-center.y]}
  r['poses'].append(row);print(label,'contacts',contacts['self_intersections'],'edge_p99',row['edge_ratio_p99'],flush=True)
  (root/'combined-motion-progress.json').write_text(json.dumps({'completed':len(r['poses']),'total':len(cases)}))
 r['status']='requires_visual_review';r['sampled_contact_pass']=all(p['collision']['self_intersections']==0 for p in r['poses'])
except Exception as e:r.update(status='failed',error=str(e));raise
finally:(root/'combined-motion-report.json').write_text(json.dumps(r,indent=2))
