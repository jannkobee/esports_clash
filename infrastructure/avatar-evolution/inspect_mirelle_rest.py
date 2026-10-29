import bpy,json,sys
from pathlib import Path
sys.path.insert(0,'/workspace/infrastructure/avatar-evolution')
from mesh_validation import rest_keys,collision_summary
bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1])
body=bpy.data.objects['MirelleBase'];rig=next((o for o in bpy.context.scene.objects if o.type=='ARMATURE'),None)
if rig:
    rig.animation_data_clear()
    for b in rig.pose.bones:b.matrix_basis.identity()
bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get();o=body.evaluated_get(graph);mesh=o.to_mesh();mesh.calc_loop_triangles()
points=[v.co.copy() for v in mesh.vertices];faces=[tuple(t.vertices) for t in mesh.loop_triangles]
def label(indices):
    center=sum((points[i] for i in indices),points[0]*0)/3
    if center.z>1.55:return 'head'
    if abs(center.x)>.55:return 'hand'
    if center.z<.2:return 'foot'
    if center.z>.95:return 'upper-body'
    return 'pelvis-legs'
r=collision_summary(points,faces,rest_keys(points),[label(face) for face in faces]);print('MIRELLE_REST='+json.dumps(r),flush=True)
