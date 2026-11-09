"""Full-edge telemetry for a retained Blender candidate; no asset mutation."""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1])
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
rig.animation_data.action=bpy.data.actions['Run']
rig.animation_data.action_slot=list(rig.animation_data.action_suitable_slots)[0]
start,end=rig.animation_data.action.frame_range
frame=start+(end-start)*.42
bpy.context.scene.frame_set(int(frame),subframe=frame%1)
result=[]
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh=evaluated.to_mesh()
    try:
        def weights(i):return {obj.vertex_groups[g.group].name:round(g.weight,4) for g in obj.data.vertices[i].groups}
        for edge in obj.data.edges:
            a,b=edge.vertices
            rest=(obj.data.vertices[a].co-obj.data.vertices[b].co).length
            posed=(mesh.vertices[a].co-mesh.vertices[b].co).length
            if rest>.01 and posed/rest>4:
                result.append({'ratio':posed/rest,'rest':rest,'posed':posed,
                    'points':[list(obj.data.vertices[i].co) for i in (a,b)],'weights':[weights(i) for i in (a,b)]})
    finally:evaluated.to_mesh_clear()
report={'clip':'Run','phase':.42,'edges_above_ratio_four':len(result),
        'largest_stretched_edges':sorted(result,key=lambda e:-e['posed'])[:10]}
arguments=sys.argv[sys.argv.index('--')+1:]
if len(arguments)>1:
    with Path(arguments[1]).open('x') as output:json.dump(report,output,indent=2)
print(json.dumps(report,indent=2))
