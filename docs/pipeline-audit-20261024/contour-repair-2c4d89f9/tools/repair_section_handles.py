"""Colab shape-preserving whole-arm-section translation, original skin intact.

The prior sheet-plane constraint flattened/pinched the medial arm. These
anatomical handles translate complete proximal cross-sections instead; no
contact point is projected to a plane and no surface fairing is performed.
"""
import sys,json
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
import repair_combined_contour as trial
from repair_contact_contour import contacts
from review_generated_rig import surface
from mesh_validation import rest_keys
from evaluated_points import world_points

def smooth(t):
 t=np.clip(t,0,1);return t*t*t*(10+t*(-15+6*t))

def section_field(rest,posed,edges,center,height):
 if center[0]>0:return np.zeros_like(rest),np.zeros(len(rest),bool),{'solve_vertices':0,'scope':'Unchanged right control'}
 obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 mapping=json.loads((trial_root/'baseline-report.json').read_text())['bone_map'];bone=rig.data.bones[mapping['UpperArmL']]
 moving={bone.name,*[b.name for b in bone.children_recursive]};names=[b.name for b in rig.data.bones];weights=np.zeros((len(rest),len(names)))
 for v in obj.data.vertices:
  for g in v.groups:weights[v.index,names.index(obj.vertex_groups[g.group].name)]=g.weight
 mass=weights[:,[names.index(n) for n in moving]].sum(1)
 _,faces,_=surface([obj]);f,pairs=contacts(posed,faces,rest_keys([Vector(p) for p in rest]));seeds=np.unique(f[np.array(pairs).ravel()].ravel())
 arm=seeds[mass[seeds]>=.55];chest=seeds[mass[seeds]<=.35]
 if not len(arm) or not len(chest):raise ValueError('Expected arm/chest contact groups')
 elbow=np.array(rig.matrix_world@rig.data.bones[mapping['ForearmL']].head_local);axis=elbow-center;length=np.linalg.norm(axis);axis/=length
 along=(rest-center)@axis
 # Whole section envelope; the cross-section is translated with its radius intact.
 envelope=smooth(along/(length*.25))*(1-smooth((along-length*.70)/(length*.30)))
 arm_field=envelope*smooth((mass-.25)/.50)
 amount=min(height*.018,max(0,float(np.quantile(posed[arm,0],.95))-(center[0]-height*.004)))
 # Separate chest compression is a coherent displacement with geodesic fade.
 _,first,cohort=np.unique(np.round(rest,7),axis=0,return_index=True,return_inverse=True);x=rest[first]
 e=np.sort(cohort[edges],axis=1);e=np.unique(e[e[:,0]!=e[:,1]],axis=0);dl=np.linalg.norm(x[e[:,0]]-x[e[:,1]],axis=1);keep=dl>height*1e-6;e=e[keep];dl=dl[keep]
 graph=coo_matrix((np.r_[dl,dl],(np.r_[e[:,0],e[:,1]],np.r_[e[:,1],e[:,0]])),shape=(len(x),len(x))).tocsr()
 dist=dijkstra(graph,directed=False,indices=np.unique(cohort[chest]),min_only=True,limit=height*.04)[cohort]
 chest_field=smooth((height*.04-dist)/(height*.03))*(1-smooth((mass-.15)/.35))
 medial=smooth((-height*.045-rest[:,0])/(height*.015));upper=1-smooth((rest[:,2]-center[2])/(height*.03))
 chest_amount=min(height*.01,max(0,(center[0]+height*.004)-float(np.quantile(posed[chest,0],.05))))
 wanted=np.zeros_like(rest);wanted[:,0]=(-amount*arm_field+chest_amount*chest_field)*medial*upper
 wanted[~np.isfinite(wanted)]=0
 # One global scale enforces BOTH frozen spaces without per-vertex clipping,
 # preserving coherent cross-section translations and smooth transitions.
 inv=rig.matrix_world.inverted();m=np.einsum('nb,bxy->nxy',weights,np.array([rig.matrix_world@rig.pose.bones[n].matrix@rig.data.bones[n].matrix_local.inverted()@inv for n in names])[:,:3,:3])
 active=np.linalg.norm(wanted,axis=1)>1e-12;delta=np.linalg.solve(m[active],wanted[active,:,None])[:,:,0]
 maximum=max(float(np.linalg.norm(delta,axis=1).max()),float(np.linalg.norm(wanted,axis=1).max()));scale=min(1,height*.02/max(maximum,1e-30));wanted*=scale
 return wanted,active,{'solve_vertices':int(active.sum()),'arm_handles':len(arm),'chest_handles':len(chest),
  'section_translation':amount,'chest_translation':chest_amount,'global_frozen_cap_scale':scale,
  'max_target_delta':float(np.linalg.norm(wanted,axis=1).max()),'arm_handle_indices':arm.tolist(),'chest_handle_indices':chest.tolist(),
  'scope':'Whole proximal-arm-section translation with separate coherent chest compression; no per-point flattening, volume inflation, bone or weight change.'}

if __name__=='__main__':
 trial_root=Path(sys.argv[1]).resolve()
 trial.POLICY={**trial.POLICY,'version':'combined-left-section-handles-v6',
  'section_handle_policy':{'arm_mass_support':[.25,.75],'arm_axial_envelope':[0,.25,.70,1.0],'max_arm_handle_height':.018,'max_chest_handle_height':.01,'chest_rest_geodesic_support_height':.04,'cap':'one global scale in both rest and posed spaces'},
  'hip':'unchanged baseline','right_shoulder':'unchanged baseline'}
 trial.shoulder_field=section_field;trial.fair_patch=lambda r,p,e,c,h:(np.zeros_like(r),np.zeros(len(r),bool),{'solve_vertices':0,'scope':'Hip unchanged'})
 original_surface=trial.surface;topology={}
 def cached_surface(meshes):
  identity=tuple(o.as_pointer() for o in meshes)
  if identity not in topology:
   points,faces,regions=original_surface(meshes)
   if not np.array_equal(np.array(points),world_points(meshes)):raise ValueError('Cached point evaluator mismatch')
   if any(len(p.vertices)!=3 for o in meshes for p in o.data.polygons):raise ValueError('Triangle topology required')
   topology[identity]=(faces,regions)
   return points,faces,regions
  faces,regions=topology[identity];return [Vector(p) for p in world_points(meshes)],faces,regions
 trial.surface=cached_surface
 trial.main(trial_root)
