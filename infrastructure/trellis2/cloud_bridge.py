"""Durable Colab-only router for native TRELLIS.2 reconstruction."""
import base64
import copy
import hashlib
import http.server
import json
import os
import shutil
import struct
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor
from trellis_backends import MODEL, LocalClient, ColabClient, backend_status, generate, BackendError
from trellis_backends import ColabPreparationClient
from preparation_gateway import PreparationGateway

HERE = Path(__file__).parent.resolve()
WORKSPACE = Path(os.environ.get('ASSET_WORKSPACE', str(HERE.parent.parent)))
ROOT = Path(os.environ.get('TRELLIS_DATA', str(WORKSPACE / '.local-tools/trellis2/data')))
ROOT.mkdir(parents=True, exist_ok=True)
(ROOT / 'jobs').mkdir(parents=True, exist_ok=True)
(ROOT / 'output').mkdir(parents=True, exist_ok=True)
(ROOT / 'references').mkdir(parents=True, exist_ok=True)
(ROOT / 'input').mkdir(parents=True, exist_ok=True)

TOKEN = os.environ.get('TRELLIS_WORKER_TOKEN', os.environ.get('EVOLUTION_WORKER_TOKEN', ''))
COLAB_SESSION = os.environ.get('ASSET_COLAB_SESSION', 'asset-quality')
COLAB_CLI = os.environ.get('COLAB_CLI', '')
if not COLAB_CLI or not os.path.exists(COLAB_CLI):
    found = shutil.which('colab')
    if found:
        COLAB_CLI = found
    else:
        COLAB_CLI = str(Path.home() / '.local/bin/colab')

LIMITS = json.loads((HERE / 'limits.json').read_text()) if (HERE / 'limits.json').is_file() else {
    'max_generation_seconds': 600, 'max_process_ram_mib': 4096, 'max_gpu_used_mib': 15000,
    'min_vm_available_mib': 768, 'min_gpu_free_mib': 2048, 'quantization': 'Q4_K_M'
}
WORKFLOW = json.loads((HERE / 'workflow-v1.json').read_text()) if (HERE / 'workflow-v1.json').is_file() else {'version': 1}
PINS = json.loads((HERE / 'model-pins.json').read_text()) if (HERE / 'model-pins.json').is_file() else {'files': []}
CATALOG = {item['id']: item for item in json.loads((HERE / 'catalog.json').read_text())['avatars']} if (HERE / 'catalog.json').is_file() else {}
BUILTIN_REFERENCES = json.loads((HERE / 'reference-index.json').read_text()) if (HERE / 'reference-index.json').is_file() else {}

LAST_ERROR = None
ACTIVE_JOB = None
LOCK = threading.Lock()
_BACKEND_CACHE = {}
LOCAL_URL = os.environ.get('TRELLIS_LOCAL_URL', 'http://trellis-native:8096')


def clients():
    return {'google': ColabClient(COLAB_CLI, COLAB_SESSION), 'local': LocalClient(LOCAL_URL, TOKEN)}


def preparation_gateway():
    return PreparationGateway(ColabPreparationClient(COLAB_CLI, COLAB_SESSION),
                              ROOT / 'preparation', ROOT / 'output')


def expected_native():
    return {'pins_sha256': sha((HERE / 'model-pins.json').read_bytes()),
            'workflow_sha256': sha(canonical(WORKFLOW))}


def probe_backend(name):
    cached = _BACKEND_CACHE.get(name)
    if cached and time.monotonic() - cached[0] < (30 if cached[1]['available'] else 10):
        return cached[1]
    result = backend_status(clients()[name], expected_native())
    _BACKEND_CACHE[name] = (time.monotonic(), result)
    return result


def compute_route(preference):
    if preference != 'google':
        raise ValueError('Google Colab is required. Local asset processing is disabled.')
    statuses = {'google': probe_backend('google')}
    available = statuses['google']['available']
    public = {name: {key: value for key, value in status.items() if key != 'operations'} for name, status in statuses.items()}
    reason = None if available else '; '.join(name.title() + ': ' + str(status.get('reason')) for name, status in statuses.items())
    return statuses, {'switching_supported': True, 'preferred': 'google', 'selected': 'google',
        'policy': 'colab-only-v1', 'ready': available, 'automatic_fallback': False, 'fallback_reason': None,
        'blocked_reason': reason, 'backends': public}


