"""Constrained preparation of generated geometry using this avatar's existing rig.

No source asset is overwritten. Nearest-surface skin transfer is a candidate
construction method, not proof of correct anatomy, equipment separation or beauty.
"""
import bpy
import json
import sys
import math
import hashlib
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mesh_cleanup import cleanup_mesh

folder, source, donor = map(Path, sys.argv[sys.argv.index('--') + 1:])
plan = json.loads((folder / 'preparation-plan.json').read_text())


def stage(name):
    if (folder / 'cancelled.json').exists():
        raise RuntimeError('Cancelled')
    path = folder / 'state.json'
    state = json.loads(path.read_text())
    state.update(status=name, stage=name, publication_eligible=False)
    temp = folder / 'state.json.tmp-blender'
    temp.write_text(json.dumps(state))
    temp.replace(path)


def bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return Vector([min(v[i] for v in points) for i in range(3)]), Vector([max(v[i] for v in points) for i in range(3)])


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(donor))
donor_objects = list(bpy.context.scene.objects)
meshes = [o for o in donor_objects if o.type == 'MESH']
rigs = [o for o in donor_objects if o.type == 'ARMATURE']
if len(rigs) != 1:
    raise RuntimeError('Expected the existing character-specific common armature')
rig = rigs[0]
rig.data.pose_position = 'REST'
bpy.context.view_layer.update()
roots = [o for o in donor_objects if o.get('avatarPart') == 'avatar-root']
if len(roots) != 1:
    raise RuntimeError('Native game avatar-root metadata is missing')
root = roots[0]
lo, hi = bounds(meshes)
target_height = hi.z - lo.z
if not .1 < target_height < 1000:
    raise RuntimeError('Invalid donor dimensions')
donor_triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
samples = []
for obj in meshes:
    names = {g.index: g.name for g in obj.vertex_groups if g.name in rig.data.bones}
    if not names:
        continue
    for v in obj.data.vertices:
        weights = [(names[g.group], g.weight) for g in v.groups if g.group in names and g.weight > .0001]
        if weights:
            samples.append((obj.matrix_world @ v.co, weights))
if len(samples) < 100:
    raise RuntimeError('Existing avatar has insufficient native skin-transfer evidence')
