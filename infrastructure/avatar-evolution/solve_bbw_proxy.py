"""Colab-only bounded BBW solve on a registered proxy; save weights for a later export review."""
import hashlib,json,os,sys,time
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
from review_generated_rig import load
from bbw_solver import solve_volume_weights

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    root=Path(sys.argv[1]).resolve()
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab required')
    p=json.loads((root/'plan.json').read_text())
    for n,h in p['files'].items():
        if sha(root/n)!=h:raise ValueError('Input changed: '+n)
    proxy=json.loads((root/'proxy-report.json').read_text())
    if proxy['status']!='proxy_ready_for_constraint_review' or proxy['proxy_artifact']['sha256']!=sha(root/'proxy-domain.npz'):
        raise ValueError('Verified proxy required')
    r={'id':p['id'],'method':'libigl-core-bone-volume-weights-v1','plan':p,'compute':'google',
        'source_sha256':proxy['source_sha256'],'rig_sha256':proxy['rig_sha256'],'proxy_id':proxy['id'],
        'publication_eligible':False,'qualification_complete':False,'candidate_available':False,'started_unix':time.time()}
    try:
        data=np.load(root/'proxy-domain.npz');v=data['vertices'];t=data['tetrahedra']
        rigs,_=load(root/'raw.glb');rig=rigs[0];h=proxy['proxy']['cell_size'];height=proxy['proxy']['body_height']
        # Body, clavicles and limb chains; fingers retain their original weights in any later candidate.
        names=['bone_'+str(i) for i in list(range(10))+list(range(25,29))+list(range(44,52))]
        tree=cKDTree(v);used=set();indices=[];values=[];constraints=[]
        for j,name in enumerate(names):
            b=rig.data.bones[name];a=np.array(rig.matrix_world@b.head_local)
            # glTF bone tails are Blender display constructs, not reliable joint endpoints.
            preferred={'bone_0':'bone_1','bone_3':'bone_4'}
            children=[rig.data.bones[preferred[name]]] if name in preferred else list(b.children)
            end=np.mean([np.array(rig.matrix_world@child.head_local) for child in children],axis=0) if children else a
            q=a*.5+end*.5;dist,ids=tree.query(q,k=32)
            selected=next((int(i) for i in ids if int(i) not in used),None)
            if selected is None:raise ValueError('Cannot assign unique volume constraint: '+name)
            d=float(np.linalg.norm(v[selected]-q))
            if d>height*.03:raise ValueError('Bone constraint exceeds fixed 3%-height distance: '+name)
            used.add(selected);indices.append(selected);row=np.zeros(len(names));row[j]=1;values.append(row)
            constraints.append({'bone':name,'node':selected,'target_world':q.tolist(),'node_world':v[selected].tolist(),'distance':d,'endpoint_method':'actual child joint head; branch mean; leaf head','endpoint_world':end.tolist()})
        r['constraints']=constraints;r['status']='constraints_ready'
        (root/'constraint-report.json').write_text(json.dumps(r,indent=2))
        w=solve_volume_weights(v,t,np.array(indices),np.array(values))
        body=np.einsum('ni,nij->nj',data['body_barycentric'],w[t[data['body_tetrahedra']]])
        if not np.isfinite(body).all() or body.min()<-1e-7 or not np.allclose(body.sum(axis=1),1,atol=1e-6):
            raise ValueError('Invalid body weights after tetrahedral interpolation')
        file=root/'body-weights.npz';np.savez_compressed(file,weights=body,bone_names=np.array(names),body_positions=data['body_positions'])
        r.update(status='weights_ready_for_export_review',weight_artifact={'sha256':sha(file),'bytes':file.stat().st_size},
            vertices=len(body),channels=len(names),minimum_weight=float(body.min()),max_normalization_error=float(np.abs(body.sum(axis=1)-1).max()),
            next_requirement='Review constraints and weight distribution, then create a separate bounded regional-weight candidate and verify unchanged body/skeleton and GLB playback. No candidate GLB or game animation exists yet.')
    except Exception as e:r.update(status='failed',error=f'{type(e).__name__}: {e}');raise
    finally:r['completed_unix']=time.time();(root/'report.json').write_text(json.dumps(r,indent=2))
    print(json.dumps({'id':r['id'],'status':r['status']}))
if __name__=='__main__':main()
