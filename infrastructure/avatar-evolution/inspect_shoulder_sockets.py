"""Read-only rest-space shoulder sections; must run inside Google Colab."""
import hashlib
import json
import os
from pathlib import Path
import sys

import bpy
from mathutils import Vector
from review_generated_rig import load, surface
from review_collision_weight_candidate import reset_pose


def sections(points, faces, pivot, direction, height):
    rows = []
    for distance in (-.01, 0, .01, .02):
        center = pivot + direction * height * distance
        hits = {}
        for face in faces:
            for a, b in zip(face, face[1:] + face[:1]):
                p, q = points[a], points[b]
                da, db = (p-center).dot(direction), (q-center).dot(direction)
                if da * db >= 0 or abs(da-db) < 1e-12:
                    continue
                hit = p + (q-p) * (da / (da-db))
                if (hit-center).length <= height * .055:
                    hits[tuple(round(float(c), 7) for c in hit)] = hit
        vertices = list(hits.values())
        rows.append({'distance_along_arm_to_height': distance, 'points': [list(p) for p in vertices],
            'bounds_xyz': [[min(p[i] for p in vertices) for i in range(3)],
                           [max(p[i] for p in vertices) for i in range(3)]] if vertices else None,
            'centroid_xyz': list(sum(vertices, Vector()) / len(vertices)) if vertices else None})
    return rows


def inspect(path, mapping, targets=None):
    rigs, meshes = load(path)
    if len(rigs) != 1:
        raise ValueError('Expected one source rig')
    rig = rigs[0];reset_pose(rig)
    points, faces, _ = surface(meshes)
    height = max(p.z for p in points) - min(p.z for p in points)
    rows = []
    for role, child in (targets or [('UpperArmL', 'ForearmL'), ('UpperArmR', 'ForearmR')]):
        bone = rig.data.bones[mapping[role]]
        pivot = rig.matrix_world @ bone.head_local
        end = rig.matrix_world @ rig.data.bones[mapping[child]].head_local
        rows.append({'joint': role, 'bone': bone.name, 'parent': bone.parent.name,
            'pivot_xyz': list(pivot), 'child_pivot_xyz': list(end),
            'world_matrix': [list(row) for row in rig.matrix_world @ bone.matrix_local],
            'sections': sections(points, faces, pivot, (end-pivot).normalized(), height)})
    return {'body_height_m': height, 'hips' if targets else 'shoulders': rows}


if __name__ == '__main__':
    if not os.environ.get('COLAB_RELEASE_TAG'):
        raise RuntimeError('Google Colab is required for rest geometry inspection')
    source, baseline, expected, destination = sys.argv[1:]
    if hashlib.sha256(Path(source).read_bytes()).hexdigest() != expected:
        raise ValueError('Source identity mismatch')
    result = inspect(Path(source), json.loads(Path(baseline).read_text())['bone_map'])
    result.update(compute='google', rig_sha256=expected, publication_eligible=False, qualification_complete=False)
    Path(destination).write_text(json.dumps(result, indent=2))
    print(json.dumps({**result, 'shoulders': [{**row, 'sections': [
        {k:v for k,v in section.items() if k != 'points'} for section in row['sections']]} for row in result['shoulders']]}))
