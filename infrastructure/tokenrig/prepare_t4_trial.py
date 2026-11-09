"""Prepare a separate, explicitly experimental FP32/SDPA TokenRig checkout.

Never run this against a UniRig or TRELLIS installation. This is a candidate
profile, not a claim of upstream T4 support or a qualified production engine.
"""
import argparse
import hashlib
import json
from pathlib import Path


ATTENTION = '''"""FP32 attention for the experimental T4 TokenRig profile."""
import torch
import torch.nn.functional as F

def flash_attn_func(q, k, v):
    # Upstream's wrapper expects [B, L, H, D] and a (result, auxiliary) pair.
    q, k, v = (x.transpose(1, 2) for x in (q, k, v))
    if q.shape[1] != k.shape[1]:
        if q.shape[1] % k.shape[1]:
            raise ValueError("Invalid grouped-query head ratio")
        repeat = q.shape[1] // k.shape[1]
        k, v = (x.repeat_interleave(repeat, dim=1) for x in (k, v))
    # Chunk queries only: each chunk still attends to every key. This bounds
    # the math fallback's temporary allocation without changing its attention.
    out = torch.cat([
        F.scaled_dot_product_attention(part, k, v, dropout_p=0.0)
        for part in q.split(128, dim=2)
    ], dim=2)
    return out.transpose(1, 2).contiguous(), None
'''


def replace_once(source, before, after):
    if source.count(before) != 1:
        raise ValueError(f"Expected one pinned source fragment: {before[:70]}")
    return source.replace(before, after)


def prepare(root, pins):
    changes = {}
    for name, expected in pins['upstream_sha256'].items():
        raw = (root / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError(f"Unreviewed or already patched source: {name}")
        source = raw.decode('utf-8')
        if name in ('src/model/tokenrig.py', 'src/model/skin_vae_model.py'):
            begin = source.index('try:\n    from flash_attn_interface')
            end = source.index('\nclass ', begin)
            source = source[:begin] + 'from src.teamfight_attention import flash_attn_func\n' + source[end:]
            source = source.replace('torch.bfloat16', 'torch.float32')
            # FP32 requires no autocast and avoids FP16 overflow of BF16 weights.
            source = source.replace("@torch.autocast(device_type='cuda', dtype=torch.float32)", '@torch.autocast(device_type="cuda", enabled=False)')
            source = source.replace("@torch.autocast('cuda', dtype=torch.float32)", '@torch.autocast(device_type="cuda", enabled=False)')
            source = source.replace('attn_implementation="flash_attention_2"', 'attn_implementation="sdpa"')
        elif name.endswith('miche_transformer_blocks.py'):
            begin = source.index('def flash_attention(q, k, v):')
            end = source.index('\nclass MultiheadAttention', begin)
            source = source[:begin] + '''def flash_attention(q, k, v):
    from src.teamfight_attention import flash_attn_func as sdpa
    return sdpa(q, k, v)[0]

''' + source[end:]
        elif name.endswith('bpy_server.py'):
            source = replace_once(source, "host='0.0.0.0'", "host='127.0.0.1'")
        compile(source, name, 'exec')
        changes[name] = source
    changes['src/teamfight_attention.py'] = ATTENTION
    # Validate every source hash and patch before writing any file.
    for name, source in changes.items():
        (root / name).write_text(source, encoding='utf-8', newline='\n')
    report = {
        'profile': 'tokenrig-t4-fp32-sdpa-trial-v1',
        'qualified': False,
        'source_commit': pins['commit'],
        'patch_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'files': {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in changes},
    }
    (root / 'teamfight-trial-engine.json').write_text(json.dumps(report, indent=2))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('checkout', type=Path)
    args = parser.parse_args()
    pins = json.loads(Path(__file__).with_name('model-pins.json').read_text())
    print(json.dumps(prepare(args.checkout.resolve(), pins), indent=2))
