"""Retarget native clips onto the actual UniRig skeleton; never transfer donor skin."""
import bpy
import json
import math
import hashlib
import sys
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bone_mapping import infer_humanoid, NATIVE
from retarget_motion import motion_delta, hip_motion_to_root, EQUIPMENT_PROFILE
from retarget_contacts import bake_contacts
from equipment_skin import rigid_equipment, regularize_skin_weights

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
mapping_review={'method':'explicit-or-native-alias','accepted':False}
for native, options in aliases.items():
    if native in mapping:
        continue
    matches=[name for name in predicted if name.split(':')[-1] in options]
    if len(matches)==1:
        mapping[native]=matches[0]
if not plan.get('bone_map') and len(mapping)<17:
    structural, mapping_review=infer_humanoid([{'name':b.name,'parent':b.parent.name if b.parent else None,'position':list(target.matrix_world@b.head_local)} for b in target.data.bones])
    if structural and all(structural.get(name)==value for name,value in mapping.items()):
        mapping.update(structural)
    elif structural:
        mapping_review.update(accepted=False,reasons=['Structural proposal conflicts with named bone aliases.'])
missing=[name for name in mapping if name not in NATIVE]+[name for name in aliases if name not in mapping or mapping[name] not in predicted]
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
        'bytes':output.stat().st_size,'runtime_compatible':False,'unirig':proof,'predicted_bones':predicted,'bone_map':mapping,'mapping_review':mapping_review,
        'problems':['Review native animation mapping for: '+', '.join(missing)],'native_clips':[]},indent=2))
    sys.exit(0)
if not mapping_review.get('accepted'):
    mapping_review={'method':'explicit-or-native-alias','accepted':True,'bone_map':mapping}
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
# Reparent only a leaf hand attachment with strong, one-sided skin evidence
# and a clearly closer opposite hand. Keep rest matrix and skin weights intact.
equipment_repairs=[]
equipment_unresolved=[]
heads={b.name:target.matrix_world@b.head_local for b in target.data.bones}
body_height=max(v.z for v in heads.values())-min(v.z for v in heads.values())
center_x=heads['Hips'].x
for bone_name in list(target.data.bones.keys()):
    bone=target.data.bones[bone_name]
    if not bone.parent or bone.parent.name not in ['HandL','HandR'] or bone.children:
        continue
    parent=bone.parent.name
    if (heads[bone.name]-heads[parent]).length<.35*body_height:
        continue
    opposite='HandL' if parent=='HandR' else 'HandR'
    samples=[]
    for obj in meshes:
        group=obj.vertex_groups.get(bone.name)
        if group:
            for vertex in obj.data.vertices:
                weight=next((g.weight for g in vertex.groups if g.group==group.index),0)
                if weight>.5:samples.append((obj.matrix_world@vertex.co,weight))
    total=sum(w for _,w in samples)
    desired_sign=1 if heads[opposite].x>center_x else -1
    side_mass=sum(w for point,w in samples if (point.x-center_x)*desired_sign>.02*body_height)
    old_distance=(heads[bone.name]-heads[parent]).length
    new_distance=(heads[bone.name]-heads[opposite]).length
    if len(samples)>=32 and total>0 and side_mass/total>.95 and new_distance<old_distance*.65:
        bpy.context.view_layer.objects.active=target;target.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        edit=target.data.edit_bones[bone_name];rest=edit.matrix.copy();length=edit.length
        edit.parent=target.data.edit_bones[opposite];edit.use_connect=False
        edit.matrix=rest;edit.length=length
        bpy.ops.object.mode_set(mode='OBJECT')
        equipment_repairs.append({'bone':bone_name,'old_parent':parent,'new_parent':opposite,'strong_vertices':len(samples),'opposite_side_weight_fraction':side_mass/total,'distance_ratio':new_distance/old_distance,'rest_geometry_and_weights':'preserved'})
    else:
        equipment_unresolved.append('Long hand attachment branch '+bone.name+' requires equipment/influence review.')
skin_repairs=[]
for obj in meshes:
    skin_repairs.extend(rigid_equipment(obj,set(target.data.bones.keys()),equipment_repairs,target))
    reg=regularize_skin_weights(obj,target,mapping.keys(),equipment_repairs)
    if reg:skin_repairs.append(reg)
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
neutral=next((action for action in actions if action.name=='Idle'),None)
if neutral is None:raise RuntimeError('Native Idle reference is required for relative animation transfer')
native_rig.animation_data_create();native_rig.animation_data.action=neutral
slots=list(native_rig.animation_data.action_suitable_slots)
if len(slots)==1:native_rig.animation_data.action_slot=slots[0]
bpy.context.scene.frame_set(int(neutral.frame_range[0]));bpy.context.view_layer.update()
contact_reference={}
for side in ['L','R']:
    foot_pt=target.matrix_world@target.data.bones['Foot'+side].head_local
    thigh_pt=target.matrix_world@target.data.bones['Thigh'+side].head_local
    contact_reference[side]=Vector((foot_pt.x,thigh_pt.y,foot_pt.z))
