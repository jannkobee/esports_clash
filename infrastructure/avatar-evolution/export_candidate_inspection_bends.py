"""Colab-only diagnostic clips for exact backoffice candidate visual comparison."""
import hashlib
import json
import math
import os
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

from review_generated_rig import load, surface
from mesh_validation import collision_summary, rest_keys
from candidate_animation import clear_imported_animation, bind_imported_clip
from glb_morph_animation import read_glb

TARGETS = {'UpperArmL': 'ForearmL', 'UpperArmR': 'ForearmR',
    'ForearmL': 'HandL', 'ForearmR': 'HandR', 'ThighL': 'CalfL',
    'ThighR': 'CalfR', 'CalfL': 'FootL', 'CalfR': 'FootR'}


def main(root):
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab is required for diagnostic animation processing')
    plan = json.loads((root / 'plan.json').read_text())
    for name, expected in plan['files'].items():
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
            raise ValueError('Frozen input mismatch: ' + name)
    mapping = json.loads((root / 'baseline-report.json').read_text())['bone_map']
    result = {'id': plan['id'], 'compute': 'google', 'publication_eligible': False,
        'qualification_complete': False, 'assets': []}
    for label in ('parent', 'current'):
        source = root / 'site' / (label + '.glb')
        report = json.loads((root / (label + '-report.json')).read_text())
        expected_rows = report.get('reloaded_poses', report.get('poses'))
        expected = {(p['joint'], p['degrees']): p['self_intersections'] for p in expected_rows}
        corrective = bool(report.get('corrective_recipe'))
        output = root / 'site' / (label + '-stress.glb')
        if corrective:
            native = root / 'prebaked' / (label + '-stress.glb')
            proof = report['corrective_stress_artifact']
            if (not native.is_file() or hashlib.sha256(native.read_bytes()).hexdigest() != proof['sha256']
                    or proof['source_candidate_sha256'] != hashlib.sha256(source.read_bytes()).hexdigest()):
                raise ValueError('Exact portable corrective stress artifact required')
            document, _ = read_glb(native)
            if document['asset']['extras']['correctiveBake']['source_candidate_sha256'] != proof['source_candidate_sha256']:
                raise ValueError('Corrective clip/source metadata mismatch')
            output.write_bytes(native.read_bytes())
        else:
            rigs, meshes = load(source)
            if len(rigs) != 1:
                raise ValueError('Expected one armature')
            rig = rigs[0]
            rig.animation_data_clear()
            for bone in rig.pose.bones:
                bone.matrix_basis = Matrix.Identity(4)
            axes = {}
            for role, child in TARGETS.items():
                bone = rig.pose.bones[mapping[role]]
                start = rig.matrix_world @ bone.bone.head_local
                end = rig.matrix_world @ rig.data.bones[mapping[child]].head_local
                desired = Vector((0, 1 if role.startswith('Calf') else -1, 0))
                world_axis = (end - start).normalized().cross(desired).normalized()
                axes[role] = (bone.bone.matrix_local.to_3x3().inverted()
                    @ rig.matrix_world.to_3x3().inverted() @ world_axis).normalized()
            scene = bpy.context.scene
            scene.render.fps = 30
            scene.frame_start, scene.frame_end = 0, 60
            for action in list(bpy.data.actions):
                bpy.data.actions.remove(action)
            for role, axis in axes.items():
                action = bpy.data.actions.new('Stress_' + role)
                rig.animation_data_create()
                rig.animation_data.action = action
                for frame, degrees in ((0, 0), (15, 45), (30, 90), (45, 45), (60, 0)):
                    for bone in rig.pose.bones:
                        bone.rotation_mode = 'QUATERNION'
                        bone.rotation_quaternion = Quaternion(axis, math.radians(degrees)) if bone.name == mapping[role] else Quaternion()
                        bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
                action.use_fake_user = True
            rig.animation_data.action = None
            for bone in rig.pose.bones:
                bone.matrix_basis = Matrix.Identity(4)
            scene.frame_set(0)
            bpy.ops.object.select_all(action='DESELECT')
            for obj in [rig, *meshes]:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = rig
            output = root / 'site' / (label + '-stress.glb')
            bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
                export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_skins=True)
        rigs, meshes = load(output)
        scene = bpy.context.scene
        rig = rigs[0]
        clear_imported_animation(rig, meshes)
        scene.frame_set(0)
        rest, faces, regions = surface(meshes)
        keys = rest_keys(rest)
        rows = []
        for role in TARGETS:
            action, bindings = bind_imported_clip(rig, meshes, 'Stress_' + role,
                corrective and role in ('UpperArmL', 'UpperArmR', 'ThighL', 'ThighR'))
            for phase, degrees in ((.25, 45), (.5, 90)):
                first, last = action.frame_range
                frame = first + (last - first) * phase
                scene.frame_set(math.floor(first) - 1)
                scene.frame_set(math.floor(frame), subframe=frame - math.floor(frame))
                points, current_faces, _ = surface(meshes)
                if current_faces != faces:
                    raise ValueError('Diagnostic export changed posed topology')
                measured = collision_summary(points, faces, keys, regions)['self_intersections']
                morph_weights = {key.name: float(key.value) for obj in meshes if obj.data.shape_keys
                    for key in obj.data.shape_keys.key_blocks if key.name != 'Basis'}
                expected_pose = next(p for p in expected_rows if p['joint'] == role and p['degrees'] == degrees)
                if corrective and any(abs(morph_weights.get(name, -1) - value) > 1e-5 for name, value in expected_pose['morph_weights'].items()):
                    raise ValueError('Corrective morph channels do not reproduce the recorded pose')
                rows.append({'morph_weights': morph_weights, 'joint': role, 'degrees': degrees, 'phase': phase,
                    'imported_frame_range': [first, last], 'sampled_frame': frame,
                    'intersections': measured, 'expected': expected[(role, degrees)]})
        result['assets'].append({'label': label, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'stress_sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'stress_bytes': output.stat().st_size,
            'poses': rows, 'baseline_reproduced': all(p['intersections'] == p['expected'] for p in rows)})
        (root / 'bend-export-report.json').write_text(json.dumps(result, indent=2))
        if not result['assets'][-1]['baseline_reproduced']:
            raise ValueError('Exported diagnostic clips do not reproduce recorded candidate bends')
    result['status'] = 'diagnostic_clips_exported'
    (root / 'bend-export-report.json').write_text(json.dumps(result, indent=2))


if __name__ == '__main__':
    main(Path(sys.argv[1]).resolve())
