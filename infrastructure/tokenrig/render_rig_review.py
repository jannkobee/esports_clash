"""Read-only raw-rig inspection before any deformation repair or retargeting."""
import bpy
import hashlib
import json
import math
from pathlib import Path
import sys
from mathutils import Vector

sys.path.insert(0, '/workspace/infrastructure/avatar-evolution')
from bone_mapping import infer_humanoid

source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
if len(rigs) != 1:
    raise RuntimeError('Expected one actual predicted armature')
rig = rigs[0]
bone_displays = {bone.custom_shape for bone in rig.pose.bones if bone.custom_shape}
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in bone_displays and not o.hide_render]
bones = [{'name': b.name, 'parent': b.parent.name if b.parent else None,
          'position': list(rig.matrix_world @ b.head_local)} for b in rig.data.bones]
mapping, mapping_review = infer_humanoid(bones, profile_name='humanoid_unarmed')
weights = []
for mesh in meshes:
    groups = {g.index for g in mesh.vertex_groups if g.name in rig.data.bones}
    counts, sums, finite_nonnegative = [], [], True
    for vertex in mesh.data.vertices:
        raw_weights = [g.weight for g in vertex.groups if g.group in groups]
        finite_nonnegative = finite_nonnegative and all(math.isfinite(w) and w >= 0 for w in raw_weights)
        influences = [w for w in raw_weights if abs(w) > 1e-8]
        counts.append(len(influences))
        sums.append(sum(influences))
    weights.append({'mesh': mesh.name, 'vertices': len(counts), 'max_influences': max(counts),
                    'unweighted': sum(n == 0 for n in counts),
                    'max_normalization_error': max(abs(s - 1) for s in sums),
                    'finite_nonnegative': finite_nonnegative})

points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector([min(p[i] for p in points) for i in range(3)])
hi = Vector([max(p[i] for p in points) for i in range(3)])
center, span = (lo + hi) / 2, max(hi - lo)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'TEXTURE'
scene.display.shading.show_shadows = True
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
camera = bpy.data.objects.new('ReviewCamera', bpy.data.cameras.new('ReviewCamera'))
bpy.context.collection.objects.link(camera)
scene.camera = camera
camera.data.ortho_scale = span * 1.25
views = []


def render(name, azimuth, perspective=False):
    camera.location = center + Vector((math.sin(azimuth) * span * 3, -math.cos(azimuth) * span * 3, span * .25))
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'PERSP' if perspective else 'ORTHO'
    camera.data.lens = 50
    scene.render.filepath = str(output / (name + '.png'))
    bpy.ops.render.render(write_still=True)
    views.append(name)


for name, azimuth in [('rest-front', 0), ('rest-side', math.pi / 2), ('rest-rear', math.pi)]:
    render(name, azimuth)
render('rest-perspective', math.pi / 4, True)
stress_roles = {'ForearmL': 55, 'ForearmR': -55, 'UpperArmL': 20, 'UpperArmR': -20,
                'CalfL': 25, 'CalfR': -25}
applied = {}
for role, degrees in stress_roles.items():
    name = (mapping or {}).get(role)
    if name in rig.pose.bones:
        bone = rig.pose.bones[name]
        bone.rotation_mode = 'XYZ'
        bone.rotation_euler.z = math.radians(degrees)
        applied[role] = {'bone': name, 'local_z_degrees': degrees}
bpy.context.view_layer.update()
if applied:
    render('stress-front', 0)
    render('stress-perspective', math.pi / 4, True)

report = {
    'artifact_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'blender': bpy.app.version_string, 'joint_count': len(bones), 'bones': bones,
    'weights': weights, 'bone_map': mapping, 'mapping_review': mapping_review,
    'excluded_bone_displays': [o.name for o in bone_displays],
    'stress_rotations': applied, 'views': views, 'publication_eligible': False,
    'scope': 'Raw predicted rig only. No repair, donor weights or combat retargeting. Local-axis stress poses do not qualify combat animation.',
}
(output / 'rig-review.json').write_text(json.dumps(report, indent=2))
print(json.dumps({k: v for k, v in report.items() if k not in ('bones', 'bone_map', 'mapping_review')}, indent=2))