neutral_pose={name:(native_rig.pose.bones[name].matrix_basis.to_quaternion().copy(),native_rig.pose.bones[name].location.copy()) for name in retarget_names}

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
    bpy.context.scene.frame_set(int(start));bpy.context.view_layer.update()
    clip_start_pose={name:(native_rig.pose.bones[name].matrix_basis.to_quaternion().copy(),native_rig.pose.bones[name].location.copy()) for name in retarget_names}
    for frame in range(int(start),int(end)+1):
        if (folder/'cancelled.json').exists():
            raise RuntimeError('Cancelled')
        # Locomotion is cyclic: make the final authored sample equal the first
        # without changing clip duration or the phase-based contact trajectory.
        source_frame=int(start) if original_name in ['Walk','Run','Strafe'] and frame==int(end) else frame
        bpy.context.scene.frame_set(source_frame)
        for name in retarget_names:
            a=native_rig.pose.bones.get(name)
            b=target.pose.bones.get(name)
            if not a or not b:
                raise RuntimeError('Mapped native bone missing: '+name)
            correction=a.bone.matrix_local.to_quaternion().inverted()@b.bone.matrix_local.to_quaternion()
            b.rotation_mode='QUATERNION'
            reference_rotation,reference_location=neutral_pose[name]
            clip_rot,clip_loc=clip_start_pose[name]
            if (clip_rot@reference_rotation.inverted()).angle>.6:
                reference_rotation=clip_rot
            delta=motion_delta(a.matrix_basis.to_quaternion(),reference_rotation,original_name,name,bool(equipment_repairs))
            b.rotation_quaternion=correction.inverted()@delta@correction
            unit_ratio=native_rig.matrix_world.to_scale().length/target.matrix_world.to_scale().length
            if name in ('Root','Hips'):
                b.location=(correction.inverted()@(a.location-reference_location))*unit_ratio
            else:
                b.location=Vector((0,0,0))
        for repair in equipment_repairs:target.pose.bones[repair['bone']].matrix_basis=Matrix.Identity(4)
        # UniRig's deforming root carries garment/body weights. Apply the hip
        # rigid motion to that root too, preserving all descendant transforms;
        # leaving weighted root vertices stationary tears the body during falls.
        root_pose=target.pose.bones['Root'];hip_pose=target.pose.bones['Hips']
        root_rest=root_pose.bone.matrix_local;hip_rest=hip_pose.bone.matrix_local
        root_pose.matrix_basis=hip_motion_to_root(root_rest,hip_rest,root_pose.matrix_basis,hip_pose.matrix_basis)
        hip_pose.matrix_basis=Matrix.Identity(4)
        if original_name in ['Walk','Run','Strafe']:
            for leg_bone in ['leg:-1','leg:1','ThighL','ThighR','CalfL','CalfR','FootL','FootR']:
                if target.pose.bones.get(leg_bone):
                    target.pose.bones[leg_bone].matrix_basis=Matrix.Identity(4)
        bake_contacts(target,contact_reference,original_name,(frame-start)/max(end-start,1),equipment_repairs)
        for name in retarget_names+[r['bone'] for r in equipment_repairs]:
            b=target.pose.bones[name]
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
root['assetPreparation']={'provider':'unirig','animation_mode':'retargeted-native-clips','source_sha256':plan['source_sha256'],'rig_sha256':proof['artifact']['sha256'],'skin_repair_sha256':hashlib.sha256(json.dumps(skin_repairs,sort_keys=True).encode()).hexdigest(),'pipeline':'frozen-rig-rigid-equipment-v2'}
for key in ['anatomyAuthor','anatomyLicense','authoredAnatomy']:
    if key in root:del root[key]
output=folder/'candidate-01.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_extras=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_all_influences=False,export_force_sampling=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'candidate-01.blend'),compress=True)
problems=list(equipment_unresolved)
mapping_review['attachment_review']={'repairs':equipment_repairs,'unresolved':equipment_unresolved}
mapping_review['warnings']=equipment_unresolved
if any(name not in clips for name in ['Idle','Walk','Run','Attack','Cast','Hit','Death']):
    problems.append('Native clip retargeting incomplete')
if any(('tail' in name.lower() or 'wing' in name.lower()) and name not in mapping.values() for name in predicted):
    problems.append('Extra tail/wing bones require a character-specific motion profile')
(folder/'preparation.json').write_text(json.dumps({'method':'unirig-skeleton-and-skin-native-clip-retarget-v1','sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
    'bytes':output.stat().st_size,'runtime_compatible':True,'unirig':proof,'predicted_bones':predicted,'bone_map':mapping,'mapping_review':mapping_review,'native_helpers':helpers,'animation_reference':'native Idle first frame; bind-relative deltas','locomotion_contacts':'analytic two-bone IK; native contactGait stride; no skin or joint-length changes','equipment_repairs':equipment_repairs,'motion_profile':EQUIPMENT_PROFILE if equipment_repairs else {'name':'native-relative','clip_timing':'unchanged'},'skin_weights':'UniRig body weights; constrained disconnected equipment repairs recorded','skin_repairs':skin_repairs,'native_clips':clips,'problems':problems,
    'limits':'UniRig body skin retained; disconnected equipment changes explicitly versioned. Rest-space rotation retargeting is a candidate; pose, clipping, foot contact and timing must pass qualification.'},indent=2))
