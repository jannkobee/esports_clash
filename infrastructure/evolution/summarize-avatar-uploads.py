"""Build a resumable receipt inventory. This does not process or qualify 3D assets."""
import glob, hashlib, json
from pathlib import Path

root = Path('docs/pipeline-audit-20261024')
roster = json.loads((root / 'roster-inventory.json').read_text(encoding='utf-8'))
receipts = []
for filename in sorted(glob.glob(str(root / 'uploads-*.receipts.json'))):
    receipts.extend(json.loads(Path(filename).read_text(encoding='utf-8')))
rows = []
for avatar in roster:
    saved = {r['id']: r for r in receipts if r['avatar_id'] == avatar['id']}
    rows.append({'avatar_id': avatar['id'], 'name': avatar['name'],
                 'base_reference': saved.get('base'),
                 'appearance_design': saved.get('appearance_design'),
                 'isolated_equipment': [r for k, r in saved.items() if k not in ('base', 'appearance_design')],
                 'qualified_model': False})
report = {'schema': 1, 'scope': 'Reference uploads only; no 3D processing or publication',
          'avatars': len(rows), 'base_references_uploaded': sum(bool(r['base_reference']) for r in rows),
          'appearance_designs_uploaded': sum(bool(r['appearance_design']) for r in rows),
          'isolated_equipment_uploaded': sum(len(r['isolated_equipment']) for r in rows),
          'qualified_models': 0, 'rows': rows}
(root / 'upload-progress.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'rows'}))
