"""Sample posed candidate geometry. Diagnostics are technical, not beauty scores."""
import bpy
import json
import math
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from mesh_validation import collision_summary,rest_keys,POLICY

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
    graph=bpy.context.evaluated_depsgraph_get();finite=True;points=[];faces=[];keys=[];labels=[]
    for obj in meshes:
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles();offset=len(points)
            current=[obj.matrix_world@v.co for v in mesh.vertices]
            finite=finite and all(math.isfinite(x) for p in current for x in p)
            points.extend(current);keys.extend(rest_keys([obj.matrix_world@v.co for v in obj.data.vertices]))
            for triangle in mesh.loop_triangles:
                face=tuple(triangle.vertices);faces.append(tuple(offset+i for i in face));mass={}
                for index in face:
                    for g in obj.data.vertices[index].groups:
                        name=obj.vertex_groups[g.group].name;mass[name]=mass.get(name,0)+g.weight
                labels.append(min(mass,key=lambda name:(-mass[name],name)) if mass else 'unweighted')
        finally:evaluated.to_mesh_clear()
    if not finite:return {'finite':False,'self_intersections':0,'triangles_checked':len(faces),'top_regions':[]}
    return collision_summary(points,faces,keys,labels)


for rig in rigs:
    rig.data.pose_position = 'REST'
bpy.context.view_layer.update()
bind = sample()
for rig in rigs:
    rig.data.pose_position = 'POSE'
frames = []
warnings = []
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
        tolerance = max(500, int(result.get('triangles_checked', 40000) * .02)) if 'Death' in action.name else max(150, int(result.get('triangles_checked', 40000) * .01), int(bind['self_intersections'] * .75))
        if result['self_intersections'] > bind['self_intersections'] + tolerance:
            warnings.append('Self-intersection telemetry elevated during ' + action.name)
report = {'policy':POLICY,'passed': not problems, 'problems': sorted(set(problems)), 'warnings': sorted(set(warnings)), 'bind': bind, 'frames': frames,
    'unweighted_vertices': unweighted, 'invalid_weight_sums': weight_error,
    'scope':'All rendered triangles, excluding adjacency by rest-coordinate seams. Finite poses and full-mesh intersections; counts are not comparable to legacy sampled reports. Clothing/contact interpretation and equipment identity still require review.'}
(folder / 'geometry-qualification.json').write_text(json.dumps(report, indent=2))
