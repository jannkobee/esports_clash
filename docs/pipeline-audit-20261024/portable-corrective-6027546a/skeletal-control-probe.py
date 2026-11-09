import json,sys,numpy as np,bpy,math
from pathlib import Path
from review_generated_rig import load
from bake_pose_corrective_candidate import set_pose,deformation_matrices,TARGETS
from candidate_animation import bind_imported_clip
r=Path(sys.argv[1]);mapping=json.loads((r/'baseline-report.json').read_text())['bone_map']
rigs,meshes=load(r/'candidate.glb');rig=rigs[0];names=[b.name for b in rig.pose.bones];expected={}
for role in TARGETS:
 for deg in (45,90):
  set_pose(rig,meshes[0],mapping,role,deg);bpy.context.view_layer.update();expected[(role,deg)]=deformation_matrices(rig,names)
results={};rows=[]
for label,file in [('control',r.parent/'90c5282c-c89b-4d56-8614-82d7c0c11406/site/current-stress.glb'),('corrective',r/'output/pose-corrective-stress.glb')]:
 rigs,meshes=load(file);rig=rigs[0]
 for role in TARGETS:
  action,bindings=bind_imported_clip(rig,meshes,'Stress_'+role,label=='corrective' and role in ['UpperArmL','UpperArmR','ThighL','ThighR']);first,last=action.frame_range
  for phase,deg in [(.25,45),(.5,90)]:
   frame=first+(last-first)*phase;bpy.context.scene.frame_set(math.floor(first)-1);bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame));bpy.context.view_layer.update()
   matrix=deformation_matrices(rig,names);results[(label,role,deg)]=matrix
for role in TARGETS:
 for deg in (45,90):
  control=results[('control',role,deg)];current=results[('corrective',role,deg)];ideal=expected[(role,deg)]
  rows.append({'joint':role,'degrees':deg,'control_vs_ideal':float(np.abs(control-ideal).max()),'corrective_vs_ideal':float(np.abs(current-ideal).max()),'corrective_vs_control':float(np.abs(current-control).max())})
result={'poses':rows,'max_control_vs_ideal':max(x['control_vs_ideal'] for x in rows),'max_corrective_vs_ideal':max(x['corrective_vs_ideal'] for x in rows),'max_corrective_vs_control':max(x['corrective_vs_control'] for x in rows)}
(r/'skeletal-control-probe.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
