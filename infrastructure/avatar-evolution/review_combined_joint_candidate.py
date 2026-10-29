"""Colab-only combined pivot candidate, reloaded before controlled bend review."""
import hashlib
import json
import math
import os
import sys
import time
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.kdtree import KDTree

from review_generated_rig import load, surface
from mesh_validation import collision_summary, rest_keys
from asset_pipeline.edge_deformation import edge_deformation


TARGETS = {
    'UpperArmL': 'ForearmL', 'UpperArmR': 'ForearmR',
    'ForearmL': 'HandL', 'ForearmR': 'HandR',
    'ThighL': 'CalfL', 'ThighR': 'CalfR',
    'CalfL': 'FootL', 'CalfR': 'FootR',
}
PIVOT_OFFSETS = {
    'UpperArmL': -0.01, 'UpperArmR': -0.01,
    'ThighL': -0.01, 'ThighR': -0.01,
    'CalfL': 0.0125, 'CalfR': 0.0125,
}


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def surface_transfer(before, after):
    def directed(a, b):
        tree = KDTree(len(b))
        for index, point in enumerate(b):
            tree.insert(point, index)
        tree.balance()
        return [tree.find(point)[2] for point in a]
    distances = directed(before, after) + directed(after, before)
    return {'before_vertices': len(before), 'after_vertices': len(after),
            'max_nearest_distance': max(distances),
            'rms_nearest_distance': math.sqrt(sum(d*d for d in distances) / len(distances))}


def reset_pose(rig):
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)


def export_selected(rig, meshes, path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [rig, *meshes]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB',
        use_selection=True, export_animations=False, export_skins=True)


def measure_bends(rig, meshes, mapping, roles, result_rows):
    rest, faces, regions = surface(meshes)
    keys = rest_keys(rest)
    for role in roles:
        child = TARGETS[role]
        bone = rig.pose.bones[mapping[role]]
        start = rig.matrix_world @ rig.data.bones[mapping[role]].head_local
        end = rig.matrix_world @ rig.data.bones[mapping[child]].head_local
        direction = (end - start).normalized()
        desired = Vector((0, 1 if role.startswith('Calf') else -1, 0))
        world_axis = direction.cross(desired).normalized()
        axis = (bone.bone.matrix_local.to_3x3().inverted()
                @ rig.matrix_world.to_3x3().inverted() @ world_axis).normalized()
        for degrees in (45, 90):
            reset_pose(rig)
            bone.rotation_mode = 'QUATERNION'
            bone.rotation_quaternion = Quaternion(axis, math.radians(degrees))
            bpy.context.scene.frame_set(0)
            posed, posed_faces, _ = surface(meshes)
            if posed_faces != faces:
                raise ValueError('Pose changed the vertex/triangle correspondence')
            result_rows.append({'joint': role, 'degrees': degrees,
                **collision_summary(posed, faces, keys, regions),
                'edge_deformation': edge_deformation(rest, posed, faces)})
    return rest, faces


