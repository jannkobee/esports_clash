"""Blender integration checks for real prepared geometry, pose and attachments."""
import bpy,json,math,struct,sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from retarget_contacts import bake_contacts

folder,donor=map(Path,sys.argv[sys.argv.index('--')+1:])
prepared=json.loads((folder/'preparation.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(folder/'candidate-01.glb'))
rig=next(obj for obj in bpy.context.scene.objects if obj.type=='ARMATURE')
actions={action.name:action for action in bpy.data.actions}
assert set(['Idle','Walk','Run','Attack','Cast','Hit','Death']).issubset(actions)
assert all(not item['bone'].startswith('bone_') for item in prepared['equipment_repairs']), 'Finger branches were treated as rigid props'
height=max((rig.matrix_world@b.head_local).z for b in rig.data.bones)-min((rig.matrix_world@b.head_local).z for b in rig.data.bones)
observations=[]
def select(name,phase=0):
    action=actions[name];rig.animation_data_create();rig.animation_data.action=action
    slots=list(rig.animation_data.action_suitable_slots)
    if len(slots)==1:rig.animation_data.action_slot=slots[0]
    start,end=action.frame_range;frame=start+(end-start)*phase
    bpy.context.scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update()

select('Idle')
for side in ['L','R']:
    shoulder=rig.matrix_world@rig.pose.bones['UpperArm'+side].head
    hand=rig.matrix_world@rig.pose.bones['Hand'+side].head
    assert shoulder.z-hand.z>height*.10, ('Idle still has raised/T-pose arms',side)
    assert hand.y<shoulder.y-height*.05,('Idle hand is behind the body',side)
    observations.append({'side':side,'hand_below_shoulder':shoulder.z-hand.z,'hand_forward':shoulder.y-hand.y})

equipment=[]
for obj in bpy.context.scene.objects:
    info=obj.get('modularEquipment')
    if not info:continue
    side='HandR' if info['slot']=='primary' else 'HandL'
    assert obj.vertex_groups.get(side) is not None
    for vertex in obj.data.vertices:
        influences=[group for group in vertex.groups if group.weight>1e-7]
        assert len(influences)==1 and obj.vertex_groups[influences[0].group].name==side and abs(influences[0].weight-1)<1e-6
    equipment.append({'slot':info['slot'],'bone':side,'vertices':len(obj.data.vertices)})
assert {item['slot'] for item in equipment}=={item['slot'] for item in prepared['equipment']}
if equipment:assert prepared['grip_bones'],'Equipped hands need finger articulation'

finite_samples=0
for name in actions:
    for phase in [0,.25,.5,.75,1]:
        select(name,phase)
        assert all(math.isfinite(v) for bone in rig.pose.bones for row in bone.matrix for v in row)
        finite_samples+=1

# The carrying correction must depend on the hand, not its finger/prop count.
select('Idle');original={bone.name:bone.matrix_basis.copy() for bone in rig.pose.bones}
reference={side:rig.matrix_world@rig.pose.bones['Foot'+side].head for side in ['L','R']}
def carry(count):
    for name,matrix in original.items():rig.pose.bones[name].matrix_basis=matrix
    bpy.context.view_layer.update()
    bake_contacts(rig,reference,'Walk',.3,[{'new_parent':'HandR'}]*count)
    return rig.pose.bones['ForearmR'].matrix.copy()
single=carry(1);many=carry(15)
maximum=max(abs(single[i][j]-many[i][j]) for i in range(4) for j in range(4))
assert maximum<1e-5,'Equipment carrying correction accumulates per finger'

def durations(path):
    content=path.read_bytes();length=struct.unpack_from('<I',content,12)[0];data=json.loads(content[20:20+length])
    return {clip['name']:max(data['accessors'][sampler['input']]['max'][0] for sampler in clip['samplers']) for clip in data['animations']}
before=durations(donor);after=durations(folder/'candidate-01.glb')
assert before.keys()==after.keys()
assert all(abs(before[name]-after[name])<1e-5 for name in before),'Authored clip timing changed'
report={'passed':True,'idle':observations,'equipment':equipment,'finite_pose_samples':finite_samples,
        'carrying_duplicate_maximum_delta':maximum,'clip_durations_unchanged':True,'grip_bones':len(prepared['grip_bones']),
        'scope':'Pose, rigid attachment and timing checks; artistic quality, contacts, clipping and runtime qualification remain separate.'}
(folder/'equipped-pose-verification.json').write_text(json.dumps(report,indent=2))
print('EQUIPPED_POSE_CHECK '+json.dumps(report))
