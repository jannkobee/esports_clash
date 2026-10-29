"""Rig and author ten motions directly on Mirelle's new mesh; no legacy donor."""
import bpy
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Matrix,Quaternion,Vector

args=sys.argv[sys.argv.index('--')+1:];SOURCE=Path(args[0]);OUT=Path(args[1]);OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'mirelle-base-unrigged.blend'))
scene=bpy.context.scene;body=bpy.data.objects['MirelleBase']
source_report=json.loads((SOURCE/'base-audit.json').read_text());points={k:Vector(v) for k,v in source_report['rest_landmarks'].items()}
original=[tuple(v.co) for v in body.data.vertices]
armature=bpy.data.armatures.new('MirelleAnatomicalSkeleton');rig=bpy.data.objects.new('MirelleRig',armature);scene.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None,deform=True):
    b=armature.edit_bones.new(name);b.head=head;b.tail=tail;b.use_deform=deform
    if parent:b.parent=armature.edit_bones[parent]
    b.align_roll(Vector((0,-1,0)))
bone('Root',(0,0,0),(0,0,.12),deform=False)
bone('Hips',(0,0,.96),(0,0,1.08),'Root')
bone('Spine',(0,0,1.08),(0,0,1.26),'Hips')
bone('Chest',(0,0,1.26),(0,0,1.445),'Spine')
bone('Neck',(0,0,1.445),(0,0,1.575),'Chest')
bone('Head',(0,0,1.575),(0,0,1.80),'Neck')
for side,sign in [('L',1),('R',-1)]:
    bone('Clavicle'+side,(0,0,1.445),points[side+'shoulder'],'Chest')
    bone('UpperArm'+side,points[side+'shoulder'],points[side+'elbow'],'Clavicle'+side)
    bone('Forearm'+side,points[side+'elbow'],points[side+'wrist'],'UpperArm'+side)
    bone('Hand'+side,points[side+'wrist'],(sign*.635,0,1.015),'Forearm'+side)
    for name in ['index','middle','ring','little']:
        parent='Hand'+side
        for index,(start,end) in enumerate([('base','mid'),('mid','tip'),('tip','end')]):
            joint=f'{name}{index+1}{side}';bone(joint,points[side+name+start],points[side+name+end],parent);parent=joint
    bone('thumb1'+side,points[side+'thumbbase'],points[side+'thumbmid'],'Hand'+side)
    bone('thumb2'+side,points[side+'thumbmid'],points[side+'thumbtip'],'thumb1'+side)
    bone('Thigh'+side,points[side+'hip'],points[side+'knee'],'Hips')
    bone('Shin'+side,points[side+'knee'],points[side+'ankle'],'Thigh'+side)
    bone('Foot'+side,points[side+'ankle'],points[side+'toe'],'Shin'+side)
bpy.ops.object.mode_set(mode='OBJECT')
# Heat weights are a separate inspectable operation on the new continuous surface.
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
unweighted=[]
for vertex in body.data.vertices:
    values=sorted([(group.group,group.weight) for group in vertex.groups if group.weight>1e-8],key=lambda pair:-pair[1])[:4]
    total=sum(weight for _,weight in values)
    if total<1e-8:unweighted.append(vertex.index);continue
    for group in list(vertex.groups):body.vertex_groups[group.group].remove([vertex.index])
    for index,weight in values:body.vertex_groups[index].add([vertex.index],weight/total,'REPLACE')
if unweighted:raise RuntimeError('Unweighted base vertices: '+str(len(unweighted)))
if original!=[tuple(v.co) for v in body.data.vertices]:raise RuntimeError('Rigging changed the base geometry')
for pose in rig.pose.bones:pose.rotation_mode='QUATERNION'
for side,label in [('L','left'),('R','right')]:
    socket=bpy.data.objects.new(label+'_hand_socket',None);scene.collection.objects.link(socket)
    socket.parent=rig;socket.parent_type='BONE';socket.parent_bone='Hand'+side
    socket.matrix_world=Matrix.Translation(rig.data.bones['Hand'+side].tail_local)
    socket['socketName']=socket.name
