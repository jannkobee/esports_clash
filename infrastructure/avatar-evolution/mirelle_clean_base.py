"""Author a new neutral adult base in Blender; no previous avatar assets are consumed."""
import bpy
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

arguments=sys.argv[sys.argv.index('--')+1:];OUTPUT=Path(arguments[0])
OUTPUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.render.engine='CYCLES'
scene.cycles.samples=8
scene.cycles.use_denoising=True
scene.render.resolution_x=800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('StudioWorld');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.2,.2,.2,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
nodes=[];edges=[];radii=[];labels={}
def point(name,position,radius,parent=None):
    index=len(nodes);nodes.append(position);radii.append(radius);labels[name]=index
    if parent is not None:edges.append((labels[parent],index))
    return name
point('pelvis',(0,0,.96),(.125,.08))
point('waist',(0,0,1.1),(.105,.067),'pelvis')
point('ribs',(0,0,1.26),(.135,.08),'waist')
point('chest',(0,0,1.41),(.155,.08),'ribs')
point('neck_base',(0,0,1.51),(.038,.036),'chest')
point('neck_top',(0,0,1.57),(.037,.035),'neck_base')
point('head_low',(0,-.008,1.62),(.088,.075),'neck_top')
point('head_mid',(0,0,1.71),(.108,.092),'head_low')
point('head_top',(0,.006,1.79),(.086,.075),'head_mid')
point('crown',(0,.006,1.825),(.012,.012),'head_top')
for side,sign in [('L',1),('R',-1)]:
    point(side+'shoulder',(sign*.205,0,1.445),(.05,.05),'chest')
    point(side+'bicep',(sign*.28,0,1.37),(.051,.046),side+'shoulder')
    point(side+'elbow',(sign*.40,0,1.25),(.035,.033),side+'bicep')
    point(side+'forearm',(sign*.47,0,1.18),(.039,.034),side+'elbow')
    point(side+'wrist',(sign*.565,0,1.085),(.023,.02),side+'forearm')
    point(side+'palm',(sign*.602,0,1.048),(.026,.02),side+'wrist')
    for finger,offset,length in [('index',-.033,.078),('middle',-.011,.088),('ring',.011,.08),('little',.033,.062)]:
        name=side+finger
        base=Vector((sign*(.635+offset*.5),offset*.707,1.015+offset*.5))
        direction=Vector((sign*.707,0,-.707))
        point(name+'base',tuple(base),(.008,.008),side+'palm')
        point(name+'mid',tuple(base+direction*length*.45),(.007,.007),name+'base')
        point(name+'tip',tuple(base+direction*length*.90),(.0055,.0055),name+'mid')
        point(name+'end',tuple(base+direction*length*.99),(.002,.002),name+'tip')
    point(side+'thumbbase',(sign*.594,-.034,1.065),(.012,.01),side+'palm')
    point(side+'thumbmid',(sign*.61,-.052,1.075),(.009,.009),side+'thumbbase')
    point(side+'thumbtip',(sign*.635,-.060,1.083),(.004,.004),side+'thumbmid')
    point(side+'hip',(sign*.095,0,.925),(.083,.073),'pelvis')
    point(side+'thigh',(sign*.108,0,.77),(.077,.067),side+'hip')
    point(side+'knee',(sign*.13,-.012,.52),(.045,.043),side+'thigh')
    point(side+'calf',(sign*.14,.008,.36),(.054,.047),side+'knee')
    point(side+'ankle',(sign*.15,0,.115),(.03,.03),side+'calf')
    point(side+'foot',(sign*.15,-.075,.055),(.043,.035),side+'ankle')
    point(side+'toe',(sign*.15,-.17,.045),(.047,.03),side+'foot')
    point(side+'toe_end',(sign*.15,-.205,.045),(.02,.02),side+'toe')
