"""Print anatomical segment calibration residuals from a saved stage."""
import bpy
import json
import sys
from pathlib import Path
sys.path.insert(0, '/workspace/infrastructure/avatar-evolution')
from retarget_motion import calibrate_arms, character_frame, ARM_SEGMENTS

bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1])
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
source=next(o for o in rigs if o.animation_data and o.animation_data.action and o.animation_data.action.name.startswith('NativeSource_'))
target=next(o for o in rigs if o!=source)
alignment=character_frame(target)@character_frame(source).inverted()
out={}
for name,child in ARM_SEGMENTS.items():
    if not child:continue
    a=source.pose.bones[name]; b=target.pose.bones[name]
    desired=alignment@(source.matrix_world.to_3x3()@(source.pose.bones[child].head-a.head))
    actual=target.matrix_world.to_3x3()@(target.pose.bones[child].head-b.head)
    rest=target.matrix_world.to_3x3()@(target.data.bones[child].head_local-b.bone.head_local)
    out[name]={'desired':list(desired.normalized()),'actual':list(actual.normalized()),
        'rest':list(rest.normalized()),'error_degrees':desired.angle(actual)*180/3.14159265,
        'source_scale':list(a.matrix.to_scale()),'target_scale':list(b.matrix.to_scale()),
        'basis_location':list(b.location)}
print(json.dumps(out,indent=2))
