"""Derive a canonical rig integration fixture from an existing authored GLB.

This is explicitly NOT a generated UniRig result. It strips native runtime
helpers/actions so retargeting can be exercised when no generated rig exists.
No original files or runtime models are overwritten.
"""
import bpy
import hashlib
import json
import sys
from pathlib import Path
from mathutils import Matrix

source, destination = map(Path, sys.argv[sys.argv.index('--') + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
rigs=[obj for obj in bpy.context.scene.objects if obj.type=='ARMATURE']
if len(rigs)!=1:
    raise RuntimeError('Integration fixture requires one authored humanoid armature')
rig=rigs[0]
displays={bone.custom_shape for bone in rig.pose.bones if bone.custom_shape}
meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH' and obj not in displays]
for obj in bpy.context.scene.objects:
    obj.animation_data_clear()
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
rig.data.pose_position='REST'
for bone in rig.pose.bones:
    bone.custom_shape=None
    bone.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
for obj in meshes:
    ancestry=[]
    current=obj
    while current:
        ancestry.append((current.get('avatarPart'),current.parent_bone if current.parent_type=='BONE' else None))
        current=current.parent
    side='R' if any(part=='right-grip' for part,_ in ancestry) else 'L' if any(part=='left-grip' for part,_ in ancestry) else None
    binding='Hand'+side if side else next((bone for _,bone in ancestry if bone and bone in rig.data.bones),None)
    world=obj.matrix_world.copy()
    obj.parent=rig
    obj.parent_type='OBJECT'
    obj.matrix_world=world
    if binding and not obj.vertex_groups:
        group=obj.vertex_groups.new(name=binding)
        group.add(list(range(len(obj.data.vertices))),1.,'REPLACE')
        modifier=obj.modifiers.new('FixtureRigidBinding','ARMATURE')
        modifier.object=rig
    for key in list(obj.keys()):
        del obj[key]
world=rig.matrix_world.copy()
rig.parent=None
rig.matrix_world=world
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name in ['left-arm','right-arm','leg:-1','leg:1']:
    helper=rig.data.edit_bones.get(name)
    if not helper:
        continue
    for child in list(helper.children):
        rest,length=child.matrix.copy(),child.length
        child.parent=helper.parent
        child.use_connect=False
        child.matrix,child.length=rest,length
    rig.data.edit_bones.remove(helper)
bpy.ops.object.mode_set(mode='OBJECT')
keep=set(meshes+[rig])
for obj in list(bpy.context.scene.objects):
    if obj not in keep:
        bpy.data.objects.remove(obj,do_unlink=True)
for key in list(rig.keys()):
    del rig[key]
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',export_extras=False,
                          export_animations=False,export_skins=True,export_all_influences=False)
metadata={'scope':'Authored-model integration fixture; no GPU inference or generated-source quality evidence',
          'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
          'fixture_sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),
          'bones':len(rig.data.bones),'meshes':len(meshes)}
destination.with_suffix('.fixture.json').write_text(json.dumps(metadata,indent=2))
