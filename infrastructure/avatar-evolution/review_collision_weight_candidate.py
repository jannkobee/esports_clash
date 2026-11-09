"""Colab-only localized weight-transfer candidate for generated Mirelle."""
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
TRANSFER = {
    'UpperArmL': {'target': 'UpperArmL', 'donors': ['Spine', 'Chest', 'bone_25']},
    'UpperArmR': {'target': 'UpperArmR', 'donors': ['Spine', 'Chest', 'bone_6']},
    'ThighL': {'target': 'ThighL', 'donors': ['Hips']},
    'ThighR': {'target': 'ThighR', 'donors': ['Hips']},
}
# Bounds are the measured contact zones from the frozen influence profile, expanded
# by 4 mm per axis to include nearby vertices needed for smooth skin transitions.
BOUNDS = {
    'UpperArmL': [-.0845, -.0591, -.0518, .0146, .2559, .3251],
    'UpperArmR': [.0631, .0942, -.0655, .0117, .2555, .3151],
    'ThighL': [-.0940, .0065, -.0615, -.0052, .0311, .1238],
    'ThighR': [-.0183, .0871, -.0484, -.0058, .0398, .1231],
}
TRANSFER_FRACTION = 0.12


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def reset_pose(rig):
    rig.animation_data_clear()
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)


def export_selected(rig, meshes, path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [rig, *meshes]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB',
        use_selection=True, export_animations=False, export_skins=True)


def surface_roundtrip(before, after):
    def directed(left, right):
        tree = KDTree(len(right))
        for index, point in enumerate(right):
            tree.insert(point, index)
        tree.balance()
        return [tree.find(point)[2] for point in left]
    distances = directed(before, after) + directed(after, before)
    return {'before_vertices': len(before), 'after_vertices': len(after),
        'max_nearest_distance_m': max(distances),
        'rms_nearest_distance_m': math.sqrt(sum(d*d for d in distances) / len(distances))}


def apply_transfer(meshes, bone_map, report):
    for obj in meshes:
        groups = {g.name: g for g in obj.vertex_groups}
        for role, spec in TRANSFER.items():
            target_name = bone_map[spec['target']]
            if target_name not in groups:
                raise ValueError(f'Missing target weight group {target_name}')
            target = groups[target_name]
            donor_names = [bone_map.get(name, name) for name in spec['donors']]
            donor_names = [name for name in donor_names if name in groups and name != target_name]
            bounds = BOUNDS[role]
            changed = 0
            moved = 0.0
            for vertex in obj.data.vertices:
                world = obj.matrix_world @ vertex.co
                if not (bounds[0] <= world.x <= bounds[1] and bounds[2] <= world.y <= bounds[3]
                        and bounds[4] <= world.z <= bounds[5]):
                    continue
                weights = {obj.vertex_groups[g.group].name: g.weight for g in vertex.groups}
                target_weight = weights.get(target_name, 0.0)
                if target_weight <= 0:
                    continue
                amount = sum(weights.get(name, 0.0) for name in donor_names) * TRANSFER_FRACTION
                if amount <= 1e-8:
                    continue
                remaining = amount
                for name in donor_names:
                    old = weights.get(name, 0.0)
                    take = min(old, amount * old / max(sum(weights.get(n, 0.0) for n in donor_names), 1e-12))
                    if take > 0:
                        groups[name].add([vertex.index], old - take, 'REPLACE')
                        remaining -= take
                target.add([vertex.index], target_weight + amount - max(0.0, remaining), 'REPLACE')
                changed += 1
                moved += amount
            report.append({'mesh': obj.name, 'region': role, 'modified_vertices': changed,
                'mean_transferred_weight': moved / changed if changed else 0.0,
                'transfer_fraction_of_donor_mass': TRANSFER_FRACTION,
                'target': target_name, 'donors': donor_names})