samples = samples[::max(1, len(samples) // 50000)]
tree = KDTree(len(samples))
for i, (point, _) in enumerate(samples):
    tree.insert(point, i)
tree.balance()
# Keep the actual tagged hierarchy, skeleton, sockets and native actions. Delete
# donor body meshes so the output cannot disguise a substituted procedural avatar.
for obj in meshes:
    bpy.data.objects.remove(obj, do_unlink=True)
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(source))
generated = [o for o in bpy.context.scene.objects if o not in before and o.type == 'MESH']
if not generated:
    raise RuntimeError('Generated source has no mesh')
stage('preparing')
for obj in generated:
    cleanup_mesh(obj)
glo, ghi = bounds(generated)
height = ghi.z - glo.z
if height <= .00001:
    raise RuntimeError('Generated source has degenerate dimensions')
center = (glo + ghi) * .5
scale = target_height / height
rotation = Matrix.Rotation(math.radians(plan['yaw']), 4, 'Z')
target_center = (lo + hi) * .5
alignment = Matrix.Translation(target_center) @ rotation @ Matrix.Scale(scale, 4) @ Matrix.Translation(-center)
problems = []
if plan['profile'] == 'custom-template-v1' and not plan['attachments']:
    problems.append('Unusual anatomy requires reviewed character-specific attachment regions; shared humanoid transfer alone is insufficient')
stage('rigging')
distances = []
total_vertices = 0
for obj in generated:
    matrix = alignment @ obj.matrix_world
    coords = [matrix @ v.co for v in obj.data.vertices]
    obj.parent = root
    obj.matrix_parent_inverse = root.matrix_world.inverted()
    obj.matrix_world = Matrix.Identity(4)
    for v, point in zip(obj.data.vertices, coords):
        v.co = point
    obj.vertex_groups.clear()
    groups = {bone.name: obj.vertex_groups.new(name=bone.name) for bone in rig.data.bones}
    for v in obj.data.vertices:
        closest = tree.find_n(v.co, 4)
        distances.append(closest[0][2] / target_height)
        combined = {}
        for _, index, distance in closest:
            for name, weight in samples[index][1]:
                combined[name] = combined.get(name, 0) + weight / max(distance, target_height * .002) ** 2
        # Optional reviewed rigid regions are expressed in normalized aligned
        # coordinates and can bind a fused weapon region to a native hand/socket.
        normalized = [(v.co[i] - lo[i]) / max(hi[i] - lo[i], .000001) for i in range(3)]
        for attachment in plan['attachments']:
            if attachment['bone'] not in groups:
                raise RuntimeError('Attachment bone is absent from the native rig: ' + attachment['bone'])
            if all(attachment['min'][i] <= normalized[i] <= attachment['max'][i] for i in range(3)):
                combined = {attachment['bone']: 1.0}
        strongest = sorted(combined.items(), key=lambda item: item[1], reverse=True)[:4]
        total = sum(weight for _, weight in strongest)
        if total <= 0:
            raise RuntimeError('Unweighted generated vertex')
        for name, weight in strongest:
            groups[name].add([v.index], weight / total, 'REPLACE')
    modifier = obj.modifiers.new('NativeAvatarRig', 'ARMATURE')
    modifier.object = rig
    obj['avatarPreparation'] = 'native-surface-transfer-v1'
    total_vertices += len(obj.data.vertices)
    for material in obj.data.materials:
        if material and material.use_nodes:
            for node in material.node_tree.nodes:
                image = getattr(node, 'image', None)
                if image and max(image.size) > 1024:
                    factor = 1024 / max(image.size)
                    image.scale(max(1, int(image.size[0] * factor)), max(1, int(image.size[1] * factor)))
    triangles = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    budget = max(1000, min(60000, donor_triangles) // len(generated))
    if triangles > budget:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        decimate = obj.modifiers.new('PublishedTriangleBudget', 'DECIMATE')
        decimate.ratio = budget / triangles
        bpy.ops.object.modifier_apply(modifier=decimate.name)
stage('animating')
rig.data.pose_position = 'POSE'
actions = [a.name for a in bpy.data.actions]
required = ['Idle', 'Walk', 'Run', 'Attack', 'Cast', 'Hit', 'Death']
for name in required:
    if name not in actions:
        problems.append('Native donor clip missing: ' + name)
# Reuse this character's authored combat/locomotion curves, key times and sockets.
# Do not generate hit timing, alter animation speed or change gameplay definitions.
for image in bpy.data.images:
    if image.has_data:
        image.pack()
root['assetPreparation'] = {'version': 1, 'source_sha256': plan['source_sha256'], 'donor_sha256': plan['donor_sha256'], 'profile': plan['profile']}
output = folder / 'candidate-01.glb'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_extras=True, export_animations=True,
    export_animation_mode='ACTIONS', export_skins=True, export_all_influences=False, export_force_sampling=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'candidate-01.blend'), compress=True)
distances.sort()
p95 = distances[min(len(distances) - 1, int(len(distances) * .95))]
if p95 > .12:
    problems.append('95th-percentile native skin-transfer distance exceeds 12% of avatar height; pose/landmarks need repair')
report = {'method': 'character-specific-native-surface-transfer-v1', 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    'bytes': output.stat().st_size, 'skin_samples': len(samples), 'source_vertices': total_vertices,
    'p95_transfer_distance_fraction': p95, 'native_clips': actions, 'attachments': plan['attachments'], 'problems': problems,
    'limits': 'Surface transfer does not establish correct artistic anatomy, fused-weapon separation or unusual appendage motion. Owner identity/equipment review and actual game validation precede publication.'}
(folder / 'preparation.json').write_text(json.dumps(report, indent=2))
