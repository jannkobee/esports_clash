"""Boundary-constrained contour fairing, followed by inverse-skin targets.

Uses a positive weighted graph squared-Laplacian energy, not libigl's FEM
biharmonic operator. Conceptual reference: https://libigl.github.io/tutorial/#biharmonic-surfaces
This edits a posed patch while fixing its surrounding surface; no anatomy claim.
"""
import numpy as np
from scipy.sparse import coo_matrix,diags,eye
from scipy.sparse.linalg import spsolve

POLICY={'version':'left-hip-collision-bounded-contour-v5','joint':'ThighL',
 'handle_offset_height':[0,-.05,-.01],'radii_height':[.075,.07,.12],
 'midline_guard_height':-.005,'boundary_fade_start':.65,'screen_strength':.00005,
 'protected_above_joint_height':.03,'upper_fade_height':.02,'tangent_fraction':1.0,
 'collision_backtracking_scales':[1,.5,.25,.125,.0625],
 'collision_check_degrees':[11.25,22.5,33.75,45,56.25,67.5,78.75,90],
 'max_rest_delta_height':.04,'max_posed_delta_height':.03,'max_inverse_condition':10,
 'authored_degrees':[45,90],'check_degrees':[22.5,45,67.5,90],
 'activation':'smoothstep interpolation of rest,45,90 targets',
 'scope':'Boundary-constrained contour target on the original mesh; visual and game gates remain required.'}

def blend(degrees):
    t=np.clip(degrees/45,0,2)
    if t<=1:return (float(t*t*(3-2*t)),0.)
    t-=1;t=t*t*(3-2*t);return (float(1-t),float(t))

def fair_patch(points,posed,edges,center,height):
    # Weld only numerical seam cohorts for solving; never replace source topology.
    _,first,cohort=np.unique(np.round(points,7),axis=0,return_index=True,return_inverse=True)
    x=points[first];p=posed[first];n=len(x)
    e=np.sort(cohort[edges],axis=1);e=np.unique(e[e[:,0]!=e[:,1]],axis=0)
    length=np.linalg.norm(x[e[:,0]]-x[e[:,1]],axis=1);e=e[length>height*1e-6];length=length[length>height*1e-6]
    w=1/length;a=coo_matrix((np.r_[w,w],(np.r_[e[:,0],e[:,1]],np.r_[e[:,1],e[:,0]])),shape=(n,n)).tocsr()
    degree=np.asarray(a.sum(1)).ravel();lap=eye(n,format='csr')-diags(1/np.maximum(degree,1e-20))@a
    rho=np.linalg.norm((x-(center+height*np.array(POLICY['handle_offset_height'])))/(height*np.array(POLICY['radii_height'])),axis=1)
    # The midline and all outside vertices are fixed to avoid moving the other leg.
    upper=center[2]+height*POLICY['protected_above_joint_height']
    active=(rho<1)&(x[:,0]<height*POLICY['midline_guard_height'])&(x[:,2]<upper);ids=np.flatnonzero(active)
    if len(ids)<20:raise ValueError('Contour patch too small')
    b=lap[:,ids];screen=POLICY['screen_strength']
    matrix=(b.T@b+eye(len(ids),format='csr')*screen).tocsc()
    rhs=-(b.T@(lap@p));solution=np.column_stack([spsolve(matrix,rhs[:,k]) for k in range(3)])
    # Restrict tangential sliding after the unconstrained contour proposal.
    # PCA normals are sign-independent for projection and share seam cohorts.
    for row,i in (enumerate(ids) if POLICY['tangent_fraction']<1 else []):
        neighbors=a.indices[a.indptr[i]:a.indptr[i+1]];vectors=p[neighbors]-p[i]
        _,basis=np.linalg.eigh(vectors.T@vectors);normal=basis[:,0]
        normal_delta=normal*np.dot(solution[row],normal)
        solution[row]=normal_delta+POLICY['tangent_fraction']*(solution[row]-normal_delta)
    # C2 fade into the fixed surrounding surface, with a separate midline fade.
    t=np.clip((1-rho[ids])/(1-POLICY['boundary_fade_start']),0,1);fade=t*t*t*(10+t*(-15+6*t))
    mid=np.clip((height*POLICY['midline_guard_height']-x[ids,0])/(height*.015),0,1);fade*=mid*mid*(3-2*mid)
    top=np.clip((upper-x[ids,2])/(height*POLICY['upper_fade_height']),0,1);fade*=top*top*(3-2*top)
    d=np.zeros_like(p);d[ids]=solution*fade[:,None]
    if not np.isfinite(d).all():raise ValueError('Nonfinite contour target')
    out=d[cohort]
    return out,active[cohort],{'solve_vertices':len(ids),'max_target_delta':float(np.linalg.norm(out,axis=1).max()),
      'screen_strength':screen,'boundary_fade_start':POLICY['boundary_fade_start'],
      'energy_before':float(np.sum((lap@p)**2)),'energy_after':float(np.sum((lap@(p+d))**2)),
      'protected_upper_max_delta':float(np.linalg.norm(d[x[:,2]>=upper],axis=1).max()),
      'scope':'Energy is a numerical smoothness measure, not visual qualification or a volume constraint.'}
