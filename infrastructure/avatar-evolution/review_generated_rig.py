"""Colab-only source/raw-rig diagnosis with immutable inputs and controlled bends.

Stress clips are inspection artifacts, never game animations or qualification.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time
import bpy
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from bone_mapping import infer_humanoid
from mesh_validation import collision_summary, rest_keys, POLICY
from asset_pipeline.edge_deformation import edge_deformation


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def surface(meshes):
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    points,faces,regions=[],[],[]
    for obj in meshes:
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles();offset=len(points)
            points.extend(evaluated.matrix_world@v.co for v in mesh.vertices)
            for face in mesh.loop_triangles:
                faces.append(tuple(offset+i for i in face.vertices))
                mass={}
                for i in face.vertices:
                    for group in obj.data.vertices[i].groups:
                        name=obj.vertex_groups[group.group].name
                        mass[name]=mass.get(name,0)+group.weight
                regions.append(max(mass,key=mass.get) if mass else 'source')
        finally:evaluated.to_mesh_clear()
    return points,faces,regions


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path),merge_vertices=True)
    rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
    displays={b.custom_shape for rig in rigs for b in rig.pose.bones if b.custom_shape}
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in displays]
    return rigs,meshes


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder',type=Path)
    args=parser.parse_args();folder=args.folder.resolve()
    if not os.environ.get('COLAB_RELEASE_TAG') or not folder.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Generated-body rig diagnosis requires Google Colab.')
    plan=json.loads((folder/'plan.json').read_text())
    for name,expected in plan['files'].items():
        if digest(folder/name)!=expected:raise ValueError('Frozen diagnostic input mismatch: '+name)
    report={'id':plan['id'],'compute':'google','source_generation_id':plan['generation_id'],
            'source_sha256':plan['source_sha256'],'rig_attempt_id':plan['rig_attempt_id'],
            'rig_sha256':plan['rig_sha256'],'publication_eligible':False,'qualification_complete':False,
            'policy':POLICY,'started_unix':time.time(),'poses':[]}
    output=folder/'output';output.mkdir(exist_ok=False)
    try:
        rigs,meshes=load(folder/'source.glb')
        points,faces,regions=surface(meshes)
        report['source']={'meshes':len(meshes),'rigs':len(rigs),'vertices':len(points),
            'bounds':[[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]],
            **collision_summary(points,faces,rest_keys(points),regions)}
        rigs,meshes=load(folder/'raw-rig.glb')
        if len(rigs)!=1:raise ValueError('Expected exactly one predicted armature')
        rig=rigs[0];rig.animation_data_clear()
        for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
        bpy.context.view_layer.update()
        bones=[{'name':b.name,'parent':b.parent.name if b.parent else None,
            'position':list(rig.matrix_world@b.head_local),'tail':list(rig.matrix_world@b.tail_local)} for b in rig.data.bones]
        mapping,mapping_review=infer_humanoid(bones,profile_name='humanoid_unarmed')
        report.update(bones=bones,bone_map=mapping,mapping_review=mapping_review)
        weights=[]
        for obj in meshes:
            groups={g.index for g in obj.vertex_groups if g.name in rig.data.bones}
            values=[[g.weight for g in v.groups if g.group in groups and g.weight>1e-8] for v in obj.data.vertices]
            weights.append({'mesh':obj.name,'vertices':len(values),'unweighted':sum(not a for a in values),
                'max_influences':max(map(len,values)),'max_normalization_error':max(abs(sum(a)-1) for a in values),
                'finite_nonnegative':all(math.isfinite(w) and w>=0 for a in values for w in a)})
        report['weights']=weights
        rest,faces,regions=surface(meshes);keys=rest_keys(rest)
        report['raw_rest']=collision_summary(rest,faces,keys,regions)
        if not mapping_review.get('accepted'):
            report['status']='mapping_review_required'
            return
        # Use measured limb directions and the mapping's confirmed forward -Y,
        # rather than copying a different skeleton's roll or local Euler axis.
        forward=Vector((0,-1,0));axes={}
        targets={'UpperArmL':'ForearmL','UpperArmR':'ForearmR','ForearmL':'HandL','ForearmR':'HandR',
                 'ThighL':'CalfL','ThighR':'CalfR','CalfL':'FootL','CalfR':'FootR'}
        for role,child in targets.items():
            bone=rig.pose.bones[mapping[role]]
            start=rig.matrix_world@bone.bone.head_local
            end=rig.matrix_world@rig.data.bones[mapping[child]].head_local
            direction=(end-start).normalized()
            desired=-forward if role.startswith('Calf') else forward
            world_axis=direction.cross(desired).normalized()
            if world_axis.length<.9:raise ValueError('Ambiguous bend axis: '+role)
            axis=bone.bone.matrix_local.to_3x3().inverted()@(rig.matrix_world.to_3x3().inverted()@world_axis)
            axes[role]=axis.normalized()
            for degrees in (15,45,90):
                for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
                bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion(axes[role],math.radians(degrees))
                points,current_faces,_=surface(meshes)
                if current_faces!=faces:raise ValueError('Skinning changed surface topology')
                result={'joint':role,'bone':bone.name,'degrees':degrees,
                    **collision_summary(points,faces,keys,regions),'edge_deformation':edge_deformation(rest,points,faces)}
                report['poses'].append(result)
                (output/'progress.json').write_text(json.dumps({'completed_poses':len(report['poses']),'last':result}))
        # Preserve measured inspection bends as separate GLB clips for Babylon.
        scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=0;scene.frame_end=60
        for action in list(bpy.data.actions):bpy.data.actions.remove(action)
        for role,axis in axes.items():
            action=bpy.data.actions.new('Stress_'+role);rig.animation_data_create();rig.animation_data.action=action
            for frame,degrees in ((0,0),(15,45),(30,90),(45,45),(60,0)):
                for b in rig.pose.bones:
                    b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion()
                    if b.name==mapping[role]:b.rotation_quaternion=Quaternion(axis,math.radians(degrees))
                    b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name)
            action.use_fake_user=True
        rig.animation_data.action=None
        for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
        scene.frame_set(0)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in [rig,*meshes]:obj.select_set(True)
        bpy.context.view_layer.objects.active=rig
        bpy.ops.export_scene.gltf(filepath=str(output/'stress.glb'),export_format='GLB',use_selection=True,
            export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True)
        report['stress_artifact']={'sha256':digest(output/'stress.glb'),'bytes':(output/'stress.glb').stat().st_size}
        report['status']='review_required'
        report['scope']='Controlled raw-rig bends only. No repair, retargeting, game motion or appearance qualification.'
    except Exception as error:
        report.update(status='failed',error=str(error));raise
    finally:
        report['completed_unix']=time.time()
        (output/'report.json').write_text(json.dumps(report,indent=2))


if __name__=='__main__':main()
