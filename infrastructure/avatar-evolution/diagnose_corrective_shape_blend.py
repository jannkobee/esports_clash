"""Colab-only targeted half-strength shoulder surface hypothesis, with fixed hips."""
import hashlib,json,math,os,sys,time
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix,Quaternion,Vector
from review_generated_rig import load,surface
from mesh_validation import collision_summary,rest_keys
from diagnose_skinning_modes import seam_groups,seam_spread
from asset_pipeline.edge_deformation import edge_deformation

TARGETS={'UpperArmL':'ForearmL','UpperArmR':'ForearmR','ForearmL':'HandL','ForearmR':'HandR',
 'ThighL':'CalfL','ThighR':'CalfR','CalfL':'FootL','CalfR':'FootR'}
SHAPED=['UpperArmL','UpperArmR','ThighL','ThighR']
def main(root):
 if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Google Colab required')
 plan=json.loads((root/'plan.json').read_text())
 for name,h in plan['files'].items():
  if hashlib.sha256((root/name).read_bytes()).hexdigest()!=h:raise ValueError('Frozen input mismatch: '+name)
 output=root/'output';output.mkdir(exist_ok=False)
 report={'id':plan['id'],'method':plan['method'],'compute':'google','qualification_complete':False,'publication_eligible':False,
  'source_sha256':plan['source_sha256'],'rig_sha256':plan['parent_candidate_sha256'],'parent_candidate_id':plan['parent_candidate_id'],
  'target_probe_id':plan['target_probe_id'],'blend_policy':plan['blend_policy'],'variants':[],'status':'running'}
 def save(): (output/'report.json').write_text(json.dumps(report,indent=2))
 try:
  source=json.loads((root/'candidate-report.json').read_text());probe=json.loads((root/'target-report.json').read_text());mapping=json.loads((root/'baseline-report.json').read_text())['bone_map']
  expected={(p['joint'],p['degrees']):p['self_intersections'] for p in source.get('reloaded_poses',source.get('poses'))}
  hybrid={(p['joint'],p['degrees']):p['self_intersections'] for p in probe['variants'][1]['poses']}
  targets=np.load(root/'corrective-targets.npz');rigs,meshes=load(root/'candidate.glb');rig=rigs[0]
  for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
  bpy.context.scene.frame_set(0);rest,faces,regions=surface(meshes);keys=rest_keys(rest);groups=seam_groups(rest);results={}
  native={'name':'native_baseline','poses':[]};report['variants'].append(native)
  for role,child in TARGETS.items():
   bone=rig.pose.bones[mapping[role]];start=rig.matrix_world@bone.bone.head_local;end=rig.matrix_world@rig.data.bones[mapping[child]].head_local
   axis=(bone.bone.matrix_local.to_3x3().inverted()@rig.matrix_world.to_3x3().inverted()@(end-start).normalized().cross(Vector((0,1 if role.startswith('Calf') else -1,0))).normalized()).normalized()
   for degrees in (45,90):
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion(axis,math.radians(degrees));bpy.context.scene.frame_set(0)
    points,current_faces,_=surface(meshes)
    if current_faces!=faces:raise ValueError('Native topology changed')
    row={'joint':role,'degrees':degrees,**collision_summary(points,faces,keys,regions)}
    native['poses'].append(row);results[(role,degrees)]=np.array([list(p) for p in points]);report['stage']='native_'+role+'_'+str(degrees);save()
    if row['self_intersections']!=expected[(role,degrees)]:raise ValueError('Original native baseline not reproduced')
  blend={'name':'half_shoulder_full_hip','poses':[]};full={'name':'original_hybrid_targets','poses':[]};report['variants'] += [full,blend];new_targets={}
  for role in SHAPED:
   for degrees in (45,90):
    native_arr=results[(role,degrees)];target=targets[role+'_'+str(degrees)]
    if native_arr.shape!=target.shape or not np.isfinite(target).all():raise ValueError('Frozen target topology or coordinates changed')
    alpha=.5 if role.startswith('UpperArm') else 1.;mixed=native_arr+(target-native_arr)*alpha
    for variant,array in [(full,target),(blend,mixed)]:
     points=[Vector(v) for v in array];collision=collision_summary(points,faces,keys,regions)
     row={'joint':role,'degrees':degrees,**collision,'parent_intersections':expected[(role,degrees)],
      'delta_vs_parent':collision['self_intersections']-expected[(role,degrees)],
      'max_delta_from_native_m':float(np.linalg.norm(array-native_arr,axis=1).max()),
      'edge_deformation':edge_deformation(rest,points,faces),'seam_spread_m':seam_spread(points,groups)}
     variant['poses'].append(row);report['stage']=variant['name']+'_'+role+'_'+str(degrees);save()
     if variant is full and row['self_intersections']!=hybrid[(role,degrees)]:raise ValueError('Hybrid target baseline not reproduced')
     if row['seam_spread_m']>1e-6 or row['edge_deformation']['severely_stretched_edges'] or row['max_delta_from_native_m']>.02:raise ValueError('Target exceeded frozen seam/stretch/displacement limits')
    new_targets[role+'_'+str(degrees)]=mixed
  output_file=output/'corrective-targets.npz';np.savez_compressed(output_file,**new_targets)
  report['target_surface_artifact']={'sha256':hashlib.sha256(output_file.read_bytes()).hexdigest(),'bytes':output_file.stat().st_size,
   'keys':sorted(new_targets),'source_sha256':plan['parent_candidate_sha256'],'vertex_count':len(rest),'space':'Blender world; frozen import with merge_vertices=True'}
  report['regressions']=[{'joint':p['joint'],'degrees':p['degrees'],'delta':p['delta_vs_parent']} for p in blend['poses'] if p['delta_vs_parent']>0]
  report['status']='diagnostic_complete';report['scope']='Isolated half-strength shoulder target hypothesis from the exact native and prior hybrid surfaces; hips retain full prior correction. Not a portable model, visual shape pass or qualification.'
 except Exception as error:report.update(status='failed',error=f'{type(error).__name__}: {error}');raise
 finally:report['completed_unix']=time.time();save()

if __name__=='__main__':main(Path(sys.argv[1]).resolve())
