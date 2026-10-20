import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/EsportsClash.Web/public/models/avatars-v9/c_astra.glb')
rig = next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for track in rig.animation_data.nla_tracks:
    for strip in track.strips:
        a = strip.action
        bones = set()
        for fc in a.fcurves:
            if 'pose.bones[' in fc.data_path:
                bones.add(fc.data_path.split('["')[1].split('"]')[0])
        print('Track:', track.name, 'Action:', a.name, 'fcurves:', len(a.fcurves), 'bones:', sorted(list(bones)))

