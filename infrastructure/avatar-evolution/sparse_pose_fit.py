"""Nonnegative, sum-one fitting with at most four influences; no mass truncation."""
import itertools
import numpy as np

def fit_four(features,targets,prior,height):
    """Greedy support selection, exact active-subset simplex solves at each step.

    features: N x D x C, targets: N x D, prior: N x C. This searches a bounded
    candidate pool; it is not a globally optimal cardinality-constrained solver.
    """
    n,d,c=features.shape
    if c<4 or c>12 or prior.shape!=(n,c) or targets.shape!=(n,d):raise ValueError('Invalid fit dimensions')
    gram=np.einsum('ndc,ndk->nck',features,features)/d
    rhs=np.einsum('ndc,nd->nc',features,targets)/d
    ridge=(height*1e-5)**2
    rows=np.arange(n)[:,None,None,None];selected=np.empty((n,0),dtype=int);final=None
    for k in range(1,5):
        trial=np.concatenate((np.broadcast_to(selected[:,None,:],(n,c,k-1)),np.broadcast_to(np.arange(c)[None,:,None],(n,c,1))),axis=2)
        best_cost=np.full((n,c),np.inf);best_weights=np.zeros((n,c,k))
        for count in range(1,k+1):
            for active in itertools.combinations(range(k),count):
                ids=trial[:,:,active];g=gram[rows,ids[:,:,:,None],ids[:,:,None,:]]
                h=rhs[np.arange(n)[:,None,None],ids]+ridge*prior[np.arange(n)[:,None,None],ids]
                a=np.zeros((n,c,count+1,count+1));a[:,:,:count,:count]=g+ridge*np.eye(count)
                a[:,:,:count,count]=1;a[:,:,count,:count]=1
                b=np.concatenate((h,np.ones((n,c,1))),axis=2)
                solution=np.linalg.solve(a,b)[:,:,:count]
                feasible=np.all(solution>=-1e-9,axis=2)
                cost=np.einsum('nci,ncij,ncj->nc',solution,g,solution)-2*np.einsum('nci,nci->nc',solution,h)+ridge*np.sum(solution**2,axis=2)
                improve=feasible&(cost<best_cost);best_cost[improve]=cost[improve]
                weights=np.zeros((n,c,k));weights[:,:,active]=solution
                best_weights[improve]=weights[improve]
        for j in range(k-1):best_cost[np.arange(n),selected[:,j]]=np.inf
        winner=np.argmin(best_cost,axis=1)
        if not np.isfinite(best_cost[np.arange(n),winner]).all():raise RuntimeError('No feasible sparse fit')
        selected=trial[np.arange(n),winner];final=best_weights[np.arange(n),winner]
    result=np.zeros((n,c));result[np.arange(n)[:,None],selected]=np.clip(final,0,None)
    result/=result.sum(axis=1,keepdims=True)
    if np.any(np.count_nonzero(result>1e-8,axis=1)>4) or not np.isfinite(result).all():raise RuntimeError('Invalid sparse fit')
    return result
