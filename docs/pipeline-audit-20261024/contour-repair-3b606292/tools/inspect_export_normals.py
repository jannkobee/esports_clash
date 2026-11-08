"""Colab-only, read-only glTF skin/morph normal diagnostic.

This evaluates the stored glTF animation (including every skin influence) and
compares its shader-style normals with normals of its posed triangles and an
optional static evaluated GLB.  It does not edit an asset or qualify anatomy.
No Blender import is involved: the artifact's original accessors are inspected.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import struct

import numpy as np
from scipy.spatial import cKDTree


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class GLB:
    def __init__(self, path):
        self.path = Path(path).resolve()
        data = self.path.read_bytes()
        magic, version, length = struct.unpack_from('<III', data)
        if magic != 0x46546C67 or version != 2 or length != len(data):
            raise ValueError('Invalid GLB header')
        self.binary = None
        offset = 12
        while offset < len(data):
            size, kind = struct.unpack_from('<II', data, offset)
            value = data[offset + 8:offset + 8 + size]
            if kind == 0x4E4F534A:
                self.doc = json.loads(value)
            elif kind == 0x004E4942:
                self.binary = value
            offset += size + 8
        if self.binary is None:
            raise ValueError('GLB has no BIN chunk')
        if any(b.get('uri') for b in self.doc.get('buffers', [])):
            raise ValueError('External buffers are unsupported')

    def accessor(self, index):
        a = self.doc['accessors'][index]
        types = {5120: '<i1', 5121: '<u1', 5122: '<i2', 5123: '<u2',
                 5125: '<u4', 5126: '<f4'}
        widths = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4,
                  'MAT4': 16}
        dtype = np.dtype(types[a['componentType']])
        width = widths[a['type']]
        if 'bufferView' in a:
            view = self.doc['bufferViews'][a['bufferView']]
            if view.get('buffer', 0) != 0:
                raise ValueError('Only the internal BIN buffer is supported')
            offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
            result = np.ndarray((a['count'], width), dtype=dtype,
                                buffer=self.binary, offset=offset,
                                strides=(view.get('byteStride', width * dtype.itemsize),
                                         dtype.itemsize)).copy()
        else:
            result = np.zeros((a['count'], width), dtype=dtype)
        if 'sparse' in a:
            sparse = a['sparse']
            ind = sparse['indices']
            view = self.doc['bufferViews'][ind['bufferView']]
            ids = np.frombuffer(self.binary, dtype=types[ind['componentType']],
                                count=sparse['count'],
                                offset=view.get('byteOffset', 0) + ind.get('byteOffset', 0))
            val = sparse['values']
            view = self.doc['bufferViews'][val['bufferView']]
            replacement = np.frombuffer(self.binary, dtype=dtype,
                                         count=sparse['count'] * width,
                                         offset=view.get('byteOffset', 0) + val.get('byteOffset', 0))
            result[ids] = replacement.reshape(-1, width)
        if a.get('normalized'):
            limit = np.iinfo(dtype).max
            result = result.astype(np.float64) / limit
            if dtype.kind == 'i':
                result = np.maximum(result, -1)
        return result


def unit(values):
    values = np.asarray(values, dtype=np.float64)
    return values / np.maximum(np.linalg.norm(values, axis=-1, keepdims=True), 1e-30)


def qmatrix(q):
    x, y, z, w = unit(q)
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                     [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                     [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])


def slerp(a, b, factor):
    a, b = unit(a), unit(b)
    dot = float(np.dot(a, b))
    if dot < 0:
        b, dot = -b, -dot
    if dot > .9995:
        return unit(a + factor*(b-a))
    angle = np.arccos(np.clip(dot, -1, 1))
    return (np.sin((1-factor)*angle)*a + np.sin(factor*angle)*b)/np.sin(angle)


def sample(g, sampler, time, width, quaternion=False):
    times = g.accessor(sampler['input']).ravel()
    output = g.accessor(sampler['output']).reshape(-1, width)
    method = sampler.get('interpolation', 'LINEAR')
    if method == 'CUBICSPLINE':
        output = output.reshape(len(times), 3, width)
    if time <= times[0]:
        return output[0, 1] if method == 'CUBICSPLINE' else output[0]
    if time >= times[-1]:
        return output[-1, 1] if method == 'CUBICSPLINE' else output[-1]
    lo = int(np.searchsorted(times, time, side='right')-1)
    duration = float(times[lo+1]-times[lo])
    f = (time-times[lo])/duration
    if method == 'STEP':
        return output[lo]
    if method == 'CUBICSPLINE':
        a, b = output[lo], output[lo+1]
        result = (2*f**3-3*f**2+1)*a[1] + (f**3-2*f**2+f)*duration*a[2]
        result += (-2*f**3+3*f**2)*b[1] + (f**3-f**2)*duration*b[0]
        return unit(result) if quaternion else result
    if method != 'LINEAR':
        raise ValueError('Unsupported interpolation '+method)
    return slerp(output[lo], output[lo+1], f) if quaternion else output[lo]*(1-f)+output[lo+1]*f


def evaluate(g, phase):
    doc = g.doc
    local = []
    values = []
    for node in doc['nodes']:
        mesh = doc.get('meshes', [])[node['mesh']] if 'mesh' in node else {}
        default_weights = mesh.get('weights', [0]*len(mesh.get('primitives', [{}])[0].get('targets', [])))
        values.append({k: np.array(node.get(k, default), dtype=np.float64)
                       for k, default in [('translation', [0, 0, 0]), ('rotation', [0, 0, 0, 1]),
                                          ('scale', [1, 1, 1]), ('weights', default_weights)]})
    animation = doc.get('animations', [])
    timing = None
    if animation:
        if len(animation) != 1:
            raise ValueError('Choose an artifact with one synchronized diagnostic clip')
        animation = animation[0]
        low = min(float(g.accessor(s['input']).min()) for s in animation['samplers'])
        high = max(float(g.accessor(s['input']).max()) for s in animation['samplers'])
        time = low + phase*(high-low)
        timing = {'clip': animation.get('name'), 'start': low, 'end': high,
                  'phase': phase, 'seconds': time}
        for channel in animation['channels']:
            target = channel['target']
            index, path = target['node'], target['path']
            width = len(values[index][path])
            values[index][path] = sample(g, animation['samplers'][channel['sampler']], time,
                                         width, quaternion=path == 'rotation')
    for index, node in enumerate(doc['nodes']):
        if 'matrix' in node:
            local.append(np.array(node['matrix'], dtype=np.float64).reshape(4, 4).T)
        else:
            value = values[index]
            matrix = np.eye(4)
            matrix[:3, :3] = qmatrix(value['rotation']) @ np.diag(value['scale'])
            matrix[:3, 3] = value['translation']
            local.append(matrix)
    parents = {child: parent for parent, node in enumerate(doc['nodes'])
               for child in node.get('children', [])}
    world = {}
    def transform(index):
        if index not in world:
            world[index] = transform(parents[index]) @ local[index] if index in parents else local[index]
        return world[index]
    chunks = []
    for node_index, node in enumerate(doc['nodes']):
        if 'mesh' not in node:
            continue
        mesh = doc['meshes'][node['mesh']]
        for primitive_index, primitive in enumerate(mesh['primitives']):
            if primitive.get('mode', 4) != 4:
                raise ValueError('Only triangle primitives are supported')
            attr = primitive['attributes']
            base = g.accessor(attr['POSITION']).astype(np.float64)
            normal = g.accessor(attr['NORMAL']).astype(np.float64) if 'NORMAL' in attr else None
            if normal is None:
                raise ValueError('Missing base normals')
            points, normals = base.copy(), normal.copy()
            target_metadata = []
            normal_morphing = all('NORMAL' in t for t in primitive.get('targets', []))
            for target_index, target in enumerate(primitive.get('targets', [])):
                weight = float(values[node_index]['weights'][target_index])
                delta = g.accessor(target['POSITION']) if 'POSITION' in target else np.zeros_like(points)
                points += weight*delta
                ndelta = g.accessor(target['NORMAL']) if 'NORMAL' in target else None
                if ndelta is not None and normal_morphing:
                    normals += weight*ndelta
                target_metadata.append({'name': mesh.get('extras', {}).get('targetNames', [str(i) for i in range(len(primitive['targets']))])[target_index],
                                        'weight': weight, 'attributes': list(target),
                                        'normal_delta_lengths': stats(np.linalg.norm(ndelta, axis=1)) if ndelta is not None else None})
            joint_info = []
            if 'skin' in node:
                skin = doc['skins'][node['skin']]
                inverse_bind = g.accessor(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
                joint_matrices = np.array([transform(joint) @ ibm for joint, ibm in zip(skin['joints'], inverse_bind)])
                matrix = np.zeros((len(points), 4, 4))
                weight_sum = np.zeros(len(points))
                influences = np.zeros(len(points), dtype=int)
                for suffix in range(16):
                    if 'JOINTS_'+str(suffix) not in attr:
                        break
                    joint = g.accessor(attr['JOINTS_'+str(suffix)]).astype(int)
                    weight = g.accessor(attr['WEIGHTS_'+str(suffix)])
                    matrix += np.einsum('nk,nkij->nij', weight, joint_matrices[joint])
                    weight_sum += weight.sum(axis=1)
                    influences += (weight > 0).sum(axis=1)
                joint_info = {'bones': len(skin['joints']), 'max_influences': int(influences.max()),
                              'normalization_error': float(np.max(np.abs(weight_sum-1)))}
            else:
                matrix = np.broadcast_to(transform(node_index), (len(points), 4, 4)).copy()
            positions = np.einsum('nij,nj->ni', matrix[:, :3, :3], points) + matrix[:, :3, 3]
            linear_normals = unit(np.einsum('nij,nj->ni', matrix[:, :3, :3], normals))
            inverse_normals = unit(np.linalg.solve(matrix[:, :3, :3].transpose(0, 2, 1), normals[..., None])[..., 0])
            indices = g.accessor(primitive['indices']).ravel().astype(int) if 'indices' in primitive else np.arange(len(points))
            faces = indices.reshape(-1, 3)
            # A same-index area-weighted estimate is descriptive; split UV/hard
            # normals can differ. The static artifact is the stronger comparator.
            f = positions[faces]
            cross = np.cross(f[:, 1]-f[:, 0], f[:, 2]-f[:, 0])
            geometric = np.zeros_like(positions)
            for i in range(3):
                np.add.at(geometric, faces[:, i], cross)
            chunks.append({'node': node_index, 'primitive': primitive_index, 'positions': positions,
                           'normals': linear_normals, 'inverse_normals': inverse_normals,
                           'geometric_normals': unit(geometric), 'base_normals': normal,
                           'pre_skin_normals': normals, 'skin_matrices': matrix[:, :3, :3],
                           'uv': g.accessor(attr['TEXCOORD_0']) if 'TEXCOORD_0' in attr else None,
                           'faces': faces, 'targets': target_metadata, 'skin': joint_info,
                           'base_normal_lengths': stats(np.linalg.norm(normal, axis=1)),
                           'pre_skin_normal_lengths': stats(np.linalg.norm(normals, axis=1))})
    return chunks, timing


def stats(values):
    values = np.asarray(values)
    if not len(values):
        return {'count': 0}
    if not np.isfinite(values).all():
        raise ValueError('Nonfinite normal diagnostic values')
    return {'count': int(len(values)), 'min': float(values.min()), 'median': float(np.median(values)),
            'p90': float(np.quantile(values, .9)), 'p99': float(np.quantile(values, .99)),
            'max': float(values.max())}


def angle(a, b):
    return np.degrees(np.arccos(np.clip(np.einsum('ni,ni->n', unit(a), unit(b)), -1, 1)))


def compare(clip, static, tolerance, focus):
    source = np.concatenate([x['positions'] for x in static])
    snormals = np.concatenate([x['normals'] for x in static])
    suv = np.concatenate([x['uv'] for x in static]) if all(x['uv'] is not None for x in static) else None
    tree = cKDTree(source)
    pos = clip['positions']
    distance, nearest = tree.query(pos)
    reverse = cKDTree(pos).query(source)[0]
    matches = np.full(len(pos), -1, dtype=int)
    ambiguous = 0
    for index, candidates in enumerate(tree.query_ball_point(pos, tolerance)):
        if suv is not None and clip['uv'] is not None:
            candidates = [j for j in candidates if np.max(np.abs(suv[j]-clip['uv'][index])) < 2e-6]
        if not candidates:
            continue
        # Never select whichever duplicate normal most resembles the prediction.
        # Disagreeing coincident normals are declared ambiguous and excluded.
        ns = snormals[candidates]
        if np.max(angle(ns, np.broadcast_to(ns[0], ns.shape))) > .05:
            ambiguous += 1
            continue
        matches[index] = candidates[0]
    good = matches >= 0
    desired = snormals[matches[good]]
    linear = angle(clip['normals'][good], desired)
    inverse = angle(clip['inverse_normals'][good], desired)
    geometric = angle(clip['geometric_normals'][good], desired)
    indexes = np.flatnonzero(good)
    order = np.argsort(linear)[-30:][::-1]
    result = {'position_error': stats(distance), 'reverse_position_error': stats(reverse),
              'position_tolerance': tolerance, 'matched': int(good.sum()),
              'unmatched': int((matches < 0).sum())-ambiguous, 'ambiguous_normal_matches': ambiguous,
              'linear_skin_normal_degrees': stats(linear),
              'inverse_transpose_skin_normal_degrees': stats(inverse),
              'posed_triangle_normal_degrees': stats(geometric),
              'linear_over_5_degrees': int((linear > 5).sum()),
              'linear_over_30_degrees': int((linear > 30).sum()),
              'worst_linear': [{'vertex': int(indexes[i]), 'position': pos[indexes[i]].tolist(),
                                'degrees': float(linear[i]), 'linear_normal': clip['normals'][indexes[i]].tolist(),
                                'static_normal': desired[i].tolist()} for i in order]}
    if focus:
        center, radius = np.array(focus[:3]), focus[3]
        active = np.linalg.norm(pos[good]-center, axis=1) <= radius
        result['focus'] = {'center': center.tolist(), 'radius': radius,
                           'linear_skin_normal_degrees': stats(linear[active]),
                           'inverse_transpose_skin_normal_degrees': stats(inverse[active]),
                           'posed_triangle_normal_degrees': stats(geometric[active])}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--animated', required=True)
    parser.add_argument('--static')
    parser.add_argument('--phase', type=float, default=0)
    parser.add_argument('--output', required=True)
    parser.add_argument('--focus', nargs=4, type=float, metavar=('X', 'Y', 'Z', 'RADIUS'))
    parser.add_argument('--arrays', help='Optional new NPZ containing per-primitive evaluated diagnostics')
    args = parser.parse_args()
    if not os.environ.get('COLAB_RELEASE_TAG'):
        raise RuntimeError('Google Colab is required; no local diagnostic fallback')
    if not 0 <= args.phase <= 1:
        raise ValueError('Phase must be in [0,1]')
    output = Path(args.output).resolve()
    if output.exists() or (args.arrays and Path(args.arrays).exists()):
        raise ValueError('Refusing to overwrite diagnostic evidence')
    if not output.is_relative_to('/content/teamfight-preparation/reviews'):
        raise ValueError('Output must be in a new Colab review directory')
    if args.arrays and (Path(args.arrays).suffix != '.npz' or not Path(args.arrays).resolve().is_relative_to(output.parent)):
        raise ValueError('Arrays must be a new .npz inside the diagnostic output directory')
    report = {'compute': 'google', 'method': 'stored-gltf-normal-audit-v1',
              'qualification_complete': False, 'publication_eligible': False,
              'engine_sha256': sha(__file__), 'animated_sha256': sha(args.animated),
              'runtime': {'release': os.environ.get('COLAB_RELEASE_TAG'), 'numpy': np.__version__},
              'limitations': ['Normals are a shading diagnostic, not proof of smooth anatomical geometry.',
                              'Linear skin normals reproduce Babylon shader algebra when NONUNIFORMSCALING is absent; actual compiled defines must be recorded separately.',
                              'The inverse-transpose alternative is reported separately, never silently substituted.',
                              'Area-weighted triangle normals are descriptive and may differ at UV or deliberately split-normal seams.',
                              'Babylon manager supportsNormals and actual playback must be checked separately.']}
    try:
        g = GLB(args.animated)
        chunks, timing = evaluate(g, args.phase)
        report['animation'] = timing
        static = evaluate(GLB(args.static), 0)[0] if args.static else None
        if args.static:
            report['static_sha256'] = sha(args.static)
        positions = np.concatenate([c['positions'] for c in chunks])
        scale = float(np.max(np.ptp(positions, axis=0)))
        report['primitives'] = []
        arrays = {}
        for i, chunk in enumerate(chunks):
            row = {k: chunk[k] for k in ('node', 'primitive', 'targets', 'skin', 'base_normal_lengths', 'pre_skin_normal_lengths')}
            row.update(vertices=len(chunk['positions']), faces=len(chunk['faces']),
                       all_morphs_have_normals=all('NORMAL' in t['attributes'] for t in chunk['targets']),
                       linear_vs_posed_triangle_degrees=stats(angle(chunk['normals'], chunk['geometric_normals'])))
            if static is not None:
                row['static_comparison'] = compare(chunk, static, scale*1e-5, args.focus)
            report['primitives'].append(row)
            if args.arrays:
                arrays.update({str(i)+'_'+k: value for k, value in chunk.items() if isinstance(value, np.ndarray)})
        if args.arrays:
            np.savez_compressed(args.arrays, **arrays)
            report['arrays_sha256'] = sha(args.arrays)
        report['status'] = 'measured_unqualified'
    except Exception as error:
        report.update(status='failed', error=str(error))
        raise
    finally:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2))
    print(json.dumps({'status': report['status'], 'output': str(output), 'sha256': sha(output)}))


if __name__ == '__main__':
    main()
