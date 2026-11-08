"""Colab-only proposal for left-shoulder glTF morph NORMAL preservation.

Only UpperArmL_60 and UpperArmL_90 NORMAL accessors may change. Source BIN
bytes, every POSITION/skin/animation accessor, base NORMAL and all other
target normals remain untouched. By default this writes a diagnostic report
only; --apply additionally writes a distinct, unqualified GLB.

Sample JSON:
{"targets": [{"target": "UpperArmL_60", "phase": 0.06, "static": "...glb"},
             {"target": "UpperArmL_90", "phase": 0.10, "static": "...glb"}],
 "heldouts": [{"name": "elbow-twist", "phase": 0.5, "static": "...glb"}]}

Optional target `support_indices` is an explicit list of exported GLB vertex
indices, not Blender indices. Otherwise support is the existing target's
nonzero POSITION delta. The report records this choice and exact support hash.
The existing shape target and collision evidence are never replaced by this
shading diagnostic.
"""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import struct

import numpy as np
from scipy.spatial import cKDTree

from inspect_export_normals import GLB, angle, compare, evaluate, sha, stats, unit


ALLOWED = {'UpperArmL_60', 'UpperArmL_90'}


def one_primitive(g, phase):
    chunks, timing = evaluate(g, phase)
    if len(chunks) != 1:
        raise ValueError('This bounded helper requires the current single mesh primitive')
    return chunks[0], timing


def match_static(chunk, static, tolerance):
    positions = np.concatenate([c['positions'] for c in static])
    normals = np.concatenate([c['normals'] for c in static])
    if chunk['uv'] is None or any(c['uv'] is None for c in static):
        raise ValueError('Position-plus-UV correspondence requires all original UVs')
    uv = np.concatenate([c['uv'] for c in static])
    tree = cKDTree(positions)
    ids = np.full(len(chunk['positions']), -1, dtype=int)
    ambiguous = []
    for index, candidates in enumerate(tree.query_ball_point(chunk['positions'], tolerance)):
        candidates = [j for j in candidates if np.max(np.abs(uv[j]-chunk['uv'][index])) < 2e-6]
        if not candidates:
            continue
        ns = normals[candidates]
        if np.max(angle(ns, np.broadcast_to(ns[0], ns.shape))) > .05:
            ambiguous.append(index)
            continue
        ids[index] = candidates[0]
    return ids, normals, ambiguous


def add_normal_accessor(g, values):
    # New storage prevents an aliased/interleaved original accessor from being
    # modified through another attribute. Even the obsolete original normal
    # accessor remains intact in the source BIN prefix.
    padding = (-len(g.binary)) % 4
    g.binary += b'\x00'*padding
    offset = len(g.binary)
    encoded = np.asarray(values, dtype='<f4').tobytes()
    g.binary += encoded
    view_index = len(g.doc['bufferViews'])
    g.doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(encoded)})
    accessor_index = len(g.doc['accessors'])
    g.doc['accessors'].append({'bufferView': view_index, 'componentType': 5126,
                               'count': len(values), 'type': 'VEC3'})
    g.doc['buffers'][0]['byteLength'] = len(g.binary)
    return accessor_index


def write_glb(path, g):
    encoded = json.dumps(g.doc, separators=(',', ':')).encode('utf-8')
    encoded += b' '*((-len(encoded)) % 4)
    binary = g.binary + b'\x00'*((-len(g.binary)) % 4)
    length = 12+8+len(encoded)+8+len(binary)
    with Path(path).open('xb') as stream:
        stream.write(struct.pack('<III', 0x46546C67, 2, length))
        stream.write(struct.pack('<II', len(encoded), 0x4E4F534A))
        stream.write(encoded)
        stream.write(struct.pack('<II', len(binary), 0x004E4942))
        stream.write(binary)


