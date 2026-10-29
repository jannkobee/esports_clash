import sys,json
from pathlib import Path
sys.path.insert(0,sys.argv[1]+'/tools')
from review_generated_rig import load,surface
root=Path(sys.argv[1]);contact=json.loads((root/'contact-map.json').read_text())
for n in ['candidate.glb','corrected-stress.glb']:
 rigs,meshes=load(root/n);pts,faces,_=surface(meshes)
 print(json.dumps({'file':n,'mesh_names_counts':{x.name:len(x.data.vertices) for x in meshes},'points':len(pts),'faces':len(faces),'contact_counts':contact['mesh_vertex_counts']}))
