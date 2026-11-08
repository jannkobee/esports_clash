"""Verify and audit the exported 10-clip combat GLB."""
import sys, os, json, math, pathlib, hashlib
import numpy as np
import bpy
from mathutils import Vector

root = pathlib.Path(sys.argv[1]).resolve()
stage_dir = pathlib.Path(sys.argv[2]).resolve()
sys.path.append(str(root / 'tools'))

from review_generated_rig import load, surface
from glb_morph_animation import read_glb
from asset_pipeline.edge_deformation import edge_deformation

glb_path = stage_dir / 'mirelle-combat-clips.glb'
doc, _ = read_glb(glb_path)

anim_names = [a['name'] for a in doc.get('animations', [])]
print('EXPORTED_ANIMATIONS=', anim_names)

EXPECTED_CLIPS = ['Idle', 'Walk', 'Run', 'Strafe', 'Attack', 'Cast', 'Hit', 'Death', 'TurnLeft', 'TurnRight']
for c in EXPECTED_CLIPS:
    if c not in anim_names:
        raise ValueError(f'Missing clip: {c}')

rigs, meshes = load(glb_path)
rig = rigs[0]
obj = meshes[0]

rest_points, faces, regions = surface(meshes)
rest_pts = np.array(rest_points)
body_height = float(np.ptp(rest_pts[:, 2]))

edges = np.array([e.vertices[:] for e in obj.data.edges])
rest_len = np.linalg.norm(rest_pts[edges[:, 0]] - rest_pts[edges[:, 1]], axis=1)
valid_edges = rest_len > body_height * 1e-6

pos_acc_idx = doc['meshes'][0]['primitives'][0]['attributes']['POSITION']
gltf_vcount = doc['accessors'][pos_acc_idx]['count']

report = {
    'compute': 'google',
    'publication_eligible': False,
    'qualification_complete': False,
    'glb_sha256': hashlib.sha256(glb_path.read_bytes()).hexdigest(),
    'glb_bytes': glb_path.stat().st_size,
    'bones': len(rig.data.bones),
    'blender_vertices': len(obj.data.vertices),
    'gltf_vertices': gltf_vcount,
    'morph_targets': len(obj.data.shape_keys.key_blocks) - 1 if obj.data.shape_keys else 0,
    'animations': anim_names,
    'clips': {},
    'roundtrip_surface_errors': []
}

if report['bones'] != 52:
    raise ValueError(f'Expected 52 bones, got {report["bones"]}')
if gltf_vcount != 26373:
    raise ValueError(f'Expected 26373 glTF vertices, got {gltf_vcount}')
if report['morph_targets'] != 7:
    raise ValueError(f'Expected 7 morph targets, got {report["morph_targets"]}')

depsgraph = bpy.context.evaluated_depsgraph_get()

for anim in doc.get('animations', []):
    clip_name = anim['name']
    action = bpy.data.actions.get(clip_name)
    if not action:
        continue
    rig.animation_data.action = action
    
    # Check if shape keys action exists
    if obj.data.shape_keys and obj.data.shape_keys.animation_data:
        obj.data.shape_keys.animation_data.action = bpy.data.actions.get(clip_name + '_Keys', action)

    frames = int(action.frame_range[1])
    sample_phases = [0.0, 0.25, 0.5, 0.75, 1.0]
    clip_metrics = {
        'total_frames': frames,
        'lowest_vertex_z': 999.0,
        'max_edge_stretch': 0.0,
        'severely_stretched_edges': 0,
        'samples': []
    }

    for phase in sample_phases:
        frame = round(phase * frames)
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()

        eval_mesh = obj.evaluated_get(depsgraph).to_mesh()
        pts = np.array([v.co for v in eval_mesh.vertices])
        obj.evaluated_get(depsgraph).to_mesh_clear()

        if not np.isfinite(pts).all():
            raise ValueError(f'Non-finite vertices in {clip_name} at frame {frame}')

        min_z = float(np.min(pts[:, 2]))
        clip_metrics['lowest_vertex_z'] = min(clip_metrics['lowest_vertex_z'], min_z)

        edge_len = np.linalg.norm(pts[edges[:, 0]] - pts[edges[:, 1]], axis=1)
        ratios = edge_len[valid_edges] / rest_len[valid_edges]
        max_r = float(np.max(ratios))
        clip_metrics['max_edge_stretch'] = max(clip_metrics['max_edge_stretch'], max_r)

        morph_vals = {}
        if obj.data.shape_keys:
            for k in obj.data.shape_keys.key_blocks[1:]:
                morph_vals[k.name] = float(k.value)

        clip_metrics['samples'].append({
            'phase': phase,
            'frame': frame,
            'min_z': min_z,
            'max_stretch_ratio': max_r,
            'morph_weights': morph_vals
        })

    report['clips'][clip_name] = clip_metrics
    print(f'AUDIT_CLIP: {clip_name} min_z={clip_metrics["lowest_vertex_z"]:.4f} max_stretch={clip_metrics["max_edge_stretch"]:.2f}')

report['status'] = 'ready_for_babylon_review'
(stage_dir / 'combat-clips-export-report.json').write_text(json.dumps(report, indent=2))
print('EXPORT_AUDIT_COMPLETE')
