"""Recover byte-identical base evidence from retained stages; no asset processing."""
import argparse
import hashlib
import json
from pathlib import Path
import uuid


def recover(manifest, root, stages):
    candidate_id = str(uuid.UUID(manifest['id']))
    if candidate_id != manifest['id'] or manifest['status'] != 'animated_base_unqualified':
        raise ValueError('Only the explicitly retained failed base evidence can be recovered')
    root = root.resolve()
    target = root / candidate_id
    if target.is_symlink():
        raise ValueError('Evidence destination cannot be a symlink')
    target.mkdir(exist_ok=True)
    recovered, unavailable = [], []
    for name, expected in manifest['artifacts'].items():
        if Path(name).name != name:
            raise ValueError('Unexpected artifact filename')
        destination = target / name
        choices = [destination, *[root / stage / name for stage in stages]]
        if any(not path.resolve().is_relative_to(root) for path in choices):
            raise ValueError('Evidence recovery must remain inside avatar storage')
        def valid(path):
            return (path.is_file() and not path.is_symlink() and path.stat().st_size == expected['bytes']
                    and hashlib.sha256(path.read_bytes()).hexdigest() == expected['sha256'])
        if destination.exists():
            if not valid(destination):
                raise ValueError('Existing candidate evidence changed: ' + name)
            continue
        source = next((path for path in choices[1:] if valid(path)), None)
        if source is None:
            unavailable.append(name)
            continue
        with destination.open('xb') as stream:
            stream.write(source.read_bytes())
        if not valid(destination):
            raise ValueError('Recovered evidence failed its recorded hash: ' + name)
        recovered.append({'file': name, **expected})
    return {'candidate_id': candidate_id, 'status': manifest['status'], 'recovered': recovered,
            'unavailable': unavailable, 'publication_eligible': False,
            'scope': 'Storage recovery of exact retained failed evidence only. No processing, new qualification or publication.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--root', type=Path, default=Path('/avatar-data'))
    parser.add_argument('--stage', action='append', required=True)
    args = parser.parse_args()
    result = recover(json.loads(args.manifest.read_text(encoding='utf-8-sig')), args.root, args.stage)
    print(json.dumps(result, indent=2))
