"""Blender-only retained-rig trial; new folder, pinned inputs, no inference/API writes.

Usage: blender -b --python diagnose_retarget.py -- OLD_FOLDER RAW_RIG DONOR NEW_FOLDER
"""
import hashlib
import json
from pathlib import Path
import sys
import argparse

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('old',type=Path);parser.add_argument('raw',type=Path)
parser.add_argument('donor',type=Path);parser.add_argument('output',type=Path)
parser.add_argument('--appendage-spec',type=Path)
parser.add_argument('--motion-repairs',type=Path)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
old,raw,donor,output=args.old,args.raw,args.donor,args.output
plan = json.loads((old / 'preparation-plan.json').read_text())
proof = json.loads((old / 'tokenrig-result.json').read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
if plan['provider'] != 'tokenrig' or proof['provider'] != 'tokenrig':
    raise RuntimeError('Expected retained TokenRig trial')
if sha(raw) != proof['artifact']['sha256'] or sha(donor) != plan['donor_sha256']:
    raise RuntimeError('Frozen rig or donor mismatch')
if plan['source_sha256'] != proof['source_sha256']:
    raise RuntimeError('Frozen generation mismatch')
output.mkdir(exist_ok=False)
plan = {**plan, 'rig_stage_diagnostics': True, 'diagnostic_parent': str(old)}
if args.appendage_spec:
    plan['appendage_repairs']=json.loads(args.appendage_spec.read_text())
    plan['appendage_spec_sha256']=sha(args.appendage_spec)
if args.motion_repairs:
    plan['motion_repairs']=json.loads(args.motion_repairs.read_text())
    plan['motion_repairs_sha256']=sha(args.motion_repairs)
(output / 'preparation-plan.json').write_text(json.dumps(plan, indent=2))
(output / 'tokenrig-result.json').write_text(json.dumps(proof, indent=2))
entry = Path('/workspace/infrastructure/avatar-evolution/retarget-unirig.py')
code = entry.read_text().replace('unirig', 'tokenrig').replace('UniRig', 'TokenRig')
engine = {p.name: sha(p) for p in [entry, *entry.parent.glob('retarget_*.py'),
    entry.parent / 'equipment_skin.py', * (entry.parent / 'asset_pipeline').glob('*.py')]}
(output / 'diagnostic-engine.json').write_text(json.dumps({
    'trial_only': True, 'publication_eligible': False, 'raw_sha256': sha(raw),
    'source_sha256': plan['source_sha256'], 'donor_sha256': sha(donor), 'files': engine}, indent=2))
sys.argv = [str(entry), '--', str(output), str(raw), str(donor)]
exec(compile(code, str(entry), 'exec'), {'__file__': str(entry), '__name__': '__main__'})
