"""Control-plane tests only; no rigging, generation or animation compute."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock
from preparation_gateway import PreparationGateway
from trellis_backends import BackendError

JOB = '11111111-2222-4333-8444-555555555555'
GENERATION = '66666666-7777-4888-8999-aaaaaaaaaaaa'


class CloudPreparationTransportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.sources = self.root / 'sources'
        self.sources.mkdir()
        self.content = b'glTF' + b'control transport fixture' * 2
        self.source = self.sources / (GENERATION + '.glb')
        self.source.write_bytes(self.content)
        self.sha = hashlib.sha256(self.content).hexdigest()
        self.plan = {'version': 1, 'provider': 'tokenrig', 'compute': 'google',
                     'generation_id': GENERATION, 'avatar_id': 'c_invoker',
                     'source_sha256': self.sha, 'engine_sha256': 'e' * 64,
                     'stage': 'clean_base_raw_rig', 'seed': 25001}
        self.client = MagicMock()
        self.gateway = PreparationGateway(self.client, self.root / 'cloud', self.sources)
        self.path = '/rigging/jobs/' + JOB

    def tearDown(self):
        self.temp.cleanup()

    def test_completed_output_is_hash_verified_and_retained_after_disconnect(self):
        state = {'id': JOB, 'status': 'rigged_unqualified',
                 'artifact': {'sha256': self.sha, 'bytes': len(self.content)}}
        self.client.request.side_effect = [(404, {}), (200, {'sha256': self.sha, 'bytes': len(self.content)}),
                                            (200, state), (200, self.content)]
        code, value = self.gateway.request('POST', self.path, self.plan)
        self.assertEqual(code, 200)
        self.assertEqual(value, state)
        self.client.request.side_effect = BackendError('disconnected')
        code, content = self.gateway.request('GET', self.path + '/artifact')
        self.assertEqual((code, content), (200, self.content))
        # A changed local file cannot masquerade as the verified cloud output.
        (self.root / 'cloud/rigging' / JOB / 'artifact.glb').write_bytes(b'corrupt')
        self.assertEqual(self.gateway.request('GET', self.path + '/artifact')[0], 503)

    def test_changed_source_never_reaches_processing_submission(self):
        self.client.request.return_value = (404, {})
        self.source.write_bytes(b'changed')
        self.assertEqual(self.gateway.request('POST', self.path, self.plan)[0], 422)
        self.assertEqual(self.client.request.call_count, 1)
        self.assertEqual(self.client.request.call_args.args[0], 'GET')

    def test_frozen_plan_cannot_be_replaced_on_retry(self):
        self.client.request.side_effect = BackendError('disconnected')
        self.assertEqual(self.gateway.request('POST', self.path, self.plan)[0], 503)
        self.client.reset_mock()
        changed = {**self.plan, 'seed': 7}
        self.assertEqual(self.gateway.request('POST', self.path, changed)[0], 409)
        self.client.request.assert_not_called()

    def test_disconnected_cancel_blocks_later_processing_dispatch(self):
        self.client.request.side_effect = BackendError('disconnected')
        code, result = self.gateway.request('POST', self.path + '/cancel', {})
        self.assertEqual(code, 503)
        self.assertTrue(result['cancellation_pending'])
        self.client.request.side_effect = None
        self.client.request.return_value = (200, {'id': JOB, 'status': 'cancelled'})
        self.client.reset_mock()
        code, result = self.gateway.request('POST', self.path, self.plan)
        self.assertEqual((code, result['status']), (200, 'cancelled'))
        self.assertEqual(self.client.request.call_args.args, ('POST', self.path + '/cancel', {}))
        self.assertEqual(self.client.request.call_count, 1)

    def test_local_readiness_label_cannot_pass_cloud_contract(self):
        self.client.request.return_value = (200, {'runtime_ready': True,
            'compute': {'selected': 'local', 'automatic_fallback': False}})
        code, result = self.gateway.request('GET', '/rigging/operations')
        self.assertEqual(code, 200)
        self.assertFalse(result['runtime_ready'])
        self.assertEqual(result['stages'], [])

    def test_arbitrary_paths_and_local_plans_are_rejected_without_remote_calls(self):
        self.assertEqual(self.gateway.request('GET', '/rigging/jobs/../../operations')[0], 404)
        self.assertEqual(self.gateway.request('POST', self.path, {**self.plan, 'compute': 'local'})[0], 422)
        self.client.request.assert_not_called()


if __name__ == '__main__':
    unittest.main()
