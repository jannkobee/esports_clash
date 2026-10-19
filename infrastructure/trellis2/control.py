"""Cancellation-only extension around the frozen, verified inference bridge.

The inference service, checkpoint hashes, image and admitted plan hashes remain
unchanged. Control source is separately fingerprinted in operations and receipts.
Mounted read-only; no arbitrary workflows, code or external URLs are accepted.
"""
import asyncio
import hashlib
import json
import time
import fcntl
from pathlib import Path
import service
from aiohttp import web

TASKS = {}
CONTROL_SHA = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
original_generate = service.generate
original_save = service.save
original_operations = service.operations
original_submit = service.submit


def save(folder, state):
    if (folder / 'cancelled.json').exists():
        state.update(status='cancelled', stage='cancelled', publication_eligible=False, control_sha256=CONTROL_SHA)
    original_save(folder, state)


async def generate(folder):
    if (folder / 'cancelled.json').exists():
        return
    Path('/gpu-lease').mkdir(exist_ok=True)
    lock=open('/gpu-lease/inference.lock','a+')
    try:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:
        lock.close()
        state=service.read_state(folder)
        state.update(status='waiting_resources',stage='waiting_for_shared_gpu')
        save(folder,state)
        return
    task = asyncio.create_task(original_generate(folder))
    TASKS[folder.name] = task
    try:
        await task
    except asyncio.CancelledError:
        if not (folder / 'cancelled.json').exists():
            raise
    finally:
        TASKS.pop(folder.name, None)
        lock.close()


async def cancel(request):
    job_id = service.identifier(request.match_info['id'])
    folder = service.ROOT / 'jobs' / job_id
    folder.mkdir(parents=True, exist_ok=True)
    receipt = {'at': time.time(), 'control_sha256': CONTROL_SHA}
    (folder / 'cancelled.json').write_text(json.dumps(receipt))
    task = TASKS.get(job_id)
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    # The inference coroutine's finally block awaits full Comfy shutdown before
    # acknowledgement. Unadmitted jobs receive a durable no-launch tombstone.
    state = service.read_state(folder) if (folder / 'state.json').exists() else {'id': job_id}
    state.update(status='cancelled', stage='cancelled', completed_unix=time.time())
    save(folder, state)
    return web.json_response(state)


async def submit(request):
    folder = service.ROOT / 'jobs' / service.identifier(request.match_info['id'])
    if (folder / 'cancelled.json').exists():
        return web.json_response(service.read_state(folder))
    return await original_submit(request)


async def delete_artifact(request):
    job_id = service.identifier(request.match_info['id'])
    folder = service.ROOT / 'jobs' / job_id
    if not (folder / 'state.json').is_file():
        raise web.HTTPNotFound()
    state = service.read_state(folder)
    if job_id in TASKS or state.get('status') not in {'generated_unqualified', 'model_deleted'}:
        raise web.HTTPConflict(text='Only completed inactive models can be deleted')
    path = service.ROOT / 'output' / (job_id + '.glb')
    if path.is_symlink():
        raise web.HTTPConflict(text='Refusing linked artifact')
    path.unlink(missing_ok=True)
    state.pop('artifact', None)
    state.update(status='model_deleted', stage='model_deleted', publication_eligible=False)
    save(folder, state)
    return web.json_response({'id': job_id, 'status': 'model_deleted'})


async def operations(request):
    response = await original_operations(request)
    payload = json.loads(response.body)
    payload['cancellation'] = {'supported': True, 'control_sha256': CONTROL_SHA}
    return web.json_response(payload)


service.TERMINAL.update({'cancelled', 'model_deleted'})
service.save = save
service.generate = generate
service.submit = submit
service.operations = operations
application = service.app()
application.router.add_post('/jobs/{id}/cancel', cancel)
application.router.add_delete('/jobs/{id}/artifact', delete_artifact)
if __name__ == '__main__':
    if len(service.TOKEN) < 32:
        raise SystemExit('Private worker token required')
    web.run_app(application, host='0.0.0.0', port=8096, access_log=None)
