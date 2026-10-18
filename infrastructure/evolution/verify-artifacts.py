"""Read-only deployment witnesses. Execute inside the runner with Python stdin.

Snapshots never fit a model or change evidence. Final verification also reloads
the actual checkpoint and checks data separation, source and registry hashes.
"""
import collections
import gzip
import hashlib
import json
import sqlite3
import statistics
import sys
import uuid
from pathlib import Path

ROOT = Path('/data')
run_id, mode = sys.argv[1:3]
assert str(uuid.UUID(run_id)) == run_id
folder = ROOT / run_id


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def load(name):
    return json.loads((folder / name).read_text())


cases = [json.loads(p.read_text()) for p in sorted(folder.glob('case-*.json'), key=lambda p: int(p.stem.split('-')[1]))]
files = [folder / name for name in ('plan.json', 'execution.json', 'proper.json', 'checkpoint.pt', 'candidate.json', 'freeze.json') if (folder / name).exists()]
for case in cases:
    files.append(folder / f"case-{case['seed']}.json")
    raw = folder / f"raw-{case['seed']}.json.gz"
    if not raw.exists(): raw = folder / f"raw-{case['seed']}.json"
    if raw.exists():
        assert digest(raw) == case.get('rawHash'), 'Raw evidence changed'
        files.append(raw)
report = {'id': run_id, 'state': load('state.json'), 'starts': load('starts.json'),
    'case_statuses': dict(collections.Counter(e['status'] for e in cases)),
    'hashes': {p.name: digest(p) for p in files}, 'raw_hashes_verified': True}
if mode == 'final':
    assert report['state']['status'] == 'completed'
    plan, execution, proper, candidate, freeze, result = [load(name + '.json') for name in ('plan', 'execution', 'proper', 'candidate', 'freeze', 'result')]
    assert len(cases) == len(execution['cases']) == sum(plan[k] for k in ('fit_cases', 'calibration_cases', 'evaluation_cases'))
    assert [(e['seed'], e['split']) for e in cases] == [(e['seed'], e['split']) for e in execution['cases']]
    assert not result['promoted'] and not plan['automatic_promotion'] and not result['evaluation']['production_eligible']
    assert digest(folder / 'candidate.json') == freeze['candidate_hash'] == result['candidate_hash']
    assert digest(folder / 'proper.json') == freeze['proper_hash'] == candidate['proper_hash']
    for source, expected in execution['manifest']:
        path = Path(source) if source.startswith('/') else Path('/workspace/EsportsClash.Web') / source
        assert digest(path) == expected, 'Frozen source changed: ' + source
    splits = {split: [e for e in cases if e['split'] == split] for split in ('fit', 'calibration', 'heldout')}
    for split, key, model in [('fit', 'data_hash', proper), ('calibration', 'calibration_hash', candidate)]:
        assert hashlib.sha256(json.dumps(splits[split], sort_keys=True).encode()).hexdigest() == model[key]
    heldout_seeds = {e['seed'] for e in splits['heldout']}
    calibration_seeds = set(candidate['fit']['policy']['calibrationSeeds'])
    assert not set(proper['trainingSeeds']) & (heldout_seeds | calibration_seeds)
    assert not heldout_seeds & calibration_seeds
    for case in splits['heldout']:
        if case['status'] != 'valid': continue
        raw = json.loads(gzip.decompress((folder / f"raw-{case['seed']}.json.gz").read_bytes()))
        assert raw['rewardModelHash'] == result['candidate_hash']
    sys.path.insert(0, '/runner')
    import torch
    from training import score
    checkpoint = torch.load(folder / 'checkpoint.pt', map_location='cpu', weights_only=True)
    restored = {'weights': {'farm': {}, 'push': {}}}
    for (action, key), value in zip(checkpoint['keys'], checkpoint['weights'].tolist()):
        restored['weights'][action][key] = value
    assert restored['weights'] == proper['policy']['weights']
    assert checkpoint['training_seeds'] == proper['trainingSeeds']
    assert checkpoint['optimizer']['state']
    differences = [abs(score(restored, action, e['taskContext']) - score(proper['policy'], action, e['taskContext']))
        for e in cases if e['status'] == 'valid' for action in ('farm', 'push')]
    assert max(differences, default=0) == 0
    db = sqlite3.connect(ROOT / '.management/registry.sqlite3')
    rows = db.execute("SELECT a.path,a.sha FROM artifacts a WHERE a.state='present' AND EXISTS(SELECT 1 FROM refs r WHERE r.artifact_id=a.id)").fetchall()
    for path, expected in rows:
        assert digest(ROOT / path) == expected, 'Protected artifact changed: ' + path
    samples = [json.loads(row[0]) for row in db.execute('SELECT value FROM telemetry WHERE at>=? ORDER BY at', (execution['started_unix'],))]
    resources = {'scope': 'Worker cgroup / Linux Docker VM; sampled, not Windows physical RAM',
        'samples': len(samples), 'gpu_vram_mib': None}
    if samples:
        resources.update(mean_anon_mib=statistics.mean(s['ml_anon_mib'] for s in samples),
            maximum_sampled_anon_mib=max(s['ml_anon_mib'] for s in samples),
            minimum_vm_available_mib=min(s['vm_available_mib'] for s in samples),
            maximum_cgroup_lifetime_peak_mib=max(s['cgroup_peak_mib'] for s in samples),
            maximum_oom_kills=max(s['oom_kills'] for s in samples))
    report.update(result=result, splits={s: dict(collections.Counter(e['status'] for e in es)) for s, es in splits.items()},
        checkpoint_reload={'weights_identical': True, 'optimizer_present': True, 'maximum_score_difference': max(differences, default=0)},
        protected_artifacts_verified=len(rows), source_manifest_verified=True,
        frozen_candidate_verified=True, independent_seeds_verified=True,
        compressed_raw_bytes=sum(p.stat().st_size for p in folder.glob('raw-*.json.gz')),
        persistent_browser_profile_exists=(folder / 'browser-profile').exists(), measured_resources=resources)
    db.close()
elif mode != 'snapshot':
    raise ValueError('Expected snapshot or final')
print(json.dumps(report, indent=2))
