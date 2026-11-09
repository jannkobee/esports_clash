"""Bind all imported glTF action slots, including shape-key weight channels."""
import bpy
from mathutils import Matrix


def animation_blocks(rig,meshes):
    return [rig,*[obj.data.shape_keys for obj in meshes if obj.data.shape_keys]]


def clear_imported_animation(rig,meshes):
    for block in animation_blocks(rig,meshes):
        if block.animation_data:
            block.animation_data.action=None
            for track in block.animation_data.nla_tracks:track.mute=True
    for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    for obj in meshes:
        if obj.data.shape_keys:
            for key in obj.data.shape_keys.key_blocks:key.value=0


def bind_imported_clip(rig,meshes,name,require_morph=False):
    clear_imported_animation(rig,meshes);proof=[];rig_action=None
    for block in animation_blocks(rig,meshes):
        block.animation_data_create();animation=block.animation_data
        strips=[strip for track in animation.nla_tracks if track.name==name for strip in track.strips]
        action=strips[0].action if len(strips)==1 else bpy.data.actions.get(name)
        if action is None:
            if block==rig or require_morph:raise ValueError('Required clip missing on animation block: '+name)
            continue
        animation.action=action
        slots=list(animation.action_suitable_slots)
        if len(strips)==1 and hasattr(strips[0],'action_slot') and strips[0].action_slot in slots:
            animation.action_slot=strips[0].action_slot
        elif len(slots)==1:animation.action_slot=slots[0]
        elif slots:raise ValueError('Ambiguous imported glTF action slot')
        elif require_morph and block!=rig:raise ValueError('Morph clip has no compatible action slot')
        proof.append({'block':block.name,'action':action.name,'suitable_slots':len(slots)})
        if block==rig:rig_action=action
    if rig_action is None:raise ValueError('Skeleton action missing')
    return rig_action,proof
