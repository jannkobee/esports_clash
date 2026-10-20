"""Run with Blender's bpy Python; no job, inference, or asset publication."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(globals().get('__file__','.')).resolve().parent))
sys.path.insert(0,'/workspace/infrastructure/avatar-evolution')
import bpy
from mathutils import Vector, Quaternion
from retarget_contacts import bake_contacts, contact_correction
from equipment_skin import secondary_chains, regularize_skin_weights

def rig_fixture():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    data=bpy.data.armatures.new('TestRig')
    rig=bpy.data.objects.new('TestRig',data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(name,head,tail,parent=None):
        b=data.edit_bones.new(name);b.head=head;b.tail=tail
        if parent:b.parent=data.edit_bones[parent]
    bone('Root',(0,0,1),(0,0,1.1))
    bone('Hips',(0,0,1),(0,0,1.2),'Root')
    bone('Spine',(0,0,1.2),(0,0,1.4),'Hips')
    bone('Chest',(0,0,1.4),(0,0,1.6),'Spine')
    bone('Head',(0,0,1.6),(0,0,1.8),'Chest')
    for side,x in [('L',.15),('R',-.15)]:
        bone('Thigh'+side,(x,0,1),(x*1.4,-.14,.55),'Hips')
        bone('Calf'+side,(x*1.4,-.14,.55),(x,0,.1),'Thigh'+side)
        bone('Foot'+side,(x,0,.1),(x,-.15,.1),'Calf'+side)
    bone('hair0',(0,.05,1.75),(0,.1,1.6),'Head')
    bone('hair1',(0,.1,1.6),(0,.15,1.45),'hair0')
    bone('coat0',(.2,.1,1),(.2,.15,.7),'Hips')
    bone('coat1',(.2,.15,.7),(.2,.2,.5),'coat0')
    bone('HandR',(-.5,0,1.2),(-.6,0,1.2),'Chest')
    bone('weapon',(-.6,0,1.2),(-.6,0,.8),'HandR')
    bpy.ops.object.mode_set(mode='OBJECT');bpy.context.view_layer.update()
    return rig

class NaturalMotion(unittest.TestCase):
    def test_contact_is_small_and_swing_clearance_is_preserved(self):
        self.assertAlmostEqual(contact_correction(-1,0,1,'Walk',.2),.025)
        self.assertEqual(contact_correction(.3,0,1,'Run',.8),0)
        self.assertEqual(contact_correction(.01,0,1,'Walk',.8),0)
        self.assertGreater(contact_correction(.01,0,1,'Walk',.3),-.004)

    def test_ik_preserves_foot_roll_knee_side_and_hip_motion(self):
        rig=rig_fixture()
        foot=rig.pose.bones['FootL'];foot.rotation_mode='QUATERNION'
        foot.rotation_quaternion=Quaternion((0,1,0),.25)
        bpy.context.view_layer.update()
        orientation=foot.matrix.to_quaternion().copy()
        hips=rig.pose.bones['Hips'].matrix.copy()
        before=[rig.pose.bones[n+'L'].head.copy() for n in ['Thigh','Calf','Foot']]
        reference={s:rig.pose.bones['Foot'+s].head+Vector((0,0,.01)) for s in ['L','R']}
        bake_contacts(rig,reference,'Walk',.25)
        after=[rig.pose.bones[n+'L'].head.copy() for n in ['Thigh','Calf','Foot']]
        self.assertLess(foot.matrix.to_quaternion().rotation_difference(orientation).angle,1e-5)
        self.assertLess((after[2]-before[2]).length,.011)
        self.assertAlmostEqual(after[2].z-before[2].z,.01,places=5)
        for a,b in [(0,1),(1,2)]:self.assertAlmostEqual((after[a]-after[b]).length,(before[a]-before[b]).length,places=5)
        self.assertGreater(after[1].x,after[0].x)
        self.assertLess(after[1].y,after[0].y)
        self.assertEqual(rig.pose.bones['Hips'].matrix,hips)

    def test_ground_free_fk_and_non_locomotion_are_untouched(self):
        rig=rig_fixture();reference={s:rig.pose.bones['Foot'+s].head-Vector((0,0,1)) for s in ['L','R']}
        before=[b.matrix.copy() for b in rig.pose.bones]
        for clip in ['Walk','Run','Strafe','Attack','Cast','Death']:
            bake_contacts(rig,reference,clip,.8)
            self.assertEqual([b.matrix for b in rig.pose.bones],before)

    def test_secondary_detection_excludes_mapped_anatomy_and_weapons(self):
        rig=rig_fixture();mapped=[b.name for b in rig.data.bones if not b.name.startswith(('hair','coat')) and b.name!='weapon']
        result=secondary_chains(rig,mapped,[{'bone':'weapon'}])
        self.assertEqual(set(result),{'hair0','hair1','coat0','coat1'})
        self.assertEqual(result['hair1'],{'kind':'hair','depth':1})
        self.assertEqual(result['coat0']['kind'],'coat')

    def test_secondary_skin_weights_survive_regularization(self):
        rig=rig_fixture()
        mesh=bpy.data.meshes.new('hair');mesh.from_pydata([(0,0,0),(.1,0,0),(0,.1,0)],[],[(0,1,2)])
        obj=bpy.data.objects.new('hair',mesh);bpy.context.collection.objects.link(obj)
        group=obj.vertex_groups.new(name='hair1');group.add([0,1,2],1,'REPLACE')
        regularize_skin_weights(obj,rig,['Root','Hips','Spine','Chest','Head'])
        for vertex in mesh.vertices:
            self.assertAlmostEqual(sum(g.weight for g in vertex.groups),1)
            self.assertAlmostEqual(obj.vertex_groups['hair1'].weight(vertex.index),1)

if __name__=='__main__':unittest.main(argv=['natural-motion'])
