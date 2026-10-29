"""Read-only support-distance diagnostic in rig rest coordinates."""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1])
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
inverse=rig.matrix_world.inverted()
height=(rig.data.bones['Head'].head_local-rig.data.bones['FootL'].head_local).length
hips=rig.data.bones['Hips'].head_local
segments=[(b.parent.head_local,b.head_local) for b in rig.data.bones if b.parent and (b.head_local-b.parent.head_local).length>height*.005]
def distance(point,a,b):
    delta=b-a;t=max(0,min(1,(point-a).dot(delta)/delta.length_squared))
    return (point-a-t*delta).length
report=[]
for obj in bpy.context.scene.objects:
    if obj.type!='MESH' or not any(m.type=='ARMATURE' and m.object==rig for m in obj.modifiers):continue
    points=[inverse@obj.matrix_world@v.co for v in obj.data.vertices]
    support=[min(distance(p,a,b) for a,b in segments)/height for p in points]
    for limit in [.06,.08,.10,.12]:
        selected={i for i,p in enumerate(points) if support[i]>limit and p.y>hips.y+height*.06 and p.z<hips.z+height*.15}
        adjacency={i:set() for i in selected}
        for edge in obj.data.edges:
            a,b=edge.vertices
            if a in selected and b in selected:adjacency[a].add(b);adjacency[b].add(a)
        components=[];remaining=set(selected)
        while remaining:
            stack=[remaining.pop()];component=[]
            while stack:
                i=stack.pop();component.append(i)
                for j in adjacency[i]:
                    if j in remaining:remaining.remove(j);stack.append(j)
            if len(component)>10:
                components.append({'vertices':len(component),'bounds':[[min(points[i][axis] for i in component) for axis in range(3)],[max(points[i][axis] for i in component) for axis in range(3)]]})
        report.append({'mesh':obj.name,'limit':limit,'selected':len(selected),'components':sorted(components,key=lambda c:-c['vertices'])[:8]})
print(json.dumps({'height':height,'hips':list(hips),'report':report},indent=2))
