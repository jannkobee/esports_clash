"""Constrained bind-relative animation transfer; no time resampling or skin edits."""
import math
from mathutils import Quaternion, Euler, Vector, Matrix

ARM_SEGMENTS = {'UpperArmL':'ForearmL','ForearmL':'HandL','HandL':None,
                'UpperArmR':'ForearmR','ForearmR':'HandR','HandR':None}

def character_frame(rig):
    """An anatomical frame, independent of imported axis/left-right conventions."""
    point=lambda name:rig.matrix_world@rig.data.bones[name].head_local
    up=(point('Head')-point('Hips')).normalized()
    right=point('UpperArmR')-point('UpperArmL')
    right=(right-up*right.dot(up)).normalized()
    if right.length<.9 or up.length<.9:raise RuntimeError('Degenerate humanoid reference frame')
    forward=up.cross(right).normalized()
    return Matrix((right,forward,up)).transposed().to_quaternion()

def calibrate_arms(source,target,outward_degrees=0):
    """Match anatomical Idle segment directions without changing either bind pose.

    A donor may be authored with lowered arms and reversed bone-tail axes while
    an inferred rig is in T-pose. Copying local animation deltas alone cannot
    bridge those reference poses. Preserve the donor's complete world-space
    motion around a calibrated target stance instead.
    """
    alignment=character_frame(target)@character_frame(source).inverted()
    result={}
    for name,child in ARM_SEGMENTS.items():
        a=source.pose.bones[name];b=target.data.bones[name]
        if child:
            source_direction=source.matrix_world.to_3x3()@(source.pose.bones[child].head-a.head)
            target_direction=target.matrix_world.to_3x3()@(target.data.bones[child].head_local-b.head_local)
        else:
            # Imported donor hand tails may point back toward the elbow.
            source_direction=source.matrix_world.to_3x3()@(a.head-source.pose.bones['Forearm'+name[-1]].head)
            target_direction=target.matrix_world.to_3x3()@(b.tail_local-b.head_local)
        if min(source_direction.length,target_direction.length)<1e-7:raise RuntimeError('Collapsed arm calibration segment: '+name)
        desired=alignment@source_direction
        if name.startswith('UpperArm') and outward_degrees:
            # Hold equipment clear of chest/pauldron volume while retaining a
            # lowered guard. This is a pose correction, never a timing change.
            axis=character_frame(target)@Vector((0,1,0))
            desired=Quaternion(axis,math.radians(outward_degrees)*(1 if name.endswith('L') else -1))@desired
        stance=target_direction.rotation_difference(desired)
        result[name]={'alignment':alignment.copy(),'reference':(source.matrix_world@a.matrix).to_quaternion(),
                      'stance':stance@(target.matrix_world@b.matrix_local).to_quaternion()}
    return result

def apply_calibrated_arms(source,target,calibration):
    import bpy
    for name,reference in calibration.items():
        a=source.pose.bones[name];b=target.pose.bones[name]
        alignment=reference['alignment']
        delta=alignment@(source.matrix_world@a.matrix).to_quaternion()@reference['reference'].inverted()@alignment.inverted()
        rotation=target.matrix_world.to_quaternion().inverted()@delta@reference['stance']
        b.matrix=Matrix.LocRotScale(b.head.copy(),rotation,b.matrix.to_scale())
        bpy.context.view_layer.update()

def grip_pose(rig,slots):
    """Close only short, branching anatomical finger chains on equipped hands."""
    result={}
    for slot in slots:
        hand=rig.data.bones['HandR' if slot=='primary' else 'HandL']
        chains=[]
        for child in hand.children:
            chain=[child]
            while len(chain[-1].children)==1 and len(chain)<4:chain.append(chain[-1].children[0])
            if len(chain) in (2,3) and sum(b.length for b in chain)<hand.length*5:chains.append(chain)
        if len(chains) not in (4,5):continue
        forward=(rig.matrix_world.to_3x3()@(hand.tail_local-hand.head_local)).normalized()
        axis=forward.cross(Vector((0,-1,0)))
        if axis.length<.1:continue
        axis.normalize()
        for chain in chains:
            direction=(rig.matrix_world.to_3x3()@(chain[0].tail_local-chain[0].head_local)).normalized()
            thumb=direction.dot(forward)<.65
            for index,bone in enumerate(chain):
                local=(rig.matrix_world@bone.matrix_local).to_quaternion().inverted()@axis
                result[bone.name]=Quaternion(local,math.radians(([22,35,20] if thumb else [35,60,40])[index]))
    return result

