"""Owner controls and modular-equipment admission around the frozen inference bridge.

The inference service, checkpoint hashes, image and admitted plan hashes remain
unchanged. Control source is separately fingerprinted in operations and receipts.
Mounted read-only; no arbitrary workflows, code or external URLs are accepted.
"""
import asyncio
import hashlib
import json
import time
import fcntl
import base64
import copy
import uuid
import os
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
    lease = Path(os.environ.get('TRELLIS_GPU_LEASE', '/gpu-lease'))
    lease.mkdir(parents=True, exist_ok=True)
    lock=open(lease / 'inference.lock','a+')
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
    payload['equipment'] = {'supported': True, 'slots':['primary','secondary'], 'control_sha256':CONTROL_SHA}
    return web.json_response(payload)


def equipment_directory(avatar,slot):
    if avatar not in service.CATALOG or slot not in {'primary','secondary'}:
        raise ValueError('Unknown equipment avatar or slot')
    return service.ROOT/'equipment-references'/avatar/slot


async def upload_equipment_reference(request):
    """Validate a real authenticated upload in its own immutable namespace."""
    avatar,slot=request.match_info['avatar_id'],request.match_info['slot']
    directory=equipment_directory(avatar,slot)
    payload=await request.json()
    if set(payload)!={'png_base64','source_sha256'}:raise ValueError('Unsupported equipment reference upload')
    content=base64.b64decode(payload['png_base64'],validate=True)
    digest=service.sha(content)
    if len(content)>12*1024**2 or digest!=payload['source_sha256']:raise ValueError('Equipment upload hash or size mismatch')
    directory.mkdir(parents=True,exist_ok=True)
    temporary=directory/(str(uuid.uuid4())+'.tmp')
    try:
        temporary.write_bytes(content)
        service.verify_reference(temporary)
        with service.Image.open(temporary) as image:
            if image.mode!='RGBA' or image.getextrema()[3][0]>0 or image.getextrema()[3][1]<205:
                raise ValueError('Equipment requires a transparent RGBA cutout')
        target=directory/(digest+'.png')
        if target.exists():
            if target.is_symlink() or service.sha(target.read_bytes())!=digest:raise ValueError('Archived equipment reference changed')
        else:temporary.replace(target)
        metadata=directory/(digest+'.json')
        if not metadata.exists():
            metadata.write_text(json.dumps({'sha256':digest,'provider':'authenticated-equipment-upload','avatar_id':avatar,
                'slot':slot,'created_unix':time.time(),'control_sha256':CONTROL_SHA},indent=2))
        return web.json_response(json.loads(metadata.read_text()))
    finally:temporary.unlink(missing_ok=True)


async def submit_equipment(request):
    job_id=service.identifier(request.match_info['id'])
    plan=await request.json()
    fields={'version','avatar_id','seed','reference_sha256','workflow_sha256','pins_sha256','limits_sha256','engine_sha256','purpose','equipment_slot'}
    if set(plan)!=fields or plan['version']!=1 or plan['purpose']!='modular-equipment':raise ValueError('Unsupported equipment plan')
    if type(plan['seed']) is not int or not 0<=plan['seed']<=0x7fffffff:raise ValueError('Invalid equipment seed')
    directory=equipment_directory(plan['avatar_id'],plan['equipment_slot'])
    digest=plan['reference_sha256']
    if not isinstance(digest,str) or len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest):raise ValueError('Invalid equipment reference hash')
    reference=directory/(digest+'.png')
    metadata=directory/(digest+'.json')
    if reference.is_symlink() or metadata.is_symlink() or not reference.is_file() or not metadata.is_file():raise ValueError('Upload equipment through the authenticated reference endpoint first')
    provenance=json.loads(metadata.read_text())
    if service.sha(reference.read_bytes())!=digest or provenance.get('sha256')!=digest or provenance.get('avatar_id')!=plan['avatar_id'] or provenance.get('slot')!=plan['equipment_slot']:raise ValueError('Equipment provenance mismatch')
    expected={'engine_sha256':service.sha(service.canonical(service.engine_manifest())),
        'workflow_sha256':service.sha(service.canonical(service.WORKFLOW)),'pins_sha256':service.sha((service.HERE/'model-pins.json').read_bytes()),
        'limits_sha256':service.sha(service.canonical(service.LIMITS))}
    if any(plan[key]!=value for key,value in expected.items()):raise ValueError('Frozen equipment engine/configuration changed')
    folder=service.ROOT/'jobs'/job_id
    if folder.exists():
        if (folder/'cancelled.json').exists():return web.json_response(service.read_state(folder))
        if json.loads((folder/'plan.json').read_text())!=plan:return web.json_response({'error':'Immutable equipment plan mismatch'},status=409)
        return web.json_response(service.read_state(folder))
    if any(service.read_state(f)['status'] not in service.TERMINAL for f in service.job_folders()):
        return web.json_response({'error':'One generation at a time'},status=409)
    service.verify_reference(reference)
    staging=service.ROOT/'staging'/job_id;staging.mkdir(parents=True,exist_ok=True)
    (staging/'plan.json').write_text(json.dumps(plan,indent=2))
    (staging/'workflow.json').write_text(json.dumps(service.build_workflow(job_id,plan['seed']),indent=2))
    (service.ROOT/'input'/(job_id+'.png')).write_bytes(reference.read_bytes())
    state={'id':job_id,'status':'queued','stage':'admission','created_unix':time.time(),'plan_sha256':service.sha(service.canonical(plan)),
        'limits':copy.deepcopy(service.LIMITS),'engine':service.engine_manifest(),'avatar_id':plan['avatar_id'],
        'purpose':'modular-equipment','equipment_slot':plan['equipment_slot'],'reference_sha256':digest,'reference_source':provenance,'publication_eligible':False}
    save(staging,state);staging.rename(folder)
    return web.json_response(state,status=202)


service.TERMINAL.update({'cancelled', 'model_deleted'})
service.save = save
service.generate = generate
service.submit = submit
service.operations = operations
application = service.app()
application.router.add_post('/jobs/{id}/cancel', cancel)
application.router.add_delete('/jobs/{id}/artifact', delete_artifact)
application.router.add_post('/equipment-references/{avatar_id}/{slot}',upload_equipment_reference)
application.router.add_post('/equipment-jobs/{id}',submit_equipment)
if __name__ == '__main__':
    if len(service.TOKEN) < 32:
        raise SystemExit('Private worker token required')
    web.run_app(application, host=os.environ.get('TRELLIS_BIND', '0.0.0.0'), port=8096, access_log=None)
