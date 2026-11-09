"""Independent Colab reimported contact, stretch, rest, weight and skeleton checks."""
import os,sys,json,hashlib
from pathlib import Path
import bpy
import numpy as np
from scipy.spatial import cKDTree
from review_generated_rig import load,surface
from review_combined_joint_candidate import reset_pose
from mesh_validation import rest_keys,collision_summary
from asset_pipeline.edge_deformation import edge_deformation
root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
r={'compute':'google','publication_eligible':False,'qualification_complete':False,'poses':[]}
try:
 report=json.loads((root/'repair-report.json').read_text());export=json.loads((root/'export-report.json').read_text())
 def bind(path):
  rigs,meshes=load(path);rig=rigs[0];obj=meshes[0]
  for o in bpy.data.objects:o.animation_data_clear()
  obj.data.shape_keys.animation_data_clear();reset_pose(rig)
  for k in obj.data.shape_keys.key_blocks:k.value=0
  points,faces,regions=surface(meshes);names=[b.name for b in rig.data.bones]
  weights=np.zeros((len(points),len(names)))
  for v in obj.data.vertices:
   for g in v.groups:weights[v.index,names.index(obj.vertex_groups[g.group].name)]=g.weight
  skeleton={b.name:{'parent':b.parent.name if b.parent else None,'head':np.array(rig.matrix_world@b.head_local)} for b in rig.data.bones}
  return np.array(points),weights,names,skeleton
 source,weights,names,bones=bind(root/'current-hip-animation.glb')
 points,after,anames,abones=bind(root/'contour-diagnostic.glb');dist,idx=cKDTree(source).query(points)
 gap=float(abs(after[:,[anames.index(n) for n in names]]-weights[idx]).max());skeleton_error=max(float(np.linalg.norm(bones[n]['head']-abones[n]['head'])) for n in names)
 r.update(rest_surface_error=float(dist.max()),skin_weight_max_error=gap,skeleton_head_error=skeleton_error,
  skeleton_hierarchy_equal=all(bones[n]['parent']==abones[n]['parent'] for n in names),bones=len(anames),max_influences=int(np.count_nonzero(after,axis=1).max()))
 rigs,meshes=load(root/'contour-diagnostic.glb');bpy.context.scene.frame_set(0);rest,faces,regions=surface(meshes);keys=rest_keys(rest)
 for sample in export['samples']:
  frame=sample['frame']*bpy.context.scene.render.fps/30;bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));p,f,regions=surface(meshes)
  contacts=collision_summary(p,f,keys,regions);stretch=edge_deformation(rest,p,f)
  r['poses'].append({'case':sample['case'],'collision':contacts,'edge_deformation':stretch})
  print(sample['case'],contacts['self_intersections'],stretch['severely_stretched_edges'],flush=True)
 r['preservation_pass']=dist.max()<report['body_height']*1e-5 and gap<2e-7 and skeleton_error<report['body_height']*1e-5 and r['skeleton_hierarchy_equal'] and len(anames)==52 and r['max_influences']==7
 r['status']='measured';r['sha256']=hashlib.sha256((root/'contour-diagnostic.glb').read_bytes()).hexdigest()
except Exception as e:r.update(status='failed',error=str(e));raise
finally:(root/'reimport-geometry-report.json').write_text(json.dumps(r,indent=2))