def sha(data):
    if isinstance(data, str):
        data = data.encode('utf-8')
    return hashlib.sha256(data).hexdigest()


def canonical(data):
    return json.dumps(data, sort_keys=True, separators=(',', ':')).encode('utf-8')


def engine_manifest():
    files = {}
    for name in ['cloud_bridge.py', 'trellis_backends.py', 'colab_transport.py', 'colab_worker.py', 'service.py', 'diagnose.py', 'export_node.py', 'patch_nodes.py', 'workflow-v1.json', 'model-pins.json', 'limits.json', 'catalog.json']:
        p = HERE / name
        if p.is_file():
            files[name] = sha(p.read_bytes())
    return {
        'image_id': 'trellis2-router-colab-only-v3',
        'python': sys.version.split()[0],
        'source_hashes': files,
        'cloud_colab': True,
        'cloud_model': MODEL,
        'local_fallback': False
    }


def get_all_references():
    refs = {}
    for aid, item in BUILTIN_REFERENCES.items():
        ref_file = HERE / 'references' / item.get('file', '')
        if ref_file.is_file():
            refs[aid] = {'sha256': sha(ref_file.read_bytes()), 'provider': 'system', 'file': item.get('file')}
    ref_dir = ROOT / 'references'
    if ref_dir.is_dir():
        for adir in ref_dir.iterdir():
            if adir.is_dir():
                cur = adir / 'current.json'
                if cur.is_file():
                    try:
                        data = json.loads(cur.read_text())
                        refs[adir.name] = data
                    except Exception:
                        pass
    return refs


def validate_output(path):
    payload = path.read_bytes()
    if len(payload) > 32 * 1024 * 1024 or len(payload) < 20 or payload[:4] != b'glTF':
        raise ValueError('Invalid generated GLB container')
    version, length = struct.unpack('<II', payload[4:12])
    if version != 2 or length != len(payload):
        raise ValueError('Corrupt binary glTF header')
    json_length, kind = struct.unpack('<II', payload[12:20])
    if kind != 0x4e4f534a:
        raise ValueError('Missing generated glTF JSON')
    gltf = json.loads(payload[20:20 + json_length])
    if not gltf.get('meshes') or not gltf.get('materials'):
        raise ValueError('Generation did not produce colored geometry')
    for mesh in gltf['meshes']:
        for primitive in mesh.get('primitives', []):
            attributes = primitive.get('attributes', {})
            material = gltf['materials'][primitive.get('material', 0)]
            texture = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
            if texture is not None and f"TEXCOORD_{texture.get('texCoord', 0)}" not in attributes:
                raise ValueError('Generated base-color texture has no matching texture coordinates')
            if not gltf.get('images') and 'COLOR_0' not in attributes:
                raise ValueError('Generation has neither vertex colors nor embedded textures')
    if any(b.get('uri') for b in gltf.get('buffers', [])) or any(i.get('uri') for i in gltf.get('images', [])):
        raise ValueError('Generated GLB is not self-contained')
    return {
        'file': path.name,
        'sha256': sha(payload),
        'bytes': len(payload),
        'meshes': len(gltf['meshes']),
        'materials': len(gltf['materials']),
        'images': len(gltf.get('images', [])),
        'skins': len(gltf.get('skins', [])),
        'animations': len(gltf.get('animations', [])),
        'publication_eligible': False,
        'visual_review_required': True,
        'identity_verified': False,
        'generation': gltf.get('extras', {}).get('generation', {}),
        'qualification': 'Generated source only. Blender binding, identity, animations and real-browser performance qualification are still required.'
    }


def save_state(folder, state):
    temporary = folder / ('state.' + str(uuid.uuid4()) + '.tmp')
    temporary.write_text(json.dumps(state, indent=2))
    temporary.replace(folder / 'state.json')


