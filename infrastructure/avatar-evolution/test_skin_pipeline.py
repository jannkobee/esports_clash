import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bone_mapping import (
    NATIVE, CANONICAL_ROLES, CHARACTER_PROFILES,
    resolve_character_profile, infer_humanoid
)
from equipment_skin import validate_skin_weights


class CanonicalSkeletonAndProfileTest(unittest.TestCase):
    def test_canonical_roles_contract(self):
        """All 17 native joints must be present and marked mandatory."""
        for joint in NATIVE:
            self.assertIn(joint, CANONICAL_ROLES)
            self.assertTrue(CANONICAL_ROLES[joint]['mandatory'])
        # Extended joints exist but are optional
        for joint in ('ClavicleL', 'ClavicleR', 'ToeL', 'ToeR', 'Neck'):
            self.assertIn(joint, CANONICAL_ROLES)
            self.assertFalse(CANONICAL_ROLES[joint]['mandatory'])

    def test_character_profiles_inventory(self):
        """All 10 required character animation profiles must be defined."""
        expected = [
            'humanoid_unarmed', 'humanoid_sword', 'humanoid_dual_blade',
            'humanoid_staff', 'humanoid_shield', 'humanoid_ranged',
            'humanoid_mage', 'quadruped', 'flying_creature', 'custom_creature'
        ]
        for name in expected:
            self.assertIn(name, CHARACTER_PROFILES)
            profile = CHARACTER_PROFILES[name]
            self.assertIn('description', profile)
            self.assertIn('mandatory_joints', profile)
            self.assertIn('locomotion_stride_multiplier', profile)
            self.assertGreater(profile['locomotion_stride_multiplier'], 0.5)

    def test_resolve_character_profile_selection(self):
        """Profile resolver selects appropriate profile based on equipment and metadata."""
        # Unarmed default
        self.assertEqual(resolve_character_profile(), 'humanoid_unarmed')
        # Sword
        self.assertEqual(
            resolve_character_profile(equipment_plan=[{'slot': 'primary', 'weapon_type': 'one_handed_sword'}]),
            'humanoid_sword'
        )
        # Shield + Sword
        self.assertEqual(
            resolve_character_profile(equipment_plan=[
                {'slot': 'primary', 'weapon_type': 'one_handed_sword'},
                {'slot': 'secondary', 'weapon_type': 'shield'}
            ]),
            'humanoid_shield'
        )
        # Dual blade
        self.assertEqual(
            resolve_character_profile(equipment_plan=[
                {'slot': 'primary', 'weapon_type': 'dagger'},
                {'slot': 'secondary', 'weapon_type': 'dagger'}
            ]),
            'humanoid_dual_blade'
        )
        # Staff
        self.assertEqual(
            resolve_character_profile(equipment_plan=[{'slot': 'primary', 'weapon_type': 'staff'}]),
            'humanoid_staff'
        )
        # Ranged / Marksman
        self.assertEqual(
            resolve_character_profile(avatar_meta={'role': 'Marksman'}),
            'humanoid_ranged'
        )
        # Mage
        self.assertEqual(
            resolve_character_profile(avatar_meta={'role': 'Mage'}),
            'humanoid_mage'
        )
        # Quadruped / Flying archetype
        self.assertEqual(
            resolve_character_profile(avatar_meta={'design': {'archetype': 'quadruped_beast'}}),
            'quadruped'
        )
        self.assertEqual(
            resolve_character_profile(avatar_meta={'design': {'archetype': 'winged_flying_drake'}}),
            'flying_creature'
        )


