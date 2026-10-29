"""Explicit world-direction diagnostic poses; no anatomical or game-motion claim."""
import math
import bpy
from mathutils import Quaternion, Vector

CONTRACT = {
    'version': 'world-direction-joint-contract-v1',
    'frame': 'Blender world Z-up, -Y-forward',
    'modes': ['legacy', 'world_target', 'coordinated'],
    'poses': [['UpperArmL', 45], ['UpperArmL', 90], ['ThighL', 90], ['ThighR', 90]],
    'shoulder_parent_forward_rotation_degrees': 15,
    'hip_child_knee_flexion_degrees': 60,
    'max_target_error_degrees': .01,
    'scope': 'Authored diagnostic coordination, not a physiological rhythm, animation replacement or qualification. Hip coordination keeps pelvis and hip direction fixed; shoulder coordination moves its clavicle and joint centre.',
}


def direction(rig, name, child):
    bpy.context.view_layer.update()
    a = rig.matrix_world@rig.pose.bones[name].head
    b = rig.matrix_world@rig.pose.bones[child].head
    return (b-a).normalized()


def angle_degrees(a, b):
    a, b = a.normalized(), b.normalized()
    return math.degrees(math.atan2(a.cross(b).length, a.dot(b)))


def rotate_world(rig, name, axis, degrees):
    bpy.context.view_layer.update()
    pb = rig.pose.bones[name]
    orientation = (rig.matrix_world@pb.matrix).to_quaternion().normalized()
    local_axis = orientation.inverted()@axis.normalized()
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = pb.rotation_quaternion@Quaternion(local_axis, math.radians(degrees))
    bpy.context.view_layer.update()


def aim(rig, name, child, target):
    current = direction(rig, name, child)
    delta = current.rotation_difference(target.normalized())
    axis, radians = delta.to_axis_angle()
    if abs(radians) > 1e-8:
        rotate_world(rig, name, axis, math.degrees(radians))


def apply_pose(rig, mapping, role, degrees, mode):
    from review_combined_joint_candidate import reset_pose, TARGETS
    if mode not in CONTRACT['modes']:
        raise ValueError('Unknown diagnostic pose mode')
    reset_pose(rig)
    bpy.context.view_layer.update()
    name, child = mapping[role], mapping[TARGETS[role]]
    start = (rig.matrix_world@rig.pose.bones[name].head).copy()
    rest_direction = direction(rig, name, child)
    radians = math.radians(degrees)
    target = Vector((0, -math.sin(radians), -math.cos(radians)))
    parent_name = rig.data.bones[name].parent.name
    if mode == 'legacy':
        rotate_world(rig, name, rest_direction.cross(Vector((0, -1, 0))), degrees)
    else:
        if mode == 'coordinated' and role.startswith('UpperArm'):
            parent_direction = direction(rig, parent_name, name)
            rotate_world(rig, parent_name, parent_direction.cross(Vector((0, -1, 0))),
                         CONTRACT['shoulder_parent_forward_rotation_degrees'])
        aim(rig, name, child, target)
        if mode == 'coordinated' and role.startswith('Thigh'):
            calf_role = TARGETS[role]
            calf_name, foot_name = mapping[calf_role], mapping[TARGETS[calf_role]]
            calf_direction = direction(rig, calf_name, foot_name)
            axis = calf_direction.cross(Vector((0, 0, -1))).normalized()
            rotate_world(rig, calf_name, axis, CONTRACT['hip_child_knee_flexion_degrees'])
    actual = direction(rig, name, child)
    error = angle_degrees(actual, target)
    if mode != 'legacy' and error > CONTRACT['max_target_error_degrees']:
        raise ValueError(f'World target missed: {role} {error}')
    center = rig.matrix_world@rig.pose.bones[name].head
    return {'target_direction': list(target), 'actual_direction': list(actual), 'target_error_degrees': error,
            'angle_from_down_degrees': angle_degrees(actual, Vector((0, 0, -1))),
            'joint_center': list(center), 'center_delta_from_rest': (center-start).length,
            'parent': parent_name, 'parent_rotation_degrees': math.degrees(rig.pose.bones[parent_name].matrix_basis.to_quaternion().angle),
            'child_rotation_degrees': math.degrees(rig.pose.bones[child].matrix_basis.to_quaternion().angle)}
