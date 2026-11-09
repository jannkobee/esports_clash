"""Blender regressions for explicit appendage coverage and localized skin edits."""
import bpy
import math
import sys
import unittest
from pathlib import Path
from mathutils import Vector,Quaternion
sys.path.insert(0,'/workspace/infrastructure/avatar-evolution')
sys.path.insert(0,str(Path(__file__).resolve().parent))
from asset_pipeline.tail_repair import propose_tail,repair_tail
from equipment_skin import validate_skin_weights
from asset_pipeline.edge_deformation import edge_deformation
from retarget_motion import constrain_arm_rotation,calibrate_arms,clip_arm_reference,apply_calibrated_arms


def fixture(two=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    data=bpy.data.armatures.new('BodyRig');rig=bpy.data.objects.new('BodyRig',data)
    bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(name,head,tail,parent=None):
        b=data.edit_bones.new(name);b.head=head;b.tail=tail
        if parent:b.parent=data.edit_bones[parent]
    bone('Hips',(0,0,1),(0,0,1.2))
    bone('Chest',(0,0,1.4),(0,0,1.6),'Hips')
    bone('Head',(0,0,1.8),(0,0,2),'Chest')
    for side,sign in [('L',-1),('R',1)]:
        bone('UpperArm'+side,(sign*.25,0,1.6),(sign*.5,0,1.35),'Chest')
        bone('Forearm'+side,(sign*.5,0,1.35),(sign*.75,0,1.1),'UpperArm'+side)
        bone('Hand'+side,(sign*.75,0,1.1),(sign*.85,0,1),'Forearm'+side)
        bone('Thigh'+side,(sign*.15,0,1),(sign*.15,0,.55),'Hips')
        bone('Foot'+side,(sign*.15,0,.1),(sign*.15,-.15,.1),'Thigh'+side)
    bpy.ops.object.mode_set(mode='OBJECT')
    vertices=[];faces=[]
    for tail in range(2 if two else 1):
        offset=len(vertices)
        for ring in range(61):
            center=Vector((tail*.6+.12*math.sin(ring/60*math.pi),.04+ring*.022,1-ring*.008))
            for radial in range(12):
                angle=radial/12*2*math.pi
                vertices.append(tuple(center+Vector((math.cos(angle)*.025,0,math.sin(angle)*.025))))
            if ring:
                for radial in range(12):
                    a=offset+(ring-1)*12+radial;b=offset+(ring-1)*12+(radial+1)%12
                    faces.append((a,b,b+12,a+12))
    # Unrelated torso triangle, used to assert exact weight preservation.
    start=len(vertices);vertices.extend([(-.1,-.1,1.3),(.1,-.1,1.3),(0,-.1,1.5)]);faces.append((start,start+1,start+2))
    mesh=bpy.data.meshes.new('Body');mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new('Body',mesh);bpy.context.collection.objects.link(obj)
    obj.parent=rig
    modifier=obj.modifiers.new('Skin','ARMATURE');modifier.object=rig
    for name,value in [('ThighL',.6),('ThighR',.4)]:
        group=obj.vertex_groups.new(name=name);group.add(list(range(len(vertices))),value,'REPLACE')
    bpy.context.view_layer.update()
    return obj,rig


class TailRepair(unittest.TestCase):
    def test_explicit_anatomy_is_required_before_mutation(self):
        obj,rig=fixture();before=len(rig.data.bones)
        with self.assertRaises(RuntimeError):repair_tail(obj,rig,{'kind':'tail','count':9,'attachment':'pelvis'})
        self.assertEqual(len(rig.data.bones),before)

    def test_missing_or_ambiguous_tail_is_rejected(self):
        obj,rig=fixture(two=True)
        with self.assertRaises(RuntimeError):propose_tail(obj,rig)

    def test_flat_posterior_surface_is_not_guessed_as_a_tail(self):
        obj,rig=fixture()
        for vertex in list(obj.data.vertices)[:-3]:vertex.co.x=0
        with self.assertRaises(RuntimeError):propose_tail(obj,rig)

    def test_repair_preserves_rest_and_unrelated_skin_and_decouples_legs(self):
        obj,rig=fixture()
        geometry=[tuple(v.co) for v in obj.data.vertices]
        original=[[(g.group,g.weight) for g in v.groups] for v in obj.data.vertices[-3:]]
        result=repair_tail(obj,rig,{'kind':'tail','count':1,'attachment':'pelvis'})
        self.assertEqual(len(result['bones']),12)
        self.assertTrue(result['rest_geometry_preserved'])
        self.assertTrue(result['unrelated_weights_preserved'])
        self.assertEqual(geometry,[tuple(v.co) for v in obj.data.vertices])
        self.assertEqual(original,[[(g.group,g.weight) for g in v.groups] for v in obj.data.vertices[-3:]])
        self.assertTrue(validate_skin_weights(obj,rig)['valid'])
        for side,angle in [('L',.7),('R',-.7)]:
            b=rig.pose.bones['Thigh'+side];b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion((1,0,0),angle)
        bpy.context.view_layer.update()
        evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
        try:
            for i,v in enumerate(obj.data.vertices):
                if any(obj.vertex_groups[g.group].name.startswith('AnatomicalTail') for g in v.groups):
                    self.assertLess((mesh.vertices[i].co-v.co).length,1e-5)
        finally:evaluated.to_mesh_clear()

    def test_repeat_repair_does_not_replace_existing_tail(self):
        obj,rig=fixture();spec={'kind':'tail','count':1,'attachment':'pelvis'}
        repair_tail(obj,rig,spec)
        with self.assertRaises(RuntimeError):repair_tail(obj,rig,spec)

    def test_tail_bends_without_gross_surface_stretch(self):
        obj,rig=fixture();repair_tail(obj,rig,{'kind':'tail','count':1,'attachment':'pelvis'})
        bone=rig.pose.bones['AnatomicalTail_04'];bone.rotation_mode='QUATERNION'
        bone.rotation_quaternion=Quaternion((0,0,1),.3)
        bpy.context.view_layer.update()
        evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
        try:
            report=edge_deformation([v.co.copy() for v in obj.data.vertices],
                [v.co.copy() for v in mesh.vertices],[tuple(p.vertices) for p in mesh.polygons])
            self.assertTrue(report['passed'])
        finally:evaluated.to_mesh_clear()

    def test_arm_twist_is_bounded_and_quaternion_sign_is_irrelevant(self):
        q=Quaternion((0,1,0),math.radians(170));negative=q.copy();negative.negate()
        result=constrain_arm_rotation('ForearmL',q)
        self.assertLessEqual(result.angle,math.radians(35)+1e-5)
        self.assertLess(result.rotation_difference(constrain_arm_rotation('ForearmL',negative)).angle,1e-5)

    def test_discontinuous_clip_reference_does_not_import_new_stance(self):
        obj,rig=fixture();reference=calibrate_arms(rig,rig)
        b=rig.pose.bones['HandL'];b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion((1,0,0),1.3)
        bpy.context.view_layer.update();clip=clip_arm_reference(rig,reference)
        self.assertLess(clip['HandL']['reference'].rotation_difference((rig.matrix_world@b.matrix).to_quaternion()).angle,1e-5)
        self.assertEqual(clip['HandL']['stance'],reference['HandL']['stance'])

    def test_constraints_use_anatomical_parent_not_twisted_helper(self):
        obj,target=fixture()
        source=target.copy();source.data=target.data.copy();source.name='Donor'
        bpy.context.collection.objects.link(source)
        bpy.context.view_layer.objects.active=target
        bpy.ops.object.mode_set(mode='EDIT')
        arm=target.data.edit_bones['UpperArmL'];rest=arm.matrix.copy();length=arm.length
        helper=target.data.edit_bones.new('NativeSpacer')
        helper.head=arm.head;helper.tail=arm.tail;helper.roll=arm.roll;helper.parent=arm.parent
        arm.parent=helper;arm.matrix=rest;arm.length=length
        bpy.ops.object.mode_set(mode='OBJECT')
        helper=target.pose.bones['NativeSpacer'];helper.rotation_mode='QUATERNION'
        helper.rotation_quaternion=Quaternion((0,1,0),2.3)
        bpy.context.view_layer.update()
        calibration=calibrate_arms(source,target)
        apply_calibrated_arms(source,target,calibration,constrained=True)
        for name in calibration:
            self.assertLess(target.pose.bones[name].matrix.to_quaternion().rotation_difference(
                target.data.bones[name].matrix_local.to_quaternion()).angle,1e-4,name)

if __name__=='__main__':unittest.main(argv=['tail-repair'])
