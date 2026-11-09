"""Read-only comparison of frozen avatar stages; execute only in Google Colab."""
import hashlib, json, math, os, sys
from pathlib import Path
from collections import Counter
import bpy, bmesh
from mathutils.kdtree import KDTree

root = Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
    raise RuntimeError('Avatar geometry inspection requires Google Colab')
plan = json.loads((root / 'plan.json').read_text())
for name, digest in plan['files'].items():
    if hashlib.sha256((root / name).read_bytes()).hexdigest() != digest:
        raise ValueError('Frozen input mismatch: ' + name)

def inspect(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(root / name), merge_vertices=True)
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    displays = {b.custom_shape for rig in rigs for b in rig.pose.bones if b.custom_shape}
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in displays]
    points, parts = [], []
    for obj in meshes:
        bm = bmesh.new(); bm.from_mesh(obj.data)
        unseen = set(bm.verts); components = []
        while unseen:
            seed = unseen.pop(); stack = [seed]; count = 1
            while stack:
                for edge in stack.pop().link_edges:
                    for v in edge.verts:
                        if v in unseen: unseen.remove(v); stack.append(v); count += 1
            components.append(count)
        parts.append({'vertices': len(bm.verts), 'edges': len(bm.edges), 'faces': len(bm.faces),
            'boundary_edges': sum(e.is_boundary for e in bm.edges),
            'nonmanifold_edges': sum(not e.is_manifold for e in bm.edges),
            'zero_area_faces': sum(f.calc_area() < 1e-12 for f in bm.faces),
            'component_sizes': sorted(components, reverse=True)[:20], 'component_count': len(components)})
        bm.free()
        points.extend([obj.matrix_world @ v.co for v in obj.data.vertices])
    bones = {}
    if rigs:
        rig = rigs[0]
        for role, bone_name in plan['bone_map'].items():
            bone = rig.data.bones.get(bone_name)
            if bone:
                bones[role] = {'head': list(rig.matrix_world @ bone.head_local),
                    'tail': list(rig.matrix_world @ bone.tail_local),
                    'rest_matrix': [list(row) for row in bone.matrix_local],
                    'parent': bone.parent.name if bone.parent else None}
    weights = []
    for obj in meshes:
        histogram = Counter()
        for vert in obj.data.vertices:
            histogram[sum(g.weight > 1e-8 for g in vert.groups)] += 1
        weights.append(dict(sorted(histogram.items())))
    return points, {'meshes': parts, 'rigs': len(rigs), 'bones': bones, 'influences_per_vertex': weights}

def distance(a, b):
    def direction(x, y):
        tree = KDTree(len(y))
        for i, p in enumerate(y): tree.insert(p, i)
        tree.balance(); return [tree.find(p)[2] for p in x]
    d = direction(a, b) + direction(b, a)
    return {'metric': 'symmetric vertex nearest-neighbour distance, not surface Hausdorff',
        'max': max(d), 'rms': math.sqrt(sum(x*x for x in d) / len(d))}

results = {}; surfaces = {}
for label, filename in plan['stages'].items():
    surfaces[label], results[label] = inspect(filename)
for label in ('raw', 'early', 'corrected'):
    results[label]['rest_vertex_distance_to_source'] = distance(surfaces['source'], surfaces[label])
report = {'id': plan['id'], 'compute': 'google', 'status': 'diagnostic_complete',
    'qualification_complete': False, 'publication_eligible': False,
    'scope': 'Rest geometry and rig structure only; vertex proximity is not proof of identical surfaces or posed quality.',
    'plan': plan, 'stages': results}
(root / 'geometry-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'status': report['status'], 'report_sha256': hashlib.sha256((root / 'geometry-report.json').read_bytes()).hexdigest()}))
