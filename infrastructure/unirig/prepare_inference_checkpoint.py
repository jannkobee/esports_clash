"""Derive a versioned inference checkpoint; preserve every model tensor bit-for-bit."""
import hashlib
import gc
import json
from pathlib import Path
import torch

ROOT = Path('/unirig-data')
SOURCE = ROOT/'models/skin/articulation-xl/model.ckpt'
OUTPUT = ROOT/'models/skin/articulation-xl/inference-only.ckpt'
EXPECTED_SOURCE = '9d40cf42fb9d4c10d8b373d9f4f557c6fbbc5ebacae7ae6b3dce5a0d8a18bc33'


def file_hash(path):
    value=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):value.update(chunk)
    return value.hexdigest()


def tensor_digest(state):
    result=hashlib.sha256()
    for name in sorted(state):
        tensor=state[name]
        if not torch.is_tensor(tensor) or tensor.layout!=torch.strided:
            raise RuntimeError('Expected dense tensor-only model state')
        meta=json.dumps([name,str(tensor.dtype),list(tensor.shape)],separators=(',',':')).encode()
        result.update(len(meta).to_bytes(8,'little'));result.update(meta)
        result.update(memoryview(tensor.detach().reshape(-1).contiguous().view(torch.uint8).numpy()))
    return result.hexdigest()


if __name__=='__main__':
    if SOURCE.is_symlink() or SOURCE.stat().st_size!=4375464854 or file_hash(SOURCE)!=EXPECTED_SOURCE:
        raise RuntimeError('Official source checkpoint integrity failed')
    # The source is hash-pinned/trusted. mmap avoids eagerly reading Adam tensors.
    source=torch.load(str(SOURCE),map_location='cpu',mmap=True,weights_only=False)
    if not isinstance(source,dict) or not isinstance(source.get('state_dict'),dict):
        raise RuntimeError('Unsupported Lightning checkpoint schema')
    original=tensor_digest(source['state_dict'])
    removed=[name for name in ['optimizer_states','lr_schedulers'] if name in source]
    inference={name:value for name,value in source.items() if name not in removed}
    temporary=OUTPUT.with_name('inference-only.tmp.ckpt')
    torch.save(inference,temporary)
    loaded=torch.load(str(temporary),map_location='cpu',mmap=True,weights_only=False)
    derived=tensor_digest(loaded['state_dict'])
    if derived!=original or set(loaded)!=set(source)-set(removed):
        raise RuntimeError('Inference checkpoint did not preserve exact model state/metadata')
    output_hash=file_hash(temporary)
    output_bytes=temporary.stat().st_size
    tensor_bytes=sum(t.numel()*t.element_size() for t in loaded['state_dict'].values())
    tensor_count=len(loaded['state_dict'])
    # Release mmap handles before atomic rename on Docker Desktop's Windows bind.
    del loaded,inference,source
    gc.collect()
    temporary.replace(OUTPUT)
    proof={'schema':1,'source_path':'skin/articulation-xl/model.ckpt','source_sha256':EXPECTED_SOURCE,
        'path':'skin/articulation-xl/inference-only.ckpt','sha256':output_hash,'bytes':output_bytes,
        'model_tensor_digest':derived,'model_tensor_bytes':tensor_bytes,
        'model_tensor_count':tensor_count,'removed_training_keys':removed,
        'torch':torch.__version__,'scope':'Exact model weights and remaining Lightning metadata preserved; training optimizer/scheduler state removed for prediction only.'}
    (ROOT/'inference-checkpoint-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
    print(json.dumps(proof,indent=2))
