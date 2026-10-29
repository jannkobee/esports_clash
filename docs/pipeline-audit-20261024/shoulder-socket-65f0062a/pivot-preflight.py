import json,sys
from pathlib import Path
from review_generated_rig import load,surface
from review_collision_weight_candidate import reset_pose,surface_roundtrip
from review_shoulder_socket_study import edit_pivots,weight_records,weight_match
r=Path(sys.argv[1]);previous=r.parent/'47b6145b-d5cc-4565-bcef-11bc89a297b5'
survey=json.loads((previous/'output/report.json').read_text())['rest_socket_survey']
rigs,meshes=load(r/'candidate.glb');reset_pose(rigs[0]);before,_,_=surface(meshes);weights=weight_records(meshes)
p=r/'preflight.glb';proof=edit_pivots(r/'candidate.glb',p,survey,'lateral_0p5pct')
rigs,meshes=load(p);reset_pose(rigs[0]);after,_,_=surface(meshes)
errors=[(rigs[0].matrix_world@rigs[0].data.bones[row['bone']].head_local-__import__('mathutils').Vector(row['after_xyz'])).length for row in proof['joints']]
match=weight_match(weights,weight_records(meshes));bad=weight_records(meshes);position,groups=bad[0];key=next(iter(groups));groups[key]+=.01
rejects_mutation=not weight_match(weights,bad)['verified']
result={'proof':proof,'requested_pivot_max_error_m':max(errors),'rest_roundtrip':surface_roundtrip(before,after),'weights':match,'rejects_weight_mutation':rejects_mutation}
assert max(errors)<1e-6 and match['verified'] and rejects_mutation
(r/'pivot-preflight.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
