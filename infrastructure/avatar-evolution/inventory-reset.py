"""Read-only inventory for the owner's all-45 avatar asset reset."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BINARY = {'.glb','.gltf','.bin','.blend','.blend1','.blend2','.fbx','.obj','.mtl','.stl','.png','.jpg','.jpeg','.webp','.webm','.mp4','.zip'}
roots = [ROOT/'EsportsClash.Web/public/models', ROOT/'EsportsClash.Web/dist/models', ROOT/'EsportsClash.Web/evolution-dist/models', ROOT/'infrastructure/trellis2/references']
roots += list((ROOT/'art').glob('avatars*'))
for name in ['artist-prep','character-sources','collision-review','combat-prep','contact-prep','mesh-prep','natural-motion-review','polish-prep','stance-prep','submitted-arsenaldo-review','tokenrig','tokenrig-audit','unirig']:
    roots.append(ROOT/'.local-tools'/name)
for name in ['references','equipment-references','input','output','staging','cache']:
    roots.append(ROOT/'.local-tools/trellis2/data'/name)
roots += [p for p in (ROOT/'docs').iterdir() if p.is_dir() and p.name.startswith(('stafford','rig-tail','rig-upgrade'))]
candidates = {p for folder in roots if folder.is_dir() for p in folder.rglob('*') if p.is_file() and p.suffix.lower() in BINARY}
candidates.update(p for p in (ROOT/'docs').iterdir() if p.is_file() and p.suffix.lower() in BINARY and (p.name.startswith(('avatar-','stafford','dawnna','trellis','submitted-arsenaldo')) or p.name=='esports-clash-avatars-v2.zip'))
records=[]
for path in sorted(candidates):
    resolved=path.resolve()
    if not resolved.is_relative_to(ROOT) or path.is_symlink():raise RuntimeError('Unsafe asset path: '+str(path))
    digest=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):digest.update(block)
    records.append({'path':path.relative_to(ROOT).as_posix(),'bytes':path.stat().st_size,'sha256':digest.hexdigest()})
target=ROOT/'docs/avatar-rework/asset-reset-20261024-inventory.json'
target.write_text(json.dumps({'scope':'Owner explicitly selected all 45 avatar model/reference/preview versions; gameplay/player artwork and ML records excluded','files':records,'bytes':sum(r['bytes'] for r in records)},indent=2)+'\n')
print(json.dumps({'files':len(records),'bytes':sum(r['bytes'] for r in records),'manifest':str(target)}))
