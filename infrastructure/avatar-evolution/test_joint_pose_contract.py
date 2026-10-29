"""Run with the pinned bpy interpreter in Colab only."""
import math
import os
import unittest
import bpy
from mathutils import Euler, Vector
from joint_pose_contract import aim, direction, rotate_world, angle_degrees


class PoseDirectionTests(unittest.TestCase):
    def setUp(self):
        if not os.environ.get('COLAB_RELEASE_TAG'):
            raise RuntimeError('Run Blender tests in Google Colab')
        bpy.ops.wm.read_factory_settings(use_empty=True)
        data = bpy.data.armatures.new('offset-rest-rig')
        self.rig = bpy.data.objects.new('rig', data)
        bpy.context.collection.objects.link(self.rig)
        bpy.context.view_layer.objects.active = self.rig
        self.rig.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        parent = data.edit_bones.new('parent'); parent.head = (0, 0, 1); parent.tail = (.2, .1, 1.1)
        limb = data.edit_bones.new('limb'); limb.head = parent.tail; limb.tail = (.5, .05, .7); limb.parent = parent
        child = data.edit_bones.new('child'); child.head = limb.tail; child.tail = (.7, 0, .4); child.parent = limb
        bpy.ops.object.mode_set(mode='OBJECT')

    def verify_target(self):
        target = Vector((0, -1, -1)).normalized()
        center = (self.rig.matrix_world @ self.rig.pose.bones['limb'].head).copy()
        aim(self.rig, 'limb', 'child', target)
        self.assertLess(angle_degrees(direction(self.rig, 'limb', 'child'), target), .001)
        self.assertLess(((self.rig.matrix_world @ self.rig.pose.bones['limb'].head) - center).length, 1e-6)
        aim(self.rig, 'limb', 'child', target)
        self.assertLess(angle_degrees(direction(self.rig, 'limb', 'child'), target), .001)

    def test_abducted_rest_direction_reaches_absolute_target(self):
        self.verify_target()

    def test_target_remains_exact_after_parent_and_world_rotation(self):
        self.rig.rotation_euler = Euler((.2, -.3, .4))
        self.rig.location = (2, -3, 1)
        bpy.context.view_layer.update()
        rotate_world(self.rig, 'parent', Vector((0, 0, 1)), 25)
        self.verify_target()


if __name__ == '__main__':
    unittest.main()
