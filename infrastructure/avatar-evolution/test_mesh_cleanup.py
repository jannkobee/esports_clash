"""Unit tests for mesh cleanup and manifold health diagnostics."""
import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mesh_cleanup import cleanup_mesh, analyze_mesh_health

class TestMeshCleanup(unittest.TestCase):
    def test_analyze_clean_mesh(self):
        # A simple tetrahedron: 4 vertices, 4 triangles, no loose vertices
        vertices = [[0, 0, 0], [1, 0, 0], [0.5, 1, 0], [0.5, 0.5, 1]]
        faces = [(0, 1, 2), (0, 1, 3), (1, 2, 3), (2, 0, 3)]
        health = analyze_mesh_health(vertices, faces)
        self.assertTrue(health['is_clean'])
        self.assertEqual(health['loose_vertices'], 0)
        self.assertEqual(health['degenerate_faces'], 0)
        self.assertEqual(health['duplicate_faces'], 0)

    def test_analyze_mesh_with_loose_verts_and_degeneracy(self):
        # 5 vertices, but vertex 4 is loose, and one face has duplicate indices (degenerate)
        vertices = [[0, 0, 0], [1, 0, 0], [0.5, 1, 0], [0.5, 0.5, 1], [10, 10, 10]]
        faces = [(0, 1, 2), (0, 0, 1)] # second face has duplicate index 0
        health = analyze_mesh_health(vertices, faces)
        self.assertFalse(health['is_clean'])
        self.assertEqual(health['loose_vertices'], 2) # vert 3 and vert 4 not in valid faces
        self.assertEqual(health['degenerate_faces'], 1)

    def test_cleanup_mesh_headless_fallback(self):
        mock_data = type('MockData', (), {'vertices': [1, 2, 3], 'polygons': [1]})()
        mock_mesh = type('MockMesh', (), {'type': 'MESH', 'data': mock_data})()

        res = cleanup_mesh(mock_mesh)
        self.assertIn('initial_vertices', res)
        self.assertIn('final_vertices', res)
        self.assertEqual(res['initial_vertices'], 3)
        self.assertEqual(res['initial_faces'], 1)

if __name__ == '__main__':
    unittest.main()
