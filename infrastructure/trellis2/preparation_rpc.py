"""Allowlisted loopback-only RPC into the Colab preparation services."""
import base64
import json
from pathlib import Path
import re
import urllib.error
import urllib.request


def request(method, path, payload=None, timeout=5):
    match = re.fullmatch(r'/(rigging|animation)(/.*)', path)
    if not match:
        raise ValueError('Unsupported cloud preparation stage')
    stage, operation = match.groups()
    allowed = ((operation == '/operations' and method == 'GET')
               or (re.fullmatch(r'/jobs/[0-9a-f-]{36}', operation) and method in ('GET', 'POST'))
               or (re.fullmatch(r'/jobs/[0-9a-f-]{36}/cancel', operation) and method == 'POST')
               or (re.fullmatch(r'/jobs/[0-9a-f-]{36}/artifact', operation) and method == 'GET')
               or (re.fullmatch(r'/inputs/[0-9a-f]{64}', operation) and method == 'POST'))
    if not allowed:
        raise ValueError('Unsupported cloud preparation operation')
    token = Path('/content/teamfight-preparation/.worker-token')
    if not token.is_file():
        return {'transport_error': 'Google Colab preparation has not been provisioned.'}
    port = 8098 if stage == 'rigging' else 8097
    body = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(f'http://127.0.0.1:{port}' + operation,
        method=method, data=body, headers={'Authorization': 'Bearer ' + token.read_text().strip(),
                                         'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.HTTPError as error:
        response = error
    except (OSError, TimeoutError):
        return {'transport_error': f'The Google Colab {stage} service is offline. Local fallback is disabled.'}
    with response:
        content = response.read(64 * 1024**2 + 1)
        if len(content) > 64 * 1024**2:
            raise ValueError('Cloud preparation response exceeds 64 MiB')
        binary = method == 'GET' and operation.endswith('/artifact') and response.status == 200
        if binary:
            value = base64.b64encode(content).decode()
        else:
            try:
                value = json.loads(content)
            except ValueError:
                value = {'error': content.decode(errors='replace')[:500]}
        return {'status': response.status, 'data': value, 'binary': binary}
