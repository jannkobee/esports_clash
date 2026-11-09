"""Colab-only localized, bounded as-rigid-as-possible corrective-surface probe."""
from collections import defaultdict
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import spsolve
from mathutils import Vector
from contact_patch_mask import mesh_ring_falloff
from diagnose_skinning_modes import seam_groups,seam_spread
from diagnose_collision_influences import collision_pairs
from mesh_validation import collision_summary
from asset_pipeline.edge_deformation import edge_deformation

def run(meshes,rest,posed,faces,regions,keys,config):
 if len(meshes)!=1:raise ValueError('Local ARAP probe requires one mesh')
 ordered,groups,pairs,_=collision_pairs(posed,faces,keys,regions)
 matching=[(a,b) for a,b in pairs if set((groups[a],groups[b]))==set(config['region_pair'])]
 if len(matching)!=31:raise ValueError('Frozen corrected shoulder pair baseline changed')
 seeds={v for a,b in matching for f in (ordered[a],ordered[b]) for v in f}
 obj=meshes[0];adj=[set() for _ in obj.data.vertices]
 for edge in obj.data.edges:
  a,b=edge.vertices;adj[a].add(b);adj[b].add(a)
 cohorts=seam_groups(rest);falloff=mesh_ring_falloff(adj,cohorts,seeds,config['falloff_rings'])
 active=sorted(falloff);index={v:i for i,v in enumerate(active)}
 if not active:raise ValueError('Empty signed contact patch')
 x=np.asarray([list(p) for p in rest],dtype=np.float64);p=np.asarray([list(q) for q in posed],dtype=np.float64)
 height=float(np.ptp(x[:,2]));minimum=height*1e-6;needed=set(active)
 for v in active:needed.update(adj[v])
 rotations={}
 for i in needed:
  covariance=np.zeros((3,3));used=0
  for j in adj[i]:
   e=x[i]-x[j];length=float(np.linalg.norm(e))
   if length<=minimum:continue
   covariance+=np.outer(e,p[i]-p[j])/length;used+=1
  if used<2:rotations[i]=np.eye(3);continue
  u,_,vh=np.linalg.svd(covariance);r=vh.T@u.T
  if np.linalg.det(r)<0:vh[-1,:]*=-1;r=vh.T@u.T
  rotations[i]=r
 rows=[];cols=[];vals=[];rhs=np.zeros((len(active),3));edges=[]
 for i in active:
  k=index[i];total=0.
  for j in adj[i]:
   edge=x[i]-x[j];length=float(np.linalg.norm(edge))
   if length<=minimum:continue
   weight=1./length;total+=weight;desired=.5*(rotations[i]+rotations[j])@edge
   rhs[k]+=weight*(desired-(p[i]-p[j]));edges.append((i,j,weight,desired))
   if j in index:rows.append(k);cols.append(index[j]);vals.append(-weight)
  if total<=0:raise ValueError('Isolated contact patch vertex')
  damping=config['anchor_strength']*(1.05-falloff[i])*total
  rows.append(k);cols.append(k);vals.append(total+damping)
 matrix=coo_matrix((vals,(rows,cols)),shape=(len(active),len(active))).tocsr()
 solution=np.column_stack([spsolve(matrix,rhs[:,axis]) for axis in range(3)])
 if not np.isfinite(solution).all():raise ValueError('Local ARAP solve produced nonfinite values')
 delta=np.zeros_like(p);delta[active]=solution
 max_raw=float(np.linalg.norm(delta,axis=1).max());cap=height*config['max_added_height_fraction']
 scale=min(1.,cap/max(max_raw,1e-15));delta*=scale
 for group in cohorts:delta[group]=delta[group].mean(axis=0)
 max_added=float(np.linalg.norm(delta,axis=1).max());changed=p+delta
 def energy(q):return sum(w*float(np.dot(q[i]-q[j]-target,q[i]-q[j]-target)) for i,j,w,target in edges)
 def edge_strain(q):return sum(w*(float(np.linalg.norm(q[i]-q[j]))-float(np.linalg.norm(x[i]-x[j])))**2 for i,j,w,_ in edges)
 points=[Vector(q) for q in changed];before=collision_summary(posed,faces,keys,regions);after=collision_summary(points,faces,keys,regions)
 result={'joint':'UpperArmL','degrees':90,'eligible_pairs':len(matching),'seed_vertices':len(seeds),'falloff_vertices':len(active),
  'height_m':height,'max_unclamped_delta_m':max_raw,'clamp_scale':scale,'max_added_delta_m':max_added,
  'before_intersections':before['self_intersections'],'after_intersections':after['self_intersections'],'top_regions':after['top_regions'],
  'rigid_energy_before':energy(p),'rigid_energy_after':energy(changed),'edge_strain_before':edge_strain(p),'edge_strain_after':edge_strain(changed),
  'seam_spread_m':seam_spread(points,cohorts),'edge_deformation':edge_deformation(rest,points,faces)}
 if max_added>cap*1.0001 or result['seam_spread_m']>1e-6 or result['edge_deformation']['severely_stretched_edges']:
  raise ValueError('Local ARAP exceeded frozen displacement, seam or stretch constraints')
 return result,changed
