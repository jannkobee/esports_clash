"""Colab-only preparation control and durable artifact transport.

Local work is limited to HTTP control, immutable byte storage and hash checks.
No asset-processing command or alternate compute backend exists here.
"""
import base64
import hashlib
import json
from pathlib import Path
import re
import threading
import uuid
from trellis_backends import BackendError

LOCK = threading.RLock()
UUID = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'


def digest(content):
    return hashlib.sha256(content).hexdigest()


def atomic(path, content):
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    temporary.write_bytes(content)
    temporary.replace(path)


class PreparationGateway:
    def __init__(self, client, root, sources):
        self.client = client
        self.root = Path(root)
        self.sources = Path(sources)

    def request(self, method, path, payload=None):
        match = re.fullmatch(r'/(rigging|animation)(/operations|/jobs/(' + UUID + r')(/artifact|/cancel)?)', path)
        if not match:
            return 404, {'error': 'Unknown cloud preparation operation'}
        stage, operation, job_id, action = match.groups()
        if operation == '/operations':
            if method != 'GET':
                return 405, {'error': 'GET required'}
            try:
                code, data = self.client.request('GET', path, timeout=15)
                if code != 200 or not isinstance(data, dict):
                    raise BackendError('The Colab stage did not return a valid readiness receipt.')
                if (data.get('compute', {}).get('selected') != 'google'
                        or data.get('compute', {}).get('automatic_fallback') is not False):
                    raise BackendError('The preparation stage did not prove the required Google-only compute route.')
                return code, data
            except BackendError as error:
                return 200, {'provider': 'colab-preparation', 'runtime_ready': False, 'models_ready': False,
                             'stages': [], 'compute': {'selected': 'google', 'ready': False,
                                 'automatic_fallback': False, 'policy': 'colab-only-v1'},
                             'blocked_reason': str(error), 'publication_eligible': False}
        if (method, action) not in {('GET', None), ('POST', None), ('GET', '/artifact'), ('POST', '/cancel')}:
            return 405, {'error': 'Unsupported cloud preparation method'}
        folder = self.root / stage / job_id
        folder.mkdir(parents=True, exist_ok=True)
        base = '/' + stage + '/jobs/' + job_id
        try:
            with LOCK:
                if method == 'POST' and action is None:
                    if (not isinstance(payload, dict)
                            or not re.fullmatch(UUID, str(payload.get('generation_id', '')))
                            or not re.fullmatch(r'[0-9a-f]{64}', str(payload.get('source_sha256', '')))
                            or payload.get('provider') != 'tokenrig' or payload.get('compute') != 'google'):
                        return 422, {'error': 'A frozen Google TokenRig plan is required'}
                    frozen = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()
                    plan = folder / 'plan.json'
                    if plan.exists() and plan.read_bytes() != frozen:
                        return 409, {'error': 'Immutable cloud preparation plan mismatch'}
                    if not plan.exists():
                        atomic(plan, frozen)
                    if (folder / 'cancelled.json').exists():
                        # A cancelled attempt cannot be re-admitted, including
                        # after a disconnected cancellation or gateway restart.
                        return self.request('POST', base + '/cancel', {})
                    code, existing = self.client.request('GET', base, timeout=15)
                    if code == 404:
                        source = self.sources / (payload['generation_id'] + '.glb')
                        if not source.is_file() or source.is_symlink() or source.stat().st_size > 32 * 1024**2:
                            return 422, {'error': 'The exact frozen generated source is unavailable in storage'}
                        content = source.read_bytes()
                        if digest(content) != payload['source_sha256']:
                            return 422, {'error': 'Stored generated source hash mismatch'}
                        input_path = '/' + stage + '/inputs/' + payload['source_sha256']
                        input_code, uploaded = self.client.request('POST', input_path,
                            {'glb_base64': base64.b64encode(content).decode()}, timeout=90)
                        if input_code != 200 or uploaded.get('sha256') != payload['source_sha256'] or uploaded.get('bytes') != len(content):
                            raise BackendError('Colab did not acknowledge the exact frozen source upload.')
                    elif code != 200:
                        return code, existing
                if action == '/cancel':
                    atomic(folder / 'cancelled.json', b'{"intent":"cancel"}')
                if action == '/artifact' and (folder / 'artifact.glb').is_file() and (folder / 'state.json').is_file():
                    state = json.loads((folder / 'state.json').read_text())
                    content = (folder / 'artifact.glb').read_bytes()
                    proof = state.get('artifact', {})
                    if digest(content) == proof.get('sha256') and len(content) == proof.get('bytes'):
                        return 200, content
                    raise BackendError('Stored cloud artifact failed integrity verification.')
                code, data = self.client.request(method, path, payload, timeout=90 if action == '/artifact' else 15)
                if code in (200, 202) and isinstance(data, dict):
                    if data.get('id') != job_id:
                        raise BackendError('Cloud preparation response changed execution identity.')
                    if data.get('status') == 'rigged_unqualified':
                        artifact_code, content = self.client.request('GET', base + '/artifact', timeout=90)
                        proof = data.get('artifact', {})
                        if artifact_code != 200 or not isinstance(content, bytes) or digest(content) != proof.get('sha256') or len(content) != proof.get('bytes'):
                            raise BackendError('Cloud rig output transfer failed integrity verification; cloud evidence retained.')
                        atomic(folder / 'artifact.glb', content)
                    atomic(folder / 'state.json', json.dumps(data, sort_keys=True).encode())
                return code, data
        except BackendError as error:
            return 503, {'id': job_id, 'status': 'waiting_worker', 'stage': 'waiting_for_colab',
                         'error': str(error), 'publication_eligible': False,
                         'cancellation_pending': (folder / 'cancelled.json').exists()}
