"""Constrained bind-relative animation transfer; no time resampling or skin edits."""
from mathutils import Quaternion

EQUIPMENT_PROFILE={'name':'equipment-clearance-v2','attack_upper_body_gain':.64,'cast_upper_body_gain':.7,'hit_upper_body_gain':.7,'death_deformation_gain':.75,'clip_timing':'unchanged'}
ATTACK_JOINTS={'Chest','left-arm','right-arm','UpperArmL','UpperArmR','ForearmL','ForearmR','HandL','HandR'}

def motion_delta(current,neutral,clip,joint,equipment_clearance):
    delta=current@neutral.inverted()
    if equipment_clearance:
        if clip=='Attack' and joint in ATTACK_JOINTS:
            gain=EQUIPMENT_PROFILE['attack_upper_body_gain']
        elif clip=='Cast' and joint in ATTACK_JOINTS:
            gain=EQUIPMENT_PROFILE.get('cast_upper_body_gain',.7)
        elif clip=='Hit' and joint in ATTACK_JOINTS:
            gain=EQUIPMENT_PROFILE.get('hit_upper_body_gain',.7)
        elif clip=='Death' and joint not in {'Root','Hips'}:
            gain=EQUIPMENT_PROFILE['death_deformation_gain']
        else:
            gain=1
        delta=Quaternion((1,0,0,0)).slerp(delta,gain)
    return delta

def hip_motion_to_root(root_rest,hip_rest,root_basis,hip_basis):
    return root_basis@root_rest.inverted()@hip_rest@hip_basis@hip_rest.inverted()@root_rest
