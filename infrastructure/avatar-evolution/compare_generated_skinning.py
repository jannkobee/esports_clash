"""Colab-only controlled LBS/DQS/half-angle helper comparison on a frozen raw rig.

DQS is diagnosis only: glTF/Babylon normally uses LBS. No variant is qualified.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time
import bpy
from mathutils import Matrix, Quaternion, Vector
from review_generated_rig import load, surface
from mesh_validation import collision_summary, rest_keys
from asset_pipeline.edge_deformation import edge_deformation


def main():
    root=Path(sys.argv[1]).resolve()
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab required')
    plan=json.loads((root/'plan.json').read_text())
    for name,sha in plan['files'].items():
        if hashlib.sha256((root/name).read_bytes()).hexdigest()!=sha:raise ValueError('Changed frozen input: '+name)
    baseline=json.loads((root/'baseline-report.json').read_text())
    if baseline['rig_sha256']!=plan['files']['raw-rig.glb']:raise ValueError('Wrong rig lineage')
    mapping=baseline['bone_map']
    targets={'UpperArmL':'ForearmL','UpperArmR':'ForearmR','ForearmL':'HandL','ForearmR':'HandR',
             'ThighL':'CalfL','ThighR':'CalfR','CalfL':'FootL','CalfR':'FootR'}
    report={'id':plan['id'],'compute':'google','rig_sha256':baseline['rig_sha256'],
            'source_sha256':baseline['source_sha256'],'publication_eligible':False,
            'qualification_complete':False,'started_unix':time.time(),'variants':[]}
    output=root/'output';output.mkdir(exist_ok=False)
    try:
        variants=plan.get('variants',['linear_baseline','dual_quaternion_diagnostic','half_angle_helpers'])
        if set(variants)-{'linear_baseline','dual_quaternion_diagnostic','half_angle_helpers','seam_consensus','seam_consensus_knees'}:
            raise ValueError('Unsupported controlled variant')
        for variant in variants:
            rigs,meshes=load(root/'raw-rig.glb');rig=rigs[0];rig.animation_data_clear()
            for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
            helpers={};changed=0;seams={}
            if variant.startswith('seam_consensus'):
                for obj in meshes:
                    cohorts={}
                    for vertex in obj.data.vertices:
                        cohorts.setdefault(tuple(round(float(c),6) for c in vertex.co),[]).append(vertex)
                    mismatch=0;maximum=0
                    for vertices in cohorts.values():
                        if len(vertices)<2:continue
                        weights=[{g.group:g.weight for g in v.groups if g.weight>1e-8} for v in vertices]
                        groups=set().union(*weights);average={g:sum(w.get(g,0) for w in weights)/len(weights) for g in groups}
                        spread=max(sum(abs(w.get(g,0)-average[g]) for g in groups) for w in weights)
                        maximum=max(maximum,spread)
                        if spread<=1e-6:continue
                        mismatch+=1
                        selected=sorted(average,key=lambda g:(-average[g],g))[:4];total=sum(average[g] for g in selected)
                        indices=[v.index for v in vertices]
                        for g in groups:obj.vertex_groups[g].remove(indices)
                        for g in selected:obj.vertex_groups[g].add(indices,average[g]/total,'REPLACE')
                        changed+=len(vertices)
                    seams[obj.name]={'inconsistent_coincident_groups':mismatch,'maximum_weight_l1_from_mean':maximum}
                if variant=='seam_consensus_knees':
                    pts,_,_=surface(meshes);height=max(p.z for p in pts)-min(p.z for p in pts)
                    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
                    for role in ('CalfL','CalfR'):
                        edit=rig.data.edit_bones[mapping[role]];roll=edit.roll
                        edit.head+=rig.matrix_world.to_3x3().inverted()@Vector((0,.0125*height,0));edit.roll=roll
                    bpy.ops.object.mode_set(mode='OBJECT')
            if variant=='half_angle_helpers':
                # Only redistribute weights already shared by a direct parent/child.
                # Geometry, original joint frames and all unrelated weights are unchanged.
                bpy.context.view_layer.objects.active=rig;rig.select_set(True)
                bpy.ops.object.mode_set(mode='EDIT')
                for role in targets:
                    original=rig.data.edit_bones[mapping[role]]
                    helper=rig.data.edit_bones.new('bend_'+role)
                    helper.matrix=original.matrix.copy();helper.length=original.length
                    helper.parent=original.parent;helper.use_connect=False
                    helpers[role]=helper.name
                bpy.ops.object.mode_set(mode='OBJECT')
                for obj in meshes:
                    for role,name in helpers.items():
                        child=obj.vertex_groups.get(mapping[role]);parent=obj.vertex_groups.get(rig.data.bones[mapping[role]].parent.name)
                        if child is None or parent is None:continue
                        group=obj.vertex_groups.new(name=name)
                        for vertex in obj.data.vertices:
                            weights={g.group:g.weight for g in vertex.groups}
                            a=weights.get(child.index,0);b=weights.get(parent.index,0);transfer=min(a,b)
                            if transfer<=1e-8:continue
                            child.add([vertex.index],a-transfer,'REPLACE');parent.add([vertex.index],b-transfer,'REPLACE')
                            group.add([vertex.index],2*transfer,'REPLACE');changed+=1
            for obj in meshes:
                for mod in obj.modifiers:
                    if mod.type=='ARMATURE':mod.use_deform_preserve_volume=variant=='dual_quaternion_diagnostic'
            rest,faces,regions=surface(meshes);keys=rest_keys(rest)
            result={'name':variant,'changed_vertex_group_pairs':changed,'seam_diagnostics':seams,'rest':collision_summary(rest,faces,keys,regions),'poses':[]}
            report['variants'].append(result)
            for role,child in targets.items():
                bone=rig.pose.bones[mapping[role]]
                direction=(rig.matrix_world@rig.data.bones[mapping[child]].head_local-rig.matrix_world@bone.bone.head_local).normalized()
                desired=Vector((0,1 if role.startswith('Calf') else -1,0))
                axis=(bone.bone.matrix_local.to_3x3().inverted()@rig.matrix_world.to_3x3().inverted()@direction.cross(desired).normalized()).normalized()
                for degrees in (45,90):
                    for other in rig.pose.bones:other.matrix_basis=Matrix.Identity(4)
                    bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion(axis,math.radians(degrees))
                    if role in helpers:
                        helper=rig.pose.bones[helpers[role]];helper.rotation_mode='QUATERNION'
                        helper.rotation_quaternion=Quaternion(axis,math.radians(degrees)/2)
                    points,current_faces,_=surface(meshes)
                    if current_faces!=faces:raise ValueError('Changed topology')
                    result['poses'].append({'joint':role,'degrees':degrees,**collision_summary(points,faces,keys,regions),
                                            'edge_deformation':edge_deformation(rest,points,faces)})
                    if variant=='linear_baseline':
                        original=next(p for p in baseline['poses'] if p['joint']==role and p['degrees']==degrees)
                        if result['poses'][-1]['self_intersections']!=original['self_intersections']:
                            raise ValueError('Baseline reproduction failed; do not compare repairs against changed bend axes')
                    (output/'progress.json').write_text(json.dumps(report))
            result['scope']='Controlled skinning comparison only; helper variants require baked animation/export review; DQS is not a glTF fix.'
        report['status']='review_required'
    except Exception as error:
        report.update(status='failed',error=str(error));raise
    finally:
        report['completed_unix']=time.time();(output/'report.json').write_text(json.dumps(report,indent=2))


if __name__=='__main__':main()
