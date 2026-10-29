"""Hash-guarded corrections for the pinned TRELLIS nodes; no model changes."""
import argparse
import hashlib
import os
from pathlib import Path


def mesh_decoder_source(source):
    # LF-normalized source digest, matching Path.read_text() on both platforms.
    original = '11503139b4ce0eb1126048e579a895ab0b0db61831cf157ff1aa4a318c025e73'
    edits = [('h.coords[:, 1:], v.feats', 'h.coords[:, 1:].int().contiguous(), v.feats', 1),
             ('coords=v.coords[:, 1:],', 'coords=v.coords[:, 1:].int().contiguous(),', 2)]
    # Accept exactly upstream or our complete patch, including on an installed
    # environment whose lifecycle source has already been patched.
    restored = source
    for before, after, count in edits:
        restored = restored.replace(after, before)
    if hashlib.sha256(restored.encode()).hexdigest() != original:
        raise SystemExit('Unreviewed FDG decoder source; refusing coordinate patch')
    patched = restored
    for before, after, count in edits:
        if patched.count(before) != count:
            raise SystemExit('Unexpected FDG mesh extraction sites')
        patched = patched.replace(before, after)
    if source not in (restored, patched):
        raise SystemExit('Partially patched FDG decoder; review required')
    return patched


def patch_mesh_decoder(nodes):
    path = nodes / 'models/sc_vaes/fdg_vae.py'
    patched = mesh_decoder_source(path.read_text())
    path.write_text(patched)
    print('Verified int32 contiguous coordinates for direct/tiled FDG extraction')


T4_CONFIG_PATCH = '''
# Reviewed T4 launch profile: avoid exhaustive cold split-K autotuning.
import torch
if torch.cuda.is_available() and torch.cuda.get_device_capability() == (7, 5):
    import sys
    import triton
    import flex_gemm
    from flex_gemm.utils.autotuner import TritonPersistentCacheAutotuner
    FLEX_GEMM_ALGO = 'masked_implicit_gemm'
    _seen = set()
    for _module in list(sys.modules.values()):
        if not getattr(_module, '__name__', '').startswith('flex_gemm.kernels.triton.spconv'):
            continue
        for _kernel in list(vars(_module).values()):
            if isinstance(_kernel, TritonPersistentCacheAutotuner) and id(_kernel) not in _seen:
                _kernel.configs = [triton.Config({'B1': 32, 'B2': 32, 'BK': 32}, num_stages=2, num_warps=4)]
                _seen.add(id(_kernel))
    if not _seen:
        raise RuntimeError('T4 sparse launch profile found no reviewed Triton kernels')
'''


def sparse_config_source(source):
    original = 'c57ebec6299609f6ad48a09bf3294d7a5c1c970b748e806abb0811984b0e42c8'
    restored = source.removesuffix(T4_CONFIG_PATCH)
    if hashlib.sha256(restored.encode()).hexdigest() != original:
        raise SystemExit('Unreviewed sparse configuration; refusing T4 profile')
    return restored + T4_CONFIG_PATCH


def patch_pipeline(nodes):
    path = nodes / 'pipelines/trellis2_image_to_3d.py'
    source = path.read_text()
    # Filled with the upstream LF-normalized source digest below; fail closed when
    # upgrading nodes so the patch must be reviewed against the new implementation.
    expected = '9be0e4ec4634cf394ea2b13eb5d373eb8372d236fd84c123072f2ffd0fd0df70'
    if hashlib.sha256(source.encode()).hexdigest() != expected:
        raise SystemExit('Unreviewed TRELLIS pipeline source; refusing lifecycle patch')
    needle = "        ss_attn_mode = getattr(ss_model, 'image_attn_mode', None)\n"
    if source.count(needle) != 2:
        raise SystemExit('Unexpected sparse-model reference sites')
    source = source.replace(needle, needle + "        del ss_model  # Do not defeat unload_sparse_structure_model().\n")
    needle = '    def _cleanup_cuda(self):\n        gc.collect()\n'
    if source.count(needle) != 1:
        raise SystemExit('Unexpected allocator-cleanup site')
    source = source.replace(needle, needle + "        import ctypes\n        ctypes.CDLL(None).malloc_trim(0)  # Linux glibc runtime is pinned in Docker.\n")
    needle = '            sampler=sparse_structure_sampler or sampler\n        )\n'
    if source.count(needle) != 1:
        raise SystemExit('Unexpected single-image sparse-admission site')
    source = source.replace(needle, needle + "        if coords.shape[0] > max_num_tokens:\n            raise RuntimeError('Generated sparse token count exceeds the configured memory budget')\n")
    # The 512 texture flow has an independently pinned higher-precision checkpoint.
    # Keep sparse/shape inference Q4; never silently fall back to Q4 for texture.
    start = source.index('    def load_tex_slat_flow_model_512(self):')
    end = source.index('    def unload_tex_slat_flow_model_512(self):',start)
    block = source[start:end]
    needle = "gguf_quant=getattr(self, 'gguf_quant', 'Q8_0'),"
    if block.count(needle) != 1:
        raise SystemExit('Unexpected texture quantization selection site')
    source = source[:start] + block.replace(needle,"gguf_quant='Q8_0',  # Pinned texture precision; shape remains Q4.") + source[end:]
    # Match the image-to-3D decoder's sparse surface guidance when retexturing an
    # existing mesh. Unguided expansion and a retained local flow-model reference
    # otherwise exceed the bounded host-RAM budget even after model offload.
    start = source.index('    def texture_mesh(\n')
    end = source.index('    def texture_mesh_multiview(\n',start)
    block = source[start:end]
    needle = '        if resolution==512:\n'
    if block.count(needle) != 1:
        raise SystemExit('Unexpected mesh texture sampling site')
    block = block.replace(needle,"        guide_meshes, texture_guide_subs = self.decode_shape_slat(shape_slat, resolution, use_tiled=True)\n        del guide_meshes\n        self._cleanup_cuda()\n        if texture_guide_subs is None:\n            raise RuntimeError('Texture reprocessing requires sparse shape guidance')\n\n"+needle)
    needle = '        pbr_voxel = self.decode_tex_slat(tex_slat)\n'
    if block.count(needle) != 1:
        raise SystemExit('Unexpected mesh texture decoding site')
    block = block.replace(needle,"        del tex_model\n        self._cleanup_cuda()\n        pbr_voxel = self.decode_tex_slat(tex_slat, texture_guide_subs)\n")
    source = source[:start] + block + source[end:]
    path.write_text(source)
    print('Applied reviewed TRELLIS lifecycle and sparse-token admission patch')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mesh-only', action='store_true', help='Update an already lifecycle-patched installation.')
    args = parser.parse_args()
    nodes = Path(os.environ.get('TRELLIS_COMFY', '/opt/ComfyUI')) / 'custom_nodes/ComfyUI-Trellis2-GGUF/trellis2_gguf'
    mesh_decoder_source((nodes / 'models/sc_vaes/fdg_vae.py').read_text())
    config = nodes / 'modules/sparse/conv/config.py'
    patched_config = sparse_config_source(config.read_text())
    if not args.mesh_only:
        patch_pipeline(nodes)
    patch_mesh_decoder(nodes)
    config.write_text(patched_config)
    print('Verified architecture-scoped T4 sparse launch profile')


if __name__ == '__main__':
    main()
