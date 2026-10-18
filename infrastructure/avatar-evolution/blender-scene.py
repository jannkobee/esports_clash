"""Versioned Blender inspection/export-copy workflow; original GLBs stay immutable.

Candidate geometry/curves come from the constrained generator. Import that exact
GLB, measure bind-pose intersections and pack an editable scene without replacing
the runtime file with a Blender re-export.
"""
import bpy
import json
import sys
from pathlib import Path
from mathutils.bvhtree import BVHTree

source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
assert source.suffix == '.glb' and output.suffix == '.json'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
graph = bpy.context.evaluated_depsgraph_get()
trees = []
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH': continue
    evaluated = obj.evaluated_get(graph)
    mesh = evaluated.to_mesh()
    vertices = [obj.matrix_world @ v.co for v in mesh.vertices]
    polygons = [tuple(p.vertices) for p in mesh.polygons]
    trees.append((obj.name, BVHTree.FromPolygons(vertices, polygons, all_triangles=False)))
    evaluated.to_mesh_clear()
pairs = []
for i, (name, tree) in enumerate(trees):
    for other_name, other in trees[i + 1:]:
        overlaps = tree.overlap(other)
        if overlaps: pairs.append({'parts': [name, other_name], 'triangle_pairs': len(overlaps)})
for image in bpy.data.images:
    if image.has_data: image.pack()
bpy.context.scene['avatar_evolution_source'] = source.name
bpy.context.scene['avatar_evolution_scope'] = 'Editable copy of validated GLB; runtime source is not overwritten.'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(source.with_suffix('.blend')), compress=True)
output.write_text(json.dumps({'blender': bpy.app.version_string, 'mesh_count': len(trees),
    'bind_pose_intersection_pairs': sum(p['triangle_pairs'] for p in pairs),
    'intersections': sorted(pairs, key=lambda p: p['triangle_pairs'], reverse=True)[:30],
    'scope': 'Bind-pose mesh-to-mesh BVH intersections; layered garments may intentionally intersect. Not an artistic score.',
    'editable_scene': source.with_suffix('.blend').name,
    'actions': [action.name for action in bpy.data.actions]}, indent=2))
