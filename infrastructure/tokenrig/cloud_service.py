"""Private raw-rig service for the existing Google Colab preparation environment.

Only frozen, owner-started plans are accepted. No repair, retargeting, clothing
assembly or publication takes place in this service.
"""
import asyncio
import contextlib
import fcntl
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import signal
import struct
import sys
import time
import uuid
from aiohttp import web

ROOT = Path('/content/teamfight-preparation')
TOOLS = Path(__file__).resolve().parent
DATA = ROOT / 'data'
LEASE = Path('/content/esports-trellis2/gpu-lease')
MAX_BYTES = 32 * 1024**2
TASKS = {}
PROCESSES = {}
TOKEN = (ROOT / '.worker-token').read_text().strip()


def sha(content):
    return hashlib.sha256(content).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def engine():
    installed = json.loads((ROOT / 'installation.json').read_text())
    files = {name: sha((TOOLS / name).read_bytes()) for name in
             ('cloud_service.py', 'diagnose_colab.py', 'run_trial.py', 'model-pins.json', 'prepare_t4_trial.py')}
    return {'provider': 'tokenrig', 'profile': installed.get('profile'),
            'sources': files, 'environment_sha256': installed.get('environment_sha256'),
            'model_revision': installed.get('model_revision'), 'version': 'colab-raw-rig-v1'}


def ready():
    try:
        installed = json.loads((ROOT / 'installation.json').read_text())
        runtime = json.loads((ROOT / 'runtime.json').read_text())
        return (bool(os.environ.get('COLAB_RELEASE_TAG'))
                and installed.get('status') == 'installed_unqualified'
                and installed.get('compute') == 'google'
                and installed.get('profile') == 't4-fp32'
                and runtime.get('status') == 'passed'
                and runtime.get('engine_sha256') == sha(canonical(engine()))
                and set(installed.get('tools', {})) == {
                    'provision_colab.py', 'model-pins.json', 'prepare_t4_trial.py',
                    'verify_attention.py', 'download_models.py', 'run_trial.py'}
                and all(sha((TOOLS / name).read_bytes()) == digest
                        for name, digest in installed['tools'].items()))
    except (OSError, ValueError, KeyError):
        return False


def identifier(value):
    if str(uuid.UUID(value)) != value:
        raise ValueError('Invalid job identifier')
    return value


def read(folder):
    return json.loads((folder / 'state.json').read_text())


def save(folder, state):
    state.update(updated_unix=time.time(), publication_eligible=False)
    if (folder / 'cancelled.json').exists():
        state.update(status='cancelled', stage='cancelled')
    temp = folder / 'state.tmp.json'
    temp.write_text(json.dumps(state, indent=2))
    temp.replace(folder / 'state.json')


def artifact(path):
    if not path.is_file() or path.is_symlink() or not 20 <= path.stat().st_size <= 64 * 1024**2:
        raise ValueError('Missing or oversized rig artifact')
    content = path.read_bytes()
    if content[:4] != b'glTF' or struct.unpack_from('<II', content, 4) != (2, len(content)) or content[16:20] != b'JSON':
        raise ValueError('Invalid rig GLB container')
    document = json.loads(content[20:20 + struct.unpack_from('<I', content, 12)[0]])
    if (not document.get('skins') or not any(
            'JOINTS_0' in p.get('attributes', {}) and 'WEIGHTS_0' in p.get('attributes', {})
            for m in document.get('meshes', []) for p in m['primitives'])):
        raise ValueError('Raw rig contains no skinned geometry')
    return {'sha256': sha(content), 'bytes': len(content), 'skins': len(document['skins']),
            'joints': [document['nodes'][i].get('name', str(i)) for i in document['skins'][0]['joints']],
            'publication_eligible': False}