class ConfidenceAndDiagnosticsTest(unittest.TestCase):
    def setUp(self):
        import json
        candidates = [
            Path('/tmp/dawnna-mapping-rig-evidence.json'),
            Path('docs/dawnna-mapping-rig-evidence.json'),
            Path(__file__).resolve().parent / 'dawnna-mapping-rig-evidence.json',
        ]
        if len(Path(__file__).resolve().parents) > 2:
            candidates.append(Path(__file__).resolve().parents[2] / 'docs/dawnna-mapping-rig-evidence.json')
        fixture = next((p for p in candidates if p.exists()), None)
        if not fixture:
            raise FileNotFoundError('Could not locate dawnna-mapping-rig-evidence.json')
        self.bones = json.loads(fixture.read_text())['bones']

    def test_confidence_and_proportions_on_valid_skeleton(self):
        """Valid UniRig skeleton must yield high confidence, proportion breakdown, and symmetry scores."""
        mapping, review = infer_humanoid(self.bones, profile_name='humanoid_shield')
        self.assertTrue(review['accepted'])
        self.assertGreaterEqual(review['confidence'], 0.90)
        self.assertEqual(review['profile'], 'humanoid_shield')
        # Proportions
        self.assertIn('proportions', review)
        self.assertIn('arm_L_upper', review['proportions'])
        self.assertIn('leg_L_thigh', review['proportions'])
        # Symmetry
        self.assertIn('symmetry', review)
        self.assertGreaterEqual(review['symmetry']['arm_symmetry'], 0.85)
        self.assertGreaterEqual(review['symmetry']['leg_symmetry'], 0.85)
        # Per-bone confidence
        self.assertIn('per_bone_confidence', review)
        self.assertEqual(len(review['per_bone_confidence']), 17)
        for bone, score in review['per_bone_confidence'].items():
            self.assertGreaterEqual(score, 0.90)


class SkinWeightValidationTest(unittest.TestCase):
    def test_valid_skin_weights_pass(self):
        """Weights normalized to 1.0 with <= 4 influences must pass validation."""
        valid_weights = [
            {'Hips': 0.6, 'Spine': 0.4},
            {'ThighL': 0.7, 'CalfL': 0.3},
            {'UpperArmR': 0.5, 'ForearmR': 0.3, 'Chest': 0.2},
            {'Head': 1.0},
        ]
        report = validate_skin_weights(valid_weights, mapped_bones=['Hips', 'Spine', 'ThighL', 'CalfL', 'UpperArmR', 'ForearmR', 'Chest', 'Head'])
        self.assertTrue(report['valid'])
        self.assertEqual(len(report['issues']), 0)
        self.assertEqual(report['stats']['unweighted_vertices'], 0)
        self.assertEqual(report['stats']['vertices_exceeding_four_influences'], 0)
        self.assertEqual(report['stats']['max_influences'], 3)

    def test_unweighted_vertices_detected(self):
        """Vertices with 0 influences or 0 total weight are flagged."""
        weights = [
            {'Hips': 1.0},
            {},  # unweighted
            {'Spine': 0.0},  # zero weight
        ]
        report = validate_skin_weights(weights)
        self.assertFalse(report['valid'])
        self.assertEqual(report['stats']['unweighted_vertices'], 2)
        self.assertTrue(any('unweighted vertices' in issue for issue in report['issues']))

    def test_exceeding_four_influences_detected(self):
        """Vertices with > 4 influences are flagged for GPU skinning compliance."""
        weights = [
            {'b1': 0.2, 'b2': 0.2, 'b3': 0.2, 'b4': 0.2, 'b5': 0.2},  # 5 influences
        ]
        report = validate_skin_weights(weights)
        self.assertFalse(report['valid'])
        self.assertEqual(report['stats']['vertices_exceeding_four_influences'], 1)
        self.assertEqual(report['stats']['max_influences'], 5)

    def test_unnormalized_weights_detected(self):
        """Weights not summing to 1.0 are flagged."""
        weights = [
            {'Hips': 0.5, 'Spine': 0.2},  # sums to 0.7
        ]
        report = validate_skin_weights(weights)
        self.assertFalse(report['valid'])
        self.assertEqual(report['stats']['unnormalized_vertices'], 1)

    def test_non_finite_and_negative_weights_detected(self):
        """NaN, Inf, and negative weights are flagged."""
        weights = [
            {'Hips': float('nan'), 'Spine': 1.0},
            {'Hips': -0.2, 'Spine': 1.2},
        ]
        report = validate_skin_weights(weights)
        self.assertFalse(report['valid'])
        self.assertGreater(report['stats']['non_finite_weights'], 0)
        self.assertGreater(report['stats']['negative_weights'], 0)

    def test_cross_limb_anomalies_detected(self):
        """Severe cross-limb weight bleeding across the lateral midline is detected."""
        weights = [
            {'UpperArmL': 0.45, 'UpperArmR': 0.55},  # bilateral arm bleeding
        ]
        report = validate_skin_weights(weights)
        self.assertEqual(report['stats']['cross_limb_anomalies'], 1)


if __name__ == '__main__':
    unittest.main()
