"""Colab source-bound lateral-chest/medial-arm shape handles.

Unlike fairing or volume inflation, fixed anatomical-side handles separate the
two contacting sheets. A harmonic DISPLACEMENT field preserves their surface
detail. Rest topology, skin, skeleton, frozen caps and all hip targets stay fixed.
"""
import sys,json
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from scipy.sparse import coo_matrix,diags
from scipy.sparse.csgraph import dijkstra
from scipy.sparse.linalg import spsolve
import repair_combined_contour as trial
from repair_contact_contour import contacts
from review_generated_rig import surface
from mesh_validation import rest_keys

HANDLE_POLICY={'version':'source-bound-lateral-separation-handles-v1',
 'arm_mass_min':.55,'chest_mass_max':.35,'clearance_each_side_height':.004,
 'rest_geodesic_support_height':.04,'protected_medial_height':.045,
 'protected_above_shoulder_height':.03,'protected_below_elbow_height':.015,
 'scope':'Contact-bound medial arm and lateral chest handles; support follows the measured rest surface, never posed bounds. No strength or support sweep.'}

def handle_field(rest,posed,edges,center,height):
 if center[0]>0:return np.zeros_like(rest),np.zeros(len(rest),bool),{'solve_vertices':0,'scope':'Right shoulder unchanged pending left shape review'}
 obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 mapping=json.loads((trial_root/'baseline-report.json').read_text())['bone_map'];bone=rig.data.bones[mapping['UpperArmL']]
 moving={bone.name,*[b.name for b in bone.children_recursive]};mass=np.zeros(len(rest))
 for v in obj.data.vertices:mass[v.index]=sum(g.weight for g in v.groups if obj.vertex_groups[g.group].name in moving)
 _,faces,_=surface([obj]);f,pairs=contacts(posed,faces,rest_keys([Vector(p) for p in rest]));seeds=np.unique(f[np.array(pairs).ravel()].ravel())
 _,first,cohort=np.unique(np.round(rest,7),axis=0,return_index=True,return_inverse=True);x=rest[first];p=posed[first];mass=mass[first];n=len(x)
 seeds=np.unique(cohort[seeds]);arm=seeds[mass[seeds]>=.55];chest=seeds[mass[seeds]<=.35]
 if not len(arm) or not len(chest):raise ValueError('Expected separately labeled arm/chest contact handles')
 e=np.sort(cohort[edges],axis=1);e=np.unique(e[e[:,0]!=e[:,1]],axis=0);length=np.linalg.norm(x[e[:,0]]-x[e[:,1]],axis=1)
 keep=length>height*1e-6;e=e[keep];length=length[keep]
 graph=coo_matrix((np.r_[length,length],(np.r_[e[:,0],e[:,1]],np.r_[e[:,1],e[:,0]])),shape=(n,n)).tocsr()
 distance=dijkstra(graph,directed=False,indices=seeds,min_only=True,limit=height*.04)
 elbow=np.array(rig.matrix_world@rig.data.bones[mapping['ForearmL']].head_local)
 eligible=(x[:,0]<-height*.045)&(x[:,2]<center[2]+height*.03)&(x[:,2]>elbow[2]+height*.015)
 active=(distance<height*.04)&eligible
 # Explicit lateral separation handles; the outer arm and central chest are anchors.
 # Shared plane follows the original shoulder joint, never a changed bone/pose.
 arm=arm[eligible[arm]];chest=chest[eligible[chest]]
 handle_ids=np.r_[arm,chest];values=np.r_[np.minimum(0,center[0]-height*.004-p[arm,0]),np.maximum(0,center[0]+height*.004-p[chest,0])]
 values=np.clip(values,-height*.018,height*.018)
 fixed=np.zeros(n,bool);fixed[handle_ids]=True;known=np.zeros(n);known[handle_ids]=values
 # Laplacian interpolation applies to displacement, not to the surface coordinates.
 w=1/length;adj=coo_matrix((np.r_[w,w],(np.r_[e[:,0],e[:,1]],np.r_[e[:,1],e[:,0]])),shape=(n,n)).tocsr()
 lap=diags(np.asarray(adj.sum(1)).ravel())-adj;free=np.flatnonzero(active&~fixed)
 d=known.copy();d[free]=spsolve(lap[free][:,free].tocsc(),-(lap[free]@known))
 out=np.zeros_like(x);out[:,0]=d;out[~active]=0
 # C1 support boundary; handles stay fixed inside the inner geodesic support.
 fade=np.clip((height*.04-distance)/(height*.015),0,1);fade=fade*fade*(3-2*fade);out*=fade[:,None]
 out[~np.isfinite(out)]=0
 return out[cohort],active[cohort],{'solve_vertices':int(active.sum()),'arm_handles':len(arm),'chest_handles':len(chest),
  'handle_policy':HANDLE_POLICY,'baseline_contact_pairs':len(pairs),'max_target_delta':float(np.linalg.norm(out,axis=1).max()),
  'handle_vertices':{'arm':first[arm].tolist(),'chest':first[chest].tolist()},
  'handle_world_delta_x':values.tolist(),'scope':'Authored sheet-side handles; actual contour must pass independently of contacts.'}

if __name__=='__main__':
 trial_root=Path(sys.argv[1]).resolve()
 trial.POLICY={**trial.POLICY,'version':'combined-left-shoulder-handles-v5','handles':HANDLE_POLICY,
  'shoulder_support':'Measured rest contact cohorts plus fixed 0.04H geodesic falloff; central chest, neck and distal elbow protected',
  'hip':'unchanged baseline','right_shoulder':'unchanged baseline'}
 trial.shoulder_field=handle_field
 trial.fair_patch=lambda r,p,e,c,h:(np.zeros_like(r),np.zeros(len(r),bool),{'solve_vertices':0,'scope':'Hip unchanged'})
 # The shared harness accepts empty zero-target masks without an inverse solve.
 trial.main(trial_root)
