"""Source guard and dtype regression using the actual pinned decoder."""
import ast
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import sys

from patch_nodes import mesh_decoder_source, sparse_config_source


class MeshDecoderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(os.environ.get('TRELLIS_COMFY', '/opt/ComfyUI'))
        decoder = root / 'custom_nodes/ComfyUI-Trellis2-GGUF/trellis2_gguf/models/sc_vaes/fdg_vae.py'
        if not decoder.is_file():
            raise unittest.SkipTest('Run inside the pinned native worker with its real node source')
        cls.source = decoder.read_text()
        cls.sparse_config = (decoder.parents[2] / 'modules/sparse/conv/config.py').read_text()

    def test_sparse_profile_is_idempotent_and_source_guarded(self):
        patched = sparse_config_source(self.sparse_config)
        self.assertEqual(sparse_config_source(patched), patched)
        with self.assertRaisesRegex(SystemExit, 'Unreviewed sparse'):
            sparse_config_source(patched + '\n# changed\n')

    def test_t4_profile_preserves_other_gpu_algorithm(self):
        fake_torch = SimpleNamespace(cuda=SimpleNamespace(is_available=lambda: True,
            get_device_capability=lambda: (8, 6)))
        scope = {'__name__': 'non_t4_profile_test'}
        with patch.dict(sys.modules, {'torch': fake_torch}):
            exec(compile(sparse_config_source(self.sparse_config), 'sparse_config', 'exec'), scope)
        self.assertEqual(scope['FLEX_GEMM_ALGO'], 'implicit_gemm_splitk')
        self.assertNotIn('_seen', scope)

    def test_idempotence_and_unknown_source_rejection(self):
        patched = mesh_decoder_source(self.source)
        self.assertEqual(mesh_decoder_source(patched), patched)
        with self.assertRaisesRegex(SystemExit, 'Unreviewed'):
            mesh_decoder_source(patched + '\n# upstream changed\n')

    def test_partial_patch_is_rejected(self):
        patched = mesh_decoder_source(self.source)
        partial = patched.replace('h.coords[:, 1:].int().contiguous()', 'h.coords[:, 1:]', 1)
        with self.assertRaisesRegex(SystemExit, 'Partially patched'):
            mesh_decoder_source(partial)

    def test_real_extraction_arguments_convert_int64_without_changing_values(self):
        import torch
        coords = torch.tensor([[0, 1, 2, 3], [0, 4, 5, 6]], dtype=torch.int64)
        scope = {'h': SimpleNamespace(coords=coords), 'v': SimpleNamespace(coords=coords)}
        calls = [node for node in ast.walk(ast.parse(mesh_decoder_source(self.source)))
                 if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                 and node.func.id in {'flexible_dual_grid_to_mesh', 'tiled_flexible_dual_grid_to_mesh'}]
        self.assertEqual(len(calls), 3)
        for call in calls:
            expression = next((kw.value for kw in call.keywords if kw.arg == 'coords'),
                              call.args[0] if call.args else None)
            result = eval(compile(ast.Expression(expression), 'decoder-coordinates', 'eval'), scope)
            self.assertEqual(result.dtype, torch.int32)
            self.assertTrue(result.is_contiguous())
            self.assertTrue(torch.equal(result.long(), coords[:, 1:]))
        self.assertEqual(coords.dtype, torch.int64)


if __name__ == '__main__':
    unittest.main()
