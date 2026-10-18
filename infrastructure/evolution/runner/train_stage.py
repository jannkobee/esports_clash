"""Isolated Torch stage: frees tensor/optimizer/import memory before evaluation."""
import json
import sys
from pathlib import Path
from training import fit
from server import write_json
from operations import Operations
import hashlib

folder = Path(sys.argv[1])
examples = [json.loads(p.read_text()) for p in sorted(folder.glob('case-*.json'), key=lambda p: int(p.stem.split('-')[1]))]
fitting = [e for e in examples if e['split'] == 'fit']
execution = json.loads((folder / 'execution.json').read_text())
reserved = {e['seed'] for e in execution['cases'] if e['split'] != 'fit'}
bank, sources = [], []
capacity = json.loads((folder / 'plan.json').read_text()).get('operations', {}).get('replay_capacity', 512)
seen = {e['seed'] for e in fitting} | reserved
for previous in sorted(folder.parent.iterdir(), key=lambda p: (p / 'result.json').stat().st_mtime if (p / 'result.json').exists() else 0, reverse=True):
    if len(bank) + len(fitting) >= capacity: break
    if previous == folder or not (previous / 'proper.json').exists() or not (previous / 'result.json').exists(): continue
    previous_execution = json.loads((previous / 'execution.json').read_text())
    if previous_execution['source_hash'] != execution['source_hash']: continue
    prior = [json.loads(p.read_text()) for p in sorted(previous.glob('case-*.json'), key=lambda p: int(p.stem.split('-')[1]))]
    prior_fit = [e for e in prior if e['split'] == 'fit']
    frozen = json.loads((previous / 'proper.json').read_text())
    if frozen.get('data_hash') != hashlib.sha256(json.dumps(prior_fit, sort_keys=True).encode()).hexdigest():
        raise ValueError('Historical fitting evidence changed')
    for example in prior_fit:
        if example['seed'] in seen or example['status'] != 'valid' or len(bank) + len(fitting) >= capacity: continue
        # Retain only validated fitting examples, never past calibration/evaluation outcomes.
        raw = previous / f"raw-{example['seed']}.json.gz"
        if not raw.exists(): raw = previous / f"raw-{example['seed']}.json"
        if not raw.exists() or hashlib.sha256(raw.read_bytes()).hexdigest() != example.get('rawHash'):
            raise ValueError('Historical raw fitting evidence changed')
        bank.append(example); seen.add(example['seed'])
    sources.append(previous.name)
proper = fit([*bank, *fitting], folder, json.loads((folder / 'plan.json').read_text()).get('operations', {}).get('batch_size', 64))
proper['supportedPushKinds'] = sorted({kind for e in fitting if e['status'] == 'valid'
    for kind in ('advance', 'camp-exit', 'structure', 'minion') if e['taskContext']['actions']['push'].get('task:kind:' + kind) == 1})
proper['data_hash'] = hashlib.sha256(json.dumps(fitting, sort_keys=True).encode()).hexdigest()
proper['retained_knowledge'] = {'prior_fitting_examples': len(bank), 'source_runs': sources,
    'seeds': [e['seed'] for e in bank], 'no_calibration_or_evaluation_examples': True, 'capacity': capacity}
write_json(folder / 'proper.json', proper)
