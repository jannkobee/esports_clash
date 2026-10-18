"""Read-only diagnostics of immutable studies; never fits or changes a model."""
import collections
import hashlib
import json
import statistics
import sys
from pathlib import Path


def audit(root):
    studies = []
    for folder in sorted(Path(root).iterdir()):
        if not folder.is_dir() or not (folder / 'result.json').is_file():
            continue
        result = json.loads((folder / 'result.json').read_text())
        proper = json.loads((folder / 'proper.json').read_text())
        candidate = json.loads((folder / 'candidate.json').read_text()) if (folder / 'candidate.json').exists() else None
        cases = [json.loads(p.read_text()) for p in sorted(folder.glob('case-*.json'))]
        splits = {}
        for split in ('fit', 'calibration', 'heldout'):
            group = [e for e in cases if e['split'] == split]
            valid = [e for e in group if e['status'] == 'valid']
            splits[split] = {'planned': len(group), 'statuses': dict(collections.Counter(e['status'] for e in group)),
                'cards': len({e['cardId'] for e in valid}), 'drafts': len({e['draft'] for e in valid}),
                'informative': sum(abs(e['alternative']['reward'] - e['control']['reward']) >= .02 for e in valid)}
        reasons, predictions, bounds, scout_wall, continuation_wall, world_wall = [], [], [], [], [], []
        simulated_seconds = 0
        raw_bytes = 0
        for case in cases:
            raw_path = folder / f"raw-{case['seed']}.json"
            if not raw_path.exists():
                continue
            raw_bytes += raw_path.stat().st_size
            if case.get('rawHash') and hashlib.sha256(raw_path.read_bytes()).hexdigest() != case['rawHash']:
                raise ValueError('Raw evidence hash changed: ' + str(raw_path))
            raw = json.loads(raw_path.read_text())
            scout_wall.append(raw.get('scout', {}).get('wallSeconds', 0))
            simulated_seconds += raw.get('scout', {}).get('event', {}).get('second', raw.get('scout', {}).get('inspection', {}).get('second', 0))
            for replay in raw.get('replays', []):
                continuation_wall.append(replay.get('wallSeconds', 0))
                simulated_seconds += replay.get('event', {}).get('taskOutcome', {}).get('horizonSeconds', 0)
            marker = folder / f"attempt-{case['seed']}.started"
            if marker.exists():
                world_wall.append((folder / f"case-{case['seed']}.json").stat().st_mtime - marker.stat().st_mtime)
            decision = raw.get('rewardTrial', {}).get('decision') or {}
            if decision:
                reasons.append(decision.get('reason', 'unrecorded'))
                if decision.get('predictedAdvantage') is not None:
                    predictions.append(decision['predictedAdvantage'])
                    bounds.append(decision['lowerBoundAdvantage'])
        started = json.loads((folder / 'execution.json').read_text())['started_unix']
        elapsed = (folder / 'result.json').stat().st_mtime - started
        studies.append({'id': folder.name, 'raw_hashes_verified': True, 'splits': splits, 'evaluation': result['evaluation'],
            'fit': {k: proper.get(k) for k in ('trainingEpisodes', 'informativeEpisodes', 'fittedLoss')},
            'confidence_buffer': candidate['fit'].get('policy', {}).get('calibration', {}).get('errorBuffer') if candidate else None,
            'decision_reasons': dict(collections.Counter(reasons)),
            'predicted_advantage_range': [min(predictions), max(predictions)] if predictions else None,
            'lower_bound_range': [min(bounds), max(bounds)] if bounds else None,
            'timing': {'total_wall_seconds': elapsed, 'world_wall_mean': statistics.mean(world_wall) if world_wall else None,
                'scout_wall_mean': statistics.mean(scout_wall) if scout_wall else None,
                'continuation_wall_mean': statistics.mean(continuation_wall) if continuation_wall else None,
                'worlds_per_minute': len(cases) / (elapsed / 60), 'recorded_simulated_seconds': simulated_seconds},
            'raw_bytes': raw_bytes, 'profile_bytes': sum(p.stat().st_size for p in (folder / 'browser-profile').rglob('*') if p.is_file())})
    return {'scope': 'Historical measured Docker studies, not a controlled speed comparison; original denominators preserved.', 'studies': studies}


if __name__ == '__main__':
    print(json.dumps(audit(sys.argv[1] if len(sys.argv) > 1 else '/data'), indent=2))
