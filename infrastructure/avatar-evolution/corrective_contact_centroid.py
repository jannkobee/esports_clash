"""Colab-only, fixed contact-centroid shoulder probe; never exports a mesh."""
from collections import defaultdict
from mathutils import Vector
from contact_patch_mask import mesh_ring_falloff
from diagnose_skinning_modes import seam_groups,seam_spread
from diagnose_collision_influences import collision_pairs
from mesh_validation import collision_summary
from asset_pipeline.edge_deformation import edge_deformation

def run(meshes,rest,posed,faces,regions,keys,config):
 if len(meshes)!=1:raise ValueError('One exact mesh required')
 ordered,groups,pairs,_=collision_pairs(posed,faces,keys,regions)
 matching=[(a,b) for a,b in pairs if set((groups[a],groups[b]))==set(config['region_pair'])]
 if len(matching)!=31:raise ValueError('Frozen shoulder contact baseline changed')
 height=max(p.z for p in rest)-min(p.z for p in rest);seeds=defaultdict(list);ambiguous=0
 for a,b in matching:
  torso,arm=(a,b) if groups[a]=='bone_2' else (b,a)
  tc=sum((posed[i] for i in ordered[torso]),Vector())/3; ac=sum((posed[i] for i in ordered[arm]),Vector())/3
  direction=ac-tc
  if direction.length<height*config['minimum_centroid_height_fraction']:ambiguous+=1;continue
  direction.normalize()
  for vertex in ordered[arm]:seeds[vertex].append(direction.copy())
 if not seeds:raise ValueError('No nonambiguous contact triangle centroid directions')
 adjacency=[set() for _ in meshes[0].data.vertices]
 for edge in meshes[0].data.edges:
  a,b=edge.vertices;adjacency[a].add(b);adjacency[b].add(a)
 cohorts=seam_groups(rest); falloff=mesh_ring_falloff(adjacency,cohorts,set(seeds),config['falloff_rings'])
 vectors={i:sum(v,Vector()).normalized() for i,v in seeds.items() if sum(v,Vector()).length>1e-10}
 for _ in range(config['falloff_rings']):
  prior=dict(vectors)
  for i in falloff:
   if i not in prior:
    nearby=[prior[j] for j in adjacency[i] if j in prior]
    if nearby:
     v=sum(nearby,Vector()); vectors[i]=v.normalized() if v.length>1e-10 else Vector()
 deltas=[vectors.get(i,Vector())*(height*config['max_added_height_fraction']*falloff.get(i,0)) for i in range(len(rest))]
 for group in cohorts:
  v=sum((deltas[i] for i in group),Vector())/len(group)
  for i in group:deltas[i]=v.copy()
 changed=[p+d for p,d in zip(posed,deltas)];before=collision_summary(posed,faces,keys,regions);after=collision_summary(changed,faces,keys,regions)
 result={'joint':'UpperArmL','degrees':90,'eligible_pairs':len(matching),'ambiguous_pairs':ambiguous,'seed_vertices':len(seeds),'falloff_vertices':len(falloff),'height_m':height,'max_added_delta_m':max(v.length for v in deltas),'before_intersections':before['self_intersections'],'after_intersections':after['self_intersections'],'top_regions':after['top_regions'],'seam_spread_m':seam_spread(changed,cohorts),'edge_deformation':edge_deformation(rest,changed,faces)}
 if result['max_added_delta_m']>height*config['max_added_height_fraction']*1.0001 or result['seam_spread_m']>1e-6 or result['edge_deformation']['severely_stretched_edges']:raise ValueError('Frozen displacement, seam or stretch constraint exceeded')
 result['disposition']='investigate_further' if after['self_intersections']<before['self_intersections'] else 'rejected_no_contact_improvement'
 return result,changed
