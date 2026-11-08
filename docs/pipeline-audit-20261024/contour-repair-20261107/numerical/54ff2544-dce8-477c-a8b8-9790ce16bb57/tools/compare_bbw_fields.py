"""Colab-only fixed-skeleton comparison; exports static diagnostic surfaces, not rigs."""
import hashlib
import json
import os
from pathlib import Path
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from scipy.spatial import cKDTree
from review_generated_rig import load, surface
from review_combined_joint_candidate import reset_pose, TARGETS


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main(root):
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab required')
    plan = json.loads((root / 'plan.json').read_text())
    for name, expected in plan['files'].items():
        if sha(root / name) != expected:
            raise ValueError('Frozen input mismatch: ' + name)
    report = {'id': plan['id'], 'plan': plan, 'compute': 'google', 'method': plan['method'],
              'publication_eligible': False, 'qualification_complete': False, 'candidate_available': False,
              'started_unix': time.time(), 'assets': [], 'poses': [],
              'scope': 'Static baked surfaces from identical body, skeleton and pose matrices. Unlimited dense weights isolate field shape from four-influence export. No game rig, animation, finger coverage or anatomical qualification.'}
    try:
        wr = json.loads((root / 'weight-report.json').read_text())
        if wr['weight_artifact']['sha256'] != sha(root / 'body-weights.npz') or wr['rig_sha256'] != sha(root / 'raw.glb'):
            raise ValueError('Weight source lineage mismatch')
        rigs, meshes = load(root / 'raw.glb')
        if len(rigs) != 1 or len(meshes) != 1:
            raise ValueError('Expected one body and one rig')
        rig, obj = rigs[0], meshes[0]
        rig.animation_data_clear()
        points = np.array(surface(meshes)[0])
        data = np.load(root / 'body-weights.npz')
        correspondence = float(np.linalg.norm(points - data['body_positions'], axis=1).max())
        if correspondence > 1e-8:
            raise ValueError('Body correspondence mismatch')
        names = [b.name for b in rig.data.bones]
        lookup = {n: i for i, n in enumerate(names)}
        old = np.zeros((len(points), len(names)))
        for i, v in enumerate(obj.data.vertices):
            for g in v.groups:
                name = obj.vertex_groups[g.group].name
                if name in lookup:
                    old[i, lookup[name]] = g.weight
        old /= old.sum(axis=1, keepdims=True)
        full = np.zeros_like(old)
        for j, name in enumerate(data['bone_names']):
            full[:, lookup[str(name)]] = data['weights'][:, j]
        if not np.all(np.isfinite(full)) or full.min() < 0 or np.max(np.abs(full.sum(axis=1)-1)) > 1e-8:
            raise ValueError('Invalid BBW weights')
        mapping = json.loads((root / 'baseline-report.json').read_text())['bone_map']
        height = float(np.ptp(points[:, 2]))
        centers = np.array([rig.matrix_world @ rig.data.bones[mapping[r]].head_local for r in ('UpperArmL', 'UpperArmR', 'ThighL', 'ThighR')])
        distance = np.linalg.norm(points[:, None, :] - centers[None, :, :], axis=2).min(axis=1)
        x = np.clip((height * .08 - distance) / (height * .02), 0, 1)
        alpha = x*x*(3-2*x)
        mixed = old*(1-alpha[:, None]) + full*alpha[:, None]
        mixed /= mixed.sum(axis=1, keepdims=True)
        fields = {'raw': old, 'regional': mixed, 'full': full}
        if plan.get('correction') in ('influence-bounded-bbw-v1', 'influence-bounded-bbw-v2'):
            from bounded_bbw_field import bounded_field, POLICY, SOFT_POLICY
            soft = plan['correction'] == 'influence-bounded-bbw-v2'
            if plan.get('correction_policy') != (SOFT_POLICY if soft else POLICY):
                raise ValueError('Frozen correction policy mismatch')
            parents = {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
            corrected, adoption, protected_hand, protected_torso, stats = bounded_field(old, full, names, parents, mapping)
            fields['bounded'] = corrected
            if soft:
                corrected, adoption, protected_hand, protected_torso, stats = bounded_field(old, full, names, parents, mapping, smooth_support=True)
                fields['bounded_soft'] = corrected
            artifact = root/'bounded-weights.npz'
            np.savez_compressed(artifact, weights=corrected, bone_names=np.array(names), body_positions=points,
                                adoption=adoption, protected_hand=protected_hand, protected_torso=protected_torso)
            report['correction'] = stats
            report['weight_artifact'] = {'file': artifact.name, 'sha256': sha(artifact), 'bytes': artifact.stat().st_size}
        if list(fields) != plan['fields']:
            raise ValueError('Frozen comparison fields mismatch')
        report.update(body_vertices=len(points), body_height=height, correspondence_max=correspondence,
                      regional_vertices=int(np.count_nonzero(alpha)), transition_vertices=int(np.count_nonzero((alpha > 0) & (alpha < 1))),
                      normals='Same mesh topology, UVs and materials; static normals recomputed from each posed surface.')
        hom = np.c_[points, np.ones(len(points))]
        snapshots = root / 'site' / 'snapshots'
        snapshots.mkdir(parents=True)
        inv_world = rig.matrix_world.inverted()
        expected_surfaces = {}
        for role, degrees in plan['poses']:
            reset_pose(rig)
            bone = rig.data.bones[mapping[role]]
            a = rig.matrix_world @ bone.head_local
            b = rig.matrix_world @ rig.data.bones[mapping[TARGETS[role]]].head_local
            direction = (b-a).normalized()
            inv = bone.matrix_local.to_3x3().inverted() @ rig.matrix_world.to_3x3().inverted()
            axis = (inv @ direction.cross(Vector((0, -1, 0)))).normalized()
            pb = rig.pose.bones[mapping[role]]
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = Quaternion(axis, np.deg2rad(degrees))
            bpy.context.view_layer.update()
            matrices = np.array([rig.matrix_world @ rig.pose.bones[n].matrix @ rig.data.bones[n].matrix_local.inverted() @ inv_world for n in names])[:, :3, :]
            per_bone = np.einsum('bxy,ny->nbx', matrices, hom)
            posed = {name: np.einsum('nbx,nb->nx', per_bone, weights) for name, weights in fields.items()}
            protection = {}
            if 'bounded' in posed:
                corrected_name = 'bounded_soft' if 'bounded_soft' in posed else 'bounded'
                for label, mask in [('hand', protected_hand), ('torso', protected_torso)]:
                    delta = np.linalg.norm(posed[corrected_name][mask]-posed['raw'][mask], axis=1)
                    protection[label+'_max_position_delta_vs_raw'] = float(delta.max(initial=0))
            blender_error = float(np.linalg.norm(posed['raw']-np.array(surface(meshes)[0]), axis=1).max())
            if blender_error > height*1e-6:
                raise ValueError('Matrix evaluation differs from Blender')
            center = rig.matrix_world @ pb.head
            # Blender Z-up exports as glTF Y-up. The inspector uses a right-handed scene.
            target = [center.x, center.z, -center.y]
            report['poses'].append({'joint': role, 'degrees': degrees, 'raw_blender_max_error': blender_error,
                                    'regional_to_full_max_distance': float(np.linalg.norm(posed['regional']-posed['full'], axis=1).max()),
                                    'camera_target_gltf': target, **protection})
            for field, moved in posed.items():
                mesh = obj.data.copy()
                for vertex, co in zip(mesh.vertices, moved):
                    vertex.co = co
                mesh.normals_split_custom_set([(0., 0., 0.)]*len(mesh.loops))
                mesh.update()
                snapshot = bpy.data.objects.new(f'{field}-{role}-{degrees}', mesh)
                bpy.context.collection.objects.link(snapshot)
                snapshot.matrix_world = Matrix.Identity(4)
                bpy.ops.object.select_all(action='DESELECT')
                snapshot.select_set(True)
                bpy.context.view_layer.objects.active = snapshot
                path = snapshots / (snapshot.name+'.glb')
                bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                                          export_animations=False, export_skins=False, export_morph=False)
                expected_surfaces[path.relative_to(root).as_posix()] = moved
                report['assets'].append({'field': field, 'joint': role, 'degrees': degrees,
                                         'file': path.relative_to(root).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size,
                                         'camera_target_gltf': target})
                bpy.data.objects.remove(snapshot, do_unlink=True)
                bpy.data.meshes.remove(mesh)
        # Reimport every snapshot and compare the actual exported surface, not just intended points.
        for asset in report['assets']:
            snapshot_rigs, snapshot_meshes = load(root / asset['file'])
            if snapshot_rigs or len(snapshot_meshes) != 1:
                raise ValueError('Snapshot must contain one unrigged body')
            actual = np.array(surface(snapshot_meshes)[0])
            expected = expected_surfaces[asset['file']]
            error = float(max(cKDTree(actual).query(expected)[0].max(), cKDTree(expected).query(actual)[0].max()))
            if error > height*1e-6:
                raise ValueError('Snapshot export changed posed surface')
            asset.update(static_only=True, reimport_max_surface_distance=error)
        report['status'] = 'snapshots_exported'
    except Exception as error:
        report.update(status='failed', error=f'{type(error).__name__}: {error}')
        raise
    finally:
        report['completed_unix'] = time.time()
        (root / 'field-report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main(Path(sys.argv[1]).resolve())
