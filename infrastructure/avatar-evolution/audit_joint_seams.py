"""Colab-only geometric seam and local skin-weight diagnostic, without edits."""
from collections import Counter, defaultdict
import hashlib, json, math, os, sys
from pathlib import Path
import bpy

root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
    raise RuntimeError('Google Colab required')
plan=json.loads((root/'plan.json').read_text())
for name,sha in plan['files'].items():
    if hashlib.sha256((root/name).read_bytes()).hexdigest()!=sha: raise ValueError('Input mismatch: '+name)
mapping=plan['bone_map']; roles=('UpperArmL','UpperArmR','ThighL','ThighR')
def load(filename):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(root/filename),merge_vertices=True)
    rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
    displays={b.custom_shape for r in rigs for b in r.pose.bones if b.custom_shape}
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in displays]
    if len(meshes)!=1 or len(rigs)>1: raise ValueError('Unexpected mesh/rig count')
    return meshes[0],rigs[0] if rigs else None
def key(p): return tuple(round(float(c),6) for c in p)
def stats(obj,rig,centers,radius):
    points=[obj.matrix_world@v.co for v in obj.data.vertices]
    keys=[key(p) for p in points]; groups=defaultdict(list)
    for i,k in enumerate(keys): groups[k].append(i)
    edges=Counter(); triangles=Counter()
    for p in obj.data.polygons:
        if len(p.vertices)!=3: raise ValueError('Expected triangulated imported mesh')
        tri=[keys[i] for i in p.vertices];triangles[tuple(sorted(tri))]+=1
        for i in range(3): edges[tuple(sorted((tri[i],tri[(i+1)%3])))]+=1
    names={g.index:g.name for g in obj.vertex_groups}
    weights=[{names[g.group]:g.weight for g in v.groups if g.weight>1e-8} for v in obj.data.vertices]
    def l1(a,b):return sum(abs(a.get(n,0)-b.get(n,0)) for n in a.keys()|b.keys())
    result={}
    for role,center in centers.items():
        near=lambda k: math.dist(k,center)<=radius
        local_edges={e:c for e,c in edges.items() if near(e[0]) or near(e[1])}
        local_groups=[indices for k,indices in groups.items() if near(k)]
        differences=[]
        for indices in local_groups:
            if len(indices)>1:
                differences.extend(l1(weights[indices[0]],weights[i]) for i in indices[1:])
        result[role]={'welded_points':len(local_groups),'duplicate_vertex_groups':sum(len(x)>1 for x in local_groups),
            'geometric_boundary_edges':sum(c==1 for c in local_edges.values()),
            'geometric_edges_with_more_than_two_faces':sum(c>2 for c in local_edges.values()),
            'duplicate_weight_l1_max':max(differences,default=0),
            'duplicate_weight_l1_over_0_01':sum(d>0.01 for d in differences)}
        if rig:
            groupsums=Counter(); n=0
            for indices in local_groups:
                for i in indices:
                    groupsums.update(weights[i]); n+=1
            result[role]['mean_influence_per_imported_vertex']={k:round(v/n,6) for k,v in groupsums.most_common(8)} if n else {}
    return {'geometric_vertices':len(groups),'geometric_boundary_edges':sum(c==1 for c in edges.values()),
        'geometric_edges_with_more_than_two_faces':sum(c>2 for c in edges.values()),
        'triangles':sum(triangles.values()),'local':result},triangles

raw,rig=load(plan['stages']['raw']); centers={}
for role in roles: centers[role]=list(rig.matrix_world@rig.data.bones[mapping[role]].head_local)
all_points=[raw.matrix_world@v.co for v in raw.data.vertices]
height=max(p.z for p in all_points)-min(p.z for p in all_points);radius=height*.08
stages={}; triangles={}
for label,filename in plan['stages'].items():
    mesh,armature=load(filename);stages[label],triangles[label]=stats(mesh,armature,centers,radius)
for label in ('raw','early','corrected'):
    stages[label]['triangles_missing_from_source']=sum((triangles['source']-triangles[label]).values())
    stages[label]['triangles_not_in_source']=sum((triangles[label]-triangles['source']).values())
report={'id':plan['id'],'compute':'google','status':'diagnostic_complete','publication_eligible':False,
    'qualification_complete':False,'method':'quantized-geometric-seams-and-joint-weight-profile-v1',
    'limitations':'Rounded world positions at 1e-6 coordinate units approximate welding and can merge unrelated coincident surfaces. Triangle signatures are sensitive to quantization; local areas use a spherical radius around raw joint heads. No posed or visual validation.',
    'radius':radius,'centers':centers,'plan':plan,'stages':stages}
(root/'joint-seams-report.json').write_text(json.dumps(report,indent=2));print('completed')
