"""Colab-only regional adoption of solved BBW weights; fixed raw body and skeleton."""
import hashlib,json,os,sys,time
from pathlib import Path
import bpy
import numpy as np
from review_generated_rig import load,surface
from review_combined_joint_candidate import reset_pose,measure_bends,export_selected,surface_transfer,TARGETS

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    root=Path(sys.argv[1]).resolve()
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab required')
    p=json.loads((root/'plan.json').read_text())
    for n,h in p['files'].items():
        if sha(root/n)!=h:raise ValueError('Input changed: '+n)
    solve=json.loads((root/'weight-report.json').read_text());baseline=json.loads((root/'baseline-report.json').read_text())
    if solve['status']!='weights_ready_for_export_review' or sha(root/'body-weights.npz')!=solve['weight_artifact']['sha256']:
        raise ValueError('Verified body weights required')
    r={'id':p['id'],'method':'regional-volume-bbw-candidate-v1','plan':p,'compute':'google',
        'source_sha256':solve['source_sha256'],'rig_sha256':solve['rig_sha256'],'weight_solve_id':solve['id'],
        'publication_eligible':False,'qualification_complete':False,'candidate_available':False,'started_unix':time.time()}
    try:
        rigs,meshes=load(root/'raw.glb');rig=rigs[0];rig.animation_data_clear()
        if len(meshes)!=1:raise ValueError('Expected one body mesh')
        obj=meshes[0];before,faces,_=surface(meshes);before=np.array(before)
        data=np.load(root/'body-weights.npz');w=data['weights'];names=list(data['bone_names']);mapping=baseline['bone_map']
        if len(w)!=len(before) or np.max(np.linalg.norm(before-data['body_positions'],axis=1))>1e-8:
            raise ValueError('Weight/body correspondence mismatch')
        matrices={b.name:np.array(b.matrix_local) for b in rig.data.bones};height=float(np.ptp(before[:,2]))
        centers=np.array([rig.matrix_world@rig.data.bones[mapping[role]].head_local for role in ('UpperArmL','UpperArmR','ThighL','ThighR')])
        distance=np.linalg.norm(before[:,None,:]-centers[None,:,:],axis=2).min(axis=1)
        x=np.clip((height*.08-distance)/(height*.02),0,1);alpha=x*x*(3-2*x)
        edits=[];loss=[]
        for i,a in enumerate(alpha):
            if a<=0:continue
            old={obj.vertex_groups[g.group].name:float(g.weight) for g in obj.data.vertices[i].groups if g.weight>0}
            mixed={n:(1-a)*value for n,value in old.items()}
            for j,n in enumerate(names):mixed[n]=mixed.get(n,0)+a*float(w[i,j])
            ordered=sorted(mixed.items(),key=lambda item:-item[1]);discarded=sum(value for _,value in ordered[4:]);loss.append(discarded)
            keep=ordered[:4];total=sum(value for _,value in keep)
            if total<=0:raise ValueError('Empty candidate weight row')
            edits.append((i,[(n,value/total) for n,value in keep]))
        r['weight_changes']={'modified_vertices':len(edits),'max_discarded_mass_to_four_influences':float(max(loss,default=0)),
            'rms_discarded_mass':float(np.sqrt(np.mean(np.square(loss)))),'sphere_radius_height_fraction':.08,'full_strength_radius_height_fraction':.06}
        if max(loss,default=0)>.05:
            r.update(status='blocked_influence_budget',next_requirement='The solved weights exceed the fixed 5% discarded-mass budget for four influences. Review representation or constraints; no truncated candidate exported.');return
        for i,row in edits:
            for group in obj.vertex_groups:group.remove([i])
            for name,value in row:
                group=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name);group.add([i],value,'REPLACE')
        after,afterfaces,_=surface(meshes)
        if afterfaces!=faces or np.max(np.linalg.norm(np.array(after)-before,axis=1))>1e-10:raise ValueError('Weights changed the rest body')
        for b in rig.data.bones:
            if not np.array_equal(matrices[b.name],np.array(b.matrix_local)):raise ValueError('Candidate changed joint matrix')
        out=root/'bbw-candidate.glb';export_selected(rig,meshes,out)
        rigs,meshes=load(out);rig=rigs[0];reset_pose(rig);rest,_,_=surface(meshes)
        r['rest_surface_roundtrip']=surface_transfer(before,rest)
        if r['rest_surface_roundtrip']['max_nearest_distance']>1e-6:raise ValueError('Export changed the rest surface beyond tolerance')
        r['reloaded_poses']=[];measure_bends(rig,meshes,mapping,list(TARGETS),r['reloaded_poses'])
        r.update(status='review_required',candidate_available=True,artifact={'sha256':sha(out),'bytes':out.stat().st_size},
            scope='Four bounded shoulder/hip weight regions on the unchanged raw body/joints. No game clips or visual qualification.')
    except Exception as e:r.update(status='failed',error=f'{type(e).__name__}: {e}');raise
    finally:r['completed_unix']=time.time();(root/'report.json').write_text(json.dumps(r,indent=2))
    print(json.dumps({'id':r['id'],'status':r['status']}))
if __name__=='__main__':main()
