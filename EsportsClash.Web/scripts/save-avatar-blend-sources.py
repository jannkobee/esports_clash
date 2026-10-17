"""Create packed, editable review scenes from the exact shipped GLBs. No runtime re-export."""
import bpy, sys, json, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
version=8 if '--mesh' in sys.argv else 7 if '--contact' in sys.argv else 6 if '--combat' in sys.argv else 5 if '--stance' in sys.argv else 4
output=ROOT/(f'art/avatars-v{version}' if version>=5 else 'art/avatars');output.mkdir(parents=True,exist_ok=True)
avatars=[row['id'] for row in json.loads((ROOT/f'EsportsClash.Web/public/models/avatars-v{version}/manifest.json').read_text())['avatars']] if version>=6 else ['c_astra','c_kyumi','c_invoker']
records=[]
for avatar in avatars:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/f'EsportsClash.Web/public/models/avatars-v{version}'/(avatar+'.glb')))
    for image in bpy.data.images:
        if image.has_data:image.pack()
    bpy.context.scene['source']=f'Exact shipped Esports Clash v{version} GLB; Quaternius CC0 anatomy; see art/README.md'
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(output/(avatar+'.blend')),compress=True)
    saved=output/(avatar+'.blend')
    records.append({'id':avatar,'file':saved.name,'bytes':saved.stat().st_size,'sha256':hashlib.sha256(saved.read_bytes()).hexdigest(),'actions':[action.name for action in bpy.data.actions],'gripShapes':sum(1 for mesh in bpy.data.meshes if mesh.shape_keys and 'Grip' in mesh.shape_keys.key_blocks)})
(output/'manifest.json').write_text(json.dumps({'version':version,'blender':'4.5.3 LTS','models':records},indent=2)+'\n')