async def stop(job_id):
    process = PROCESSES.get(job_id)
    if process:
        # The helper Blender process belongs to this same process group. Kill
        # the group even if the parent exited before exporting its receipt.
        with contextlib.suppress(ProcessLookupError):
            os.killpg(process.pid, signal.SIGTERM)
        try:
            await asyncio.wait_for(process.wait(), 8)
        except asyncio.TimeoutError:
            pass
        with contextlib.suppress(ProcessLookupError):
            os.killpg(process.pid, signal.SIGKILL)
        await process.wait()
        PROCESSES.pop(job_id, None)


async def execute(folder):
    state = read(folder)
    lock = None
    try:
        if (folder / 'cancelled.json').exists():
            return
        plan = state['plan']
        if not ready() or plan['engine_sha256'] != sha(canonical(engine())):
            raise RuntimeError('Cloud rig engine is unavailable or changed; frozen plan retained.')
        LEASE.mkdir(parents=True, exist_ok=True)
        lock = (LEASE / 'inference.lock').open('a+')
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            state.update(status='waiting_resources', stage='waiting_for_shared_gpu')
            save(folder, state)
            return
        memory = await asyncio.create_subprocess_exec('nvidia-smi', '--query-gpu=memory.free',
            '--format=csv,noheader,nounits', stdout=asyncio.subprocess.PIPE)
        free, _ = await asyncio.wait_for(memory.communicate(), 10)
        if memory.returncode or int(free.decode().splitlines()[0]) < 6 * 1024:
            state.update(status='waiting_resources', stage='waiting_for_colab_gpu_memory')
            save(folder, state)
            return
        source = DATA / 'inputs' / (plan['source_sha256'] + '.glb')
        native = Path('/content/esports-trellis2/data/output') / (plan['generation_id'] + '.glb')
        if not source.is_file() and native.is_file() and not native.is_symlink():
            content = native.read_bytes()
            if len(content) > MAX_BYTES or sha(content) != plan['source_sha256']:
                raise ValueError('Generated source no longer matches the frozen cloud rig plan')
            source.write_bytes(content)
        if not source.is_file() or source.is_symlink() or source.stat().st_size > MAX_BYTES or sha(source.read_bytes()) != plan['source_sha256']:
            raise ValueError('Exact frozen clean base is unavailable in Colab')
        # A raw source copy belongs to this attempt; it is never repaired in place.
        (folder / 'source.glb').write_bytes(source.read_bytes())
        output = folder / 'raw-rig.glb'
        state.update(status='rigging', stage='raw_skeleton_and_skin_prediction',
                     started_unix=time.time(), execution={'compute': 'google',
                     'runtime_id': json.loads((ROOT / 'installation.json').read_text())['runtime_id'],
                     'engine_sha256': plan['engine_sha256'], 'source_sha256': plan['source_sha256']})
        save(folder, state)
        command = [sys.executable, str(TOOLS / 'run_trial.py'), str(ROOT / 'SkinTokens'),
                   str(folder / 'source.glb'), str(output), '--source-sha256', plan['source_sha256'],
                   '--seed', str(plan['seed']), '--profile', 't4-fp32']
        with (folder / 'inference.log').open('ab') as log:
            process = await asyncio.create_subprocess_exec(*command, stdout=log, stderr=log, start_new_session=True)
            PROCESSES[folder.name] = process
            state['execution']['process_pid'] = process.pid
            save(folder, state)
            try:
                import psutil
                waiter = asyncio.create_task(process.wait())
                deadline = time.monotonic() + 900
                while not waiter.done():
                    await asyncio.wait([waiter], timeout=2)
                    if time.monotonic() > deadline or psutil.virtual_memory().available < 768 * 1024**2:
                        raise RuntimeError('Colab rig inference exceeded its time or available-memory budget.')
                await waiter
                if process.returncode:
                    raise RuntimeError('Raw rig prediction failed; private cloud log and source retained.')
            finally:
                await stop(folder.name)
        report = json.loads(output.with_suffix('.report.json').read_text())
        if report.get('source_sha256') != plan['source_sha256'] or report.get('status') != 'rigged_unqualified':
            raise ValueError('Raw rig receipt identity mismatch')
        result = artifact(output)
        if result['sha256'] != report.get('artifact_sha256') or result['bytes'] != report.get('artifact_bytes'):
            raise ValueError('Raw rig artifact disagrees with its inference receipt')
        state.update(status='rigged_unqualified', stage='raw_rig_awaiting_deformation_review',
                     artifact=result, report=report, completed_unix=time.time())
        save(folder, state)
    except asyncio.CancelledError:
        await stop(folder.name)
        raise
    except Exception as error:
        state.update(status='failed', stage='raw_rig_failed', error=str(error)[:1200])
        save(folder, state)
    finally:
        if lock:
            lock.close()
        TASKS.pop(folder.name, None)


