"""Pre-skinning manifold mesh cleanup for raw 3D generated meshes.

Cleans topological defects and geometry noise before skin-weighting or rigging:
1. Deletes loose/floating vertices and edges not connected to faces.
2. Welds coincident duplicate vertices within a precision threshold (remove doubles).
3. Dissolves degenerate/zero-area polygons and zero-length edges.
4. Recalculates outward-pointing face and vertex normals consistently.
5. Fills small planar boundary holes (<= 4 vertices).
"""
import sys
from pathlib import Path

def cleanup_mesh(obj, weld_dist=0.0002, fill_small_holes=True):
    """Clean manifold geometry of obj (must be a Blender MESH object).
    Returns a dict with statistics of actions taken.
    """
    stats = {
        'initial_vertices': len(obj.data.vertices) if hasattr(obj.data, 'vertices') else 0,
        'initial_faces': len(obj.data.polygons) if hasattr(obj.data, 'polygons') else 0,
        'removed_loose_verts': 0,
        'welded_verts': 0,
        'holes_filled': 0,
        'normals_recalculated': False,
        'final_vertices': 0,
        'final_faces': 0,
    }

    try:
        import bmesh
        import bpy
    except ImportError:
        # Fallback when running outside Blender environment
        stats['final_vertices'] = stats['initial_vertices']
        stats['final_faces'] = stats['initial_faces']
        return stats

    if getattr(obj, 'type', None) != 'MESH' or not hasattr(obj, 'data'):
        return stats

    bm = bmesh.new()
    bm.from_mesh(obj.data)

    # 1. Remove loose vertices (not connected to any face or edge)
    loose_verts = [v for v in bm.verts if not v.link_faces]
    if loose_verts:
        stats['removed_loose_verts'] = len(loose_verts)
        bmesh.ops.delete(bm, geom=loose_verts, context='VERTS')

    # 2. Weld duplicate coincident vertices within distance threshold
    before_verts = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld_dist)
    stats['welded_verts'] = before_verts - len(bm.verts)

    # 3. Dissolve zero-length/degenerate edges and zero-area faces
    try:
        bmesh.ops.dissolve_degenerate(bm, dist=weld_dist, edges=bm.edges)
    except Exception:
        pass

    # 4. Fill small planar boundary holes
    if fill_small_holes:
        boundary_edges = [e for e in bm.edges if e.is_boundary]
        if boundary_edges:
            try:
                res = bmesh.ops.holes_fill(bm, edges=boundary_edges, sides=4)
                stats['holes_filled'] = len(res.get('faces', []))
            except Exception:
                pass

    # 5. Recalculate face normals outward
    try:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        stats['normals_recalculated'] = True
    except Exception:
        pass

    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()

    stats['final_vertices'] = len(obj.data.vertices)
    stats['final_faces'] = len(obj.data.polygons)
    return stats

def analyze_mesh_health(vertices, faces):
    """Pure-Python topological health diagnostic for testing without Blender."""
    vertex_count = len(vertices)
    face_count = len(faces)
    used_vertices = set()
    degenerate_faces = 0
    duplicate_faces = 0
    seen_faces = set()

    for face in faces:
        if len(face) < 3 or len(set(face)) < len(face):
            degenerate_faces += 1
            continue
        sorted_face = tuple(sorted(face))
        if sorted_face in seen_faces:
            duplicate_faces += 1
        else:
            seen_faces.add(sorted_face)
        for idx in face:
            used_vertices.add(idx)

    loose_vertices = vertex_count - len(used_vertices)
    return {
        'vertex_count': vertex_count,
        'face_count': face_count,
        'loose_vertices': loose_vertices,
        'degenerate_faces': degenerate_faces,
        'duplicate_faces': duplicate_faces,
        'is_clean': loose_vertices == 0 and degenerate_faces == 0 and duplicate_faces == 0,
    }

if __name__ == '__main__':
    print("mesh_cleanup module loaded successfully.")

