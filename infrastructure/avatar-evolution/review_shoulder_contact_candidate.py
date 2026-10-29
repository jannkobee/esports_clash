"""Colab-only bone_2 shoulder repair on signed rest-space contact patches."""
from collections import defaultdict
import json
import os
from pathlib import Path
import sys
import time

from contact_patch_mask import mesh_ring_falloff, smoothstep, torso_weight_fraction, verify_contact_record
from review_generated_rig import load, surface
from review_collision_weight_candidate import digest, export_selected, measure, reset_pose, surface_roundtrip
from review_tapered_weight_candidate import weights as weight_summary

METHOD = 'signed-contact-shoulder-bone2-transfer-v1'
ARM_CONFIG = {'donor': 'bone_2', 'roles': ['UpperArmL', 'UpperArmR'],
    'maximum_donor_fraction': .12, 'falloff_rings': 3, 'target_weight_gate': [.25, .5],
    'seed_pair_policy': 'only-donor-target-contact-pair'}
TORSO_CONFIG = {'donor': 'mapped_upper_arm', 'target': 'bone_2', 'roles': ['UpperArmL', 'UpperArmR'],
    'maximum_donor_fraction': .12, 'falloff_rings': 3, 'torso_weight_gate': [.5, .75],
    'torso_groups': ['Spine', 'bone_2', 'Chest'], 'seed_pair_policy': 'only-donor-target-contact-pair'}
CONFIGURATIONS = {METHOD: ARM_CONFIG, 'signed-contact-shoulder-torso-return-v1': TORSO_CONFIG}


def vertex_weights(obj, vertex):
    return {obj.vertex_groups[group.group].name: group.weight for group in vertex.groups if group.weight > 0}


def verify_source(meshes, rest_points, contact):
    refs = [(obj, vertex) for obj in meshes for vertex in obj.data.vertices]
    if len(refs) != len(rest_points) or contact['mesh_vertex_counts'] != {obj.name: len(obj.data.vertices) for obj in meshes}:
        raise ValueError('Contact import topology/count correspondence mismatch')
    for key, record in contact['contact_vertex_records'].items():
        index = int(key)
        obj, vertex = refs[index]
        verify_contact_record(record, obj.name, vertex.index, list(rest_points[index]), vertex_weights(obj, vertex))
    return refs


def apply_patch(meshes, refs, rest_points, mapping, contact, config):
    mesh_offsets = {};offset = 0
    for obj in meshes:
        mesh_offsets[obj.name] = offset;offset += len(obj.data.vertices)
    edits = []
    for role in config['roles']:
        arm = mapping[role]
        torso_return = config['donor'] == 'mapped_upper_arm'
        donor, target = (arm, config['target']) if torso_return else (config['donor'], arm)
        torso_groups = [mapping.get(name, name) for name in config.get('torso_groups', [])]
        low, high = config['torso_weight_gate'] if torso_return else config['target_weight_gate']
        def gate(old):
            value = torso_weight_fraction(old, torso_groups, arm) if torso_return else old.get(target, 0)
            return smoothstep((value - low) / (high - low))
        diagnostic = next(row for row in contact['pose_diagnostics'] if row['joint'] == role and row['degrees'] == 90)
        region = next(row for row in diagnostic['top_region_weight_profiles'] if set(row['regions']) == {'bone_2', arm})
        seeds_by_mesh = defaultdict(set)
        for global_id in region['contact_vertex_ids']:
            obj, vertex = refs[global_id]
            old = vertex_weights(obj, vertex)
            if old.get(target, 0) > 0 and old.get(donor, 0) > 0 and gate(old) > 0:
                seeds_by_mesh[obj.name].add(vertex.index)
        if not seeds_by_mesh:
            raise ValueError('No eligible verified contact seeds for ' + role)
        for obj in meshes:
            seeds = seeds_by_mesh[obj.name]
            if not seeds:
                continue
            groups = {group.name: group for group in obj.vertex_groups}
            if target not in groups or donor not in groups:
                raise ValueError('Missing existing shoulder influence group')
            adjacency = [set() for _ in obj.data.vertices]
            for edge in obj.data.edges:
                a, b = edge.vertices;adjacency[a].add(b);adjacency[b].add(a)
            seams = defaultdict(list);start = mesh_offsets[obj.name]
            for vertex in obj.data.vertices:
                seams[tuple(round(float(c), 6) for c in rest_points[start + vertex.index])].append(vertex.index)
            seam_groups = [group for group in seams.values() if len(group) > 1]
            falloff = mesh_ring_falloff(adjacency, seam_groups, seeds, config['falloff_rings'])
            altered = []
            for index, local_falloff in sorted(falloff.items()):
                vertex = obj.data.vertices[index];old = vertex_weights(obj, vertex)
                eligibility = gate(old)
                if old.get(target, 0) <= 0:continue
                fraction = config['maximum_donor_fraction'] * local_falloff * eligibility
                amount = old.get(donor, 0) * fraction
                if amount <= 1e-8:
                    continue
                groups[donor].add([index], old[donor] - amount, 'REPLACE')
                groups[target].add([index], old[target] + amount, 'REPLACE')
                altered.append({'mesh_vertex_index': index, 'rest_world_xyz': list(rest_points[start + index]),
                    'falloff': local_falloff, 'target_gate': eligibility, 'donor_fraction': fraction,
                    'transferred_weight': amount, 'before_donor': old[donor], 'before_target': old[target]})
            edits.append({'joint': role, 'mesh': obj.name, 'donor': donor, 'target': target,
                'raw_contact_vertices': len(region['contact_vertex_ids']), 'verified_eligible_seeds': len(seeds),
                'mesh_ring_vertices': len(falloff), 'seam_groups': len(seam_groups),
                'modified_vertices': len(altered), 'mean_transferred_weight': sum(row['transferred_weight'] for row in altered) / max(1, len(altered)),
                'vertices': altered})
    if not any(row['modified_vertices'] for row in edits):
        raise ValueError('Signed contact repair made no changes')
    return edits


