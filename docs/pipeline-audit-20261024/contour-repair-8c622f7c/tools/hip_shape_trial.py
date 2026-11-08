"""Colab-only explicit left-hip sculpt pilot on frozen dense skin weights.

This is one authored shape hypothesis, not a learned anatomy or production rig.
The compact C2 field defines an outward front-crease handle in the 90-degree pose.
Inverse skinning creates one rest-space corrective; other poses are held-out checks.
"""
import hashlib,json,math,os,sys,time
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix
from scipy.spatial import cKDTree
from review_generated_rig import load,surface
from review_combined_joint_candidate import reset_pose
from joint_pose_contract import apply_pose

POLICY={'version':'left-hip-front-crease-handle-v1','joint':'ThighL',
        'handle_offset_height':[0,-.065,0],'radii_height':[.065,.045,.085],
        'posed_direction':[0,-2**-.5,2**-.5],'amplitude_height':.025,
        'max_rest_delta_height':.04,'max_posed_delta_height':.03,
        'max_inverse_condition':10,'activation':'sin(angle)^2',
        'authored_degrees':90,'check_degrees':[22.5,45,67.5,90],
        'scope':'Authored local sculpt hypothesis; no anatomical or production qualification.'}

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def activation(degrees):return math.sin(math.radians(degrees))**2

