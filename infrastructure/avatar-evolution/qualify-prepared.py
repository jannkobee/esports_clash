"""Sample posed candidate geometry. Diagnostics are technical, not beauty scores."""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils.bvhtree import BVHTree

folder = Path(sys.argv[sys.argv.index('--') + 1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(folder / 'candidate-01.glb'))
rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
bone_displays = {bone.custom_shape for rig in rigs for bone in rig.pose.bones if bone.custom_shape}
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in bone_displays and not o.hide_render]
if not meshes:
    raise RuntimeError('Candidate contains no rendered avatar geometry')
problems = []
unweighted = 0
weight_error = 0
for obj in meshes:
    for vertex in obj.data.vertices:
        weights = [g.weight for g in vertex.groups if obj.vertex_groups[g.group].name in {b.name for rig in rigs for b in rig.data.bones}]
        if not weights:
            unweighted += 1
        elif abs(sum(weights) - 1) > .02:
            weight_error += 1
if unweighted or weight_error:
    problems.append('Skin coverage or normalized weight checks failed')


def sample():
    graph = bpy.context.evaluated_depsgraph_get()
    intersections = 0
    finite = True
    for obj in meshes:
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        # Bounded, deterministic face sampling. Adjacency is excluded. This can
        # find obvious intersections; it cannot certify absence of all clipping.
        triangles = list(mesh.loop_triangles)[::max(1, len(mesh.loop_triangles) // 2500)]
        points = [obj.matrix_world @ v.co for v in mesh.vertices]
        finite = finite and all(math.isfinite(x) for p in points for x in p)
        faces = [tuple(t.vertices) for t in triangles]
        tree = BVHTree.FromPolygons(points, faces, all_triangles=True)
        for a, b in tree.overlap(tree):
            if a < b and not set(faces[a]).intersection(faces[b]):
                intersections += 1
        evaluated.to_mesh_clear()
    return {'finite': finite, 'sampled_self_intersections': intersections}


for rig in rigs:
    rig.data.pose_position = 'REST'
bpy.context.view_layer.update()
bind = sample()
for rig in rigs:
    rig.data.pose_position = 'POSE'
frames = []
for action in bpy.data.actions:
    if not any(name in action.name for name in ['Walk', 'Run', 'Attack', 'Cast', 'Hit', 'Death']):
        continue
    for rig in rigs:
        rig.animation_data_create()
        rig.animation_data.action = action
        if hasattr(action, 'slots') and len(action.slots):
            # Blender's imported action slots carry per-object ownership. Select
            # the compatible armature slot instead of silently evaluating no rig.
            slots = [slot for slot in action.slots if slot.target_id_type == 'OBJECT']
            if len(slots) == 1:
                rig.animation_data.action_slot = slots[0]
    start, end = action.frame_range
    for phase in [0, .15, .42, .7, 1]:
        frame = start + (end - start) * phase
        bpy.context.scene.frame_set(int(frame), subframe=frame % 1)
        result = sample()
        frames.append({'clip': action.name, 'phase': phase, **result})
        if not result['finite']:
            problems.append('Nonfinite posed geometry: ' + action.name)
        if result['sampled_self_intersections'] > bind['sampled_self_intersections'] + max(12, bind['sampled_self_intersections'] * .2):
            problems.append('Sampled self-clipping increases during ' + action.name)
report = {'passed': not problems, 'problems': sorted(set(problems)), 'bind': bind, 'frames': frames,
    'unweighted_vertices': unweighted, 'invalid_weight_sums': weight_error,
    'scope': 'Deterministic sampled nonadjacent self-intersections and posed finite geometry. Layered clothing can cause false positives; sampling can miss clipping. Equipment/identity review is still required.'}
(folder / 'geometry-qualification.json').write_text(json.dumps(report, indent=2))
