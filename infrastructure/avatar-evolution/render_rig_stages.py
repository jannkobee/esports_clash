"""Render saved diagnostic stages with identical framing, excluding donor meshes."""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

folder = Path(sys.argv[sys.argv.index('--') + 1])
names = sys.argv[sys.argv.index('--') + 2:]
for name in names:
    bpy.ops.wm.open_mainfile(filepath=str(folder / (name + '.blend')))
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    rig = next((o for o in rigs if o.data.bones.get('UpperArmL')), rigs[0])
    # Target generated meshes have actual armature modifiers referencing this rig.
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and
              any(m.type == 'ARMATURE' and m.object == rig for m in o.modifiers)]
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.hide_render = obj not in meshes
    points = [rig.matrix_world @ b.head_local for b in rig.data.bones]
    lo = Vector([min(p[i] for p in points) for i in range(3)])
    hi = Vector([max(p[i] for p in points) for i in range(3)])
    center, span = (lo + hi) / 2, max(hi - lo)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.render.resolution_x = scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    camera = bpy.data.objects.new('StageCamera', bpy.data.cameras.new('StageCamera'))
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = span * 1.3
    for view, angle in [('front', 0), ('side', math.pi / 2)]:
        camera.location = center + Vector((math.sin(angle)*span*3, -math.cos(angle)*span*3, span*.12))
        camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath = str(folder / (name+'-'+view+'.png'))
        bpy.ops.render.render(write_still=True)
