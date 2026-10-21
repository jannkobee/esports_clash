"""Explicit, versioned model provisioning. Never runs inside inference jobs.

Official gated DINOv3 must be available first. No ungated mirror fallback.
HF_TOKEN_FILE is mounted only into this one-shot provisioning container.
"""
import hashlib
import json
import os
import time
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(os.environ.get('TRELLIS_DATA', '/trellis-data'))
PINS = json.loads(Path(__file__).with_name('model-pins.json').read_text())


class PrivateRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        if urllib.parse.urlsplit(newurl).scheme != 'https':
            raise RuntimeError('Checkpoint redirect requires HTTPS')
        redirected = super().redirect_request(request, fp, code, msg, headers, newurl)
        if redirected and urllib.parse.urlsplit(newurl).netloc != urllib.parse.urlsplit(request.full_url).netloc:
            redirected.remove_header('Authorization')
        return redirected


OPENER = urllib.request.build_opener(PrivateRedirect)


def download(item, temp, headers):
    for attempt in range(3):
        offset = temp.stat().st_size if temp.exists() else 0
        if offset == item['bytes']:
            return
        if offset > item['bytes']:
            raise RuntimeError('Partial checkpoint exceeds expected size: ' + item['local'])
        request_headers = dict(headers)
        if offset:
            request_headers['Range'] = f'bytes={offset}-'
        try:
            with OPENER.open(urllib.request.Request(url(item), headers=request_headers), timeout=120) as response:
                if offset and response.status == 206:
                    if not response.headers.get('Content-Range', '').startswith(f'bytes {offset}-'):
                        raise RuntimeError('Unexpected checkpoint range response')
                    mode = 'ab'
                else:
                    mode, offset = 'wb', 0
                with temp.open(mode) as stream:
                    for block in iter(lambda: response.read(8 * 1024 * 1024), b''):
                        offset += len(block)
                        if offset > item['bytes']:
                            raise RuntimeError('Checkpoint exceeds pinned size')
                        stream.write(block)
            return
        except (OSError, urllib.error.URLError) as error:
            if attempt == 2:
                raise RuntimeError('Checkpoint download failed: ' + item['remote'] + ' (' + type(error).__name__ + ')') from None
            time.sleep(2)


def digest(path, item):
    if item.get('sha256'):
        h = hashlib.sha256()
    else:
        h = hashlib.sha1()
        h.update(f'blob {item["bytes"]}\0'.encode())
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def provision():
    token_file = Path(os.environ.get('HF_TOKEN_FILE', '/run/secrets/hf_token'))
    token = token_file.read_text().strip() if token_file.is_file() else ''
    if not token:
        fallback_file = Path(__file__).resolve().parent.parent.parent / '.local-tools/trellis2/hf-token.txt'
        if fallback_file.is_file():
            token = fallback_file.read_text().strip()
    if not token:
        colab_token = Path('/content/esports-trellis2/hf-token.txt')
        if colab_token.is_file():
            token = colab_token.read_text().strip()
    if not token:
        token = os.environ.get('HF_TOKEN') or os.environ.get('HUGGING_FACE_HUB_TOKEN', '')
    # Check licensed access before downloading several gigabytes of public files.
    dino = next(f for f in PINS['files'] if f['repo'].startswith('facebook/') and f['remote'].endswith('.safetensors'))
    headers = {'Authorization': 'Bearer ' + token} if token else {}
    try:
        with OPENER.open(urllib.request.Request(url(dino), headers=headers, method='HEAD'), timeout=30):
            pass
    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            raise SystemExit('DINOv3 access required: request official Hugging Face access, then configure the local HF token file. No mirrored checkpoint was downloaded.')
        raise
    print('Official DINOv3 access verified; provisioning pinned checkpoints.', flush=True)
    verified = []
    for item in PINS['files']:
        target = ROOT / 'models' / item['local']
        target.parent.mkdir(parents=True, exist_ok=True)
        expected = item.get('sha256') or item['git_blob']
        if target.exists():
            if target.stat().st_size != item['bytes'] or digest(target, item) != expected:
                raise RuntimeError('Existing immutable checkpoint is corrupt: ' + item['local'])
        else:
            temp = target.with_name(target.name + '.partial')
            # Never forward the token to a community repository.
            download(item, temp, headers if item['repo'].startswith('facebook/') else {})
            if temp.stat().st_size != item['bytes'] or digest(temp, item) != expected:
                raise RuntimeError('Downloaded checkpoint hash mismatch: ' + item['local'])
            temp.rename(target)
        verified.append({'file': item['local'], 'bytes': target.stat().st_size, 'sha256': sha256(target)})
        print('Verified', item['local'], flush=True)
    result = {'version': 1, 'quantization': PINS['quantization'], 'files': verified}
    manifest = ROOT / 'checkpoints.json'
    temporary = manifest.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(result, indent=2))
    temporary.replace(manifest)


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def url(item):
    return f'https://huggingface.co/{item["repo"]}/resolve/{item["revision"]}/{item["remote"]}'


if __name__ == '__main__':
    provision()
