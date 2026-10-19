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
    from flex_gemm.ops.spconv import sparse_submanifold_conv3d, set_algorithm, Algorithm
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
    (service.ROOT / 'diagnostics.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
