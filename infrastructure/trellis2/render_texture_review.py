import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];source,output=args[:2];all_views='--all-views' in args
angle=float(args[2]) if len(args)>2 and not args[2].startswith('--') else 0
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=source)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render]
points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=(lo+hi)*.5;span=max(hi-lo)
for material in bpy.data.materials:
 if material.use_nodes:
  node=next((n for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'Image_0' in n.image.name),None)
  if node:material.node_tree.nodes.active=node
cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));bpy.context.collection.objects.link(cam);cam.location=center+Vector((math.sin(angle)*span*3,-math.cos(angle)*span*3,span*.15));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=span*1.25
s=bpy.context.scene;s.camera=cam;s.render.engine='BLENDER_WORKBENCH';s.display.shading.light='STUDIO';s.display.shading.color_type='TEXTURE';s.display.shading.show_shadows=True;s.render.resolution_x=512;s.render.resolution_y=512;s.render.resolution_percentage=100
views=[('front',0,False),('side',math.pi/2,False),('rear',math.pi,False),('perspective',math.pi/4,True)] if all_views else [('review',angle,'--perspective' in args)]
if all_views:Path(output).mkdir(parents=True,exist_ok=True)
for name,azimuth,perspective in views:
 cam.location=center+Vector((math.sin(azimuth)*span*3,-math.cos(azimuth)*span*3,span*.35 if perspective else span*.15))
 cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='PERSP' if perspective else 'ORTHO';cam.data.lens=50
 s.render.filepath=str(Path(output)/(name+'.png')) if all_views else output
 bpy.ops.render.render(write_still=True)
if all_views:
 report={'blender':bpy.app.version_string,'source':source,'bounds':{'min':list(lo),'max':list(hi)},'views':[v[0] for v in views],
  'meshes':[{'name':o.name,'vertices':len(o.data.vertices),'faces':len(o.data.polygons),'uv_layers':len(o.data.uv_layers)} for o in meshes],
  'textures':[{'name':im.name,'size':list(im.size)} for im in bpy.data.images if im.type=='IMAGE'],
  'scope':'Actual imported GLB, studio texture rendering; no artistic or rig qualification implied.'}
 (Path(output)/'blender-review.json').write_text(json.dumps(report,indent=2))
