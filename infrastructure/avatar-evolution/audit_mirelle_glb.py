"""Independent exported-file audit, using the retained full-surface collision policy."""
import bpy
import bmesh
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

args=sys.argv[sys.argv.index('--')+1:];FILE=Path(args[0]);OUT=Path(args[1])
sys.path.insert(0,'/workspace/infrastructure/avatar-evolution')
from mesh_validation import collision_summary,rest_keys,POLICY
from asset_pipeline.edge_deformation import edge_deformation
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(FILE),merge_vertices=True)
rig=next(obj for obj in scene.objects if obj.type=='ARMATURE');body=next(obj for obj in scene.objects if obj.type=='MESH')
rig.animation_data.action=None
for pose in rig.pose.bones:pose.matrix_basis.identity()
bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get()
def surface():
    bpy.context.view_layer.update();evaluated=body.evaluated_get(graph);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
    points=[tuple(body.matrix_world@v.co) for v in mesh.vertices];faces=[tuple(t.vertices) for t in mesh.loop_triangles]
    evaluated.to_mesh_clear();return points,faces
rest,faces=surface();keys=rest_keys(rest)
regions=[]
dominant={v.index:body.vertex_groups[max(v.groups,key=lambda g:g.weight).group].name if v.groups else 'unweighted' for v in body.data.vertices}
for triangle in faces:
    names=[dominant[i] for i in triangle];regions.append(max(set(names),key=names.count))
rest_collision=collision_summary([Vector(p) for p in rest],faces,keys,regions)
meshcheck=bmesh.new();meshcheck.from_mesh(body.data)
topology={'boundary_edges':sum(edge.is_boundary for edge in meshcheck.edges),'nonmanifold_edges':sum(not edge.is_manifold for edge in meshcheck.edges),'loose_vertices':sum(not v.link_edges for v in meshcheck.verts)};meshcheck.free()
weights={'unweighted':sum(not v.groups for v in body.data.vertices),'maximum_influences':max(len(v.groups) for v in body.data.vertices),'maximum_sum_error':max(abs(sum(g.weight for g in v.groups)-1) for v in body.data.vertices)}
report={'file':str(FILE),'sha256':hashlib.sha256(FILE.read_bytes()).hexdigest(),'collision_policy':POLICY,'vertices':len(rest),'triangles':len(faces),'bones':len(rig.data.bones),'topology':topology,'weights':weights,'rest':rest_collision,'clips':{},'problems':[]}
for action in bpy.data.actions:
    name=action.name.split('|')[-1];rig.animation_data.action=action
    slots=list(rig.animation_data.action_suitable_slots)
    if len(slots)==1:rig.animation_data.action_slot=slots[0]
    start,end=action.frame_range;frames=[];min_z=math.inf;max_ratio=0;severe=0
    sampled_frames=sorted({round(start+phase*(end-start)) for phase in [0,.15,.42,.7,1]}) if '--quick' in args else list(range(math.floor(start),math.ceil(end)+1))
    for frame in sampled_frames:
        scene.frame_set(frame);points,triangles=surface()
        if not all(math.isfinite(c) for point in points for c in point):report['problems'].append(name+': nonfinite geometry')
        min_z=min(min_z,min(point[2] for point in points))
        stretch=edge_deformation(rest,points,triangles);max_ratio=max(max_ratio,stretch['maximum_length_ratio']);severe=max(severe,stretch['severely_stretched_edges'])
    for phase in [0,.15,.42,.7,1]:
        value=start+phase*(end-start);scene.frame_set(math.floor(value),subframe=value%1);points,triangles=surface()
        result=collision_summary([Vector(p) for p in points],triangles,keys,regions);frames.append({'phase':phase,**result})
    peak=max(frame['self_intersections'] for frame in frames)
    report['clips'][name]={'frames_checked':len(sampled_frames),'sampling':'five-phase-precheck' if '--quick' in args else 'every-exported-frame','lowest_vertex_m':min_z,'maximum_edge_ratio':max_ratio,'severely_stretched_edges':severe,'collision_samples':frames,'peak_intersections':peak}
    if min_z<-.002:report['problems'].append(name+': floor penetration')
    if severe:report['problems'].append(name+': gross stretching')
    if peak>rest_collision['self_intersections']:report['problems'].append(name+': self-intersections exceed rest')
    print('MIRELLE_AUDIT='+json.dumps({'clip':name,'floor':min_z,'peak_intersections':peak,'gross_stretch':severe}),flush=True)
if weights['unweighted'] or weights['maximum_sum_error']>1e-5 or weights['maximum_influences']>4:report['problems'].append('Invalid skin weights')
if topology['nonmanifold_edges'] or topology['loose_vertices']:report['problems'].append('Invalid base topology')
if len(report['clips'])!=10:report['problems'].append('Expected ten exported clips')
report['structural_passed']=not report['problems'];report['qualification']='pending Babylon, transition, contact and artistic review'
OUT.write_text(json.dumps(report,indent=2)+'\n');print('MIRELLE_AUDIT_DONE='+json.dumps({'passed':report['structural_passed'],'problems':report['problems']}),flush=True)
