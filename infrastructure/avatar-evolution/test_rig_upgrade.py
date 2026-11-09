"""Regression tests for donor stance folding and needless valid-skin edits."""
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0, '/workspace/infrastructure/avatar-evolution')
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from mathutils import Matrix, Quaternion, Vector
from retarget_motion import calibrate_arms, apply_calibrated_arms
from asset_pipeline.deformation import DeformationCorrectionEngine


def armature(name, crossed):
    data=bpy.data.armatures.new(name)
    rig=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(n,head,tail,parent=None):
        b=data.edit_bones.new(n);b.head=head;b.tail=tail;b.roll=.43
        if parent:b.parent=data.edit_bones[parent]
    bone('Hips',(0,0,1),(0,0,1.2))
    bone('Head',(0,0,1.8),(0,0,2),'Hips')
    for side,sign in [('L',-1),('R',1)]:
        shoulder=Vector((sign*.25,0,1.6))
        elbow=shoulder+Vector((sign*(-.30 if crossed else .25),-.05,-.25))
        hand=elbow+Vector((sign*(-.2 if crossed else .2),-.05,-.25))
        bone('UpperArm'+side,shoulder,elbow,'Hips')
        bone('Forearm'+side,elbow,hand,'UpperArm'+side)
        bone('Hand'+side,hand,hand+Vector((sign*.1,0,-.1)),'Forearm'+side)
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    return rig


class RigUpgrade(unittest.TestCase):
    def setUp(self):bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_crossed_donor_idle_does_not_change_target_rest(self):
        source=armature('Donor',True);target=armature('Target',False)
        # Different object frames and bone roll must not change the result.
        target.matrix_world=Matrix.Rotation(.7,4,'Z')@Matrix.Scale(2,4)
        bpy.context.view_layer.update()
        before={b.name:b.matrix.copy() for b in target.pose.bones}
        calibration=calibrate_arms(source,target)
        apply_calibrated_arms(source,target,calibration)
        for name in calibration:
            self.assertLess(max(abs(before[name][i][j]-target.pose.bones[name].matrix[i][j])
                                for i in range(4) for j in range(4)),2e-5,name)

    def test_donor_world_motion_is_transferred_without_importing_stance(self):
        source=armature('Donor',True);target=armature('Target',False)
        bpy.context.view_layer.update()
        calibration=calibrate_arms(source,target)
        start=(target.pose.bones['ForearmL'].head-target.pose.bones['UpperArmL'].head).copy()
        rotation=Quaternion((0,0,1),.2)
        bone=source.pose.bones['UpperArmL']
        bone.matrix=Matrix.LocRotScale(bone.head.copy(),rotation@bone.matrix.to_quaternion(),Vector((1,1,1)))
        bpy.context.view_layer.update()
        apply_calibrated_arms(source,target,calibration)
        actual=target.pose.bones['ForearmL'].head-target.pose.bones['UpperArmL'].head
        self.assertLess((actual-rotation@start).length,2e-5)
        self.assertAlmostEqual(actual.length,start.length,places=5)

    def test_valid_predicted_weights_are_preserved_exactly(self):
        weights=[{'UpperArmL':.72,'ForearmL':.28}]
        result=DeformationCorrectionEngine().correct(weights,None,['UpperArmL','ForearmL'])
        self.assertEqual(weights,[{'UpperArmL':.72,'ForearmL':.28}])
        self.assertEqual(result['attempts'],0)
        self.assertEqual(result['repairs'],[])

    def test_attachment_review_does_not_smooth_unrelated_valid_body(self):
        rig=armature('Target',False)
        mesh=bpy.data.meshes.new('Body')
        mesh.from_pydata([(0,0,1),(.1,0,1),(0,.1,1)],[],[(0,1,2)])
        obj=bpy.data.objects.new('Body',mesh);bpy.context.collection.objects.link(obj)
        upper=obj.vertex_groups.new(name='UpperArmL');upper.add([0,1,2],.72,'REPLACE')
        lower=obj.vertex_groups.new(name='ForearmL');lower.add([0,1,2],.28,'REPLACE')
        before=[[(g.group,g.weight) for g in v.groups] for v in mesh.vertices]
        result=DeformationCorrectionEngine().correct(obj,rig,[],[{'bone':'HandR','new_parent':'HandR'}])
        self.assertEqual(result['repairs'],[])
        self.assertEqual(before,[[(g.group,g.weight) for g in v.groups] for v in mesh.vertices])

if __name__=='__main__':unittest.main(argv=['rig-upgrade'])