def mount_equipment(rig,folder,assets):
    """Fit immutable static weapon meshes in Idle, then rigid-skin to real hands."""
    import bpy,hashlib
    from mesh_validation import MAX_FACES
    from mesh_cleanup import cleanup_mesh
    result=[]
    body_faces=0
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH':obj.data.calc_loop_triangles();body_faces+=len(obj.data.loop_triangles)
    face_budget=min(5000,(MAX_FACES-body_faces-128)//max(1,len(assets)))
    if assets and face_budget<1000:raise RuntimeError('Body leaves insufficient geometry budget for equipped qualification')
    for asset in assets:
        path=folder/('equipment-'+asset['slot']+'.'+asset['format'])
        if hashlib.sha256(path.read_bytes()).hexdigest()!=asset['sha256']:raise RuntimeError('Equipment asset hash mismatch')
        before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(path))
        added=[obj for obj in bpy.context.scene.objects if obj not in before]
        meshes=[obj for obj in added if obj.type=='MESH']
        if not meshes or any(obj.type=='ARMATURE' for obj in added):raise RuntimeError('Equipment must be a separate static mesh')
        original_faces=0
        for obj in meshes:
            cleanup_mesh(obj,weld_dist=.000001,fill_small_holes=False)
            obj.data.calc_loop_triangles();original_faces+=len(obj.data.loop_triangles)
        for obj in meshes:
            if original_faces>face_budget:
                modifier=obj.modifiers.new('Equipment render budget','DECIMATE');modifier.ratio=face_budget/original_faces
                modifier.use_collapse_triangulate=True;bpy.context.view_layer.objects.active=obj
                bpy.ops.object.modifier_apply(modifier=modifier.name)
        fitted_faces=0
        for obj in meshes:obj.data.calc_loop_triangles();fitted_faces+=len(obj.data.loop_triangles)
        bpy.context.view_layer.update()
        points=[obj.matrix_world@vertex.co for obj in meshes for vertex in obj.data.vertices]
        lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
        if hi.z-lo.z<1e-6:raise RuntimeError('Equipment needs a valid upright extent')
        hand_name='HandR' if asset['slot']=='primary' else 'HandL'
        hand=rig.pose.bones[hand_name]
        height=(rig.matrix_world.to_3x3()@(rig.data.bones['Head'].head_local-rig.data.bones['FootL'].head_local)).length
        shield=asset.get('weapon_type')=='shield'
        # Validated physical sizing: calibrate against standardized humanoid stature (180 cm).
        avatar_height_cm=float(asset.get('avatar_height_cm') or 180.0)
        default_weapon_cm=90.0 if shield else 120.0
        weapon_height_cm=float(asset.get('height_cm') or default_weapon_cm)
        if not (5.0 <= weapon_height_cm <= 300.0 and 50.0 <= avatar_height_cm <= 300.0):
            raise RuntimeError(f'Invalid physical equipment dimensions: {weapon_height_cm}cm / {avatar_height_cm}cm')
        ratio=weapon_height_cm/avatar_height_cm
        scale=height*ratio/(hi.z-lo.z)
        # The reference sword grip lies below its guard; shield grip is centered
        # on its rear surface. Geometry stays independent of the body skin.
        origin=Vector(((lo.x+hi.x)*.5,lo.y if shield else (lo.y+hi.y)*.5,(lo.z+hi.z)*.5 if shield else lo.z+(hi.z-lo.z)*.17))
        palm=rig.matrix_world@hand.matrix@Vector((0,hand.bone.length*.65,0))
        if shield:palm+=Vector((-.025,-.025,.04))
        rotation=Matrix.Rotation(math.pi,4,'Z') if shield else Matrix.Rotation(math.radians(15),4,'Y')
        fitted=Matrix.Translation(palm)@rotation@Matrix.Scale(scale,4)@Matrix.Translation(-origin)
        posed_to_rest=hand.bone.matrix_local@hand.matrix.inverted()@rig.matrix_world.inverted()
        for obj in meshes:
            obj.data.transform(posed_to_rest@fitted@obj.matrix_world);obj.data.update()
            obj.parent=rig;obj.parent_type='OBJECT';obj.matrix_parent_inverse=Matrix.Identity(4);obj.matrix_world=rig.matrix_world.copy()
            obj.vertex_groups.clear();group=obj.vertex_groups.new(name=hand_name);group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
            modifier=obj.modifiers.new('Rigid hand equipment','ARMATURE');modifier.object=rig
            obj.name='equipment-'+asset['slot'];obj['modularEquipment']={'slot':asset['slot'],'sha256':asset['sha256'],'bone':hand_name}
        part='right-grip' if asset['slot']=='primary' else 'left-grip'
        socket=next((obj for obj in bpy.context.scene.objects if obj.get('avatarPart')==part),None)
        if socket:
            socket.parent=rig;socket.parent_type='BONE';socket.parent_bone=hand_name;bpy.context.view_layer.update()
            socket.matrix_world=Matrix.Translation(palm)@rotation@Matrix.Scale(rig.matrix_world.to_scale().length/math.sqrt(3),4)
            bpy.context.view_layer.update()
            tip=fitted@Vector(((lo.x+hi.x)*.5,(lo.y+hi.y)*.5,hi.z))
            socket['weaponTip']=list(socket.matrix_world.inverted()@tip);socket['weaponBase']=[0,0,0];socket['weaponStyle']='blade' if not shield else 'magic'
        for obj in added:
            if obj.type!='MESH' and obj.name in bpy.data.objects:bpy.data.objects.remove(obj,do_unlink=True)
        result.append({**asset,'bone':hand_name,'socket':part,'height_ratio':ratio,'height_cm':weapon_height_cm,'avatar_height_cm':avatar_height_cm,'fit':'idle-palm-relative rigid skin','grip_fraction':.5 if shield else .17,
            'geometry_budget':{'source_triangles':original_faces,'fitted_triangles':fitted_faces,'target_triangles':face_budget,'body_geometry':'unchanged'}})
    return result

