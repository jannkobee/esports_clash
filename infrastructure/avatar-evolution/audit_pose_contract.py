"""Read-only Colab audit of the legacy nominal-angle stress pose contract."""
import hashlib
import json
import os
from pathlib import Path
import sys
import bpy
import numpy as np
from mathutils import Quaternion, Vector
from review_generated_rig import load
from review_combined_joint_candidate import reset_pose, TARGETS


def angle(a, b):
    return float(np.degrees(np.arccos(np.clip(np.dot(a, b), -1, 1))))


root = Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
    raise RuntimeError('Google Colab required')
plan = json.loads((root/'plan.json').read_text())
raw_sha = hashlib.sha256((root/'raw.glb').read_bytes()).hexdigest()
if raw_sha != plan['raw_rig_sha256']:
    raise ValueError('Raw rig changed')
rigs, meshes = load(root/'raw.glb')
rig = rigs[0]
rig.animation_data_clear()
mapping = json.loads((root/'baseline-report.json').read_text())['bone_map']
report = {'compute': 'google', 'method': 'legacy-pose-direction-audit-v1', 'raw_rig_sha256': raw_sha,
          'source_sha256': plan['source_sha256'], 'publication_eligible': False, 'qualification_complete': False,
          'frame': 'Blender world: Z up, -Y intended forward; directions are head-to-child-head, not display tails.',
          'scope': 'Measures legacy isolated bone poses. Does not establish correct anatomy or define game motion.', 'joints': []}
for role in ('UpperArmL', 'UpperArmR', 'ThighL', 'ThighR'):
    reset_pose(rig)
    bpy.context.view_layer.update()
    bone = rig.data.bones[mapping[role]]
    child = rig.data.bones[mapping[TARGETS[role]]]
    start = rig.matrix_world@bone.head_local
    end = rig.matrix_world@child.head_local
    rest = (end-start).normalized()
    forward = Vector((0, -1, 0))
    inv = bone.matrix_local.to_3x3().inverted()@rig.matrix_world.to_3x3().inverted()
    axis = (inv@rest.cross(forward)).normalized()
    row = {'joint': role, 'bone': bone.name, 'parent': bone.parent.name if bone.parent else None,
           'head': list(start), 'child_head': list(end), 'rest_direction': list(rest),
           'rest_angle_from_down_degrees': angle(rest, Vector((0, 0, -1))),
           'rest_angle_to_forward_degrees': angle(rest, forward), 'poses': []}
    for degrees in (45, 90):
        reset_pose(rig)
        pb = rig.pose.bones[bone.name]
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = Quaternion(axis, np.deg2rad(degrees))
        bpy.context.view_layer.update()
        a = rig.matrix_world@pb.head
        b = rig.matrix_world@rig.pose.bones[child.name].head
        direction = (b-a).normalized()
        desired = Vector((0, -np.sin(np.deg2rad(degrees)), -np.cos(np.deg2rad(degrees))))
        row['poses'].append({'legacy_rotation_degrees': degrees, 'actual_direction': list(direction),
                             'angle_from_down_degrees': angle(direction, Vector((0, 0, -1))),
                             'error_to_sagittal_target_degrees': angle(direction, desired),
                             'joint_center': list(a), 'center_delta_from_rest': float((a-start).length),
                             'parent_basis_identity': bool(np.max(np.abs(np.array(pb.parent.matrix_basis)-np.eye(4))) < 1e-8) if pb.parent else True})
    report['joints'].append(row)
report['status'] = 'measured'
(root/'pose-audit.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
