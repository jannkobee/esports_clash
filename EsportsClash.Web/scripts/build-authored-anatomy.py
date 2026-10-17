"""Blender 4.5+: extract licensed artist anatomy, preserve UVs/maps, and export joint-local parts.
The runtime rig/clips are preserved by merge-authored-avatars.mjs, not round-tripped through Blender.
"""
import bpy, bmesh, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[2]
PREP=ROOT/'.local-tools/artist-prep'
SOURCE=ROOT/'.local-tools/character-sources/base'
CONFIG=json.loads((PREP/'avatars.json').read_text())

def srgb(hex_color):
    return tuple((v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in [int(hex_color[i:i+2],16)/255 for i in (1,3,5)])

def cut_mesh(obj, keep):
    mesh=obj.data.copy();obj.data=mesh
    bm=bmesh.new();bm.from_mesh(mesh)
    delete=[v for v in bm.verts if not keep(v.index)]
    bmesh.ops.delete(bm,geom=delete,context='VERTS');bm.to_mesh(mesh);bm.free();mesh.update()

def erase_rig(obj):
    world=obj.matrix_world.copy()
    obj.parent=None;obj.matrix_world=world
    for mod in list(obj.modifiers):obj.modifiers.remove(mod)
    obj.vertex_groups.clear()

def tint_material(material, tint, role):
    result=material.copy();result.name=role+'-'+tint
    if not result.use_nodes:return result
    nodes=result.node_tree.nodes;links=result.node_tree.links
    bsdf=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
    if not bsdf:return result
    # Preserve the artist's albedo/normal/roughness textures. A tint is baked into base color
    # on the actual mesh, rather than removing the source's painted surface information.
    base=bsdf.inputs['Base Color'];incoming=base.links[0].from_socket if base.is_linked else None
    if incoming:
        mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[0].default_value=.45 if role=='cloth' else .72
        mix.inputs[2].default_value=(*srgb(tint),1);links.new(incoming,mix.inputs[1]);links.new(mix.outputs[0],base)
    else:base.default_value=(*srgb(tint),1)
    return result

def bake_color(obj):
    # Baking a material here is a Blender asset operation, with original UVs retained.
    for other in bpy.context.selected_objects:other.select_set(False)
    obj.select_set(True);bpy.context.view_layer.objects.active=obj
    for i,material in enumerate(obj.data.materials):
        if not material or not material.use_nodes:continue
        image=bpy.data.images.new(obj.name+'-albedo-'+str(i),width=512,height=512,alpha=False)
        image.generated_color=(.1,.1,.1,1)
        node=material.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
        material.node_tree.nodes.active=node
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'},use_clear=True,margin=8)
    for material in obj.data.materials:
        if not material or not material.use_nodes:continue
        node=material.node_tree.nodes.active
        bsdf=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        material.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
        folder=PREP/'baked';folder.mkdir(exist_ok=True)
        node.image.filepath_raw=str(folder/(spec['id']+'-'+node.image.name+'.png'))
        node.image.file_format='PNG';node.image.save();node.image.source='FILE';node.image.reload();node.image.pack()

for spec in CONFIG['avatars']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1
    gender=spec['gender'].capitalize()
    source=next(SOURCE.rglob('Superhero_'+gender+'_FullBody.gltf'))
    bpy.ops.import_scene.gltf(filepath=str(source))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    skin=next(o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.vertices)>2000)
    head_z=(rig.matrix_world@rig.data.bones['Head'].head_local).z
    original_meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.vertex_groups]
    parts=[];head_objects=[]
    for obj in original_meshes:
        groups={g.index:g.name for g in obj.vertex_groups}
        keep=[]
        for vertex in obj.data.vertices:
            score=sum(g.weight for g in vertex.groups if groups.get(g.group) in ('Head','neck_01'))
            keep.append(score>.5 and (obj.matrix_world@vertex.co).z>=head_z-.028)
        if not any(keep):continue
        face=obj.copy();face.data=obj.data.copy();bpy.context.collection.objects.link(face)
        cut_mesh(face,lambda i:keep[i]);erase_rig(face);head_objects.append(face)
    points=[o.matrix_world@v.co for o in head_objects for v in o.data.vertices]
    low=min(v.z for v in points);high=max(v.z for v in points);scale=13/(high-low);center=(high+low)/2
    head_transform=Matrix.Diagonal((scale*spec.get('faceWidth',1),scale,scale,1))@Matrix.Translation((0,0,-center))
    # Head's joint-local mesh sits in the original canonical y=64 authoring frame.
    for obj in head_objects:
        obj.data.transform(head_transform@obj.matrix_world);obj.matrix_world=Matrix.Identity(4)
        obj.name='artist-head-'+obj.name;obj['anatomyTarget']='Head';parts.append(obj)
        role='hair' if 'brow' in obj.name.lower() else 'eyes' if 'eye' in obj.name.lower() else 'skin'
        if role!='eyes':
            for i,mat in enumerate(obj.data.materials):obj.data.materials[i]=tint_material(mat,spec['hairColor'] if role=='hair' else spec['skin'],role)
            bake_color(obj)
    for style in [spec['hair']]+(['Hair_Beard'] if spec.get('beard') else []):
        hair_path=next(p for p in SOURCE.rglob(style+'.gltf') if 'Origin at 0' in str(p))
        before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(hair_path))
        for obj in set(bpy.data.objects)-before:
            if obj.type!='MESH':continue
            erase_rig(obj);obj.data.transform(head_transform@obj.matrix_world);obj.matrix_world=Matrix.Identity(4)
            obj.name='artist-'+style;obj['anatomyTarget']='Head'
            for i,mat in enumerate(obj.data.materials):obj.data.materials[i]=tint_material(mat,spec['hairColor'],'hair')
            bake_color(obj);parts.append(obj)
    for suffix,target,rotation in [('r','HandL',-math.pi/2),('l','HandR',math.pi/2)]:
        obj=skin.copy();obj.data=skin.data.copy();bpy.context.collection.objects.link(obj)
        groups={g.index:g.name for g in obj.vertex_groups};wrist=rig.matrix_world@rig.data.bones['hand_'+suffix].head_local
        keep=[]
        for vertex in obj.data.vertices:
            score=sum(g.weight for g in vertex.groups if groups.get(g.group,'').endswith('_'+suffix) and any(n in groups.get(g.group,'') for n in ('hand','thumb','index','middle','ring','pinky')))
            world=obj.matrix_world@vertex.co
            keep.append(score>.5 and ((world.x<=wrist.x+.028) if suffix=='r' else (world.x>=wrist.x-.028)))
        cut_mesh(obj,lambda i:keep[i]);erase_rig(obj)
        transform=Matrix.Rotation(rotation,4,'Y')@Matrix.Diagonal((29,29,29,1))@Matrix.Translation(-wrist)
        obj.data.transform(transform@obj.matrix_world);obj.matrix_world=Matrix.Identity(4)
        obj.name='artist-'+target;obj['anatomyTarget']=target
        for i,mat in enumerate(obj.data.materials):obj.data.materials[i]=tint_material(mat,spec['handColor'],'hand')
        bake_color(obj);parts.append(obj)
    if spec.get('outfit'):
        source=next((ROOT/'.local-tools/character-sources/outfits').rglob(gender+'_Ranger.gltf'))
        before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(source))
        imported=set(bpy.data.objects)-before
        source_rig=next(o for o in imported if o.type=='ARMATURE')
        width=spec['width']
        targets={'Root':Vector((0,0,0)),'Hips':Vector((0,0,32)),'Spine':Vector((0,0,41)),
                 'Chest':Vector((0,0,51)),'Head':Vector((0,0,64))}
        for side,label in [(-1,'L'),(1,'R')]:
            for name,z in [('UpperArm',49),('Forearm',38),('Hand',27)]:targets[name+label]=Vector((side*(width+2),0,z))
            for name,z in [('Thigh',33),('Calf',16),('Foot',4)]:targets[name+label]=Vector((side*width*.43,0,z))
        def source_point(name):return source_rig.matrix_world@source_rig.data.bones[name].head_local
        maps={}
        torso=Matrix.Diagonal((width*4.7,42,42,1))
        torso=Matrix.Translation((0,0,32))@torso@Matrix.Translation(-source_point('pelvis'))
        for bone in source_rig.data.bones:
            name=bone.name;target={'root':'Root','pelvis':'Hips','spine_01':'Spine','spine_02':'Chest','spine_03':'Chest','neck_01':'Head','Head':'Head'}.get(name,'Chest')
            transform=torso
            for suffix,label,side in [('l','R',1),('r','L',-1)]:
                if not name.endswith('_'+suffix):continue
                if name.startswith('clavicle'):break
                arm=next((item for item in [('upperarm','UpperArm','lowerarm',11),('lowerarm','Forearm','hand',11)] if name.startswith(item[0])),None)
                leg=next((item for item in [('thigh','Thigh','calf',17),('calf','Calf','foot',12)] if name.startswith(item[0])),None)
                if arm or leg:
                    prefix,target_prefix,next_prefix,length=arm or leg;target=target_prefix+label
                    origin=source_point(prefix+'_'+suffix);delta=source_point(next_prefix+'_'+suffix)-origin
                    rotation=delta.normalized().rotation_difference(Vector((0,0,-1))).to_matrix().to_4x4()
                    scale=Matrix.Diagonal((length/delta.length,35,35,1)) if arm else Matrix.Diagonal((35,35,length/delta.length,1))
                    transform=Matrix.Translation(targets[target])@rotation@scale@Matrix.Translation(-origin)
                elif any(word in name for word in ('hand','thumb','index','middle','ring','pinky')):
                    target='Hand'+label
                    transform=Matrix.Translation(targets[target])@Matrix.Rotation(side*math.pi/2,4,'Y')@Matrix.Diagonal((29,29,29,1))@Matrix.Translation(-source_point('hand_'+suffix))
                elif name.startswith(('foot','ball')):
                    target='Foot'+label
                    transform=Matrix.Translation(targets[target])@Matrix.Diagonal((35,35,35,1))@Matrix.Translation(-source_point('foot_'+suffix))
                break
            maps[name]=(target,transform)
        armature=bpy.data.armatures.new('Runtime17');outfit_rig=bpy.data.objects.new('Runtime17',armature)
        bpy.context.collection.objects.link(outfit_rig);bpy.context.view_layer.objects.active=outfit_rig;outfit_rig.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for name,point in targets.items():
            bone=armature.edit_bones.new(name);bone.head=point;bone.tail=point+Vector((0,0,1))
        for bone in armature.edit_bones:
            if bone.name!='Root':bone.parent=armature.edit_bones['Root']
        bpy.ops.object.mode_set(mode='OBJECT');parts.append(outfit_rig)
        for obj in imported:
            if obj.type!='MESH' or not obj.vertex_groups or 'Head_Hood' in obj.name:continue
            names={g.index:g.name for g in obj.vertex_groups};weights=[];positions=[]
            for vertex in obj.data.vertices:
                world=obj.matrix_world@vertex.co;position=Vector((0,0,0));collapsed={};total=0
                for group in vertex.groups:
                    if group.weight<=0 or names[group.group] not in maps:continue
                    target,transform=maps[names[group.group]]
                    position+=(transform@world)*group.weight;total+=group.weight
                    collapsed[target]=collapsed.get(target,0)+group.weight
                positions.append(position/max(total,.00001));weights.append(collapsed)
            erase_rig(obj);obj.matrix_world=Matrix.Identity(4)
            for vertex,position in zip(obj.data.vertices,positions):vertex.co=position
            # The outfit was changed from T-pose to the game's resting pose. Imported custom
            # normals describe the old directions and must be recomputed on the fitted mesh.
            obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
            for name in targets:obj.vertex_groups.new(name=name)
            for index,values in enumerate(weights):
                values=sorted(values.items(),key=lambda row:-row[1])[:4];total=sum(value for _,value in values)
                for name,value in values:obj.vertex_groups[name].add([index],value/total,'REPLACE')
            modifier=obj.modifiers.new('Runtime17','ARMATURE');modifier.object=outfit_rig
            obj.name='artist-outfit-'+obj.name;obj['anatomyTarget']='Outfit'
            for i,material in enumerate(obj.data.materials):
                role='skin' if 'Regular' in material.name else 'cloth'
                obj.data.materials[i]=tint_material(material,spec['skin'] if role=='skin' else spec['primary'],role)
            bake_color(obj);parts.append(obj)
    # Keep only authored parts; no imported rig or helper mesh enters the parts GLB.
    for obj in list(bpy.context.scene.objects):
        if obj not in parts:bpy.data.objects.remove(obj,do_unlink=True)
    for image in bpy.data.images:
        if image.size[0]>512 or image.size[1]>512:image.scale(min(512,image.size[0]),min(512,image.size[1]))
        if image.has_data and image.source=='FILE':image.pack()
    for obj in parts:
        if obj.type!='MESH':continue
        for polygon in obj.data.polygons:polygon.use_smooth=True
    output=PREP/'parts'/ (spec['id']+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_extras=True,export_animations=False,export_materials='EXPORT',export_image_format='AUTO')
    print('AUTHORED_PARTS '+spec['id']+' '+str(output.stat().st_size),flush=True)