def measure(rig, meshes, mapping, baseline, report):
    rest, faces, regions = surface(meshes)
    keys = rest_keys(rest)
    reference = {(p['joint'], p['degrees']): p for p in baseline['reloaded_poses']}
    rows = []
    for role in TARGETS:
        child = TARGETS[role]
        bone = rig.pose.bones[mapping[role]]
        start = rig.matrix_world @ rig.data.bones[mapping[role]].head_local
        end = rig.matrix_world @ rig.data.bones[mapping[child]].head_local
        direction = (end - start).normalized()
        desired = Vector((0, 1 if role.startswith('Calf') else -1, 0))
        axis = (bone.bone.matrix_local.to_3x3().inverted()
                @ rig.matrix_world.to_3x3().inverted() @ direction.cross(desired).normalized()).normalized()
        for degrees in (45, 90):
            reset_pose(rig)
            bone.rotation_mode = 'QUATERNION'
            bone.rotation_quaternion = Quaternion(axis, math.radians(degrees))
            bpy.context.scene.frame_set(0)
            posed, posed_faces, _ = surface(meshes)
            if posed_faces != faces:
                raise ValueError('Pose changed vertex/triangle correspondence')
            key = (role, degrees)
            result = {'joint': role, 'degrees': degrees,
                **collision_summary(posed, faces, keys, regions),
                'edge_deformation': edge_deformation(rest, posed, faces)}
            result['parent_intersections'] = reference[key]['self_intersections']
            result['delta_vs_parent'] = result['self_intersections'] - result['parent_intersections']
            rows.append(result)
    report['poses'] = rows


def main():
    root = Path(sys.argv[1]).resolve()
    if (not os.environ.get('COLAB_RELEASE_TAG')
            or not root.is_relative_to('/content/teamfight-preparation/reviews')):
        raise RuntimeError('Google Colab is required for avatar geometry processing.')
    plan = json.loads((root / 'plan.json').read_text())
    for name, expected in plan['files'].items():
        if digest(root / name) != expected:
            raise ValueError(f'Frozen diagnostic input changed: {name}')
    parent = json.loads((root / 'candidate-report.json').read_text())
    baseline = json.loads((root / 'baseline-report.json').read_text())
    report = {'id': plan['id'], 'compute': 'google', 'source_sha256': parent['source_sha256'],
        'rig_sha256': baseline['rig_sha256'], 'parent_candidate_id': plan['parent_candidate_id'],
        'publication_eligible': False, 'qualification_complete': False,
        'method': 'localized-12-percent-torso-to-limb-weight-transfer-v1',
        'started_unix': time.time(), 'weight_edits': []}
    output = root / 'output'
    output.mkdir(exist_ok=False)
    try:
        rigs, meshes = load(root / 'candidate.glb')
        if len(rigs) != 1:
            raise ValueError('Expected one candidate armature')
        rig = rigs[0]
        reset_pose(rig)
        mapping = baseline['bone_map']
        before, faces, _ = surface(meshes)
        apply_transfer(meshes, mapping, report['weight_edits'])
        after, after_faces, _ = surface(meshes)
        if faces != after_faces or max((a-b).length for a, b in zip(before, after)) > 1e-7:
            raise ValueError('Weight-only edit changed rest geometry')
        candidate = output / 'weight-transfer-candidate.glb'
        export_selected(rig, meshes, candidate)
        report['artifact'] = {'sha256': digest(candidate), 'bytes': candidate.stat().st_size}
        reloaded_rigs, reloaded_meshes = load(candidate)
        if len(reloaded_rigs) != 1:
            raise ValueError('Reloaded candidate armature count changed')
        reloaded = reloaded_rigs[0]
        reloaded_rest, reloaded_faces, _ = surface(reloaded_meshes)
        if len(reloaded_faces) != len(faces):
            raise ValueError('Candidate export changed triangle count')
        report['rest_surface_roundtrip'] = surface_roundtrip(before, reloaded_rest)
        if report['rest_surface_roundtrip']['max_nearest_distance_m'] > 1e-6:
            raise ValueError('Weight-only candidate changed the rest surface beyond the 1e-6m margin')
        measure(reloaded, reloaded_meshes, mapping, parent, report)
        report['status'] = 'review_required'
        report['scope'] = ('Localized torso-to-limb weight transfer in measured shoulder/hip contact regions; '
            'measured after GLB reimport. No full animation, repair/retarget, appearance fitting or qualification.')
    except Exception as error:
        report.update(status='failed', error=f'{type(error).__name__}: {error}')
        raise
    finally:
        report['completed_unix'] = time.time()
        (output / 'report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
