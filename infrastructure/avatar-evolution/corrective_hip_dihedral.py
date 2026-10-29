"""Colab-only fold-angle hip probe with frozen seeds, bounds and contact rollback."""
import math
import numpy as np
import torch
from mathutils import Vector
from diagnose_collision_influences import collision_pairs
from diagnose_skinning_modes import seam_groups,seam_spread
from contact_patch_mask import mesh_ring_falloff
from mesh_validation import collision_summary
from asset_pipeline.edge_deformation import edge_deformation

def run(meshes,rest,posed,faces,regions,keys,config,joint,selected_edges,expected_contacts):
 if len(meshes)!=1 or len(selected_edges)!=12:raise ValueError('Exact 12 measured fold edges required')
 seeds={v for edge in selected_edges for v in edge};adj=[set() for _ in meshes[0].data.vertices];edge_faces={}
 for edge in meshes[0].data.edges:
  a,b=edge.vertices;adj[a].add(b);adj[b].add(a)
 for f in faces:
  for a,b in zip(f,(*f[1:],f[0])):edge_faces.setdefault(tuple(sorted((a,b))),[]).append(f)
 pairs=[]
 for edge in selected_edges:
  fs=edge_faces.get(tuple(sorted(edge)),[])
  if len(fs)!=2:raise ValueError('Measured fold edge is not two-face manifold')
  pairs.append(fs)
 cohorts=seam_groups(rest);falloff=mesh_ring_falloff(adj,cohorts,seeds,config['falloff_rings']);active=sorted(falloff);height=max(p.z for p in rest)-min(p.z for p in rest);cap=height*config['max_added_height_fraction']
 rest_t=torch.tensor(np.asarray([list(x) for x in rest]),dtype=torch.float64);base=torch.tensor(np.asarray([list(x) for x in posed]),dtype=torch.float64);idx=torch.tensor(active,dtype=torch.long);weights=torch.tensor([falloff[i] for i in active],dtype=torch.float64).unsqueeze(1);face_idx=torch.tensor(pairs,dtype=torch.long)
 def cosangles(x):
  f=x[face_idx];n=torch.linalg.cross(f[:,:,1]-f[:,:,0],f[:,:,2]-f[:,:,0]);n=torch.nn.functional.normalize(n,dim=2,eps=1e-12);return (n[:,0]*n[:,1]).sum(dim=1)
 target=cosangles(rest_t).detach()
 def loss(x):return ((cosangles(x)-target)**2).mean()
 baseline=float(loss(base));delta=torch.zeros((len(active),3),dtype=torch.float64,requires_grad=True);opt=torch.optim.Adam([delta],lr=cap*.08)
 seam_indices={v:k for k,v in enumerate(active)}
 for _ in range(config['iterations']):
  opt.zero_grad();trial=base.index_add(0,idx,delta*weights);objective=loss(trial)+config['anchor_strength']*((delta/cap)**2).mean();objective.backward();opt.step()
  with torch.no_grad():
   lens=torch.linalg.vector_norm(delta,dim=1,keepdim=True);delta.mul_(torch.clamp(cap/(lens+1e-15),max=1.0))
   for group in cohorts:
    ids=[seam_indices[v] for v in group if v in seam_indices]
    if len(ids)>1:
     value=delta[ids].mean(dim=0);delta[ids]=value
 changed=(base.index_add(0,idx,delta.detach()*weights)).numpy();proposal=[Vector(q) for q in changed]
 for group in cohorts:
  avg=sum((proposal[i]-posed[i] for i in group),Vector())/len(group)
  for i in group:proposal[i]=posed[i]+avg
 ordered,_,before_pairs,_=collision_pairs(posed,faces,keys,regions);order2,_,after_pairs,_=collision_pairs(proposal,faces,keys,regions)
 if ordered!=order2:raise ValueError('Collision triangle identity changed')
 new=set(after_pairs)-set(before_pairs);rollback={v for a,b in new for f in (ordered[a],ordered[b]) for v in f if (proposal[v]-posed[v]).length>1e-12}
 for group in cohorts:
  if any(i in rollback for i in group):rollback.update(group)
 final=[p.copy() if i in rollback else proposal[i].copy() for i,p in enumerate(posed)];_,_,final_pairs,_=collision_pairs(final,faces,keys,regions);new_remaining=set(final_pairs)-set(before_pairs)
 after=collision_summary(final,faces,keys,regions);maximum=max((a-b).length for a,b in zip(final,posed));spread=seam_spread(final,cohorts);stretch=edge_deformation(rest,final,faces);fold_final=float(loss(torch.tensor(np.asarray([list(p) for p in final]),dtype=torch.float64)))
 result={'joint':joint,'degrees':90,'seed_vertices':len(seeds),'selected_edges':len(selected_edges),'height_m':height,'before_intersections':len(before_pairs),'proposal_intersections':len(after_pairs),'after_intersections':after['self_intersections'],'proposal_new_pairs':len(new),'remaining_new_pairs':len(new_remaining),'rolled_back_vertices':len(rollback),'fold_loss_before':baseline,'fold_loss_after':fold_final,'max_added_delta_m':maximum,'seam_spread_m':spread,'edge_deformation':stretch}
 if len(before_pairs)!=expected_contacts or maximum>cap*1.0001 or spread>1e-6 or stretch['severely_stretched_edges']:raise ValueError('Frozen bounds or baseline violated')
 result['disposition']='candidate_for_further_review' if not new_remaining and result['after_intersections']<=expected_contacts and fold_final<baseline else 'reject_contact_or_fold_regression'
 return result,final
