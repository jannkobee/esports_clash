"""Colab-only hip contact-patch edge and fold measurements; no mesh changes."""
import hashlib,json,math,os,sys,time
from collections import defaultdict
from pathlib import Path
import bpy
from mathutils import Vector
from review_generated_rig import load,surface
from mesh_validation import rest_keys
from candidate_animation import clear_imported_animation,bind_imported_clip
from diagnose_collision_influences import collision_pairs,all_vertex_weights
from diagnose_skinning_modes import seam_groups
from contact_patch_mask import mesh_ring_falloff
from review_shoulder_contact_candidate import verify_source

def quantiles(values):
 values=sorted(values)
 if not values:return None
 return {'min':values[0],'p10':values[int(.1*(len(values)-1))],'median':values[(len(values)-1)//2],'p90':values[int(.9*(len(values)-1))],'max':values[-1]}

def angle(points,face_a,face_b):
 def norm(f):
  a,b,c=(points[i] for i in f);n=(b-a).cross(c-a);return n.normalized() if n.length>1e-12 else None
 a,b=norm(face_a),norm(face_b)
 return math.degrees(math.acos(max(-1,min(1,a.dot(b))))) if a is not None and b is not None else None

def main(root):
 if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Google Colab required')
 plan=json.loads((root/'plan.json').read_text());out=root/'output';out.mkdir(exist_ok=False)
 report={'id':plan['id'],'method':plan['method'],'compute':'google','source_sha256':plan['source_sha256'],'rig_sha256':plan['parent_candidate_sha256'],'parent_candidate_id':plan['parent_candidate_id'],'contact_map_id':plan['contact_map_id'],'qualification_complete':False,'publication_eligible':False,'status':'running','poses':[]}
 def save():(out/'report.json').write_text(json.dumps(report,indent=2))
 try:
  for n,h in plan['files'].items():
   if hashlib.sha256((root/n).read_bytes()).hexdigest()!=h:raise ValueError('Frozen input mismatch: '+n)
  contact=json.loads((root/'contact-map.json').read_text());expected=json.loads((root/'corrected-report.json').read_text())
  if contact['id']!=plan['contact_map_id'] or contact['rig_sha256']!=plan['parent_candidate_sha256']:raise ValueError('Contact map lineage mismatch')
  rigs,meshes=load(root/'candidate.glb');clear_imported_animation(rigs[0],meshes);bpy.context.scene.frame_set(0);primary,primary_faces,_=surface(meshes);primary_weights=all_vertex_weights(meshes);verify_source(meshes,primary,contact)
  rigs,meshes=load(root/'corrected-stress.glb');rig=rigs[0];clear_imported_animation(rig,meshes);bpy.context.scene.frame_set(0);rest,faces,regions=surface(meshes);weights=all_vertex_weights(meshes)
  if len(meshes)!=1 or faces!=primary_faces or len(rest)!=len(primary) or max((a-b).length for a,b in zip(rest,primary))>1e-6 or any(set(a)!=set(b) or any(abs(a[k]-b[k])>1e-6 for k in a) for a,b in zip(primary_weights,weights)):raise ValueError('Clip correspondence mismatch')
  obj=meshes[0];adj=[set() for _ in obj.data.vertices];edge_faces=defaultdict(list)
  for edge in obj.data.edges:a,b=edge.vertices;adj[a].add(b);adj[b].add(a)
  for f in faces:
   for a,b in zip(f,(*f[1:],f[0])):edge_faces[tuple(sorted((a,b)))].append(f)
  seams=seam_groups(rest);keys=rest_keys(rest);expected_by={(x['joint'],x['degrees']):x for x in expected.get('reloaded_poses',expected.get('poses',[]))}
  for joint in ('ThighL','ThighR'):
   source=next(x for x in contact['pose_diagnostics'] if x['joint']==joint)
   seeds={v for p in source['top_region_weight_profiles'] for v in p['contact_vertex_ids']};patch=set(mesh_ring_falloff(adj,seams,seeds,3));edges=[(a,b) for a,b in edge_faces if a in patch and b in patch and (rest[a]-rest[b]).length>1e-6]
   if not edges:raise ValueError('Empty contact patch')
   action,_=bind_imported_clip(rig,meshes,'Stress_'+joint,True);first,last=action.frame_range
   for phase,degrees in ((.25,45),(.5,90)):
    frame=first+(last-first)*phase;bpy.context.scene.frame_set(math.floor(first)-1);bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame));posed,posed_faces,_=surface(meshes)
    if posed_faces!=faces:raise ValueError('Pose topology mismatch')
    _,_,pairs,_=collision_pairs(posed,faces,keys,regions);exp=expected_by[(joint,degrees)];morph={k.name:float(k.value) for o in meshes if o.data.shape_keys for k in o.data.shape_keys.key_blocks if k.name!='Basis'}
    if len(pairs)!=exp['self_intersections'] or set(morph)!=set(exp['morph_weights']) or any(abs(morph[k]-v)>1e-5 for k,v in exp['morph_weights'].items()):raise ValueError('Frozen pose baseline mismatch')
    ratios=[];folds=[];edge_rows=[]
    for a,b in edges:
     before=(rest[a]-rest[b]).length;after=(posed[a]-posed[b]).length;ratio=after/before;ratios.append(ratio)
     row={'vertices':[a,b],'rest_length_m':before,'posed_length_m':after,'length_ratio':ratio}
     adjacent=edge_faces[(a,b)]
     if len(adjacent)==2:
      r=angle(rest,*adjacent);p=angle(posed,*adjacent)
      if r is not None and p is not None:row.update(rest_dihedral_degrees=r,posed_dihedral_degrees=p,dihedral_increase_degrees=p-r);folds.append(p-r)
     edge_rows.append(row)
    report['poses'].append({'joint':joint,'degrees':degrees,'intersections':len(pairs),'morph_weights':morph,'seed_vertices':len(seeds),'patch_vertices':len(patch),'patch_edges':len(edges),'edge_length_ratio':quantiles(ratios),'compressed_below_0_5':sum(v<.5 for v in ratios),'expanded_over_1_5':sum(v>1.5 for v in ratios),'signed_dihedral_change_degrees':quantiles(folds),'largest_compression_edges':sorted(edge_rows,key=lambda x:x['length_ratio'])[:12],'largest_fold_increase_edges':sorted([x for x in edge_rows if 'dihedral_increase_degrees' in x],key=lambda x:x['dihedral_increase_degrees'],reverse=True)[:12]});save()
  report.update(status='diagnostic_complete',completed_unix=time.time(),scope='Signed contact-map hip patch, three edge rings; edge length and adjacent triangle dihedral changes are exploratory shape measurements, not collision exclusions, penetration depth or visual qualification.');save()
 except Exception as e:report.update(status='failed',error=f'{type(e).__name__}: {e}');save();raise
if __name__=='__main__':main(Path(sys.argv[-1]).resolve())
