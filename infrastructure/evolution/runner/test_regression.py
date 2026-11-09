import gzip
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from audit import audit
from evidence_io import read_raw, validate_case_allocation
from regression import CONFIG, diagnose, reward_interval
from training import independent_examples


def case(seed, **changes):
    return {'seed': seed, 'status': 'valid', 'split': 'heldout', 'swapped': seed % 2 == 0,
            'changed': False, 'rewardDelta': 0, 'deathDelta': 0, 'teamDeathDelta': 0,
            'supported': True, 'covered': True, 'predictionError': .1, 'zeroError': .2, **changes}


class DiagnosticsTests(unittest.TestCase):
    def test_degraded_policy_is_rejected_even_when_fit_loss_improves(self):
        report = diagnose([case(i, changed=True, rewardDelta=-.3, teamDeathDelta=1,
                                predictionError=.4) for i in range(1, 25)], 24,
                          [{'objective': .8}, {'objective': .1}], .01)
        self.assertEqual(report['assessment'], 'reject')
        self.assertIn('generalization-regression', report['signals'])
        self.assertIn('gameplay-regression', report['signals'])
        self.assertNotIn('optimization-regression', report['signals'])
        self.assertFalse(report['production_eligible'])

    def test_stagnation_is_distinct_from_prediction_improvement(self):
        report = diagnose([case(i) for i in range(1, 25)], 24)
        self.assertIn('behavioral-stagnation', report['signals'])
        self.assertNotIn('generalization-regression', report['signals'])
        self.assertEqual(report['decision_change_rate']['estimate'], 0)
        self.assertGreater(report['decision_change_rate']['upper'], 0)

    def test_incomplete_worlds_are_retained_and_missing_metrics_are_not_zero(self):
        report = diagnose([case(1), {'seed': 2, 'status': 'invalid-controls'},
                           {'seed': 3, 'status': 'valid'}], 24)
        self.assertEqual(report['planned'], 24)
        self.assertEqual(report['measured'], 1)
        self.assertEqual(report['missing'], 21)
        self.assertEqual(report['invalid_metrics'], 1)
        self.assertIn('evaluator-instability', report['signals'])
        self.assertIn('invalid-metrics', report['signals'])
        self.assertIsNone(report['win_rate'])
        self.assertEqual(diagnose([], 24)['assessment'], 'inconclusive')

    def test_positive_small_sample_remains_inconclusive_and_seed_duplicates_add_no_precision(self):
        cases = [case(i, changed=True, rewardDelta=.2) for i in range(1, 5)]
        report = diagnose(cases, 4)
        self.assertEqual(report['assessment'], 'inconclusive')
        self.assertIn('benefit-not-established', report['signals'])
        self.assertEqual(reward_interval(cases), reward_interval(cases * 10))

    def test_frozen_diagnostic_contract_cannot_be_relaxed(self):
        with self.assertRaises(ValueError):
            diagnose([], 1, configuration={**CONFIG, 'confidence': .5})
        with self.assertRaises(ValueError):
            diagnose([case(1)], 0)

    def test_corrupt_and_nonfinite_metrics_are_explicitly_rejected(self):
        for changes in ({'rewardDelta': float('nan')}, {'rewardDelta': 3},
                        {'predictionError': -1}, {'deathDelta': .5}, {'changed': 1}):
            self.assertEqual(diagnose([case(1, **changes)], 1)['invalid_metrics'], 1)


class EvidenceTests(unittest.TestCase):
    def test_training_rejects_duplicate_seeds_and_calibration_or_test_contamination(self):
        sample = {'seed': 1, 'status': 'no-target', 'split': 'fit'}
        independent_examples([sample], 'fit')
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            independent_examples([sample, sample], 'fit')
        for split in ('calibration', 'heldout'):
            with self.assertRaisesRegex(ValueError, 'contamination'):
                independent_examples([{**sample, 'split': split}], 'fit')

    def test_compressed_and_legacy_hashes_are_explicit_and_missing_or_tampered_data_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            content = b'{"seed":1}'
            raw = folder / 'raw-1.json.gz'
            raw.write_bytes(gzip.compress(content))
            for data, expected_basis in ((raw.read_bytes(), 'stored-bytes'), (content, 'legacy-decompressed-bytes')):
                value, proof = read_raw(folder, {'seed': 1, 'rawHash': hashlib.sha256(data).hexdigest()})
                self.assertEqual(value['seed'], 1)
                self.assertEqual(proof['hash_basis'], expected_basis)
            with self.assertRaises(ValueError):
                read_raw(folder, {'seed': 1, 'rawHash': 'wrong'})
            raw.unlink()
            with self.assertRaisesRegex(ValueError, 'Missing raw'):
                read_raw(folder, {'seed': 1, 'status': 'valid'})

    def test_overlapping_allocations_and_changed_split_are_rejected(self):
        execution = {'cases': [{'seed': 1, 'split': 'fit'}]}
        with self.assertRaises(ValueError):
            validate_case_allocation({'cases': execution['cases'] * 2}, [])
        with self.assertRaises(ValueError):
            validate_case_allocation(execution, [{'seed': 1, 'split': 'heldout'}])
        with self.assertRaises(ValueError):
            validate_case_allocation(execution, execution['cases'] * 2)

    def test_audit_includes_failed_runs_without_mutating_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory) / 'failed-run'
            folder.mkdir()
            for name, data in {'state.json': {'status': 'failed', 'error': 'fixture'},
                               'execution.json': {'cases': [{'seed': 1, 'split': 'heldout'}]}}.items():
                (folder / name).write_text(json.dumps(data))
            before = {p.name: p.read_bytes() for p in folder.iterdir()}
            report = audit(directory)
            self.assertEqual(report['summary']['statuses']['failed'], 1)
            self.assertEqual(report['studies'][0]['splits']['heldout']['planned'], 1)
            self.assertEqual(before, {p.name: p.read_bytes() for p in folder.iterdir()})


if __name__ == '__main__':
    unittest.main()
