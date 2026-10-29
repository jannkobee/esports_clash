"""Colab-only contact topology diagnostic on exact corrected animation; no edits."""
import hashlib,json,math,os,sys,time
from pathlib import Path
from collections import Counter,defaultdict
import bpy
from review_generated_rig import load,surface
from mesh_validation import rest_keys
from candidate_animation import clear_imported_animation,bind_imported_clip
from diagnose_collision_influences import collision_pairs,all_vertex_weights
from review_shoulder_contact_candidate import verify_source

def main(root):
 if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'): raise RuntimeError('Google Colab required')
 plan=json.loads((root/'plan.json').read_text()); out=root/'output'; out.mkdir(exist_ok=False)
 report={'id':plan['id'],'method':plan['method'],'compute':'google','source_sha256':plan['source_sha256'],'rig_sha256':plan['parent_candidate_sha256'],'parent_candidate_id':plan['parent_candidate_id'],'contact_map_id':plan['contact_map_id'],'qualification_complete':False,'publication_eligible':False,'status':'running','poses':[]}
 def save(): (out/'report.json').write_text(json.dumps(report,indent=2))
 try:
  for n,h in plan['files'].items():
   if hashlib.sha256((root/n).read_bytes()).hexdigest()!=h: raise ValueError('Frozen input mismatch: '+n)
  contact=json.loads((root/'contact-map.json').read_text()); expected=json.loads((root/'corrected-report.json').read_text())
  if contact['id']!=plan['contact_map_id'] or contact['rig_sha256']!=plan['parent_candidate_sha256']: raise ValueError('Contact lineage mismatch')
  rigs,meshes=load(root/'candidate.glb'); clear_imported_animation(rigs[0],meshes); bpy.context.scene.frame_set(0)
  primary,primary_faces,_=surface(meshes); primary_weights=all_vertex_weights(meshes); verify_source(meshes,primary,contact)
  rigs,meshes=load(root/'corrected-stress.glb'); rig=rigs[0]; clear_imported_animation(rig,meshes); bpy.context.scene.frame_set(0)
  rest,faces,regions=surface(meshes); weights=all_vertex_weights(meshes)
  if len(meshes)!=1 or faces!=primary_faces or len(rest)!=len(primary) or max((a-b).length for a,b in zip(rest,primary))>1e-6 or any(set(a)!=set(b) or any(abs(a[k]-b[k])>1e-6 for k in a) for a,b in zip(primary_weights,weights)): raise ValueError('Clip source correspondence mismatch')
  keys=rest_keys(rest); neighbors=defaultdict(set)
  for edge in meshes[0].data.edges:
   a,b=(keys[i] for i in edge.vertices)
   if a!=b: neighbors[a].add(b); neighbors[b].add(a)
  expected_by={(x['joint'],x['degrees']):x for x in expected.get('reloaded_poses',expected.get('poses',[]))}
  for joint in ('UpperArmL','UpperArmR','ThighL','ThighR'):
   action,_=bind_imported_clip(rig,meshes,'Stress_'+joint,True); first,last=action.frame_range; frame=first+(last-first)*.5
   bpy.context.scene.frame_set(math.floor(first)-1); bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame)); posed,posed_faces,_=surface(meshes)
   if posed_faces!=faces: raise ValueError('Posed topology mismatch')
   ordered,reg,pairs,counts=collision_pairs(posed,faces,keys,regions)
   exp=expected_by[(joint,90)]; morph={key.name:float(key.value) for obj in meshes if obj.data.shape_keys for key in obj.data.shape_keys.key_blocks if key.name!='Basis'}
   if len(pairs)!=exp['self_intersections'] or set(morph)!=set(exp['morph_weights']) or any(abs(morph[k]-v)>1e-5 for k,v in exp['morph_weights'].items()): raise ValueError('Corrected contact or morph baseline mismatch for '+joint)
   grouped=defaultdict(list)
   for a,b in pairs:
    start={keys[i] for i in ordered[a]}; target={keys[i] for i in ordered[b]}; seen=set(start); frontier=set(start); hops=None
    for step in range(1,7):
     frontier={n for k in frontier for n in neighbors[k]}-seen; seen.update(frontier)
     if frontier & target: hops=step; break
    center_a=sum((rest[i] for i in ordered[a]),rest[ordered[a][0]]*0)/3; center_b=sum((rest[i] for i in ordered[b]),rest[ordered[b][0]]*0)/3
    grouped[' / '.join(sorted((reg[a],reg[b])))].append({'hops':hops,'rest_centroid_distance_m':(center_a-center_b).length})
   entry={'joint':joint,'degrees':90,'intersections':len(pairs),'morph_weights':morph,'regions':[]}
   for name,values in sorted(grouped.items()):
    ds=[v['rest_centroid_distance_m'] for v in values]; entry['regions'].append({'pair':name,'count':len(values),'edge_hop_histogram':dict(Counter(str(v['hops']) if v['hops'] is not None else '>6' for v in values)),'rest_centroid_distance_m':{'min':min(ds),'mean':sum(ds)/len(ds),'max':max(ds)}})
   report['poses'].append(entry); save()
  report.update(status='diagnostic_complete',scope='Graph hop distances use rest-position seam equivalence and are bounded to six mesh edges; centroid distances are not penetration depth. No geometry modified or visual qualification.',completed_unix=time.time()); save()
 except Exception as e:
  report.update(status='failed',error=f'{type(e).__name__}: {e}'); save(); raise
if __name__=='__main__': main(Path(sys.argv[-1]).resolve())
