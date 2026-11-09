"""Export and reload a knee-pivot candidate in Colab; no production qualification."""
import hashlib,json,math,os,sys,time
from pathlib import Path
import bpy
from mathutils import Matrix,Quaternion,Vector
from mathutils.kdtree import KDTree
from review_generated_rig import load,surface
from mesh_validation import collision_summary,rest_keys
from asset_pipeline.edge_deformation import edge_deformation


def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def topology_signature(points,faces):
    vertex=[tuple(round(float(c),6) for c in p) for p in points]
    return sorted(tuple(sorted(vertex[i] for i in face)) for face in faces)

def surface_transfer(before,after):
    tree=KDTree(len(after))
    for i,p in enumerate(after):tree.insert(p,i)
    tree.balance();distances=[tree.find(p)[2] for p in before]
    reverse=KDTree(len(before))
    for i,p in enumerate(before):reverse.insert(p,i)
    reverse.balance();back=[reverse.find(p)[2] for p in after]
    return {'before_vertices':len(before),'after_vertices':len(after),'max_nearest_distance':max(max(distances),max(back)),
            'rms_nearest_distance':(sum(d*d for d in distances+back)/len(distances+back))**.5}


def main():
    root=Path(sys.argv[1]).resolve()
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab required')
    plan=json.loads((root/'plan.json').read_text())
    for n,h in plan['files'].items():
        if digest(root/n)!=h:raise ValueError('Frozen candidate input changed')
    baseline=json.loads((root/'baseline-report.json').read_text());mapping=baseline['bone_map']
    rigs,meshes=load(root/'raw-rig.glb');rig=rigs[0];rig.animation_data_clear()
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    rest,faces,regions=surface(meshes);height=max(p.z for p in rest)-min(p.z for p in rest);keys=rest_keys(rest)
    original_hash=digest(root/'raw-rig.glb');report={'id':plan['id'],'compute':'google','source_sha256':baseline['source_sha256'],
        'rig_sha256':original_hash,'publication_eligible':False,'qualification_complete':False,'offset_to_height':.0125,
        'pose_results':[],'started_unix':time.time()}
    try:
        scene=bpy.context.scene;scene.frame_set(0)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in [rig,*meshes]:obj.select_set(True)
        bpy.context.view_layer.objects.active=rig
        reference_path=root/'output/reference-roundtrip.glb'
        bpy.ops.export_scene.gltf(filepath=str(reference_path),export_format='GLB',use_selection=True,export_animations=True,
            export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True)
        reference_rigs,reference_meshes=load(reference_path)
        reference_rest,_,_=surface(reference_meshes);baseline_transfer=surface_transfer(rest,reference_rest)
        report['baseline_export_roundtrip']=baseline_transfer
        rigs,meshes=load(root/'raw-rig.glb');rig=rigs[0]
        bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
        for side in ('L','R'):
            edit=rig.data.edit_bones[mapping['Calf'+side]];roll=edit.roll
            edit.head+=rig.matrix_world.to_3x3().inverted()@Vector((0,.0125*height,0));edit.roll=roll
        bpy.ops.object.mode_set(mode='OBJECT');bpy.context.view_layer.update()
        candidate_rest,candidate_faces,_=surface(meshes)
        if faces!=candidate_faces or max((a-b).length for a,b in zip(rest,candidate_rest))>1e-6:
            raise ValueError('Candidate changed rest surface geometry')
        scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=61
        for action in list(bpy.data.actions):bpy.data.actions.remove(action)
        clips={}
        for role,child in [('UpperArmL','ForearmL'),('UpperArmR','ForearmR'),('ForearmL','HandL'),('ForearmR','HandR'),
                           ('ThighL','CalfL'),('ThighR','CalfR'),('CalfL','FootL'),('CalfR','FootR')]:
            bone=rig.pose.bones[mapping[role]]
            direction=(rig.matrix_world@rig.data.bones[mapping[child]].head_local-rig.matrix_world@bone.bone.head_local).normalized()
            desired=Vector((0,1 if role.startswith('Calf') else -1,0))
            axis=(bone.bone.matrix_local.to_3x3().inverted()@rig.matrix_world.to_3x3().inverted()@direction.cross(desired).normalized()).normalized()
            action=bpy.data.actions.new('Candidate_'+role);rig.animation_data_create();rig.animation_data.action=action
            for frame,degrees in ((1,0),(16,45),(31,90),(46,45),(61,0)):
                for b in rig.pose.bones:
                    b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion()
                    if b.name==mapping[role]:b.rotation_quaternion=Quaternion(axis,math.radians(degrees))
                    b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name)
            action.use_fake_user=True;clips[role]=(action,axis)
        rig.animation_data.action=None
        bpy.ops.object.select_all(action='DESELECT')
        for obj in [rig,*meshes]:obj.select_set(True)
        bpy.context.view_layer.objects.active=rig
        path=root/'output/knee-pivot-candidate.glb';path.parent.mkdir(exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_skins=True)
        report['artifact']={'sha256':digest(path),'bytes':path.stat().st_size}
        # Reimport the exact GLB and evaluate all eight independent clips at both tested angles.
        rigs,meshes=load(path);scene=bpy.context.scene
        if len(rigs)!=1:raise ValueError('Reloaded candidate armature count changed')
        loaded=rigs[0];reloaded_rest,reloaded_faces,reloaded_regions=surface(meshes)
        transfer=surface_transfer(rest,reloaded_rest);report['exported_rest_surface']=transfer
        report['export_roundtrip_delta_vs_unchanged_baseline']={
            'max_nearest_distance_delta':transfer['max_nearest_distance']-baseline_transfer['max_nearest_distance'],
            'rms_nearest_distance_delta':transfer['rms_nearest_distance']-baseline_transfer['rms_nearest_distance']}
        if transfer['max_nearest_distance']>baseline_transfer['max_nearest_distance']+1e-6 or transfer['rms_nearest_distance']>baseline_transfer['rms_nearest_distance']+1e-6:
            raise ValueError('Candidate export drift exceeds unchanged-rig export drift')
        reloaded_keys=rest_keys(reloaded_rest);report['reloaded_clips']=[]
        targets={'UpperArmL':'ForearmL','UpperArmR':'ForearmR','ForearmL':'HandL','ForearmR':'HandR',
                 'ThighL':'CalfL','ThighR':'CalfR','CalfL':'FootL','CalfR':'FootR'}
        for role,child in targets.items():
            bone=loaded.pose.bones[mapping[role]]
            direction=(loaded.matrix_world@loaded.data.bones[mapping[child]].head_local-loaded.matrix_world@bone.bone.head_local).normalized()
            desired=Vector((0,1 if role.startswith('Calf') else -1,0))
            axis=(bone.bone.matrix_local.to_3x3().inverted()@loaded.matrix_world.to_3x3().inverted()@direction.cross(desired).normalized()).normalized()
            for degrees in (45,90):
                for b in loaded.pose.bones:b.matrix_basis=Matrix.Identity(4)
                bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion(axis,math.radians(degrees))
                scene=bpy.context.scene;scene.frame_set(0);points,current_faces,_=surface(meshes)
                if current_faces!=reloaded_faces:raise ValueError('Pose sampling changed topology')
                report['pose_results'].append({'clip':role,'joint':role,'degrees':degrees,
                    **collision_summary(points,reloaded_faces,reloaded_keys,reloaded_regions),
                    'edge_deformation':edge_deformation(reloaded_rest,points,reloaded_faces)})
        report['status']='reloaded_for_review';report['scope']='Experimental knee pivot candidate only. Shoulder/hip failures remain; no release eligibility.'
    except Exception as error:report.update(status='failed',error=str(error));raise
    finally:report['completed_unix']=time.time();(root/'output/candidate-report.json').write_text(json.dumps(report,indent=2))


if __name__=='__main__':main()
