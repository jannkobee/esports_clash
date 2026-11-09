"""Colab-only sparse representation trial; no publication or visual-pass claim."""
import hashlib,json,os,sys,time
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from review_generated_rig import load,surface
from review_combined_joint_candidate import reset_pose
from joint_pose_contract import apply_pose
from hip_contour_field import blend
from sparse_pose_fit import fit_four
from mesh_validation import collision_summary,rest_keys

root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
    raise RuntimeError('Colab required')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
r={'method':'current-contour-four-influence-preflight-v1','compute':'google','publication_eligible':False,
   'qualification_complete':False,'candidate_available':False,'started_unix':time.time()}
try:
    plan=json.loads((root/'plan.json').read_text())
    for n,h in plan['files'].items():
        if sha(root/n)!=h:raise ValueError('Frozen input changed: '+n)
    if sha(root/'approved/visual-report.json')!='566772b8cfdc8b1caf3e514748624cd60a0bed46acad760b4adb1e91d2036b26':raise ValueError('Wrong contour review')
    report=json.loads((root/'approved/visual-report.json').read_text())
    # The renderer retains the numerical report separately; the exact artifact
    # digest is also frozen by the external input manifest.
    r.update(parent_review_id=plan['id'],raw_sha256=sha(root/'raw.glb'),weight_sha256=sha(root/'bounded-weights.npz'),
             corrective_sha256=sha(root/'approved/hip-sculpt.npz'))
    rigs,meshes=load(root/'raw.glb')
    if len(rigs)!=1 or len(meshes)!=1:raise ValueError('Unexpected avatar objects')
    rig=rigs[0];rig.animation_data_clear();points,faces,regions=surface(meshes);points=np.array(points)
    data=np.load(root/'bounded-weights.npz');sculpt=np.load(root/'approved/hip-sculpt.npz')
    names=[b.name for b in rig.data.bones];weights=data['weights'];height=float(np.ptp(points[:,2]))
    if list(data['bone_names'])!=names or len(names)!=52:raise ValueError('Skeleton mismatch')
    if not np.allclose(points,data['body_positions'],atol=1e-8,rtol=0) or not np.array_equal(points,sculpt['rest_positions']):raise ValueError('Body mismatch')
    mapping=json.loads((root/'baseline-report.json').read_text())['bone_map'];inv=rig.matrix_world.inverted()
    train=[(a,'world_target') for a in (15,30,45,60,75,90)]+[(a,'coordinated') for a in (30,60,90)]
    held=[(a,'world_target') for a in (11.25,22.5,33.75,56.25,67.5,78.75)]+[(a,'coordinated') for a in (22.5,45,67.5)]
    ids=np.flatnonzero(np.count_nonzero(weights>0,axis=1)>4);pool=np.argsort(-weights[ids],axis=1)[:,:12]
    fitted=weights.copy();keys=rest_keys([Vector(p) for p in points])
    def feature(angle,mode):
        apply_pose(rig,mapping,'ThighL',angle,mode)
        m=np.array([rig.matrix_world@rig.pose.bones[n].matrix@rig.data.bones[n].matrix_local.inverted()@inv for n in names])[:,:3,:]
        a,b=blend(angle);q=points+a*sculpt['rest_delta_45']+b*sculpt['rest_delta_90']
        return np.einsum('bxy,ny->nbx',m,np.c_[q,np.ones(len(q))])
    features=np.concatenate([(feature(a,m)[ids]-points[ids,None,:]).transpose(0,2,1) for a,m in train],axis=1)
    target=np.einsum('ndb,nb->nd',features,weights[ids]);limited=np.take_along_axis(features,pool[:,None,:],axis=2)
    prior=np.take_along_axis(weights[ids],pool,axis=1);fitted[ids]=0
    for start in range(0,len(ids),128):
        stop=min(start+128,len(ids));w=fit_four(limited[start:stop],target[start:stop],prior[start:stop],height)
        fitted[ids[start:stop,None],pool[start:stop]]=w
        print('fitted',stop,len(ids),flush=True)
    del features,limited,target
    r.update(fitted_vertices=len(ids),bones=len(names),vertices=len(points),training=train,heldout=held,checks=[])
    for angle,mode in train+held:
        f=feature(angle,mode);dense=np.einsum('nbx,nb->nx',f,weights);sparse=np.einsum('nbx,nb->nx',f,fitted)
        error=np.linalg.norm(sparse-dense,axis=1);movement=np.linalg.norm(dense-points,axis=1)
        row={'degrees':angle,'mode':mode,'heldout':(angle,mode) in held,'max_error':float(error.max()),
             'rms_error':float(np.sqrt(np.mean(error**2))),'max_relative_error':float((error/np.maximum(movement,height*.01)).max())}
        for label,q in [('dense',dense),('fitted',sparse)]:
            row[label+'_intersections']=collision_summary([Vector(p) for p in q],faces,keys,regions)['self_intersections']
        r['checks'].append(row);print(row,flush=True)
    r['limits']={'max_error_height':.002,'rms_error_height':.0005,'max_relative_error':.05,'max_influences':4}
    passed=all(c['max_error']<=height*.002 and c['rms_error']<=height*.0005 and c['max_relative_error']<=.05 and c['fitted_intersections']==0 for c in r['checks'])
    out=root/'current-four-weights.npz';np.savez_compressed(out,weights=fitted,bone_names=names,body_positions=points)
    r.update(status='ready_for_export_experiment' if passed else 'blocked_sparse_representation',artifact_sha256=sha(out),
             max_influences=int(np.count_nonzero(fitted>0,axis=1).max()),scope='Left-hip diagnostic only; no twist, full-body, exported animation or visual qualification.')
except Exception as e:
    r.update(status='failed',error=str(e));raise
finally:
    r['completed_unix']=time.time();(root/'sparse-preflight-report.json').write_text(json.dumps(r,indent=2))
