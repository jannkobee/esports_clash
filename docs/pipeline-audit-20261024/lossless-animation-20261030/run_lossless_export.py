"""Isolated Colab exporter patch, restored even if the diagnostic fails.

Use only with no other Blender export running in this preparation environment.
"""
import hashlib,json,os,subprocess,sys
from pathlib import Path
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
root=Path(sys.argv[1]).resolve()
if not root.is_relative_to('/content/teamfight-preparation/reviews'):raise ValueError('Unexpected review root')
path=Path('/content/teamfight-preparation/venv/lib/python3.11/site-packages/bpy/4.5/scripts/addons_core/io_scene_gltf2/blender/exp/primitive_extract.py')
original=path.read_bytes();before=hashlib.sha256(original).hexdigest()
if before!='884ba7f2691f1c69874c148a3058791b0621740dc5c7123799f6785fc3c87fa7':raise ValueError('Exporter source differs from pinned bpy4.5.3')
patched=original.replace(b'min_influence = 0.0001',b'min_influence = 0.0')
after=hashlib.sha256(patched).hexdigest()
if after!='38daf2e9163501fa69b5d2136eedd036cdfaa07e5ff2a1252771a92d6cc978a9':raise ValueError('Unexpected exporter patch')
receipt={'path':str(path),'before_sha256':before,'after_sha256':after,'change':'Preserve all positive skin weights','bpy_version':'4.5.3'}
try:
 path.write_bytes(patched)
 subprocess.run(['/content/teamfight-preparation/venv/bin/python',str(root/'tools/export_current_animation.py'),str(root)],check=True)
finally:
 path.write_bytes(original);receipt['dependency_restored']=hashlib.sha256(path.read_bytes()).hexdigest()==before
 (root/'exporter-patch.json').write_text(json.dumps(receipt,indent=2))
