"""Owner-approved launch archive, isolated from live match records and rating settlement."""
import hashlib, json, os, signal, subprocess
from pathlib import Path
RUNS = {}
def pause_for_live():
    for item in RUNS.values():
        if item['process'].poll() is None and not item['paused']:
            os.kill(item['process'].pid,signal.SIGSTOP);item['paused']=True

def handle(handler, method, token, root, live, lock):
    import hmac, re
    if not hmac.compare_digest(handler.headers.get('Authorization',''),'Bearer '+token):
        return handler.reply(401,{'error':'Private worker authorization required'})
    identifier=handler.path.split('?')[0].split('/')[-1]
    if not re.fullmatch(r'[a-f0-9-]{36}',identifier):return handler.reply(422,{'error':'Invalid archive ID'})
    folder=Path(root)/'launch-history'/identifier
    with lock:
        busy=any(p.poll() is None for p in live.values())
        for key,item in list(RUNS.items()):
            if item['process'].poll() is not None:continue
            if busy and not item['paused']:os.kill(item['process'].pid,signal.SIGSTOP);item['paused']=True
            elif not busy and item['paused']:os.kill(item['process'].pid,signal.SIGCONT);item['paused']=False
        if method=='POST':
            if busy or any(v['process'].poll() is None and k!=identifier for k,v in RUNS.items()):return handler.reply(409,{'status':'capacity_wait'})
            length=int(handler.headers.get('Content-Length',0))
            if length<=0 or length>2*1024*1024:return handler.reply(413,{'error':'Invalid archive allocation size'})
            allocation=json.loads(handler.rfile.read(length));plan=allocation.get('plan',{})
            canonical=json.dumps(plan,ensure_ascii=False,separators=(',',':')).encode()
            if plan.get('provenance')!='launch_simulation' or hashlib.sha256(canonical).hexdigest()!=allocation.get('plan_hash'):return handler.reply(422,{'error':'Invalid archive provenance/hash'})
            folder.mkdir(parents=True,exist_ok=True)
            target=folder/'allocation.json'
            if target.exists() and json.loads(target.read_text())!=allocation:return handler.reply(409,{'error':'Historical allocation is immutable'})
            target.write_text(json.dumps(allocation,ensure_ascii=False))
            if (folder/'result.json').exists():return handler.reply(200,{'status':'completed'})
            if (folder/'state.json').exists():
                prior=json.loads((folder/'state.json').read_text())
                if prior.get('status')=='failed':return handler.reply(200,prior)
            if identifier not in RUNS or RUNS[identifier]['process'].poll() is not None:
                log=open(folder/'worker.log','ab');p=subprocess.Popen(['node','--experimental-strip-types','/online/history-match.mjs',str(folder)],cwd='/workspace/EsportsClash.Web',stdout=log,stderr=log);log.close();RUNS[identifier]={'process':p,'paused':False}
            return handler.reply(202,{'status':'running'})
        if not folder.exists():return handler.reply(404,{'error':'Archive run not found'})
        if (folder/'result.json').exists():return handler.reply(200,{'status':'completed','result':json.loads((folder/'result.json').read_text())})
        state=json.loads((folder/'state.json').read_text()) if (folder/'state.json').exists() else {'status':'running'}
        if identifier in RUNS and RUNS[identifier]['process'].poll() is None:return handler.reply(200,{'status':'paused' if RUNS[identifier]['paused'] else 'running'})
        if state.get('status')=='failed':return handler.reply(200,state)
        return handler.reply(200,{'status':'interrupted'})
