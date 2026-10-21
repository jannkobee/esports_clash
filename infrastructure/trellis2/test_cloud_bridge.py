"""Native routing tests. All synthetic output is confined to temporary fixtures."""
import hashlib
import json
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import cloud_bridge as bridge
from trellis_backends import BackendError, MODEL


def fixture_glb():
    document = {'asset': {'version': '2.0'}, 'buffers': [{'byteLength': 4}],
                'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'COLOR_0': 1}, 'material': 0}]}],
                'materials': [{'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1]}}]}
    raw = json.dumps(document).encode()
    raw += b' ' * (-len(raw) % 4)
    chunks = struct.pack('<II', len(raw), 0x4e4f534a) + raw + struct.pack('<II',4,0x004e4942) + b'ABCD'
    return struct.pack('<4sII', b'glTF', 2, 12 + len(chunks)) + chunks


class NativeRoutingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.root_patch = patch.object(bridge, 'ROOT', self.root)
        self.root_patch.start()
        for directory in ['jobs','input','output','references']:
            (self.root / directory).mkdir()
        self.job = '11111111-2222-4333-8444-555555555555'
        self.folder = self.root / 'jobs' / self.job
        self.folder.mkdir()
        self.reference = b'frozen-reference-fixture'
        (self.root / 'input' / (self.job + '.png')).write_bytes(self.reference)
        bridge._BACKEND_CACHE.clear()
        bridge.ACTIVE_JOB = None

    def tearDown(self):
        self.root_patch.stop()
        self.temp.cleanup()

    def status(self, available):
        return {'available':available, 'model':MODEL, 'reason':None if available else 'Native TRELLIS.2 is not provisioned.'}

    def run_job(self, preference='google', google=True, local=True, fail_google=False):
        plan = {'version':1,'avatar_id':'c_solana','seed':47,'reference_sha256':hashlib.sha256(self.reference).hexdigest(),
                'compute_preference':preference,'engine_sha256':bridge.sha(bridge.canonical(bridge.engine_manifest()))}
        def generate(client, job_id, frozen, reference, output, expected, progress, cancelled, **kwargs):
            if fail_google and client == 'google-client':
                raise BackendError('Google native inference failed')
            output.write_bytes(fixture_glb())
            progress({'stage':'inference','node_progress':{'value':12,'max':12}})
            return {'model':MODEL,'native_job_id':job_id}
        with patch.object(bridge,'probe_backend',side_effect=lambda name:self.status(google if name=='google' else local)) as probe, \
             patch.object(bridge,'clients',return_value={'google':'google-client','local':'local-client'}), \
             patch.object(bridge,'generate',side_effect=generate) as infer:
            bridge.execute_generation_job(self.job, plan)
        return json.loads((self.folder / 'state.json').read_text()), probe, infer

    def test_google_uses_native_trellis_only(self):
        state, _, infer = self.run_job()
        self.assertEqual(state['provider'],'google-colab')
        self.assertEqual(state['artifact']['generation']['model'],MODEL)
        self.assertFalse(state['artifact']['publication_eligible'])
        self.assertEqual(infer.call_args.args[0],'google-client')
        self.assertEqual(state['node_progress']['value'],12)

    def test_local_never_contacts_google(self):
        state, probe, infer = self.run_job('local')
        self.assertEqual(state['provider'],'trellis2-gguf')
        self.assertEqual(probe.call_args_list[0].args,('local',))
        probe.assert_called_once()
        self.assertEqual(infer.call_args.args[0],'local-client')

    def test_google_outage_automatically_selects_native_local(self):
        state, _, infer = self.run_job(google=False)
        self.assertEqual(state['provider'],'trellis2-gguf')
        self.assertEqual(state['compute']['preferred'],'google')
        self.assertEqual(state['compute']['selected'],'local')
        self.assertIn('automatically',state['compute']['fallback_reason'])
        self.assertEqual(infer.call_count,1)

    def test_google_inference_failure_falls_back_to_native_local(self):
        state, _, infer = self.run_job(fail_google=True)
        self.assertEqual(state['provider'],'trellis2-gguf')
        self.assertEqual(infer.call_count,2)
        self.assertEqual(len(state['attempts']),2)
        self.assertIn('failed',state['cloud_error'])
        self.assertEqual(state['status'],'generated_unqualified')

    def test_no_backends_retains_job_without_a_fake_mesh(self):
        state, _, infer = self.run_job(google=False,local=False)
        self.assertEqual(state['status'],'waiting_worker')
        self.assertFalse((self.root / 'output' / (self.job + '.glb')).exists())
        self.assertNotIn('artifact',state)
        infer.assert_not_called()

    def test_owner_cancelled_queued_job_never_launches(self):
        (self.folder / 'cancelled.json').write_text('{}')
        state, _, infer = self.run_job()
        self.assertEqual(state['status'],'cancelled')
        infer.assert_not_called()

    def test_frozen_input_corruption_never_launches(self):
        with patch.object(bridge,'sha',side_effect=lambda data:hashlib.sha256(data).hexdigest()):
            plan={'avatar_id':'c_solana','seed':47,'reference_sha256':'0'*64,
                  'engine_sha256':bridge.sha(bridge.canonical(bridge.engine_manifest()))}
            with patch.object(bridge,'generate') as infer:
                bridge.execute_generation_job(self.job,plan)
        state=json.loads((self.folder/'state.json').read_text())
        self.assertEqual(state['status'],'failed')
        infer.assert_not_called()

    def test_operations_reports_unready_trellis_instead_of_gpu_success(self):
        handler=object.__new__(bridge.BridgeHandler)
        handler.path='/operations';handler.headers={'X-Asset-Compute-Preference':'google'}
        with patch.object(handler,'check_auth',return_value=True),patch.object(handler,'send_json') as response, \
             patch.object(bridge,'probe_backend',return_value=self.status(False)):
            handler.do_GET()
        payload=response.call_args.args[1]
        self.assertEqual(payload['provider'],'trellis2-router')
        self.assertEqual(payload['generation_model'],MODEL)
        self.assertFalse(payload['models']['ready'])
        self.assertFalse(payload['gpu_validated'])

    def test_format_validator_still_rejects_missing_texture_coordinates(self):
        original=fixture_glb();length=struct.unpack_from('<I',original,12)[0]
        document=json.loads(original[20:20+length])
        document['materials'][0]['pbrMetallicRoughness']['baseColorTexture']={'index':0}
        data=json.dumps(document).encode();data+=b' '*(-len(data)%4)
        chunks=struct.pack('<II',len(data),0x4e4f534a)+data+original[20+length:]
        output=self.root/'broken.glb';output.write_bytes(struct.pack('<4sII',b'glTF',2,12+len(chunks))+chunks)
        with self.assertRaisesRegex(ValueError,'texture coordinates'):
            bridge.validate_output(output)


if __name__=='__main__':unittest.main()
