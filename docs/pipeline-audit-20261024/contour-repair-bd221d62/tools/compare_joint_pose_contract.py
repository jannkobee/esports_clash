"""Colab static pose-contract comparison on a frozen generated body and weight field."""
import hashlib,json,os,sys,time
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix
from scipy.spatial import cKDTree
from review_generated_rig import load,surface
from joint_pose_contract import CONTRACT,apply_pose

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def main(root):
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):raise RuntimeError('Google Colab required')
    plan=json.loads((root/'plan.json').read_text())
    for name,expected in plan['files'].items():
        if sha(root/name)!=expected:raise ValueError('Input mismatch: '+name)
    if plan['contract']!=CONTRACT:raise ValueError('Frozen contract changed')
    report={'id':plan['id'],'plan':plan,'method':'fixed-weight-joint-pose-contract-v1','compute':'google','status':'running',
            'publication_eligible':False,'qualification_complete':False,'candidate_available':False,'poses':[],'assets':[],
            'started_unix':time.time(),'scope':CONTRACT['scope']}
    try:
        rigs,meshes=load(root/'raw.glb');rig,obj=rigs[0],meshes[0];rig.animation_data_clear()
        if len(rigs)!=1 or len(meshes)!=1:raise ValueError('Expected one raw body and rig')
        points=np.array(surface(meshes)[0]);data=np.load(root/'bounded-weights.npz')
        if np.linalg.norm(points-data['body_positions'],axis=1).max()>1e-8:raise ValueError('Body correspondence changed')
        names=[b.name for b in rig.data.bones]
        if list(data['bone_names'])!=names:raise ValueError('Skeleton channels changed')
        weights=data['weights'];height=float(np.ptp(points[:,2]));report['body_height']=height
        report['body_vertices']=len(points);report['weight_sha256']=sha(root/'bounded-weights.npz')
        mapping=json.loads((root/'baseline-report.json').read_text())['bone_map']
        hom=np.c_[points,np.ones(len(points))];inv_world=rig.matrix_world.inverted()
        out=root/'site/snapshots';out.mkdir(parents=True);expected={}
        for role,degrees in CONTRACT['poses']:
            for mode in CONTRACT['modes']:
                proof=apply_pose(rig,mapping,role,degrees,mode)
                mats=np.array([rig.matrix_world@rig.pose.bones[n].matrix@rig.data.bones[n].matrix_local.inverted()@inv_world for n in names])[:,:3,:]
                moved=np.einsum('nbx,nb->nx',np.einsum('bxy,ny->nbx',mats,hom),weights)
                key=f'{mode}-{role}-{degrees}';report['poses'].append({'mode':mode,'joint':role,'degrees':degrees,**proof})
                mesh=obj.data.copy()
                for v,co in zip(mesh.vertices,moved):v.co=co
                mesh.normals_split_custom_set([(0.,0.,0.)]*len(mesh.loops));mesh.update()
                snapshot=bpy.data.objects.new(key,mesh);bpy.context.collection.objects.link(snapshot);snapshot.matrix_world=Matrix.Identity(4)
                bpy.ops.object.select_all(action='DESELECT');snapshot.select_set(True);bpy.context.view_layer.objects.active=snapshot
                path=out/(key+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_skins=False,export_morph=False)
                # Fixed target from rest joint: coordination is allowed to move the joint centre.
                c=rig.matrix_world@rig.data.bones[mapping[role]].head_local
                file=path.relative_to(root).as_posix();expected[file]=moved
                report['assets'].append({'mode':mode,'joint':role,'degrees':degrees,'file':file,'sha256':sha(path),'bytes':path.stat().st_size,
                                        'camera_target_gltf':[c.x,c.z,-c.y]})
                bpy.data.objects.remove(snapshot,do_unlink=True);bpy.data.meshes.remove(mesh)
        for asset in report['assets']:
            sr,sm=load(root/asset['file'])
            if sr or len(sm)!=1:raise ValueError('Snapshot unexpectedly rigged')
            actual=np.array(surface(sm)[0]);want=expected[asset['file']]
            error=float(max(cKDTree(actual).query(want)[0].max(),cKDTree(want).query(actual)[0].max()))
            if error>height*1e-6:raise ValueError('Static export changed surface')
            asset.update(static_only=True,reimport_max_surface_distance=error)
        report['status']='snapshots_exported'
    except Exception as error:report.update(status='failed',error=str(error));raise
    finally:(root/'pose-report.json').write_text(json.dumps(report,indent=2))

if __name__=='__main__':main(Path(sys.argv[1]).resolve())
