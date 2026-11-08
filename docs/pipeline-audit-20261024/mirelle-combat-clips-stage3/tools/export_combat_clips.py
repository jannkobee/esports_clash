"""Bake and export the full 10-clip combat animation suite for Mirelle Candidate v14."""
import sys, os, json, math, pathlib, hashlib
import numpy as np
import bpy
from mathutils import Matrix, Quaternion, Vector

root = pathlib.Path(sys.argv[1]).resolve()
out_dir = pathlib.Path(sys.argv[2]).resolve()
out_dir.mkdir(parents=True, exist_ok=True)

sys.path.append(str(root / 'tools'))
from hip_contour_field import blend
from inspect_export_normals import GLB, sha
from glb_morph_animation import read_glb, write_glb

blend_path = root / 'contour-candidate.blend'
bpy.ops.wm.open_mainfile(filepath=str(blend_path))

rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
obj = next(o for o in bpy.data.objects if o.type == 'MESH')
armature = rig.data

mapping = json.loads((root / 'baseline-report.json').read_text())['bone_map']
landmarks = json.load(open('/content/landmarks.json'))

points = {
    'Lankle': Vector(landmarks['FootL']['head']),
    'Rankle': Vector(landmarks['FootR']['head']),
    'Lwrist': Vector(landmarks['HandL']['head']),
    'Rwrist': Vector(landmarks['HandR']['head']),
    'Lelbow': Vector(landmarks['ForearmL']['head']),
    'Relbow': Vector(landmarks['ForearmR']['head']),
    'Lshoulder': Vector(landmarks['UpperArmL']['head']),
    'Rshoulder': Vector(landmarks['UpperArmR']['head']),
    'Lhip': Vector(landmarks['ThighL']['head']),
    'Rhip': Vector(landmarks['ThighR']['head']),
}

rest_dir = {b.name: (b.tail_local - b.head_local).normalized() for b in armature.bones}
rest_rot = {b.name: b.matrix_local.to_quaternion() for b in armature.bones}

def update():
    bpy.context.view_layer.update()

def reset_pose():
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    for k in obj.data.shape_keys.key_blocks[1:]:
        k.value = 0.0
    update()

def aim(name, target, plane=None):
    update()
    pb = rig.pose.bones[name]
    head = pb.head.copy()
    dir_vec = Vector(target) - head
    if dir_vec.length < 1e-7:
        return
    if plane is not None:
        y = dir_vec.normalized()
        if name in [mapping['ThighL'], mapping['ThighR'], mapping['CalfL'], mapping['CalfR']]:
            x = plane.normalized()
            z = x.cross(y).normalized()
            x = y.cross(z).normalized()
        else:
            z = plane.normalized()
            x = y.cross(z).normalized()
            z = x.cross(y).normalized()
        rot = Matrix((x, y, z)).transposed().to_quaternion()
    else:
        rot = rest_dir[name].rotation_difference(dir_vec.normalized()) @ rest_rot[name]
    pb.matrix = Matrix.Translation(head) @ rot.to_matrix().to_4x4()
    pb.location = (0, 0, 0)
    pb.scale = (1, 1, 1)
    update()

def two_bone(upper, lower, target, pole):
    update()
    a = rig.pose.bones[upper].head.copy()
    target = Vector(target)
    direction = target - a
    l1 = armature.bones[upper].length
    l2 = armature.bones[lower].length
    length = min(l1 + l2 - 1e-5, max(abs(l1 - l2) + 1e-5, direction.length))
    axis = direction.normalized()
    distance = (l1 * l1 - l2 * l2 + length * length) / (2 * length)
    height = math.sqrt(max(0, l1 * l1 - distance * distance))
    bend_vec = Vector(pole) - a
    bend_vec -= axis * bend_vec.dot(axis)
    if bend_vec.length < 1e-6:
        bend_vec = Vector((0, -1, 0))
    joint = a + axis * distance + bend_vec.normalized() * height
    plane = axis.cross(bend_vec.normalized()).normalized()
    aim(upper, joint, plane)
    aim(lower, target, plane)
    return plane

