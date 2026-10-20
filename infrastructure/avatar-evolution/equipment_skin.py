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


def regularize_skin_weights(obj,rig,mapped_bones,equipment_repairs=()):
    """Consolidate unmapped helper bones into anatomical ancestors and regularize
    connected single-mesh skin weights with a 3D trilinear spatial weight field.
    Rigid equipment components remain 100% bound to their equipment bone.
    """
    if not rig or not obj.data.vertices:
        return None
    mapped_set=set(mapped_bones)
    equip_bones={r['bone'] for r in equipment_repairs}
    keep_bones=mapped_set|equip_bones
    bones=rig.data.bones
    # Map unmapped bones (clavicles, fingers, toes, hair/cape helpers) to anatomical targets
    clavicle_map={}
    for side in ('L','R'):
        ua=bones.get('UpperArm'+side)
        if ua and ua.parent and ua.parent.name not in keep_bones and ua.parent.parent and ua.parent.parent.name=='Chest':
            clavicle_map[ua.parent.name]='UpperArm'+side
    remap={}
    for b in bones:
        if b.name in keep_bones:
            remap[b.name]=b.name
        elif b.name in clavicle_map:
            remap[b.name]=clavicle_map[b.name]
        else:
            curr=b.parent
            while curr and curr.name not in keep_bones:
                curr=curr.parent
            remap[b.name]=curr.name if curr else 'Root'
    vg_names={g.index:g.name for g in obj.vertex_groups}
    equip_group_ids={obj.vertex_groups[b].index for b in equip_bones if obj.vertex_groups.get(b)}
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
    # Shear damping on distal limb chains to prevent connected single-mesh folds
    shear_damping={
        'FootL':('Hips',.04),'FootR':('Hips',.04),
        'CalfL':('Hips',.05),'CalfR':('Hips',.05),
        'ThighL':('Hips',.10),'ThighR':('Hips',.10),
        'HandL':('Chest',.20),'HandR':('Chest',.20),
        'ForearmL':('Chest',.30),'ForearmR':('Chest',.30),
        'UpperArmL':('Chest',.50),'UpperArmR':('Chest',.50),
        'Spine':('Chest',.60),
    }
    for i,w in enumerate(raw_weights):
        if i in rigid_verts:continue
        nw=defaultdict(float)
        for k,val in w.items():
            if k in shear_damping:
                target_root,retain=shear_damping[k]
                nw[k]+=val*retain
                nw[target_root]+=val*(1.0-retain)
            else:
                nw[k]+=val
        raw_weights[i]=dict(nw)
    # 3D trilinear spatial weight field regularization
    coords=[v.co for v in obj.data.vertices]
    min_z=min(c.z for c in coords);max_z=max(c.z for c in coords)
    cell=max((max_z-min_z)*.035,1e-4);inv_cell=1.0/cell
    grid=defaultdict(lambda:defaultdict(float));grid_count=defaultdict(float)
    for i,c in enumerate(coords):
        if i in rigid_verts:continue
        gx,gy,gz=c.x*inv_cell,c.y*inv_cell,c.z*inv_cell
        ix,iy,iz=int(gx//1),int(gy//1),int(gz//1)
        fx,fy,fz=gx-ix,gy-iy,gz-iz
        w=raw_weights[i]
        for dx,wx in ((0,1.0-fx),(1,fx)):
            for dy,wy in ((0,1.0-fy),(1,fy)):
                for dz,wz in ((0,1.0-fz),(1,fz)):
                    wt=wx*wy*wz
                    if wt<1e-5:continue
                    key=(ix+dx,iy+dy,iz+dz)
                    grid_count[key]+=wt
                    cell_w=grid[key]
                    for k,val in w.items():cell_w[k]+=val*wt
    for key,cnt in grid_count.items():
        if cnt>0:
            cell_w=grid[key]
            for k in list(cell_w.keys()):cell_w[k]/=cnt
    offsets=[(dx,dy,dz,4.0 if dx==0 and dy==0 and dz==0 else 2.0 if abs(dx)+abs(dy)+abs(dz)==1 else 1.0)
             for dx in (-1,0,1) for dy in (-1,0,1) for dz in (-1,0,1)]
    for _ in range(3):
        next_grid={}
        for key in grid:
            kx,ky,kz=key;acc=defaultdict(float);tw=0.0
            for dx,dy,dz,ow in offsets:
                nk=(kx+dx,ky+dy,kz+dz)
                if nk in grid:
                    tw+=ow
                    for k,val in grid[nk].items():acc[k]+=val*ow
            if tw>0:
                for k in list(acc.keys()):acc[k]/=tw
            next_grid[key]=acc
        grid=next_grid
    final_weights=[]
    for i,c in enumerate(coords):
        if i in rigid_verts:
            final_weights.append(raw_weights[i])
            continue
        gx,gy,gz=c.x*inv_cell,c.y*inv_cell,c.z*inv_cell
        ix,iy,iz=int(gx//1),int(gy//1),int(gz//1)
        fx,fy,fz=gx-ix,gy-iy,gz-iz
        vw=defaultdict(float)
        for dx,wx in ((0,1.0-fx),(1,fx)):
            for dy,wy in ((0,1.0-fy),(1,fy)):
                for dz,wz in ((0,1.0-fz),(1,fz)):
                    wt=wx*wy*wz
                    key=(ix+dx,iy+dy,iz+dz)
                    if key in grid:
                        for k,val in grid[key].items():vw[k]+=val*wt
        top=sorted(vw.items(),key=lambda x:-x[1])[:4]
        tot=sum(val for _,val in top)
        if tot>0:
            final_weights.append({k:val/tot for k,val in top if val/tot>=.005})
        else:
            final_weights.append({'Hips':1.0})
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
    return {'method':'trilinear-field-shear-regularized-v1','vertices_regularized':len(coords)-len(rigid_verts),'rigid_equipment_vertices_preserved':len(rigid_verts),'unmapped_bones_consolidated':len(bones)-len(keep_bones)}

