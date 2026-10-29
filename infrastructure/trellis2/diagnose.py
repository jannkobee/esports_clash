"""GPU/node ABI smoke test. Does not run model inference or create an asset."""
import asyncio
import json
import platform
from pathlib import Path
import sys
import traceback


async def main():
    import torch
    import numpy
    import cumesh
    import o_voxel
    import flex_gemm
    import nvdiffrast.torch as dr
    import service
    result = {'kind': 'GPU-and-node-diagnostics-only', 'python': platform.python_version(),
              'torch': torch.__version__, 'cuda': torch.version.cuda, 'numpy': numpy.__version__}
    if not torch.cuda.is_available():
        raise RuntimeError('PyTorch CUDA is unavailable')
    result['gpu'] = torch.cuda.get_device_name()
    x = torch.ones((32,32),device='cuda',dtype=torch.bfloat16)
    if (x @ x).float().mean().item() != 32:
        raise RuntimeError('CUDA bfloat16 matrix multiplication failed')
    context = dr.RasterizeCudaContext()
    vertices = torch.tensor([[[-.5,-.5,0,1],[.5,-.5,0,1],[0,.5,0,1]]],device='cuda',dtype=torch.float32)
    faces = torch.tensor([[0,1,2]],device='cuda',dtype=torch.int32)
    raster, _ = dr.rasterize(context, vertices, faces, resolution=[16,16])
    torch.cuda.synchronize()
    if not bool((raster[:,:,:,3] > 0).any()):
        raise RuntimeError('Nvdiffrast CUDA rasterizer failed')
    result['gpu_bfloat16_matmul'] = True
    result['nvdiffrast_cuda_rasterize'] = True
    # Synthetic fixtures stay in memory and are never exported as avatar assets.
    mesh = cumesh.CuMesh()
    tetra = torch.tensor([[0.,0.,0.],[1.,0.,0.],[0.,1.,0.],[0.,0.,1.]],device='cuda')
    triangles = torch.tensor([[0,2,1],[0,1,3],[0,3,2],[1,2,3]],device='cuda',dtype=torch.int32)
    mesh.init(tetra, triangles)
    mesh.compute_vertex_normals()
    torch.cuda.synchronize()
    result['cumesh_cuda_normals'] = True
    coordinates = torch.tensor([[0,0,0],[1,2,3],[7,8,9]],device='cuda',dtype=torch.int32)
    encoded = o_voxel.serialize.encode_seq(coordinates)
    decoded = o_voxel.serialize.decode_seq(encoded)
    torch.cuda.synchronize()
    if not torch.equal(decoded, coordinates):
        raise RuntimeError('O-Voxel CUDA coordinate serialization failed')
    result['ovoxel_cuda_roundtrip'] = True
    # Reproduce the decoder's int64 sparse-coordinate input at the actual CUDA
    # hashmap boundary. Test both paths: tiled upstream catches tile exceptions,
    # so an empty result must fail rather than count as a successful smoke test.
    from o_voxel.convert import flexible_dual_grid_to_mesh, tiled_flexible_dual_grid_to_mesh
    import ast
    from patch_nodes import mesh_decoder_source
    decoder = service.COMFY / 'custom_nodes/ComfyUI-Trellis2-GGUF/trellis2_gguf/models/sc_vaes/fdg_vae.py'
    source = decoder.read_text()
    if mesh_decoder_source(source) != source:
        raise RuntimeError('FDG decoder coordinate patch is not installed')
    tree = ast.parse(source)
    sites = [node for node in ast.walk(tree) if isinstance(node, ast.Call)
             and isinstance(node.func, ast.Name)
             and node.func.id in {'flexible_dual_grid_to_mesh', 'tiled_flexible_dual_grid_to_mesh'}]
    if len(sites) != 3:
        raise RuntimeError('Unexpected FDG extraction call sites')
    long_coords = torch.cartesian_prod(*[torch.arange(4, device='cuda') for _ in range(3)]).long()
    sparse_coords = torch.cat([torch.zeros_like(long_coords[:, :1]), long_coords], dim=1)
    from types import SimpleNamespace
    for site in sites:
        expr = next((kw.value for kw in site.keywords if kw.arg == 'coords'), site.args[0] if site.args else None)
        coords = eval(compile(ast.Expression(expr), str(decoder), 'eval'),
                      {'h': SimpleNamespace(coords=sparse_coords), 'v': SimpleNamespace(coords=sparse_coords)})
        if coords.dtype != torch.int32 or not coords.is_contiguous():
            raise RuntimeError('FDG extraction must receive contiguous int32 coordinates')
        extractor = tiled_flexible_dual_grid_to_mesh if site.func.id.startswith('tiled_') else flexible_dual_grid_to_mesh
        kwargs = {'tile_size': 128} if site.func.id.startswith('tiled_') else {}
        verts, tris = extractor(coords, torch.full((64, 3), .5, device='cuda'),
            torch.ones((64, 3), device='cuda', dtype=torch.bool), torch.ones((64, 1), device='cuda'),
            aabb=[[-.5, -.5, -.5], [.5, .5, .5]], grid_size=512, train=False, **kwargs)
        torch.cuda.synchronize()
        if not verts.numel() or not tris.numel() or not torch.isfinite(verts).all():
            raise RuntimeError('FDG extraction returned an empty or nonfinite mesh')
    result['fdg_int64_input_direct_and_tiled_cuda_extraction'] = True
    from flex_gemm.ops.spconv import sparse_submanifold_conv3d, set_algorithm, Algorithm
    sparse_config = service.COMFY / 'custom_nodes/ComfyUI-Trellis2-GGUF/trellis2_gguf/modules/sparse/conv/config.py'
    if torch.cuda.get_device_capability() == (7, 5):
        scope = {'__name__': 'trellis_sparse_diagnostics'}
        exec(compile(sparse_config.read_text(), str(sparse_config), 'exec'), scope)
        if scope['FLEX_GEMM_ALGO'] != Algorithm.MASKED_IMPLICIT_GEMM:
            raise RuntimeError('T4 runtime sparse launch profile is not installed')
        result['t4_bounded_sparse_launch_profile'] = True
    set_algorithm(Algorithm.MASKED_IMPLICIT_GEMM)
    coordinates = torch.tensor([[0,0,0,0],[0,0,0,1]],device='cuda',dtype=torch.int32)
    features = torch.ones((2,16),device='cuda',dtype=torch.float16)
    weights = torch.ones((16,3,3,3,16),device='cuda',dtype=torch.float16)
    with torch.no_grad():
        output, _ = sparse_submanifold_conv3d(features, coordinates, (1,16,2,2,2), weights)
    torch.cuda.synchronize()
    if not torch.allclose(output, torch.full_like(output,32),atol=.01,rtol=0):
        raise RuntimeError('FlexGEMM CUDA sparse convolution differs from the dense fixture result')
    result['flexgemm_cuda_sparse_convolution'] = True
    for directory in ['models','jobs','staging','input','output']:
        (service.ROOT / directory).mkdir(parents=True,exist_ok=True)
    try:
        nodes = await service.start_comfy()
        result['workflow_nodes'] = [node['class_type'] for node in service.WORKFLOW.values()]
        result['node_count'] = len(nodes)
    finally:
        await service.stop_comfy()
    result['models'] = service.model_status()
    result['resources'] = await service.resources()
    result['status'] = 'passed'
    result['engine_source_hashes'] = service.engine_manifest()['source_hashes']
    result['engine_image_id'] = service.engine_manifest()['image_id']
    result['engine_environment_id'] = service.engine_manifest().get('environment_id')
    (service.ROOT / 'diagnostics.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
