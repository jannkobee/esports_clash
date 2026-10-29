"""Colab-only causal check of linear versus volume-preserving skin evaluation.

Blender preserve-volume is NOT portable glTF skinning. No candidate is exported
or qualified by this diagnostic; a useful result would need a portable correction.
"""
import json
import math
import os
from pathlib import Path
import sys
import time
import numpy as np

import bpy
from mathutils import Quaternion, Vector
from review_generated_rig import load, surface
from review_collision_weight_candidate import digest, reset_pose, surface_roundtrip, TARGETS
from mesh_validation import collision_summary, rest_keys
from asset_pipeline.edge_deformation import edge_deformation
from collections import defaultdict
from contact_patch_mask import mesh_ring_falloff
from review_shoulder_contact_candidate import verify_source


def surface_masks(meshes, rest, contact):
    refs=verify_source(meshes,rest,contact);offset=0;result=[]
    for obj in meshes:
        seeds={record['mesh_vertex_index'] for record in contact['contact_vertex_records'].values() if record['mesh']==obj.name}
        adjacency=[set() for _ in obj.data.vertices]
        for edge in obj.data.edges:
            a,b=edge.vertices;adjacency[a].add(b);adjacency[b].add(a)
        seams=defaultdict(list)
        for vertex in obj.data.vertices:seams[tuple(round(float(c),6) for c in rest[offset+vertex.index])].append(vertex.index)
        groups=[indices for indices in seams.values() if len(indices)>1]
        falloff=mesh_ring_falloff(adjacency,groups,seeds,3)
        mask=obj.vertex_groups.new(name='__diagnostic_joint_surface_mask')
        for index,value in falloff.items():mask.add([index],value,'REPLACE')
        result.append({'mesh':obj.name,'seeds':len(seeds),'masked_vertices':len(falloff),'mask':mask.name})
        offset+=len(obj.data.vertices)
    return result


def seam_groups(rest):
    groups=defaultdict(list)
    for index,point in enumerate(rest):groups[tuple(round(float(c),6) for c in point)].append(index)
    return [indices for indices in groups.values() if len(indices)>1]


def seam_spread(points,groups):
    return max(((points[a]-points[b]).length for indices in groups for a in indices for b in indices),default=0)