def main():
    root = Path(sys.argv[1]).resolve()
    if (not os.environ.get('COLAB_RELEASE_TAG')
            or not root.is_relative_to('/content/teamfight-preparation/reviews')):
        raise RuntimeError('Google Colab is required for avatar geometry processing.')
    plan = json.loads((root / 'plan.json').read_text())
    for name, expected in plan['files'].items():
        if digest(root / name) != expected:
            raise ValueError(f'Frozen diagnostic input changed: {name}')
    baseline = json.loads((root / 'baseline-report.json').read_text())
    mapping = baseline['bone_map']
    raw = root / 'raw-rig.glb'
    original_hash = digest(raw)
    report = {'id': plan['id'], 'compute': 'google',
        'source_sha256': baseline['source_sha256'], 'rig_sha256': original_hash,
        'publication_eligible': False, 'qualification_complete': False,
        'offsets_to_body_height': PIVOT_OFFSETS, 'baseline_poses': [],
        'reloaded_poses': [], 'started_unix': time.time()}
    output = root / 'output'
    output.mkdir(exist_ok=False)
    try:
        bpy.context.scene.frame_set(0)
        rigs, meshes = load(raw)
        base_rig = rigs[0]
        reset_pose(base_rig)
        source_points, source_faces, _ = surface(meshes)
        _, _ = measure_bends(base_rig, meshes, mapping, list(TARGETS), report['baseline_poses'])
        baseline_by_key = {(p['joint'], p['degrees']): p for p in baseline['poses']}
        for row in report['baseline_poses']:
            reference = baseline_by_key[(row['joint'], row['degrees'])]
            if row['self_intersections'] != reference['self_intersections']:
                raise ValueError(f"Raw-rig baseline mismatch: {row['joint']} at {row['degrees']} degrees")

        # Establish the export floor with the unchanged raw rig.
        rigs, meshes = load(raw)
        control = rigs[0]
        reset_pose(control)
        control_path = output / 'unchanged-control.glb'
        export_selected(control, meshes, control_path)
        control_rigs, control_meshes = load(control_path)
        control_rest, _, _ = surface(control_meshes)
        control_roundtrip = surface_transfer(source_points, control_rest)
        report['unchanged_export_roundtrip'] = control_roundtrip

        rigs, meshes = load(raw)
        rig = rigs[0]
        reset_pose(rig)
        original_points, original_faces, _ = surface(meshes)
        body_height = max(p.z for p in original_points) - min(p.z for p in original_points)
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for role, offset in PIVOT_OFFSETS.items():
            edit = rig.data.edit_bones[mapping[role]]
            original_roll = edit.roll
            edit.head += rig.matrix_world.to_3x3().inverted() @ Vector((0, offset * body_height, 0))
            edit.roll = original_roll
        bpy.ops.object.mode_set(mode='OBJECT')
        bpy.context.view_layer.update()
        edited_rest, edited_faces, _ = surface(meshes)
        if edited_faces != original_faces or max((a-b).length for a, b in zip(source_points, edited_rest)) > 1e-6:
            raise ValueError('Combined pivot edit changed bind surface geometry')

        candidate = output / 'combined-joint-candidate.glb'
        export_selected(rig, meshes, candidate)
        report['artifact'] = {'sha256': digest(candidate), 'bytes': candidate.stat().st_size}
        reloaded_rigs, reloaded_meshes = load(candidate)
        if len(reloaded_rigs) != 1:
            raise ValueError('Reloaded candidate armature count changed')
        reloaded = reloaded_rigs[0]
        candidate_rest, candidate_faces, _ = surface(reloaded_meshes)
        roundtrip = surface_transfer(source_points, candidate_rest)
        report['candidate_export_roundtrip'] = roundtrip
        report['export_delta_vs_unchanged_control'] = {
            'max_nearest_distance': roundtrip['max_nearest_distance'] - control_roundtrip['max_nearest_distance'],
            'rms_nearest_distance': roundtrip['rms_nearest_distance'] - control_roundtrip['rms_nearest_distance']}
        if (roundtrip['max_nearest_distance'] > control_roundtrip['max_nearest_distance'] + 1e-6
                or roundtrip['rms_nearest_distance'] > control_roundtrip['rms_nearest_distance'] + 1e-6):
            raise ValueError('Candidate export drift exceeds unchanged raw-rig export control')
        if len(candidate_faces) != len(original_faces):
            raise ValueError('Candidate export changed triangle count')

        measure_bends(reloaded, reloaded_meshes, mapping, list(TARGETS), report['reloaded_poses'])
        comparison = []
        for candidate_row in report['reloaded_poses']:
            base = baseline_by_key[(candidate_row['joint'], candidate_row['degrees'])]
            comparison.append({'joint': candidate_row['joint'], 'degrees': candidate_row['degrees'],
                'baseline_intersections': base['self_intersections'],
                'candidate_intersections': candidate_row['self_intersections'],
                'delta': candidate_row['self_intersections'] - base['self_intersections'],
                'candidate_severe_stretch_edges': candidate_row['edge_deformation']['severely_stretched_edges']})
        report['comparison'] = comparison
        report['status'] = 'review_required'
        report['scope'] = ('Combined shoulder/hip forward pivots and calf backward pivots, measured after GLB reimport. '
            'No full animation clips, repair/retarget chain, appearance fitting or qualification.')
    except Exception as error:
        report.update(status='failed', error=f'{type(error).__name__}: {error}')
        raise
    finally:
        report['completed_unix'] = time.time()
        (output / 'candidate-report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
