"""Colab-only interpolation/cycle diagnosis of exact retained diagnostic GLBs."""
import hashlib,json,math,os,sys,time
from pathlib import Path
import bpy
import numpy as np
from review_generated_rig import load,surface
from mesh_validation import collision_summary,rest_keys
from asset_pipeline.edge_deformation import edge_deformation
from diagnose_skinning_modes import seam_groups,seam_spread
from candidate_animation import clear_imported_animation,bind_imported_clip
from glb_morph_animation import corrective_weight

ROLES=['UpperArmL','UpperArmR','ThighL','ThighR']
def skeleton(rig,names):
 inverse=rig.matrix_world.inverted()
 return np.array([np.array(rig.matrix_world@rig.pose.bones[n].matrix@rig.data.bones[n].matrix_local.inverted()@inverse) for n in names])

def main(root):
 if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Google Colab required')
 plan=json.loads((root/'plan.json').read_text())
 for name,sha in plan['files'].items():
  if hashlib.sha256((root/name).read_bytes()).hexdigest()!=sha:raise ValueError('Frozen input mismatch: '+name)
 output=root/'output';output.mkdir(exist_ok=False)
 report={'id':plan['id'],'method':plan['method'],'compute':'google','qualification_complete':False,'publication_eligible':False,
  'source_sha256':plan['source_sha256'],'rig_sha256':plan['raw_rig_sha256'],'parent_candidate_id':plan['candidate_id'],
  'candidate_sha256':plan['candidate_sha256'],'native_control_candidate_id':plan['native_control_candidate_id'],'assets':[],'status':'running'}
 def save(): (output/'report.json').write_text(json.dumps(report,indent=2))
 try:
  mapping=json.loads((root/'baseline-report.json').read_text())['bone_map'];controls={};names=None
  for label in ['parent','current']:
   expected=json.loads((root/(label+'-report.json')).read_text());expected_poses={(p['joint'],p['degrees']):p for p in expected.get('reloaded_poses',expected.get('poses',[]))}
   rigs,meshes=load(root/(label+'-stress.glb'))
   if len(rigs)!=1:raise ValueError('Exactly one skeleton required')
   rig=rigs[0];clear_imported_animation(rig,meshes);bpy.context.scene.frame_set(0)
   rest,faces,regions=surface(meshes);rest_array=np.array([list(p) for p in rest]);keys=rest_keys(rest);seams=seam_groups(rest)
   current_names=[b.name for b in rig.pose.bones]
   if names is None:names=current_names
   elif current_names!=names:raise ValueError('Control/corrective bone ordering differs')
   asset={'label':label,'stress_sha256':hashlib.sha256((root/(label+'-stress.glb')).read_bytes()).hexdigest(),'poses':[],'cycles':[]};report['assets'].append(asset)
   recipe=expected.get('corrective_recipe',{}).get('joints',[])
   for role in ROLES:
    action,_=bind_imported_clip(rig,meshes,'Stress_'+role,bool(recipe));first,last=action.frame_range;samples={}
    for tick in range(13):
     phase=tick/12;frame=first+(last-first)*phase;bpy.context.scene.frame_set(math.floor(first)-1);bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame))
     points,posed_faces,_=surface(meshes)
     if posed_faces!=faces:raise ValueError('Animated topology changed')
     posed=np.array([list(p) for p in points]);actual=skeleton(rig,names)
     angle=math.degrees(rig.pose.bones[mapping[role]].rotation_quaternion.normalized().angle)
     values={k.name:float(k.value) for obj in meshes if obj.data.shape_keys for k in obj.data.shape_keys.key_blocks if k.name!='Basis'}
     row={'joint':role,'tick':tick,'phase':phase,'actual_degrees':angle,'morph_weights':values,
      **collision_summary(points,faces,keys,regions),'edge_deformation':edge_deformation(rest,points,faces),
      'seam_spread_m':seam_spread(points,seams)}
     if label=='parent':controls[(role,tick)]=actual
     else:
      row['native_control_skeleton_error']=float(np.abs(actual-controls[(role,tick)]).max())
      expected_values={item['target']:corrective_weight(angle,item['midpoint_weight']) if item['joint']==role else 0. for item in recipe}
      row['morph_curve_max_error']=max(abs(values.get(n,-1)-v) for n,v in expected_values.items())
     if tick in (3,6,9):
      key=(role,90 if tick==6 else 45)
      row['canonical_expected']=expected_poses[key]['self_intersections']
     asset['poses'].append(row);samples[tick]=posed;report['stage']=label+'_'+role+'_'+str(tick);save()
     if label=='current' and (row['native_control_skeleton_error']>1e-6 or row['morph_curve_max_error']>1e-5):raise ValueError('Baked interpolation does not follow retained skeleton/recipe')
     if 'canonical_expected' in row and row['self_intersections']!=row['canonical_expected']:raise ValueError('Saved canonical pose not reproduced')
     if row['seam_spread_m']>1e-6 or row['edge_deformation']['severely_stretched_edges']:raise ValueError('Interpolation opens seams or severely stretches edges')
    cycle={'joint':role,'end_rest_max_m':float(np.linalg.norm(samples[12]-rest_array,axis=1).max()),
      'return_path_max_m':max(float(np.linalg.norm(samples[t]-samples[12-t],axis=1).max()) for t in range(7))}
    asset['cycles'].append(cycle)
    if cycle['end_rest_max_m']>1e-6 or cycle['return_path_max_m']>1e-6:raise ValueError('Diagnostic cycle failed rest/return preservation')
  baseline={(p['joint'],p['tick']):p for p in report['assets'][0]['poses']}
  report['regressions']=[{'joint':p['joint'],'phase':p['phase'],'delta':p['self_intersections']-baseline[(p['joint'],p['tick'])]['self_intersections']} for p in report['assets'][1]['poses'] if p['self_intersections']>baseline[(p['joint'],p['tick'])]['self_intersections']]
  report['status']='diagnostic_complete';report['scope']='104 sampled native/corrective poses across four retained single-axis diagnostic cycles. No compound axes, production game clips, anatomical shape or appearance qualification.'
 except Exception as error:report.update(status='failed',error=f'{type(error).__name__}: {error}');raise
 finally:report['completed_unix']=time.time();save()

if __name__=='__main__':main(Path(sys.argv[1]).resolve())
