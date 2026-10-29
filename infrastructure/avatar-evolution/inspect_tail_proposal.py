"""Save a separate colored proposal preview, preserving the source stage."""
import bpy
import json
import sys
from pathlib import Path
sys.path.insert(0,'/workspace/infrastructure/avatar-evolution')
from asset_pipeline.tail_repair import propose_tail,summarize

source,output=map(Path,sys.argv[sys.argv.index('--')+1:])
output.mkdir(exist_ok=False)
bpy.ops.wm.open_mainfile(filepath=str(source))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
reports=[]
for obj in meshes:
    proposal=propose_tail(obj,rig)
    reports.append(summarize(proposal))
    obj.data.materials.clear()
    for name,color in [('body',(.4,.4,.4,1)),('tail',(.05,.7,.3,1)),('collar',(.95,.3,.05,1))]:
        material=bpy.data.materials.new(name);material.diffuse_color=color;obj.data.materials.append(material)
    for face in obj.data.polygons:
        face.material_index=1 if sum(i in proposal['core'] for i in face.vertices)>=2 else 2 if sum(i in proposal['collar'] for i in face.vertices)>=2 else 0
    for i,point in enumerate(proposal['sections']):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=proposal['height']*.009,location=rig.matrix_world@point)
        bpy.context.object.name='tail-section-'+str(i)
bpy.ops.wm.save_as_mainfile(filepath=str(output/'proposal.blend'),compress=True)
(output/'proposal.json').write_text(json.dumps(reports,indent=2))
print(json.dumps(reports,indent=2))
