"""Colab-only controlled taper study against frozen Mirelle pivot/weight candidates."""
import json
import math
import os
from pathlib import Path
import sys
import time

from review_generated_rig import load, surface
from review_collision_weight_candidate import (BOUNDS, TRANSFER, digest, export_selected,
    measure, reset_pose, surface_roundtrip)

FRACTION = .12
TAPER_METERS = .004


def weights(meshes, rig):
    values = []
    for obj in meshes:
        deform = {group.index for group in obj.vertex_groups if group.name in rig.data.bones}
        rows = [[g.weight for g in vertex.groups if g.group in deform and g.weight > 1e-8]
            for vertex in obj.data.vertices]
        values.append({'mesh': obj.name, 'vertices': len(rows),
            'unweighted_vertices': sum(not row for row in rows),
            'max_influences': max(map(len, rows)),
            'max_normalization_error': max(abs(sum(row) - 1) for row in rows),
            'finite_nonnegative': all(math.isfinite(w) and w >= 0 for row in rows for w in row)})
    return values


def taper(point, bounds):
    result = 1.0
    for axis in range(3):
        distance = min(point[axis] - bounds[axis * 2], bounds[axis * 2 + 1] - point[axis])
        t = max(0.0, min(1.0, distance / TAPER_METERS))
        result *= t * t * (3 - 2 * t)
    return result


def apply(meshes, mapping):
    edits = []
    for obj in meshes:
        groups = {group.name: group for group in obj.vertex_groups}
        for role, spec in TRANSFER.items():
            target = mapping[spec['target']]
            donors = [mapping.get(name, name) for name in spec['donors']]
            donors = [name for name in donors if name in groups and name != target]
            fractions, amounts = [], []
            for vertex in obj.data.vertices:
                falloff = taper(obj.matrix_world @ vertex.co, BOUNDS[role])
                if falloff <= 0:
                    continue
                old = {obj.vertex_groups[g.group].name: g.weight for g in vertex.groups}
                if old.get(target, 0) <= 0:
                    continue
                fraction = FRACTION * falloff
                amount = sum(old.get(name, 0) for name in donors) * fraction
                if amount <= 1e-8:
                    continue
                for name in donors:
                    if old.get(name, 0) > 0:
                        groups[name].add([vertex.index], old[name] * (1 - fraction), 'REPLACE')
                groups[target].add([vertex.index], old[target] + amount, 'REPLACE')
                fractions.append(fraction)
                amounts.append(amount)
            edits.append({'mesh': obj.name, 'region': role, 'target': target, 'donors': donors,
                'modified_vertices': len(amounts), 'mean_transferred_weight': sum(amounts) / len(amounts) if amounts else 0,
                'maximum_donor_fraction': max(fractions, default=0),
                'mean_donor_fraction': sum(fractions) / len(fractions) if fractions else 0,
                'bounds_xyz': BOUNDS[role], 'edge_taper_meters': TAPER_METERS})
    return edits


def main(root):
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab is required for avatar weight processing')
    plan = json.loads((root / 'plan.json').read_text())
    for name, expected in plan['files'].items():
        if digest(root / name) != expected:
            raise ValueError('Frozen input mismatch: ' + name)
    parent = json.loads((root / 'candidate-report.json').read_text())
    reference = json.loads((root / 'reference-report.json').read_text())
    baseline = json.loads((root / 'baseline-report.json').read_text())
    mapping = baseline['bone_map']
    output = root / 'output'
    output.mkdir(exist_ok=False)
    report = {'id': plan['id'], 'compute': 'google', 'publication_eligible': False,
        'qualification_complete': False, 'source_sha256': baseline['source_sha256'],
        'rig_sha256': baseline['rig_sha256'], 'parent_candidate_id': plan['parent_candidate_id'],
        'reference_candidate_id': plan['reference_candidate_id'],
        'method': 'localized-12-percent-tapered-transfer-v1', 'started_unix': time.time(),
        'controlled_variable': '4mm smoothstep taper at the unchanged region bounds; same 12% maximum, donors, targets and region order'}
    try:
        report['baseline_reproduction'] = []
        for label, file, expected in [('parent', 'candidate.glb', parent['reloaded_poses']),
                ('reference', 'reference.glb', reference['poses'])]:
            rigs, meshes = load(root / file)
            if len(rigs) != 1:
                raise ValueError('Expected exactly one rig: ' + label)
            reset_pose(rigs[0])
            measured = {}
            measure(rigs[0], meshes, mapping, parent, measured)
            lookup = {(row['joint'], row['degrees']): row['self_intersections'] for row in expected}
            reproduced = all(row['self_intersections'] == lookup[(row['joint'], row['degrees'])] for row in measured['poses'])
            report['baseline_reproduction'].append({'label': label, 'reproduced': reproduced, 'poses': measured['poses']})
            if not reproduced:
                raise ValueError('Frozen bend baseline changed: ' + label)
        rigs, meshes = load(root / 'candidate.glb')
        rig = rigs[0]
        reset_pose(rig)
        before, faces, _ = surface(meshes)
        report['parent_weights'] = weights(meshes, rig)
        report['weight_edits'] = apply(meshes, mapping)
        after, current_faces, _ = surface(meshes)
        if faces != current_faces or max((a - b).length for a, b in zip(before, after)) > 1e-7:
            raise ValueError('Weight-only edit changed the rest surface')
        candidate = output / 'weight-transfer-candidate.glb'
        export_selected(rig, meshes, candidate)
        report['artifact'] = {'sha256': digest(candidate), 'bytes': candidate.stat().st_size}
        rigs, meshes = load(candidate)
        if len(rigs) != 1:
            raise ValueError('Candidate export changed armature count')
        rig = rigs[0]
        reset_pose(rig)
        rest, reloaded_faces, _ = surface(meshes)
        report['rest_surface_roundtrip'] = surface_roundtrip(before, rest)
        if len(faces) != len(reloaded_faces) or report['rest_surface_roundtrip']['max_nearest_distance_m'] > 1e-6:
            raise ValueError('Candidate export changed topology or exceeded the rest-surface limit')
        report['candidate_weights'] = weights(meshes, rig)
        if any(not row['finite_nonnegative'] or row['unweighted_vertices'] or row['max_influences'] > 4
                or row['max_normalization_error'] > 1e-5 for row in report['candidate_weights']):
            raise ValueError('Candidate weights failed structural limits')
        measure(rig, meshes, mapping, parent, report)
        lookup = {(row['joint'], row['degrees']): row['self_intersections'] for row in reference['poses']}
        for row in report['poses']:
            row['reference_intersections'] = lookup[(row['joint'], row['degrees'])]
            row['delta_vs_reference'] = row['self_intersections'] - row['reference_intersections']
        report['status'] = 'review_required'
        report['scope'] = 'Controlled tapered weight-transfer study; exported/reloaded bends only. No game animation, appearance fitting or qualification.'
    except Exception as error:
        report.update(status='failed', error=f'{type(error).__name__}: {error}')
        raise
    finally:
        report['completed_unix'] = time.time()
        (output / 'report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main(Path(sys.argv[1]).resolve())
