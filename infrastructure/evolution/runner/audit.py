"""Read-only inventory; historical thresholds, artifacts and results stay immutable."""
import collections
import hashlib
import json
import sys
from pathlib import Path
from evidence_io import read_raw, sha, validate_case_allocation
from regression import diagnose
from training import score


def read(path, default=None):
    return json.loads(path.read_text()) if path.is_file() else default


def audit_study(folder):
    result = read(folder / 'result.json', {})
    proper = read(folder / 'proper.json', {})
    execution = read(folder / 'execution.json', {})
    state = read(folder / 'state.json', {})
    candidate = read(folder / 'candidate.json', {})
    cases = [read(p) for p in sorted(folder.glob('case-*.json'), key=lambda p: int(p.stem.split('-')[1]))]
    errors, attestations, reasons = [], [], []
    splits = {}
    try:
        validate_case_allocation(execution, cases)
    except (ValueError, KeyError) as error:
        errors.append('Execution allocation unavailable or inconsistent: ' + str(error))
    for split in ('fit', 'calibration', 'heldout'):
        group = [e for e in cases if e['split'] == split]
        valid = [e for e in group if e['status'] == 'valid']
        splits[split] = {'planned': sum(e['split'] == split for e in execution.get('cases', [])),
            'attempted': len(group), 'statuses': dict(collections.Counter(e['status'] for e in group)),
            'cards': len({e['cardId'] for e in valid}), 'drafts': len({e['draft'] for e in valid}),
            'informative': sum(abs(e['alternative']['reward'] - e['control']['reward']) >= .02 for e in valid)}
    fit_cases = [e for e in cases if e['split'] == 'fit']
    if proper and proper.get('data_hash') != hashlib.sha256(json.dumps(fit_cases, sort_keys=True).encode()).hexdigest():
        errors.append('Fitting dataset hash differs from proper.json')
    if candidate:
        if candidate.get('proper_hash') != sha(folder / 'proper.json'):
            errors.append('Candidate fitting artifact hash mismatch')
        calibration = [e for e in cases if e['split'] == 'calibration']
        if candidate.get('calibration_hash') != hashlib.sha256(json.dumps(calibration, sort_keys=True).encode()).hexdigest():
            errors.append('Candidate calibration dataset hash mismatch')
        freeze = read(folder / 'freeze.json', {})
        if freeze and freeze.get('candidate_hash') != sha(folder / 'candidate.json'):
            errors.append('Candidate differs from pre-evaluation freeze witness')
        if result.get('candidate_hash') and result['candidate_hash'] != sha(folder / 'candidate.json'):
            errors.append('Result candidate hash mismatch')
        model = candidate.get('fit', {}).get('policy') or {}
        seeds = [*proper.get('trainingSeeds', []), *model.get('calibrationSeeds', []),
                 *[e['seed'] for e in execution.get('cases', []) if e['split'] == 'heldout']]
        if len(seeds) != len(set(seeds)):
            errors.append('Training/calibration/evaluation seed overlap')
    for case in cases:
        if not case.get('rawHash') and case['status'] != 'valid':
            continue
        try:
            raw, attestation = read_raw(folder, case)
            if raw.get('seed') != case['seed']:
                raise ValueError('Raw seed differs from case')
            attestations.append(attestation)
            decision = raw.get('rewardTrial', {}).get('decision') or {}
            if decision:
                reasons.append(decision.get('reason', 'unrecorded'))
            if case['status'] == 'valid':
                arms = raw.get('replays', [])
                if len(arms) < 3 or not raw.get('validPair'):
                    raise ValueError('Valid case has no valid raw control pair')
                a, repeat, b = [arm['event'] for arm in arms[:3]]
                for key in ('fingerprint', 'followupStateFingerprint', 'teamOutcome', 'taskOutcome', 'followup', 'taskEvents'):
                    if a.get(key) != repeat.get(key):
                        raise ValueError('Repeated baseline differs: ' + key)
                if case.get('control') != a.get('teamOutcome') or case.get('alternative') != b.get('teamOutcome'):
                    raise ValueError('Cached case outcomes differ from raw evidence')
                if case['split'] == 'heldout' and 'changed' in case:
                    if len(arms) != 4 or not candidate:
                        raise ValueError('Measured heldout case lacks frozen learned replay')
                    learned = arms[3]['event']
                    selected = arms[3]['record']['selected']
                    reference = a if selected == a['incumbent'] else b
                    if selected not in (a['incumbent'], a['alternate']):
                        raise ValueError('Learned selection is outside legal recorded pair')
                    for key in ('followupStateFingerprint', 'teamOutcome', 'taskOutcome', 'followup', 'taskEvents'):
                        if learned.get(key) != reference.get(key):
                            raise ValueError('Learned execution differs from matching forced action: ' + key)
                    policy = candidate['fit']['policy']
                    predicted = score(policy['policy'], 'push', case['taskContext']) - score(policy['policy'], 'farm', case['taskContext'])
                    actual = case['alternative']['reward'] - case['control']['reward']
                    expected = {'rewardDelta': learned['teamOutcome']['reward'] - a['teamOutcome']['reward'],
                        'deathDelta': learned['taskOutcome']['deaths'] - a['taskOutcome']['deaths'],
                        'teamDeathDelta': learned['teamOutcome']['ownDeaths'] - a['teamOutcome']['ownDeaths'],
                        'changed': selected != a['incumbent'], 'predictionError': (predicted-actual)**2,
                        'zeroError': actual**2, 'covered': actual >= predicted-policy['calibration']['errorBuffer']}
                    for key, value in expected.items():
                        observed = case.get(key)
                        if (type(value) is bool and observed is not value) or (type(value) is not bool
                            and (not isinstance(observed, (int, float)) or abs(observed-value) > 1e-10)):
                            raise ValueError('Cached learned metric differs from raw/model: ' + key)
        except (ValueError, OSError, KeyError, EOFError) as error:
            errors.append(f"Seed {case['seed']}: {error}")
    heldout = [e for e in cases if e['split'] == 'heldout']
    diagnostics = diagnose(heldout, splits['heldout']['planned'], proper.get('history'), proper.get('fittedLoss')) if not errors else None
    return {'id': folder.name, 'status': state.get('status', 'unknown'), 'error': state.get('error'),
        'source_hash': execution.get('source_hash'), 'splits': splits,
        'artifact_hashes': {name: sha(folder / name) for name in ('plan.json', 'execution.json', 'proper.json',
            'candidate.json', 'checkpoint.pt', 'freeze.json', 'result.json') if (folder / name).is_file()},
        'integrity': {'passed': not errors, 'errors': errors, 'raw_files_verified': len(attestations),
            'hash_bases': dict(collections.Counter(a['hash_basis'] for a in attestations)),
            'raw_manifest_sha256': hashlib.sha256(json.dumps(attestations, sort_keys=True).encode()).hexdigest(),
            'scope': 'Stored hashes, allocations and repeated recorded baseline; no historical source reexecution'},
        'historical_evaluation': result.get('evaluation'), 'diagnostics': diagnostics,
        'fit': {k: proper.get(k) for k in ('trainingEpisodes', 'informativeEpisodes', 'fittedLoss')},
        'confidence_buffer': ((candidate.get('fit', {}).get('policy') or {}).get('calibration') or {}).get('errorBuffer'),
        'decision_reasons': dict(collections.Counter(reasons)), 'production_eligible': False}


def audit(root):
    studies = []
    for folder in sorted(Path(root).iterdir()):
        if folder.is_dir() and not folder.name.startswith('.') and (folder / 'state.json').is_file():
            try:
                studies.append(audit_study(folder))
            except (ValueError, OSError, KeyError, TypeError) as error:
                studies.append({'id': folder.name, 'integrity': {'passed': False, 'errors': [str(error)]},
                                'diagnostics': None, 'production_eligible': False})
    return {'version': 2, 'scope': 'Read-only historical reanalysis; exposed seeds cannot be fresh evaluation.',
            'studies': studies, 'summary': {'studies': len(studies),
                'integrity_failures': sum(not s['integrity']['passed'] for s in studies),
                'statuses': dict(collections.Counter(s.get('status', 'unreadable') for s in studies)),
                'signals': dict(collections.Counter(signal for s in studies for signal in (s.get('diagnostics') or {}).get('signals', [])))}}


if __name__ == '__main__':
    print(json.dumps(audit(sys.argv[1] if len(sys.argv) > 1 else '/data'), indent=2, allow_nan=False))