def verify_unchanged(source, candidate, changed):
    restored = copy.deepcopy(candidate.doc)
    for mesh_index, primitive_index, target_index, original_accessor in changed:
        restored['meshes'][mesh_index]['primitives'][primitive_index]['targets'][target_index]['NORMAL'] = original_accessor
    restored['accessors'] = restored['accessors'][:len(source.doc['accessors'])]
    restored['bufferViews'] = restored['bufferViews'][:len(source.doc['bufferViews'])]
    restored['buffers'][0]['byteLength'] = source.doc['buffers'][0]['byteLength']
    if restored != source.doc or candidate.binary[:len(source.binary)] != source.binary:
        raise ValueError('Unexpected non-NORMAL change')
    return {'original_bin_prefix_preserved': True, 'all_original_accessors_unchanged': True,
            'rest_base_normals_unchanged': True, 'positions_skins_animations_unchanged': True,
            'only_references_changed': 'Two left-shoulder morph NORMAL accessor references',
            'appended_accessors': len(candidate.doc['accessors'])-len(source.doc['accessors'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--animated', required=True)
    parser.add_argument('--samples', required=True)
    parser.add_argument('--report', required=True)
    parser.add_argument('--output-glb')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not os.environ.get('COLAB_RELEASE_TAG'):
        raise RuntimeError('Google Colab required; no local diagnostic fallback')
    report_path = Path(args.report).resolve()
    if not report_path.is_relative_to('/content/teamfight-preparation/reviews') or report_path.exists():
        raise ValueError('Report must be new evidence in a Colab review directory')
    if args.apply:
        if not args.output_glb:
            raise ValueError('--apply requires --output-glb')
        glb_path = Path(args.output_glb).resolve()
        if not glb_path.is_relative_to(report_path.parent) or glb_path.exists():
            raise ValueError('New GLB must be in the report directory and must not exist')
    report = {'compute': 'google', 'method': 'left-shoulder-morph-normal-preservation-v1',
              'engine_sha256': sha(__file__), 'probe_engine_sha256': sha(Path(__file__).with_name('inspect_export_normals.py')),
              'source_sha256': sha(args.animated), 'samples_sha256': sha(args.samples),
              'qualification_complete': False, 'publication_eligible': False,
              'normal_formula': 'normalize(weighted_joint_matrix_3x3 * pre_skin_morph_normal)',
              'requires_actual_babylon_define': 'NONUNIFORMSCALING absent',
              'targets': [], 'samples': [],
              'limitations': ['Changes shading only, never geometry or self-intersection counts.',
                              'Training-pose agreement does not establish interpolation or anatomical quality.',
                              'Normal-only correction is allowed only on the explicitly recorded target support.',
                              'Actual stored GLB playback and compiled Babylon shader defines remain mandatory.']}
    try:
        source = GLB(args.animated)
        candidate = copy.copy(source)
        candidate.doc = copy.deepcopy(source.doc)
        rest, _ = one_primitive(source, 0)
        correspondence_height = float(np.ptp(rest['positions'][:, 1]))
        report['correspondence_rest_height'] = correspondence_height
        tolerance = correspondence_height*1e-5
        specification = json.loads(Path(args.samples).read_text())
        rows = specification['targets']
        if len(rows) != 2 or {row['target'] for row in rows} != ALLOWED:
            raise ValueError('Exactly the two existing left-shoulder targets are required')
        changed = []
        support_by_target = {}
        for row in rows:
            target_name = row['target']
            if not 0 <= float(row['phase']) <= 1:
                raise ValueError('Training phase must be in [0,1]')
            chunk, timing = one_primitive(source, float(row['phase']))
            node = source.doc['nodes'][chunk['node']]
            mesh_index, primitive_index = node['mesh'], chunk['primitive']
            primitive = source.doc['meshes'][mesh_index]['primitives'][primitive_index]
            names = source.doc['meshes'][mesh_index]['extras']['targetNames']
            target_index = names.index(target_name)
            target = primitive['targets'][target_index]
            if any(abs(t['weight']-(1 if t['name'] == target_name else 0)) > 1e-5 for t in chunk['targets']):
                raise ValueError('Target training pose must activate only '+target_name+' at unit strength')
            if 'NORMAL' not in target or 'POSITION' not in target:
                raise ValueError('Existing target NORMAL and POSITION accessors are required')
            static = evaluate(GLB(row['static']), 0)[0]
            position_check = compare(chunk, static, tolerance, None)
            if max(position_check['position_error']['max'], position_check['reverse_position_error']['max']) > tolerance:
                raise ValueError('Training static geometry does not match this exact animated pose')
            matches, desired_normals, ambiguous = match_static(chunk, static, tolerance)
            position_delta = source.accessor(target['POSITION'])
            if 'support_indices' in row:
                indices = np.array(row['support_indices'], dtype=np.int64)
                if len(indices) != len(set(indices.tolist())) or len(indices) == 0 or indices.min() < 0 or indices.max() >= len(position_delta):
                    raise ValueError('Invalid explicit GLB-index normal support')
                support = np.zeros(len(position_delta), dtype=bool)
                support[indices] = True
                support_method = 'explicit source-GLB vertex indices from hashed samples JSON'
            else:
                support = np.any(position_delta != 0, axis=1)
                support_method = 'exact nonzero POSITION deltas of this unchanged target'
            if not support.any():
                raise ValueError('Empty target support')
            if (matches[support] < 0).any():
                raise ValueError('Unmatched or ambiguous normal on editable support')
            matrices = chunk['skin_matrices'][support]
            condition = np.linalg.cond(matrices)
            if condition.max() > 10:
                raise ValueError('Inverse normal transport is ill-conditioned')
            desired = desired_normals[matches[support]]
            pre_skin = unit(np.linalg.solve(matrices, desired[..., None])[..., 0])
            original_delta = source.accessor(target['NORMAL'])
            new_delta = original_delta.copy()
            new_delta[support] = pre_skin-chunk['base_normals'][support]
            accessor = add_normal_accessor(candidate, new_delta)
            candidate.doc['meshes'][mesh_index]['primitives'][primitive_index]['targets'][target_index]['NORMAL'] = accessor
            changed.append((mesh_index, primitive_index, target_index, target['NORMAL']))
            support_by_target[target_name] = support
            report['targets'].append({'name': target_name, 'animation': timing,
                                      'static_sha256': sha(row['static']), 'support_method': support_method,
                                      'support_vertices': int(support.sum()),
                                      'support_indices_sha256': hashlib.sha256(np.flatnonzero(support).astype('<u4').tobytes()).hexdigest(),
                                      'unchanged_outside_support': bool(np.array_equal(new_delta[~support], original_delta[~support])),
                                      'ambiguous_matches_outside_support': len(ambiguous),
                                      'inverse_condition': stats(condition),
                                      'pre_skin_direction_change_degrees': stats(angle(chunk['pre_skin_normals'][support], pre_skin)),
                                      'old_accessor': target['NORMAL'], 'new_accessor': accessor,
                                      'normal_delta_sha256': hashlib.sha256(np.asarray(new_delta, dtype='<f4').tobytes()).hexdigest()})
        report['preservation'] = verify_unchanged(source, candidate, changed)
        for row in rows + specification.get('heldouts', []):
            if not 0 <= float(row['phase']) <= 1:
                raise ValueError('Sample phase must be in [0,1]')
            before, timing = one_primitive(source, float(row['phase']))
            after, _ = one_primitive(candidate, float(row['phase']))
            if not np.array_equal(before['positions'], after['positions']):
                raise ValueError('Normal-only candidate changed sampled positions')
            static = evaluate(GLB(row['static']), 0)[0]
            before_compare = compare(before, static, tolerance, None)
            after_compare = compare(after, static, tolerance, None)
            if max(before_compare['position_error']['max'], before_compare['reverse_position_error']['max']) > tolerance:
                raise ValueError('Held-out static geometry does not match this exact animated pose')
            matches, desired, _ = match_static(before, static, tolerance)
            active = np.zeros(len(matches), dtype=bool)
            for target in before['targets']:
                if target['name'] in support_by_target and abs(target['weight']) > 1e-8:
                    active |= support_by_target[target['name']]
            good = active & (matches >= 0)
            support_before = angle(before['normals'][good], desired[matches[good]])
            support_after = angle(after['normals'][good], desired[matches[good]])
            report['samples'].append({'name': row.get('name', row.get('target')), 'animation': timing,
                                      'training': row in rows, 'static_sha256': sha(row['static']),
                                      'positions_exactly_unchanged': True,
                                      'before': before_compare, 'after': after_compare,
                                      'active_support_before_degrees': stats(support_before),
                                      'active_support_after_degrees': stats(support_after),
                                      'support_vertices_worse_over_1_degree': int((support_after > support_before+1).sum())})
        report['sampled_normal_regressions'] = [r['name'] for r in report['samples'] if r['support_vertices_worse_over_1_degree']]
        if args.apply:
            write_glb(args.output_glb, candidate)
            reloaded = GLB(args.output_glb)
            verify_unchanged(source, reloaded, changed)
            report.update(status='patched_requires_visual_review', candidate_sha256=sha(args.output_glb))
        else:
            report['status'] = 'diagnosed_not_written'
        report['heldout_samples'] = len(specification.get('heldouts', []))
    except Exception as error:
        report.update(status='failed', error=str(error))
        raise
    finally:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2))
    print(json.dumps({'status': report['status'], 'report': str(report_path), 'sha256': sha(report_path)}))


if __name__ == '__main__':
    main()
