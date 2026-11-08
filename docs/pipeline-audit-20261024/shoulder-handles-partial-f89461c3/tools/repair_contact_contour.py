"""Colab fixed-budget triangle separation trial on the exact exported body.

Different hypothesis from curvature fairing: distribute minimum separating-plane
translations of actual nonadjacent intersecting triangles, diffuse on the rest
graph, and retain the lowest measured-contact iterate under fixed bounds.
"""
import sys,os,json
from pathlib import Path
import numpy as np
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from scipy.sparse import coo_matrix,diags
import repair_combined_contour as trial
from review_generated_rig import surface
from mesh_validation import rest_keys

def contacts(points,faces,keys):
    order=sorted(range(len(faces)),key=lambda i:tuple(sorted(keys[n] for n in faces[i])))
    f=[tuple(sorted(faces[i],key=lambda n:keys[n])) for i in order];adj=[set(keys[i] for i in t) for t in f]
    trees=[BVHTree.FromPolygons([Vector(p) for p in points],t,all_triangles=True) for t in [f,[tuple(reversed(t)) for t in f],[(t[1],t[2],t[0]) for t in f]]]
    pairs=set()
    for a,b in [(0,0),(1,1),(2,2),(0,1),(0,2)]:
        for x,y in trees[a].overlap(trees[b]):
            if x!=y and not adj[x].intersection(adj[y]):pairs.add((min(x,y),max(x,y)))
    return np.array(f,dtype=int),sorted(pairs)

def separate(rest,posed,edges,center,height,hip=False):
    obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');_,faces,_=surface([obj]);keys=rest_keys([Vector(p) for p in rest])
    _,first,cohort=np.unique(np.round(rest,7),axis=0,return_index=True,return_inverse=True);x=rest[first];n=len(x)
    e=np.sort(cohort[edges],axis=1);e=np.unique(e[e[:,0]!=e[:,1]],axis=0)
    lengths=np.linalg.norm(x[e[:,0]]-x[e[:,1]],axis=1);keep=lengths>height*1e-6;e=e[keep];w=1/lengths[keep]
    adj=coo_matrix((np.r_[w,w],(np.r_[e[:,0],e[:,1]],np.r_[e[:,1],e[:,0]])),shape=(n,n)).tocsr();adj=diags(1/np.maximum(np.asarray(adj.sum(1)).ravel(),1e-30))@adj
    if hip:
        rho=np.linalg.norm((x-(center+height*np.array([0,-.05,-.01])))/(height*np.array([.075,.07,.12])),axis=1)
        active=(rho<1)&(x[:,0]<-height*.005)&(x[:,2]<center[2]+height*.03)
        top=np.clip((center[2]+height*.03-x[:,2])/(height*.02),0,1);guard=top*top*(3-2*top)
        mid=np.clip((-height*.005-x[:,0])/(height*.015),0,1);guard*=mid*mid*(3-2*mid)
        cap=height*.008
    else:
        rho=np.linalg.norm((x-(center+height*np.array([0,0,-.025])))/(height*np.array([.085,.065,.10])),axis=1)
        active=(rho<1)&(abs(x[:,0])>height*.045)
        mid=np.clip((abs(x[:,0])-height*.045)/(height*.015),0,1);guard=mid*mid*(3-2*mid);cap=height*.02
    t=np.clip((1-rho)/.35,0,1);fade=t*t*t*(10+t*(-15+6*t))*guard*active
    # Mobility follows the actual limb weighting; chest vertices are anchors.
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mapping=json.loads((trial_root/'baseline-report.json').read_text())['bone_map']
    role='ThighL' if hip else ('UpperArmL' if center[0]<0 else 'UpperArmR');bone=rig.data.bones[mapping[role]]
    moving={bone.name,*[b.name for b in bone.children_recursive]};mass=np.zeros(len(rest))
    for v in obj.data.vertices:mass[v.index]=sum(g.weight for g in v.groups if obj.vertex_groups[g.group].name in moving)
    # Both surfaces can move for same-region folds, while stiff torso stays anchored.
    mobility=fade*np.clip(mass[first]*2,0,1)
    p=posed.copy();d=np.zeros((n,3));best=d.copy();f,pairs=contacts(p,faces,keys);initial=len(pairs);bestcount=initial;history=[]
    for step in range(32):
        push=np.zeros((n,3));count=np.zeros(n)
        for ia,ib in pairs:
            va=f[ia];vb=f[ib];a=p[va];b=p[vb];ca=cohort[va];cb=cohort[vb];ma=mobility[ca];mb=mobility[cb]
            total=ma.mean()+mb.mean()
            if total<1e-8:continue
            na=np.cross(a[1]-a[0],a[2]-a[0]);nb=np.cross(b[1]-b[0],b[2]-b[0]);diff=a.mean(0)-b.mean(0)
            choices=[]
            for axis in (na,nb,diff):
                norm=np.linalg.norm(axis)
                if norm<1e-14:continue
                axis=axis/norm;aa=a@axis;bb=b@axis
                left=aa.max()-bb.min()+height*2e-5;right=bb.max()-aa.min()+height*2e-5
                choices.extend([(left,-axis),(right,axis)])
            choices=[c for c in choices if c[0]>0]
            if not choices:continue
            distance,axis=min(choices,key=lambda c:c[0]);shift=axis*min(distance*1.05,height*.002)
            for ids,m,sign in ((ca,ma,1),(cb,mb,-1)):
                np.add.at(push,ids,sign*shift[None,:]*(m/total)[:,None]);np.add.at(count,ids,(m>0).astype(float))
        update=push/np.maximum(count,1)[:,None];d+=update
        # Fixed graph diffusion distributes constraints without flattening the root.
        d=(.9*d+.1*(adj@d))*active[:,None]
        norm=np.linalg.norm(d,axis=1);d*=np.minimum(1,cap*fade/np.maximum(norm,1e-30))[:,None]
        p=posed+d[cohort];f,pairs=contacts(p,faces,keys);history.append({'iteration':step+1,'contacts':len(pairs),'max_delta':float(np.linalg.norm(d,axis=1).max())})
        if len(pairs)<bestcount:best=d.copy();bestcount=len(pairs)
        print('separation',role,step+1,len(pairs),flush=True)
        if not pairs:break
    return best[cohort],active[cohort],{'solve_vertices':int(active.sum()),'initial_contacts':initial,'selected_contacts':bestcount,'iterations':history,
       'max_target_delta':float(np.linalg.norm(best,axis=1).max()),'protected_upper_max_delta':float(np.linalg.norm(best[x[:,2]>=center[2]+height*.03],axis=1).max()) if hip else 0,
       'scope':'Minimum-separating-plane constraints; contact reduction is not visual qualification.'}

if __name__=='__main__':
    trial_root=Path(sys.argv[1]).resolve()
    trial.POLICY={**trial.POLICY,'version':'combined-contact-separation-v2','solver_iterations':32,'hip_extra_posed_cap_height':.008,
       'selection':'Lowest full-surface contact count iterate, retaining baseline on ties','screen':'No curvature flattening; fixed .1 rest-graph diffusion'}
    trial.shoulder_field=lambda r,p,e,c,h:separate(r,p,e,c,h)
    trial.fair_patch=lambda r,p,e,c,h:separate(r,p,e,c,h,True)
    trial.main(trial_root)