def main(root):
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab is required for shoulder weight repair')
    plan = json.loads((root / 'plan.json').read_text())
    for name, expected in plan['files'].items():
        if digest(root / name) != expected:
            raise ValueError('Frozen input mismatch: ' + name)
    config = CONFIGURATIONS.get(plan['method'])
    if config is None or plan['repair_config'] != config:
        raise ValueError('Frozen shoulder configuration mismatch')
    parent = json.loads((root / 'candidate-report.json').read_text())
    reference = json.loads((root / 'reference-report.json').read_text())
    baseline = json.loads((root / 'baseline-report.json').read_text())
    contact = json.loads((root / 'contact-map.json').read_text())
    if (contact['id'] != plan['contact_map_id'] or contact['parent_candidate_id'] != plan['parent_candidate_id']
            or contact['rig_sha256'] != plan['files']['candidate.glb'] or contact['source_sha256'] != baseline['source_sha256']):
        raise ValueError('Signed contact-map source mismatch')
    mapping = baseline['bone_map'];parent_poses = parent.get('reloaded_poses', parent.get('poses'))
    parent_measurement = {'reloaded_poses': parent_poses}
    output = root / 'output';output.mkdir(exist_ok=False)
    report = {'id': plan['id'], 'compute': 'google', 'publication_eligible': False, 'qualification_complete': False,
        'source_sha256': baseline['source_sha256'], 'rig_sha256': baseline['rig_sha256'],
        'parent_candidate_id': plan['parent_candidate_id'], 'reference_candidate_id': plan['reference_candidate_id'],
        'method': plan['method'], 'repair_config': config, 'started_unix': time.time()}
    try:
        report['baseline_reproduction'] = []
        for label, file, original in [('parent', 'candidate.glb', parent_poses), ('reference', 'reference.glb', reference['poses'])]:
            rigs, meshes = load(root / file)
            if len(rigs) != 1:raise ValueError('Expected one armature: ' + label)
            reset_pose(rigs[0]);measured = {};measure(rigs[0], meshes, mapping, parent_measurement, measured)
            expected = {(row['joint'], row['degrees']): row['self_intersections'] for row in original}
            reproduced = all(row['self_intersections'] == expected[(row['joint'], row['degrees'])] for row in measured['poses'])
            report['baseline_reproduction'].append({'label': label, 'reproduced': reproduced, 'poses': measured['poses']})
            if not reproduced:raise ValueError('Frozen baseline changed: ' + label)
        rigs, meshes = load(root / 'candidate.glb');reset_pose(rigs[0]);before, faces, _ = surface(meshes)
        export_selected(rigs[0], meshes, output / 'unchanged-control.glb')
        _, control_meshes = load(output / 'unchanged-control.glb');control, _, _ = surface(control_meshes)
        report['unchanged_export_roundtrip'] = surface_roundtrip(before, control)
        rigs, meshes = load(root / 'candidate.glb');rig = rigs[0];reset_pose(rig)
        before, faces, _ = surface(meshes);refs = verify_source(meshes, before, contact)
        report['contact_verification'] = {'id': contact['id'], 'source_sha256': contact['rig_sha256'],
            'input_report_sha256': plan['files']['contact-map.json'], 'verified_vertices': len(contact['contact_vertex_records']),
            'source_correspondence_verified': True}
        original_weights = {(obj.name, vertex.index): vertex_weights(obj, vertex) for obj, vertex in refs}
        report['parent_weights'] = weight_summary(meshes, rig)
        report['weight_edits'] = apply_patch(meshes, refs, before, mapping, contact, config)
        allowed = {'bone_2', mapping['UpperArmL'], mapping['UpperArmR']};changed_groups = set()
        for obj, vertex in refs:
            original = original_weights[(obj.name, vertex.index)];current = vertex_weights(obj, vertex)
            for group in original.keys() | current.keys():
                if abs(original.get(group, 0) - current.get(group, 0)) > 1e-7:
                    changed_groups.add(group)
                    if group not in allowed:raise ValueError('Unrelated influence group changed: ' + group)
        report['changed_joint_groups'] = sorted(changed_groups)
        after, after_faces, _ = surface(meshes)
        if faces != after_faces or max((a - b).length for a, b in zip(before, after)) > 1e-7:
            raise ValueError('Shoulder weight edit changed rest geometry')
        candidate = output / 'weight-transfer-candidate.glb';export_selected(rig, meshes, candidate)
        report['artifact'] = {'sha256': digest(candidate), 'bytes': candidate.stat().st_size}
        rigs, meshes = load(candidate)
        if len(rigs) != 1:raise ValueError('Candidate export changed armature count')
        rig = rigs[0];reset_pose(rig);rest, reloaded_faces, _ = surface(meshes)
        report['rest_surface_roundtrip'] = surface_roundtrip(before, rest)
        if len(faces) != len(reloaded_faces) or report['rest_surface_roundtrip']['max_nearest_distance_m'] > 1e-6:
            raise ValueError('Candidate export changed topology/rest surface')
        report['candidate_weights'] = weight_summary(meshes, rig)
        if any(not row['finite_nonnegative'] or row['unweighted_vertices'] or row['max_influences'] > 4
                or row['max_normalization_error'] > 1e-5 for row in report['candidate_weights']):
            raise ValueError('Candidate weights failed structural limits')
        measure(rig, meshes, mapping, parent_measurement, report)
        reference_counts = {(row['joint'], row['degrees']): row['self_intersections'] for row in reference['poses']}
        for row in report['poses']:
            row['reference_intersections'] = reference_counts[(row['joint'], row['degrees'])]
            row['delta_vs_reference'] = row['self_intersections'] - row['reference_intersections']
        report['non_shoulder_bends_unchanged'] = all(row['delta_vs_parent'] == 0 for row in report['poses'] if not row['joint'].startswith('UpperArm'))
        report['regressions'] = [{'joint': row['joint'], 'degrees': row['degrees'], 'delta': row['delta_vs_parent']}
            for row in report['poses'] if row['delta_vs_parent'] > 0 or row['edge_deformation']['severely_stretched_edges'] > 0]
        report['status'] = 'review_required'
        report['scope'] = 'Signed rest-space shoulder contact transfer, measured after GLB reimport; exact direction and gate are frozen in repair_config. Diagnostic candidate; game motion, appearance and qualification remain pending.'
    except Exception as error:
        report.update(status='failed', error=f'{type(error).__name__}: {error}');raise
    finally:
        report['completed_unix'] = time.time();(output / 'report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main(Path(sys.argv[1]).resolve())
