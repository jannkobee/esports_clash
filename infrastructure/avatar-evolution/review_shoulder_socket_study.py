"""Colab-only shoulder pivot study. Skin weights and all other joints stay fixed."""
import json
import os
from pathlib import Path
import sys
import time

import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree
from inspect_shoulder_sockets import inspect
from gltf_joint_pivots import shift_pivots
from review_generated_rig import load, surface
from review_collision_weight_candidate import digest, export_selected, measure, reset_pose, surface_roundtrip
from review_tapered_weight_candidate import weights as weight_summary

METHOD = 'weight-fixed-shoulder-socket-placement-v1'
COMBINED_METHOD = 'weight-fixed-shoulder-socket-combined-v2'
HIP_METHOD = 'weight-fixed-hip-socket-placement-v1'
HIP_EXTENT_METHOD = 'weight-fixed-hip-forward-extent-v2'
VARIANTS = {
    'lateral_0p5pct': ('outward', .005), 'medial_0p5pct': ('outward', -.005),
    'anterior_0p5pct': ('y', -.005), 'posterior_0p5pct': ('y', .005),
    'superior_0p5pct': ('z', .005), 'inferior_0p5pct': ('z', -.005),
    'section_bounds_center': ('section_center', 1),
}
VARIANT_SETS = {METHOD: list(VARIANTS), COMBINED_METHOD: ['outward_forward_0p5pct'], HIP_METHOD: list(VARIANTS), HIP_EXTENT_METHOD:['anterior_0p99pct']}
VARIANTS['outward_forward_0p5pct'] = ('outward_forward', .005)
VARIANTS['anterior_0p99pct'] = ('y', -.0099)


class PlacementOutsideBounds(ValueError):
    def __init__(self, details):
        super().__init__('Placement exceeds frozen local-section/body-height bound')
        self.details = details


def weight_records(meshes):
    return [(obj.matrix_world @ vertex.co,
        {obj.vertex_groups[g.group].name: float(g.weight) for g in vertex.groups if g.weight > 0})
        for obj in meshes for vertex in obj.data.vertices]


def weight_match(before, after):
    """Allow exporter seam splits, but require every position/influence tuple both ways."""
    def directed(left, right):
        tree = KDTree(len(right))
        for index, (point, _) in enumerate(right):tree.insert(point, index)
        tree.balance();unmatched = 0;worst = 0.0
        for point, weights in left:
            errors = [max([abs(weights[k] - right[index][1][k]) for k in weights] or [0])
                for _, index, _ in tree.find_range(point, 1e-6) if weights.keys() == right[index][1].keys()]
            best = min(errors) if errors else float('inf')
            unmatched += best > 2e-6
            if best != float('inf'):worst = max(worst, best)
        return {'unmatched_vertices': unmatched, 'max_matching_weight_error': worst}
    result = {'before_to_after': directed(before, after), 'after_to_before': directed(after, before)}
    result['verified'] = all(row['unmatched_vertices'] == 0 for row in result.values())
    return result


def edit_pivots(source, output_path, survey, variant):
    mode, fraction = VARIANTS[variant];height = survey['body_height_m']
    rows = [];deltas = {}
    for shoulder in survey.get('hips', survey.get('shoulders', [])):
        old = Vector(shoulder['pivot_xyz'])
        section = next(s for s in shoulder['sections'] if s['distance_along_arm_to_height'] == 0)
        bounds = section['bounds_xyz']
        if mode == 'section_center':
            destination = (Vector(bounds[0]) + Vector(bounds[1])) * .5
        else:
            delta = Vector()
            if mode in ('outward', 'outward_forward'):
                delta.x = (-1 if shoulder['joint'].endswith('L') else 1) * fraction * height
                if mode == 'outward_forward':delta.y = -fraction * height
            else:delta['xyz'.index(mode)] = fraction * height
            destination = old + delta
        displacement = (destination-old).length
        if displacement > .01 * height or not all(bounds[0][i] <= destination[i] <= bounds[1][i] for i in range(3)):
            raise PlacementOutsideBounds({'joint':shoulder['joint'],'proposed_xyz':list(destination),
                'source_section_bounds_xyz':bounds,'displacement_to_height':displacement/height,
                'maximum_displacement_to_height':.01,'inside_section_bounds':all(bounds[0][i]<=destination[i]<=bounds[1][i] for i in range(3))})
        deltas[shoulder['bone']] = list(destination-old)
        rows.append({'joint': shoulder['joint'], 'bone': shoulder['bone'], 'before_xyz': list(old),
            'after_xyz': list(destination), 'displacement_m': displacement,
            'displacement_to_height': displacement / height, 'inside_section_bounds': True})
    proof = shift_pivots(source, output_path, deltas)
    return {'joints': rows, **proof}


