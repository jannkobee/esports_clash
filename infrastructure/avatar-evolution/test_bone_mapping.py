import copy
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import unittest
from bone_mapping import infer_humanoid


def _find_fixture(filename):
    candidates = [
        Path('/tmp') / filename,
        Path('docs') / filename,
        Path(__file__).resolve().parent / filename,
    ]
    if len(Path(__file__).resolve().parents) > 2:
        candidates.append(Path(__file__).resolve().parents[2] / 'docs' / filename)
    fixture = next((p for p in candidates if p.exists()), None)
    if not fixture:
        raise FileNotFoundError(f'Could not locate {filename}')
    return fixture

class PelvisRootMappingTest(unittest.TestCase):
    def setUp(self):
        fixture = _find_fixture('dawnna-mapping-rig-evidence.json')
        self.bones=json.loads(fixture.read_text())['bones']
        self.anatomy={'Hips':'bone_0','Spine':'bone_1','Chest':'bone_3','Head':'bone_5',
            'UpperArmL':'bone_26','ForearmL':'bone_27','HandL':'bone_28',
            'UpperArmR':'bone_7','ForearmR':'bone_8','HandR':'bone_9',
            'ThighL':'bone_48','CalfL':'bone_49','FootL':'bone_50',
            'ThighR':'bone_44','CalfR':'bone_45','FootR':'bone_46'}

    def test_actual_pelvis_root_clavicles_and_fingers(self):
        mapping,review=infer_humanoid(self.bones)
        self.assertTrue(review['accepted'])
        self.assertEqual({k:v for k,v in mapping.items() if k!='Root'},self.anatomy)
        self.assertEqual(review['root_adapter'],{'name':mapping['Root'],'pelvis':'bone_0','native':'Root','use_deform':False})
        self.assertEqual(len(set(mapping.values())),17)
        self.assertNotIn(mapping['Root'],[b['name'] for b in self.bones])

    def test_separate_root_still_maps_without_adapter(self):
        self.bones[0]['parent']='existing_control'
        self.bones.append({'name':'existing_control','parent':None,'position':self.bones[0]['position'][:]})
        mapping,review=infer_humanoid(self.bones)
        self.assertEqual(mapping,{'Root':'existing_control',**self.anatomy})
        self.assertNotIn('root_adapter',review)

    def test_saved_legacy_30_joint_skeleton_uses_native_sides_and_keeps_warning(self):
        fixture = _find_fixture('dawnna-legacy-root-skeleton.json')
        legacy=json.loads(fixture.read_text())
        mapping,review=infer_humanoid(legacy['bones'])
        # The archived fixture records the former screen-left labels. Preserve
        # its evidence and compare using the native donor's anatomical convention.
        expected={name[:-1]+('R' if name[-1]=='L' else 'L') if name.endswith(('L','R')) else name:value for name,value in legacy['expected_map'].items()}
        self.assertEqual(mapping,expected)
        self.assertEqual(review['warnings'],legacy['expected_warnings'])
        self.assertNotIn('root_adapter',review)

    def test_side_labels_match_native_forward_minus_y_convention(self):
        mapping,review=infer_humanoid(self.bones)
        points={bone['name']:bone['position'] for bone in self.bones}
        center=points[mapping['Hips']][0]
        for joint in ['UpperArm','Forearm','Hand','Thigh','Calf','Foot']:
            self.assertLess(points[mapping[joint+'L']][0],center)
            self.assertGreater(points[mapping[joint+'R']][0],center)

    def test_adapter_name_does_not_collide_with_an_existing_bone(self):
        next(b for b in self.bones if b['name']=='bone_15')['name']='avatar_control_root'
        mapping,review=infer_humanoid(self.bones)
        self.assertTrue(review['accepted'])
        self.assertEqual(mapping['Root'],'avatar_control_root_')

    def test_names_and_order_do_not_define_anatomy(self):
        names={b['name']:'joint_'+str(300-i*5) for i,b in enumerate(self.bones)}
        changed=[{'name':names[b['name']],'parent':names.get(b['parent']),'position':b['position']} for b in reversed(self.bones)]
        mapping,review=infer_humanoid(changed)
        self.assertTrue(review['accepted'])
        self.assertEqual({k:v for k,v in mapping.items() if k!='Root'},{k:names[v] for k,v in self.anatomy.items()})

    def test_uniform_scale_and_translation(self):
        changed=copy.deepcopy(self.bones)
        for b in changed:b['position']=[v*100+offset for v,offset in zip(b['position'],[10,20,30])]
        self.assertEqual(infer_humanoid(changed)[0],infer_humanoid(self.bones)[0])

    def test_backwards_facing_is_rejected(self):
        for b in self.bones:b['position'][1]*=-1
        self.assertFalse(infer_humanoid(self.bones)[0])

    def test_missing_toe_is_rejected(self):
        self.bones=[b for b in self.bones if b['name']!='bone_47']
        self.assertFalse(infer_humanoid(self.bones)[0])

    def test_collapsed_leg_is_rejected(self):
        next(b for b in self.bones if b['name']=='bone_45')['position']=next(b for b in self.bones if b['name']=='bone_44')['position'][:]
        self.assertFalse(infer_humanoid(self.bones)[0])

    def test_extra_pelvis_branch_stays_ambiguous(self):
        self.bones.append({'name':'unknown_branch','parent':'bone_0','position':[0,.1,0]})
        mapping,review=infer_humanoid(self.bones)
        self.assertFalse(mapping)
        self.assertNotIn('root_adapter',review)

    def test_ambiguous_head_is_rejected(self):
        self.bones.append({'name':'extra_head','parent':'bone_3','position':[0,0,.32]})
        self.assertFalse(infer_humanoid(self.bones)[0])

    def test_disconnected_cycle_is_rejected(self):
        self.bones.extend([{'name':'cycle_a','parent':'cycle_b','position':[0,0,0]},
            {'name':'cycle_b','parent':'cycle_a','position':[0,0,.1]}])
        self.assertFalse(infer_humanoid(self.bones)[0])

    def test_duplicate_and_nonfinite_joints_are_rejected(self):
        duplicated=self.bones+[copy.deepcopy(self.bones[0])]
        self.assertFalse(infer_humanoid(duplicated)[0])
        self.bones[0]['position'][0]=float('nan')
        self.assertFalse(infer_humanoid(self.bones)[0])


if __name__=='__main__':unittest.main()
