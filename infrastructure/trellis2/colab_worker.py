"""Colab RPC adapter for the same native TRELLIS.2 service used locally.

Runs in an isolated notebook namespace. No Shap-E or procedural generation.
The private native service is installed beneath /content/esports-trellis2.
"""
import base64
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

MAX_BYTES = 32 * 1024 * 1024


def request(method, path, payload=None, timeout=5):
    allowed = (path == '/operations' and method == 'GET') or (
        re.fullmatch(r'/jobs/[0-9a-f-]{36}(?:/artifact|/cancel)?', path) and method in {'GET', 'POST'}) or (
        re.fullmatch(r'/references/[a-z0-9_]+', path) and method == 'POST')
    if not allowed:
        raise ValueError('Unsupported native TRELLIS.2 operation')
    token_file = Path('/content/esports-trellis2/.worker-token')
    if not token_file.is_file():
        return {'transport_error': 'Colab is connected, but native TRELLIS.2 has not been provisioned.'}
    body = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request('http://127.0.0.1:8096' + path, method=method, data=body,
        headers={'Authorization': 'Bearer ' + token_file.read_text().strip(), 'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.HTTPError as error:
        response = error
    except (OSError, TimeoutError):
        return {'transport_error': 'Colab is connected, but its native TRELLIS.2 service is offline.'}
    with response:
        content = response.read(MAX_BYTES + 1)
        if len(content) > MAX_BYTES:
            raise ValueError('Native response exceeds the artifact size limit')
        binary = method == 'GET' and path.endswith('/artifact') and response.status == 200
        if binary:
            value = base64.b64encode(content).decode()
        else:
            try:
                value = json.loads(content)
            except ValueError:
                value = {'error': content.decode(errors='replace')[:500]}
        return {'status': response.status, 'data': value, 'binary': binary}
