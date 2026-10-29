"""Colab-only, bounded rest-sign-guided shoulder contact separation hypothesis.

This evaluates a posed surface only. It never writes a production mesh or
declares an anatomical pass; every frozen baseline and failure is retained.
"""
from collections import defaultdict
import hashlib,json,math,os,sys,time
from pathlib import Path
import bpy
from mathutils import Vector
from review_generated_rig import load,surface
from mesh_validation import collision_summary,rest_keys
from candidate_animation import clear_imported_animation,bind_imported_clip
from diagnose_collision_influences import all_vertex_weights,collision_pairs
from diagnose_skinning_modes import seam_groups,seam_spread
from contact_patch_mask import mesh_ring_falloff
from review_shoulder_contact_candidate import verify_source
from asset_pipeline.edge_deformation import edge_deformation

ROLES=['UpperArmL','UpperArmR','ForearmL','ForearmR','ThighL','ThighR','CalfL','CalfR']
def center(points,face):return sum((points[i] for i in face),Vector())/3
def normal(points,face):
 a,b,c=(points[i] for i in face);n=(b-a).cross(c-a)
 return n.normalized() if n.length>1e-12 else None

def main(root):
 if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Google Colab required')
 plan=json.loads((root/'plan.json').read_text());out=root/'output';out.mkdir(exist_ok=False)
 report={'id':plan['id'],'method':plan['method'],'compute':'google','source_sha256':plan['source_sha256'],
  'rig_sha256':plan['parent_candidate_sha256'],'parent_candidate_id':plan['parent_candidate_id'],'contact_map_id':plan['contact_map_id'],
  'qualification_complete':False,'publication_eligible':False,'config':plan['config'],'baseline_reproduction':[],'status':'running'}
 def save(): (out/'report.json').write_text(json.dumps(report,indent=2))
 try:
  for n,h in plan['files'].items():
   if hashlib.sha256((root/n).read_bytes()).hexdigest()!=h:raise ValueError('Frozen input mismatch: '+n)
  contact=json.loads((root/'contact-map.json').read_text());baseline=json.loads((root/'baseline-report.json').read_text())
  if contact['id']!=plan['contact_map_id'] or contact['rig_sha256']!=plan['parent_candidate_sha256']:raise ValueError('Contact lineage mismatch')
  arap=plan['method']=='contact-bound-local-arap-v1'
  centroid=plan['method']=='contact-pair-centroid-probe-v1'
  hip_dihedral=plan['method']=='contact-aware-hip-dihedral-v1'
  hip_arap=plan['method'] in ('contact-bound-hip-fold-arap-v1','contact-aware-hip-fold-v1') or hip_dihedral
  hip_contact_aware=plan['method']=='contact-aware-hip-fold-v1'
  valid_arap={'joint':'UpperArmL','region_pair':['bone_2','bone_26'],'max_added_height_fraction':0.001,'falloff_rings':3,'anchor_strength':2.0}
  valid_normal={'joint':'UpperArmL','region_pair':['bone_2','bone_26'],'max_added_height_fraction':0.003,'falloff_rings':3,'minimum_rest_side_height_fraction':0.00001}
  valid_centroid={'joint':'UpperArmL','region_pair':['bone_2','bone_26'],'max_added_height_fraction':0.001,'falloff_rings':3,'minimum_centroid_height_fraction':0.00001}
  valid_hip={'joints':['ThighL','ThighR'],'max_added_height_fraction':0.001,'falloff_rings':3,'anchor_strength':2.0,'fold_edges_per_joint':12}
  valid_dihedral={'joints':['ThighL','ThighR'],'max_added_height_fraction':0.001,'falloff_rings':3,'anchor_strength':0.01,'fold_edges_per_joint':12,'iterations':32}
  if plan['config']!=(valid_arap if arap else valid_centroid if centroid else valid_dihedral if hip_dihedral else valid_hip if hip_arap else valid_normal):
   raise ValueError('Unknown frozen separation hypothesis')
  rigs,meshes=load(root/'candidate.glb');clear_imported_animation(rigs[0],meshes);bpy.context.scene.frame_set(0)
  primary_rest,primary_faces,_=surface(meshes);primary_weights=all_vertex_weights(meshes)
  verify_source(meshes,primary_rest,contact)
  for label in ['native','corrected']:
   expected=json.loads((root/(label+'-report.json')).read_text());expected={(p['joint'],p['degrees']):p for p in expected.get('reloaded_poses',expected.get('poses',[]))}
   rigs,meshes=load(root/(label+'-stress.glb'));rig=rigs[0];clear_imported_animation(rig,meshes);bpy.context.scene.frame_set(0)
   rest,faces,regions=surface(meshes);keys=rest_keys(rest);entry={'label':label,'poses':[]};report['baseline_reproduction'].append(entry)
   if label=='corrected':
    clip_weights=all_vertex_weights(meshes)
    if (faces!=primary_faces or len(rest)!=len(primary_rest) or len(clip_weights)!=len(primary_weights)
        or max((a-b).length for a,b in zip(rest,primary_rest))>1e-6
        or any(set(a)!=set(b) or any(abs(a[k]-b[k])>1e-6 for k in a) for a,b in zip(primary_weights,clip_weights))):
     raise ValueError('Corrected clip topology, rest positions or weights differ from signed primary candidate')
   for role in ROLES:
    action,_=bind_imported_clip(rig,meshes,'Stress_'+role,label=='corrected');first,last=action.frame_range
    for phase,degrees in ((.25,45),(.5,90)):
     frame=first+(last-first)*phase;bpy.context.scene.frame_set(math.floor(first)-1);bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame))
     points,posed_faces,_=surface(meshes)
     if posed_faces!=faces:raise ValueError('Clip topology differs')
     count=collision_summary(points,faces,keys,regions)['self_intersections'];row={'joint':role,'degrees':degrees,'self_intersections':count,'expected':expected[(role,degrees)]['self_intersections']};entry['poses'].append(row)
     if label=='corrected':
      weights={key.name:float(key.value) for obj in meshes if obj.data.shape_keys for key in obj.data.shape_keys.key_blocks if key.name!='Basis'}
      wanted=expected[(role,degrees)]['morph_weights'];row['morph_weights']=weights
      if set(weights)!=set(wanted) or any(abs(weights[k]-wanted[k])>1e-5 for k in weights):raise ValueError('Corrective baseline morph weights differ')
     report['stage']=label+'_'+role+'_'+str(degrees);save()
     if count!=row['expected']:raise ValueError('Frozen baseline not reproduced')
   entry['reproduced']=True
  # Signed indices refer to the primary import; clip correspondence was checked above.
  cohorts=seam_groups(rest)
  if hip_arap:
   if hip_dihedral:
    from corrective_hip_dihedral import run
   elif hip_contact_aware:
    from corrective_hip_contact_aware import run
   else:
    from corrective_hip_fold_arap import run
   fold=json.loads((root/'hip-fold-report.json').read_text())
   if fold['id']!=plan['hip_fold_id'] or fold['rig_sha256']!=plan['parent_candidate_sha256'] or fold['status']!='diagnostic_complete':raise ValueError('Hip fold lineage mismatch')
   if hip_contact_aware:
    prior=json.loads((root/'prior-hip-report.json').read_text())
    if prior['id']!=plan['previous_trial_id'] or prior['rig_sha256']!=plan['parent_candidate_sha256'] or prior['status']!='diagnostic_complete':raise ValueError('Prior hip trial lineage mismatch')
   report['hip_fold_id']=fold['id'];report['hip_trials']=[];targets={}
   for joint in plan['config']['joints']:
    sample=next(p for p in fold['poses'] if p['joint']==joint and p['degrees']==90)
    seeds={v for e in sample['largest_fold_increase_edges'][:plan['config']['fold_edges_per_joint']] for v in e['vertices']}
    action,_=bind_imported_clip(rig,meshes,'Stress_'+joint,True);first,last=action.frame_range;frame=first+(last-first)*.5
    bpy.context.scene.frame_set(math.floor(first)-1);bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame));posed,_,_=surface(meshes)
    selected=[e['vertices'] for e in sample['largest_fold_increase_edges'][:plan['config']['fold_edges_per_joint']]]
    result,changed=run(meshes,rest,posed,faces,regions,keys,plan['config'],joint,selected if hip_dihedral else seeds,sample['intersections']);report['hip_trials'].append(result);targets[joint+'_90']=changed;save()
    if hip_contact_aware:
     expected_trial=next(p for p in prior['hip_trials'] if p['joint']==joint)
     if result['proposal_intersections']!=expected_trial['after_intersections'] or abs(result['edge_strain_before']-expected_trial['edge_strain_before'])>1e-6:raise ValueError('Previous hip trial not reproduced')
   if (hip_contact_aware or hip_dihedral) and all(t['disposition']=='candidate_for_further_review' for t in report['hip_trials']):
    import numpy as np
    target=out/'posed-target.npz';np.savez_compressed(target,**targets)
    report['posed_target_artifact']={'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'vertex_count':len(rest),'keys':sorted(targets),'space':'Blender world; signed primary import correspondence'}
   report['status']='diagnostic_complete';report['scope']='Measured hip fold surface trial, separate 90-degree poses; no mesh export or anatomical qualification.'
   return
  action,_=bind_imported_clip(rig,meshes,'Stress_UpperArmL',True);first,last=action.frame_range;frame=first+(last-first)*.5
  bpy.context.scene.frame_set(math.floor(first)-1);bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame));posed,_,_=surface(meshes)
  if centroid:
   from corrective_contact_centroid import run
   result,changed=run(meshes,rest,posed,faces,regions,keys,plan['config']);report['centroid_probe']=result
   if result['after_intersections']<result['before_intersections']:
    import numpy as np
    target=out/'posed-target.npz';np.savez_compressed(target,UpperArmL_90=changed)
    report['posed_target_artifact']={'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'vertex_count':len(changed),'space':'Blender world; signed primary import correspondence'}
   report['status']='diagnostic_complete';report['scope']='Fixed bounded posed triangle-centroid separation hypothesis, no mesh export or anatomical qualification.'
   return
  if arap:
   from corrective_local_arap import run
   result,changed=run(meshes,rest,posed,faces,regions,keys,plan['config']);report['arap']=result
   if result['after_intersections']<=result['before_intersections'] and result['rigid_energy_after']<result['rigid_energy_before']:
    import numpy as np
    target=out/'posed-target.npz';np.savez_compressed(target,UpperArmL_90=changed)
    report['posed_target_artifact']={'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'vertex_count':len(changed),'space':'Blender world; signed primary import correspondence'}
   report['status']='diagnostic_complete';report['scope']='Bounded localized rest-shape-preserving posed-surface hypothesis. No GLB export, anatomical pass or production qualification.'
   return
  ordered,reg,pairs,counts=collision_pairs(posed,faces,keys,regions);matching=[(a,b) for a,b in pairs if set((reg[a],reg[b]))==set(plan['config']['region_pair'])]
  if len(matching)!=31:raise ValueError('Signed shoulder pair set changed')
  height=max(p.z for p in rest)-min(p.z for p in rest);seeds=defaultdict(list);ambiguous=0
  for a,b in matching:
   torso,arm=(a,b) if reg[a]=='bone_2' else (b,a)
   nr=normal(rest,ordered[torso]);np=normal(posed,ordered[torso])
   if nr is None or np is None:ambiguous+=1;continue
   side=(center(rest,ordered[arm])-center(rest,ordered[torso])).dot(nr)
   if abs(side)<height*plan['config']['minimum_rest_side_height_fraction']:ambiguous+=1;continue
   direction=np*(1 if side>0 else -1)
   for vertex in ordered[arm]:seeds[vertex].append(direction)
  if not seeds:raise ValueError('No unambiguous rest-side shoulder seeds')
  if len(meshes)!=1:raise ValueError('Prototype requires one mesh')
  obj=meshes[0];adjacency=[set() for _ in obj.data.vertices]
  for edge in obj.data.edges:
   a,b=edge.vertices;adjacency[a].add(b);adjacency[b].add(a)
  falloff=mesh_ring_falloff(adjacency,cohorts,set(seeds),plan['config']['falloff_rings'])
  vectors={i:sum(values,Vector()).normalized() for i,values in seeds.items() if sum(values,Vector()).length>1e-10}
  if not vectors:raise ValueError('Shoulder normal directions cancel')
  for _ in range(3):
   prior=dict(vectors)
   for i in falloff:
    if i not in prior:
     candidates=[prior[j] for j in adjacency[i] if j in prior]
     if candidates:
      v=sum(candidates,Vector());vectors[i]=v.normalized() if v.length>1e-10 else Vector()
  # Duplicate seam vertices must share a single displacement.
  deltas=[vectors.get(i,Vector())*(height*plan['config']['max_added_height_fraction']*falloff.get(i,0)) for i in range(len(rest))]
  for group in cohorts:
   v=sum((deltas[i] for i in group),Vector())/len(group)
   for i in group:deltas[i]=v.copy()
  changed=[p+d for p,d in zip(posed,deltas)];result=collision_summary(changed,faces,keys,regions)
  report['separation']={'joint':'UpperArmL','degrees':90,'eligible_pairs':len(matching),'ambiguous_pairs':ambiguous,'seed_vertices':len(seeds),
   'falloff_vertices':len(falloff),'max_added_delta_m':max(v.length for v in deltas),'height_m':height,
   'before_intersections':31,'after_intersections':result['self_intersections'],'top_regions':result['top_regions'],
   'seam_spread_m':seam_spread(changed,cohorts),'edge_deformation':edge_deformation(rest,changed,faces)}
  save()
  if report['separation']['max_added_delta_m']>height*.0030001 or report['separation']['seam_spread_m']>1e-6 or report['separation']['edge_deformation']['severely_stretched_edges']:
   raise ValueError('Separation exceeded frozen seam/stretch/displacement bounds')
  report['status']='diagnostic_complete';report['scope']='Single left-shoulder posed-surface hypothesis based on signed rest-side contact normals. No exported GLB, visual pass, full motion or qualification.'
 except Exception as error:report.update(status='failed',error=f'{type(error).__name__}: {error}');raise
 finally:report['completed_unix']=time.time();save()
if __name__=='__main__':main(Path(sys.argv[1]).resolve())
