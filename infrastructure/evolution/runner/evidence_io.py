"""Read immutable evidence, with explicit legacy compressed-hash provenance."""
import gzip
import hashlib
import json


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_raw(folder, case):
    candidates = [folder / f"raw-{case['seed']}.json.gz", folder / f"raw-{case['seed']}.json"]
    paths = [path for path in candidates if path.is_file()]
    if not paths:
        raise ValueError('Missing raw evidence for seed ' + str(case['seed']))
    if len(paths) > 1:
        raise ValueError('Ambiguous raw evidence for seed ' + str(case['seed']))
    path = paths[0]
    stored = path.read_bytes()
    content = gzip.decompress(stored) if path.suffix == '.gz' else stored
    stored_hash = hashlib.sha256(stored).hexdigest()
    content_hash = hashlib.sha256(content).hexdigest()
    expected = case.get('rawHash')
    if expected == stored_hash:
        basis = 'stored-bytes'
    elif path.suffix == '.gz' and expected == content_hash:
        basis = 'legacy-decompressed-bytes'
    else:
        raise ValueError('Raw evidence hash changed for seed ' + str(case['seed']))
    return json.loads(content), {'file': path.name, 'stored_sha256': stored_hash,
                                'content_sha256': content_hash, 'hash_basis': basis, 'bytes': len(stored)}


def validate_case_allocation(execution, cases):
    planned = {}
    seen = set()
    for item in execution['cases']:
        seed = item['seed']
        if type(seed) is not int or seed < 1 or seed in planned or item['split'] not in ('fit', 'calibration', 'heldout'):
            raise ValueError('Duplicate or invalid planned seed/split')
        planned[seed] = item
    for case in cases:
        seed = case.get('seed')
        if seed in seen or seed not in planned:
            raise ValueError('Duplicate or unplanned collected seed')
        seen.add(seed)
        for key, value in planned[seed].items():
            if case.get(key) != value:
                raise ValueError('Collected case differs from frozen allocation: ' + key)
    return planned