def main(root):
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Google Colab required')
    p=json.loads((root/'plan.json').read_text())
    for file,digest in p['files'].items():
        if sha(root/file)!=digest:raise ValueError('Frozen input changed: '+file)
    if p['policy']!=POLICY:raise ValueError('Frozen shape policy changed')
    r={'id':p['id'],'plan':p,'method':'localized-hip-sculpt-pilot-v1','compute':'google','status':'running','started_unix':time.time(),
       'candidate_available':False,'publication_eligible':False,'qualification_complete':False,'poses':[],'assets':[]}
    try:
        rigs,meshes=load(root/'raw.glb');rig=rigs[0];obj=meshes[0];rig.animation_data_clear()
        if len(rigs)!=1 or len(meshes)!=1:raise ValueError('Expected one generated body and rig')
        points=np.array(surface(meshes)[0]);data=np.load(root/'bounded-weights.npz');names=[b.name for b in rig.data.bones]
        if list(data['bone_names'])!=names or np.linalg.norm(points-data['body_positions'],axis=1).max()>1e-8:raise ValueError('Body or skeleton changed')
        weights=data['weights'];height=float(np.ptp(points[:,2]));mapping=json.loads((root/'baseline-report.json').read_text())['bone_map']
        if not np.isfinite(weights).all() or weights.min()<0 or np.max(abs(weights.sum(1)-1))>1e-6:raise ValueError('Invalid weights')
        center=np.array(rig.matrix_world@rig.data.bones[mapping['ThighL']].head_local)
        handle=center+height*np.array(POLICY['handle_offset_height']);rho=np.linalg.norm((points-handle)/(height*np.array(POLICY['radii_height'])),axis=1)
        t=np.clip(1-rho,0,1);falloff=t**4*(4*rho+1);active=falloff>0
        # Compact field depends on original positions, so seam duplicates receive identical deltas.
        wanted=height*POLICY['amplitude_height']*falloff[:,None]*np.array(POLICY['posed_direction'])
        inv_world=rig.matrix_world.inverted();hom=np.c_[points,np.ones(len(points))]
        def matrices():
            bpy.context.view_layer.update()
            return np.einsum('nb,bxy->nxy',weights,np.array([rig.matrix_world@rig.pose.bones[n].matrix@rig.data.bones[n].matrix_local.inverted()@inv_world for n in names])[:,:3,:])
        apply_pose(rig,mapping,'ThighL',90,'world_target');m90=matrices();condition=float(np.linalg.cond(m90[active,:,:3]).max())
        if condition>POLICY['max_inverse_condition']:raise ValueError('Inverse skin is ill-conditioned')
        delta=np.zeros_like(points);delta[active]=np.linalg.solve(m90[active,:,:3],wanted[active,:,None])[:,:,0]
        if np.linalg.norm(delta,axis=1).max()>height*POLICY['max_rest_delta_height']:raise ValueError('Rest corrective exceeds cap')
        rest_keys=np.round(points,7);_,cohort=np.unique(rest_keys,axis=0,return_inverse=True)
        # Measure seam equality, rather than assuming equal weights across seam vertices.
        def seam_spread(q):
            lo=np.full((cohort.max()+1,3),np.inf);hi=-lo.copy();np.minimum.at(lo,cohort,q);np.maximum.at(hi,cohort,q)
            return float(np.linalg.norm(hi-lo,axis=1).max())
        if seam_spread(delta)>1e-7:raise ValueError('Corrective would split coincident seams')
        r.update(body_height=height,body_vertices=len(points),weight_sha256=sha(root/'bounded-weights.npz'),
                 sculpt={'active_vertices':int(active.sum()),'handle_world':handle.tolist(),'inverse_condition_max':condition,
                         'max_rest_delta':float(np.linalg.norm(delta,axis=1).max()),'outside_patch_delta':float(np.linalg.norm(delta[~active],axis=1).max()),
                         'seam_delta_spread':seam_spread(delta)})
        output=root/'site/snapshots';output.mkdir(parents=True);expected={};samples={};edges=np.array([e.vertices[:] for e in obj.data.edges])
        for degrees in [0]+POLICY['check_degrees']:
            if degrees==0:reset_pose(rig);proof={'target_error_degrees':None}
            else:proof=apply_pose(rig,mapping,'ThighL',degrees,'world_target')
            m=matrices();baseline=np.einsum('nxy,ny->nx',m,hom)
            altered=baseline+activation(degrees)*np.einsum('nxy,ny->nx',m[:,:,:3],delta)
            displacement=np.linalg.norm(altered-baseline,axis=1)
            edge0=np.linalg.norm(baseline[edges[:,0]]-baseline[edges[:,1]],axis=1);edge1=np.linalg.norm(altered[edges[:,0]]-altered[edges[:,1]],axis=1)
            valid=edge0>height*1e-6;ratio=edge1[valid]/edge0[valid]
            measure={'degrees':degrees,'activation':activation(degrees),'max_delta':float(displacement.max()),
                     'outside_patch_max_delta':float(displacement[~active].max()),'seam_spread':seam_spread(altered),
                     'edge_ratio_min_vs_baseline':float(ratio.min()),'edge_ratio_max_vs_baseline':float(ratio.max()),**proof}
            r['poses'].append(measure)
            if measure['max_delta']>height*POLICY['max_posed_delta_height'] or measure['outside_patch_max_delta']!=0 or measure['seam_spread']>1e-6:raise ValueError('Locality/displacement/seam gate failed')
            if degrees==0:
                if not np.array_equal(baseline,altered):raise ValueError('Rest pose changed')
                continue
            for mode,moved in [('baseline',baseline),('sculpt',altered)]:
                key=f'{mode}-ThighL-{degrees}';samples[key]=moved
                mesh=obj.data.copy()
                for v,co in zip(mesh.vertices,moved):v.co=co
                mesh.normals_split_custom_set([(0.,0.,0.)]*len(mesh.loops));mesh.update()
                snapshot=bpy.data.objects.new(key,mesh);bpy.context.collection.objects.link(snapshot);snapshot.matrix_world=Matrix.Identity(4)
                bpy.ops.object.select_all(action='DESELECT');snapshot.select_set(True);bpy.context.view_layer.objects.active=snapshot
                path=output/(key+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_skins=False,export_morph=False)
                expected[path.relative_to(root).as_posix()]=moved
                r['assets'].append({'mode':mode,'joint':'ThighL','degrees':degrees,'file':path.relative_to(root).as_posix(),
                                    'sha256':sha(path),'bytes':path.stat().st_size,'camera_target_gltf':[center[0],center[2],-center[1]]})
                bpy.data.objects.remove(snapshot,do_unlink=True);bpy.data.meshes.remove(mesh)
        artifact=root/'hip-sculpt.npz';np.savez_compressed(artifact,rest_positions=points,rest_delta=delta,falloff=falloff,**samples)
        r['sculpt_artifact']={'file':artifact.name,'sha256':sha(artifact),'bytes':artifact.stat().st_size}
        for asset in r['assets']:
            sr,sm=load(root/asset['file']);actual=np.array(surface(sm)[0]);want=expected[asset['file']]
            if sr or len(sm)!=1:raise ValueError('Static snapshot unexpectedly rigged')
            error=float(max(cKDTree(actual).query(want)[0].max(),cKDTree(want).query(actual)[0].max()))
            if error>height*1e-6:raise ValueError('Export changed surface')
            asset.update(static_only=True,reimport_max_surface_distance=error)
        r['status']='snapshots_exported'
    except Exception as error:r.update(status='failed',error=str(error));raise
    finally:(root/'pose-report.json').write_text(json.dumps(r,indent=2))

if __name__=='__main__':main(Path(sys.argv[1]).resolve())
