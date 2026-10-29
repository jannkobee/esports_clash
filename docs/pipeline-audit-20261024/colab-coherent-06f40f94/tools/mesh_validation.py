"""Full-surface collision measurement, independent of export face/vertex order.
Rest-coordinate adjacency recognizes UV/normal splits without welding posed
contacts between unrelated parts. Counts are technical evidence, not art scores.
"""
from collections import Counter
from mathutils.bvhtree import BVHTree
POLICY='full-surface-rest-seams-v2'
MAX_FACES=50000

def rest_keys(points):
    return [tuple(round(float(c),6) for c in point) for point in points]

def collision_summary(points,faces,keys,regions=None):
    if len(faces)>MAX_FACES:raise RuntimeError('Full-mesh collision budget exceeded; qualification is inconclusive, not passed.')
    order=sorted(range(len(faces)),key=lambda i:tuple(sorted(keys[n] for n in faces[i])))
    faces=[tuple(sorted(faces[i],key=lambda n:keys[n])) for i in order]
    if regions:regions=[regions[i] for i in order]
    adjacent=[set(keys[i] for i in face) for face in faces]
    tree=BVHTree.FromPolygons(points,faces,all_triangles=True)
    reverse=BVHTree.FromPolygons(points,[tuple(reversed(f)) for f in faces],all_triangles=True)
    shifted=BVHTree.FromPolygons(points,[(f[1],f[2],f[0]) for f in faces],all_triangles=True)
    # BVH triangle contact edge cases can depend on winding and middle vertex.
    # Canonicalize faces, query cyclic orientations, and deduplicate pairs.
    pairs=set()
    for left,right in [(tree,tree),(reverse,reverse),(shifted,shifted),(tree,reverse),(tree,shifted)]:
        overlap=left.overlap(right)
        if len(overlap)>1000000:raise RuntimeError('Collision density exceeds bounded review budget; qualification is inconclusive.')
        for a,b in overlap:
            if a!=b:pairs.add((min(a,b),max(a,b)))
    count=0;groups=Counter()
    for a,b in pairs:
        if a>=b or adjacent[a].intersection(adjacent[b]):continue
        count+=1
        if regions:groups[tuple(sorted((regions[a],regions[b])))]+=1
    return {'finite':True,'self_intersections':count,'triangles_checked':len(faces),'top_regions':[{'regions':list(k),'intersections':v} for k,v in sorted(groups.items(),key=lambda item:(-item[1],item[0]))[:12]]}
