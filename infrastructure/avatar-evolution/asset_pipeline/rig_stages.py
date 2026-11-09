"""Opt-in, immutable Blender stage evidence. Never a publication gate by itself."""
import hashlib
import json
import math
from pathlib import Path

import bpy


class RigStages:
    def __init__(self, folder, enabled=False):
        self.folder = Path(folder) / 'rig-stages'
        self.enabled = enabled
        self.records = []
        if enabled:
            self.folder.mkdir(exist_ok=False)

    def capture(self, name, rig, meshes):
        if not self.enabled:
            return
        bpy.context.view_layer.update()
        path = self.folder / (name + '.blend')
        bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
        record = {'stage': name, 'file': path.name,
                  'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                  'joints': {b.name: {'head': list(rig.matrix_world @ b.head),
                                      'tail': list(rig.matrix_world @ b.tail),
                                      'basis': [list(row) for row in b.matrix_basis]}
                             for b in rig.pose.bones},
                  'meshes': []}
        depsgraph = bpy.context.evaluated_depsgraph_get()
        for obj in meshes:
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.to_mesh()
            points = [evaluated.matrix_world @ v.co for v in mesh.vertices]
            record['meshes'].append({'name': obj.name, 'vertices': len(points),
                'finite': all(math.isfinite(x) for p in points for x in p),
                'bounds': [[min(p[i] for p in points) for i in range(3)],
                           [max(p[i] for p in points) for i in range(3)]] if points else []})
            evaluated.to_mesh_clear()
        self.records.append(record)
        (self.folder / 'stages.json').write_text(json.dumps({
            'publication_eligible': False, 'stages': self.records}, indent=2))