def main(root):
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab is required for socket placement')
    plan = json.loads((root/'plan.json').read_text())
    if plan['variants'] != VARIANT_SETS.get(plan['method']):raise ValueError('Unknown frozen study')
    for name, expected in plan['files'].items():
        if digest(root/name) != expected:raise ValueError('Frozen input mismatch: '+name)
    baseline = json.loads((root/'baseline-report.json').read_text());mapping = baseline['bone_map']
    parent = json.loads((root/'candidate-report.json').read_text());reference = json.loads((root/'reference-report.json').read_text())
    parent_poses = parent.get('reloaded_poses', parent.get('poses'));comparison = {'reloaded_poses': parent_poses}
    output = root/'output';output.mkdir(exist_ok=False)
    report = {'id': plan['id'], 'compute': 'google', 'method': plan['method'],
        'source_sha256': baseline['source_sha256'], 'rig_sha256': plan['parent_candidate_sha256'],
        'parent_candidate_id': plan['parent_candidate_id'], 'publication_eligible': False,
        'qualification_complete': False, 'started_unix': time.time(), 'baseline_reproduction': [], 'variants': []}
    def save():
        temp = output/'progress.tmp.json';temp.write_text(json.dumps(report, indent=2));temp.replace(output/'progress.json')
    try:
        for label, file, poses in [('parent', 'candidate.glb', parent_poses), ('reference', 'reference.glb', reference['poses'])]:
            rigs, meshes = load(root/file);reset_pose(rigs[0]);result = {};measure(rigs[0], meshes, mapping, comparison, result)
            expected = {(r['joint'], r['degrees']):r['self_intersections'] for r in poses}
            ok = all(r['self_intersections'] == expected[(r['joint'], r['degrees'])] for r in result['poses'])
            report['baseline_reproduction'].append({'label': label, 'reproduced': ok, 'poses': result['poses']});save()
            if not ok:raise ValueError('Baseline reproduction failed: '+label)
        hip_study = plan['method'] in (HIP_METHOD,HIP_EXTENT_METHOD)
        affected_roles = ['ThighL', 'ThighR'] if hip_study else ['UpperArmL', 'UpperArmR']
        survey = inspect(root/'candidate.glb', mapping, [('ThighL','CalfL'),('ThighR','CalfR')] if hip_study else None)
        report['rest_socket_survey'] = survey;report['affected_roles'] = affected_roles;save()
        rigs, meshes = load(root/'candidate.glb');reset_pose(rigs[0]);before, faces, _ = surface(meshes)
        before_weights = weight_records(meshes);export_selected(rigs[0], meshes, output/'unchanged-control.glb')
        _, control_meshes = load(output/'unchanged-control.glb');control, _, _ = surface(control_meshes)
        report['unchanged_export_roundtrip'] = surface_roundtrip(before, control)
        report['unchanged_export_weights'] = weight_match(before_weights, weight_records(control_meshes))
        if not report['unchanged_export_weights']['verified']:raise ValueError('Control export changed weights')
        for variant in plan['variants']:
            result = {'variant': variant, 'candidate_id': plan['candidate_ids'][variant]}
            report['variants'].append(result);save()
            bind_path = output/(variant+'-bind.glb')
            try:result['pivot_edits'] = edit_pivots(root/'candidate.glb', bind_path, survey, variant)
            except PlacementOutsideBounds as error:
                result.update(status='rejected_by_frozen_bounds',reason=str(error),rejection_details=error.details)
                save();continue
            rigs, meshes = load(bind_path);rig = rigs[0];reset_pose(rig)
            rest, rest_faces, _ = surface(meshes)
            result['bind_surface_roundtrip'] = surface_roundtrip(before, rest)
            bind_weights = weight_match(before_weights, weight_records(meshes))
            if len(rest_faces) != len(faces) or result['bind_surface_roundtrip']['max_nearest_distance_m'] > 1e-6 or not bind_weights['verified']:
                raise ValueError('Pivot bind edit changed rest geometry or weights')
            result['weights_unchanged_before_export'] = result['pivot_edits']['mesh_weight_accessor_bytes_unchanged'] and bind_weights['verified']
            path = output/(variant+'.glb');export_selected(rig, meshes, path)
            result['artifact'] = {'sha256': digest(path), 'bytes': path.stat().st_size, 'file': path.name}
            rigs, meshes = load(path);reset_pose(rigs[0]);rest, reloaded_faces, _ = surface(meshes)
            result['rest_surface_roundtrip'] = surface_roundtrip(before, rest)
            result['weight_correspondence'] = weight_match(before_weights, weight_records(meshes))
            result['candidate_weights'] = weight_summary(meshes, rigs[0])
            if (not result['weight_correspondence']['verified'] or len(faces) != len(reloaded_faces)
                    or result['rest_surface_roundtrip']['max_nearest_distance_m'] > 1e-6):
                raise ValueError('Roundtrip changed rest geometry, triangles or weights')
            if any(not w['finite_nonnegative'] or w['unweighted_vertices'] or w['max_influences'] > 4
                    or w['max_normalization_error'] > 1e-5 for w in result['candidate_weights']):
                raise ValueError('Exported skin failed structural limits')
            measure(rigs[0], meshes, mapping, comparison, result)
            reference_counts={(p['joint'],p['degrees']):p['self_intersections'] for p in reference['poses']}
            for pose in result['poses']:
                pose['reference_intersections']=reference_counts[(pose['joint'],pose['degrees'])]
                pose['delta_vs_reference']=pose['self_intersections']-pose['reference_intersections']
            result['non_shoulder_bends_unchanged'] = all(r['delta_vs_parent'] == 0 for r in result['poses'] if not r['joint'].startswith('UpperArm'))
            result['non_target_bends_unchanged'] = all(r['delta_vs_parent'] == 0 for r in result['poses'] if r['joint'] not in affected_roles)
            result['regressions'] = [{'joint': r['joint'], 'degrees': r['degrees'], 'delta': r['delta_vs_parent']}
                for r in result['poses'] if r['delta_vs_parent'] > 0 or r['edge_deformation']['severely_stretched_edges'] > 0]
            result['status'] = 'measured_unqualified';save()
        report['status'] = 'diagnostic_complete'
        report['scope'] = ('Bounded rest-space '+('hip' if hip_study else 'shoulder')+' head shifts, fixed weights and other joints, measured after GLB reimport. Section bounds are a geometric constraint, not anatomical qualification. No promotion, game motion or appearance qualification.')
    except Exception as error:
        report.update(status='failed', error=f'{type(error).__name__}: {error}');raise
    finally:
        report['completed_unix'] = time.time();(output/'report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':main(Path(sys.argv[1]).resolve())
