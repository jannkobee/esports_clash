"""Colab shape-preserving bilateral arm section handles and dual-plane hip field, original skin intact.

Translates complete proximal cross-sections for both UpperArmL and UpperArmR
with smoothed distal envelopes (tapering from 0.55 to 0.95 bone length) to resolve
transition dents, plus a contact-aware dual-plane normal/mass retraction field for ThighL.
"""
import sys, json
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
import repair_combined_contour as trial
from repair_contact_contour import contacts
from review_generated_rig import surface
from mesh_validation import rest_keys
from evaluated_points import world_points

def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * t * (10 + t * (-15 + 6 * t))

def bilateral_shoulder_field(rest, posed, edges, center, height):
    is_left = center[0] < 0
    side = 'L' if is_left else 'R'
    obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    mapping = json.loads((trial_root / 'baseline-report.json').read_text())['bone_map']
    bone = rig.data.bones[mapping['UpperArm' + side]]
    forearm_name = mapping['Forearm' + side]
    moving = {bone.name, *[b.name for b in bone.children_recursive]}
    names = [b.name for b in rig.data.bones]
    weights = np.zeros((len(rest), len(names)))
    for v in obj.data.vertices:
        for g in v.groups:
            weights[v.index, names.index(obj.vertex_groups[g.group].name)] = g.weight
    mass = weights[:, [names.index(n) for n in moving]].sum(1)
    _, faces, _ = surface([obj])
    f, pairs = contacts(posed, faces, rest_keys([Vector(p) for p in rest]))
    if not len(pairs):
        return np.zeros_like(rest), np.zeros(len(rest), bool), {'solve_vertices': 0, 'scope': f'No contacts on UpperArm{side}'}
    seeds = np.unique(f[np.array(pairs).ravel()].ravel())
    arm = seeds[mass[seeds] >= 0.55]
    chest = seeds[mass[seeds] <= 0.35]
    if not len(arm) or not len(chest):
        return np.zeros_like(rest), np.zeros(len(rest), bool), {'solve_vertices': 0, 'scope': f'No arm/chest contact pair on UpperArm{side}'}

    elbow = np.array(rig.matrix_world @ rig.data.bones[forearm_name].head_local)
    axis = elbow - center
    length = np.linalg.norm(axis)
    axis /= length
    along = (rest - center) @ axis

    # Smoothed envelope: rises over first 25% of bone, tapers down gradually across 55%-95%
    envelope = smooth(along / (length * 0.25)) * (1 - smooth((along - length * 0.55) / (length * 0.40)))
    arm_field = envelope * smooth((mass - 0.25) / 0.50)

    # Lateral displacement and chest compression
    if is_left:
        arm_pen = float(np.quantile(posed[arm, 0], 0.95)) - (center[0] - height * 0.004)
        chest_pen = (center[0] + height * 0.004) - float(np.quantile(posed[chest, 0], 0.05))
        medial = smooth((-height * 0.045 - rest[:, 0]) / (height * 0.015))
        amount = min(height * 0.018, max(0.0, arm_pen))
        arm_disp_x = -amount * arm_field
        chest_amount = min(height * 0.010, max(0.0, chest_pen))
        chest_dir = +1.0
    else:
        arm_pen = (center[0] + height * 0.004) - float(np.quantile(posed[arm, 0], 0.05))
        chest_pen = float(np.quantile(posed[chest, 0], 0.95)) - (center[0] - height * 0.004)
        medial = smooth((rest[:, 0] - height * 0.045) / (height * 0.015))
        amount = min(height * 0.018, max(0.0, arm_pen))
        arm_disp_x = +amount * arm_field
        chest_amount = min(height * 0.010, max(0.0, chest_pen))
        chest_dir = -1.0

    # Separate chest compression is a coherent displacement with geodesic fade
    _, first, cohort = np.unique(np.round(rest, 7), axis=0, return_index=True, return_inverse=True)
    x = rest[first]
    e = np.sort(cohort[edges], axis=1)
    e = np.unique(e[e[:, 0] != e[:, 1]], axis=0)
    dl = np.linalg.norm(x[e[:, 0]] - x[e[:, 1]], axis=1)
    keep = dl > height * 1e-6
    e = e[keep]; dl = dl[keep]
    graph = coo_matrix((np.r_[dl, dl], (np.r_[e[:, 0], e[:, 1]], np.r_[e[:, 1], e[:, 0]])), shape=(len(x), len(x))).tocsr()
    dist = dijkstra(graph, directed=False, indices=np.unique(cohort[chest]), min_only=True, limit=height * 0.04)[cohort]
    chest_field = smooth((height * 0.04 - dist) / (height * 0.03)) * (1 - smooth((mass - 0.15) / 0.35))
    upper = 1 - smooth((rest[:, 2] - center[2]) / (height * 0.03))
    chest_disp_x = chest_dir * chest_amount * chest_field

    wanted = np.zeros_like(rest)
    wanted[:, 0] = (arm_disp_x + chest_disp_x) * medial * upper
    wanted[~np.isfinite(wanted)] = 0

    # One global scale enforces BOTH frozen caps without per-vertex clipping
    inv = rig.matrix_world.inverted()
    m = np.einsum('nb,bxy->nxy', weights, np.array([rig.matrix_world @ rig.pose.bones[n].matrix @ rig.data.bones[n].matrix_local.inverted() @ inv for n in names])[:, :3, :3])
    active = np.linalg.norm(wanted, axis=1) > 1e-12
    if active.any():
        delta = np.linalg.solve(m[active], wanted[active, :, None])[:, :, 0]
        maximum = max(float(np.linalg.norm(delta, axis=1).max()), float(np.linalg.norm(wanted, axis=1).max()))
        scale = min(1.0, height * 0.02 / max(maximum, 1e-30))
        wanted *= scale
    else:
        scale = 1.0

    return wanted, active, {
        'solve_vertices': int(active.sum()), 'arm_handles': len(arm), 'chest_handles': len(chest),
        'section_translation': amount, 'chest_translation': chest_amount, 'global_frozen_cap_scale': scale,
        'max_target_delta': float(np.linalg.norm(wanted, axis=1).max()) if active.any() else 0.0,
        'scope': f'Bilateral UpperArm{side} proximal cross-section translation with coherent chest compression'
    }

