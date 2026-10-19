"""Retarget native clips onto the actual UniRig skeleton; never transfer donor skin."""
import bpy
import json
import math
import hashlib
import sys
from pathlib import Path
from mathutils import Vector, Matrix

folder, source, donor = map(Path, sys.argv[sys.argv.index('--')+1:])
plan=json.loads((folder/'preparation-plan.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
if len(rigs)!=1:
    raise RuntimeError('UniRig output must contain exactly one armature')
target=rigs[0]
predicted=list(target.data.bones.keys())
aliases={
    'Root':['Root','root'], 'Hips':['Hips','pelvis'], 'Spine':['Spine'], 'Chest':['Spine1','Spine2','Chest'], 'Head':['Head'],
    'UpperArmL':['LeftArm','UpperArmL'], 'ForearmL':['LeftForeArm','ForearmL'], 'HandL':['LeftHand','HandL'],
    'UpperArmR':['RightArm','UpperArmR'], 'ForearmR':['RightForeArm','ForearmR'], 'HandR':['RightHand','HandR'],
    'ThighL':['LeftUpLeg','ThighL'], 'CalfL':['LeftLeg','CalfL'], 'FootL':['LeftFoot','FootL'],
    'ThighR':['RightUpLeg','ThighR'], 'CalfR':['RightLeg','CalfR'], 'FootR':['RightFoot','FootR']}
mapping=dict(plan.get('bone_map') or {})
for native, options in aliases.items():
    if native in mapping:
        continue
    matches=[name for name in predicted if name.split(':')[-1] in options]
    if len(matches)==1:
        mapping[native]=matches[0]
missing=[name for name in aliases if name not in mapping or mapping[name] not in predicted]
if len(set(mapping.values()))!=len(mapping):
    missing.append('Bone mapping must be one-to-one')
proof=json.loads((folder/'unirig-result.json').read_text())
if missing:
    # Preserve and expose the real rig without fabricating native clips or a
    # compatibility root. A new reviewed map creates a separate preparation.
    output=folder/'candidate-01.glb'
    output.write_bytes(source.read_bytes())
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/'candidate-01.blend'),compress=True)
    (folder/'preparation.json').write_text(json.dumps({'method':'unirig-skeleton-and-skin','sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
        'bytes':output.stat().st_size,'runtime_compatible':False,'unirig':proof,'predicted_bones':predicted,'bone_map':mapping,
        'problems':['Review native animation mapping for: '+', '.join(missing)],'native_clips':[]},indent=2))
    sys.exit(0)
bone_displays={bone.custom_shape for rig in rigs for bone in rig.pose.bones if bone.custom_shape}
generated=[o for o in bpy.context.scene.objects if o not in bone_displays]
meshes=[o for o in generated if o.type=='MESH']

target.data.pose_position='REST'
for native, old in mapping.items():
    # Rename temporary first, so a name permutation cannot create .001 bones.
    target.data.bones[old].name='UniRigMapped_'+native
    for obj in meshes:
        if obj.vertex_groups.get(old):
            obj.vertex_groups[old].name='UniRigMapped_'+native
for native in mapping:
    target.data.bones['UniRigMapped_'+native].name=native
    for obj in meshes:
        if obj.vertex_groups.get('UniRigMapped_'+native):
            obj.vertex_groups['UniRigMapped_'+native].name=native
before=set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(donor))
donor_objects=[o for o in bpy.context.scene.objects if o not in before]
donor_rigs=[o for o in donor_objects if o.type=='ARMATURE']
roots=[o for o in donor_objects if o.get('avatarPart')=='avatar-root']
if len(donor_rigs)!=1 or len(roots)!=1:
    raise RuntimeError('Native animation template hierarchy is incompatible')
native_rig=donor_rigs[0]
root=roots[0]
# Native spacer bones carry real arm/leg pivot metadata and motion curves.
# Insert those named pivots above their actual predicted anatomical child while
# preserving the child's rest matrix; keep all other predicted bones and skin.
helpers={'left-arm':'UpperArmL','right-arm':'UpperArmR','leg:-1':'ThighL','leg:1':'ThighR'}
bpy.context.view_layer.objects.active=target
target.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,child_name in helpers.items():
    if name not in native_rig.data.bones:
        raise RuntimeError('Native template is missing its required helper: '+name)
    child=target.data.edit_bones[child_name]
    helper=target.data.edit_bones.new(name)
    helper.head=child.head.copy();helper.tail=child.tail.copy();helper.roll=child.roll
    helper.use_deform=False
    native_parent=native_rig.data.bones[name].parent
    helper.parent=target.data.edit_bones[native_parent.name]
    child.parent=helper;child.use_connect=False
bpy.ops.object.mode_set(mode='OBJECT')
retarget_names=list(mapping)+list(helpers)
for bone in target.data.bones:
    if native_rig.data.bones.get(bone.name):
        for key in native_rig.data.bones[bone.name].keys():
            bone[key]=native_rig.data.bones[bone.name][key]
def extent(objects):
    points=[o.matrix_world@Vector(c) for o in objects if o.type=='MESH' for c in o.bound_box]
    return Vector([min(p[i] for p in points) for i in range(3)]),Vector([max(p[i] for p in points) for i in range(3)])
lo,hi=extent(generated)
dlo,dhi=extent(donor_objects)
height=hi.z-lo.z
scale=(dhi.z-dlo.z)/max(height,.00001)
alignment=Matrix.Translation((dlo+dhi)*.5)@Matrix.Rotation(math.radians(plan['yaw']),4,'Z')@Matrix.Scale(scale,4)@Matrix.Translation(-(lo+hi)*.5)
for obj in generated:
    if obj.parent not in generated:
        world=alignment@obj.matrix_world
        obj.parent=root
        obj.matrix_world=world
