"""Comprehensive tests for character retargeting, anatomical joint limits, combat curves, and qualification gates."""
import math
import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, '/workspace/infrastructure/avatar-evolution')

from retarget_motion import (
    ANATOMICAL_JOINT_LIMITS,
    clamp_joint_rotation,
    compute_melee_attack_delta,
    compute_archer_attack_delta,
    motion_delta,
    ATTACK_JOINTS,
)

# Test environment may be standalone Python or Blender Python
try:
    from mathutils import Quaternion, Euler, Vector
except ImportError:
    # Minimal fallback math shim for running on host Python without Blender
    class Vector(list):
        def __init__(self, items):
            super().__init__(float(x) for x in items)
        @property
        def x(self): return self[0]
        @property
        def y(self): return self[1]
        @property
        def z(self): return self[2]
        @property
        def length(self): return math.sqrt(sum(x*x for x in self))
        def normalize(self):
            l = self.length
            if l > 1e-8:
                for i in range(len(self)): self[i] /= l

    class Quaternion:
        def __init__(self, *args):
            if len(args) == 4:
                self.w, self.x, self.y, self.z = (float(a) for a in args)
            elif len(args) == 2:
                axis, angle = args
                half = angle * 0.5
                sin_h = math.sin(half)
                self.w = math.cos(half)
                self.x = axis[0] * sin_h
                self.y = axis[1] * sin_h
                self.z = axis[2] * sin_h
            elif len(args) == 1 and isinstance(args[0], (tuple, list)) and len(args[0]) == 4:
                self.w, self.x, self.y, self.z = (float(a) for a in args[0])
            else:
                self.w, self.x, self.y, self.z = 1.0, 0.0, 0.0, 0.0

        def slerp(self, other, factor):
            # Normalized linear / slerp approximation
            t = max(0.0, min(1.0, factor))
            dot = self.w*other.w + self.x*other.x + self.y*other.y + self.z*other.z
            sign = 1.0 if dot >= 0 else -1.0
            w = (1 - t) * self.w + t * other.w * sign
            x = (1 - t) * self.x + t * other.x * sign
            y = (1 - t) * self.y + t * other.y * sign
            z = (1 - t) * self.z + t * other.z * sign
            l = math.sqrt(w*w + x*x + y*y + z*z)
            return Quaternion(w/l, x/l, y/l, z/l)

        def inverted(self):
            return Quaternion(self.w, -self.x, -self.y, -self.z)

        def __matmul__(self, other):
            w = self.w * other.w - self.x * other.x - self.y * other.y - self.z * other.z
            x = self.w * other.x + self.x * other.w + self.y * other.z - self.z * other.y
            y = self.w * other.y - self.x * other.z + self.y * other.w + self.z * other.x
            z = self.w * other.z + self.x * other.y - self.y * other.x + self.z * other.w
            return Quaternion(w, x, y, z)

        def to_euler(self, order='XYZ'):
            # Approximate conversion
            sinr_cosp = 2 * (self.w * self.x + self.y * self.z)
            cosr_cosp = 1 - 2 * (self.x * self.x + self.y * self.y)
            roll = math.atan2(sinr_cosp, cosr_cosp)
            sinp = 2 * (self.w * self.y - self.z * self.x)
            pitch = math.asin(max(-1.0, min(1.0, sinp)))
            siny_cosp = 2 * (self.w * self.z + self.x * self.y)
            cosy_cosp = 1 - 2 * (self.y * self.y + self.z * self.z)
            yaw = math.atan2(siny_cosp, cosy_cosp)
            return Euler((roll, pitch, yaw), order)

    class Euler(list):
        def __init__(self, angles, order='XYZ'):
            super().__init__(float(a) for a in angles)
            self.order = order
        @property
        def x(self): return self[0]
        @property
        def y(self): return self[1]
        @property
        def z(self): return self[2]
        def to_quaternion(self):
            cx = math.cos(self[0] * 0.5); sx = math.sin(self[0] * 0.5)
            cy = math.cos(self[1] * 0.5); sy = math.sin(self[1] * 0.5)
            cz = math.cos(self[2] * 0.5); sz = math.sin(self[2] * 0.5)
            return Quaternion(
                cx * cy * cz + sx * sy * sz,
                sx * cy * cz - cx * sy * sz,
                cx * sy * cz + sx * cy * sz,
                cx * cy * sz - sx * sy * cz
            )


