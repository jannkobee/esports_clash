"""Conservative humanoid rest-skeleton matching; no numeric bone conventions.
Coordinates are Blender world-space: Z up, character forward approximately -Y.
Unsupported or ambiguous anatomy is returned for human review, never guessed.
"""
import math

NATIVE = ('Root','Hips','Spine','Chest','Head','UpperArmL','ForearmL','HandL','UpperArmR','ForearmR','HandR','ThighL','CalfL','FootL','ThighR','CalfR','FootR')

CANONICAL_ROLES = {
    # Core mandatory humanoid joints (17 matching native animation donor contract)
    'Root': {'parent': None, 'mandatory': True, 'category': 'root'},
    'Hips': {'parent': 'Root', 'mandatory': True, 'category': 'torso'},
    'Spine': {'parent': 'Hips', 'mandatory': True, 'category': 'torso'},
    'Chest': {'parent': 'Spine', 'mandatory': True, 'category': 'torso'},
    'Head': {'parent': 'Chest', 'mandatory': True, 'category': 'head'},
    'UpperArmL': {'parent': 'Chest', 'mandatory': True, 'category': 'limb_left'},
    'ForearmL': {'parent': 'UpperArmL', 'mandatory': True, 'category': 'limb_left'},
    'HandL': {'parent': 'ForearmL', 'mandatory': True, 'category': 'limb_left'},
    'UpperArmR': {'parent': 'Chest', 'mandatory': True, 'category': 'limb_right'},
    'ForearmR': {'parent': 'UpperArmR', 'mandatory': True, 'category': 'limb_right'},
    'HandR': {'parent': 'ForearmR', 'mandatory': True, 'category': 'limb_right'},
    'ThighL': {'parent': 'Hips', 'mandatory': True, 'category': 'limb_left'},
    'CalfL': {'parent': 'ThighL', 'mandatory': True, 'category': 'limb_left'},
    'FootL': {'parent': 'CalfL', 'mandatory': True, 'category': 'limb_left'},
    'ThighR': {'parent': 'Hips', 'mandatory': True, 'category': 'limb_right'},
    'CalfR': {'parent': 'ThighR', 'mandatory': True, 'category': 'limb_right'},
    'FootR': {'parent': 'CalfR', 'mandatory': True, 'category': 'limb_right'},
    # Optional anatomical extensions
    'UpperChest': {'parent': 'Chest', 'mandatory': False, 'category': 'torso'},
    'Neck': {'parent': 'Chest', 'mandatory': False, 'category': 'head'},
    'ClavicleL': {'parent': 'Chest', 'mandatory': False, 'category': 'limb_left'},
    'ClavicleR': {'parent': 'Chest', 'mandatory': False, 'category': 'limb_right'},
    'ToeL': {'parent': 'FootL', 'mandatory': False, 'category': 'limb_left'},
    'ToeR': {'parent': 'FootR', 'mandatory': False, 'category': 'limb_right'},
    # Hand sockets & accessories
    'RightHandSocket': {'parent': 'HandR', 'mandatory': False, 'category': 'socket'},
    'LeftHandSocket': {'parent': 'HandL', 'mandatory': False, 'category': 'socket'},
}

