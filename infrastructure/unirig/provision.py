"""Download only pinned official public inference files. No account token needed."""
import concurrent.futures
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.local-tools/unirig/data')
PINS = json.loads((HERE / 'model-pins.json').read_text())


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def fetch(item):
    path = ROOT / 'models' / item['path']
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.stat().st_size == item['bytes'] and digest(path) == item['sha256']:
        return item['path']
    temp = path.with_suffix('.partial')
    offset = temp.stat().st_size if temp.exists() else 0
    url = 'https://huggingface.co/' + PINS['checkpoint_repo'] + '/resolve/' + PINS['checkpoint_revision'] + '/' + item['path']
    request = urllib.request.Request(url, headers={'Range': 'bytes='+str(offset)+'-', 'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(request, timeout=90) as response:
        if response.status != 206:
            offset = 0
        with temp.open('ab' if offset else 'wb') as output:
            while chunk := response.read(4 * 1024 * 1024):
                output.write(chunk)
    if temp.stat().st_size != item['bytes'] or digest(temp) != item['sha256']:
        raise RuntimeError('Official checkpoint size/hash mismatch: ' + item['path'])
    temp.replace(path)
    print('Verified '+item['path'], flush=True)
    return item['path']


if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(fetch, PINS['files']))
    opt = ROOT / 'models' / 'opt-350m'
    opt.mkdir(exist_ok=True)
    data = urllib.request.urlopen('https://huggingface.co/facebook/opt-350m/resolve/'+PINS['opt_revision']+'/config.json', timeout=30).read()
    json.loads(data)
    (opt / 'config.json').write_bytes(data)
    (ROOT / 'provision.json').write_text(json.dumps({'pins':PINS,'opt_config_sha256':hashlib.sha256(data).hexdigest()},indent=2))
    print('UniRig public checkpoints provisioned; no rigging inference or model qualification performed.',flush=True)
