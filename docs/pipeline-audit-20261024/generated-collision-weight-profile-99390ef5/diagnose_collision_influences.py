"""Profile vertex weights on retained shoulder/hip collision triangles in Colab."""
import hashlib
import json
import math
import os
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

from review_generated_rig import load, surface
from mesh_validation import collision_summary, rest_keys


TARGETS = {'UpperArmL': 'ForearmL', 'UpperArmR': 'ForearmR',
           'ThighL': 'CalfL', 'ThighR': 'CalfR'}


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def all_vertex_weights(meshes):
    result = []
    for obj in meshes:
        groups = {group.index: group.name for group in obj.vertex_groups}
        result.extend({groups[group.group]: group.weight for group in vertex.groups if group.weight > 1e-5}
                      for vertex in obj.data.vertices)
    return result


def collision_pairs(points, faces, keys, regions):
    order = sorted(range(len(faces)), key=lambda i: tuple(sorted(keys[n] for n in faces[i])))
    ordered_faces = [tuple(sorted(faces[i], key=lambda n: keys[n])) for i in order]
    ordered_regions = [regions[i] for i in order]
    adjacent = [set(keys[i] for i in face) for face in ordered_faces]
    trees = [BVHTree.FromPolygons(points, ordered_faces, all_triangles=True),
             BVHTree.FromPolygons(points, [tuple(reversed(f)) for f in ordered_faces], all_triangles=True),
             BVHTree.FromPolygons(points, [(f[1], f[2], f[0]) for f in ordered_faces], all_triangles=True)]
    pairs = set()
    for left, right in [(trees[0], trees[0]), (trees[1], trees[1]), (trees[2], trees[2]),
                        (trees[0], trees[1]), (trees[0], trees[2])]:
        overlap = left.overlap(right)
        if len(overlap) > 1_000_000:
            raise RuntimeError('Collision density exceeds the bounded diagnostic budget.')
        for a, b in overlap:
            if a != b:
                pairs.add((min(a, b), max(a, b)))
    collisions = []
    for a, b in pairs:
        if a >= b or adjacent[a].intersection(adjacent[b]):
            continue
        collisions.append((a, b))
    counts = Counter(tuple(sorted((ordered_regions[a], ordered_regions[b]))) for a, b in collisions)
    return ordered_faces, ordered_regions, collisions, counts


def summarize_region_pair(region_pair, collisions, faces, weights, points):
    selected = [(a, b) for a, b in collisions
                if tuple(sorted((faces[a][1], faces[b][1]))) == region_pair]
    vertices = sorted({vertex for a, b in selected for face_index in (a, b) for vertex in faces[face_index][0]})
    sums = Counter()
    for vertex in vertices:
        sums.update(weights[vertex])
    means = {name: value / max(1, len(vertices)) for name, value in sums.items()}
    bounds = [[min(points[i][axis] for i in vertices), max(points[i][axis] for i in vertices)] for axis in range(3)] if vertices else []
    return {'regions': list(region_pair), 'intersection_pairs': len(selected),
            'unique_vertices': len(vertices), 'weight_mean_by_group': dict(sorted(means.items(), key=lambda x: -x[1])[:12]),
            'world_bounds_xyz': bounds}


def main():
    root = Path(sys.argv[1]).resolve()
    if (not os.environ.get('COLAB_RELEASE_TAG')
            or not root.is_relative_to('/content/teamfight-preparation/reviews')):
        raise RuntimeError('Google Colab is required for avatar mesh/weight processing.')
    plan = json.loads((root / 'plan.json').read_text())
    for name, expected in plan['files'].items():
        if digest(root / name) != expected:
            raise ValueError(f'Frozen diagnostic input changed: {name}')
    baseline = json.loads((root / 'baseline-report.json').read_text())
    mapping = baseline['bone_map']
    report = {'id': plan['id'], 'compute': 'google',
        'source_sha256': baseline['source_sha256'], 'rig_sha256': plan['files']['candidate.glb'],
        'parent_candidate_id': plan['parent_candidate_id'], 'publication_eligible': False,
        'qualification_complete': False, 'pose_diagnostics': [], 'started_unix': time.time()}
    output = root / 'output'
    output.mkdir(exist_ok=False)
    try:
        rigs, meshes = load(root / 'candidate.glb')
        if len(rigs) != 1:
            raise ValueError('Expected one reloaded candidate armature.')
        rig = rigs[0]
        for role, child in TARGETS.items():
            for bone in rig.pose.bones:
                bone.matrix_basis = Matrix.Identity(4)
            joint = rig.pose.bones[mapping[role]]
            start = rig.matrix_world @ rig.data.bones[mapping[role]].head_local
            end = rig.matrix_world @ rig.data.bones[mapping[child]].head_local
            direction = (end - start).normalized()
            desired = Vector((0, -1, 0))
            world_axis = direction.cross(desired).normalized()
            axis = (joint.bone.matrix_local.to_3x3().inverted()
                    @ rig.matrix_world.to_3x3().inverted() @ world_axis).normalized()
            joint.rotation_mode = 'QUATERNION'
            joint.rotation_quaternion = Quaternion(axis, math.radians(90))
            bpy.context.scene.frame_set(0)
            points, faces, regions = surface(meshes)
            weights = all_vertex_weights(meshes)
            if len(weights) != len(points):
                raise ValueError(f'Weight/vertex count mismatch on {role}: {len(weights)} vs {len(points)}')
            keys = rest_keys(points)
            base_summary = collision_summary(points, faces, keys, regions)
            ordered_faces, ordered_regions, pairs, counts = collision_pairs(points, faces, keys, regions)
            if len(pairs) != base_summary['self_intersections']:
                raise ValueError(f"Collision-pair reproduction failed for {role}: {len(pairs)} != {base_summary['self_intersections']}")
            normalized_faces = [(face, region) for face, region in zip(ordered_faces, ordered_regions)]
            role_details = [summarize_region_pair(group, pairs, normalized_faces, weights, points)
                            for group, _ in counts.most_common(8)]
            expected = next(row for row in json.loads((root / 'candidate-report.json').read_text())['reloaded_poses']
                            if row['joint'] == role and row['degrees'] == 90)
            if expected['self_intersections'] != len(pairs):
                raise ValueError(f'Candidate report count mismatch for {role}')
            report['pose_diagnostics'].append({'joint': role, 'degrees': 90,
                'self_intersections': len(pairs), 'top_region_weight_profiles': role_details,
                'scope': 'Collision triangles and influencing group averages; no weights or geometry changed.'})
            (output / 'progress.json').write_text(json.dumps(report['pose_diagnostics']))
        report['status'] = 'diagnostic_complete'
        report['scope'] = 'Residual 90-degree shoulder/hip collision weight profile only; no repair, animation or qualification.'
    except Exception as error:
        report.update(status='failed', error=f'{type(error).__name__}: {error}')
        raise
    finally:
        report['completed_unix'] = time.time()
        (output / 'report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
