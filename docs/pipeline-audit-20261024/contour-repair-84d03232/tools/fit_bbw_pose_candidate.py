"""Colab-only four-support fitting to a dense BBW deformation field."""
import hashlib,json,os,sys,time
from pathlib import Path
import bpy
import numpy as np
from mathutils import Quaternion,Vector
from sparse_pose_fit import fit_four
from review_generated_rig import load,surface
from review_combined_joint_candidate import reset_pose,measure_bends,export_selected,surface_transfer,TARGETS

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    root=Path(sys.argv[1]).resolve()
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Google Colab required')
    plan=json.loads((root/'plan.json').read_text())
    for n,h in plan['files'].items():
        if sha(root/n)!=h:raise ValueError('Frozen input mismatch: '+n)
    weights_report=json.loads((root/'weight-report.json').read_text());baseline=json.loads((root/'baseline-report.json').read_text())
    r={'id':plan['id'],'method':'pose-fitted-four-influence-bbw-v1','plan':plan,'compute':'google',
        'source_sha256':weights_report['source_sha256'],'rig_sha256':weights_report['rig_sha256'],
        'weight_solve_id':weights_report['id'],'candidate_available':False,'publication_eligible':False,'qualification_complete':False,'started_unix':time.time()}
    try:
        if weights_report['status']!='weights_ready_for_export_review' or sha(root/'body-weights.npz')!=weights_report['weight_artifact']['sha256']:raise ValueError('Wrong body weights')
        rigs,meshes=load(root/'raw.glb');rig=rigs[0];rig.animation_data_clear()
        if len(meshes)!=1:raise ValueError('Expected one raw body mesh')
        obj=meshes[0];before,faces,_=surface(meshes);before=np.array(before);data=np.load(root/'body-weights.npz');height=float(np.ptp(before[:,2]));mapping=baseline['bone_map']
        if len(before)!=len(data['weights']) or np.max(np.linalg.norm(before-data['body_positions'],axis=1))>1e-8:raise ValueError('Body correspondence changed')
        names=[b.name for b in rig.data.bones];lookup={n:i for i,n in enumerate(names)}
        bases={b.name:b.matrix_basis.copy() for b in rig.pose.bones};rest_matrices={b.name:np.array(b.matrix_local) for b in rig.data.bones};local=np.array([v.co[:] for v in obj.data.vertices])
        old=np.zeros((len(before),len(names)))
        for i,v in enumerate(obj.data.vertices):
            for g in v.groups:
                name=obj.vertex_groups[g.group].name
                if name in lookup:old[i,lookup[name]]=g.weight
        old/=old.sum(axis=1,keepdims=True)
        centers=np.array([rig.matrix_world@rig.data.bones[mapping[x]].head_local for x in ('UpperArmL','UpperArmR','ThighL','ThighR')])
        distance=np.linalg.norm(before[:,None,:]-centers[None,:,:],axis=2).min(axis=1);x=np.clip((height*.08-distance)/(height*.02),0,1);alpha=x*x*(3-2*x);ids=np.flatnonzero(alpha>0)
        dense=old[ids]*(1-alpha[ids,None])
        for j,n in enumerate(data['bone_names']):dense[:,lookup[str(n)]]+=alpha[ids]*data['weights'][ids,j]
        dense/=dense.sum(axis=1,keepdims=True)
        pool=np.argsort(-dense,axis=1)[:,:12];prior=np.take_along_axis(dense,pool,axis=1)
        axes={}
        for role,child in TARGETS.items():
            bone=rig.data.bones[mapping[role]];a=rig.matrix_world@bone.head_local;b=rig.matrix_world@rig.data.bones[mapping[child]].head_local;direction=(b-a).normalized()
            desired=Vector((0,1 if role.startswith('Calf') else -1,0));inv=bone.matrix_local.to_3x3().inverted()@rig.matrix_world.to_3x3().inverted()
            axes[(role,'bend')]=(inv@direction.cross(desired)).normalized();axes[(role,'twist')]=(inv@direction).normalized()
        training=[[(role,angle,'bend')] for role in TARGETS for angle in (15,45,90)]
        training += [[(role,angle,'twist')] for role in ('UpperArmL','UpperArmR','ThighL','ThighR') for angle in (-30,30)]
        training += [[('ThighL',45,'bend'),('ThighR',45,'bend'),('CalfL',60,'bend'),('CalfR',60,'bend')],[('UpperArmL',45,'bend'),('UpperArmR',45,'bend')]]
        heldout=[[(role,angle,'bend')] for role in TARGETS for angle in (22.5,67.5)]
        heldout += [[(role,angle,'twist')] for role in ('UpperArmL','UpperArmR','ThighL','ThighR') for angle in (-15,15)]
        heldout += [[('ThighL',60,'bend'),('ThighR',60,'bend'),('CalfL',75,'bend'),('CalfR',75,'bend')],[('UpperArmL',67.5,'bend'),('UpperArmR',22.5,'bend'),('ThighL',45,'bend')]]
        r['pose_contract']={'training':training,'heldout':heldout,'scope':'Controlled nominal joint bends and twists; not game animations or anatomically matched comparisons between different rigs.'}
        points=before[ids];hom=np.c_[points,np.ones(len(ids))];inv_world=rig.matrix_world.inverted()
        def features(cases,check=False):
            result=[];max_check=0.
            for index,case in enumerate(cases):
                reset_pose(rig)
                for role,degrees,kind in case:
                    b=rig.pose.bones[mapping[role]];b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion(axes[(role,kind)],np.deg2rad(degrees))
                bpy.context.view_layer.update()
                matrix=np.array([rig.matrix_world@rig.pose.bones[n].matrix@rig.data.bones[n].matrix_local.inverted()@inv_world for n in names])[:,:3,:]
                moved=np.einsum('bxy,ny->nbx',matrix,hom)-points[:,None,:]
                if check and index in (0,len(cases)-1):
                    actual=np.array(surface(meshes)[0])[ids];pred=points+np.einsum('nbx,nb->nx',moved,old[ids]);max_check=max(max_check,float(np.linalg.norm(actual-pred,axis=1).max()))
                result.append(moved.transpose(0,2,1))
            if max_check>height*1e-6:raise ValueError('Skinning matrix evaluation disagrees with Blender')
            r['matrix_blender_max_error']=max(r.get('matrix_blender_max_error',0),max_check)
            return np.concatenate(result,axis=1)
        full=features(training,True);target=np.einsum('ndb,nb->nd',full,dense);limited=np.take_along_axis(full,pool[:,None,:],axis=2)
        fitted_pool=np.zeros_like(prior)
        for start in range(0,len(ids),256):
            end=min(start+256,len(ids));fitted_pool[start:end]=fit_four(limited[start:end],target[start:end],prior[start:end],height)
            (root/'progress.json').write_text(json.dumps({'stage':'fitting','vertices':end,'total':len(ids)}))
        fitted=np.zeros_like(dense);fitted[np.arange(len(ids))[:,None],pool]=fitted_pool
        def error_stats(f,target,w):
            error=(np.einsum('ndb,nb->nd',f,w)-target).reshape(len(ids),-1,3);distance=np.linalg.norm(error,axis=2)
            movement=np.linalg.norm(target.reshape(len(ids),-1,3),axis=2);relative=distance/np.maximum(movement,height*.01)
            return {'max_error':float(distance.max()),'rms_error':float(np.sqrt(np.mean(distance**2))),'max_relative_error':float(relative.max())}
        r['training_error']=error_stats(full,target,fitted)
        del full,limited,target
        validation=features(heldout,True);target=np.einsum('ndb,nb->nd',validation,dense);r['heldout_error']=error_stats(validation,target,fitted)
        r['limits']={'max_error_height_fraction':.002,'rms_error_height_fraction':.0005,'max_relative_error':.05,'relative_denominator_floor_height_fraction':.01,'max_influences':4}
        r['fit']={'vertices':len(ids),'max_influences':int(np.count_nonzero(fitted>1e-8,axis=1).max()),'max_weight_l1_difference':float(np.abs(fitted-dense).sum(axis=1).max()),'max_normalization_error':float(np.abs(fitted.sum(axis=1)-1).max()),'algorithm':'greedy support selection among twelve channels; active-subset simplex least squares; no global-optimum claim'}
        if any(e['max_error']>height*.002 or e['rms_error']>height*.0005 or e['max_relative_error']>.05 for e in (r['training_error'],r['heldout_error'])):
            r.update(status='blocked_deformation_error',next_requirement='The four-support fit does not preserve the dense deformation within the frozen motion-error contract. No candidate exported.');return
        for b in rig.pose.bones:b.matrix_basis=bases[b.name]
        for row,i in enumerate(ids):
            for group in obj.vertex_groups:group.remove([int(i)])
            for j in np.flatnonzero(fitted[row]>0):
                group=obj.vertex_groups.get(names[j]) or obj.vertex_groups.new(name=names[j]);group.add([int(i)],float(fitted[row,j]),'REPLACE')
        if not np.array_equal(local,np.array([v.co[:] for v in obj.data.vertices])):raise ValueError('Body vertices changed')
        if any(not np.array_equal(rest_matrices[b.name],np.array(b.matrix_local)) for b in rig.data.bones):raise ValueError('Joint rest transforms changed')
        out=root/'four-fit-candidate.glb';export_selected(rig,meshes,out);rigs,meshes=load(out);rig=rigs[0];reset_pose(rig);rest,_,_=surface(meshes)
        r['rest_surface_roundtrip']=surface_transfer(before,rest)
        if r['rest_surface_roundtrip']['max_nearest_distance']>1e-6:raise ValueError('Export rest surface changed')
        r['reloaded_poses']=[];measure_bends(rig,meshes,mapping,list(TARGETS),r['reloaded_poses'])
        r.update(status='review_required',candidate_available=True,artifact={'sha256':sha(out),'bytes':out.stat().st_size},scope='Four-support pose fit to regional BBW field on the fixed raw body and joints. Numerical representation only; visual review and game animation remain unqualified.')
    except Exception as e:r.update(status='failed',error=f'{type(e).__name__}: {e}');raise
    finally:r['completed_unix']=time.time();(root/'report.json').write_text(json.dumps(r,indent=2))
    print(json.dumps({'id':r['id'],'status':r['status']}))
if __name__=='__main__':main()