CHARACTER_PROFILES = {
    'humanoid_unarmed': {
        'description': 'Standard unarmed humanoid biped with relaxed combat stance',
        'mandatory_joints': list(NATIVE),
        'optional_joints': ['ClavicleL', 'ClavicleR', 'ToeL', 'ToeR', 'Neck'],
        'locomotion_stride_multiplier': 1.0,
        'requires_weapon_sockets': False,
    },
    'humanoid_sword': {
        'description': 'One-handed melee weapon specialist (right hand primary)',
        'mandatory_joints': list(NATIVE),
        'optional_joints': ['ClavicleL', 'ClavicleR', 'ToeL', 'ToeR', 'Neck', 'RightHandSocket'],
        'locomotion_stride_multiplier': 1.0,
        'requires_weapon_sockets': True,
        'primary_slot': 'primary',
    },
    'humanoid_shield': {
        'description': 'Sword and shield defender with guard carrying stance',
        'mandatory_joints': list(NATIVE),
        'optional_joints': ['ClavicleL', 'ClavicleR', 'ToeL', 'ToeR', 'Neck', 'RightHandSocket', 'LeftHandSocket'],
        'locomotion_stride_multiplier': 0.95,
        'requires_weapon_sockets': True,
        'primary_slot': 'primary',
        'secondary_slot': 'secondary',
    },
    'humanoid_dual_blade': {
        'description': 'Dual-wielding skirmisher with agile carrying profile',
        'mandatory_joints': list(NATIVE),
        'optional_joints': ['ClavicleL', 'ClavicleR', 'ToeL', 'ToeR', 'Neck', 'RightHandSocket', 'LeftHandSocket'],
        'locomotion_stride_multiplier': 1.05,
        'requires_weapon_sockets': True,
    },
    'humanoid_staff': {
        'description': 'Two-handed or long-staff wielder with centered vertical holding stance',
        'mandatory_joints': list(NATIVE),
        'optional_joints': ['ClavicleL', 'ClavicleR', 'ToeL', 'ToeR', 'Neck', 'RightHandSocket'],
        'locomotion_stride_multiplier': 1.0,
        'requires_weapon_sockets': True,
    },
    'humanoid_ranged': {
        'description': 'Archer or firearm marksman with distinct upper body draw/aim pose',
        'mandatory_joints': list(NATIVE),
        'optional_joints': ['ClavicleL', 'ClavicleR', 'ToeL', 'ToeR', 'Neck', 'RightHandSocket', 'LeftHandSocket'],
        'locomotion_stride_multiplier': 1.0,
        'requires_weapon_sockets': True,
    },
    'humanoid_mage': {
        'description': 'Caster with floating or hand-held focus and open spell gestures',
        'mandatory_joints': list(NATIVE),
        'optional_joints': ['ClavicleL', 'ClavicleR', 'ToeL', 'ToeR', 'Neck', 'RightHandSocket'],
        'locomotion_stride_multiplier': 1.0,
        'requires_weapon_sockets': False,
    },
    'quadruped': {
        'description': 'Four-legged beast or mount with fore and hind limb kinematics',
        'mandatory_joints': ['Root', 'Hips', 'Spine', 'Chest', 'Head'],
        'optional_joints': ['Tail_01', 'Tail_02'],
        'locomotion_stride_multiplier': 1.2,
        'requires_weapon_sockets': False,
    },
    'flying_creature': {
        'description': 'Winged creature with aerial flap cycles and perching feet',
        'mandatory_joints': ['Root', 'Hips', 'Spine', 'Chest', 'Head'],
        'optional_joints': ['WingL_01', 'WingL_02', 'WingR_01', 'WingR_02'],
        'locomotion_stride_multiplier': 1.1,
        'requires_weapon_sockets': False,
    },
    'custom_creature': {
        'description': 'Nonstandard creature with flexible appendage topology',
        'mandatory_joints': ['Root', 'Hips', 'Head'],
        'optional_joints': [],
        'locomotion_stride_multiplier': 1.0,
        'requires_weapon_sockets': False,
    },
}

def resolve_character_profile(avatar_meta=None, equipment_plan=None):
    """Determine character animation profile based on metadata and equipment configuration."""
    equipment = equipment_plan or []
    slots = {item.get('slot'): item for item in equipment} if isinstance(equipment, list) else {}
    has_primary = 'primary' in slots
    has_secondary = 'secondary' in slots
    secondary_type = slots.get('secondary', {}).get('weapon_type', '')
    primary_type = slots.get('primary', {}).get('weapon_type', '')

    role = (avatar_meta or {}).get('role', '').lower()
    archetype = (avatar_meta or {}).get('design', {}).get('archetype', '').lower()

    if 'quadruped' in archetype or 'beast' in archetype:
        return 'quadruped'
    if 'flying' in archetype or 'winged' in archetype:
        return 'flying_creature'

    if has_secondary and (secondary_type == 'shield' or 'shield' in primary_type):
        return 'humanoid_shield'
    if has_primary and has_secondary:
        return 'humanoid_dual_blade'
    if primary_type in ('staff', 'magic_staff', 'wand'):
        return 'humanoid_staff'
    if primary_type in ('bow', 'gun', 'firearm', 'crossbow') or role == 'marksman':
        return 'humanoid_ranged'
    if role == 'mage':
        return 'humanoid_mage'
    if has_primary:
        return 'humanoid_sword'
    return 'humanoid_unarmed'

