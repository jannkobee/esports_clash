"""Bake contact targets with analytic two-bone IK, preserving joint lengths.
Profiles mirror contactGait's authoring units; renderer applies uniform scale40.
"""
import math
import bpy
from mathutils import Vector,Matrix,Quaternion
GAITS={'Walk':(.62,24,3.5),'Run':(.5,28,5.5),'Strafe':(.66,20,3)}

def contact_offset(phase,stance,span,lift):
    p=phase%1
    if p<stance:return span*(.5-p/stance),0
    t=(p-stance)/(1-stance);s=t*t*(3-2*t)
    return span*(-.5+s),math.sin(math.pi*t)*lift

def rotate_towards(bone,current,desired):
    if current.length<1e-8 or desired.length<1e-8:return
    delta=current.rotation_difference(desired)
    matrix=bone.matrix.copy();location,rotation,scale=matrix.decompose()
    bone.matrix=Matrix.LocRotScale(location,delta@rotation,scale)
    bpy.context.view_layer.update()

def bake_contacts(rig,reference,clip,phase,equipment_repairs=()):
    if clip not in GAITS:return
    stance,span,lift=GAITS[clip];span/=40;lift/=40
    # Swing clearance scales to the generated leg length; donor-sized lifts
    # can fold short legs into armor. Stance stride remains the native value.
    bpy.context.view_layer.update()
    lengths=[]
    for side in ['L','R']:
        a,b,c=[rig.matrix_world@rig.pose.bones[n+side].head for n in ['Thigh','Calf','Foot']]
        lengths.append((b-a).length+(c-b).length)
    lift=min(lift,min(lengths)*(.08 if equipment_repairs else .12))
    # Flex the carrying elbow slightly forward, keeping the grip and shoulder
    # connected while moving held equipment clear of the swing knee.
    for repair in equipment_repairs:
        forearm=rig.pose.bones['Forearm'+repair['new_parent'][-1]]
        location,rotation,scale=forearm.matrix.decompose()
        axis=rig.matrix_world.inverted().to_3x3()@Vector((1,0,0));axis.normalize()
        forearm.matrix=Matrix.LocRotScale(location,Quaternion(axis,-.4)@rotation,scale)
    bpy.context.view_layer.update()
    targets={}
    for side,offset in [('L',0),('R',.5)]:
        back,up=contact_offset(phase+offset,stance,span,lift)
        point=reference[side].copy();point.y-=back;point.z+=up;targets[side]=point
    bpy.context.view_layer.update()
    # Solve the minimal pelvis lowering required to reach both contact targets.
    drop=0
    for side in ['L','R']:
        a,b,c=[rig.matrix_world@rig.pose.bones[n+side].head for n in ['Thigh','Calf','Foot']]
        length=(b-a).length+(c-b).length
        t=targets[side];horizontal=math.hypot(t.x-a.x,t.y-a.y)
        if horizontal>=length*.995:raise RuntimeError('Generated legs cannot reach native stride without stretching; review locomotion profile.')
        vertical=math.sqrt((length*.995)**2-horizontal**2)
        drop=max(drop,a.z-t.z-vertical)
    if drop>0:
        root=rig.pose.bones['Root'];matrix=root.matrix.copy();matrix.translation+=rig.matrix_world.inverted().to_3x3()@Vector((0,0,-drop));root.matrix=matrix
        bpy.context.view_layer.update()
    for side in ['L','R']:
        upper,lower,foot=[rig.pose.bones[n+side] for n in ['Thigh','Calf','Foot']]
        a,b,c=upper.head.copy(),lower.head.copy(),foot.head.copy()
        target=rig.matrix_world.inverted()@targets[side]
        direction=target-a;distance=direction.length;direction.normalize()
        first=(b-a).length;second=(c-b).length
        along=(first*first-second*second+distance*distance)/(2*max(distance,1e-8))
        bend=math.sqrt(max(0,first*first-along*along))
        # A stable forward knee pole avoids near-straight-chain sign flips.
        pole=rig.matrix_world.inverted().to_3x3()@Vector((0,-1,0));pole-=direction*pole.dot(direction)
        if pole.length<1e-8:raise RuntimeError('Ambiguous knee pole; review rig orientation.')
        pole.normalize();knee=a+direction*along+pole*bend
        orientation=foot.matrix.to_quaternion().copy()
        rotate_towards(upper,b-a,knee-a)
        rotate_towards(lower,foot.head-lower.head,target-lower.head)
        matrix=foot.matrix.copy();location,_,scale=matrix.decompose();foot.matrix=Matrix.LocRotScale(location,orientation,scale)
        bpy.context.view_layer.update()