@web.middleware
async def private(request, handler):
    actual = request.headers.get('Authorization', '')
    if not hmac.compare_digest(actual, 'Bearer ' + TOKEN):
        return web.json_response({'error': 'Private cloud preparation authentication required'}, status=401)
    try:
        return await handler(request)
    except (ValueError, KeyError) as error:
        return web.json_response({'error': str(error)}, status=422)


async def operations(request):
    manifest = engine()
    return web.json_response({'provider': 'tokenrig', 'profile': 'tokenrig-colab-raw-v1',
        'engine_sha256': sha(canonical(manifest)), 'engine': manifest,
        'compute': {'selected': 'google', 'automatic_fallback': False, 'policy': 'colab-only-v1'},
        'runtime_ready': ready(), 'models_ready': ready(), 'stages': ['rigging'] if ready() else [],
        'active': list(TASKS), 'publication_eligible': False,
        'scope': 'Raw skeleton/skin prediction only. Animation and deformation qualification remain separate.'})


async def input_upload(request):
    digest = request.match_info['sha']
    if not re.fullmatch('[a-f0-9]{64}', digest):
        raise ValueError('Invalid source hash')
    import base64
    content = base64.b64decode((await request.json())['glb_base64'], validate=True)
    if not 20 <= len(content) <= MAX_BYTES or content[:4] != b'glTF' or sha(content) != digest:
        raise ValueError('Frozen input integrity failed')
    path = DATA / 'inputs' / (digest + '.glb')
    if path.exists() and (path.is_symlink() or path.read_bytes() != content):
        raise ValueError('Immutable input changed')
    path.write_bytes(content)
    return web.json_response({'sha256': digest, 'bytes': len(content)})


async def submit(request):
    job_id = identifier(request.match_info['id'])
    folder = DATA / 'jobs' / job_id
    plan = await request.json()
    if (plan.get('version') != 1 or plan.get('provider') != 'tokenrig'
            or plan.get('compute') != 'google' or plan.get('stage') != 'clean_base_raw_rig'
            or not re.fullmatch(r'c_[a-z0-9_]+', plan.get('avatar_id', ''))
            or not re.fullmatch(r'[a-f0-9]{64}', plan.get('source_sha256', ''))
            or type(plan.get('seed')) is not int or not 0 <= plan['seed'] <= 2147483647):
        raise ValueError('Unsupported frozen raw-rig plan')
    identifier(plan['generation_id'])
    if folder.exists() and (folder / 'state.json').is_file():
        state = read(folder)
        if state.get('plan') != plan:
            return web.json_response({'error': 'Immutable rig plan mismatch'}, status=409)
        if state['status'] == 'waiting_resources' and job_id not in TASKS:
            TASKS[job_id] = asyncio.create_task(execute(folder))
        return web.json_response(state)
    if not ready() or plan.get('engine_sha256') != sha(canonical(engine())):
        return web.json_response({'error': 'Verified Colab rigging engine required'}, status=409)
    folder.mkdir(parents=True, exist_ok=True)
    state = {'id': job_id, 'status': 'queued', 'stage': 'raw_rig_admission', 'plan': plan}
    save(folder, state)
    if (folder / 'cancelled.json').exists():
        return web.json_response(read(folder))
    TASKS[job_id] = asyncio.create_task(execute(folder))
    return web.json_response(state, status=202)


