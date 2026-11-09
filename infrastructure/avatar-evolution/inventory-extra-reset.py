"""Inventory remaining legacy avatar copies, without overwriting the first receipt."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
suffixes={'.glb','.gltf','.bin','.blend','.blend1','.fbx','.obj','.png','.jpg','.jpeg','.webp','.zip','.mp4'}
folders=['EsportsClash.Web/avatar-review-dist/models','.local-tools/maintenance/dawnna-motion-repair','.local-tools/trellis2/router-data/input','.local-tools/trellis2/router-data/output','.local-tools/trellis2/router-data/references','.local-tools/trellis2/data/diagnostics']
files={p for name in folders for p in (root/name).rglob('*') if p.is_file() and p.suffix.lower() in suffixes}
for name in ['.local-tools/roundtrip.glb','.local-tools/dawnna-stance-candidate.glb','.local-tools/maintenance/dawnna-contact-candidate.glb','.local-tools/trellis2/stafford-prepared.glb','.local-tools/trellis2/router-data/stafford-tokenrig.glb','.local-tools/trellis2/router-data/stafford-base-apose-tokenrig.glb']:
    p=root/name
    if p.is_file():files.add(p)
files.update(p for p in (root/'docs').glob('arsenaldo-*') if p.is_file() and p.suffix.lower() in suffixes)
files.update(p for p in (root/'.local-tools/backoffice-review').glob('*') if p.is_file() and p.suffix.lower() in suffixes and p.name.startswith(('dawnna-calibrated-','equipped-dawnna-')))
records=[]
for p in sorted(files):
    if p.is_symlink() or not p.resolve().is_relative_to(root):raise RuntimeError('Unsafe artifact path')
    records.append({'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
report={'scope':'Legacy avatar review-build, diagnostic and reference copies; excludes new Mirelle artifacts and tool files','files':records,'bytes':sum(r['bytes'] for r in records)}
(root/'docs/avatar-rework/asset-reset-20261024-extra-inventory.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'files':len(records),'bytes':report['bytes']}))
