"""Compare the T4 adapter with explicit, noncausal attention on real CUDA."""
import argparse
import importlib.util
import json
from pathlib import Path
import torch


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('checkout', type=Path)
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('trial_attention', args.checkout / 'src/teamfight_attention.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    torch.manual_seed(25001)
    results = []
    with torch.inference_mode():
        for heads, kv_heads in [(4, 4), (4, 2)]:
            # 273 crosses two query boundaries; unequal Q/K lengths catch layout errors.
            q = torch.randn(2, 273, heads, 16, device='cuda')
            k, v = (torch.randn(2, 71, kv_heads, 16, device='cuda') for _ in range(2))
            actual, aux = module.flash_attn_func(q, k, v)
            repeated_k, repeated_v = (x.repeat_interleave(heads // kv_heads, dim=2) for x in (k, v))
            scores = torch.einsum('bqhd,bkhd->bhqk', q, repeated_k) / 4
            expected = torch.einsum('bhqk,bkhd->bqhd', scores.softmax(dim=-1), repeated_v)
            assert aux is None and actual.shape == q.shape and torch.isfinite(actual).all()
            torch.testing.assert_close(actual, expected, rtol=2e-5, atol=2e-6)
            results.append({'heads': heads, 'kv_heads': kv_heads, 'max_error': (actual - expected).abs().max().item()})
    print(json.dumps({'gpu': torch.cuda.get_device_name(), 'attention_checks': results}, indent=2))


if __name__ == '__main__':
    main()
