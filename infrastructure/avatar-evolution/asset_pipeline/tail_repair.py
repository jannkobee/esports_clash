"""Opt-in single pelvic tail reconstruction from unsupported rest geometry.

Requires explicit anatomy, a clear posterior tube and an otherwise mapped biped.
Ambiguous/multiple appendages are rejected. Geometry is never welded or moved.
"""
import heapq
import math
import hashlib
import json
from mathutils import Vector
from mathutils.kdtree import KDTree

PROFILE = 'single-pelvic-tail-v1'


def segment_distance(point,a,b):
    delta=b-a
    if delta.length_squared<1e-14:return (point-a).length
    return (point-a-delta*max(0,min(1,(point-a).dot(delta)/delta.length_squared))).length


def propose_tail(obj,rig):
    inverse=rig.matrix_world.inverted()
    points=[inverse@obj.matrix_world@v.co for v in obj.data.vertices]
    hips=rig.data.bones['Hips'].head_local
    up=(rig.data.bones['Head'].head_local-hips).normalized()
    lateral=(rig.data.bones['UpperArmR'].head_local-rig.data.bones['UpperArmL'].head_local).normalized()
    posterior=up.cross(lateral).normalized()
    height=(rig.data.bones['Head'].head_local-rig.data.bones['FootL'].head_local).length
    segments=[(b.parent.head_local,b.head_local) for b in rig.data.bones if b.parent and
              (b.head_local-b.parent.head_local).length>height*.005]
    support=[min(segment_distance(p,a,b) for a,b in segments) for p in points]
    candidates={i for i,p in enumerate(points) if support[i]>height*.10 and
                (p-hips).dot(posterior)>height*.06 and (p-hips).dot(up)<height*.15}
    adjacency=[set() for _ in points]
    for edge in obj.data.edges:
        a,b=edge.vertices;adjacency[a].add(b);adjacency[b].add(a)
    # Connect near-coincident shell/seam samples for analysis only. Mesh topology
    # and vertex indices remain unchanged. This prevents two sides of one tube
    # from being mislabeled as separate anatomical tails.
    tree=KDTree(len(points))
    for i,p in enumerate(points):tree.insert(p,i)
    tree.balance()
    for i in candidates:
        for _,j,distance in tree.find_range(points[i],height*.012):
            if j in candidates and j!=i:adjacency[i].add(j);adjacency[j].add(i)
    remaining=set(candidates);components=[]
    while remaining:
        stack=[remaining.pop()];component=set(stack)
        while stack:
            i=stack.pop()
            for j in adjacency[i]:
                if j in remaining:remaining.remove(j);component.add(j);stack.append(j)
        if len(component)>max(30,len(points)*.01) and max(support[i] for i in component)>height*.25:
            components.append(component)
    if len(components)!=1:
        raise RuntimeError('Expected one clear unsupported pelvic tail; found '+str(len(components)))
    core=components[0]
    minimum=min((points[i]-hips).length for i in core)
    roots={i for i in core if (points[i]-hips).length<=minimum+height*.025}
    distances={i:0. for i in roots};queue=[(0.,i) for i in sorted(roots)]
    while queue:
        d,i=heapq.heappop(queue)
        if d>distances[i]:continue
        for j in adjacency[i]&core:
            value=d+(points[i]-points[j]).length
            if value<distances.get(j,math.inf):distances[j]=value;heapq.heappush(queue,(value,j))
    if len(distances)!=len(core):raise RuntimeError('Disconnected tail proposal')
    span=max(distances.values())
    if not height*.35<span<height*2.5:raise RuntimeError('Unsupported tail length/proportion')
    # Cross-section centroids along surface geodesic distance recover a curved
    # centerline rather than projecting a hooked tail onto a straight axis.
    sections=[]
    for fraction in [i/12 for i in range(13)]:
        members=[i for i in core if abs(distances[i]/span-fraction)<.055]
        if not members:raise RuntimeError('Empty tail cross-section')
        sections.append(sum((points[i] for i in members),Vector())/len(members))
    tube=[]
    for index in range(2,len(sections)-2):
        tangent=(sections[index+1]-sections[index-1]).normalized()
        first=tangent.cross(Vector((1,0,0)))
        if first.length<.1:first=tangent.cross(Vector((0,0,1)))
        first.normalize();second=tangent.cross(first).normalized()
        members=[i for i in core if abs(distances[i]/span-index/12)<.055]
        samples=[((points[i]-sections[index]).dot(first),(points[i]-sections[index]).dot(second)) for i in members]
        radii=sorted(math.hypot(a,b) for a,b in samples)
        radius=radii[int((len(radii)-1)*.95)]/height
        aa=sum(a*a for a,b in samples)/len(samples);bb=sum(b*b for a,b in samples)/len(samples)
        ab=sum(a*b for a,b in samples)/len(samples)
        difference=math.sqrt((aa-bb)**2+4*ab*ab)
        ratio=max(0,aa+bb-difference)/max(1e-12,aa+bb+difference)
        if not .002<radius<.065 or ratio<.08:
            raise RuntimeError('Unsupported posterior surface is not a clearly tubular anatomical tail')
        tube.append({'section':index,'radius_to_height':radius,'radial_variance_ratio':ratio})
    root=sections[0]
    if (root-hips).length>height*.30:raise RuntimeError('Unsupported surface is not attached near the pelvis')
    collar={i for i,p in enumerate(points) if (p-root).length<height*.085 and
            (p-hips).dot(posterior)>height*.025}
    return {'profile':PROFILE,'points':points,'core':core,'collar':collar,
            'sections':sections,'height':height,'distances':distances,'span':span,
            'support':support,'root':root,'posterior':posterior,'tube_checks':tube}