# Game contact/stance curves use the native armature's centimetre coordinate
# frame. Re-express the predicted rest rig in that frame without moving its
# world-space joints or mesh. Merely scaling its outer object leaves e.g. a
# native 33-unit leg offset interpreted as 33 generated-model metres.
mesh_world={obj:obj.matrix_world.copy() for obj in meshes}
target.data.transform(native_rig.matrix_world.inverted()@target.matrix_world)
target.matrix_world=native_rig.matrix_world.copy()
for obj,world in mesh_world.items():obj.matrix_world=world
# Blender imports some tagged native container nodes as mesh objects. Preserve
# their actual transform/metadata as empties before removing donor geometry.
for obj in list(donor_objects):
    if obj.type in ['MESH','ARMATURE'] and obj.get('avatarPart'):
        empty=bpy.data.objects.new(obj.name+'-container',None)
        bpy.context.collection.objects.link(empty)
        empty.parent=obj.parent;empty.parent_type=obj.parent_type;empty.parent_bone=obj.parent_bone
        empty.matrix_world=obj.matrix_world.copy()
        for key in obj.keys():empty[key]=obj[key]
        for child in list(obj.children):
            if child.parent_type=='BONE':continue
            world=child.matrix_world.copy();child.parent=empty;child.matrix_world=world
        donor_objects.append(empty)
        if obj==native_rig:
            world=target.matrix_world.copy();target.parent=empty;target.matrix_world=world
for obj in donor_objects:
    if obj.type=='EMPTY' and obj.parent==native_rig and obj.parent_type=='BONE':
        if obj.parent_bone not in retarget_names:
            raise RuntimeError('Unmapped native attachment parent: '+obj.parent_bone)
        world=obj.matrix_world.copy();obj.parent=target;obj.matrix_world=world
native_rig.data.pose_position='POSE'
target.data.pose_position='POSE'
clips=[]
actions=list(bpy.data.actions)
for action in actions:
    if action.name not in ['Idle','Walk','Run','Strafe','Attack','Cast','Hit','Death','TurnLeft','TurnRight']:
        continue
    native_rig.animation_data_create()
    native_rig.animation_data.action=action
    slots=list(native_rig.animation_data.action_suitable_slots)
    if len(slots)==1:
        native_rig.animation_data.action_slot=slots[0]
    original_name=action.name
    action.name='NativeSource_'+original_name
    output=bpy.data.actions.new(original_name)
    target.animation_data_create()
    target.animation_data.action=output
    start,end=action.frame_range
    for frame in range(int(start),int(end)+1):
        if (folder/'cancelled.json').exists():
            raise RuntimeError('Cancelled')
        bpy.context.scene.frame_set(frame)
        for name in retarget_names:
            a=native_rig.pose.bones.get(name)
            b=target.pose.bones.get(name)
            if not a or not b:
                raise RuntimeError('Mapped native bone missing: '+name)
            correction=a.bone.matrix_local.to_quaternion().inverted()@b.bone.matrix_local.to_quaternion()
            b.rotation_mode='QUATERNION'
            b.rotation_quaternion=correction.inverted()@a.matrix_basis.to_quaternion()@correction
            unit_ratio=native_rig.matrix_world.to_scale().length/target.matrix_world.to_scale().length
            b.location=(correction.inverted()@a.location)*unit_ratio
            b.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=name)
            b.keyframe_insert(data_path='location',frame=frame,group=name)
    output.use_fake_user=True
    clips.append(original_name)
# Retain native tagged empty/socket hierarchy; strip the donor's visible meshes,
# armature and source actions. Only UniRig's predicted skin influences survive.
for obj in donor_objects:
    if obj.type in ['MESH','ARMATURE']:
        bpy.data.objects.remove(obj,do_unlink=True)
for action in actions:
    if action.name.startswith('NativeSource_'):
        bpy.data.actions.remove(action)
for image in bpy.data.images:
    if image.has_data:
        if max(image.size)>1024:
            ratio=1024/max(image.size)
            image.scale(max(1,int(image.size[0]*ratio)),max(1,int(image.size[1]*ratio)))
        image.pack()
root['assetPreparation']={'provider':'unirig','animation_mode':'retargeted-native-clips','source_sha256':plan['source_sha256'],'rig_sha256':proof['artifact']['sha256']}
for key in ['anatomyAuthor','anatomyLicense','authoredAnatomy']:
    if key in root:del root[key]
output=folder/'candidate-01.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_extras=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_all_influences=False,export_force_sampling=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'candidate-01.blend'),compress=True)
problems=[]
if any(name not in clips for name in ['Idle','Walk','Run','Attack','Cast','Hit','Death']):
    problems.append('Native clip retargeting incomplete')
if any(('tail' in name.lower() or 'wing' in name.lower()) and name not in mapping.values() for name in predicted):
    problems.append('Extra tail/wing bones require a character-specific motion profile')
(folder/'preparation.json').write_text(json.dumps({'method':'unirig-skeleton-and-skin-native-clip-retarget-v1','sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
    'bytes':output.stat().st_size,'runtime_compatible':True,'unirig':proof,'predicted_bones':predicted,'bone_map':mapping,'native_helpers':helpers,'skin_weights':'unaltered UniRig prediction','native_clips':clips,'problems':problems,
    'limits':'Actual UniRig skin retained. Rest-space rotation retargeting is a candidate; pose, clipping, foot contact and timing must pass qualification.'},indent=2))