def main(root):
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab is required for skinning mode diagnosis')
    plan=json.loads((root/'plan.json').read_text())
    for name,expected in plan['files'].items():
        if digest(root/name)!=expected:raise ValueError('Frozen input changed: '+name)
    baseline=json.loads((root/'baseline-report.json').read_text());mapping=baseline['bone_map']
    candidate=json.loads((root/'candidate-report.json').read_text());expected_rows=candidate.get('reloaded_poses',candidate.get('poses'))
    expected={(p['joint'],p['degrees']):p['self_intersections'] for p in expected_rows}
    output=root/'output';output.mkdir(exist_ok=False)
    hybrid_probe=plan['method']=='contact-bound-hybrid-corrective-probe-v1'
    surface_probe=hybrid_probe or plan['method']=='contact-bound-corrective-smooth-probe-v1'
    retained_targets={}
    report={'id':plan['id'],'compute':'google','method':plan['method'],
        'source_sha256':baseline['source_sha256'],'rig_sha256':plan['parent_candidate_sha256'],
        'parent_candidate_id':plan['parent_candidate_id'],'publication_eligible':False,'qualification_complete':False,
        'started_unix':time.time(),'variants':[]}
    try:
        rigs,meshes=load(root/'candidate.glb');reset_pose(rigs[0]);original,faces,regions=surface(meshes);keys=rest_keys(original)
        cohorts=seam_groups(original)
        variants=([('linear_baseline',False),('hybrid_pinned_boundary',False)] if hybrid_probe else [('linear_baseline',False),('smooth_pinned_boundary',False),('smooth_free_boundary',False)]) if surface_probe else [('linear_baseline',False),('preserve_volume_diagnostic',True)]
        for label,volume in variants:
            rigs,meshes=load(root/'candidate.glb');rig=rigs[0];reset_pose(rig)
            for obj in meshes:
                modifiers=[m for m in obj.modifiers if m.type=='ARMATURE']
                if len(modifiers)!=1:raise ValueError('Expected one armature modifier')
                modifiers[0].use_deform_preserve_volume=volume
            mask_report=None
            if label.startswith(('smooth_','hybrid_')):
                contact=json.loads((root/'contact-map.json').read_text())
                if contact['rig_sha256']!=plan['parent_candidate_sha256'] or contact['parent_candidate_id']!=plan['parent_candidate_id']:
                    raise ValueError('Surface mask source mismatch')
                mask_report=surface_masks(meshes,original,contact)
                for obj,mask in zip(meshes,mask_report):
                    modifier=obj.modifiers.new(name='ContactBoundSurfaceProbe',type='CORRECTIVE_SMOOTH')
                    modifier.factor=.5;modifier.iterations=8;modifier.smooth_type='LENGTH_WEIGHTED';modifier.rest_source='ORCO'
                    modifier.vertex_group=mask['mask'];modifier.use_pin_boundary=label!='smooth_free_boundary'
            rest,current_faces,_=surface(meshes)
            if current_faces!=faces:raise ValueError('Skinning mode changed topology')
            row={'name':label,'poses':[],'rest_surface_comparison':surface_roundtrip(original,rest),'contact_mask':mask_report};report['variants'].append(row)
            if row['rest_surface_comparison']['max_nearest_distance_m']>1e-6:raise ValueError('Mode changed bind surface')
            for role,child in TARGETS.items():
                if label=='hybrid_pinned_boundary':
                    for obj in meshes:
                        for modifier in obj.modifiers:
                            if modifier.type=='ARMATURE':modifier.use_deform_preserve_volume=role.startswith('UpperArm')
                            elif modifier.type=='CORRECTIVE_SMOOTH':modifier.show_viewport=role in ('UpperArmL','UpperArmR','ThighL','ThighR')
                bone=rig.pose.bones[mapping[role]]
                start=rig.matrix_world@bone.bone.head_local;end=rig.matrix_world@rig.data.bones[mapping[child]].head_local
                desired=Vector((0,1 if role.startswith('Calf') else -1,0))
                axis=(bone.bone.matrix_local.to_3x3().inverted()@rig.matrix_world.to_3x3().inverted()@(end-start).normalized().cross(desired).normalized()).normalized()
                for degrees in (45,90):
                    reset_pose(rig);bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion(axis,math.radians(degrees));bpy.context.scene.frame_set(0)
                    posed,posed_faces,_=surface(meshes)
                    if posed_faces!=faces:raise ValueError('Mode changed posed topology')
                    count=collision_summary(posed,faces,keys,regions)
                    delta_from_linear=0.0
                    if label!='linear_baseline':
                        flags=[]
                        for obj in meshes:
                            for modifier in obj.modifiers:
                                if modifier.type=='ARMATURE':
                                    flags.append((modifier,'use_deform_preserve_volume',modifier.use_deform_preserve_volume));modifier.use_deform_preserve_volume=False
                                elif modifier.type=='CORRECTIVE_SMOOTH':
                                    flags.append((modifier,'show_viewport',modifier.show_viewport));modifier.show_viewport=False
                        linear,_,_=surface(meshes)
                        for modifier,key,value in flags:setattr(modifier,key,value)
                        delta_from_linear=max((a-b).length for a,b in zip(posed,linear))
                    if hybrid_probe and label=='hybrid_pinned_boundary' and role in ('UpperArmL','UpperArmR','ThighL','ThighR'):
                        retained_targets[role+'_'+str(degrees)]=np.array([list(p) for p in posed],dtype=np.float64)
                    if label=='linear_baseline' and count['self_intersections']!=expected[(role,degrees)]:raise ValueError('Canonical baseline reproduction failed')
                    row['poses'].append({'joint':role,'degrees':degrees,**count,
                        'parent_intersections':expected[(role,degrees)],'delta_vs_parent':count['self_intersections']-expected[(role,degrees)],
                        'edge_deformation':edge_deformation(original,posed,faces),'max_coincident_rest_vertex_spread_m':seam_spread(posed,cohorts),
                        'max_delta_from_linear_m':delta_from_linear})
                    (output/'progress.json').write_text(json.dumps(report,indent=2))
            reset_pose(rig)
        report['status']='diagnostic_complete'
        if hybrid_probe:
            targets_file=output/'corrective-targets.npz';np.savez_compressed(targets_file,**retained_targets)
            report['target_surface_artifact']={'sha256':digest(targets_file),'bytes':targets_file.stat().st_size,'keys':sorted(retained_targets),
                'source_sha256':plan['parent_candidate_sha256'],'vertex_count':len(original),'space':'Blender world; frozen import with merge_vertices=True'}
            report['joint_policy']={'shoulders':'preserve-volume followed by pinned corrective smoothing','hips':'linear skinning followed by pinned corrective smoothing','other_joints':'original linear skinning with corrective smoothing disabled'}
        report['scope']=('Signed-contact-bound joint-specific evaluation: shoulders preserve-volume plus pinned smoothing; hips linear plus pinned smoothing. Three-ring mask, factor .5, eight iterations. Retained target surfaces are diagnostic data, not an exported portable GLB repair or qualification.' if hybrid_probe else 'Signed-contact-bound corrective smoothing with three-ring rest-space falloff, factor .5, eight iterations; pinned/free-boundary variants measured against original rest collision keys. Blender-only diagnostic, no portable GLB correction or qualification.' if surface_probe else 'Blender evaluation-mode isolation on an exact registered mesh/rig with fixed weights and rest collision keys. Preserve-volume is not standard glTF/Babylon skinning; no candidate, exported fix, game-animation or qualification claim.')
    except Exception as error:
        report.update(status='failed',error=f'{type(error).__name__}: {error}');raise
    finally:
        report['completed_unix']=time.time();(output/'report.json').write_text(json.dumps(report,indent=2))


if __name__=='__main__':main(Path(sys.argv[1]).resolve())
