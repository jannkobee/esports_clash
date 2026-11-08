"""Point-only evaluated surface; use full surface() when faces/regions are needed."""
import bpy
import numpy as np

def world_points(meshes):
    bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get();points=[]
    for obj in meshes:
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
        try:points.extend(evaluated.matrix_world@v.co for v in mesh.vertices)
        finally:evaluated.to_mesh_clear()
    return np.array(points)
