import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from operations import Operations, normalize

RUN = '00000000-0000-0000-0000-000000000001'


class OperationsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.folder = self.root / RUN
        self.folder.mkdir()
        (self.folder / 'state.json').write_text(json.dumps({'status': 'completed'}))
        self.ops = Operations(self.root)

    def tearDown(self):
        self.ops.db.close()
        self.temp.cleanup()

    def artifact(self, kind='temporary', owners=()):
        path = self.folder / 'test.bin'
        path.write_bytes(b'unit-test-only-no-learning-evidence')
        return self.ops.register(RUN + '/test.bin', kind, RUN, owners)

    def test_production_match_evaluation_pin_and_rollback_references_block_cleanup(self):
        self.artifact(owners=['production:v1', 'match:example', 'evaluation:example', 'rollback:v0', 'pin:owner'])
        self.assertEqual(self.ops.cleanup(execute=True)['recoverable_bytes'], 0)
        self.assertTrue((self.folder / 'test.bin').exists())

    def test_dry_run_quarantine_delay_then_delete(self):
        identity = self.artifact()
        now = time.time() + 1
        self.assertEqual(self.ops.cleanup(now=now)['candidates'][0]['action'], 'quarantine')
        self.assertTrue((self.folder / 'test.bin').exists())
        self.ops.cleanup(execute=True, now=now)
        quarantined = self.ops.meta / 'quarantine' / identity
        self.assertTrue(quarantined.exists())
        self.assertEqual(self.ops.cleanup(execute=True, now=now+3600)['candidates'][0]['action'], 'waiting')
        self.ops.cleanup(execute=True, now=now+25*3600)
        self.assertFalse(quarantined.exists())
        self.assertEqual(self.ops.db.execute('SELECT count(*) FROM audit').fetchone()[0], 2)

    def test_new_reference_restores_quarantined_artifact_before_deletion(self):
        identity = self.artifact()
        self.ops.cleanup(execute=True, now=time.time()+1)
        self.ops.pin(identity, 'match:new')
        self.assertTrue((self.folder / 'test.bin').exists())
        self.assertEqual(self.ops.cleanup(execute=True, now=time.time()+100000)['recoverable_bytes'], 0)

    def test_running_and_resource_paused_studies_are_protected_without_a_reference(self):
        self.artifact()
        for status in ('running', 'queued', 'paused_resource', 'stopping'):
            (self.folder / 'state.json').write_text(json.dumps({'status': status}))
            self.assertEqual(self.ops.cleanup(execute=True)['recoverable_bytes'], 0)

    def test_changed_content_cannot_be_deleted_against_an_old_manifest(self):
        self.artifact()
        (self.folder / 'test.bin').write_bytes(b'changed')
        self.assertEqual(self.ops.cleanup(execute=True)['recoverable_bytes'], 0)

    def test_traversal_absolute_paths_wrong_run_and_symlinks_are_rejected(self):
        for path in ('../outside', '/tmp/outside', '.management/../outside'):
            with self.assertRaises(ValueError): self.ops.safe(path, exists=False)
        with self.assertRaises(ValueError): self.ops.register(RUN+'/state.json', 'temporary', '../bad')
        try: (self.folder / 'link').symlink_to(self.root / '.management', target_is_directory=True)
        except OSError: return  # Windows host without symlink privilege; Docker test must cover this.
        with self.assertRaises(ValueError): self.ops.safe(RUN+'/link/registry.sqlite3')

    def test_insufficient_counts_unqualified_speed_and_concurrency_are_rejected(self):
        for settings in ({'evaluation_cases': 17}, {'fit_cases': 15}, {'calibration_cases': 15},
                         {'speed':'8'}, {'workers':2}, {'fit_cases':512,'calibration_cases':512}, {'ram_mib':99999}):
            with self.assertRaises(ValueError): normalize(settings)

    def test_memory_pressure_pauses_without_deleting_protected_files(self):
        self.artifact(owners=['study:'+RUN])
        with patch('operations.resource_sample', return_value={'ml_anon_mib':2049,'vm_available_mib':6000}):
            self.assertIn('RAM', self.ops.pressure())
        self.assertTrue((self.folder/'test.bin').exists())

    def test_registry_survives_reopen_and_legacy_import_stays_pinned(self):
        (self.folder/'plan.json').write_text('{}')
        self.artifact(owners=['study:'+RUN])
        self.ops.reconcile()
        self.ops.db.close()
        self.ops = Operations(self.root)
        self.assertEqual(self.ops.cleanup(execute=True, now=time.time()+400*86400)['recoverable_bytes'], 0)

    def test_reference_is_rechecked_after_preview_and_storage_pressure_never_evicts_it(self):
        identity = self.artifact()
        self.assertGreater(self.ops.cleanup()['recoverable_bytes'], 0)
        self.ops.pin(identity, 'evaluation:new')
        self.assertEqual(self.ops.cleanup(execute=True)['recoverable_bytes'], 0)
        with patch.object(self.ops, 'policy', return_value={**normalize({}), 'storage_gib':.000001}), patch('operations.resource_sample', return_value={'ml_anon_mib':0,'vm_available_mib':99999}):
            self.assertIn('storage budget', self.ops.pressure())
        self.assertTrue((self.folder/'test.bin').exists())


if __name__ == '__main__': unittest.main()