mesh=bpy.data.meshes.new('MirelleBaseGraph');mesh.from_pydata(nodes,edges,[]);mesh.update()
body=bpy.data.objects.new('MirelleBase',mesh);scene.collection.objects.link(body)
bpy.context.view_layer.objects.active=body;body.select_set(True)
skin=body.modifiers.new('AnatomicalSurface','SKIN');skin.use_smooth_shade=True
for index,radius in enumerate(radii):mesh.skin_vertices[0].data[index].radius=radius
mesh.skin_vertices[0].data[labels['pelvis']].use_root=True
sub=body.modifiers.new('BaseSurface','SUBSURF');sub.subdivision_type='CATMULL_CLARK';sub.levels=2
bpy.ops.object.modifier_apply(modifier=skin.name);bpy.ops.object.modifier_apply(modifier=sub.name)
for vertex in body.data.vertices:
    x,y,z=vertex.co
    if z>1.58 and y<0:
        def bump(cx,cz,sx,sz,amount):return amount*math.exp(-((x-cx)/sx)**2-((z-cz)/sz)**2)
        vertex.co.y += bump(0,1.69,.019,.026,-.024)+bump(0,1.649,.033,.009,-.008)
        for side in [-1,1]:vertex.co.y+=bump(side*.035,1.724,.017,.012,.008)+bump(side*.035,1.743,.023,.012,-.007)
    if z<.018:vertex.co.z=.018
for polygon in body.data.polygons:polygon.use_smooth=True
if '--surface-union' in arguments:
    # Skin's high-valence palm junction can contain interior overlapping faces.
    # Resolve the actual surface before skinning instead of masking the validator.
    union=body.modifiers.new('ContinuousHandSurfaceUnion','REMESH');union.mode='VOXEL';union.voxel_size=.0035;union.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=union.name)
    decimate=body.modifiers.new('BaseSurfaceBudget','DECIMATE');decimate.ratio=min(1,19000/max(1,sum(len(p.vertices)-2 for p in body.data.polygons)));decimate.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    soften=body.modifiers.new('SurfaceRelaxation','SMOOTH');soften.factor=.15;soften.iterations=2;bpy.ops.object.modifier_apply(modifier=soften.name)
    for polygon in body.data.polygons:polygon.use_smooth=True
material=bpy.data.materials.new('OpaqueNeutralBaseLayer');material.use_nodes=True
bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.43,.46,.49,1);bsdf.inputs['Roughness'].default_value=.78
body.data.materials.append(material)
# Planar smart unwrap gives an inspectable UV map on the newly authored surface.
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
body['avatar_id']='c_invoker';body['canonical_id']='mirelle-vane';body['asset_stage']='base_mesh_unqualified';body['prompt_contract']='base-first-a-pose-v1'
body['authoring']='New Blender Skin/Subdivision surface from explicit adult anatomy graph; no previous character geometry'+('; pre-rig voxel surface union at 3.5mm and bounded decimation' if '--surface-union' in arguments else '')
body['modesty']='Opaque neutral matte continuous base layer; outfit deferred'
for name,location,power,size in [('Key',(-2,-3,4),500,3),('Fill',(2,-1,2),260,3),('Rim',(0,2,3),360,2)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=location
    light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('InspectionCamera');camera=bpy.data.objects.new('InspectionCamera',camera_data);scene.collection.objects.link(camera);scene.camera=camera
camera_data.type='ORTHO';camera_data.ortho_scale=2.05
def render(name,location):
    camera.location=location;camera.rotation_euler=(Vector((0,0,.93))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUTPUT/(name+'.png'));bpy.ops.render.render(write_still=True)
if '--no-render' not in arguments:
    for name,position in [('front',(0,-4,.93)),('side',(4,0,.93)),('back',(0,4,.93)),('perspective',(2.6,-4,1.8))]:render('mirelle-base-'+name,position)
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=str(OUTPUT/'mirelle-base-unrigged.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT/'mirelle-base-unrigged.blend'))
faces=body.data.polygons
report={'avatar_id':'c_invoker','canonical_id':'mirelle-vane','stage':'base_mesh_unqualified','method':body['authoring'],'vertices':len(body.data.vertices),'polygons':len(faces),'triangles':sum(len(p.vertices)-2 for p in faces),'uv_layers':len(body.data.uv_layers),'rest_landmarks':{key:list(nodes[index]) for key,index in labels.items()},'blender':bpy.app.version_string,'blender_build':bpy.app.build_hash.decode(),'files':{}}
for path in OUTPUT.iterdir():
    if path.is_file():report['files'][path.name]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size}
(OUTPUT/'base-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('MIRELLE_BASE_REPORT='+json.dumps({k:report[k] for k in ['stage','vertices','polygons','triangles','uv_layers']}))
