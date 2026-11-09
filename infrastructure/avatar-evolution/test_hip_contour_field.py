"""Colab-only numerical regression checks, not visual qualification."""
import os,unittest
import numpy as np
from hip_contour_field import fair_patch,blend

class ContourTests(unittest.TestCase):
 def setUp(self):
  if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
 def fixture(self):
  u,v=np.meshgrid(np.linspace(-.2,0,31),np.linspace(-.16,.16,39),indexing='ij')
  points=np.c_[u.ravel(),np.full(u.size,-.05),v.ravel()];edges=[]
  for i in range(31):
   for j in range(39):
    n=i*39+j
    if i<30:edges.append((n,n+39))
    if j<38:edges.append((n,n+1))
  return points,np.array(edges),np.array([-.1,0,0])
 def test_crease_reduction_preserves_fixed_surroundings(self):
  points,edges,center=self.fixture();posed=points.copy()
  posed[:,1]-=.01*np.exp(-((points[:,0]+.1)/.02)**2-(points[:,2]/.02)**2)
  d,active,proof=fair_patch(points,posed,edges,center,1.)
  self.assertTrue(np.array_equal(d[~active],np.zeros_like(d[~active])))
  self.assertLess(abs((posed+d)[:,1]+.05).max(),abs(posed[:,1]+.05).max())
  self.assertLess(proof['energy_after'],proof['energy_before'])
 def test_coincident_seam_receives_identical_correction(self):
  points,edges,center=self.fixture();n=15*39+19
  points=np.vstack([points,points[n]]);edges=np.vstack([edges,[[len(points)-1,n-1],[len(points)-1,n+1]]])
  posed=points.copy();posed[[n,-1],1]-=.01
  d,_,_=fair_patch(points,posed,edges,center,1.)
  self.assertTrue(np.array_equal(d[n],d[-1]))
 def test_targets_interpolate_without_rest_offset_or_knot_jump(self):
  self.assertEqual(blend(0),(0.,0.));self.assertEqual(blend(45),(1.,0.));self.assertEqual(blend(90),(0.,1.))
  self.assertLess(np.linalg.norm(np.array(blend(45-1e-4))-blend(45+1e-4)),1e-8)
 def test_upper_pelvis_landmark_is_fixed(self):
  points,edges,center=self.fixture();posed=points.copy();posed[:,1]-=.01*np.exp(-(points[:,2]/.06)**2)
  d,_,proof=fair_patch(points,posed,edges,center,1.)
  self.assertTrue(np.array_equal(d[points[:,2]>=.03],np.zeros_like(d[points[:,2]>=.03])))
  self.assertEqual(proof['protected_upper_max_delta'],0.)

if __name__=='__main__':unittest.main()
