"""Small vertical contact corrections on top of donor FK; never synthesize a gait."""
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
    bpy.context.view_layer.update()
    # Flex the carrying elbow slightly forward, keeping the grip and shoulder
    # connected while moving held equipment clear of the swing knee.
    for hand in sorted({repair['new_parent'] for repair in equipment_repairs if repair['new_parent'] in {'HandL','HandR'}}):
        forearm=rig.pose.bones['Forearm'+hand[-1]]
        location,rotation,scale=forearm.matrix.decompose()
        axis=rig.matrix_world.inverted().to_3x3()@Vector((1,0,0));axis.normalize()
        forearm.matrix=Matrix.LocRotScale(location,Quaternion(axis,-.4)@rotation,scale)
    bpy.context.view_layer.update()
    inverse=rig.matrix_world.inverted()
    for side,offset in [('L',0),('R',.5)]:
        upper,lower,foot=[rig.pose.bones[n+side] for n in ['Thigh','Calf','Foot']]
        a,b,c=upper.head.copy(),lower.head.copy(),foot.head.copy()
        first=(b-a).length;second=(c-b).length
        world=rig.matrix_world@c
        world_length=(rig.matrix_world.to_3x3()@(b-a)).length+(rig.matrix_world.to_3x3()@(c-b)).length
        correction=contact_correction(world.z,reference[side].z,world_length,clip,phase+offset)
        if abs(correction)<1e-8:continue
        target=inverse@(world+Vector((0,0,correction)))
        direction=target-a;distance=direction.length
        if distance<1e-8:continue
        direction.normalize()
        distance=max(abs(first-second)+1e-6,min(distance,first+second-1e-6))
        target=a+direction*distance
        along=(first*first-second*second+distance*distance)/(2*max(distance,1e-8))
        bend=math.sqrt(max(0,first*first-along*along))
        # Preserve the donor's knee plane, including outward knee angling.
        pole=b-a;pole-=direction*pole.dot(direction)
        if pole.length<1e-6:
            pole=upper.matrix.to_3x3()@Vector((0,0,1));pole-=direction*pole.dot(direction)
        if pole.length<1e-8:continue
        pole.normalize();knee=a+direction*along+pole*bend
        orientation=foot.matrix.to_quaternion().copy()
        rotate_towards(upper,b-a,knee-a)
        rotate_towards(lower,foot.head-lower.head,target-lower.head)
        matrix=foot.matrix.copy();location,_,scale=matrix.decompose();foot.matrix=Matrix.LocRotScale(location,orientation,scale)
        bpy.context.view_layer.update()

def contact_correction(height,floor,leg_length,clip,phase):
    """Bound ankle correction to 2.5% of the leg; leave swing/foot roll authored."""
    error=floor-height
    limit=max(0,leg_length)*.025
    if error>0:return min(error,limit)
    stance=GAITS[clip][0]
    p=phase%1
    if p>=stance or -error>limit:return 0
    # Fade contact at heel strike/toe off; never drag a lifted swing foot down.
    envelope=math.sin(math.pi*p/stance)**2
    return max(error,-limit)*envelope*.35