def read_reference(avatar_id, digest):
    candidates = [ROOT / 'references' / avatar_id / (digest + '.png'), ROOT / 'references' / avatar_id / 'current.png']
    builtin = BUILTIN_REFERENCES.get(avatar_id, {}).get('file')
    if builtin:
        candidates.append(HERE / 'references' / builtin)
    for path in candidates:
        if path.is_file() and not path.is_symlink() and sha(path.read_bytes()) == digest:
            return path.read_bytes()
    raise ValueError('The exact frozen body reference is unavailable. Upload the body PNG again.')


def execute_generation_job(job_id, plan):
    global ACTIVE_JOB, LAST_ERROR
    folder = ROOT / 'jobs' / job_id
    with LOCK:
        if ACTIVE_JOB is not None:
            return
        ACTIVE_JOB = job_id
    state = json.loads((folder / 'state.json').read_text()) if (folder / 'state.json').exists() else {'id': job_id}
    cancelled = lambda: (folder / 'cancelled.json').exists()
    try:
        if cancelled():
            # A prior attempt with unknown cancellation cannot be acknowledged
            # until its native worker confirms full inference shutdown.
            unknown = False
            for attempt in state.get('attempts', []):
                try:
                    code, receipt = clients()[attempt['compute']].request('POST', '/jobs/' + job_id + '/cancel', {}, timeout=3)
                    unknown |= code != 200 or receipt.get('status') != 'cancelled'
                except BackendError:
                    unknown = True
            state.update(status='cancelling' if unknown else 'cancelled', stage='awaiting_native_shutdown' if unknown else 'cancelled')
            save_state(folder, state)
            return
        if state.get('status') in {'generated_unqualified', 'failed', 'cancelled', 'model_deleted'}:
            return
        if plan.get('engine_sha256') != sha(canonical(engine_manifest())):
            raise ValueError('The reconstruction engine changed. Create a fresh TRELLIS.2 job; this frozen execution was preserved.')
        reference = (ROOT / 'input' / (job_id + '.png')).read_bytes()
        if sha(reference) != plan['reference_sha256']:
            raise ValueError('Frozen body input changed.')
        statuses, compute = compute_route(plan.get('compute_preference', 'google'))
        state.update(compute=compute, attempts=state.get('attempts', []))
        order = ['google']
        for name in order:
            if not statuses[name]['available']:
                continue
            state.update(status='running', stage='native_trellis2', provider='google-colab' if name == 'google' else 'trellis2-gguf')
            state['compute']['selected'] = name
            state['attempts'].append({'compute': name, 'started_unix': time.time(), 'model': MODEL})
            save_state(folder, state)
            def progress(native):
                for key in ['stage', 'node_progress', 'sampler_progress', 'resources', 'prompt_id', 'sampled_peaks', 'cancellation_acknowledged']:
                    if key in native:
                        state[key] = native[key]
                if native.get('status') in {'running','waiting_models','waiting_resources','queued'}:
                    state['status'] = native['status']
                save_state(folder, state)
            try:
                output = ROOT / 'output' / (job_id + '.glb')
                provenance = generate(clients()[name], job_id, plan, reference, output, expected_native(), progress, cancelled,
                                      max_seconds=LIMITS.get('max_generation_seconds', 1800))
                if cancelled():
                    raise BackendError('Generation cancelled by owner.')
                artifact = validate_output(output)
                artifact['generation'] = provenance
                state.update(status='generated_unqualified', stage='awaiting_asset_qualification', artifact=artifact, completed_unix=time.time())
                LAST_ERROR = None
                save_state(folder, state)
                return
            except Exception as error:
                state['attempts'][-1].update(error=str(error)[:1000], completed_unix=time.time())
                _BACKEND_CACHE.pop(name, None)
                if cancelled():
                    state.update(status='cancelled' if state.get('cancellation_acknowledged') else 'cancelling', stage='awaiting_native_shutdown')
                    save_state(folder, state)
                    return
                if name == 'google':
                    state['cloud_error'] = str(error)[:1000]
                    compute.update(ready=False, blocked_reason='Google Colab failed. Reconnect and inspect the same cloud job before retrying; local fallback is disabled.')
                else:
                    raise
        state.update(status='waiting_worker', stage='waiting_for_trellis2', reason=compute.get('blocked_reason') or 'Waiting for a verified native TRELLIS.2 backend.')
        save_state(folder, state)
    except Exception as error:
        LAST_ERROR = str(error)
        state.update(status='failed', stage='generation_failed', error=str(error), completed_unix=time.time())
        save_state(folder, state)
    finally:
        with LOCK:
            ACTIVE_JOB = None


