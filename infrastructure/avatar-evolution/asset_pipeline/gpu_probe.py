"""Execute inside the pinned local GPU Python, never in the coordinator env."""
import json
import platform
import torch

if not torch.cuda.is_available():
    raise RuntimeError('No compatible torch CUDA device')

ram_mib = int(next(line.split()[1] for line in open('/proc/meminfo') if line.startswith('MemAvailable:'))) // 1024
print(json.dumps({'accelerator': 'cuda', 'python': '.'.join(platform.python_version_tuple()[:2]),
    'environment': 'asset-quality-stdlib-v1', 'available_ram_mib': ram_mib,
    'free_vram_mib': torch.cuda.mem_get_info()[0] // 1048576,
    'cuda': torch.version.cuda, 'device': torch.cuda.get_device_name(0)}))