EQUIPMENT_PROFILE = {
    'name': 'equipment-clearance-v2',
    'attack_upper_body_gain': .64,
    'cast_upper_body_gain': .7,
    'hit_upper_body_gain': .7,
    'death_deformation_gain': .75,
    'clip_timing': 'unchanged'
}

ATTACK_JOINTS = {'Chest', 'left-arm', 'right-arm', 'UpperArmL', 'UpperArmR', 'ForearmL', 'ForearmR', 'HandL', 'HandR'}

# Archer posture clearance: holds the longbow safely outward away from hips/torso during movement
# to prevent longbow self-intersection with legs and coat panels, and abducts the draw arm clear of skirt flares.
ARCHER_CLEARANCE = {
    'UpperArmL': {
        'Walk': Euler((0, math.radians(14), math.radians(16))).to_quaternion(),
        'Run': Euler((0, math.radians(18), math.radians(20))).to_quaternion(),
        'Strafe': Euler((0, math.radians(14), math.radians(16))).to_quaternion(),
        'Idle': Euler((0, math.radians(10), math.radians(12))).to_quaternion(),
        'Cast': Euler((math.radians(12), math.radians(8), math.radians(16))).to_quaternion(),
    },
    'ForearmL': {
        'Walk': Euler((0, 0, math.radians(-8))).to_quaternion(),
        'Run': Euler((0, 0, math.radians(-10))).to_quaternion(),
        'Strafe': Euler((0, 0, math.radians(-8))).to_quaternion(),
        'Idle': Euler((0, 0, math.radians(-6))).to_quaternion(),
        'Cast': Euler((0, 0, math.radians(-12))).to_quaternion(),
    },
    'UpperArmR': {
        'Walk': Euler((0, math.radians(-12), math.radians(-14))).to_quaternion(),
        'Run': Euler((0, math.radians(-16), math.radians(-18))).to_quaternion(),
        'Strafe': Euler((0, math.radians(-10), math.radians(-12))).to_quaternion(),
        'Idle': Euler((0, math.radians(-6), math.radians(-8))).to_quaternion(),
        'Cast': Euler((math.radians(10), math.radians(-10), math.radians(-12))).to_quaternion(),
    },
    'ForearmR': {
        'Walk': Euler((0, 0, math.radians(8))).to_quaternion(),
        'Run': Euler((0, 0, math.radians(10))).to_quaternion(),
        'Strafe': Euler((0, 0, math.radians(8))).to_quaternion(),
        'Idle': Euler((0, 0, math.radians(6))).to_quaternion(),
    }
}

