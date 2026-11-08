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
cap_limit = height * 0.02
keys = rest_keys([Vector(p) for p in points])
mapping = json.loads((work / 'baseline-report.json').read_text())['bone_map']
names = [b.name for b in rig.data.bones]

weights = np.zeros((len(points), len(names)))
for v in obj.data.vertices:
    for g in v.groups:
        weights[v.index, names.index(obj.vertex_groups[g.group].name)] = g.weight

sk_L60 = obj.data.shape_keys.key_blocks['UpperArmL_60']
delta_orig_L = np.array([v.co - obj.data.vertices[i].co for i, v in enumerate(sk_L60.data)])

def clean_reset(rig):
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
        pb.location = Vector((0, 0, 0))
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.scale = Vector((1, 1, 1))
    bpy.context.view_layer.update()

def eval_pose(role, bend, child=0, twist=0):
    clean_reset(rig)
    for k in obj.data.shape_keys.key_blocks: k.value = 0
    if role == 'Rest': return 0
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
    pos = np.array(surface([obj])[0])
    f, pairs = contacts(pos, faces, keys)
    return len(pairs)

bone_L = rig.data.bones[mapping['UpperArmL']]
moving_L = {bone_L.name, *[b.name for b in bone_L.children_recursive]}
mass_L = weights[:, [names.index(n) for n in moving_L]].sum(1)

# Contact centroid on Left chest
c_chest_L = np.array([-0.077, -0.036, 0.250])

print("Testing Left Arm adjustments from candidate v12 baseline:")
# In candidate v12: P02=0, P15=0, P16=48
for rad_mm in [45.0, 55.0, 65.0]:
    rad_L = rad_mm / 1000.0
    dists_L = np.linalg.norm(points - c_chest_L, axis=1)
    f_ax = np.clip((rad_L - dists_L) / rad_L, 0, 1)
    field_L = f_ax * f_ax * (3 - 2 * f_ax) * (1.0 - np.clip(mass_L / 0.25, 0, 1))
    
    for dx_mm in [+0.5, +1.0, +1.5, +2.0]:  # +X is medial on left
        for dy_mm in [0.0, +1.0, +2.0]:     # +Y is anterior
            d_L = delta_orig_L.copy()
            d_L[:, 0] += (dx_mm / 1000.0) * field_L
            d_L[:, 1] += (dy_mm / 1000.0) * field_L
            max_d = np.linalg.norm(d_L, axis=1).max()
            if max_d > cap_limit: continue
            
            for i, v in enumerate(sk_L60.data):
                v.co = obj.data.vertices[i].co + Vector(d_L[i])
                
            c02 = eval_pose('UpperArmL', 60, child=0, twist=0)
            if c02 != 0: continue
            c15 = eval_pose('UpperArmL', 60, child=60, twist=0)
            c16 = eval_pose('UpperArmL', 60, child=60, twist=20)
            
            print(f"  rad={rad_mm:.0f}mm, dx={dx_mm:+.1f}mm, dy={dy_mm:+.1f}mm -> P02={c02}, P15={c15:2d}, P16={c16:2d} (max_d={max_d*1000:.2f}mm / {cap_limit*1000:.2f}mm)")

# Restore L
for i, v in enumerate(sk_L60.data):
    v.co = obj.data.vertices[i].co + Vector(delta_orig_L[i])