rig['avatar_id']='c_invoker';rig['canonical_id']='mirelle-vane';rig['asset_stage']='raw_rig_unqualified'
rig['rig_provider']='blender-authored-anatomy-v1';rig['bind_pose']='symmetrical-adult-a-pose'
def export(name,animations):
    bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True)
    for child in rig.children:
        if child.type=='EMPTY':child.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(OUT/name),export_format='GLB',use_selection=True,export_yup=True,
        export_animations=animations,export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True,export_extras=True)
export('mirelle-raw-rig.glb',False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mirelle-raw-rig.blend'))
rest={b.name:(b.tail_local-b.head_local).normalized() for b in armature.bones}
rest_rotation={b.name:b.matrix_local.to_quaternion() for b in armature.bones}
def update():bpy.context.view_layer.update()
def aim(name,target,plane=None):
    update();pb=rig.pose.bones[name];head=pb.head.copy();direction=Vector(target)-head
    if direction.length<1e-7:raise RuntimeError('Degenerate target '+name)
    if plane is not None:
        y=direction.normalized()
        if name.startswith(('Thigh','Shin')):
            x=plane.normalized();z=x.cross(y).normalized();x=y.cross(z).normalized()
        else:
            z=plane.normalized();x=y.cross(z).normalized();z=x.cross(y).normalized()
        rotation=Matrix((x,y,z)).transposed().to_quaternion()
    else:rotation=rest[name].rotation_difference(direction.normalized())@rest_rotation[name]
    pb.matrix=Matrix.Translation(head)@rotation.to_matrix().to_4x4();pb.location=(0,0,0);pb.scale=(1,1,1);update()
def two_bone(upper,lower,target,pole):
    update();a=rig.pose.bones[upper].head.copy();target=Vector(target);direction=target-a
    l1=armature.bones[upper].length;l2=armature.bones[lower].length
    length=min(l1+l2-1e-5,max(abs(l1-l2)+1e-5,direction.length));axis=direction.normalized()
    distance=(l1*l1-l2*l2+length*length)/(2*length);height=math.sqrt(max(0,l1*l1-distance*distance))
    bend=Vector(pole)-a;bend-=axis*bend.dot(axis)
    if bend.length<1e-6:bend=Vector((0,-1,0))
    joint=a+axis*distance+bend.normalized()*height
    plane=axis.cross(bend.normalized()).normalized()
    aim(upper,joint,plane);aim(lower,target,plane)
    return plane
def smooth(value):return max(0,min(1,value))**2*(3-2*max(0,min(1,value)))
def pose_clip(clip,phase):
    for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
    root=rig.pose.bones['Root'];rotation=Quaternion();translation=Vector((0,0,0))
    wave=math.sin(2*math.pi*phase)
    if clip in ['Walk','Run','Strafe']:
        translation.z=(-.035 if clip=='Run' else -.008)+.008*(1-math.cos(4*math.pi*phase))
    elif clip=='Idle':translation.z=.0015*(1-math.cos(2*math.pi*phase))
    elif clip=='Hit':translation.y=.025*math.sin(math.pi*phase)
    elif clip in ['TurnLeft','TurnRight']:rotation=Quaternion((0,0,1),(.25 if clip=='TurnLeft' else -.25)*math.sin(math.pi*phase))
    elif clip=='Death':
        fall=smooth((phase-.15)/.7);angle=math.pi/2*fall;rotation=Quaternion((1,0,0),angle)
        # Pivot around the ankle line: a linear pelvis-height interpolation
        # drives the heels below ground halfway through a fall.
        translation=Vector((0,math.sin(angle)*.115,.12*(1-math.cos(angle))))
    transform=Matrix.Translation(translation)@rotation.to_matrix().to_4x4()
    root.matrix=transform@armature.bones['Root'].matrix_local
    update()
    for side,sign in [('L',1),('R',-1)]:
        ankle=points[side+'ankle'].copy();foot_direction=rest['Foot'+side].copy()
        if clip in ['Walk','Run','Strafe']:
            p=(phase+(0 if side=='L' else .5))%1
            stride=.56 if clip=='Run' else .36
            if clip=='Strafe':stride=.13
            if p<.6:displacement=stride*(p/.6-.5);lift=0
            else:
                swing=(p-.6)/.4;displacement=stride*(.5-smooth(swing));lift=(.10 if clip=='Run' else .065)*math.sin(math.pi*swing)
            if clip=='Strafe':ankle.x+=displacement
            else:ankle.y+=displacement
            ankle.z+=lift
        if clip=='Death':
            ankle=transform@ankle
            angle=math.pi/2*smooth((phase-.15)/.7)
            ankle.z+=.12*math.sin(2*angle)
            foot_direction=Quaternion((1,0,0),angle*1.5)@foot_direction
        two_bone('Thigh'+side,'Shin'+side,ankle,transform@Vector((sign*.15,-.75,.50)))
        update();aim('Foot'+side,rig.pose.bones['Foot'+side].head+foot_direction)
        hand=Vector((sign*.36,-.25,1.10))
        if clip in ['Walk','Run','Strafe']:
            hand=Vector((sign*.345,(-1 if side=='L' else 1)*.13*wave,1.07))
        elif clip=='Attack':
            strike=math.exp(-((phase-.42)/.16)**2)
            hand+=Vector((0,-(.17 if side=='R' else .04)*strike,.24*strike))
        elif clip=='Cast':
            spell=math.sin(math.pi*phase)**2;hand+=Vector((0,-.15*spell,.25*spell))
        elif clip=='Hit':hand.y-=.045*math.sin(math.pi*phase)
        elif clip=='Death':
            settle=smooth((phase-.05)/.5);hand=hand.lerp(points[side+'wrist'],settle)
        elif clip in ['TurnLeft','TurnRight']:hand.x+=sign*.015*math.sin(math.pi*phase)
        target=transform@hand
        plane=two_bone('UpperArm'+side,'Forearm'+side,target,transform@Vector((sign*.80,-.05,1.27)))
        update();forearm=rig.pose.bones['Forearm'+side];direction=(forearm.tail-forearm.head).normalized()
        aim('Hand'+side,rig.pose.bones['Hand'+side].head+direction,plane)
    update()

clips={'Idle':2.0,'Walk':1.0,'Run':.65,'Attack':.85,'Cast':1.2,'Hit':.5,'Death':1.8,'Strafe':1.0,'TurnLeft':.8,'TurnRight':.8}
rig.animation_data_create();metrics={};depsgraph=bpy.context.evaluated_depsgraph_get()
edges=[(edge.vertices[0],edge.vertices[1]) for edge in body.data.edges]
rest_lengths=[(body.data.vertices[a].co-body.data.vertices[b].co).length for a,b in edges]
for clip,duration in clips.items():
    action=bpy.data.actions.new(clip);action.use_fake_user=True;rig.animation_data.action=action
    frames=round(duration*30);lowest=math.inf;stretch=0;foot_drift=0;last_feet={};end_head_height=0
    for frame in range(frames+1):
        scene.frame_set(frame+1);phase=frame/frames;pose_clip(clip,phase)
        for pb in rig.pose.bones:
            pb.keyframe_insert('rotation_quaternion',frame=frame+1,group=pb.name)
            if pb.name=='Root':pb.keyframe_insert('location',frame=frame+1,group=pb.name)
        evaluated=body.evaluated_get(depsgraph);mesh=evaluated.to_mesh();positions=[vertex.co.copy() for vertex in mesh.vertices]
        if len(positions)!=len(original):raise RuntimeError('Rig changed vertex count')
        if not all(math.isfinite(c) for point in positions for c in point):raise RuntimeError('Nonfinite skin in '+clip)
        lowest=min(lowest,min(point.z for point in positions))
        for (a,b),length in zip(edges,rest_lengths):
            if length>1e-5:stretch=max(stretch,(positions[a]-positions[b]).length/length)
        evaluated.to_mesh_clear()
        if clip in ['Idle','Attack','Cast','Hit','TurnLeft','TurnRight']:
            for side in ['L','R']:
                foot=rig.pose.bones['Foot'+side].head.copy()
                if side in last_feet:foot_drift=max(foot_drift,(foot-last_feet[side]).length)
                last_feet[side]=foot
        end_head_height=rig.pose.bones['Head'].head.z
    metrics[clip]={'frames':frames+1,'duration_seconds':frames/30,'lowest_vertex_m':lowest,'maximum_edge_stretch_ratio':stretch,'maximum_planted_ankle_step_m':foot_drift,'final_head_joint_height_m':end_head_height}
    print('MIRELLE_CLIP='+json.dumps({'clip':clip,**metrics[clip]}),flush=True)

rig['asset_stage']='animated_base_unqualified';rig['animation_mode']='authored-directly-on-final-rig'
rig['locomotion_stride_m']={'Walk':.36/.6,'Run':.56/.6,'Strafe':.13/.6}
rig['clip_events']={'Attack':{'commit_phase':.42},'Cast':{'commit_phase':.45}}
rig.animation_data.action=bpy.data.actions['Idle'];rig.animation_data.action_slot=list(rig.animation_data.action_suitable_slots)[0]
scene.frame_set(1);scene.render.fps=30
export('mirelle-base-animated.glb',True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mirelle-base-animated.blend'))
checks={'geometry_unchanged':original==[tuple(v.co) for v in body.data.vertices],'unweighted_vertices':len(unweighted),
    'normalized_weights':all(abs(sum(g.weight for g in v.groups)-1)<1e-5 and len(v.groups)<=4 for v in body.data.vertices),
    'death_ends_low':metrics['Death']['final_head_joint_height_m']<.25,'finite_dense_motion':True,
    'ground_clearance':all(m['lowest_vertex_m']>=-.002 for m in metrics.values())}
report={'avatar_id':'c_invoker','canonical_id':'mirelle-vane','status':'animated_base_unqualified','provider':'blender-authored-anatomy-v1',
    'source_sha256':hashlib.sha256((SOURCE/'mirelle-base-unrigged.glb').read_bytes()).hexdigest(),'bones':len(armature.bones),'vertices':len(body.data.vertices),
    'checks':checks,'clips':metrics,'method':'New final-target anatomy rig, Blender heat weights and bounded four-influence normalization; ten motions authored directly with two-bone contact solves. No legacy donor or shared retarget repair applied.',
    'remaining_gates':['independent collision/deformation audit','multi-view visual review','actual Babylon GLB import and clip sampling','loop and transition checks','runtime locomotion contact and device budget'],
    'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in OUT.iterdir() if p.is_file()}}
(OUT/'rig-motion-report.json').write_text(json.dumps(report,indent=2)+'\n')
scene.render.resolution_x=500;scene.render.resolution_y=600;scene.cycles.samples=4
for clip,phase,angle in [('Idle',.2,0),('Run',.42,0),('Attack',.42,0),('Cast',.42,0),('Death',1,math.pi/2)]:
    action=bpy.data.actions[clip];rig.animation_data.action=action;rig.animation_data.action_slot=list(rig.animation_data.action_suitable_slots)[0]
    scene.frame_set(1+round(phase*(action.frame_range[1]-1)))
    camera=scene.camera;target=Vector((0,0,.90)) if clip!='Death' else Vector((0,-.65,.45))
    camera.location=target+Vector((math.sin(angle)*4,-math.cos(angle)*4,0));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/('motion-'+clip.lower()+'.png'));bpy.ops.render.render(write_still=True)
print('MIRELLE_RIG_COMPLETE='+json.dumps(checks),flush=True)
