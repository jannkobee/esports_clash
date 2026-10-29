"""Controlled post-repair stress evidence, distinct from combat qualification."""
import bpy
import hashlib
import json
import sys
from pathlib import Path
from mathutils import Quaternion

source,folder=map(Path,sys.argv[sys.argv.index('--')+1:])
folder.mkdir(exist_ok=False)
bpy.ops.wm.open_mainfile(filepath=str(source))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
rig.data.pose_position='POSE'
angles={'ThighL':.7,'ThighR':-.7,'AnatomicalTail_04':.3}
for name,angle in angles.items():
    bone=rig.pose.bones[name];bone.rotation_mode='QUATERNION'
    bone.rotation_quaternion=Quaternion((1,0,0) if name.startswith('Thigh') else (0,0,1),angle)
bpy.context.view_layer.update()
output=folder/'controlled-stress.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(output),compress=True)
(folder/'controlled-stress.json').write_text(json.dumps({
    'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
    'angles_radians':angles,'publication_eligible':False,
    'scope':'Controlled thigh separation plus tail bend only; not combat qualification'},indent=2))
