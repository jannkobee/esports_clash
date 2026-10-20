"""Conservative rigid skin repair for disconnected hand-held equipment only.
Never infer rigidity for a connected body/garment region from color or a name.
"""
from collections import defaultdict,Counter

def rigid_equipment(obj,bone_names,repairs,rig=None):
    parent=list(range(len(obj.data.vertices)))
    def find(i):
        while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
        return i
    def union(a,b):
        a,b=find(a),find(b)
        if a!=b:parent[b]=a
    points={}
    for v in obj.data.vertices:
        key=tuple(round(float(c),6) for c in v.co)
        if key in points:union(v.index,points[key])
        else:points[key]=v.index
    for e in obj.data.edges:union(*e.vertices)
    components=defaultdict(list)
    for v in obj.data.vertices:components[find(v.index)].append(v)
    decisions=[]
    for repair in repairs:
        bone=repair['bone'];side=repair['new_parent'][-1]
        allowed={bone,'Hand'+side,'Forearm'+side,'UpperArm'+side}
        for vertices in components.values():
            if not 32<=len(vertices)<=len(obj.data.vertices)*.2:continue
            mass=Counter()
            for vertex in vertices:
                for g in vertex.groups:
                    name=obj.vertex_groups[g.group].name
                    if name in bone_names:mass[name]+=g.weight
            total=sum(mass.values())
            chain_fraction=sum(mass[n] for n in allowed)/total if total else 0
            side_fraction=None
            if rig:
                center=(rig.matrix_world@rig.data.bones['Hips'].head_local).x
                hand=(rig.matrix_world@rig.data.bones[repair['new_parent']].head_local).x
                sign=1 if hand>center else -1
                side_fraction=sum((obj.matrix_world@v.co).x*sign>center*sign for v in vertices)/len(vertices)
            # Some equipment has erroneous body weights: require independent
            # geometric side evidence before allowing up to15% foreign mass.
            threshold=.85 if side_fraction is not None and side_fraction>=.95 else .95
            if total<=0 or mass[bone]/total<.5 or chain_fraction<threshold:continue
            group=obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
            indices=[v.index for v in vertices]
            for other in obj.vertex_groups:
                if other.name in bone_names:other.remove(indices)
            group.add(indices,1,'REPLACE')
            decisions.append({'bone':bone,'vertices':len(indices),'attachment_weight_fraction_before':mass[bone]/total,'hand_chain_fraction_before':sum(mass[n] for n in allowed)/total,'geometric_side_fraction':side_fraction,'method':'disconnected-equipment-rigid-skin-v1','weights_after':{bone:1}})
    return decisions


def secondary_chains(rig,mapped_bones,equipment_repairs=()):
    """Find side branches, never the spine/limb path or held equipment.

    Generic UniRig names carry no semantics: only multi-joint branches from the
    head or torso qualify automatically. Other extra bones retain skin but do
    not receive a procedural controller.
    """
    mapped=set(mapped_bones)
    equipment={r['bone'] for r in equipment_repairs}
    result={}
    def contains_anatomy(bone):
        return bone.name in mapped or any(contains_anatomy(c) for c in bone.children)
    def visit(bone,kind,depth):
        if bone.name in equipment or contains_anatomy(bone):return
        result[bone.name]={'kind':kind,'depth':depth}
        for child in bone.children:visit(child,kind,depth+1)
    for bone in rig.data.bones:
        if bone.name in mapped or not bone.parent or bone.parent.name not in {'Head','Root','Hips','Spine','Chest'}:
            continue
        if not bone.children or contains_anatomy(bone):continue
        visit(bone,'hair' if bone.parent.name=='Head' else 'coat',0)
    return result

