"""Pinned libigl BBW kernel. Only callable in the authorized Colab environment."""
import os
import importlib.metadata
import numpy as np

LIBIGL_VERSION = '2.6.3'

def solve_volume_weights(vertices, tetrahedra, constrained_indices, constrained_weights):
    if not os.environ.get('COLAB_RELEASE_TAG'):
        raise RuntimeError('Google Colab is required for skin-weight processing')
    if importlib.metadata.version('libigl') != LIBIGL_VERSION:
        raise RuntimeError('Unexpected libigl version')
    import igl
    v=np.ascontiguousarray(vertices,dtype=np.float64)
    t=np.ascontiguousarray(tetrahedra,dtype=np.int64)
    b=np.ascontiguousarray(constrained_indices,dtype=np.int64)
    bc=np.ascontiguousarray(constrained_weights,dtype=np.float64)
    if v.ndim!=2 or v.shape[1]!=3 or t.ndim!=2 or t.shape[1]!=4 or b.ndim!=1 or bc.ndim!=2:
        raise ValueError('Expected a 3D tetrahedral domain and explicit bone boundary conditions')
    if len(v)>100000 or len(t)>500000 or bc.shape!=(len(b),bc.shape[1]) or bc.shape[1]<2 or bc.shape[1]>64:
        raise ValueError('Domain exceeds the bounded solver contract')
    if len(b)<2 or len(set(b.tolist()))!=len(b) or t.size==0 or min(t.min(),b.min())<0 or max(t.max(),b.max())>=len(v):
        raise ValueError('Invalid domain or boundary indices')
    if not np.isfinite(v).all() or not np.isfinite(bc).all() or bc.min()<0 or bc.max()>1 or not np.allclose(bc.sum(axis=1),1):
        raise ValueError('Invalid boundary weights')
    volume=np.linalg.det(v[t[:,1:]]-v[t[:,0,None]])/6
    if np.any(volume<=1e-14):
        raise ValueError('Tetrahedra must have positive, nondegenerate volumes')
    w=igl.bbw(v,t,b,bc,max_iter=100)
    if w.shape!=(len(v),bc.shape[1]) or not np.isfinite(w).all() or w.min()<-1e-7 or w.max()>1+1e-7:
        raise RuntimeError('BBW returned invalid weights')
    w=np.clip(w,0,1);s=w.sum(axis=1)
    if np.any(s<1e-12):raise RuntimeError('BBW left unweighted vertices')
    w/=s[:,None]
    if not np.allclose(w[b],bc,atol=1e-5):raise RuntimeError('Boundary constraints were not reproduced')
    return w

def smoke_test():
    v=np.array([[0,0,0],[1,0,0],[0,1,0],[0,0,1],[.25,.25,.25]],dtype=float)
    t=np.array([[4,1,2,3],[0,4,2,3],[0,1,4,3],[0,1,2,4]])
    b=np.arange(4);bc=np.column_stack((1-v[:4,0],v[:4,0]))
    w=solve_volume_weights(v,t,b,bc)
    return {'status':'passed','domain':'synthetic tetrahedron with an interior vertex',
        'weights':w.tolist(),'avatar_weighting_complete':False}
