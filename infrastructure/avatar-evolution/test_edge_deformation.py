import unittest
from asset_pipeline.edge_deformation import edge_deformation


class EdgeDeformation(unittest.TestCase):
    def test_rigid_motion_passes(self):
        rest=[(0,0,0),(.1,0,0),(0,0,1)]
        posed=[(x+2,y-1,z+3) for x,y,z in rest]
        self.assertTrue(edge_deformation(rest,posed,[(0,1,2)])['passed'])

    def test_gross_stretch_fails_and_is_order_invariant(self):
        rest=[(0,0,0),(.1,0,0),(0,0,1)]
        posed=[(0,0,0),(1,0,0),(0,0,1)]
        result=edge_deformation(rest,posed,[(0,1,2)])
        self.assertFalse(result['passed'])
        self.assertEqual(result,edge_deformation(rest,posed,[(2,1,0)]))
        self.assertEqual(result,edge_deformation([rest[2],rest[0],rest[1]],
            [posed[2],posed[0],posed[1]],[(1,2,0)]))

    def test_seam_copies_do_not_hide_or_multiply_failures(self):
        rest=[(0,0,0),(.1,0,0),(0,0,1)]
        posed=[(0,0,0),(1,0,0),(0,0,1)]
        original=edge_deformation(rest,posed,[(0,1,2)])
        self.assertEqual(original,edge_deformation(rest+rest,posed+posed,[(0,1,2),(3,4,5)]))

    def test_nonfinite_surface_fails(self):
        self.assertFalse(edge_deformation([(0,0,0),(0,0,1)],
            [(float('nan'),0,0),(0,0,1)],[(0,1)])['passed'])

if __name__=='__main__':unittest.main()
