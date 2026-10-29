"""Exercise the existing retarget stage on a TokenRig candidate, locally only.

Provider labels and proof filenames are substituted in memory; the deployed
UniRig code, frozen jobs and API provider configuration are never overwritten.
"""
import hashlib
import json
from pathlib import Path
import sys

folder, source, donor = map(Path, sys.argv[sys.argv.index('--') + 1:])
plan = json.loads((folder / 'preparation-plan.json').read_text())
proof = json.loads((folder / 'tokenrig-result.json').read_text())
if plan['provider'] != 'tokenrig' or proof['provider'] != 'tokenrig':
    raise RuntimeError('TokenRig trial identity is required')
if hashlib.sha256(source.read_bytes()).hexdigest() != proof['artifact']['sha256']:
    raise RuntimeError('Raw TokenRig artifact hash mismatch')
if plan['source_sha256'] != proof['source_sha256']:
    raise RuntimeError('TokenRig source identity mismatch')
if hashlib.sha256(donor.read_bytes()).hexdigest() != plan['donor_sha256']:
    raise RuntimeError('Native animation donor hash mismatch')
entry = Path('/workspace/infrastructure/avatar-evolution/retarget-unirig.py')
original = entry.read_bytes()
code = original.decode().replace('unirig', 'tokenrig').replace('UniRig', 'TokenRig')
receipt = {
    'trial_only': True, 'provider': 'tokenrig', 'source_sha256': plan['source_sha256'],
    'rig_sha256': proof['artifact']['sha256'],
    'original_retarget_sha256': hashlib.sha256(original).hexdigest(),
    'trial_retarget_sha256': hashlib.sha256(code.encode()).hexdigest(),
    'substitutions': {'unirig': 'tokenrig', 'UniRig': 'TokenRig'},
    'limitation': 'Exercises the unchanged retarget algorithm. Does not deploy a TokenRig API provider or qualify the result.',
}
(folder / 'retarget-trial-engine.json').write_text(json.dumps(receipt, indent=2))
exec(compile(code, str(entry), 'exec'), {'__file__': str(entry), '__name__': '__main__'})
