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
# Multi-gate automated character validation: Skeleton, Skinning, Animations, and Geometry.
problems = []
warnings = []

# Gate 1: Skeleton Integrity & Canonical Hierarchy
skeleton_gate = {'passed': True, 'checks': {}}
if len(rigs) != 1:
    problems.append(f'Expected exactly 1 armature, found {len(rigs)}')
    skeleton_gate['passed'] = False
else:
    main_rig = rigs[0]
    bone_names = set(main_rig.data.bones.keys())
    bone_count = len(bone_names)
    skeleton_gate['bone_count'] = bone_count
    if not (15 <= bone_count <= 85):
        warnings.append(f'Bone count {bone_count} outside typical range [15, 85]')

    MANDATORY_HUMANOID = {
        'Hips', 'Spine', 'Chest', 'Head',
        'UpperArmL', 'UpperArmR', 'ForearmL', 'ForearmR', 'HandL', 'HandR',
        'ThighL', 'ThighR', 'CalfL', 'CalfR', 'FootL', 'FootR'
    }
    missing_bones = sorted(MANDATORY_HUMANOID - bone_names)
    skeleton_gate['missing_mandatory_bones'] = missing_bones
    if missing_bones:
        problems.append(f'Mandatory humanoid bones missing from candidate rig: {missing_bones}')
        skeleton_gate['passed'] = False

    # Stature sanity
    if 'Head' in bone_names and ('FootL' in bone_names or 'FootR' in bone_names):
        foot_name = 'FootL' if 'FootL' in bone_names else 'FootR'
        head_pt = main_rig.matrix_world @ main_rig.data.bones['Head'].head_local
        foot_pt = main_rig.matrix_world @ main_rig.data.bones[foot_name].head_local
        stature = abs(head_pt.z - foot_pt.z)
        skeleton_gate['stature_m'] = round(stature, 3)
        if not (0.45 <= stature <= 3.8):
            warnings.append(f'Stature {stature:.2f}m outside standard humanoid bounds [0.45m, 3.8m]')

# Gate 2: Skinning Coverage, GPU Limits & Normalization
skinning_gate = {'passed': True, 'checks': {}}
unweighted = 0
weight_error = 0
max_gpu_influences = 0
negative_or_nan = 0
rig_bone_set = {b.name for rig in rigs for b in rig.data.bones}

for obj in meshes:
    for vertex in obj.data.vertices:
        raw_weights = [g.weight for g in vertex.groups if obj.vertex_groups[g.group].name in rig_bone_set]
        active_weights = [w for w in raw_weights if math.isfinite(w) and w > 0.001]
        max_gpu_influences = max(max_gpu_influences, len(active_weights))
        if any(w < 0 or not math.isfinite(w) for w in raw_weights):
            negative_or_nan += 1
        if not active_weights:
            unweighted += 1
        elif abs(sum(active_weights) - 1.0) > 0.02:
            weight_error += 1

skinning_gate['unweighted_vertices'] = unweighted
skinning_gate['invalid_weight_sums'] = weight_error
skinning_gate['max_gpu_influences'] = max_gpu_influences
skinning_gate['negative_or_nan_weights'] = negative_or_nan

if unweighted > 0:
    problems.append(f'Skin coverage failed: {unweighted} unweighted vertices detected')
    skinning_gate['passed'] = False
if weight_error > 0:
    problems.append(f'Skin weight normalization failed: {weight_error} vertices exceed 0.02 tolerance')
    skinning_gate['passed'] = False
if max_gpu_influences > 4:
    problems.append(f'GPU skinning limit exceeded: {max_gpu_influences} influences per vertex (>4 limit)')
    skinning_gate['passed'] = False
if negative_or_nan > 0:
    problems.append(f'Invalid non-finite or negative weights: {negative_or_nan} occurrences')
    skinning_gate['passed'] = False


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
animation_gate = {'passed': True, 'checks': {}}
action_names = {action.name for action in bpy.data.actions}
REQUIRED_CLIPS = {'Idle', 'Walk', 'Run', 'Attack', 'Cast', 'Hit', 'Death'}
missing_clips = sorted(REQUIRED_CLIPS - action_names)
animation_gate['actions_present'] = sorted(action_names)
animation_gate['missing_required_clips'] = missing_clips

if missing_clips:
    problems.append(f'Required animation clips missing: {missing_clips}')
    animation_gate['passed'] = False

for action in bpy.data.actions:
    if not any(name in action.name for name in ['Idle', 'Walk', 'Run', 'Attack', 'Cast', 'Hit', 'Death']):
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
    if not math.isfinite(start) or not math.isfinite(end) or end <= start:
        problems.append('Nonpositive or nonfinite clip duration: ' + action.name)
        animation_gate['passed'] = False
        continue
    for phase in [0, .15, .42, .7, 1]:
        frame = start + (end - start) * phase
        bpy.context.scene.frame_set(int(frame), subframe=frame % 1)
        result = sample()
        frames.append({'clip': action.name, 'phase': phase, **result})
        if not result['finite']:
            problems.append('Nonfinite posed geometry: ' + action.name)
            animation_gate['passed'] = False
        tolerance = max(500, int(result.get('triangles_checked', 40000) * .02)) if 'Death' in action.name else max(150, int(result.get('triangles_checked', 40000) * .01), int(bind['self_intersections'] * .75))
        if result['self_intersections'] > bind['self_intersections'] + tolerance:
            warnings.append('Self-intersection telemetry elevated during ' + action.name)

# Gate 4: Geometry & Collision Integrity
geometry_gate = {
    'passed': not any('Nonfinite' in p for p in problems),
    'bind_self_intersections': bind.get('self_intersections', 0),
    'triangles_checked': bind.get('triangles_checked', 0)
}

# Aggregate Qualification Scoring
score = 100
if not skeleton_gate['passed']: score -= 30
if not skinning_gate['passed']: score -= 30
if not animation_gate['passed']: score -= 25
if not geometry_gate['passed']: score -= 15
score = max(0, score - min(20, len(warnings) * 4))

status = 'PASSED' if not problems else 'REJECTED'
if status == 'PASSED' and warnings:
    status = 'WARNING'

report = {
    'policy': POLICY,
    'status': status,
    'passed': not problems,
    'qualification_score': score,
    'gates': {
        'skeleton': skeleton_gate,
        'skinning': skinning_gate,
        'animations': animation_gate,
        'geometry': geometry_gate,
    },
    'problems': sorted(set(problems)),
    'warnings': sorted(set(warnings)),
    'bind': bind,
    'frames': frames,
    'unweighted_vertices': unweighted,
    'invalid_weight_sums': weight_error,
    'max_gpu_influences': max_gpu_influences,
    'scope': 'All rendered triangles, multi-gate automated qualification (skeleton, skinning <=4 influences, required clips, finite deformation).'
}
(folder / 'geometry-qualification.json').write_text(json.dumps(report, indent=2))
