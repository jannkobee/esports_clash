"""Private manual-admission UniRig worker. No cloud requests during inference."""
import asyncio
import contextlib
import fcntl
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
from aiohttp import web

HERE = Path(__file__).parent
ROOT = Path(os.environ.get('UNIRIG_DATA','/unirig-data'))
PINS = json.loads((HERE / 'model-pins.json').read_text())
INFERENCE = json.loads((HERE / 'inference-pins.json').read_text())
CATALOG = {item['id'] for item in json.loads((HERE / 'catalog.json').read_text())['avatars']}
TOKEN = os.environ.get('EVOLUTION_WORKER_TOKEN','')
ACTIVE = None
TASKS = {}
PROCESS = None
VERIFIED = False
MODEL_ERROR = 'Model verification pending'
TERMINAL = {'rigged_unqualified','cancelled','failed'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def file_hash(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(4*1024*1024),b''):
            value.update(chunk)
    return value.hexdigest()


def engine():
    files = {name:sha((HERE/name).read_bytes()) for name in ['service.py','native_diagnostics.py','model-pins.json','install.py','requirements.txt','Dockerfile','inference-pins.json','prepare_inference_checkpoint.py','merge-blender.py']}
    packages = Path('/opt/unirig-packages.txt')
    return sha(json.dumps({'files':files,'packages':file_hash(packages) if packages.exists() else None,'commit':PINS['commit'],'image_id':os.environ.get('UNIRIG_IMAGE_ID','not-recorded')},sort_keys=True).encode())


def identifier(value):
    if not isinstance(value,str) or str(uuid.UUID(value)) != value:
        raise ValueError('Invalid identifier')
    return value


def runtime_ready():
    try:
        image=os.environ.get('UNIRIG_IMAGE_ID','')
        if not image.startswith('sha256:') or len(image)!=71:
            return False
        proof=json.loads((ROOT/'runtime.json').read_text())
        return proof.get('status')=='passed' and proof.get('engine_sha256')==engine()
    except (OSError,ValueError):
        return False


def save(folder,state):
    if (folder/'cancelled.json').exists():
        state.update(status='cancelled',stage='cancelled')
    state['updated_unix']=time.time()
    temp=folder/'state.tmp'
    temp.write_text(json.dumps(state,indent=2))
    temp.replace(folder/'state.json')


def read(folder):
    return json.loads((folder/'state.json').read_text())


async def resources():
    memory={line.split(':')[0]:int(line.split()[1])/1024 for line in Path('/proc/meminfo').read_text().splitlines()}
    process=await asyncio.create_subprocess_exec('nvidia-smi','--query-gpu=memory.free,memory.used','--format=csv,noheader,nounits',stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.DEVNULL)
    data,_=await asyncio.wait_for(process.communicate(),timeout=5)
    if process.returncode:
        raise RuntimeError('CUDA GPU unavailable')
    free,used=map(float,data.decode().splitlines()[0].split(','))
    return {'vm_available_mib':memory['MemAvailable'],'gpu_free_mib':free,'gpu_used_mib':used}


async def verify_models():
    global VERIFIED,MODEL_ERROR
    try:
        if INFERENCE['source_sha256'] != PINS['files'][1]['sha256']:
            raise RuntimeError('Inference checkpoint source pin mismatch')
        for item in [*PINS['files'], INFERENCE]:
            path=ROOT/'models'/item['path']
            if not path.is_file() or path.is_symlink() or path.stat().st_size!=item['bytes'] or await asyncio.to_thread(file_hash,path)!=item['sha256']:
                raise RuntimeError('Missing or corrupt checkpoint: '+item['path'])
        proof=json.loads((ROOT/'provision.json').read_text())
        if proof['pins']!=PINS or file_hash(ROOT/'models/opt-350m/config.json')!=proof['opt_config_sha256']:
            raise RuntimeError('Pinned OPT configuration mismatch')
        VERIFIED=True
        MODEL_ERROR=None
    except Exception as error:
        MODEL_ERROR=str(error)


async def stop_process():
    global PROCESS
    process=PROCESS
    if process and process.returncode is None:
        with contextlib.suppress(ProcessLookupError):
            os.killpg(process.pid,signal.SIGTERM)
        try:
            await asyncio.wait_for(process.wait(),8)
        except asyncio.TimeoutError:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(process.pid,signal.SIGKILL)
            await process.wait()
    PROCESS=None


async def step(folder,state,name,args,executable=sys.executable):
    global PROCESS
    state.update(status='rigging',stage=name)
    save(folder,state)
    with (folder/'inference.log').open('ab') as log:
        PROCESS=await asyncio.create_subprocess_exec(executable,*args,cwd='/opt/UniRig',stdout=log,stderr=log,start_new_session=True)
        started=time.monotonic()
        while PROCESS.returncode is None:
            await asyncio.sleep(2)
            sample=await resources()
            state['resources']=sample
            save(folder,state)
            if sample['vm_available_mib']<768 or sample['gpu_used_mib']>11500 or time.monotonic()-started>1200:
                raise RuntimeError('Inference resource/deadline guard stopped work; original asset retained')
        if PROCESS.returncode:
            raise RuntimeError('UniRig '+name+' exited '+str(PROCESS.returncode)+'; private inference log retained')
        PROCESS=None


def artifact(path):
    if not path.is_file() or path.is_symlink() or not 20<=path.stat().st_size<=64*1024*1024:
        raise RuntimeError('UniRig did not export a bounded GLB')
    data=path.read_bytes()
    if data[:4]!=b'glTF' or struct.unpack_from('<II',data,4)!=(2,len(data)) or data[16:20]!=b'JSON':
        raise RuntimeError('Invalid UniRig output container')
    document=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
    if not document.get('skins') or not any('JOINTS_0' in p.get('attributes',{}) and 'WEIGHTS_0' in p.get('attributes',{}) for m in document.get('meshes',[]) for p in m['primitives']):
        raise RuntimeError('Export contains no real skin weights')
    return {'sha256':sha(data),'bytes':len(data),'skins':len(document['skins']),'joints':list(dict.fromkeys(document['nodes'][i].get('name',str(i)) for s in document['skins'] for i in s['joints'])),'animations':len(document.get('animations',[])),'publication_eligible':False}


async def generate(folder):
    lock=None
    state=read(folder)
    try:
        Path('/gpu-lease').mkdir(exist_ok=True)
        lock=open('/gpu-lease/inference.lock','a+')
        try:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            state.update(status='waiting_resources',stage='waiting_for_shared_gpu')
            save(folder,state)
            return
        if state['plan']['engine_sha256']!=engine():
            raise RuntimeError('Frozen UniRig engine changed; create a new preparation')
        source=Path('/trellis-sources')/(state['plan']['generation_id']+'.glb')
        if source.is_symlink() or source.stat().st_size>32*1024**2 or await asyncio.to_thread(file_hash,source)!=state['plan']['source_sha256']:
            raise RuntimeError('Frozen TRELLIS source integrity mismatch')
        # Only fixed UUID-derived local paths reach upstream argument vectors.
        # Each model stage has its own process, so CUDA allocations are released.
        (folder/'source.glb').write_bytes(source.read_bytes())
        relative='work/'+folder.name+'/source.glb'
        intermediate=str(folder/'intermediate')
        await step(folder,state,'mesh_extraction',['-m','src.data.extract','--config=configs/data/quick_inference.yaml','--require_suffix=glb','--num_runs=1','--id=0','--time='+folder.name,'--faces_target_count=50000','--force_override=true','--input='+relative,'--output_dir='+intermediate])
        await step(folder,state,'skeleton_prediction',['run.py','--task=configs/task/quick_inference_skeleton_articulationxl_ar_256.yaml','--seed='+str(state['plan']['seed']),'--input='+relative,'--npz_dir='+intermediate,'--output='+str(folder/'skeleton.fbx')])
        # Upstream single-file mode writes FBX only. Follow generate_skin.sh:
        # extract that predicted skeleton, then skin its own raw_data.npz.
        skeleton_relative='work/'+folder.name+'/skeleton.fbx'
        await step(folder,state,'skeleton_mesh_extraction',['-m','src.data.extract','--config=configs/data/quick_inference.yaml','--require_suffix=fbx','--num_runs=1','--id=0','--time='+folder.name+'-skeleton','--faces_target_count=50000','--force_override=true','--input='+skeleton_relative,'--output_dir='+intermediate])
        skeleton_data=Path(intermediate)/'work'/folder.name/'skeleton'/'raw_data.npz'
        if not skeleton_data.is_file() or skeleton_data.is_symlink():
            raise RuntimeError('Predicted skeleton extraction did not produce its skinning input')
        await step(folder,state,'skin_weight_prediction',['run.py','--task=configs/task/quick_inference_unirig_skin.yaml','--seed='+str(state['plan']['seed']),'--input='+skeleton_relative,'--npz_dir='+intermediate,'--data_name=raw_data.npz','--output='+str(folder/'skin.fbx')])
        await step(folder,state,'merge_original_materials',['--background','--factory-startup','--threads','2','--python-exit-code','1','--python',str(HERE/'merge-blender.py'),'--',str(folder/'skin.fbx'),str(folder/'source.glb'),str(folder/'rigged.glb')],executable='/opt/blender-4.5.3-linux-x64/blender')
        state.update(status='rigged_unqualified',stage='awaiting_animation_retarget',artifact=artifact(folder/'rigged.glb'))
        save(folder,state)
    except asyncio.CancelledError:
        raise
    except Exception as error:
        state.update(status='failed',stage='rigging_failed',error=str(error))
        save(folder,state)
    finally:
        await stop_process()
        if lock:
            lock.close()


async def scheduler(app):
    global ACTIVE
    await verify_models()
    while True:
        for folder in sorted((ROOT/'jobs').iterdir()):
            if not folder.is_dir() or folder.is_symlink() or not (folder/'state.json').exists():
                continue
            state=read(folder)
            if state['status'] in TERMINAL:
                continue
            if not VERIFIED:
                state.update(status='waiting_models',stage='checkpoint_verification',error=MODEL_ERROR)
                save(folder,state)
                continue
            if not runtime_ready():
                state.update(status='waiting_resources',stage='native_setup_required',error='Native imports must pass for this exact worker version before inference')
                save(folder,state)
                continue
            try:
                available=await resources()
            except Exception as error:
                state.update(status='waiting_resources',stage='gpu_unavailable',error=str(error))
                save(folder,state)
                continue
            if available['gpu_free_mib']<8500 or available['vm_available_mib']<7168:
                state.update(status='waiting_resources',stage='resource_admission',resources=available)
                save(folder,state)
                continue
            if (folder/'cancelled.json').exists():
                continue
            ACTIVE=folder.name
            task=asyncio.create_task(generate(folder))
            TASKS[folder.name]=task
            try:
                await task
            except asyncio.CancelledError:
                if not (folder/'cancelled.json').exists():
                    raise
            finally:
                TASKS.pop(folder.name,None)
                ACTIVE=None
        await asyncio.sleep(10)


@web.middleware
async def authenticate(request,handler):
    if not TOKEN or not hmac.compare_digest(request.headers.get('Authorization',''),'Bearer '+TOKEN):
        raise web.HTTPUnauthorized()
    try:
        return await handler(request)
    except (ValueError,KeyError) as error:
        return web.json_response({'error':str(error)},status=422)


async def operations(request):
    return web.json_response({'provider':'unirig','engine_sha256':engine(),'commit':PINS['commit'],'models_ready':VERIFIED,'runtime_ready':runtime_ready(),'model_error':MODEL_ERROR,'active':ACTIVE,'manual_only':True,'requirements':{'gpu_free_mib':8500,'vm_available_mib':7168}})


async def job(request):
    job_id=identifier(request.match_info['id'])
    folder=ROOT/'jobs'/job_id
    if request.method=='GET':
        if not (folder/'state.json').exists():
            raise web.HTTPNotFound()
        return web.json_response(read(folder))
    plan=await request.json()
    if (folder/'cancelled.json').exists():
        return web.json_response(read(folder))
    if set(plan)!={'version','generation_id','avatar_id','source_sha256','engine_sha256','seed'} or plan['version']!=1 or plan['avatar_id'] not in CATALOG or plan['engine_sha256']!=engine() or not isinstance(plan['source_sha256'],str) or len(plan['source_sha256'])!=64 or any(c not in '0123456789abcdef' for c in plan['source_sha256']):
        raise ValueError('Unsupported frozen UniRig plan')
    identifier(plan['generation_id'])
    if type(plan['seed']) is not int or not 0<=plan['seed']<=2147483647:
        raise ValueError('Invalid seed')
    if (folder/'state.json').exists():
        state=read(folder)
        if state['plan']!=plan:
            raise web.HTTPConflict(text='Plan is immutable')
        return web.json_response(state)
    # Admission is called only by an owner-requested preparation. No roster scan.
    folder.mkdir(parents=True,exist_ok=True)
    state={'id':job_id,'status':'queued','stage':'manual_admission','plan':plan,'publication_eligible':False}
    save(folder,state)
    return web.json_response(state,status=202)


async def cancel(request):
    folder=ROOT/'jobs'/identifier(request.match_info['id'])
    folder.mkdir(parents=True,exist_ok=True)
    (folder/'cancelled.json').write_text(json.dumps({'at':time.time()}))
    task=TASKS.get(folder.name)
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
    state=read(folder) if (folder/'state.json').exists() else {'id':folder.name}
    state.update(status='cancelled',stage='cancelled')
    save(folder,state)
    return web.json_response(state)


async def download(request):
    folder=ROOT/'jobs'/identifier(request.match_info['id'])
    state=read(folder)
    if state['status']!='rigged_unqualified':
        raise web.HTTPConflict(text='No completed rig')
    if artifact(folder/'rigged.glb')['sha256']!=state['artifact']['sha256']:
        raise web.HTTPConflict(text='Rig artifact changed')
    return web.FileResponse(folder/'rigged.glb',headers={'Content-Type':'model/gltf-binary','Cache-Control':'no-store'})


async def lifespan(app):
    (ROOT/'jobs').mkdir(parents=True,exist_ok=True)
    for folder in (ROOT/'jobs').iterdir():
        if (folder/'state.json').exists():
            state=read(folder)
            if state['status']=='rigging':
                state.update(status='failed',error='Interrupted UniRig process; create a new manual preparation')
                save(folder,state)
    task=asyncio.create_task(scheduler(app))
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task
    await stop_process()


app=web.Application(middlewares=[authenticate],client_max_size=65536)
app.router.add_get('/operations',operations)
app.router.add_get('/jobs/{id}',job)
app.router.add_post('/jobs/{id}',job)
app.router.add_post('/jobs/{id}/cancel',cancel)
app.router.add_get('/jobs/{id}/artifact',download)
app.cleanup_ctx.append(lifespan)
if __name__=='__main__':
    if len(TOKEN)<32:
        raise SystemExit('Private worker token required')
    web.run_app(app,host='0.0.0.0',port=8098,access_log=None)
