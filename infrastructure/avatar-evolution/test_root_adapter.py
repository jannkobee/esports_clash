"""Blender integration check; operates on a read-only source, writes evidence only."""
import bpy
import hashlib
import json
from pathlib import Path
import struct
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bone_mapping import infer_humanoid, materialize_root_adapter

source,output=map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
assert len(rigs)==1
rig=rigs[0]
bpy.context.view_layer.update()
original={b.name:{'parent':b.parent.name if b.parent else None,'matrix':b.matrix_local.copy(),'deform':b.use_deform} for b in rig.data.bones}
def skin_digest():
    digest=hashlib.sha256()
    for obj in sorted((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:o.name):
        digest.update(obj.name.encode())
        for row in obj.matrix_world:digest.update(struct.pack('<4d',*row))
        for group in obj.vertex_groups:digest.update(group.name.encode())
        for vertex in obj.data.vertices:
            digest.update(struct.pack('<3d',*vertex.co))
            for group in vertex.groups:digest.update(struct.pack('<Id',group.group,group.weight))
    return digest.hexdigest()
before=skin_digest()
bones=[{'name':b.name,'parent':b.parent.name if b.parent else None,'position':list(rig.matrix_world@b.head_local)} for b in rig.data.bones]
mapping,review=infer_humanoid(bones)
assert review['accepted'] and review.get('root_adapter')
helper=materialize_root_adapter(rig,review)
bpy.context.view_layer.update()
assert rig.data.bones[helper].use_deform is False
assert rig.data.bones[helper].parent is None
assert rig.data.bones[mapping['Hips']].parent.name==helper
assert len(rig.data.bones)==len(original)+1
max_delta=0
for name,previous in original.items():
    current=rig.data.bones[name]
    delta=max(abs(current.matrix_local[i][j]-previous['matrix'][i][j]) for i in range(4) for j in range(4))
    max_delta=max(max_delta,delta)
    assert delta<1e-6,(name,delta)
    assert current.use_deform==previous['deform']
    if name!=mapping['Hips']:assert (current.parent.name if current.parent else None)==previous['parent']
assert skin_digest()==before,'Root adapter changed geometry, object transforms or skin influences.'
assert len(set(mapping.values()))==17 and all(name in rig.data.bones for name in mapping.values())
report={'passed':True,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'original_joints':len(original),
    'adapted_joints':len(rig.data.bones),'helper':helper,'non_deforming':True,'maximum_original_rest_matrix_delta':max_delta,
    'geometry_and_skin_digest_unchanged':True,'bone_map':mapping,'mapping_review':review}
output.write_text(json.dumps(report,indent=2))
print('ROOT_ADAPTER_CHECK '+json.dumps(report))
