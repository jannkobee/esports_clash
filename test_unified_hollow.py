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
sk_R60 = obj.data.shape_keys.key_blocks['UpperArmR_60']
delta_orig_L = np.array([v.co - obj.data.vertices[i].co for i, v in enumerate(sk_L60.data)])
delta_orig_R = np.array([v.co - obj.data.vertices[i].co for i, v in enumerate(sk_R60.data)])

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

bone_R = rig.data.bones[mapping['UpperArmR']]
moving_R = {bone_R.name, *[b.name for b in bone_R.children_recursive]}
mass_R = weights[:, [names.index(n) for n in moving_R]].sum(1)

# Contact centroid on Right chest
c_chest_R = np.array([0.080, -0.035, 0.253])

print("Testing Right Arm adjustments from candidate v12 baseline:")
# Candidate v12 base contacts: P03=0, P18=14, P19=0, P17=45
for rad_mm in [45.0, 55.0, 65.0]:
    rad_R = rad_mm / 1000.0
    dists_R = np.linalg.norm(points - c_chest_R, axis=1)
    f_ax = np.clip((rad_R - dists_R) / rad_R, 0, 1)
    field_R = f_ax * f_ax * (3 - 2 * f_ax) * (1.0 - np.clip(mass_R / 0.25, 0, 1))
    
    for dx_mm in [-0.5, -1.0, -1.5, -2.0]:  # -X is medial
        for dy_mm in [0.0, +1.0, +2.0]:     # +Y is anterior
            d_R = delta_orig_R.copy()
            d_R[:, 0] += (dx_mm / 1000.0) * field_R
            d_R[:, 1] += (dy_mm / 1000.0) * field_R
            max_d = np.linalg.norm(d_R, axis=1).max()
            if max_d > cap_limit: continue
            
            for i, v in enumerate(sk_R60.data):
                v.co = obj.data.vertices[i].co + Vector(d_R[i])
                
            c03 = eval_pose('UpperArmR', 60, child=0, twist=0)
            if c03 != 0: continue
            c18 = eval_pose('UpperArmR', 60, child=60, twist=0)
            c19 = eval_pose('UpperArmR', 60, child=60, twist=20)
            c17 = eval_pose('UpperArmR', 60, child=60, twist=-20)
            
            print(f"  rad={rad_mm:.0f}mm, dx={dx_mm:+.1f}mm, dy={dy_mm:+.1f}mm -> P03={c03}, P18={c18:2d}, P19={c19}, P17={c17:2d} (max_d={max_d*1000:.2f}mm / {cap_limit*1000:.2f}mm)")

# Restore R
for i, v in enumerate(sk_R60.data):
    v.co = obj.data.vertices[i].co + Vector(delta_orig_R[i])
