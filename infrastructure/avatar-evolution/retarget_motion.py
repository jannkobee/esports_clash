"""Constrained bind-relative animation transfer; no time resampling or skin edits."""
import math
from mathutils import Quaternion, Euler

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

    # Archer-specific posture clearance for longbow stability
    if avatar_id == 'c_astra' and joint in ARCHER_CLEARANCE and clip in ARCHER_CLEARANCE[joint]:
        clearance_rot = ARCHER_CLEARANCE[joint][clip]
        delta = delta.slerp(delta @ clearance_rot, 0.4)

    return delta

def hip_motion_to_root(root_rest, hip_rest, root_basis, hip_basis):
    return root_basis @ root_rest.inverted() @ hip_rest @ hip_basis @ hip_rest.inverted() @ root_rest
