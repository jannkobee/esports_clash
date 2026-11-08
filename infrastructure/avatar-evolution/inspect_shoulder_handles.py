"""Colab-only source-bound contact/shape-handle inspection, without deformation."""
import os,sys,json,hashlib
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from review_generated_rig import load,surface
from review_combined_joint_candidate import reset_pose,TARGETS
from joint_pose_contract import apply_pose
from repair_contact_contour import contacts
from mesh_validation import rest_keys

root=Path(sys.argv[1]).resolve()
assert os.environ.get('COLAB_RELEASE_TAG') and root.is_relative_to('/content/teamfight-preparation/reviews')
source=root/'current-hip-animation.glb'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='42ac17a5740ab76878ca88d49e4b03cbb2d5998e7483acce91160bc0dc6ee597'
rigs,meshes=load(source);rig=rigs[0];obj=meshes[0]
for o in bpy.data.objects:o.animation_data_clear()
obj.data.shape_keys.animation_data_clear();reset_pose(rig)
for k in obj.data.shape_keys.key_blocks:k.value=0
rest,faces,regions=surface(meshes);rest=np.array(rest);height=float(np.ptp(rest[:,2]));keys=rest_keys([Vector(p) for p in rest])
mapping=json.loads((root/'baseline-report.json').read_text())['bone_map'];names=[b.name for b in rig.data.bones]
weights=np.zeros((len(rest),len(names)))
for v in obj.data.vertices:
 for g in v.groups:weights[v.index,names.index(obj.vertex_groups[g.group].name)]=g.weight
result={'compute':'google','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'body_height':height,
 'bones':{role:{'name':name,'head':list(rig.matrix_world@rig.data.bones[name].head_local),'tail':list(rig.matrix_world@rig.data.bones[name].tail_local)} for role,name in mapping.items() if name in rig.data.bones},'poses':[]}
out=root/'site/handles';out.mkdir(exist_ok=True,parents=True)
for angle in (60,90):
 apply_pose(rig,mapping,'UpperArmL',angle,'world_target');p=np.array(surface(meshes)[0]);f,pairs=contacts(p,faces,keys)
 involved=np.unique(f[np.array(pairs).flatten()].flatten());moving=rig.data.bones[mapping['UpperArmL']]
 moving={moving.name,*[b.name for b in moving.children_recursive]};mass=weights[:,[names.index(n) for n in moving]].sum(1)
 rows=[]
 for ia,ib in pairs:
  row=[]
  for fi in (ia,ib):
   ids=f[fi];row.append({'ids':ids.tolist(),'rest':rest[ids].mean(0).tolist(),'posed':p[ids].mean(0).tolist(),'arm_mass':float(mass[ids].mean())})
  rows.append(row)
 # Connected rest contact groups expose folds instead of choosing a posed bounds mask.
 adjacency={int(i):set() for i in involved}
 for face in f[np.unique(np.array(pairs).flatten())]:
  for i in face:adjacency[int(i)].update(int(j) for j in face)
 groups=[];pending=set(adjacency)
 while pending:
  seeds={pending.pop()};component=set()
  while seeds:
   i=seeds.pop();component.add(i);pending.discard(i);seeds.update(adjacency[i]-component)
  ids=np.array(sorted(component));groups.append({'vertices':len(ids),'rest_min':rest[ids].min(0).tolist(),'rest_max':rest[ids].max(0).tolist(),'posed_mean':p[ids].mean(0).tolist(),'arm_mass_range':[float(mass[ids].min()),float(mass[ids].max())]})
 result['poses'].append({'angle':angle,'contacts':len(pairs),'vertices':len(involved),'groups':sorted(groups,key=lambda x:-x['vertices']),'pairs':rows})
 # A neutral full surface with contact faces colored by actual arm mass.
 mesh=bpy.data.meshes.new('contact-inspection');mesh.from_pydata(p.tolist(),[],[tuple(face) for face in faces]);mesh.update()
 for name,color in [('body',(0.52,.57,.61,1)),('torso-contact',(.05,.3,1,1)),('arm-contact',(1,.1,.05,1)),('blend-contact',(1,.75,.05,1))]:
  mat=bpy.data.materials.new(name);mat.diffuse_color=color;mesh.materials.append(mat)
 # faces is already triangle ordered; match canonical contact faces by vertex tuple.
 affected={tuple(sorted(f[i])) for i in np.array(pairs).flatten()}
 for poly in mesh.polygons:
  poly.use_smooth=True
  if tuple(sorted(poly.vertices)) in affected:
   avg=mass[list(poly.vertices)].mean();poly.material_index=1 if avg<.25 else 2 if avg>.75 else 3
 snap=bpy.data.objects.new('contact-surface',mesh);bpy.context.collection.objects.link(snap)
 bpy.ops.object.select_all(action='DESELECT');snap.select_set(True);bpy.context.view_layer.objects.active=snap
 bpy.ops.export_scene.gltf(filepath=str(out/f'left-{angle}-contact.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=False,export_morph=False)
 bpy.data.objects.remove(snap,do_unlink=True);bpy.data.meshes.remove(mesh)
 np.savez_compressed(root/f'left-{angle}-inspection.npz',rest=rest,posed=p,faces=np.array(faces),contact_faces=f[np.unique(np.array(pairs).flatten())],weights=weights,bone_names=np.array(names))
(root/'handle-inspection.json').write_text(json.dumps(result,indent=2))
print(json.dumps({**result,'poses':[{k:v for k,v in p.items() if k!='pairs'} for p in result['poses']]}))