def dual_plane_hip_field(rest, posed, edges, center, height):
    obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    mapping = json.loads((trial_root / 'baseline-report.json').read_text())['bone_map']
    bone = rig.data.bones[mapping['ThighL']]
    moving = {bone.name, *[b.name for b in bone.children_recursive]}
    names = [b.name for b in rig.data.bones]
    weights = np.zeros((len(rest), len(names)))
    for v in obj.data.vertices:
        for g in v.groups:
            weights[v.index, names.index(obj.vertex_groups[g.group].name)] = g.weight
    mass = weights[:, [names.index(n) for n in moving]].sum(1)
    _, faces, _ = surface([obj])
    f, pairs = contacts(posed, faces, rest_keys([Vector(p) for p in rest]))
    seeds = np.unique(f[np.array(pairs).ravel()].ravel()) if len(pairs) else np.array([], dtype=int)

    if len(seeds):
        c_rest = rest[seeds].mean(0)
    else:
        c_rest = center + height * np.array([0.042, -0.018, -0.055])

    rad = height * 0.05
    dists = np.linalg.norm(rest - c_rest, axis=1)
    field = np.clip((rad - dists) / rad, 0, 1)
    field = field * field * (3 - 2 * field)
    active = (field > 0) & (rest[:, 0] <= height * 0.005)

    m_ref = 0.20
    scale_z = height * 0.008
    scale_y = height * 0.004
    scale_x = height * 0.002

    wanted = np.zeros_like(rest)
    diff = mass - m_ref
    # Posterior retraction everywhere in crease
    wanted[active, 1] = scale_y * field[active] * (1.0 + 0.5 * np.tanh(diff[active] * 5.0))
    # Vertical differential: thigh fold moves -Z, pelvis wall moves +Z
    wanted[active, 2] = -scale_z * field[active] * np.tanh(diff[active] * 5.0)
    # Medial displacement for pelvic floor
    wanted[active, 0] = scale_x * field[active] * np.clip(-diff[active] * 5.0, 0, 1)
    wanted[~np.isfinite(wanted)] = 0

    active_mask = np.linalg.norm(wanted, axis=1) > 1e-12

    return wanted, active_mask, {
        'solve_vertices': int(active_mask.sum()),
        'seeds_detected': len(seeds),
        'scale_y': scale_y,
        'scale_z': scale_z,
        'scale_x': scale_x,
        'm_ref': m_ref,
        'max_target_delta': float(np.linalg.norm(wanted, axis=1).max()) if active_mask.any() else 0.0,
        'scope': 'Dual-contact-plane smooth mass differential retraction for ThighL groin crease'
    }

if __name__ == '__main__':
    trial_root = Path(sys.argv[1]).resolve()
    trial.POLICY = {
        **trial.POLICY,
        'version': 'combined-dual-plane-hip-v8',
        'section_handle_policy': {
            'arm_mass_support': [0.25, 0.75],
            'arm_axial_envelope': [0, 0.25, 0.55, 0.95],
            'max_arm_handle_height': 0.018,
            'max_chest_handle_height': 0.01,
            'chest_rest_geodesic_support_height': 0.04,
            'cap': 'one global scale in both rest and posed spaces'
        },
        'hip_policy': {
            'method': 'dual_plane_mass_differential',
            'm_ref': 0.20,
            'scale_y_height': 0.004,
            'scale_z_height': 0.008,
            'scale_x_height': 0.002,
            'support_radius_height': 0.05
        },
        'bilateral_shoulders': True,
        'hip': 'dual_plane_mass_differential'
    }
    trial.shoulder_field = bilateral_shoulder_field
    trial.fair_patch = dual_plane_hip_field
    original_surface = trial.surface
    topology = {}
    def cached_surface(meshes):
        identity = tuple(o.as_pointer() for o in meshes)
        if identity not in topology:
            points, faces, regions = original_surface(meshes)
            if not np.array_equal(np.array(points), world_points(meshes)):
                raise ValueError('Cached point evaluator mismatch')
            if any(len(p.vertices) != 3 for o in meshes for p in o.data.polygons):
                raise ValueError('Triangle topology required')
            topology[identity] = (faces, regions)
            return points, faces, regions
        faces, regions = topology[identity]
        return [Vector(p) for p in world_points(meshes)], faces, regions
    trial.surface = cached_surface
    trial.main(trial_root)