def smooth(v):
    v = max(0.0, min(1.0, v))
    return v * v * (3.0 - 2.0 * v)

def update_morphs():
    # Evaluate UpperArmL angle
    h_arm_L = rig.pose.bones[mapping['UpperArmL']].head
    h_fore_L = rig.pose.bones[mapping['ForearmL']].head
    dir_arm_L = (h_fore_L - h_arm_L).normalized()
    angle_L = math.degrees(math.acos(max(-1.0, min(1.0, dir_arm_L.dot(rest_dir[mapping['UpperArmL']])))))
    t = max(0.0, min(1.0, angle_L / 60.0))
    a = t * t * (3.0 - 2.0 * t)
    t2 = max(0.0, min(1.0, (angle_L - 60.0) / 30.0))
    b = t2 * t2 * (3.0 - 2.0 * t2)
    obj.data.shape_keys.key_blocks['UpperArmL_60'].value = float(a * (1.0 - b))
    obj.data.shape_keys.key_blocks['UpperArmL_90'].value = float(b)

    # Evaluate UpperArmR angle
    h_arm_R = rig.pose.bones[mapping['UpperArmR']].head
    h_fore_R = rig.pose.bones[mapping['ForearmR']].head
    dir_arm_R = (h_fore_R - h_arm_R).normalized()
    angle_R = math.degrees(math.acos(max(-1.0, min(1.0, dir_arm_R.dot(rest_dir[mapping['UpperArmR']])))))
    t = max(0.0, min(1.0, angle_R / 60.0))
    a = t * t * (3.0 - 2.0 * t)
    t2 = max(0.0, min(1.0, (angle_R - 60.0) / 30.0))
    b = t2 * t2 * (3.0 - 2.0 * t2)
    obj.data.shape_keys.key_blocks['UpperArmR_60'].value = float(a * (1.0 - b))
    obj.data.shape_keys.key_blocks['UpperArmR_90'].value = float(b)

    # Evaluate ThighL angle
    h_thigh_L = rig.pose.bones[mapping['ThighL']].head
    h_calf_L = rig.pose.bones[mapping['CalfL']].head
    dir_thigh_L = (h_calf_L - h_thigh_L).normalized()
    angle_hip_L = math.degrees(math.acos(max(-1.0, min(1.0, dir_thigh_L.dot(rest_dir[mapping['ThighL']])))))
    w45, w90 = blend(angle_hip_L)
    obj.data.shape_keys.key_blocks['HipL_45'].value = float(w45)
    obj.data.shape_keys.key_blocks['HipL_90'].value = float(w90)
    obj.data.shape_keys.key_blocks['HipL_Twist20'].value = 0.0

