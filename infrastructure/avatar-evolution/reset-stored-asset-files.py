"""Remove only inventoried avatar binary payloads; never delete job/audit metadata."""
import hashlib
import json
import sys
from pathlib import Path

SUFFIXES={'.glb','.gltf','.bin','.blend','.blend1','.blend2','.fbx','.obj','.mtl','.stl','.png','.jpg','.jpeg','.webp','.webm','.mp4','.zip'}
ROOTS=[Path('/avatar-data'),Path('/workspace/EsportsClash.Web/public/models')]
records=[]
for root in ROOTS:
    if not root.is_dir():continue
    resolved_root=root.resolve()
    for path in sorted(root.rglob('*')):
        if not path.is_file() or path.suffix.lower() not in SUFFIXES:continue
        if path.is_symlink() or not path.resolve().is_relative_to(resolved_root):raise RuntimeError('Unsafe artifact path')
        records.append({'path':str(path),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
receipt=Path('/avatar-data/owner-asset-reset-20261024.json')
if '--apply' in sys.argv:
    for record in records:
        path=Path(record['path'])
        if hashlib.sha256(path.read_bytes()).hexdigest()!=record['sha256']:raise RuntimeError('Asset changed after inventory')
    receipt.write_text(json.dumps({'scope':'all-45-owner-authorized-binary-deletion','files':records,'bytes':sum(r['bytes'] for r in records)},indent=2)+'\n')
    for record in records:Path(record['path']).unlink()
print(json.dumps({'files':len(records),'bytes':sum(r['bytes'] for r in records),'applied':'--apply' in sys.argv}))
