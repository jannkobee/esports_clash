"""Reviewed, build-time lifecycle correction for the exact pinned node source.

Does not modify weights, sampler parameters, generated code, or live assets.
"""
import hashlib
from pathlib import Path

path = Path('/opt/ComfyUI/custom_nodes/ComfyUI-Trellis2-GGUF/trellis2_gguf/pipelines/trellis2_image_to_3d.py')
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
