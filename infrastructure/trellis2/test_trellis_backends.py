import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock,patch
from trellis_backends import backend_status,generate,BackendError,ColabClient,MODEL
from test_cloud_bridge import fixture_glb


class NativeBackendTests(unittest.TestCase):
    def setUp(self):
        self.expected={'pins_sha256':'p','workflow_sha256':'w'}
        self.operations={'provider':'trellis2-gguf','pins_sha256':'p','workflow_sha256':'w','limits_sha256':'l',
                         'engine_sha256':'e','models':{'ready':True},'gpu_validated':True}
        self.client=MagicMock()

    def test_gpu_connection_without_checkpoints_cannot_pass(self):
        self.operations['models']={'ready':False,'reason':'Checkpoints missing'}
        self.client.request.return_value=(200,self.operations)
        result=backend_status(self.client,self.expected)
        self.assertFalse(result['available']);self.assertEqual(result['reason'],'Checkpoints missing')

    def test_different_generator_is_rejected(self):
        self.operations['provider']='local-procedural'
        self.client.request.return_value=(200,self.operations)
        self.assertFalse(backend_status(self.client,self.expected)['available'])

    def test_different_pins_or_missing_gpu_diagnostics_are_rejected(self):
        self.operations['gpu_validated']=False
        self.client.request.return_value=(200,self.operations)
        self.assertFalse(backend_status(self.client,self.expected)['available'])
        self.operations['gpu_validated']=True;self.operations['pins_sha256']='different'
        self.assertFalse(backend_status(self.client,self.expected)['available'])

    def execute_fixture(self, bad_hash=False):
        content=fixture_glb();reference=b'frozen-body';digest=hashlib.sha256(reference).hexdigest()
        plan={'avatar_id':'c_solana','seed':47,'reference_sha256':digest}
        state={'id':'fixture-job','avatar_id':'c_solana','seed':47,'reference_sha256':digest,'status':'generated_unqualified',
               'artifact':{'bytes':len(content),'sha256':'0'*64 if bad_hash else hashlib.sha256(content).hexdigest()}}
        self.client.request.side_effect=[(404,{}),(200,self.operations),(200,{'sha256':digest}),(202,state),(200,content),(200,{'status':'cancelled'})]
        with tempfile.TemporaryDirectory() as directory:
            output=Path(directory)/'candidate.glb'
            result=generate(self.client,'fixture-job',plan,reference,output,self.expected,lambda state:None,lambda:False)
            self.assertEqual(output.read_bytes(),content)
            self.assertEqual(result['model'],MODEL)
        return self.client.request.call_args_list

    def test_native_plan_uses_exact_worker_hashes_and_verifies_artifact(self):
        calls=self.execute_fixture()
        native=calls[3].args[2]
        self.assertEqual(native['engine_sha256'],'e');self.assertNotIn('compute_preference',native)
        self.assertEqual(native['seed'],47)
        self.assertEqual(set(native),{'version','avatar_id','seed','reference_sha256','workflow_sha256','pins_sha256','limits_sha256','engine_sha256'})

    def test_corrupt_native_artifact_is_never_installed(self):
        with self.assertRaisesRegex(BackendError,'integrity'):
            self.execute_fixture(bad_hash=True)
        self.assertTrue(self.client.request.call_args.args[1].endswith('/cancel'))

    def test_changed_frozen_input_cannot_launch_inference(self):
        with tempfile.TemporaryDirectory() as directory,self.assertRaisesRegex(BackendError,'hash changed'):
            generate(self.client,'fixture',{'reference_sha256':'0'*64},b'changed',Path(directory)/'out.glb',self.expected,lambda x:None,lambda:False)
        self.client.request.assert_not_called()

    def test_missing_colab_session_is_a_blocker_not_a_generated_source(self):
        with patch('trellis_backends.subprocess.run',return_value=MagicMock(stdout="[colab] Session not found",returncode=1)):
            with self.assertRaisesRegex(BackendError,'session is unavailable'):
                ColabClient('colab','missing').request('GET','/operations')


if __name__=='__main__':unittest.main()