def infer_humanoid(bones, profile_name='humanoid_unarmed'):
    evidence={'method':'humanoid-topology-rest-v4','accepted':False,'reasons':[],'warnings':[],'profile':profile_name}
    def reject(reason):
        evidence['reasons'].append(reason)
        evidence['confidence'] = 0.0
        return {}, evidence
    if len(bones)<16 or len(bones)>256:return reject('Expected a bounded humanoid skeleton (16-256 bones).')
    names={b['name']:b for b in bones}
    if len(names)!=len(bones):return reject('Duplicate bone names.')
    children={name:[] for name in names}
    for b in bones:
        p=b.get('parent')
        if p in names:children[p].append(b['name'])
        if len(b['position'])!=3 or not all(math.isfinite(v) for v in b['position']):return reject('Non-finite joint coordinates.')
    roots=[n for n,b in names.items() if b.get('parent') not in names]
    if len(roots)!=1:return reject('Expected one skeleton root.')
    for name in names:
        ancestry=set()
        cursor=name
        while cursor in names:
            if cursor in ancestry:return reject('Cyclic skeleton.')
            ancestry.add(cursor)
            cursor=names[cursor].get('parent')
    def pos(n):return names[n]['position']
    height=max(pos(n)[2] for n in names)-min(pos(n)[2] for n in names)
    if height<1e-6:return reject('Degenerate skeleton height.')
    def subtree_size(n):
        total=1
        stack=[n]
        seen={n}
        while stack:
            curr=stack.pop()
            for c in children[curr]:
                if c not in seen:
                    seen.add(c);total+=1;stack.append(c)
        return total

    root=roots[0]
    root_adapter=None
    if not children[root]:return reject('Root has no child branches.')
    root_torso=[n for n in children[root] if pos(n)[2]>pos(root)[2]+height*.025 and subtree_size(n)>=5]
    root_legs=[n for n in children[root] if pos(n)[2]<pos(root)[2]-height*.015 and subtree_size(n)>=3]
    if len(children[root])==3 and len(root_torso)==1 and len(root_legs)==2:
        hips=root
        helper='avatar_control_root'
        while helper in names:helper+='_'
        root_adapter={'name':helper,'pelvis':hips,'native':'Root','use_deform':False}
    elif len(children[root])==1:
        hips=children[root][0]
    else:
        pelvis_candidates=[
            c for c in children[root]
            if len([n for n in children[c] if pos(n)[2]>pos(c)[2]+height*.025])>=1
            and len([n for n in children[c] if pos(n)[2]<pos(c)[2]-height*.015])>=2
        ]
        if len(pelvis_candidates)!=1:
            return reject('Root must have one unambiguous pelvis branch; extra roots need review.')
        hips=pelvis_candidates[0]
        extra_roots=[c for c in children[root] if c!=hips]
        evidence['warnings'].append('Extra root helper/garment branches consolidated: '+', '.join(extra_roots))

    torso=[n for n in children[hips] if pos(n)[2]>pos(hips)[2]+height*.025 and subtree_size(n)>=5]
    if not torso:
        torso=[n for n in children[hips] if pos(n)[2]>pos(hips)[2]+height*.025]
    legs=[n for n in children[hips] if pos(n)[2]<pos(hips)[2]-height*.015 and subtree_size(n)>=3]
    if not legs:
        legs=[n for n in children[hips] if pos(n)[2]<pos(hips)[2]-height*.015]
    if len(torso)!=1 or len(legs)!=2:return reject('Pelvis branches do not have distinct torso/leg positions.')
    spine=torso[0];chest=spine;seen={root,hips}
    while True:
        if chest in seen:return reject('Cyclic skeleton.')
        seen.add(chest)
        if len(children[chest])==1:
            chest=children[chest][0]
            continue
        major=[c for c in children[chest] if subtree_size(c)>=2 and pos(c)[2]>pos(chest)[2]+height*.01]
        if len(major)==1 and subtree_size(major[0])>=6 and len([c for c in children[chest] if c!=major[0] and subtree_size(c)>=3])==0:
            chest=major[0]
            continue
        break
    if chest==spine or len(children[chest])<3:return reject('Expected a separate spine/chest with two arms and head.')
    head_paths=[];arm_paths=[]
    for start in children[chest]:
        chain=[start]
        while len(children[chain[-1]])==1 and len(chain)<16:
            nxt=children[chain[-1]][0]
            if nxt in chain:return reject('Cyclic chain.')
            chain.append(nxt)
        if pos(start)[2]>pos(chest)[2]+height*.015 and all(abs(pos(n)[0]-pos(hips)[0])<height*.12 for n in chain[:3]):
            head_paths.append(chain)
        elif subtree_size(start)>=3:
            arm_paths.append(chain)
    if len(head_paths)!=1 or len(arm_paths)!=2:return reject('Chest has no unambiguous head and arm branches.')
    head_chain=head_paths[0]
    if len(head_chain)<=2:
        head=head_chain[-1]
    else:
        head=head_chain[1] if pos(head_chain[1])[2]>=pos(head_chain[0])[2] else head_chain[0]
    result={'Root':root_adapter['name'] if root_adapter else root,'Hips':hips,'Spine':spine,'Chest':chest,'Head':head}
    def side(n):return 'L' if pos(n)[0]<pos(hips)[0] else 'R'
    arm_sides=[]
    arm_lengths={}
    proportions={}
    per_bone_confidence={}
    per_bone_confidence['Root'] = 0.98
    per_bone_confidence['Hips'] = 0.98
    per_bone_confidence['Spine'] = 0.95
    per_bone_confidence['Chest'] = 0.95
    per_bone_confidence['Head'] = 0.95

    for chain in arm_paths:
        if len(chain)>4:
            chain=chain[:4] if abs(pos(chain[0])[0]-pos(hips)[0])<abs(pos(chain[1])[0]-pos(hips)[0])*.75 else chain[:3]
        if len(chain) not in (3,4):return reject('Arm chain must resolve shoulder, elbow and wrist with optional clavicle.')
        upper,fore,hand=chain[-3:];s=side(upper);arm_sides.append(s)
        if abs(pos(upper)[0]-pos(hips)[0])<height*.04:return reject('Shoulder side is ambiguous.')
        if not all((pos(n)[0]-pos(hips)[0])*(-1 if s=='L' else 1)>height*.02 for n in (upper,fore,hand)):return reject('Arm crosses the body in the reference pose.')
        l_upper = math.dist(pos(upper),pos(fore))
        l_fore = math.dist(pos(fore),pos(hand))
        arm_lengths[s] = l_upper + l_fore
        proportions['arm_'+s+'_upper'] = round(l_upper/height, 4)
        proportions['arm_'+s+'_fore'] = round(l_fore/height, 4)
        for a,b,l in ((upper,fore,l_upper),(fore,hand,l_fore)):
            if not .05<l/height<.45:return reject('Arm segment proportions require review.')
        for native,n in zip(('UpperArm','Forearm','Hand'),(upper,fore,hand)):
            result[native+s]=n
            per_bone_confidence[native+s] = 0.93

    if set(arm_sides)!={'L','R'}:return reject('Arms are not on opposing sides.')
    leg_sides=[];toe_vectors=[];leg_lengths={}
    for thigh_start in legs:
        chain=[thigh_start]
        while len(children[chain[-1]])==1 and len(chain)<8:chain.append(children[chain[-1]][0])
        if len(chain)<3:return reject('Leg must have a clear thigh, knee, and ankle chain.')
        thigh,calf,foot=chain[0],chain[1],chain[2]
        toe=chain[3] if len(chain)>=4 else (children[foot][0] if children[foot] else None)
        if not toe:return reject('Leg must have a clear thigh, knee, ankle and toe chain for facing validation.')
        s=side(thigh);leg_sides.append(s)
        if abs(pos(thigh)[0]-pos(hips)[0])<height*.02:return reject('Leg side is ambiguous.')
        if not(pos(thigh)[2]>pos(calf)[2]+height*.06 and pos(calf)[2]>pos(foot)[2]+height*.06):return reject('Leg joint heights are incompatible with an upright humanoid.')
        l_thigh = math.dist(pos(thigh),pos(calf))
        l_calf = math.dist(pos(calf),pos(foot))
        leg_lengths[s] = l_thigh + l_calf
        proportions['leg_'+s+'_thigh'] = round(l_thigh/height, 4)
        proportions['leg_'+s+'_calf'] = round(l_calf/height, 4)
        for a,b,length in ((thigh,calf,l_thigh),(calf,foot,l_calf)):
            if not .08<length/height<.48:return reject('Leg segment proportions require review.')
        toe_vectors.append([pos(toe)[i]-pos(foot)[i] for i in range(2)])
        for native,n in zip(('Thigh','Calf','Foot'),(thigh,calf,foot)):
            result[native+s]=n
            per_bone_confidence[native+s] = 0.94

    if set(leg_sides)!={'L','R'}:return reject('Legs are not on opposing sides.')
    forward_scores=[]
    for vector in toe_vectors:
        length=math.hypot(*vector)
        if length<height*.012:return reject('Toe direction cannot confirm forward -Y; review orientation and left/right.')
        forward_scores.append(-vector[1]/length)
    if min(forward_scores)<.20 or sum(forward_scores)/len(forward_scores)<.40:
        return reject('Toe direction cannot confirm forward -Y; review orientation and left/right.')
    if len(result)!=17 or len(set(result.values()))!=17:return reject('Mapping is incomplete or not one-to-one.')

    # Compute bilateral symmetry scores
    arm_sym = 1.0 - abs(arm_lengths.get('L',0) - arm_lengths.get('R',0)) / max(arm_lengths.get('L',1), arm_lengths.get('R',1), 1e-5)
    leg_sym = 1.0 - abs(leg_lengths.get('L',0) - leg_lengths.get('R',0)) / max(leg_lengths.get('L',1), leg_lengths.get('R',1), 1e-5)
    symmetry = {'arm_symmetry': round(arm_sym, 4), 'leg_symmetry': round(leg_sym, 4)}

    for hand in (result['HandL'],result['HandR']):
        for child in children[hand]:
            if math.dist(pos(hand),pos(child))/height>.35:evidence['warnings'].append('Long hand attachment branch '+child+' requires equipment/influence review.')

    mean_conf = sum(per_bone_confidence.values()) / max(len(per_bone_confidence), 1)
    evidence.update(
        accepted=True,
        confidence=round(mean_conf, 3),
        per_bone_confidence=per_bone_confidence,
        symmetry=symmetry,
        proportions=proportions,
        checks=['single root and pelvis','distinct torso/head/arm branches','opposite limb sides','leg proportions','toe-confirmed facing','17 unique joints'],
        bone_map=result
    )
    if root_adapter:evidence['root_adapter']=root_adapter
    return result,evidence


def materialize_root_adapter(armature, review):
    """Add the accepted runtime helper without changing original rest bones/skin."""
    adapter=review.get('root_adapter')
    if not adapter:return None
    if not review.get('accepted'):raise ValueError('An unaccepted mapping cannot add a control root.')
    if adapter.get('native')!='Root' or adapter.get('use_deform') is not False:
        raise ValueError('Invalid control-root adapter.')
    pelvis=armature.data.bones.get(adapter['pelvis'])
    if pelvis is None or pelvis.parent is not None or armature.data.bones.get(adapter['name']):
        raise ValueError('Control-root adapter no longer matches the original pelvis root.')
    import bpy
    bpy.context.view_layer.objects.active=armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    try:
        pelvis=armature.data.edit_bones[adapter['pelvis']]
        helper=armature.data.edit_bones.new(adapter['name'])
        helper.head=pelvis.head.copy()
        helper.tail=pelvis.tail.copy()
        helper.roll=pelvis.roll
        helper.use_deform=False
        pelvis.use_connect=False
        pelvis.parent=helper
    finally:
        bpy.ops.object.mode_set(mode='OBJECT')
    return adapter['name']