def summarize(proposal):
    return {'profile':proposal['profile'],'core_vertices':len(proposal['core']),
            'collar_vertices':len(proposal['collar']),'height':proposal['height'],
            'surface_span':proposal['span'],'sections':[list(p) for p in proposal['sections']],
            'section_space':'pre-alignment armature rest coordinates','tube_checks':proposal['tube_checks'],
            'publication_eligible':False,'limits':'Single clear pelvic tail only; proposed coverage requires pose review'}


def repair_tail(obj,rig,spec):
    import bpy
    if spec!={'kind':'tail','count':1,'attachment':'pelvis'}:
        raise RuntimeError('Only explicitly declared single pelvic tail anatomy is supported')
    if any(b.name.split(':')[-1].lower().startswith(('tail','anatomicaltail')) or b.get('anatomicalAppendage') for b in rig.data.bones):
        raise RuntimeError('Existing appendage rig requires its own reviewed mapping; automatic replacement refused')
    proposal=propose_tail(obj,rig)
    sections=proposal['sections'];names=['AnatomicalTail_'+str(i).zfill(2) for i in range(len(sections)-1)]
    rest={b.name:b.matrix_local.copy() for b in rig.data.bones}
    geometry=[tuple(v.co) for v in obj.data.vertices]
    touched=proposal['core']|proposal['collar']
    original={v.index:{obj.vertex_groups[g.group].name:g.weight for g in v.groups} for v in obj.data.vertices}
    bpy.context.view_layer.objects.active=rig;rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for index,name in enumerate(names):
        bone=rig.data.edit_bones.new(name);bone.head=sections[index];bone.tail=sections[index+1]
        if bone.length<proposal['height']*.005:raise RuntimeError('Collapsed tail centerline segment')
        bone.parent=rig.data.edit_bones[names[index-1] if index else 'Hips']
        bone.use_connect=index>0
    bpy.ops.object.mode_set(mode='OBJECT')
    for name in names:
        rig.data.bones[name]['anatomicalAppendage']='tail'
    for i in touched:
        if i in proposal['core']:
            position=proposal['distances'][i]/proposal['span']*(len(names)-1)
            left=min(len(names)-1,int(position));right=min(len(names)-1,left+1);fraction=position-left
            weights={names[left]:1-fraction}
            weights[names[right]]=weights.get(names[right],0)+fraction
        else:
            distance=(proposal['points'][i]-proposal['root']).length/proposal['height']
            blend=max(0,min(1,(.085-distance)/.04));blend=blend*blend*(3-2*blend)
            weights={name:value*(1-blend) for name,value in original[i].items()}
            weights['Hips']=weights.get('Hips',0)+blend
        weights=dict(sorted(((name,value) for name,value in weights.items() if value>1e-6),key=lambda p:(-p[1],p[0]))[:4])
        total=sum(weights.values())
        if not total:raise RuntimeError('Tail repair would unweight a vertex')
        for group in obj.vertex_groups:group.remove([i])
        for name,value in weights.items():
            group=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
            group.add([i],value/total,'REPLACE')
    bpy.context.view_layer.update()
    if geometry!=[tuple(v.co) for v in obj.data.vertices]:raise RuntimeError('Tail repair moved rest geometry')
    if any(max(abs(matrix[i][j]-rig.data.bones[name].matrix_local[i][j]) for i in range(4) for j in range(4))>1e-6 for name,matrix in rest.items()):
        raise RuntimeError('Tail repair changed existing bind matrices')
    after={v.index:{obj.vertex_groups[g.group].name:g.weight for g in v.groups} for v in obj.data.vertices}
    if any(original[i]!=after[i] for i in original if i not in touched):raise RuntimeError('Tail repair changed unrelated body weights')
    return {**summarize(proposal),'bones':names,'parent':'Hips','vertices_changed':sum(original[i]!=after[i] for i in touched),
            'rest_geometry_preserved':True,'existing_rest_matrices_preserved':True,'unrelated_weights_preserved':True,
            'input_weight_sha256':hashlib.sha256(json.dumps(original,sort_keys=True).encode()).hexdigest(),
            'output_weight_sha256':hashlib.sha256(json.dumps(after,sort_keys=True).encode()).hexdigest(),
            'motion':'Articulated rest chain follows pelvis; no authored tail gesture or cosmetic sway'}
