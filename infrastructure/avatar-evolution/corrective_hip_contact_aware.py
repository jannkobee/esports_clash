"""Colab-only contact-aware rollback of a frozen hip fold surface proposal."""
from mathutils import Vector
from diagnose_collision_influences import collision_pairs
from diagnose_skinning_modes import seam_groups,seam_spread
from contact_patch_mask import mesh_ring_falloff
from mesh_validation import collision_summary
from asset_pipeline.edge_deformation import edge_deformation
from corrective_hip_fold_arap import run as raw_arap

def run(meshes,rest,posed,faces,regions,keys,config,joint,seeds,expected_contacts):
 raw,proposal=raw_arap(meshes,rest,posed,faces,regions,keys,config,joint,seeds,expected_contacts)
 proposal=[Vector(row) for row in proposal]
 ordered,_,old_pairs,_=collision_pairs(posed,faces,keys,regions)
 new_ordered,_,proposed_pairs,_=collision_pairs(proposal,faces,keys,regions)
 if ordered!=new_ordered:raise ValueError('Collision triangle identity changed')
 introduced=set(proposed_pairs)-set(old_pairs)
 moved={v for a,b in introduced for face in (ordered[a],ordered[b]) for v in face if (proposal[v]-posed[v]).length>1e-12}
 cohorts=seam_groups(rest)
 for group in cohorts:
  if any(v in moved for v in group):moved.update(group)
 result_points=[p.copy() if i in moved else proposal[i].copy() for i,p in enumerate(posed)]
 _,_,final_pairs,_=collision_pairs(result_points,faces,keys,regions);remaining_new=set(final_pairs)-set(old_pairs)
 adjacency=[set() for _ in meshes[0].data.vertices]
 for edge in meshes[0].data.edges:
  a,b=edge.vertices;adjacency[a].add(b);adjacency[b].add(a)
 patch=mesh_ring_falloff(adjacency,cohorts,seeds,config['falloff_rings']);height=max(p.z for p in rest)-min(p.z for p in rest)
 def strain(points):
  total=0.
  for i in patch:
   for j in adjacency[i]:
    before=(rest[i]-rest[j]).length
    if before>height*1e-6:total+=((points[i]-points[j]).length-before)**2/before
  return total
 before=collision_summary(posed,faces,keys,regions);after=collision_summary(result_points,faces,keys,regions)
 max_delta=max((a-b).length for a,b in zip(result_points,posed));spread=seam_spread(result_points,cohorts);stretch=edge_deformation(rest,result_points,faces)
 r={'joint':joint,'degrees':90,'seed_vertices':len(seeds),'height_m':height,'before_intersections':before['self_intersections'],'proposal_intersections':raw['after_intersections'],'after_intersections':after['self_intersections'],'proposal_new_pairs':len(introduced),'rolled_back_vertices':len(moved),'remaining_new_pairs':len(remaining_new),'edge_strain_before':strain(posed),'edge_strain_after':strain(result_points),'max_added_delta_m':max_delta,'seam_spread_m':spread,'edge_deformation':stretch,'top_regions':after['top_regions']}
 if r['before_intersections']!=expected_contacts or max_delta>height*config['max_added_height_fraction']*1.0001 or spread>1e-6 or stretch['severely_stretched_edges']:raise ValueError('Frozen baseline or surface safety constraints violated')
 r['disposition']='candidate_for_further_review' if not remaining_new and r['after_intersections']<=r['before_intersections'] and r['edge_strain_after']<r['edge_strain_before'] else 'reject_contact_or_strain_regression'
 return r,result_points
