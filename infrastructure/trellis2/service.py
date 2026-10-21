"""Private, durable ComfyUI bridge. Raw ComfyUI listens on loopback only.

No HTTP endpoint accepts arbitrary workflows, paths, code, or checkpoint URLs.
Inference is offline; model provisioning is a separate explicit command.
"""
import asyncio
import copy
import hashlib
import hmac
import json
import os
from pathlib import Path
import signal
import struct
import sys
import time
import uuid
import platform
import base64

from aiohttp import web, ClientSession, ClientTimeout
import psutil
from PIL import Image, UnidentifiedImageError

HERE = Path(__file__).parent
ROOT = Path(os.environ.get('TRELLIS_DATA', '/trellis-data'))
COMFY = Path(os.environ.get('TRELLIS_COMFY', '/opt/ComfyUI'))
LIMITS = json.loads((HERE / 'limits.json').read_text())
WORKFLOW = json.loads((HERE / 'workflow-v1.json').read_text())
PINS = json.loads((HERE / 'model-pins.json').read_text())
TOKEN = os.environ.get('TRELLIS_WORKER_TOKEN', '')
CATALOG = {item['id']: item for item in json.loads((HERE / 'catalog.json').read_text())['avatars']}
BUILTIN_REFERENCES = json.loads((HERE / 'reference-index.json').read_text())
ACTIVE = None
PROCESS = None
LAST_ERROR = None
TERMINAL = {'generated_unqualified', 'failed'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(data):
    return json.dumps(data, sort_keys=True, separators=(',', ':')).encode()


def engine_manifest():
    files = {name: sha((HERE / name).read_bytes()) for name in ['service.py','diagnose.py','export_node.py','workflow-v1.json','model-pins.json','limits.json','Dockerfile.native','catalog.json','reference-index.json','patch_nodes.py']}
    packages = HERE / 'installed-packages.txt'
    return {'image_id': os.environ.get('TRELLIS_IMAGE_ID','not-recorded'),
            'environment_id': os.environ.get('TRELLIS_ENVIRONMENT_ID'), 'python': platform.python_version(),
            'source_hashes': files, 'installed_packages_sha256': sha(packages.read_bytes()) if packages.exists() else None}


def gpu_validated():
    try:
        report = json.loads((ROOT / 'diagnostics.json').read_text())
        engine = engine_manifest()
        identity = engine.get('environment_id') or engine['image_id']
        recorded = report.get('engine_environment_id') or report.get('engine_image_id')
        return (isinstance(identity,str) and identity.startswith('sha256:') and len(identity)==71
                and recorded==identity and report.get('status') == 'passed'
                and report.get('engine_source_hashes') == engine['source_hashes'])
    except (OSError, ValueError):
        return False


def identifier(value):
    if not isinstance(value, str) or str(uuid.UUID(value)) != value:
        raise ValueError('Invalid job identifier')
    return value


def save(folder, state):
    state['updated_unix'] = time.time()
    temp = folder / 'state.json.tmp'
    temp.write_text(json.dumps(state, indent=2))
    temp.replace(folder / 'state.json')


def read_state(folder):
    return json.loads((folder / 'state.json').read_text())


def job_folders():
    result = []
    for folder in (ROOT / 'jobs').iterdir():
        try:
            if folder.is_dir() and not folder.is_symlink() and identifier(folder.name):
                result.append(folder)
        except ValueError:
            continue
    return sorted(result)


def model_status():
    manifest = ROOT / 'checkpoints.json'
    if not manifest.is_file():
        return {'ready': False, 'reason': 'Official DINOv3 access and explicit checkpoint provisioning required.', 'code': 'checkpoints_missing'}
    try:
        actual = json.loads(manifest.read_text())
        records = {f['file']: f for f in actual['files']}
        for item in PINS['files']:
            path = ROOT / 'models' / item['local']
            if path.is_symlink() or not path.is_file() or path.stat().st_size != item['bytes']:
                raise ValueError('Missing or invalid ' + item['local'])
            record = records[item['local']]
            if item.get('sha256') and record['sha256'] != item['sha256']:
                raise ValueError('Checkpoint manifest mismatch')
        return {'ready': True, 'quantization': PINS['quantization'], 'manifest_sha256': sha(manifest.read_bytes())}
    except (ValueError, KeyError, OSError) as error:
        return {'ready': False, 'reason': str(error), 'code': 'checkpoint_integrity'}


async def resources():
    process = await asyncio.create_subprocess_exec('nvidia-smi', '--query-gpu=name,memory.total,memory.used,memory.free,driver_version', '--format=csv,noheader,nounits', stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
    output, _ = await asyncio.wait_for(process.communicate(), timeout=5)
    if process.returncode:
        raise RuntimeError('NVIDIA GPU is unavailable')
    fields = output.decode().splitlines()[0].split(', ')
    rss = 0
    if PROCESS and PROCESS.returncode is None:
        try:
            parent = psutil.Process(PROCESS.pid)
            rss = sum(p.memory_info().rss for p in [parent, *parent.children(recursive=True)] if p.is_running()) / 1048576
        except psutil.Error:
            pass
    anonymous = None
    if Path('/sys/fs/cgroup/memory.stat').exists():
        stats = dict(line.split() for line in Path('/sys/fs/cgroup/memory.stat').read_text().splitlines())
        anonymous = int(stats['anon']) / 1048576
    return {'gpu': fields[0], 'gpu_total_mib': int(fields[1]), 'gpu_used_mib': int(fields[2]), 'gpu_free_mib': int(fields[3]),
            'driver': fields[4], 'vm_available_mib': psutil.virtual_memory().available / 1048576,
            'comfy_tree_rss_mib': rss, 'worker_anonymous_mib': anonymous,
            'scope': 'Docker Linux VM RAM; sampled whole-device VRAM includes other applications.'}


def build_workflow(job_id, seed):
    workflow = copy.deepcopy(WORKFLOW)
    workflow['1']['inputs']['image'] = job_id + '.png'
    workflow['4']['inputs']['seed'] = seed
    workflow['3']['inputs']['model_format'] = 'GGUF ' + LIMITS['quantization']
    workflow['4']['inputs'].update(pipeline_type=str(LIMITS['resolution']),
        sparse_structure_steps=LIMITS['sampling_steps'], shape_steps=LIMITS['sampling_steps'], texture_steps=LIMITS['sampling_steps'], max_num_tokens=LIMITS['max_tokens'])
    workflow['5']['inputs'].update(resolution=str(LIMITS['resolution']), texture_size=str(LIMITS['texture_size']))
    workflow['6']['inputs']['job_id'] = job_id
    return workflow


def verify_reference(path):
    if path.is_symlink() or path.stat().st_size > 12 * 1024 * 1024:
        raise ValueError('Reference file is invalid')
    with Image.open(path) as image:
        if image.format != 'PNG' or image.width < 256 or image.height < 512 or image.width * image.height > 4096 ** 2:
            raise ValueError('Expected a bounded, full-body PNG reference')
        image.verify()


def references():
    result = {}
    for avatar_id in CATALOG:
        metadata = ROOT / 'references' / avatar_id / 'current.json'
        if metadata.is_file():
            result[avatar_id] = json.loads(metadata.read_text())
    for avatar_id, item in BUILTIN_REFERENCES.items():
        if avatar_id not in result and (HERE / 'references' / item['file']).is_file():
            result[avatar_id] = {**item, 'sha256': sha((HERE / 'references' / item['file']).read_bytes())}
    return result


def reference_path(avatar_id, digest):
    if avatar_id not in CATALOG or not isinstance(digest, str) or len(digest) != 64 or any(c not in '0123456789abcdef' for c in digest):
        raise ValueError('Unknown avatar or invalid reference hash')
    item = BUILTIN_REFERENCES.get(avatar_id)
    if item:
        builtin = HERE / 'references' / item['file']
        if builtin.is_file() and sha(builtin.read_bytes()) == digest:
            return builtin
    path = ROOT / 'references' / avatar_id / (digest + '.png')
    if not path.is_file() or path.is_symlink() or sha(path.read_bytes()) != digest:
        raise ValueError('Immutable reference unavailable')
    return path


async def upload_reference(request):
    avatar_id = request.match_info['avatar_id']
    if avatar_id not in CATALOG:
        raise ValueError('Unknown avatar')
    payload = await request.json()
    if payload.get('provider') not in {'imagegen', 'owner-upload', 'local-render'}:
        raise ValueError('Reference provenance required')
    content = base64.b64decode(payload['png_base64'], validate=True)
    if len(content) > 12 * 1024 * 1024:
        raise ValueError('Reference exceeds image limit')
    digest = sha(content)
    directory = ROOT / 'references' / avatar_id
    directory.mkdir(parents=True, exist_ok=True)
    temporary = directory / (str(uuid.uuid4()) + '.tmp')
    try:
        temporary.write_bytes(content)
        verify_reference(temporary)
        with Image.open(temporary) as image:
            if image.mode != 'RGBA' or image.getextrema()[3][0] > 0 or image.getextrema()[3][1] < 205:
                raise ValueError('A transparent RGBA cutout with visible subject is required')
        target = directory / (digest + '.png')
        if not target.exists():
            temporary.replace(target)
        metadata = {'sha256': digest, 'provider': payload['provider'], 'prompt': str(payload.get('prompt', ''))[:8000], 'created_unix': time.time()}
        version = directory / (digest + '.json')
        if not version.exists():
            version.write_text(json.dumps(metadata, indent=2))
        current = directory / 'current.json.tmp'
        current.write_text(version.read_text())
        current.replace(directory / 'current.json')
        return web.json_response(metadata)
    finally:
        temporary.unlink(missing_ok=True)


async def reference_image(request):
    path = reference_path(request.match_info['avatar_id'], request.match_info['digest'])
    return web.FileResponse(path, headers={'Cache-Control': 'private, no-store', 'Content-Type': 'image/png'})


def archive_reference(avatar_id, digest, source):
    directory = ROOT / 'references' / avatar_id
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / (digest + '.png')
    if path.exists() and sha(path.read_bytes()) != digest:
        raise ValueError('Archived reference bytes changed')
    if not path.exists():
        path.write_bytes(source.read_bytes())
    metadata_path = directory / (digest + '.json')
    if not metadata_path.exists():
        item = BUILTIN_REFERENCES.get(avatar_id)
        if not item or sha((HERE / 'references' / item['file']).read_bytes()) != digest:
            raise ValueError('Reference provenance unavailable')
        metadata_path.write_text(json.dumps({**item, 'sha256': digest}, indent=2))
    metadata = json.loads(metadata_path.read_text())
    if metadata.get('sha256') != digest:
        raise ValueError('Reference provenance hash mismatch')
    return metadata


async def start_comfy():
    global PROCESS
    log = (ROOT / 'comfy.log').open('ab')
    PROCESS = await asyncio.create_subprocess_exec(sys.executable, str(COMFY / 'main.py'), '--listen', '127.0.0.1', '--port', '8188',
        '--disable-auto-launch', '--disable-metadata', '--lowvram', '--disable-pinned-memory', '--disable-async-offload', '--preview-method', 'none',
        '--input-directory', str(ROOT / 'input'), '--output-directory', str(ROOT / 'output'),
        cwd=str(COMFY), stdout=log, stderr=log, start_new_session=True)
    log.close()
    async with ClientSession(timeout=ClientTimeout(total=3)) as client:
        for _ in range(120):
            if PROCESS.returncode is not None:
                raise RuntimeError('ComfyUI startup failed; inspect private comfy.log')
            try:
                async with client.get('http://127.0.0.1:8188/object_info') as response:
                    nodes = await response.json()
                for node in WORKFLOW.values():
                    if node['class_type'] not in nodes:
                        raise RuntimeError('Required node unavailable: ' + node['class_type'])
                return nodes
            except (OSError, asyncio.TimeoutError):
                await asyncio.sleep(1)
        raise RuntimeError('ComfyUI startup deadline exceeded')


async def stop_comfy():
    global PROCESS
    if PROCESS and PROCESS.returncode is None:
        try:
            os.killpg(PROCESS.pid, signal.SIGTERM)
            await asyncio.wait_for(PROCESS.wait(), 8)
        except (ProcessLookupError, asyncio.TimeoutError):
            try:
                os.killpg(PROCESS.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            await PROCESS.wait()
    PROCESS = None


def validate_output(path):
    payload = path.read_bytes()
    if len(payload) > LIMITS['max_glb_bytes'] or payload[:4] != b'glTF' or len(payload) < 20:
        raise ValueError('Missing or invalid generated GLB')
    if struct.unpack_from('<II', payload, 4) != (2, len(payload)):
        raise ValueError('Invalid generated GLB container')
    length, kind = struct.unpack_from('<II', payload, 12)
    if kind != 0x4e4f534a:
        raise ValueError('Missing generated glTF JSON')
    gltf = json.loads(payload[20:20 + length])
    if not gltf.get('meshes') or not gltf.get('materials') or not gltf.get('images'):
        raise ValueError('Generation did not produce textured geometry')
    if any(b.get('uri') for b in gltf.get('buffers', [])) or any(i.get('uri') for i in gltf.get('images', [])):
        raise ValueError('Generated GLB is not self-contained')
    return {'file': path.name, 'sha256': sha(payload), 'bytes': len(payload), 'meshes': len(gltf['meshes']),
            'materials': len(gltf['materials']), 'images': len(gltf['images']), 'skins': len(gltf.get('skins', [])),
            'animations': len(gltf.get('animations', [])), 'publication_eligible': False,
            'qualification': 'Generated source only. Blender binding, identity, animations and real-browser performance qualification are still required.'}


async def generate(folder):
    state = read_state(folder)
    job_id = state['id']
    try:
        plan = json.loads((folder / 'plan.json').read_text())
        if plan['engine_sha256'] != sha(canonical(engine_manifest())) or plan['limits_sha256'] != sha(canonical(LIMITS)) or plan['workflow_sha256'] != sha(canonical(WORKFLOW)) or plan['pins_sha256'] != sha((HERE / 'model-pins.json').read_bytes()):
            raise ValueError('Frozen generation configuration changed; create a new job')
        frozen_input = ROOT / 'input' / (job_id + '.png')
        if not frozen_input.is_file() or frozen_input.is_symlink() or sha(frozen_input.read_bytes()) != plan['reference_sha256']:
            raise ValueError('Frozen reference bytes changed')
        # Re-check all actual checkpoint hashes before inference, not just sizes.
        state.update(stage='verifying_checkpoints')
        save(folder, state)
        import importlib.util
        spec = importlib.util.spec_from_file_location('prepare_models', HERE / 'prepare-models.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for item in PINS['files']:
            if await asyncio.to_thread(module.digest, ROOT / 'models' / item['local'], item) != (item.get('sha256') or item['git_blob']):
                raise ValueError('Checkpoint bytes changed: ' + item['local'])
        state.pop('reason', None)
        state.update(status='running', stage='starting_comfy', started_unix=time.time(), prompt_id=job_id,
                     checkpoints=json.loads((ROOT / 'checkpoints.json').read_text()), engine=engine_manifest(), sampled_peaks={})
        save(folder, state)
        output = ROOT / 'output' / (job_id + '.glb')
        if output.exists():
            # Completed exporter output can survive a bridge/container restart.
            state.update(status='generated_unqualified', artifact=validate_output(output), recovered_export=True)
            save(folder, state)
            return
        await start_comfy()
        workflow = json.loads((folder / 'workflow.json').read_text())
        async with ClientSession(timeout=ClientTimeout(total=10)) as client:
            socket = await client.ws_connect('http://127.0.0.1:8188/ws?clientId=' + job_id, heartbeat=15)
            async with client.post('http://127.0.0.1:8188/prompt', json={'prompt': workflow, 'prompt_id': job_id, 'client_id': job_id}) as response:
                submitted = await response.json()
                if response.status != 200 or submitted.get('prompt_id') != job_id:
                    raise ValueError('ComfyUI rejected the versioned workflow: ' + json.dumps(submitted)[:2000])
            state.update(stage='inference', submission=submitted)
            save(folder, state)
            while True:
                # Record only actual ComfyUI progress; do not invent a percentage
                # across samplers, which may reset their step counters per stage.
                for _ in range(50):
                    try:
                        event = await socket.receive_json(timeout=.01)
                    except asyncio.TimeoutError:
                        break
                    except (TypeError, ValueError):
                        break
                    if event.get('type') in ('progress', 'executing', 'execution_start', 'execution_error', 'executed'):
                        state['execution_event'] = {'type': event['type'], 'data': event.get('data', {})}
                        if event['type'] == 'progress':
                            state['node_progress'] = event.get('data', {})
                if time.time() - state['started_unix'] > LIMITS['max_generation_seconds']:
                    raise RuntimeError('Generation duration limit exceeded')
                sample = await resources()
                state['resources'] = sample
                for key in ['gpu_used_mib', 'comfy_tree_rss_mib', 'worker_anonymous_mib']:
                    if sample[key] is not None:
                        state['sampled_peaks'][key] = max(state['sampled_peaks'].get(key, 0), sample[key])
                # RSS includes file-backed checkpoint mappings and shared libraries.
                # Enforce allocated anonymous memory; retain RSS as separate evidence.
                budget_ram = sample['worker_anonymous_mib'] if sample['worker_anonymous_mib'] is not None else sample['comfy_tree_rss_mib']
                if budget_ram > LIMITS['max_process_ram_mib'] or sample['gpu_used_mib'] > LIMITS['max_gpu_used_mib'] or sample['vm_available_mib'] < 768:
                    raise RuntimeError('Memory safety limit exceeded; original avatar retained')
                if PROCESS.returncode is not None:
                    raise RuntimeError('ComfyUI exited during inference; possible native failure or OOM')
                async with client.get('http://127.0.0.1:8188/history/' + job_id) as response:
                    history = (await response.json()).get(job_id)
                if history:
                    (folder / 'history.json').write_text(json.dumps(history, indent=2))
                    messages = history.get('status', {}).get('messages', [])
                    state['execution_messages'] = messages
                    if history.get('status', {}).get('status_str') == 'error':
                        errors = [event[1] for event in messages if event[0] == 'execution_error']
                        if errors:
                            error = errors[-1]
                            raise RuntimeError('Node ' + str(error.get('node_id')) + ': ' + str(error.get('exception_type')) + ': ' + str(error.get('exception_message'))[:1800])
                        raise RuntimeError('ComfyUI execution failed; full history retained in the private job archive.')
                    if history.get('status', {}).get('completed'):
                        exported = history.get('outputs', {}).get('6', {}).get('generated_glbs', [])
                        if not exported or exported[0].get('filename') != output.name:
                            raise ValueError('ComfyUI completed without a real exported GLB')
                        artifact = validate_output(output)
                        if artifact['sha256'] != exported[0].get('sha256'):
                            raise ValueError('Generated GLB hash differs from execution history')
                        state.update(status='generated_unqualified', stage='awaiting_asset_qualification', artifact=artifact,
                                     duration_seconds=time.time() - state['started_unix'], completed_unix=time.time())
                        save(folder, state)
                        break
                save(folder, state)
                await asyncio.sleep(1)
    except Exception as error:
        state.update(status='failed', error=str(error), stage='generation_failed', completed_unix=time.time())
        save(folder, state)
    finally:
        # Separate ComfyUI process per job guarantees model unloading, including
        # custom nodes that retain CUDA tensors outside ComfyUI's cache manager.
        await stop_comfy()


async def scheduler(app):
    global ACTIVE, LAST_ERROR
    try:
        while True:
            try:
                for folder in job_folders():
                    state = read_state(folder)
                    if state['status'] in TERMINAL:
                        continue
                    if not gpu_validated():
                        state.update(status='waiting_resources', stage='gpu_validation_required', reason='GPU diagnostics must pass for this engine version before inference.')
                        save(folder, state)
                        continue
                    models = model_status()
                    if not models['ready']:
                        state.update(status='waiting_models', stage='checkpoints_missing', reason=models['reason'])
                        save(folder, state)
                        continue
                    available = await resources()
                    if available['vm_available_mib'] < LIMITS['min_vm_available_mib'] or available['gpu_free_mib'] < LIMITS['min_gpu_free_mib']:
                        state.pop('reason', None)
                        state.update(status='waiting_resources', stage='resource_admission', resources=available)
                        save(folder, state)
                        continue
                    ACTIVE = state['id']
                    await generate(folder)
                    ACTIVE = None
            except Exception as error:
                LAST_ERROR = str(error)
            await asyncio.sleep(10)
    finally:
        await stop_comfy()


@web.middleware
async def authenticate(request, handler):
    if not TOKEN or not hmac.compare_digest(request.headers.get('Authorization', ''), 'Bearer ' + TOKEN):
        raise web.HTTPUnauthorized(text='Private TRELLIS worker authentication required')
    try:
        return await handler(request)
    except (ValueError, KeyError, UnidentifiedImageError, Image.DecompressionBombError) as error:
        return web.json_response({'error': str(error)}, status=422)


async def operations(request):
    try:
        hardware = await resources()
    except Exception as error:
        hardware = {'error': str(error)}
    reference = HERE / 'references/arsenaldo-v1.png'
    return web.json_response({'provider': 'trellis2-gguf', 'active': ACTIVE, 'models': model_status(), 'limits': LIMITS, 'limits_sha256': sha(canonical(LIMITS)),
        'gpu_validated': gpu_validated(),
        'engine_sha256': sha(canonical(engine_manifest())), 'engine': engine_manifest(),
        'hardware': hardware, 'workflow_sha256': sha(canonical(WORKFLOW)), 'reference_sha256': sha(reference.read_bytes()) if reference.is_file() else None, 'references': references(),
        'pins_sha256': sha((HERE / 'model-pins.json').read_bytes()), 'last_error': LAST_ERROR,
        'publication': 'Generated sources require separate asset qualification; static meshes cannot publish as animated avatars.'})


async def submit(request):
    job_id = identifier(request.match_info['id'])
    plan = await request.json()
    if set(plan) != {'version', 'avatar_id', 'seed', 'reference_sha256', 'workflow_sha256', 'pins_sha256', 'limits_sha256', 'engine_sha256'} or plan['version'] != 1 or plan['avatar_id'] not in CATALOG:
        raise ValueError('Unsupported versioned generation plan')
    if type(plan['seed']) is not int or not 0 <= plan['seed'] <= 0x7fffffff:
        raise ValueError('Invalid generation seed')
    reference = reference_path(plan['avatar_id'], plan['reference_sha256'])
    if plan['engine_sha256'] != sha(canonical(engine_manifest())) or plan['reference_sha256'] != sha(reference.read_bytes()) or plan['workflow_sha256'] != sha(canonical(WORKFLOW)) or plan['pins_sha256'] != sha((HERE / 'model-pins.json').read_bytes()) or plan['limits_sha256'] != sha(canonical(LIMITS)):
        raise ValueError('Generation source/version mismatch')
    folder = ROOT / 'jobs' / job_id
    if folder.exists():
        if json.loads((folder / 'plan.json').read_text()) != plan:
            return web.json_response({'error': 'Immutable plan mismatch'}, status=409)
        return web.json_response(read_state(folder))
    if any(read_state(f)['status'] not in TERMINAL for f in job_folders()):
        return web.json_response({'error': 'One generation at a time'}, status=409)
    verify_reference(reference)
    provenance = archive_reference(plan['avatar_id'], plan['reference_sha256'], reference)
    staging = ROOT / 'staging' / job_id
    staging.mkdir(parents=True, exist_ok=True)
    (staging / 'plan.json').write_text(json.dumps(plan, indent=2))
    (staging / 'workflow.json').write_text(json.dumps(build_workflow(job_id, plan['seed']), indent=2))
    (ROOT / 'input' / (job_id + '.png')).write_bytes(reference.read_bytes())
    state = {'id': job_id, 'seed': plan['seed'], 'status': 'queued', 'stage': 'admission', 'created_unix': time.time(), 'plan_sha256': sha(canonical(plan)),
             'limits': copy.deepcopy(LIMITS), 'engine': engine_manifest(), 'avatar_id': plan['avatar_id'],
             'reference_sha256': plan['reference_sha256'], 'reference_source': provenance}
    save(staging, state)
    staging.rename(folder)
    return web.json_response(state, status=202)


async def status(request):
    folder = ROOT / 'jobs' / identifier(request.match_info['id'])
    if not folder.is_dir():
        raise web.HTTPNotFound()
    return web.json_response(read_state(folder))


async def artifact(request):
    job_id = identifier(request.match_info['id'])
    state = read_state(ROOT / 'jobs' / job_id)
    if state['status'] != 'generated_unqualified':
        raise web.HTTPConflict(text='No generated artifact')
    path = ROOT / 'output' / (job_id + '.glb')
    actual = validate_output(path)
    if actual['sha256'] != state['artifact']['sha256']:
        raise web.HTTPConflict(text='Immutable generated artifact changed')
    return web.FileResponse(path, headers={'Content-Type': 'model/gltf-binary', 'Cache-Control': 'no-store'})


async def lifespan(app):
    for directory in ['models', 'jobs', 'input', 'output', 'staging']:
        (ROOT / directory).mkdir(parents=True, exist_ok=True)
    # A lost inference process may retry with the same frozen prompt identifier.
    # Existing exported bytes are validated and recovered before resubmission.
    for folder in job_folders():
        state = read_state(folder)
        if state['status'] == 'running':
            retries = state.get('restart_retries', 0) + 1
            state.update(status='queued' if retries <= 1 else 'failed', restart_retries=retries,
                         error='Interrupted inference; bounded restart recovery')
            save(folder, state)
    task = asyncio.create_task(scheduler(app))
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


def app():
    application = web.Application(middlewares=[authenticate], client_max_size=17 * 1024 * 1024)
    application.router.add_get('/operations', operations)
    application.router.add_post('/references/{avatar_id}', upload_reference)
    application.router.add_get('/references/{avatar_id}/{digest}', reference_image)
    application.router.add_post('/jobs/{id}', submit)
    application.router.add_get('/jobs/{id}', status)
    application.router.add_get('/jobs/{id}/artifact', artifact)
    application.cleanup_ctx.append(lifespan)
    return application


if __name__ == '__main__':
    if len(TOKEN) < 32:
        raise SystemExit('A private TRELLIS_WORKER_TOKEN of at least 32 characters is required')
    web.run_app(app(), host='0.0.0.0', port=8096, access_log=None)
