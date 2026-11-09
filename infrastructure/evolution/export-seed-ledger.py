"""Read-only seed inventory for isolated parameter studies.

This is a snapshot, not a PostgreSQL reservation. Keep study planning serialized
with the normal scheduler until shared allocator integration is implemented.
"""
import argparse
import hashlib
import json
from pathlib import Path


def export(studies, docs, experiments):
    seeds, manifest, errors = set(), [], []
    def walk(item):
        if isinstance(item, dict):
            for key, value in item.items():
                normalized = key.lower().replace('_', '')
                if normalized == 'seed' and type(value) is int and 0 < value <= 1000000:
                    seeds.add(value)
                elif normalized == 'seedstart' and type(value) is int and 0 < value <= 1000000:
                    # Laravel allocates whole 1000-seed blocks, including failures.
                    seeds.update(range(value, min(1000001, value+1000)))
                elif normalized.endswith('seeds') and isinstance(value, list):
                    seeds.update(seed for seed in value if type(seed) is int and 0 < seed <= 1000000)
                walk(value)
        elif isinstance(item, list):
            for value in item:
                walk(value)
    sources = set(Path(studies).glob('*/plan.json')) | set(Path(studies).glob('*/execution.json'))
    sources |= set(Path(docs).glob('ml-*.json')) | set(Path(experiments).glob('*/plan.json'))
    if not Path(studies).is_dir() or not Path(docs).is_dir():
        errors.append('Studies and historical docs must both be available')
    for path in sorted(sources):
        try:
            data = path.read_bytes()
            walk(json.loads(data))
            manifest.append({'file': str(path), 'sha256': hashlib.sha256(data).hexdigest()})
        except (OSError, ValueError) as error:
            errors.append(str(path)+': '+str(error))
    return {'version': 1, 'complete': not errors, 'exposed_seeds': sorted(seeds), 'manifest': manifest,
            'errors': errors, 'atomic_reservation': False,
            'scope': 'All retained study plans/executions, historical ml JSON and supplied experiment plans. '
                     'Snapshot only; planning must be serialized with Laravel allocation.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('studies'); parser.add_argument('docs'); parser.add_argument('experiments'); parser.add_argument('output')
    args = parser.parse_args()
    result = export(args.studies, args.docs, args.experiments)
    with open(args.output, 'x') as output:
        json.dump(result, output, indent=2)
    print(json.dumps({'complete': result['complete'], 'exposed_seeds': len(result['exposed_seeds']), 'errors': result['errors']}))
