import bpy,json,sys
from pathlib import Path
from review_generated_rig import load
from review_collision_weight_candidate import reset_pose
from review_shoulder_socket_study import edit_pivots
r=Path(sys.argv[1]);survey=json.loads((r/'output/report.json').read_text())['rest_socket_survey']
def snap(rig):return {b.name:[list(row) for row in b.matrix_local] for b in rig.data.bones}
def diff(a,b):return sorted([(max(abs(a[n][i][j]-b[n][i][j]) for i in range(4) for j in range(4)),n) for n in a],reverse=True)
rigs,_=load(r/'candidate.glb');rig=rigs[0];reset_pose(rig);before=snap(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.object.mode_set(mode='OBJECT');control=snap(rig)
rigs,_=load(r/'candidate.glb');rig=rigs[0];reset_pose(rig)
try:edit_pivots(rig,survey,'lateral_0p5pct')
except ValueError as e:print(str(e))
candidate=snap(rig)
print(json.dumps({'noop_differences':diff(before,control)[:12],'candidate_vs_noop':diff(control,candidate)[:12]}))