async def status(request):
    folder = DATA / 'jobs' / identifier(request.match_info['id'])
    if not (folder / 'state.json').is_file():
        raise web.HTTPNotFound()
    return web.json_response(read(folder))


async def download(request):
    folder = DATA / 'jobs' / identifier(request.match_info['id'])
    state = read(folder)
    if state['status'] != 'rigged_unqualified' or artifact(folder / 'raw-rig.glb') != state['artifact']:
        raise web.HTTPConflict(text='No verified completed raw rig')
    return web.FileResponse(folder / 'raw-rig.glb', headers={'Content-Type': 'model/gltf-binary'})


async def cancel(request):
    job_id = identifier(request.match_info['id'])
    folder = DATA / 'jobs' / job_id
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'cancelled.json').write_text(json.dumps({'at': time.time()}))
    task = TASKS.get(job_id)
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
    await stop(job_id)
    state = read(folder) if (folder / 'state.json').exists() else {'id': job_id}
    state.update(status='cancelled', stage='cancelled')
    save(folder, state)
    return web.json_response(state)


async def recover(app):
    # A service restart never starts a second inference. Completed files can be
    # recovered by their exact receipt; interrupted attempts retain their source
    # and failure record for an explicitly started new attempt.
    for folder in (DATA / 'jobs').iterdir():
        if not re.fullmatch(r'[0-9a-f-]{36}', folder.name) or not (folder / 'state.json').is_file():
            continue
        state = read(folder)
        if state.get('status') not in ('queued', 'rigging', 'waiting_resources'):
            continue
        pid = state.get('execution', {}).get('process_pid')
        command = Path(f'/proc/{pid}/cmdline') if isinstance(pid, int) else None
        if command and command.exists():
            args = command.read_bytes().split(b'\0')
            if str(TOOLS / 'run_trial.py').encode() in args and str(folder / 'raw-rig.glb').encode() in args:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(pid, signal.SIGKILL)
        try:
            proof = json.loads((folder / 'raw-rig.report.json').read_text())
            result = artifact(folder / 'raw-rig.glb')
            if (proof.get('status') != 'rigged_unqualified'
                    or proof.get('source_sha256') != state['plan']['source_sha256']
                    or proof.get('artifact_sha256') != result['sha256']
                    or proof.get('artifact_bytes') != result['bytes']):
                raise ValueError('Incomplete cloud rig receipt')
            state.update(status='rigged_unqualified', stage='raw_rig_awaiting_deformation_review',
                         artifact=result, report=proof, recovered_export=True)
        except (OSError, ValueError, KeyError):
            state.update(status='failed', stage='cloud_execution_interrupted',
                         error='Cloud service restarted before a complete export. Frozen source and stage evidence retained; start a new attempt.')
        save(folder, state)


if __name__ == '__main__':
    if not os.environ.get('COLAB_RELEASE_TAG') or not ready():
        raise SystemExit('Verified Google Colab installation required; local execution is disabled.')
    for directory in ('jobs', 'inputs'):
        (DATA / directory).mkdir(parents=True, exist_ok=True)
    app = web.Application(middlewares=[private], client_max_size=45 * 1024**2)
    app.on_startup.append(recover)
    app.add_routes([web.get('/operations', operations), web.post('/inputs/{sha}', input_upload),
                    web.post('/jobs/{id}', submit), web.get('/jobs/{id}', status),
                    web.get('/jobs/{id}/artifact', download), web.post('/jobs/{id}/cancel', cancel)])
    web.run_app(app, host='127.0.0.1', port=8098, print=None)