def regularize_skin_weights(obj,rig,mapped_bones,equipment_repairs=()):
    """Preserve secondary skin influences and regularize
    connected single-mesh skin weights using topological surface-graph Laplacian smoothing.
    Preserves 100% anatomical limb mobility without cross-boundary Euclidean bleeding.
    Rigid equipment components remain 100% bound to their equipment bone.
    """
    if not rig or not obj.data.vertices:
        return None
    mapped_set=set(mapped_bones)
    equip_bones={r['bone'] for r in equipment_repairs}
    # Extra bones carry actual hair, garment, finger and toe influences. Keeping
    # their weights is necessary for later secondary articulation.
    keep_bones=set(rig.data.bones.keys())
    bones=rig.data.bones
    # Map unmapped bones (clavicles, fingers, toes, hair/cape helpers) to anatomical targets
    clavicle_map={}
    for side in ('L','R'):
        ua=bones.get('UpperArm'+side)
        if ua and ua.parent and ua.parent.name not in mapped_set|equip_bones and ua.parent.parent and ua.parent.parent.name=='Chest':
            clavicle_map[ua.parent.name]='UpperArm'+side
    remap={}
    bone_items = bones.values() if hasattr(bones, 'values') else bones
    for b in bone_items:
        b_name = b.name if hasattr(b, 'name') else str(b)
        b_obj = b if hasattr(b, 'parent') else (bones.get(b_name) if hasattr(bones, 'get') else None)
        if b_name in clavicle_map:
            remap[b_name]=clavicle_map[b_name]
        elif b_name in keep_bones:
            remap[b_name]=b_name
        else:
            curr=b_obj.parent if b_obj else None
            while curr and curr.name not in keep_bones:
                curr=curr.parent
            remap[b_name]=curr.name if curr else 'Root'
    vg_names={g.index:g.name for g in obj.vertex_groups}
    equip_group_ids={obj.vertex_groups.get(b).index for b in equip_bones if obj.vertex_groups.get(b) is not None}
    rigid_verts=set()
    raw_weights=[]
    for v in obj.data.vertices:
        if any(g.group in equip_group_ids and g.weight>.99 for g in v.groups):
            rigid_verts.add(v.index)
            raw_weights.append({vg_names[g.group]:g.weight for g in v.groups if g.group in equip_group_ids})
            continue
        w=defaultdict(float)
        for g in v.groups:
            if g.weight>1e-5 and g.group in vg_names:
                t=remap.get(vg_names[g.group])
                if t:w[t]+=g.weight
        tot=sum(w.values())
        if tot>0:
            for k in list(w.keys()):w[k]/=tot
        else:
            w['Hips']=1.0
        raw_weights.append(dict(w))

    # Build 1-ring topological adjacency from mesh edges:
    # Edges only exist across solid polygons along the surface.
    # Smoothing along edges can NEVER cross empty air between arms and torso or between the legs.
    adj=defaultdict(list)
    for e in obj.data.edges:
        adj[e.vertices[0]].append(e.vertices[1])
        adj[e.vertices[1]].append(e.vertices[0])

    # Topological Laplacian smoothing (2 iterations, conservative alpha 0.25)
    current_weights=[dict(w) for w in raw_weights]
    for _ in range(2):
        next_weights=[]
        for i,w in enumerate(current_weights):
            if i in rigid_verts:
                next_weights.append(w)
                continue
            neighbors=adj.get(i)
            if not neighbors:
                next_weights.append(w)
                continue
            # Accumulate neighbor weights along surface graph
            avg_w=defaultdict(float)
            for n in neighbors:
                for bone,wt in current_weights[n].items():
                    avg_w[bone]+=wt
            inv_len=1.0/len(neighbors)
            alpha=0.25
            blended=defaultdict(float)
            for bone,wt in w.items():
                blended[bone]+=(1.0-alpha)*wt
            for bone,tot_wt in avg_w.items():
                blended[bone]+=alpha*(tot_wt*inv_len)
            next_weights.append(dict(blended))
        current_weights=next_weights

    # Normalize to top 4 bone influences with 1.0 total sum (GPU skinning standard)
    final_weights=[]
    for i,w in enumerate(current_weights):
        if i in rigid_verts:
            final_weights.append(raw_weights[i])
            continue
        top=[(k,val) for k,val in sorted(w.items(),key=lambda x:-x[1])[:4] if val>1e-5]
        tot=sum(val for _,val in top)
        if tot>0:
            norm=[(k,round(val/tot,3)) for k,val in top if val/tot>=.005]
            if not norm:
                norm=[('Hips',1.0)]
            else:
                diff=round(1.0-sum(v for _,v in norm),3)
                norm[0]=(norm[0][0],round(norm[0][1]+diff,3))
            final_weights.append(dict(norm))
        else:
            final_weights.append({'Hips':1.0})

    # Clear previous vertex group assignments and batch assign regularized weights
    all_idx=list(range(len(obj.data.vertices)))
    for vg in obj.vertex_groups:
        vg.remove(all_idx)
    buckets=defaultdict(lambda:defaultdict(list))
    for i,w in enumerate(final_weights):
        for k,val in w.items():
            q=round(val,3)
            if q>0:buckets[k][q].append(i)
    for k,qmap in buckets.items():
        vg=obj.vertex_groups.get(k) or obj.vertex_groups.new(name=k)
        for q,indices in qmap.items():
            vg.add(indices,q,'REPLACE')
    return {'method':'topological-laplacian-secondary-preserved-v3','vertices_regularized':len(obj.data.vertices)-len(rigid_verts),'rigid_equipment_vertices_preserved':len(rigid_verts),'unmapped_bones_consolidated':len(clavicle_map),'extra_bones_preserved':len(keep_bones-mapped_set-equip_bones-set(clavicle_map))}