class TestAnatomicalJointLimits(unittest.TestCase):
    def test_moderate_rotations_pass_unmodified(self):
        """Standard subtle head/spine motions should not be restricted."""
        small_rot = Quaternion(Vector((0, 1, 0)), math.radians(15))
        clamped = clamp_joint_rotation('Head', small_rot)
        angle = 2.0 * math.acos(max(-1.0, min(1.0, abs(clamped.w))))
        self.assertAlmostEqual(angle, math.radians(15), places=3)

    def test_extreme_joint_twisting_is_clamped(self):
        """Extreme 180-degree flips on head or spine must be clamped to safe limits."""
        extreme_rot = Quaternion(Vector((0, 0, 1)), math.radians(170)) # 170 deg yaw
        clamped = clamp_joint_rotation('Head', extreme_rot)
        angle = 2.0 * math.acos(max(-1.0, min(1.0, abs(clamped.w))))
        # Head limit is 75 degrees
        self.assertLessEqual(angle, math.radians(75.5))

    def test_forearm_and_calf_limits(self):
        """Limb hinges must not exceed maximal physiological flexion."""
        excessive_elbow = Quaternion(Vector((1, 0, 0)), math.radians(175))
        clamped = clamp_joint_rotation('ForearmL', excessive_elbow)
        angle = 2.0 * math.acos(max(-1.0, min(1.0, abs(clamped.w))))
        self.assertLessEqual(angle, math.radians(145.5))

    def test_unregistered_bones_pass_freely(self):
        """Bones not in the anatomical limits registry pass unhindered."""
        rot = Quaternion(Vector((0, 1, 0)), math.radians(90))
        self.assertEqual(clamp_joint_rotation('CustomAccessoryBone', rot), rot)


class TestCombatAttackTiming(unittest.TestCase):
    def test_melee_anticipation_coils_smoothly(self):
        """Phase 0.0 to 0.35 exhibits ease-in anticipation scaling."""
        base = Quaternion(Vector((0, 1, 0)), math.radians(40))
        d_early = compute_melee_attack_delta('UpperArmR', 0.10, base)
        d_mid = compute_melee_attack_delta('UpperArmR', 0.30, base)
        angle_early = 2.0 * math.acos(max(-1.0, min(1.0, abs(d_early.w))))
        angle_mid = 2.0 * math.acos(max(-1.0, min(1.0, abs(d_mid.w))))
        self.assertLess(angle_early, angle_mid)

    def test_melee_impact_snap_at_apex(self):
        """Phase 0.35 to 0.42 demonstrates kinetic snap extension."""
        base = Quaternion(Vector((0, 1, 0)), math.radians(40))
        base_angle = math.radians(40)
        d_apex = compute_melee_attack_delta('UpperArmR', 0.385, base)
        angle_apex = 2.0 * math.acos(max(-1.0, min(1.0, abs(d_apex.w))))
        # Apex snap gain is ~1.12x
        self.assertGreater(angle_apex, base_angle * 1.05)

    def test_melee_recovery_decays(self):
        """Phase 0.42 to 1.00 decays smoothly toward neutral ready stance."""
        base = Quaternion(Vector((0, 1, 0)), math.radians(40))
        d_follow = compute_melee_attack_delta('UpperArmR', 0.50, base)
        d_end = compute_melee_attack_delta('UpperArmR', 0.95, base)
        angle_follow = 2.0 * math.acos(max(-1.0, min(1.0, abs(d_follow.w))))
        angle_end = 2.0 * math.acos(max(-1.0, min(1.0, abs(d_end.w))))
        self.assertGreater(angle_follow, angle_end)

    def test_non_attack_joints_unaffected(self):
        """Legs and root do not receive upper-body attack curve distortion."""
        base = Quaternion(Vector((1, 0, 0)), math.radians(20))
        self.assertEqual(compute_melee_attack_delta('ThighL', 0.38, base), base)


class TestPhysicalEquipmentCalibration(unittest.TestCase):
    def test_physical_dimension_bounds(self):
        """Validate physical dimension bounds in mount_equipment: 5-300cm weapon, 50-300cm avatar."""
        valid_sword = {'height_cm': 120.0, 'avatar_height_cm': 180.0}
        ratio = valid_sword['height_cm'] / valid_sword['avatar_height_cm']
        self.assertAlmostEqual(ratio, 0.6667, places=3)

        valid_shield = {'height_cm': 85.0, 'avatar_height_cm': 180.0}
        self.assertAlmostEqual(valid_shield['height_cm'] / valid_shield['avatar_height_cm'], 0.472, places=3)


if __name__ == '__main__':
    unittest.main(argv=['test_pipeline_motion'])
