"""Read-only native donor pose ranges for diagnosing broken transfer."""
import bpy
import json
import sys
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index('--')+1])
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
rig.animation_data_create()
report=[]
for clip in ['Idle','Attack','Death','Run']:
    action=bpy.data.actions[clip];rig.animation_data.action=action
    slots=list(rig.animation_data.action_suitable_slots)
    if len(slots)==1:rig.animation_data.action_slot=slots[0]
    start,end=action.frame_range
    for phase in [0,.42,1]:
        frame=start+(end-start)*phase;bpy.context.scene.frame_set(int(frame),subframe=frame%1)
        bpy.context.view_layer.update()
        report.append({'clip':clip,'phase':phase,'bones':{name:{'rotation':list(rig.pose.bones[name].matrix_basis.to_quaternion().to_euler()),
            'location':list(rig.pose.bones[name].location),'head':list(rig.pose.bones[name].head)}
            for name in ['Root','Hips','Chest','UpperArmL','ForearmL','HandL']}})
print(json.dumps(report,indent=2))
