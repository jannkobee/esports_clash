"""Run in the Colab preparation environment before the source-bound repair."""
import hashlib
import json
import unittest

from contact_patch_mask import mesh_ring_falloff, torso_weight_fraction, verify_contact_record


class ContactPatchMaskTest(unittest.TestCase):
    def record(self):
        row = {'mesh': 'body', 'mesh_vertex_index': 3, 'rest_world_xyz': [1.0, 2.0, 3.0],
            'weights': {'bone_2': .4, 'bone_26': .6}}
        row['signature_sha256'] = hashlib.sha256(json.dumps(row, sort_keys=True).encode()).hexdigest()
        return row

    def test_exact_correspondence_passes(self):
        verify_contact_record(self.record(), 'body', 3, [1, 2, 3], {'bone_2': .4, 'bone_26': .6})

    def test_index_position_weights_and_signature_mismatches_reject(self):
        for mesh, index, point, weights in [('other', 3, [1, 2, 3], {'bone_2': .4, 'bone_26': .6}),
                ('body', 4, [1, 2, 3], {'bone_2': .4, 'bone_26': .6}),
                ('body', 3, [1, 2, 3.01], {'bone_2': .4, 'bone_26': .6}),
                ('body', 3, [1, 2, 3], {'bone_2': .5, 'bone_26': .5})]:
            with self.assertRaises(ValueError):
                verify_contact_record(self.record(), mesh, index, point, weights)
        row = self.record();row['signature_sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            verify_contact_record(row, 'body', 3, [1, 2, 3], row['weights'])

    def test_falloff_is_local_and_monotone(self):
        adjacency = [{1}, {0, 2}, {1, 3}, {2, 4}, {3}]
        result = mesh_ring_falloff(adjacency, [], [0], 3)
        self.assertEqual(set(result), {0, 1, 2})
        self.assertEqual(result[0], 1)
        self.assertGreater(result[1], result[2])
        self.assertGreater(result[2], 0)

    def test_import_seams_do_not_break_the_patch(self):
        adjacency = [{1}, {0}, {3}, {2, 4}, {3}]
        result = mesh_ring_falloff(adjacency, [[1, 2]], [0], 3)
        self.assertAlmostEqual(result[1], result[2])
        self.assertIn(3, result)
        self.assertNotIn(4, result)

    def test_torso_fraction_distinguishes_torso_and_limb_sides(self):
        names = ['spine', 'bone_2', 'chest']
        self.assertAlmostEqual(torso_weight_fraction({'bone_2': .4, 'chest': .4, 'arm': .2}, names, 'arm'), .8)
        self.assertAlmostEqual(torso_weight_fraction({'bone_2': .1, 'chest': .1, 'arm': .8}, names, 'arm'), .2)
        self.assertEqual(torso_weight_fraction({}, names, 'arm'), 0)


if __name__ == '__main__':
    unittest.main()
