"""Colab-only closed voxel volume and exact tetrahedral correspondence experiment."""
import hashlib,itertools,json,os,sys,time
from pathlib import Path
from collections import defaultdict
import numpy as np
from scipy import ndimage
import igl
from review_generated_rig import load,surface

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    root=Path(sys.argv[1]).resolve()
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab required')
    p=json.loads((root/'plan.json').read_text())
    for n,h in p['files'].items():
        if digest(root/n)!=h:raise ValueError('Frozen input mismatch: '+n)
    r={'id':p['id'],'method':p['method'],'plan':p,'compute':'google','libigl_version':'2.6.3',
        'source_sha256':p['files']['source.glb'],'rig_sha256':p['files']['raw.glb'],
        'candidate_available':False,'publication_eligible':False,'qualification_complete':False,'started_unix':time.time()}
    try:
        _,meshes=load(root/'source.glb');v,f,_=surface(meshes);v=np.array(v);f=np.array(f,dtype=np.int64)
        height=float(np.ptp(v[:,2]));h=height/96;origin=np.floor(v.min(axis=0)/h)*h-2*h
        dims=np.ceil((v.max(axis=0)-origin)/h).astype(int)+2
        if p.get('proxy_mode')=='solid-envelope':
            import trimesh
            voxel=trimesh.Trimesh(vertices=v,faces=f,process=False).voxelized(h,method='subdivide')
            occupied=np.pad(voxel.matrix,2)
            # An explicit computational solidification, never applied to the visible asset.
            occupied=ndimage.binary_closing(occupied,ndimage.generate_binary_structure(3,1),iterations=1)
            occupied=ndimage.binary_fill_holes(occupied)
            origin=voxel.transform[:3,3]-2*h-h*.5
            r['domain_construction']='surface voxelization; one face-connected closing; interior fill; largest face-connected component'
        else:
            grid=np.indices(dims).reshape(3,-1).T;centers=origin+(grid+.5)*h
            winding=igl.fast_winding_number(v,f,centers)
            occupied=(np.abs(winding)>.5).reshape(tuple(dims))
        labels,count=ndimage.label(occupied,ndimage.generate_binary_structure(3,1))
        sizes=np.bincount(labels.ravel());sizes[0]=0;main_component=int(np.argmax(sizes))
        occupied=labels==main_component
        if p.get('regularize_empty_cells'):
            protected=set(map(tuple,np.floor((v-origin)/h).astype(int)))
            removed=[]
            # Remove only unprotected digital edge contacts. No body-containing cell may change.
            for iteration in range(4):
                changes=0
                for axis in range(3):
                    others=[a for a in range(3) if a!=axis]
                    shape=list(occupied.shape);shape[others[0]]-=1;shape[others[1]]-=1
                    for base in np.ndindex(tuple(shape)):
                        cells4=[]
                        for i,j in ((0,0),(0,1),(1,0),(1,1)):
                            c=list(base);c[others[0]]+=i;c[others[1]]+=j;cells4.append(tuple(c))
                        pattern=[bool(occupied[c]) for c in cells4]
                        if pattern not in ([True,False,False,True],[False,True,True,False]):continue
                        choices=[c for c,filled in zip(cells4,pattern) if filled and c not in protected]
                        if choices:
                            selected=min(choices);occupied[selected]=False;removed.append(selected);changes+=1
                            if len(removed)>8:raise ValueError('Digital-contact repair exceeds eight empty cells')
                if not changes:break
            r['empty_cells_removed_to_regularize']=removed
            if not all(occupied[c] for c in protected):raise ValueError('Proxy regularization changed a protected source cell')
        cells=np.argwhere(occupied);r['discarded_cells']=int(sizes.sum()-sizes[main_component])
        if len(cells)<10:raise ValueError('No credible body volume')
        node_index={};coords=[];tets=[];cell_tets={};perms=list(itertools.permutations(range(3)))
        def node(c):
            k=tuple(c)
            if k not in node_index:node_index[k]=len(coords);coords.append(c)
            return node_index[k]
        for c in cells:
            ids=[]
            for perm in perms:
                a=c.copy();corners=[node(a.copy())]
                for axis in perm:a[axis]+=1;corners.append(node(a.copy()))
                ids.append(len(tets));tets.append(corners)
            cell_tets[tuple(c)]=ids
        tv=origin+np.array(coords)*h;tt=np.array(tets,dtype=np.int64)
        signed=np.linalg.det(tv[tt[:,1:]]-tv[tt[:,0,None]])/6
        negative=signed<0;tt[negative,1],tt[negative,2]=tt[negative,2].copy(),tt[negative,1].copy()
        volume=np.linalg.det(tv[tt[:,1:]]-tv[tt[:,0,None]])/6
        if np.any(volume<=1e-14):raise ValueError('Degenerate tetrahedral proxy')
        face_owner=defaultdict(list)
        for i,t in enumerate(tt):
            for j in range(4):face_owner[tuple(sorted(np.delete(t,j)))].append(i)
        boundary=[face for face,owners in face_owner.items() if len(owners)==1]
        bf=np.array(boundary,dtype=np.int64);owners=np.array([face_owner[x][0] for x in boundary])
        edges=defaultdict(int)
        for tri in bf:
            for j in range(3):edges[tuple(sorted((int(tri[j]),int(tri[(j+1)%3]))))]+=1
        invalid_edges=sum(n!=2 for n in edges.values());vertex_manifold=bool(np.all(igl.is_vertex_manifold(bf)[np.unique(bf)]))
        boundary_centers=tv[bf].mean(axis=1)
        reverse_distance=np.sqrt(igl.point_mesh_squared_distance(boundary_centers,v,f)[0])
        rigs,meshes=load(root/'raw.glb');rig=rigs[0];points,_,_=surface(meshes);body=np.array(points)
        # Outside vertices are projected onto the actual volume boundary, not a nearest vertex.
        distance,face_ids,closest=igl.point_mesh_squared_distance(body,tv,bf)
        chosen=[];bary=[];mapped=[];inside_count=0
        for i,x in enumerate(body):
            cell=tuple(np.floor((x-origin)/h).astype(int));best=None
            if cell in cell_tets:
                for tid in cell_tets[cell]:
                    tet=tv[tt[tid]];q=np.linalg.solve((tet[1:]-tet[0]).T,x-tet[0]);weights=np.r_[1-q.sum(),q]
                    if weights.min()>=-1e-8:best=(tid,weights,x);inside_count+=1;break
            if best is None:
                tid=int(owners[face_ids[i]]);tet=tv[tt[tid]];q=np.linalg.solve((tet[1:]-tet[0]).T,closest[i]-tet[0]);weights=np.r_[1-q.sum(),q]
                best=(tid,weights,closest[i])
            chosen.append(best[0]);bary.append(best[1]);mapped.append(best[2])
        chosen=np.array(chosen);bary=np.array(bary);mapped=np.array(mapped)
        reconstructed=np.einsum('ni,nij->nj',bary,tv[tt[chosen]])
        error=np.linalg.norm(reconstructed-mapped,axis=1);projection=np.linalg.norm(body-mapped,axis=1)
        baseline=json.loads((root/'baseline-report.json').read_text());joint_regions={}
        for role in ('UpperArmL','UpperArmR','ThighL','ThighR'):
            center=np.array(rig.matrix_world@rig.data.bones[baseline['bone_map'][role]].head_local)
            mask=np.linalg.norm(body-center,axis=1)<height*.08
            joint_regions[role]={'vertices':int(mask.sum()),'max_transfer_distance':float(projection[mask].max()),'rms_transfer_distance':float(np.sqrt(np.mean(projection[mask]**2)))}
        blockers=[]
        if invalid_edges or not vertex_manifold:blockers.append('proxy_boundary_not_manifold')
        if error.max()>1e-8 or bary.min()<-1e-7:blockers.append('invalid_tetrahedral_correspondence')
        if projection.max()>height*.02:blockers.append('whole_body_transfer_exceeds_two_percent_height')
        if any(x['max_transfer_distance']>height*.01 for x in joint_regions.values()):blockers.append('joint_transfer_exceeds_one_percent_height')
        if reverse_distance.max()>2*h:blockers.append('proxy_boundary_deviates_over_two_cells_from_source')
        r.update(status='blocked_proxy' if blockers else 'proxy_ready_for_constraint_review',blockers=blockers,
            proxy={'cell_size':h,'body_height':height,'occupied_cells':len(cells),'nodes':len(tv),'tetrahedra':len(tt),
                'boundary_triangles':len(bf),'invalid_boundary_edges':invalid_edges,'vertex_manifold':vertex_manifold,
                'connected_occupied_components_before_selection':count,'inside_body_vertices':inside_count,
                'max_transfer_distance':float(projection.max()),'max_reconstruction_error':float(error.max()),'minimum_barycentric_weight':float(bary.min()),'joint_regions':joint_regions},
            next_requirement='Review proxy geometry and anatomical bone constraints before BBW solve. This correspondence does not establish acceptable skinning or gameplay deformation.')
        output=root/'proxy-domain.npz';np.savez_compressed(output,vertices=tv,tetrahedra=tt,boundary_faces=bf,body_tetrahedra=chosen,body_barycentric=bary,body_positions=body)
        r['proxy']['max_proxy_boundary_distance_to_source']=float(reverse_distance.max())
        r['proxy_artifact']={'sha256':digest(output),'bytes':output.stat().st_size}
    except Exception as e:r.update(status='failed',error=f'{type(e).__name__}: {e}');raise
    finally:r['completed_unix']=time.time();(root/'report.json').write_text(json.dumps(r,indent=2))
    print(json.dumps({'id':r['id'],'status':r['status'],'proxy':r['proxy']}))
if __name__=='__main__':main()
