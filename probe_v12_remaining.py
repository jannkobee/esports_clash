import sys, pathlib, json
import numpy as np

work = pathlib.Path('/content/teamfight-preparation/reviews/84d03232-5dbb-4067-8b4a-f849e1d44f31')
tools = work / 'tools'
sys.path.append(str(tools))

import bpy
from mathutils import Vector, Quaternion, Matrix
from review_generated_rig import surface
from review_combined_joint_candidate import TARGETS
from joint_pose_contract import apply_pose, direction, rotate_world
from repair_contact_contour import contacts
from mesh_validation import rest_keys

bpy.ops.wm.open_mainfile(filepath=str(work / 'contour-candidate.blend'))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')

points, faces, regions = surface([obj])
points = np.array(points)
height = float(np.ptp(points[:, 2]))
keys = rest_keys([Vector(p) for p in points])
mapping = json.loads((work / 'baseline-report.json').read_text())['bone_map']
names = [b.name for b in rig.data.bones]

weights = np.zeros((len(points), len(names)))
for v in obj.data.vertices:
    for g in v.groups:
        weights[v.index, names.index(obj.vertex_groups[g.group].name)] = g.weight

def clean_reset(rig):
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
        pb.location = Vector((0, 0, 0))
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.scale = Vector((1, 1, 1))
    bpy.context.view_layer.update()

def set_pose(role, bend, child=0, twist=0):
    clean_reset(rig)
    for k in obj.data.shape_keys.key_blocks: k.value = 0
    if role == 'Rest': return
    proof = apply_pose(rig, mapping, role, bend, 'world_target')
    name = mapping[role]; ch = mapping[TARGETS[role]]
    if twist != 0:
        rotate_world(rig, name, direction(rig, name, ch), twist)
    if child != 0:
        pb = rig.pose.bones[ch]
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = Quaternion(Vector((1, 0, 0)), np.deg2rad(child))
        
    t = np.clip(bend / 60, 0, 1); a = t * t * (3 - 2 * t)
    t = np.clip((bend - 60) / 30, 0, 1); b = t * t * (3 - 2 * t)
    for k, v in [(role + '_60', a * (1 - b)), (role + '_90', b)]:
        if k in obj.data.shape_keys.key_blocks:
            obj.data.shape_keys.key_blocks[k].value = float(v)
    bpy.context.view_layer.update()

for case_idx, (role, bend, child, twist) in [
    (18, ('UpperArmR', 60, 60, 0)),
    (16, ('UpperArmL', 60, 60, 20)),
    (17, ('UpperArmR', 60, 60, -20)),
]:
    set_pose(role, bend, child, twist)
    pos = np.array(surface([obj])[0])
    f, pairs = contacts(pos, faces, keys)
    print(f"\nPose {case_idx} ({role}-{bend}-c{child}-t{twist}): {len(pairs)} contacts")
    
    verts = set()
    for a, b in pairs:
        verts.update(f[a])
        verts.update(f[b])
    verts = sorted(list(verts))
    
    arm_name = mapping[role]
    chest_name = mapping['Chest']
    w_arm = weights[verts, names.index(arm_name)]
    w_chest = weights[verts, names.index(chest_name)]
    
    arm_verts = [v for v, wa in zip(verts, w_arm) if wa > 0.4]
    chest_verts = [v for v, wc in zip(verts, w_chest) if wc > 0.1]
    
    print(f"  Colliding vertices: {len(verts)} total ({len(arm_verts)} on arm, {len(chest_verts)} on chest)")
    if len(arm_verts):
        c_arm = points[arm_verts].mean(0)
        p_arm = pos[arm_verts].mean(0)
        print(f"  Arm contact centroid: rest={c_arm.round(4)}, posed={p_arm.round(4)}")
    if len(chest_verts):
        c_chest = points[chest_verts].mean(0)
        p_chest = pos[chest_verts].mean(0)
        print(f"  Chest contact centroid: rest={c_chest.round(4)}, posed={p_chest.round(4)}")
