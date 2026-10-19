"""Run the pinned upstream transfer in standalone Blender, with normal shutdown.

The bpy wheel crashes at interpreter shutdown after textured GLB export. Blender
4.5.3 is the same checksum-pinned runtime already used by avatar preparation.
No inference, geometry transfer, or weight assignment algorithm is replaced.
"""
import sys
from pathlib import Path

# Blender supplies bpy and NumPy; use the worker's pinned remaining dependencies.
sys.path.extend(['/opt/UniRig', '/usr/local/lib/python3.11/site-packages'])
import bpy
from src.inference.merge import transfer

source, target, output = sys.argv[sys.argv.index('--') + 1:]
if not all(Path(p).is_absolute() for p in (source, target, output)):
    raise ValueError('Material transfer requires fixed absolute job paths')
transfer(source, target, output, add_root=False)
if not Path(output).is_file():
    raise RuntimeError('Upstream material transfer produced no output')
print('Upstream material transfer complete; normal Blender shutdown follows', flush=True)
