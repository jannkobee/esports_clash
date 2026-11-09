"""Colab-only bounded posed-surface trial; original body, skin and skeleton.

Fixed-boundary squared graph-Laplacian fairing is a shape hypothesis, not anatomy
qualification. Shoulder targets are authored with straight elbows; clavicle
coordination remains a separate control. Hip twist has its own target.
"""
import os,sys,json,hashlib,time
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector,Quaternion,Matrix
from scipy.sparse import coo_matrix,diags,eye
from scipy.sparse.linalg import spsolve
from scipy.spatial import cKDTree
from review_generated_rig import load,surface
from review_combined_joint_candidate import reset_pose,TARGETS
from joint_pose_contract import apply_pose,direction,rotate_world
from hip_contour_field import blend,fair_patch,POLICY as HIP_POLICY
from mesh_validation import collision_summary,rest_keys

SOURCE='42ac17a5740ab76878ca88d49e4b03cbb2d5998e7483acce91160bc0dc6ee597'
POLICY={'version':'combined-fixed-boundary-contour-v1','shoulder_radii_height':[.085,.065,.10],
 'shoulder_center_offset_height':[0,0,-.025],'shoulder_medial_guard_height':.045,
 'shoulder_screen':.00005,'boundary_fade_start':.65,
 'shoulder_max_posed_delta_height':.02,'shoulder_max_rest_delta_height':.02,
 'hip_total_max_posed_delta_height':.03,'hip_total_max_rest_delta_height':.04,
 'inverse_condition_max':10,'production_admitted':False,
 'scope':'One fixed surface hypothesis; no strength sweep, changed collision policy, pose clamp or release.'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()

def shoulder_field(rest,posed,edges,center,height):
    _,first,cohort=np.unique(np.round(rest,7),axis=0,return_index=True,return_inverse=True)
    x=rest[first];p=posed[first];n=len(x)
    e=np.sort(cohort[edges],axis=1);e=np.unique(e[e[:,0]!=e[:,1]],axis=0)
    length=np.linalg.norm(x[e[:,0]]-x[e[:,1]],axis=1);keep=length>height*1e-6;e=e[keep];length=length[keep]
    w=1/length;a=coo_matrix((np.r_[w,w],(np.r_[e[:,0],e[:,1]],np.r_[e[:,1],e[:,0]])),shape=(n,n)).tocsr()
    lap=eye(n,format='csr')-diags(1/np.maximum(np.asarray(a.sum(1)).ravel(),1e-20))@a
    rho=np.linalg.norm((x-(center+height*np.array(POLICY['shoulder_center_offset_height'])))/(height*np.array(POLICY['shoulder_radii_height'])),axis=1)
    active=(rho<1)&(np.abs(x[:,0])>height*POLICY['shoulder_medial_guard_height']);ids=np.flatnonzero(active)
    if len(ids)<20:raise ValueError('Empty shoulder patch')
    b=lap[:,ids];mat=(b.T@b+eye(len(ids))*POLICY['shoulder_screen']).tocsc();rhs=-(b.T@(lap@p))
    v=np.column_stack([spsolve(mat,rhs[:,j]) for j in range(3)])
    t=np.clip((1-rho[ids])/(1-POLICY['boundary_fade_start']),0,1);fade=t*t*t*(10+t*(-15+6*t))
    medial=np.clip((abs(x[ids,0])-height*.045)/(height*.015),0,1);fade*=medial*medial*(3-2*medial)
    d=np.zeros_like(p);d[ids]=v*fade[:,None]
    # A fixed per-vertex displacement constraint, not a tuned trial scale.
    norm=np.linalg.norm(d,axis=1);d*=np.minimum(1,height*.02/np.maximum(norm,1e-30))[:,None]
    return d[cohort],active[cohort],{'solve_vertices':len(ids),'energy_before':float(np.sum((lap@p)**2)),
      'energy_after':float(np.sum((lap@(p+d))**2)),'scope':'Curvature proxy is not a visual score.'}

def main(root):
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Google Colab required')
    plan=json.loads((root/'plan.json').read_text())
    for file,h in plan['files'].items():
        if sha(root/file)!=h:raise ValueError('Frozen input changed: '+file)
    source=root/'current-hip-animation.glb'
    if sha(source)!=SOURCE:raise ValueError('Wrong source')
    report={'id':plan['id'],'method':POLICY['version'],'policy':POLICY,'plan':plan,'compute':'google',
      'source_sha256':SOURCE,'publication_eligible':False,'qualification_complete':False,'targets':[],'poses':[],'controls':[],'started_unix':time.time()}
    try:
        rigs,meshes=load(source);rig=rigs[0];obj=meshes[0]
        for o in bpy.data.objects:o.animation_data_clear()
        obj.data.shape_keys.animation_data_clear();reset_pose(rig)
        for k in obj.data.shape_keys.key_blocks:k.value=0
        points,faces,regions=surface(meshes);points=np.array(points);height=float(np.ptp(points[:,2]));keys=rest_keys([Vector(p) for p in points])
        mapping=json.loads((root/'baseline-report.json').read_text())['bone_map'];names=[b.name for b in rig.data.bones]
        weights=np.zeros((len(points),len(names)))
        for v in obj.data.vertices:
            for g in v.groups:weights[v.index,names.index(obj.vertex_groups[g.group].name)]=g.weight
        if len(names)!=52 or np.count_nonzero(weights,axis=1).max()!=7:raise ValueError('Skeleton/skin changed')
        reference=dict(np.load(root/'bounded-weights.npz'));dist,idx=cKDTree(reference['body_positions']).query(points)
        cols=[list(reference['bone_names']).index(n) for n in names]
        weight_error=float(np.max(abs(weights-reference['weights'][idx][:,cols])))
        if dist.max()>height*1e-6 or weight_error>2e-7:raise ValueError('Imported weight lineage changed')
        edges=np.array([e.vertices[:] for e in obj.data.edges]);inv=rig.matrix_world.inverted();newtargets={};masks={}
        def matrices():
            bpy.context.view_layer.update()
            return np.einsum('nb,bxy->nxy',weights,np.array([rig.matrix_world@rig.pose.bones[n].matrix@rig.data.bones[n].matrix_local.inverted()@inv for n in names])[:,:3,:3])
        def pose(role,bend,child=0,twist=0,mode='world_target',candidate=False):
            for k in obj.data.shape_keys.key_blocks:k.value=0
            if role=='Rest':reset_pose(rig);return {}
            proof=apply_pose(rig,mapping,role,bend,mode);name=mapping[role];ch=mapping[TARGETS[role]]
            rotate_world(rig,name,direction(rig,name,ch),twist)
            pb=rig.pose.bones[ch];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion(Vector((1,0,0)),np.deg2rad(child))
            if role=='ThighL':
                for k,v in zip(('HipL_45','HipL_90'),blend(bend)):obj.data.shape_keys.key_blocks[k].value=v
            if candidate:
                if role.startswith('UpperArm'):
                    t=np.clip(bend/60,0,1);a=t*t*(3-2*t);t=np.clip((bend-60)/30,0,1);b=t*t*(3-2*t)
                    for k,v in [(role+'_60',a*(1-b)),(role+'_90',b)]:obj.data.shape_keys.key_blocks[k].value=float(v)
                    if POLICY.get('right_twist_target') and role=='UpperArmR':obj.data.shape_keys.key_blocks['UpperArmR_TwistMinus20'].value=float(a*(1-b)*np.clip(-twist/20,0,1))
                if role=='ThighL':obj.data.shape_keys.key_blocks['HipL_Twist20'].value=float(blend(bend)[1]*np.clip(twist/20,0,1))
            bpy.context.view_layer.update();return proof
        # Reproduce both complete recorded baselines before authoring targets.
        prior=json.loads((root/'prior/combined-motion-report.json').read_text())
        for row in prior['poses']:
            pose(row['role'],row['bend'],row['child_local_x_degrees'],row['twist'])
            got=collision_summary(*((lambda s:(s[0],s[1],keys,s[2]))(surface(meshes))))['self_intersections']
            if got!=row['collision']['self_intersections']:raise ValueError('Combined baseline mismatch '+row['case']+': '+str(got))
        for row in json.loads((root/'prior/combined-control-report.json').read_text())['controls']:
            pose(row['role'],row['angle'],row['child_local_x'],row['twist'],row['mode'])
            if row['role']=='ThighL':
                for k in ('HipL_45','HipL_90'):obj.data.shape_keys.key_blocks[k].value*=row['corrective_strength']
            p,f,r=surface(meshes);got=collision_summary(p,f,keys,r)['self_intersections']
            if got!=row['collision']['self_intersections']:raise ValueError('Isolation baseline mismatch')
        report['baseline_reproduced']={'combined':17,'isolation':21}
        report.update(vertices=len(points),bones=52,max_influences=7,weight_error=weight_error,body_height=height,
          runtime={'release':os.environ.get('COLAB_RELEASE_TAG'),'bpy':bpy.app.version_string,'numpy':np.__version__})
        # Freeze four straight-elbow shoulder fields and the compound hip field.
        target_cases=[(r,a,0,0,r+'_'+str(a)) for r in ('UpperArmL','UpperArmR') for a in (60,90)]+[('ThighL',90,90,20,'HipL_Twist20')]
        if POLICY.get('right_twist_target'):target_cases.append(('UpperArmR',60,60,-20,'UpperArmR_TwistMinus20'))
        for role,angle,child,twist,label in target_cases:
            pose(role,angle,child,twist);posed=np.array(surface(meshes)[0]);m=matrices();center=np.array(rig.matrix_world@rig.data.bones[mapping[role]].head_local)
            wanted,mask,metrics=fair_patch(points,posed,edges,center,height) if role=='ThighL' else shoulder_field(points,posed,edges,center,height)
            base_target=newtargets.get('UpperArmR_60') if label=='UpperArmR_TwistMinus20' else None
            if base_target is not None:wanted-=np.einsum('nij,nj->ni',m,base_target)
            condition=float(np.linalg.cond(m[mask]).max())
            if condition>10:raise ValueError('Inverse skin ill-conditioned')
            delta=np.zeros_like(points);delta[mask]=np.linalg.solve(m[mask],wanted[mask,:,None])[:,:,0]
            if role=='ThighL':
                original=np.array([v.co[:] for v in obj.data.shape_keys.key_blocks['HipL_90'].data])-np.array([v.co[:] for v in obj.data.shape_keys.key_blocks[0].data])
                # Uniform conservative cap leaves the existing target's frozen allowance intact.
                available=min(height*.03-float(np.linalg.norm(np.einsum('nij,nj->ni',m,original),axis=1).max()),height*.04-float(np.linalg.norm(original,axis=1).max()))
                scale=min(1,max(0,available)/max(float(np.linalg.norm(wanted,axis=1).max()),float(np.linalg.norm(delta,axis=1).max()),1e-30));delta*=scale
            else:
                norm=np.linalg.norm(delta,axis=1);delta*=np.minimum(1,height*.02/np.maximum(norm,1e-30))[:,None]
                if base_target is not None:
                    available_rest=height*.02-float(np.linalg.norm(base_target,axis=1).max())
                    available_posed=height*.02-float(np.linalg.norm(np.einsum('nij,nj->ni',m,base_target),axis=1).max())
                    scale=min(1,max(0,available_rest)/max(float(np.linalg.norm(delta,axis=1).max()),1e-30),max(0,available_posed)/max(float(np.linalg.norm(np.einsum('nij,nj->ni',m,delta),axis=1).max()),1e-30));delta*=scale
            newtargets[label]=delta;masks[label]=mask
            target=obj.shape_key_add(name=label);world_to_local=obj.matrix_world.inverted().to_3x3()
            localdelta=delta@np.array(world_to_local).T
            for v,co in zip(target.data,np.array([v.co[:] for v in obj.data.vertices])+localdelta):v.co=co
            report['targets'].append({'name':label,'role':role,'angle':angle,'child':child,'twist':twist,'active':int(mask.sum()),'inverse_condition':condition,'max_rest_delta':float(np.linalg.norm(delta,axis=1).max()),**metrics})
        np.savez_compressed(root/'contour-targets.npz',rest_positions=points,**newtargets)
        snapshots=root/'site/repair';snapshots.mkdir(parents=True,exist_ok=True)
        cases=[('Rest',0,0,0)]+[(r,a,0,0) for r in ('UpperArmL','UpperArmR') for a in (60,90)]
        cases += [(p['role'],p['bend'],p['child_local_x_degrees'],p['twist']) for p in prior['poses']]
        # Half twist and straight-knee hip are held out from authoring.
        cases += [('ThighL',90,90,10),('ThighL',90,0,20),('ThighL',75,60,20)]
        _,cohort=np.unique(np.round(points,7),axis=0,return_inverse=True)
        for i,(role,angle,child,twist) in enumerate(cases):
            row={'case':f'{i:02d}-{role}-{angle}-child{child}-twist{twist}','role':role,'bend':angle,'child':child,'twist':twist}
            samples=[]
            for candidate in (False,True):
                proof=pose(role,angle,child,twist,candidate=candidate);p,f,r=surface(meshes);p=np.array(p);samples.append(p)
                mode='candidate' if candidate else 'baseline';contact=collision_summary([Vector(x) for x in p],f,keys,r)
                lo=np.full((cohort.max()+1,3),np.inf);hi=-lo.copy();np.minimum.at(lo,cohort,p);np.maximum.at(hi,cohort,p)
                row[mode]={'collision':contact,'seam_spread':float(np.linalg.norm(hi-lo,axis=1).max()),'pose_proof':proof}
                graph=bpy.context.evaluated_depsgraph_get();mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(graph),depsgraph=graph)
                snap=bpy.data.objects.new(mode,mesh);bpy.context.collection.objects.link(snap);snap.matrix_world=obj.matrix_world.copy()
                bpy.ops.object.select_all(action='DESELECT');snap.select_set(True);bpy.context.view_layer.objects.active=snap
                path=snapshots/(row['case']+'-'+mode+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_skins=False,export_morph=False)
                bpy.data.objects.remove(snap,do_unlink=True);bpy.data.meshes.remove(mesh)
                row[mode].update(snapshot=str(path.relative_to(root/'site')),sha256=sha(path))
            delta=np.linalg.norm(samples[1]-samples[0],axis=1);row['max_posed_delta']=float(delta.max())
            if role=='Rest':
                if not np.array_equal(*samples):raise ValueError('Rest changed')
            row['camera_target_gltf']=[0,height*.5,0] if role=='Rest' else (lambda c:[c.x,c.z,-c.y])(rig.matrix_world@rig.pose.bones[mapping[role]].head)
            report['poses'].append(row);print(row['case'],row['baseline']['collision']['self_intersections'],row['candidate']['collision']['self_intersections'],flush=True)
            (root/'repair-progress.json').write_text(json.dumps({'completed':i+1,'total':len(cases)}))
        pose('Rest',0);bpy.ops.wm.save_as_mainfile(filepath=str(root/'contour-candidate.blend'))
        report['status']='requires_visual_review';report['candidate_available']=True
        report['contact_regressions']=[r['case'] for r in report['poses'] if r['candidate']['collision']['self_intersections']>r['baseline']['collision']['self_intersections']]
    except Exception as e:report.update(status='failed',error=str(e));raise
    finally:(root/'repair-report.json').write_text(json.dumps(report,indent=2))

if __name__=='__main__':main(Path(sys.argv[1]).resolve())
