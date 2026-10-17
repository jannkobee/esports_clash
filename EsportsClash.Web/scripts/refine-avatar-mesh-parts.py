"""Refine existing licensed meshes in Blender; keep original source files and v7 intact.
The final merger retains the game's exact rig/animation data instead of re-exporting it here.
"""
import bpy,bmesh,json,math,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PREP=ROOT/'.local-tools/mesh-prep'
CONFIG=json.loads((PREP/'avatars.json').read_text())
(PREP/'parts').mkdir(parents=True,exist_ok=True)
selected=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--only=')),None)
records=[]
for spec in CONFIG['avatars']:
    if not spec['anatomy'] or (selected and selected!=spec['id']):continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'.local-tools/artist-prep/parts'/(spec['id']+'.glb')))
    profile=spec['mesh'];removed=0;surfaces=0
    for obj in list(bpy.context.scene.objects):
        if obj.type!='MESH':continue
        target=obj.get('anatomyTarget')
        if target=='Outfit':
            # Superseded T-pose arm/clavicle skinning made projecting elbow fins.
            # Runtime-authored closed arm sleeves/gussets now replace these surfaces.
            names={g.index:g.name for g in obj.vertex_groups}
            arm_vertices={v.index for v in obj.data.vertices if sum(g.weight for g in v.groups if names.get(g.group,'').startswith(('UpperArm','Forearm','Hand')))>0.12}
            bm=bmesh.new();bm.from_mesh(obj.data);bm.faces.ensure_lookup_table()
            faces=[f for f in bm.faces if any(v.index in arm_vertices for v in f.verts)]
            removed+=len(faces);bmesh.ops.delete(bm,geom=faces,context='FACES')
            isolated=[v for v in bm.verts if not v.link_faces]
            bmesh.ops.delete(bm,geom=isolated,context='VERTS');bm.to_mesh(obj.data);bm.free()
            if not obj.data.polygons:bpy.data.objects.remove(obj,do_unlink=True);continue
            for vertex in obj.data.vertices:
                world=obj.matrix_world@vertex.co;y=world.z
                chest=math.exp(-((y-47)/8)**2);waist=math.exp(-((y-34)/5)**2)
                world.x*=1+(profile['chest']-1)*chest+(profile['waist']-1)*waist
                # Boots retain exact sole and support geometry from v7.
                if y>12:world.y*=1+(profile['depth']-1)*(chest+waist*.5)
                vertex.co=obj.matrix_world.inverted()@world
            surfaces+=1
        elif target=='Head':
            for vertex in obj.data.vertices:
                # Preserve the neck attachment, then vary cheek/jaw width and face depth.
                y=vertex.co.z;t=max(0,min(1,(y+5.5)/3.5));t=t*t*(3-2*t)
                vertex.co.x*=1+(profile['face']-1)*t
                vertex.co.y*=1+(profile['depth']-1)*t*.5
            surfaces+=1
        # Edited surfaces need normals for their final geometry, not their former pose.
        if target in ('Head','Outfit'):
            bm=bmesh.new();bm.from_mesh(obj.data)
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
            obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
        for polygon in obj.data.polygons:polygon.use_smooth=True
        obj['meshRevision']=8
    output=PREP/'parts'/(spec['id']+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_extras=True,export_animations=False,export_image_format='AUTO')
    records.append({'id':spec['id'],'editedSurfaces':surfaces,'replacedArmFaces':removed,'bytes':output.stat().st_size})
    print('MESH_PARTS '+spec['id']+' '+str(removed),flush=True)
(PREP/'blender-refinement.json').write_text(json.dumps({'version':8,'blender':bpy.app.version_string,'models':records},indent=2)+'\n')
