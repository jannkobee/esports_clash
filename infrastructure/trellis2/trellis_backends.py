"""Native TRELLIS.2 transports. Neither transport manufactures replacement meshes."""
import base64
import hashlib
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from colab_transport import execute as colab_execute, ColabTransportError

MODEL = 'TRELLIS.2-4B'
HASH_KEYS = ('workflow_sha256', 'pins_sha256', 'limits_sha256', 'engine_sha256')
MAX_BYTES = 32 * 1024 * 1024
ACTIVE = {'queued', 'waiting_models', 'waiting_resources', 'waiting_worker', 'running'}


class BackendError(RuntimeError):
    pass


class LocalClient:
    def __init__(self, url, token):
        self.url, self.token = url.rstrip('/'), token

    def request(self, method, path, payload=None, timeout=5):
        body = None if payload is None else json.dumps(payload).encode()
        request = urllib.request.Request(self.url + path, data=body, method=method,
            headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        try:
            response = urllib.request.urlopen(request, timeout=timeout)
        except urllib.error.HTTPError as error:
            response = error
        except (OSError, TimeoutError):
            raise BackendError('Local native TRELLIS.2 worker is unreachable.') from None
        with response:
            raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise BackendError('TRELLIS response exceeds the artifact limit.')
            if method == 'GET' and path.endswith('/artifact') and response.status == 200:
                return response.status, raw
            try:
                return response.status, json.loads(raw)
            except ValueError:
                return response.status, {'error': raw.decode(errors='replace')[:500]}


class ColabClient:
    adapter = 'colab_worker.py'
    max_bytes = MAX_BYTES
    def __init__(self, cli, session):
        self.cli, self.session = cli, session

    def request(self, method, path, payload=None, timeout=25):
        source = Path(__file__).with_name(self.adapter).read_text()
        args = json.dumps({'method': method, 'path': path, 'payload': payload, 'timeout': timeout})
        # Private namespace: keep a shared Colab notebook's globals untouched.
        code = f'''def _esports_trellis_rpc():
 import json,base64
 scope={{"__name__":"trellis_rpc"}}
 exec(compile({source!r},"trellis_rpc.py","exec"),scope)
 result=scope["request"](**json.loads({args!r}))
 print("TRELLIS_RESPONSE="+json.dumps(result))
_esports_trellis_rpc()
del _esports_trellis_rpc
'''
        try:
            output = colab_execute(self.cli, self.session, code, timeout=timeout + 5)
        except ColabTransportError:
            raise BackendError('Google Colab is disconnected or its TRELLIS.2 service did not respond.') from None
        for line in output.splitlines():
            if line.startswith('TRELLIS_RESPONSE='):
                record = json.loads(line.split('=', 1)[1])
                if record.get('transport_error'):
                    raise BackendError(record['transport_error'])
                value = record['data']
                if record.get('binary'):
                    value = base64.b64decode(value, validate=True)
                    if len(value) > self.max_bytes:
                        raise BackendError('Colab artifact exceeds the size limit.')
                return record['status'], value
        raise BackendError('Google Colab session is unavailable. Reconnect it and provision native TRELLIS.2.')


class ColabPreparationClient(ColabClient):
    adapter = 'preparation_rpc.py'
    max_bytes = 64 * 1024**2


def backend_status(client, expected):
    try:
        status, operations = client.request('GET', '/operations', timeout=15)
        if status != 200 or operations.get('provider') != 'trellis2-gguf':
            raise BackendError('A native TRELLIS.2 worker is not running at this endpoint.')
        if operations.get('pins_sha256') != expected['pins_sha256'] or operations.get('workflow_sha256') != expected['workflow_sha256']:
            raise BackendError('Native TRELLIS.2 checkpoints/workflow do not match the pinned project configuration.')
        reason = None
        if not operations.get('models', {}).get('ready'):
            reason = operations.get('models', {}).get('reason', 'TRELLIS.2 checkpoints are not provisioned.')
        elif not operations.get('gpu_validated'):
            reason = 'Native TRELLIS.2 GPU diagnostics have not passed for this environment.'
        return {'available': reason is None, 'model': MODEL, 'reason': reason,
                'hardware': operations.get('hardware', {}), 'operations': operations}
    except (BackendError, ValueError, KeyError) as error:
        return {'available': False, 'model': MODEL, 'reason': str(error)}


def generate(client, job_id, plan, reference, output, expected, progress, cancelled,
             max_seconds=1800, poll_seconds=5):
    """Submit the exact frozen source to a real native service and verify its output."""
    digest = hashlib.sha256(reference).hexdigest()
    if digest != plan['reference_sha256']:
        raise BackendError('Frozen body reference hash changed.')
    status, state = client.request('GET', '/jobs/' + job_id)
    if status == 404:
        ready = backend_status(client, expected)
        if not ready['available']:
            raise BackendError(ready['reason'])
        operations = ready['operations']
        status, receipt = client.request('POST', '/references/' + plan['avatar_id'], {
            'png_base64': base64.b64encode(reference).decode(), 'provider': 'owner-upload',
            'prompt': 'Frozen body input forwarded by the TRELLIS.2 compute router.'})
        if status != 200 or receipt.get('sha256') != digest:
            raise BackendError('Native TRELLIS.2 rejected the frozen reference: ' + str(receipt.get('error', 'a transparent full-body RGBA PNG is required'))[:500])
        native_plan = {key: operations[key] for key in HASH_KEYS}
        native_plan.update(version=1, avatar_id=plan['avatar_id'], seed=plan['seed'], reference_sha256=digest)
        status, state = client.request('POST', '/jobs/' + job_id, native_plan)
        if status not in (200, 202):
            raise BackendError('Native TRELLIS.2 did not admit the job: ' + str(state.get('error', status))[:500])
    elif status != 200:
        raise BackendError('Unable to recover the native TRELLIS.2 job.')
    if state.get('reference_sha256') != digest or state.get('avatar_id') != plan['avatar_id'] or state.get('seed') != plan['seed']:
        raise BackendError('Native execution does not match the frozen avatar/reference.')
    deadline = time.monotonic() + max_seconds
    try:
        while True:
            if cancelled():
                raise BackendError('Generation cancelled by owner.')
            progress(state)
            if state.get('status') == 'generated_unqualified':
                break
            if state.get('status') not in ACTIVE:
                raise BackendError('Native TRELLIS.2 failed: ' + str(state.get('error', state.get('status')))[:800])
            if time.monotonic() >= deadline:
                raise BackendError('Native TRELLIS.2 exceeded the bounded generation deadline.')
            time.sleep(poll_seconds)
            status, state = client.request('GET', '/jobs/' + job_id)
            if status != 200 or state.get('id') != job_id:
                raise BackendError('Native job polling lost its execution identity.')
        status, content = client.request('GET', '/jobs/' + job_id + '/artifact', timeout=90)
        recorded = state.get('artifact', {})
        if status != 200 or not isinstance(content, bytes) or len(content) != recorded.get('bytes') or hashlib.sha256(content).hexdigest() != recorded.get('sha256'):
            raise BackendError('Native TRELLIS.2 artifact integrity verification failed.')
        temporary = output.with_suffix('.glb.partial')
        temporary.write_bytes(content)
        temporary.replace(output)
        return {'model': MODEL, 'native_job_id': job_id, 'native_engine': state.get('engine'),
                'reference_sha256': digest, 'publication_eligible': False}
    except Exception:
        # A timeout must not silently leave a second inference running forever.
        try:
            status, receipt = client.request('POST', '/jobs/' + job_id + '/cancel', {}, timeout=3)
            progress({'cancellation_acknowledged': status == 200 and receipt.get('status') == 'cancelled'})
        except BackendError:
            progress({'cancellation_acknowledged': False})
        raise