def recover_jobs():
    while True:
        try:
            if ACTIVE_JOB is None:
                folders = sorted((ROOT / 'jobs').glob('*/plan.json'), key=lambda path: path.stat().st_mtime)
                for path in folders:
                    state_path = path.with_name('state.json')
                    if not state_path.is_file():
                        continue
                    state = json.loads(state_path.read_text())
                    if state.get('status') in {'queued','waiting_worker','running','waiting_models','waiting_resources','cancelling'}:
                        execute_generation_job(path.parent.name, json.loads(path.read_text()))
                        break
        except Exception as error:
            print('[TRELLIS router] Recovery: ' + type(error).__name__, file=sys.stderr)
        time.sleep(10)


class BridgeHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Quiet logging

    def send_json(self, status, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status, message):
        self.send_json(status, {'error': message})

    def check_auth(self):
        if not TOKEN:
            return False
        auth = self.headers.get('Authorization', '')
        if auth == f'Bearer {TOKEN}':
            return True
        return False

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/health':
            return self.send_json(200, {'status': 'ok', 'active': [ACTIVE_JOB] if ACTIVE_JOB else []})

        if not self.check_auth():
            return self.send_error_json(401, 'Private TRELLIS worker authentication required')

        if path.startswith(('/rigging/', '/animation/')):
            status, value = preparation_gateway().request('GET', path)
            if isinstance(value, bytes):
                self.send_response(status)
                self.send_header('Content-Type', 'model/gltf-binary')
                self.send_header('Content-Length', str(len(value)))
                self.send_header('Cache-Control', 'private, no-store')
                self.end_headers()
                self.wfile.write(value)
                return
            return self.send_json(status, value)

        if path == '/operations':
            try:
                statuses, compute = compute_route(self.headers.get('X-Asset-Compute-Preference', 'google'))
            except ValueError as error:
                return self.send_error_json(422, str(error))
            selected = compute['selected']
            provider = ('google-colab' if selected == 'google' else 'trellis2-gguf') if compute['ready'] else 'trellis2-router'
            engine = engine_manifest()
            return self.send_json(200, {
                'provider': provider, 'provider_label': ('Google Colab / TRELLIS.2' if selected == 'google' else 'Local / TRELLIS.2') if compute['ready'] else 'TRELLIS.2 waiting for setup',
                'generation_model': MODEL, 'compute': compute, 'active': ACTIVE_JOB,
                'models': {'ready': compute['ready'], 'reason': compute['blocked_reason']},
                'limits': LIMITS, 'limits_sha256': sha(canonical(LIMITS)),
                'gpu_validated': compute['ready'], 'engine_sha256': sha(canonical(engine)), 'engine': engine,
                'hardware': statuses[selected].get('hardware', {}),
                'workflow_sha256': sha(canonical(WORKFLOW)), 'pins_sha256': sha((HERE / 'model-pins.json').read_bytes()),
                'references': get_all_references(), 'last_error': LAST_ERROR,
                'publication': 'Native TRELLIS.2 sources still require visual, rigging and runtime qualification.'
            })

        # Reference image download: /references/{avatar_id}/{digest}
        if path.startswith('/references/'):
            parts = path.strip('/').split('/')
            if len(parts) == 3:
                _, avatar_id, digest = parts
                ref_file = ROOT / 'references' / avatar_id / f'{digest}.png'
                if not ref_file.is_file():
                    builtin = BUILTIN_REFERENCES.get(avatar_id, {}).get('file')
                    if builtin and (HERE / 'references' / builtin).is_file():
                        ref_file = HERE / 'references' / builtin
                if ref_file.is_file():
                    data = ref_file.read_bytes()
                    self.send_response(200)
                    self.send_header('Content-Type', 'image/png')
                    self.send_header('Content-Length', str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    return
                return self.send_error_json(404, 'Reference not found')

        # Job status: /jobs/{id}
        if path.startswith('/jobs/'):
            parts = path.strip('/').split('/')
            if len(parts) == 2:
                job_id = parts[1]
                state_file = ROOT / 'jobs' / job_id / 'state.json'
                if state_file.is_file():
                    try:
                        return self.send_json(200, json.loads(state_file.read_text()))
                    except Exception as e:
                        return self.send_error_json(500, str(e))
                return self.send_error_json(404, 'Job not found')

            # Artifact download: /jobs/{id}/artifact
            if len(parts) == 3 and parts[2] == 'artifact':
                job_id = parts[1]
                artifact_file = ROOT / 'output' / f'{job_id}.glb'
                if artifact_file.is_file():
                    data = artifact_file.read_bytes()
                    self.send_response(200)
                    self.send_header('Content-Type', 'model/gltf-binary')
                    self.send_header('Content-Length', str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    return
                return self.send_error_json(404, 'Artifact not found')

        return self.send_error_json(404, 'Not found')

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if not self.check_auth():
            return self.send_error_json(401, 'Private TRELLIS worker authentication required')

        content_length = int(self.headers.get('Content-Length', 0))
        if path.startswith(('/rigging/', '/animation/')):
            if not 0 <= content_length <= 65536:
                return self.send_error_json(413, 'Cloud preparation plan exceeds 64 KiB')
            try:
                payload = json.loads(self.rfile.read(content_length) or b'{}')
                status, value = preparation_gateway().request('POST', path, payload)
                return self.send_json(status, value)
            except (ValueError, TypeError) as error:
                return self.send_error_json(422, str(error))
        body = self.rfile.read(content_length) if content_length > 0 else b''

        # Reference upload: /references/{avatar_id}
        if path.startswith('/references/'):
            parts = path.strip('/').split('/')
            if len(parts) == 2:
                avatar_id = parts[1]
                try:
                    if avatar_id not in CATALOG:
                        raise ValueError('Unknown avatar')
                    payload = json.loads(body)
                    png_bytes = base64.b64decode(payload['png_base64'], validate=True)
                    if len(png_bytes) > 12 * 1024 * 1024 or not png_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
                        raise ValueError('A bounded PNG body reference is required')
                    digest = sha(png_bytes)
                    target_dir = ROOT / 'references' / avatar_id
                    target_dir.mkdir(parents=True, exist_ok=True)
                    (target_dir / f'{digest}.png').write_bytes(png_bytes)
                    (target_dir / 'current.png').write_bytes(png_bytes)
                    meta = {
                        'avatar_id': avatar_id,
                        'sha256': digest,
                        'provider': payload.get('provider', 'owner-upload'),
                        'prompt': payload.get('prompt', ''),
                        'updated_at': time.time()
                    }
                    (target_dir / 'current.json').write_text(json.dumps(meta, indent=2))
                    return self.send_json(200, meta)
                except Exception as e:
                    return self.send_error_json(422, str(e))

        # Job submit: /jobs/{id}
        if path.startswith('/jobs/'):
            parts = path.strip('/').split('/')
            if len(parts) == 2:
                job_id = parts[1]
                try:
                    if str(uuid.UUID(job_id)) != job_id:
                        raise ValueError('Invalid generation identifier')
                    plan = json.loads(body)
                    if plan.get('avatar_id') not in CATALOG or plan.get('version') != 1 or type(plan.get('seed')) is not int or not 0 <= plan['seed'] <= 2147483647:
                        raise ValueError('Invalid native TRELLIS.2 generation plan')
                    if plan.get('compute_preference', 'google') not in {'google', 'local'}:
                        raise ValueError('Invalid compute preference')
                    folder = ROOT / 'jobs' / job_id
                    if (folder / 'cancelled.json').is_file():
                        return self.send_json(200, json.loads((folder / 'state.json').read_text()))
                    if (folder / 'plan.json').is_file():
                        if json.loads((folder / 'plan.json').read_text()) != plan:
                            return self.send_error_json(409, 'Immutable generation plan mismatch')
                        return self.send_json(200, json.loads((folder / 'state.json').read_text()))
                    expected = {'engine_sha256': sha(canonical(engine_manifest())), 'workflow_sha256': sha(canonical(WORKFLOW)),
                                'pins_sha256': sha((HERE / 'model-pins.json').read_bytes()), 'limits_sha256': sha(canonical(LIMITS))}
                    if any(plan.get(key) != value for key, value in expected.items()):
                        raise ValueError('Generation configuration changed; create a fresh job')
                    reference = read_reference(plan['avatar_id'], plan.get('reference_sha256', ''))
                    folder.mkdir(parents=True)
                    (folder / 'plan.json').write_text(json.dumps(plan, indent=2))
                    (ROOT / 'input' / (job_id + '.png')).write_bytes(reference)
                    state = {'id': job_id, 'status': 'queued', 'stage': 'admission', 'created_unix': time.time(), 'plan': plan}
                    save_state(folder, state)
                    thread = threading.Thread(target=execute_generation_job, args=(job_id, plan), daemon=True)
                    thread.start()
                    return self.send_json(202, state)
                except Exception as e:
                    return self.send_error_json(422, str(e))

            if len(parts) == 3 and parts[2] == 'cancel':
                job_id = parts[1]
                try:
                    if str(uuid.UUID(job_id)) != job_id:
                        raise ValueError('Invalid generation identifier')
                except ValueError as error:
                    return self.send_error_json(422, str(error))
                folder = ROOT / 'jobs' / job_id
                folder.mkdir(parents=True, exist_ok=True)
                state_file = folder / 'state.json'
                state = json.loads(state_file.read_text()) if state_file.is_file() else {'id': job_id}
                (folder / 'cancelled.json').write_text(json.dumps({'at': time.time()}))
                pending = bool(state.get('attempts')) or ACTIVE_JOB == job_id
                state.update(status='cancelling' if pending else 'cancelled', stage='awaiting_native_shutdown' if pending else 'cancelled')
                save_state(folder, state)
                return self.send_json(200, state)

        return self.send_error_json(404, 'Not found')

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if not self.check_auth():
            return self.send_error_json(401, 'Private TRELLIS worker authentication required')

        # Artifact deletion: /jobs/{id}/artifact
        if path.startswith('/jobs/') and path.endswith('/artifact'):
            parts = path.strip('/').split('/')
            if len(parts) == 3:
                job_id = parts[1]
                state_file = ROOT / 'jobs' / job_id / 'state.json'
                if state_file.is_file() and json.loads(state_file.read_text()).get('status') not in {'generated_unqualified','model_deleted'}:
                    return self.send_error_json(409, 'Only completed inactive source models can be deleted')
                artifact_file = ROOT / 'output' / f'{job_id}.glb'
                if artifact_file.is_file():
                    artifact_file.unlink()
                state_file = ROOT / 'jobs' / job_id / 'state.json'
                if state_file.is_file():
                    state = json.loads(state_file.read_text())
                    state.pop('artifact', None)
                    state.update({'status': 'model_deleted', 'stage': 'model_deleted'})
                    state_file.write_text(json.dumps(state, indent=2))
                return self.send_json(200, {'status': 'model_deleted'})

        return self.send_error_json(404, 'Not found')


def run_bridge(port=8096):
    threading.Thread(target=recover_jobs, daemon=True).start()
    server = http.server.ThreadingHTTPServer(('0.0.0.0', port), BridgeHandler)
    print(f'[CloudBridge] Listening on 0.0.0.0:{port} (Google Colab only; local fallback disabled)')
    server.serve_forever()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8096
    run_bridge(port)

