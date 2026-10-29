"""Conservative full-surface stretch gate for rigid-bone humanoid skinning.

Counts geometry edges, independent of triangle order, winding and seam copies.
This detects gross stretching; passing does not establish artistic quality.
"""
import math

POLICY = 'deformation-edge-stretch-v1'


def edge_deformation(rest, posed, faces):
    if len(rest) != len(posed) or not rest:
        raise ValueError('Corresponding nonempty rest and posed surfaces required')
    finite = all(math.isfinite(c) for p in [*rest, *posed] for c in p)
    if not finite:
        return {'policy': POLICY, 'passed': False, 'finite': False}
    height = max(p[2] for p in rest) - min(p[2] for p in rest)
    if height <= 1e-8:
        raise ValueError('Humanoid surface has no vertical extent')
    def distance(a,b):return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))
    def key(p):return tuple(round(float(c),6) for c in p)
    edges = {}
    for face in faces:
        for a,b in zip(face, (*face[1:],face[0])):
            identity=tuple(sorted((key(rest[a]),key(rest[b]))))
            before=distance(rest[a],rest[b]);after=distance(posed[a],posed[b])
            # Keep the worst posed seam copy; do not let export order hide it.
            previous=edges.get(identity)
            if previous is None or after>previous[1]:edges[identity]=(before,after)
    severe=0;maximum=1.;extension=0.
    for before,after in edges.values():
        if before<=height*1e-6:continue
        ratio=after/before
        maximum=max(maximum,ratio);extension=max(extension,(after-before)/height)
        if ratio>4 and after-before>height*.05:severe+=1
    return {'policy':POLICY, 'passed':severe==0, 'finite':True,
            'edges_checked':len(edges), 'severely_stretched_edges':severe,
            'maximum_length_ratio':maximum, 'largest_extension_to_height':extension,
            'limits':{'length_ratio':4,'extension_to_height':.05},
            'scope':'Gross stretch only; collision, appendage coverage and visual review remain separate'}