def compute_archer_attack_delta(joint, phase, base_delta):
    """Procedural archer longbow draw & release curves with MOBA kinetic snap timing.
    Phase 0.00-0.42: Ease-in bow extension & bowstring draw (anticipation).
    Phase 0.42-0.48: Apex tension hold.
    Phase 0.48-0.52: Explosive snap release with bow recoil.
    Phase 0.52-1.00: Damped elastic follow-through and return to stance.
    """
    draw_targets = {
        'UpperArmL': Euler((math.radians(56), math.radians(6), math.radians(14))).to_quaternion(),
        'ForearmL': Euler((math.radians(-8), 0, math.radians(-4))).to_quaternion(),
        'Chest': Euler((0, 0, math.radians(-20))).to_quaternion(),
        'UpperArmR': Euler((math.radians(52), math.radians(-14), math.radians(-34))).to_quaternion(),
        'ForearmR': Euler((math.radians(78), 0, 0)).to_quaternion(),
    }
    release_targets = {
        'UpperArmL': Euler((math.radians(58), math.radians(8), math.radians(16))).to_quaternion(),
        'ForearmL': Euler((math.radians(-7), 0, math.radians(-3))).to_quaternion(),
        'Chest': Euler((0, 0, math.radians(-18))).to_quaternion(),
        'UpperArmR': Euler((math.radians(56), math.radians(-20), math.radians(-44))).to_quaternion(),
        'ForearmR': Euler((math.radians(55), 0, 0)).to_quaternion(),
    }
    if joint not in draw_targets:
        return base_delta

    target_draw = draw_targets[joint]
    target_rel = release_targets[joint]

    if phase <= 0.42:
        t = phase / 0.42
        s = t * t # Ease-in acceleration
        interpolated = Quaternion((1, 0, 0, 0)).slerp(target_draw, s)
        return base_delta.slerp(interpolated, 0.88)
    elif phase <= 0.48:
        # Apex tension hold
        return base_delta.slerp(target_draw, 0.88)
    elif phase <= 0.52:
        # Explosive snap release
        t = (phase - 0.48) / 0.04
        snap = target_draw.slerp(target_rel, t)
        return base_delta.slerp(snap, 0.90)
    else:
        # Damped follow-through back to stance
        u = (phase - 0.52) / 0.48
        decay = math.pow(max(0.0, 1.0 - u), 2.0)
        target_follow = target_rel.slerp(Quaternion((1, 0, 0, 0)), 1.0 - decay)
        return base_delta.slerp(target_follow, decay * 0.85)

# Anatomical joint limits (in radians) to prevent hyperextension, bone popping, or unnatural joint twisting.
ANATOMICAL_JOINT_LIMITS = {
    'Head': {'max_angle': math.radians(75), 'min_euler': (-0.85, -1.3, -0.6), 'max_euler': (0.85, 1.3, 0.6)},
    'Spine': {'max_angle': math.radians(45), 'min_euler': (-0.6, -0.6, -0.45), 'max_euler': (0.6, 0.6, 0.45)},
    'Chest': {'max_angle': math.radians(45), 'min_euler': (-0.5, -0.5, -0.35), 'max_euler': (0.5, 0.5, 0.35)},
    'ForearmL': {'max_angle': math.radians(145)},
    'ForearmR': {'max_angle': math.radians(145)},
    'CalfL': {'max_angle': math.radians(150)},
    'CalfR': {'max_angle': math.radians(150)},
    'FootL': {'max_angle': math.radians(65)},
    'FootR': {'max_angle': math.radians(65)},
}

def clamp_joint_rotation(joint, delta):
    """Clamps a relative joint rotation delta within physiological humanoid limits.
    Prevents joint flipping, hyperextension, and extreme mesh pinching."""
    if joint not in ANATOMICAL_JOINT_LIMITS:
        return delta
    limits = ANATOMICAL_JOINT_LIMITS[joint]

    # Total angular magnitude clamp
    max_angle = limits.get('max_angle')
    if max_angle is not None:
        angle = 2.0 * math.acos(max(-1.0, min(1.0, abs(delta.w))))
        if angle > max_angle:
            axis = Vector((delta.x, delta.y, delta.z))
            if axis.length > 1e-6:
                axis.normalize()
                sign = 1.0 if delta.w >= 0 else -1.0
                half_angle = (max_angle * 0.5) * sign
                delta = Quaternion((math.cos(half_angle), axis.x * math.sin(half_angle), axis.y * math.sin(half_angle), axis.z * math.sin(half_angle)))

    # Multi-axis Euler limit bounds for torso and neck
    if 'min_euler' in limits and 'max_euler' in limits:
        euler = delta.to_euler('XYZ')
        min_e = limits['min_euler']
        max_e = limits['max_euler']
        clamped_x = max(min_e[0], min(max_e[0], euler.x))
        clamped_y = max(min_e[1], min(max_e[1], euler.y))
        clamped_z = max(min_e[2], min(max_e[2], euler.z))
        if clamped_x != euler.x or clamped_y != euler.y or clamped_z != euler.z:
            delta = Euler((clamped_x, clamped_y, clamped_z), 'XYZ').to_quaternion()

    return delta

