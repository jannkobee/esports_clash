"""Version/byte rejection checks for review control metadata, without local 3D processing."""
import copy
import hashlib
from pathlib import Path
import tempfile
import unittest

from candidate_visual_contract import validate_diagnostic_sources


class CandidateVisualContractTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'site').mkdir()
        self.plan = {'id': 'review-current', 'mode': 'full-body', 'candidates': {}, 'files': {}}
        self.exported = {'id': 'review-current', 'assets': []}
        for label in ('parent', 'current'):
            source = ('glTF-source-' + label).encode()
            stress = ('glTF-diagnostic-' + label).encode()
            (self.root / 'site' / (label + '.glb')).write_bytes(source)
            (self.root / 'site' / (label + '-stress.glb')).write_bytes(stress)
            sha = hashlib.sha256(source).hexdigest()
            self.plan['candidates'][label] = {'artifact_sha256': sha}
            self.plan['files']['site/' + label + '.glb'] = sha
            self.exported['assets'].append({'label': label, 'source_sha256': sha,
                'stress_sha256': hashlib.sha256(stress).hexdigest(), 'baseline_reproduced': True})

    def test_exact_full_review_is_accepted(self):
        validate_diagnostic_sources(self.root, self.plan, self.exported)

    def test_previous_candidates_clips_cannot_be_relabelled_as_a_new_candidate(self):
        plan = copy.deepcopy(self.plan)
        plan['candidates']['current']['artifact_sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            validate_diagnostic_sources(self.root, plan, self.exported)

    def test_source_or_clip_byte_corruption_is_rejected(self):
        for suffix in ('.glb', '-stress.glb'):
            with self.subTest(suffix=suffix):
                path = self.root / 'site' / ('current' + suffix)
                original = path.read_bytes()
                path.write_bytes(b'wrong artifact')
                with self.assertRaises(ValueError):
                    validate_diagnostic_sources(self.root, self.plan, self.exported)
                path.write_bytes(original)

    def test_wrong_review_or_missing_candidate_is_rejected(self):
        for update in ({'id': 'different-review'}, {'assets': self.exported['assets'][:1]}):
            with self.subTest(update=update):
                with self.assertRaises(ValueError):
                    validate_diagnostic_sources(self.root, self.plan, {**self.exported, **update})

    def test_detail_review_requires_its_explicit_parent_review(self):
        plan = {**self.plan, 'id': 'detail-review', 'mode': 'joint-details', 'parent_visual_review_id': self.exported['id']}
        validate_diagnostic_sources(self.root, plan, self.exported)
        plan['parent_visual_review_id'] = 'wrong-parent'
        with self.assertRaises(ValueError):
            validate_diagnostic_sources(self.root, plan, self.exported)

    def test_failed_baseline_cannot_be_used_for_visual_comparison(self):
        exported = copy.deepcopy(self.exported)
        exported['assets'][0]['baseline_reproduced'] = False
        with self.assertRaises(ValueError):
            validate_diagnostic_sources(self.root, self.plan, exported)


if __name__ == '__main__':
    unittest.main()