def pose_clip(clip, phase):
    reset_pose()
    root_bone = rig.pose.bones['bone_0'] # Hips
    rotation = Quaternion()
    translation = Vector((0, 0, 0))
    wave = math.sin(2 * math.pi * phase)

    if clip in ['Walk', 'Run', 'Strafe']:
        translation.z = (-0.035 if clip == 'Run' else -0.008) + 0.008 * (1.0 - math.cos(4 * math.pi * phase))
    elif clip == 'Idle':
        translation.z = 0.0015 * (1.0 - math.cos(2 * math.pi * phase))
    elif clip == 'Hit':
        translation.y = 0.025 * math.sin(math.pi * phase)
    elif clip in ['TurnLeft', 'TurnRight']:
        rotation = Quaternion((0, 0, 1), (0.25 if clip == 'TurnLeft' else -0.25) * math.sin(math.pi * phase))
    elif clip == 'Death':
        fall = smooth((phase - 0.15) / 0.7)
        angle = math.pi / 2.0 * fall
        rotation = Quaternion((1, 0, 0), angle)
        translation = Vector((0, math.sin(angle) * 0.115, 0.12 * (1.0 - math.cos(angle))))

    transform = Matrix.Translation(translation) @ rotation.to_matrix().to_4x4()
    root_bone.matrix = transform @ armature.bones['bone_0'].matrix_local
    update()

    for side, sign in [('L', 1), ('R', -1)]:
        ankle = points[side + 'ankle'].copy()
        foot_direction = rest_dir[mapping['Foot' + side]].copy()

        if clip in ['Walk', 'Run', 'Strafe']:
            p = (phase + (0.0 if side == 'L' else 0.5)) % 1.0
            stride = 0.56 if clip == 'Run' else 0.36
            if clip == 'Strafe':
                stride = 0.13
            if p < 0.6:
                displacement = stride * (p / 0.6 - 0.5)
                lift = 0.0
            else:
                swing = (p - 0.6) / 0.4
                displacement = stride * (0.5 - smooth(swing))
                lift = (0.10 if clip == 'Run' else 0.065) * math.sin(math.pi * swing)
            if clip == 'Strafe':
                ankle.x += displacement
            else:
                ankle.y += displacement
            ankle.z += lift

        if clip == 'Death':
            ankle = transform @ ankle
            angle = math.pi / 2.0 * smooth((phase - 0.15) / 0.7)
            ankle.z += 0.12 * math.sin(2.0 * angle)
            foot_direction = Quaternion((1, 0, 0), angle * 1.5) @ foot_direction

        two_bone(mapping['Thigh' + side], mapping['Calf' + side], ankle, transform @ Vector((sign * 0.15, -0.75, 0.50)))
        update()
        aim(mapping['Foot' + side], rig.pose.bones[mapping['Foot' + side]].head + foot_direction)

        hand = points[side + 'wrist'].copy()
        if clip in ['Walk', 'Run', 'Strafe']:
            hand += Vector((sign * 0.02, (-1 if side == 'L' else 1) * 0.13 * wave, 0.02))
        elif clip == 'Attack':
            strike = math.exp(-((phase - 0.42) / 0.16) ** 2)
            hand += Vector((0, -(0.17 if side == 'R' else 0.04) * strike, 0.24 * strike))
        elif clip == 'Cast':
            spell = math.sin(math.pi * phase) ** 2
            hand += Vector((0, -0.15 * spell, 0.25 * spell))
        elif clip == 'Hit':
            hand.y -= 0.045 * math.sin(math.pi * phase)
        elif clip == 'Death':
            settle = smooth((phase - 0.05) / 0.5)
            hand = hand.lerp(points[side + 'wrist'], settle)
        elif clip in ['TurnLeft', 'TurnRight']:
            hand.x += sign * 0.015 * math.sin(math.pi * phase)

        target = transform @ hand
        plane = two_bone(mapping['UpperArm' + side], mapping['Forearm' + side], target, transform @ Vector((sign * 0.80, -0.05, 1.27)))
        update()
        forearm = rig.pose.bones[mapping['Forearm' + side]]
        direction = (forearm.tail - forearm.head).normalized()
        aim(mapping['Hand' + side], rig.pose.bones[mapping['Hand' + side]].head + direction, plane)

    update()
    update_morphs()
    update()

# Clip durations in seconds (@ 30 fps)
CLIPS = {
    'Idle': 2.0,
    'Walk': 1.0,
    'Run': 0.65,
    'Strafe': 1.0,
    'Attack': 0.85,
    'Cast': 1.2,
    'Hit': 0.5,
    'Death': 1.8,
    'TurnLeft': 0.8,
    'TurnRight': 0.8,
}

rig.animation_data_create()
obj.data.shape_keys.animation_data_create()

