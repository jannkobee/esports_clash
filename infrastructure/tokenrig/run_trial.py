"""Run one isolated TokenRig candidate; invoke inside a bounded supervisor."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('checkout', type=Path)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--source-sha256', required=True)
    parser.add_argument('--seed', type=int, default=25001)
    parser.add_argument('--profile', choices=['native', 't4-fp32'], default='native')
    parser.add_argument('--num-beams', type=int, default=10)
    args = parser.parse_args()
    checkout, source, output = (p.resolve() for p in (args.checkout, args.source, args.output))
    if sha256(source) != args.source_sha256:
        raise ValueError('Source identity mismatch')
    pins = json.loads(Path(__file__).with_name('model-pins.json').read_text())
    for file in pins['huggingface']['files']:
        path = checkout / file['path']
        if path.stat().st_size != file['bytes'] or sha256(path) != file['sha256']:
            raise ValueError(f"Checkpoint identity mismatch: {file['path']}")
    if not 1 <= args.num_beams <= 10:
        raise ValueError('Trial beam count must be between 1 and 10')
    if args.profile == 't4-fp32':
        engine = json.loads((checkout / 'teamfight-trial-engine.json').read_text())
        expected_files = engine['files']
    else:
        expected_files = pins['upstream_sha256']
        engine = {'profile': 'tokenrig-native-bf16-fa2-trial-v1', 'source_commit': pins['commit'], 'qualified': False}
    for name, expected in expected_files.items():
        if sha256(checkout / name) != expected:
            raise ValueError(f'Patched source identity mismatch: {name}')
    engine['files'] = {str(p.relative_to(checkout)): sha256(p) for p in sorted((checkout / 'src').rglob('*.py'))}
    os.chdir(checkout)
    sys.path.insert(0, str(checkout))
    os.environ.update(OMP_NUM_THREADS='2', OPENBLAS_NUM_THREADS='2', GRADIO_ANALYTICS_ENABLED='False', WANDB_MODE='disabled')
    import random
    import numpy as np
    import torch
    import demo
    if args.profile == 'native' and (torch.cuda.get_device_capability()[0] < 8 or not torch.cuda.is_bf16_supported()):
        raise RuntimeError('Native profile requires Ampere or newer and native BF16')
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.cuda.reset_peak_memory_stats()
    started = time.monotonic()
    report = {
        'provider': 'tokenrig', 'qualified': False,
        'source_sha256': args.source_sha256, 'seed': args.seed,
        'engine': engine, 'model_revision': pins['huggingface']['revision'],
        'gpu': torch.cuda.get_device_name(), 'torch': torch.__version__,
        'precision': 'float32' if args.profile == 't4-fp32' else 'bfloat16',
        'attention': 'sdpa' if args.profile == 't4-fp32' else 'flash_attention_2',
        'num_beams': args.num_beams,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    # Share our process group so the supervisor's deadline also bounds Blender.
    server = subprocess.Popen([sys.executable, 'bpy_server.py'])
    try:
        demo.wait_for_bpy_server(timeout=90)
        with torch.inference_mode():
            demo.load_model(demo.MODEL_CKPTS[0], None)
            demo.model.eval()
            demo.run_rig(
                [source], 5, 0.95, 1.0, 2.0, args.num_beams, False, True, False,
                [output], demo.MODEL_CKPTS[0], None,
            )
        if not output.is_file() or output.stat().st_size < 1000:
            raise RuntimeError('TokenRig did not export a GLB')
        report.update(status='rigged_unqualified', artifact_sha256=sha256(output), artifact_bytes=output.stat().st_size)
    except Exception as error:
        report.update(status='failed', error=f'{type(error).__name__}: {error}')
        raise
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()
        report.update(seconds=time.monotonic() - started, peak_gpu_mib=torch.cuda.max_memory_allocated() / 1024**2)
        output.with_suffix('.report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
