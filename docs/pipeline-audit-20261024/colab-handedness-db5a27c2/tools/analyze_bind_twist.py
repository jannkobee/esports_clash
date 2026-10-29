"""Controlled roll experiment on an existing failed rig, executed in Colab only.

The source, weights and topology are untouched. The variant changes upper-arm
roll while retaining all joint heads/tails and child world transforms. It is
diagnostic evidence, never a fresh avatar or a qualified release.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import bpy
from mathutils import Matrix, Quaternion

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mesh_validation import collision_summary, rest_keys, POLICY
from asset_pipeline.edge_deformation import edge_deformation


def analyze(source, output, expected):
    if not os.environ.get('COLAB_RELEASE_TAG') or not str(output.resolve()).startswith('/content/teamfight-preparation/'):
        raise RuntimeError('This asset-processing experiment must execute in Google Colab.')
    if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
        raise ValueError('Frozen failed-candidate identity mismatch')
    output.mkdir(parents=True, exist_ok=False)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source), merge_vertices=True)
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    if len(rigs) != 1:
        raise ValueError('Exactly one retained armature is required')
    rig = rigs[0]
    displays = {b.custom_shape for b in rig.pose.bones if b.custom_shape}
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in displays]
    actions = list(bpy.data.actions)
    if not actions:
        raise ValueError('The failed animated candidate is required')
    rig.animation_data_clear()
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()

    def surface():
        bpy.context.view_layer.update()
        graph = bpy.context.evaluated_depsgraph_get()
        points, faces, labels = [], [], []
        for obj in meshes:
            evaluated = obj.evaluated_get(graph)
            mesh = evaluated.to_mesh()
            try:
                mesh.calc_loop_triangles()
                offset = len(points)
                points.extend(obj.matrix_world @ v.co for v in mesh.vertices)
                for triangle in mesh.loop_triangles:
                    faces.append(tuple(offset + i for i in triangle.vertices))
                    mass = {}
                    for index in triangle.vertices:
                        for group in obj.data.vertices[index].groups:
                            name = obj.vertex_groups[group.group].name
                            mass[name] = mass.get(name, 0) + group.weight
                    labels.append(min(mass, key=lambda name: (-mass[name], name)) if mass else 'unweighted')
            finally:
                evaluated.to_mesh_clear()
        return points, faces, labels

    rest, faces, labels = surface()
    keys = rest_keys(rest)

    def measure():
        points, current_faces, current_labels = surface()
        if faces != current_faces or labels != current_labels:
            raise ValueError('The diagnostic changed surface correspondence')
        return {**collision_summary(points, faces, keys, labels),
                'edge_deformation': edge_deformation(rest, points, faces)}

    def joints():
        return {bone.name: (bone.head.copy(), bone.tail.copy()) for bone in rig.pose.bones}

    def set_rotation(name, rotation):
        bone = rig.pose.bones.get(name)
        if not bone:
            raise ValueError('This diagnostic expects the failed candidate canonical upper arms')
        before = bone.matrix.copy()
        # Preserve each immediate child's complete armature-space transform.
        # Descendants then keep their own frames and joint positions unchanged.
        children = {child.name: child.matrix.copy() for child in bone.children}
        _, _, scale = before.decompose()
        bone.matrix = Matrix.LocRotScale(bone.head.copy(), rotation, scale)
        bpy.context.view_layer.update()
        for child, matrix in children.items():
            rig.pose.bones[child].matrix = matrix
        bpy.context.view_layer.update()
        angle = (before.to_quaternion().inverted() @ bone.matrix.to_quaternion()).angle
        degrees = math.degrees(angle)
        return min(degrees, 360 - degrees)

    def remove_roll(name):
        bone = rig.pose.bones[name]
        parent_delta = bone.parent.matrix @ bone.parent.bone.matrix_local.inverted() if bone.parent else Matrix.Identity(4)
        reference = parent_delta @ bone.bone.matrix_local
        reference_axis = reference.to_3x3().col[1].normalized()
        direction = (bone.tail - bone.head).normalized()
        return set_rotation(name, reference_axis.rotation_difference(direction) @ reference.to_quaternion())

    def halfturn(name):
        return set_rotation(name, rig.pose.bones[name].matrix.to_quaternion() @ Quaternion((0, 1, 0), math.pi))

    report = {'schema': 'failed-rig-roll-isolation-v1', 'compute': 'google',
              'source_sha256': expected, 'source_role': 'failed_candidate_diagnostic_only',
              'publication_eligible': False, 'collision_policy': POLICY,
              'blender': bpy.app.version_string, 'rest': measure(), 'experiments': [],
              'method': 'Compare shortest-swing upper-arm frames and controlled axial half-turns along either arm chain. Each child world transform, joint position, geometry and skin weight is preserved.'}
    for action in actions:
        clip = action.name.split('|')[-1]
        if clip not in ('Idle', 'Attack', 'Run', 'Cast'):
            continue
        for phase in (0, .42):
            for variant in ('original', 'left_roll_removed', 'right_roll_removed', 'both_rolls_removed',
                            'right_chain_halfturn', 'left_chain_halfturn', 'right_upper_forearm_halfturn'):
                rig.animation_data_create()
                rig.animation_data.action = action
                slots = list(rig.animation_data.action_suitable_slots)
                if len(slots) != 1:
                    raise ValueError('Ambiguous animation slot')
                rig.animation_data.action_slot = slots[0]
                start, end = action.frame_range
                frame = start + phase * (end - start)
                # Frame evaluation cannot reuse matrices edited by a previous
                # variant when the same timestamp is sampled again.
                bpy.context.scene.frame_set(math.floor(start) - 1)
                bpy.context.scene.frame_set(math.floor(frame), subframe=frame % 1)
                bpy.context.view_layer.update()
                before = joints()
                original_basis = {b.name: b.matrix_basis.copy() for b in rig.pose.bones}
                rig.animation_data.action = None
                rotations = {}
                if variant in ('left_roll_removed', 'both_rolls_removed'):
                    rotations['UpperArmL'] = remove_roll('UpperArmL')
                if variant in ('right_roll_removed', 'both_rolls_removed'):
                    rotations['UpperArmR'] = remove_roll('UpperArmR')
                if variant in ('right_chain_halfturn', 'right_upper_forearm_halfturn', 'left_chain_halfturn'):
                    side = 'L' if variant == 'left_chain_halfturn' else 'R'
                    chain = ('UpperArm', 'Forearm') if variant == 'right_upper_forearm_halfturn' else ('UpperArm', 'Forearm', 'Hand')
                    for role in chain:
                        rotations[role + side] = halfturn(role + side)
                after = joints()
                drift = max((before[name][i] - after[name][i]).length for name in before for i in (0, 1))
                if drift > 1e-5:
                    raise ValueError('Roll experiment moved a joint; comparison is not isolated')
                result = {'clip': clip, 'phase': phase, 'variant': variant,
                          'maximum_joint_drift': drift, 'roll_change_degrees': rotations, **measure()}
                report['experiments'].append(result)
                print('ROLL_EXPERIMENT=' + json.dumps({k: result[k] for k in
                    ('clip', 'phase', 'variant', 'self_intersections', 'maximum_joint_drift')}), flush=True)
                for name, matrix in original_basis.items():
                    rig.pose.bones[name].matrix_basis = matrix
                bpy.context.view_layer.update()
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print('ROLL_EXPERIMENT_COMPLETE=' + str(output / 'report.json'), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--source-sha256', required=True)
    args = parser.parse_args()
    analyze(args.source, args.output, args.source_sha256)