def compute_melee_attack_delta(joint, phase, base_delta):
    """Procedural MOBA kinetic attack curves with anticipation, impact snap, and follow-through.
    Phase 0.00-0.35: Anticipation & coiling (weapon drawn back, torso coiled).
    Phase 0.35-0.42: Explosive forward strike snap (hit frame impact at apex ~0.38-0.40).
    Phase 0.42-1.00: Damped elastic follow-through and recovery back to ready stance.
    """
    if joint not in ATTACK_JOINTS:
        return base_delta
    if phase <= 0.35:
        # Anticipation: ease-in coiling
        t = phase / 0.35
        anticipation_scale = 0.72 + 0.28 * (t * t)
        return Quaternion((1, 0, 0, 0)).slerp(base_delta, anticipation_scale)
    elif phase <= 0.42:
        # Impact snap: maximum velocity and crisp apex extension
        t = (phase - 0.35) / 0.07
        snap_boost = 0.12 * math.sin(t * math.pi)
        axis = Vector((base_delta.x, base_delta.y, base_delta.z))
        if axis.length > 1e-6:
            axis.normalize()
            angle = 2.0 * math.acos(max(-1.0, min(1.0, abs(base_delta.w))))
            boosted_angle = angle * (1.0 + snap_boost)
            sign = 1.0 if base_delta.w >= 0 else -1.0
            half = (boosted_angle * 0.5) * sign
            return Quaternion((math.cos(half), axis.x * math.sin(half), axis.y * math.sin(half), axis.z * math.sin(half)))
        return base_delta
    else:
        # Follow-through and recovery back to stance
        u = (phase - 0.42) / 0.58
        recovery = math.pow(max(0.0, 1.0 - u), 1.5)
        return Quaternion((1, 0, 0, 0)).slerp(base_delta, 0.75 + 0.25 * recovery)

def motion_delta(current, neutral, clip, joint, equipment_clearance, avatar_id=None, phase=0.0):
    delta = current @ neutral.inverted()
    if equipment_clearance:
        if clip == 'Attack' and joint in ATTACK_JOINTS:
            gain = EQUIPMENT_PROFILE['attack_upper_body_gain']
        elif clip == 'Cast' and joint in ATTACK_JOINTS:
            gain = EQUIPMENT_PROFILE.get('cast_upper_body_gain', .7)
        elif clip == 'Hit' and joint in ATTACK_JOINTS:
            gain = EQUIPMENT_PROFILE.get('hit_upper_body_gain', .7)
        elif clip == 'Death' and joint not in {'Root', 'Hips'}:
            gain = EQUIPMENT_PROFILE['death_deformation_gain']
        else:
            gain = 1
        delta = Quaternion((1, 0, 0, 0)).slerp(delta, gain)

    # Combat kinetic timing and posture clearance
    if avatar_id == 'c_astra':
        if joint in ARCHER_CLEARANCE and clip in ARCHER_CLEARANCE[joint]:
            clearance_rot = ARCHER_CLEARANCE[joint][clip]
            delta = delta.slerp(delta @ clearance_rot, 0.4)
        if clip == 'Attack':
            delta = compute_archer_attack_delta(joint, phase, delta)
    elif clip == 'Attack':
        delta = compute_melee_attack_delta(joint, phase, delta)

    # Physiological joint limit enforcement
    delta = clamp_joint_rotation(joint, delta)

    return delta

def hip_motion_to_root(root_rest, hip_rest, root_basis, hip_basis):
    return root_basis @ root_rest.inverted() @ hip_rest @ hip_basis @ hip_rest.inverted() @ root_rest
