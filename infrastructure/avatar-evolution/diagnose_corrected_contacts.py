"""Map signed rest vertices on the exact reimported corrective diagnostic clips."""
import hashlib,json,math,os,sys,time
from pathlib import Path
import bpy
from mathutils import Matrix
from review_generated_rig import load,surface
from mesh_validation import collision_summary,rest_keys
from candidate_animation import clear_imported_animation,bind_imported_clip
from diagnose_collision_influences import all_vertex_weights,collision_pairs,summarize_region_pair

ROLES=['UpperArmL','UpperArmR','ThighL','ThighR']
def main(root):
 if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Google Colab required')
 plan=json.loads((root/'plan.json').read_text())
 for name,sha in plan['files'].items():
  if hashlib.sha256((root/name).read_bytes()).hexdigest()!=sha:raise ValueError('Frozen diagnostic input mismatch: '+name)
 baseline=json.loads((root/'baseline-report.json').read_text());candidate=json.loads((root/'candidate-report.json').read_text());mapping=baseline['bone_map']
 if candidate['corrective_stress_artifact']['sha256']!=plan['files']['candidate-stress.glb']:raise ValueError('Exact corrective clip required')
 output=root/'output';output.mkdir(exist_ok=False)
 report={'id':plan['id'],'method':plan['method'],'compute':'google','source_sha256':baseline['source_sha256'],
  'rig_sha256':plan['parent_candidate_sha256'],'raw_rig_sha256':baseline['rig_sha256'],'parent_candidate_id':plan['parent_candidate_id'],
  'visual_review_id':plan['visual_review_id'],'stress_sha256':plan['files']['candidate-stress.glb'],
  'qualification_complete':False,'publication_eligible':False,'pose_diagnostics':[],'contact_vertex_records':{},'status':'running',
  'vertex_index_space':'Blender glTF import, merge_vertices=True; mesh-local index and frozen candidate/rest-position signature; not a GLB accessor ordinal.'}
 def save(): (output/'report.json').write_text(json.dumps(report,indent=2))
 try:
  rigs,meshes=load(root/'candidate.glb');rig=rigs[0];clear_imported_animation(rig,meshes);bpy.context.scene.frame_set(0)
  primary_rest,primary_faces,_=surface(meshes);primary_weights=all_vertex_weights(meshes)
  refs=[{'mesh':obj.name,'mesh_vertex_index':v.index} for obj in meshes for v in obj.data.vertices]
  report['mesh_vertex_counts']={obj.name:len(obj.data.vertices) for obj in meshes}
  rigs,meshes=load(root/'candidate-stress.glb');rig=rigs[0];clear_imported_animation(rig,meshes);bpy.context.scene.frame_set(0)
  rest,faces,_=surface(meshes);weights=all_vertex_weights(meshes)
  if primary_faces!=faces or len(rest)!=len(primary_rest) or len(weights)!=len(primary_weights):raise ValueError('Primary and clip topology differ')
  rest_diff=max((a-b).length for a,b in zip(rest,primary_rest))
  if rest_diff>1e-6 or any(set(a)!=set(b) or any(abs(a[k]-b[k])>1e-6 for k in a) for a,b in zip(primary_weights,weights)):raise ValueError('Primary/clip rest or weights differ')
  report['clip_rest_max_distance_m']=rest_diff;keys=rest_keys(rest)
  for role in ROLES:
   action,_=bind_imported_clip(rig,meshes,'Stress_'+role,True);first,last=action.frame_range;frame=first+(last-first)*.5
   bpy.context.scene.frame_set(math.floor(first)-1);bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame))
   points,posed_faces,regions=surface(meshes)
   if posed_faces!=faces:raise ValueError('Corrected pose changed topology')
   expected=next(p for p in candidate['poses'] if p['joint']==role and p['degrees']==90)
   morph={k.name:float(k.value) for obj in meshes if obj.data.shape_keys for k in obj.data.shape_keys.key_blocks if k.name!='Basis'}
   if set(morph)!=set(expected['morph_weights']) or any(abs(morph[k]-expected['morph_weights'][k])>1e-5 for k in morph):raise ValueError('Actual corrective morph weights differ')
   summary=collision_summary(points,faces,keys,regions);ordered,ordered_regions,pairs,counts=collision_pairs(points,faces,keys,regions)
   if len(pairs)!=summary['self_intersections'] or len(pairs)!=expected['self_intersections']:raise ValueError('Corrected contact count differs from frozen baseline')
   normalized=[(face,region) for face,region in zip(ordered,ordered_regions)]
   groups=[summarize_region_pair(g,pairs,normalized,weights,points,rest) for g,_ in counts.most_common(8)]
   for group in groups:
    for i in group['contact_vertex_ids']:
     record={**refs[i],'rest_world_xyz':list(primary_rest[i]),'weights':primary_weights[i]}
     record['signature_sha256']=hashlib.sha256(json.dumps(record,sort_keys=True).encode()).hexdigest();report['contact_vertex_records'][str(i)]=record
   report['pose_diagnostics'].append({'joint':role,'degrees':90,'self_intersections':len(pairs),'morph_weights':morph,
    'top_region_weight_profiles':groups,'mapped_bone':mapping[role],
    'scope':'Exact post-corrective contact vertices with separate rest/posed coordinates; no geometry modified.'})
   report['stage']='mapped_'+role;save()
  report['status']='diagnostic_complete';report['scope']='Corrected GLB contact map at four 90-degree diagnostic bends, with exact baked morph channels and signed rest-space vertices. No anatomical or motion qualification.'
 except Exception as e:report.update(status='failed',error=f'{type(e).__name__}: {e}');raise
 finally:report['completed_unix']=time.time();save()
if __name__=='__main__':main(Path(sys.argv[1]).resolve())
