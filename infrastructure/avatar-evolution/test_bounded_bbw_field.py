"""Numerical regression tests; execute in the Colab preparation environment."""
import os
import unittest
import numpy as np
from bounded_bbw_field import bounded_field


class BoundedFieldTests(unittest.TestCase):
    def setUp(self):
        if not os.environ.get('COLAB_RELEASE_TAG'):
            self.skipTest('Numerical pipeline tests run in Colab')
        self.names = ['Hips', 'Spine', 'Chest', 'UpperArmL', 'ForearmL', 'HandL', 'FingerL',
                      'UpperArmR', 'ForearmR', 'HandR', 'FingerR', 'ThighL', 'CalfL', 'ThighR', 'CalfR']
        self.index = {n: i for i, n in enumerate(self.names)}
        self.mapping = {n: n for n in self.names}
        self.parents = dict(zip(self.names, [None, 'Hips', 'Spine', 'Chest', 'UpperArmL', 'ForearmL', 'HandL',
                                             'Chest', 'UpperArmR', 'ForearmR', 'HandR', 'Hips', 'ThighL', 'Hips', 'ThighR']))

    def rows(self, dictionaries):
        result = np.zeros((len(dictionaries), len(self.names)))
        for row, values in zip(result, dictionaries):
            for name, value in values.items():
                row[self.index[name]] = value
        return result

    def test_preserves_hands_and_core_torso_with_finite_normalized_weights(self):
        old = self.rows([{'HandL': .6, 'FingerL': .4}, {'Chest': 1}, {'ThighL': .8, 'Hips': .2}])
        full = np.random.default_rng(4).random(old.shape)
        full /= full.sum(axis=1, keepdims=True)
        for soft in (False, True):
            result, _, _, _, _ = bounded_field(old, full, self.names, self.parents, self.mapping, soft)
            np.testing.assert_array_equal(result[:2], old[:2])
            np.testing.assert_allclose(result.sum(axis=1), 1, atol=1e-12)
            self.assertTrue(np.isfinite(result).all())
            self.assertGreaterEqual(result.min(), 0)

    def test_soft_support_is_continuous_across_bilateral_ownership_tie(self):
        epsilon = 1e-7
        old = self.rows([{'ThighL': .5+epsilon, 'ThighR': .5-epsilon},
                         {'ThighL': .5-epsilon, 'ThighR': .5+epsilon}])
        full = self.rows([{'ThighL': .1, 'ThighR': .1, 'CalfL': .3, 'CalfR': .3, 'Hips': .2}]*2)
        hard = bounded_field(old, full, self.names, self.parents, self.mapping)[0]
        soft = bounded_field(old, full, self.names, self.parents, self.mapping, True)[0]
        self.assertGreater(np.abs(hard[0]-hard[1]).max(), .1)
        self.assertLess(np.abs(soft[0]-soft[1]).max(), 10*epsilon)

    def test_unavailable_donor_support_fails_instead_of_creating_unweighted_vertices(self):
        old = self.rows([{'ThighL': 1}])
        full = self.rows([{'FingerR': 1}])
        for soft in (False, True):
            with self.assertRaisesRegex(ValueError, 'No donor mass'):
                bounded_field(old, full, self.names, self.parents, self.mapping, soft)


if __name__ == '__main__':
    unittest.main()