for clip_name, duration in CLIPS.items():
    frames = round(duration * 30)
    action_rig = bpy.data.actions.new(name=clip_name + '_Rig')
    action_rig.use_fake_user = True
    rig.animation_data.action = action_rig

    action_keys = bpy.data.actions.new(name=clip_name + '_Keys')
    action_keys.use_fake_user = True
    obj.data.shape_keys.animation_data.action = action_keys

    for frame in range(frames + 1):
        phase = frame / float(frames)
        pose_clip(clip_name, phase)

        for pb in rig.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.keyframe_insert('rotation_quaternion', frame=frame)
            if pb.name == 'bone_0':
                pb.keyframe_insert('location', frame=frame)
            pb.keyframe_insert('scale', frame=frame)

        for k in obj.data.shape_keys.key_blocks[1:]:
            k.keyframe_insert('value', frame=frame)

raw_glb = out_dir / 'mirelle-combat-clips-raw.glb'
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
obj.select_set(True)
bpy.context.view_layer.objects.active = rig

bpy.ops.export_scene.gltf(
    filepath=str(raw_glb),
    export_format='GLB',
    use_selection=True,
    export_animations=True,
    export_animation_mode='ACTIONS',
    export_force_sampling=True,
    export_skins=True,
    export_morph=True,
    export_all_influences=True
)
print('RAW_GLB_EXPORTED_BYTES=', raw_glb.stat().st_size)

# Post-process: merge actions and inject corrected morph normals
doc, binary = read_glb(raw_glb)

clip_animations = {}
for anim in doc.get('animations', []):
    name = anim['name']
    base_name = name.replace('_Rig', '').replace('_Keys', '')
    if base_name not in clip_animations:
        clip_animations[base_name] = {'name': base_name, 'samplers': [], 'channels': []}
    sampler_offset = len(clip_animations[base_name]['samplers'])
    clip_animations[base_name]['samplers'].extend(anim['samplers'])
    for ch in anim['channels']:
        clip_animations[base_name]['channels'].append({
            'sampler': ch['sampler'] + sampler_offset,
            'target': ch['target']
        })
doc['animations'] = [clip_animations[c] for c in CLIPS.keys() if c in clip_animations]

# Inject normal deltas from normal-corrected.glb for UpperArmL_60, UpperArmL_90, UpperArmR_60, UpperArmR_90
norm_glb_path = root / 'normal-stage' / 'normal-corrected.glb'
g_norm = GLB(norm_glb_path)

def add_normal_accessor(d, bin_bytes, values):
    padding = (-len(bin_bytes)) % 4
    bin_bytes += b'\x00' * padding
    offset = len(bin_bytes)
    encoded = np.asarray(values, dtype='<f4').tobytes()
    bin_bytes += encoded
    view_idx = len(d['bufferViews'])
    d['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(encoded)})
    acc_idx = len(d['accessors'])
    d['accessors'].append({'bufferView': view_idx, 'componentType': 5126, 'count': len(values), 'type': 'VEC3'})
    d['buffers'][0]['byteLength'] = len(bin_bytes)
    return acc_idx, bin_bytes

bin_buf = bytearray(binary)
prim = doc['meshes'][0]['primitives'][0]
target_names = doc['meshes'][0].get('extras', {}).get('targetNames', [])

for t_idx, t_name in enumerate(target_names):
    if t_name in ['UpperArmL_60', 'UpperArmL_90', 'UpperArmR_60', 'UpperArmR_90']:
        source_acc = g_norm.doc['meshes'][0]['primitives'][0]['targets'][t_idx]['NORMAL']
        source_normals = g_norm.accessor(source_acc)
        new_acc, bin_buf = add_normal_accessor(doc, bin_buf, source_normals)
        prim['targets'][t_idx]['NORMAL'] = new_acc
        print(f'INJECTED_NORMAL: target={t_name} acc={new_acc}')

final_glb = out_dir / 'mirelle-combat-clips.glb'
write_glb(final_glb, doc, bytes(bin_buf))
print('FINAL_GLB_WRITTEN_BYTES=', final_glb.stat().st_size)
print('FINAL_GLB_SHA256=', sha(final_glb))
