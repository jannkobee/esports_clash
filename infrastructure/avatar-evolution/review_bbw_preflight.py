"""Read-only geometry admission for a volume BBW trial on the actual generated avatar."""
import hashlib,json,os,sys,importlib.metadata
from pathlib import Path
from collections import Counter
import numpy as np
from scipy.spatial import cKDTree
from review_generated_rig import load,surface
from bbw_solver import smoke_test

def inspect(path):
    import igl
    rigs,meshes=load(path);points,faces,_=surface(meshes)
    v=np.array(points,dtype=np.float64);f=np.array(faces,dtype=np.int64)
    # Use actual distance rather than decimal rounding for a volume diagnostic.
    tolerance=1e-7;parent=np.arange(len(v))
    def find(i):
        while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
        return i
    for a,b in cKDTree(v).query_pairs(tolerance):
        a,b=find(a),find(b)
        if a!=b:parent[max(a,b)]=min(a,b)
    _,indices,inverse=np.unique([find(i) for i in range(len(v))],return_index=True,return_inverse=True)
    wv=v[indices];wf=inverse[f]
    edges=Counter(tuple(sorted((int(tri[i]),int(tri[(i+1)%3])))) for tri in wf for i in range(3))
    boundary=[e for e,n in edges.items() if n==1];over=[e for e,n in edges.items() if n>2]
    degenerate=sum(len(set(tri))<3 for tri in wf)
    duplicate=sum(n-1 for n in Counter(tuple(sorted(tri)) for tri in wf).values())
    manifold=bool(igl.is_edge_manifold(wf)[0]);vertex_manifold=bool(np.all(igl.is_vertex_manifold(wf)))
    reasons=[]
    if boundary:reasons.append('open_surface')
    if over or not manifold or not vertex_manifold:reasons.append('nonmanifold_surface')
    if duplicate or degenerate:reasons.append('duplicate_or_degenerate_faces')
    # Necessary checks only. A pass still requires oriented volume and intersection validation.
    return {'imported_vertices':len(v),'geometric_vertices':len(wv),'triangles':len(f),
        'weld_tolerance_world':tolerance,'boundary_edges':len(boundary),'overincident_edges':len(over),
        'edge_manifold':manifold,'vertex_manifold':vertex_manifold,'degenerate_faces':degenerate,'duplicate_faces':duplicate,
        'blockers':reasons,'sample_problem_edges':[[wv[a].tolist(),wv[b].tolist()] for a,b in (boundary+over)[:30]],
        'volume_admission_complete':False}

def main():
    root=Path(sys.argv[1]).resolve()
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab required')
    plan=json.loads((root/'plan.json').read_text())
    for n,h in plan['files'].items():
        if hashlib.sha256((root/n).read_bytes()).hexdigest()!=h:raise ValueError('Frozen input mismatch: '+n)
    report={'id':plan['id'],'method':'libigl-volume-bbw-admission-v1','compute':'google',
        'publication_eligible':False,'qualification_complete':False,'candidate_available':False,
        'source_sha256':plan['files']['source.glb'],'rig_sha256':plan['files']['raw.glb'],'plan':plan,
        'libigl_version':importlib.metadata.version('libigl')}
    try:
        report['solver_check']=smoke_test()
        report['geometry']={label:inspect(root/(label+'.glb')) for label in ('source','raw')}
        report['status']='blocked_geometry' if any(x['blockers'] for x in report['geometry'].values()) else 'volume_validation_required'
        report['next_requirement']='A separately versioned, validated closed volume domain and anatomical bone constraints are required before the avatar solve. The visible body and skeleton must remain fixed; no automatic hole filling or tetrahedralization was applied.'
    except Exception as e:
        report.update(status='failed',error=f'{type(e).__name__}: {e}');raise
    finally:(root/'report.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({'id':report['id'],'status':report['status']}))

if __name__=='__main__':main()
