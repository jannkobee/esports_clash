import fcntl, hashlib, json, os, pathlib, signal, subprocess, time
root=pathlib.Path(__file__).resolve().parent.parent
plan=json.loads((root/'plan.json').read_text())
state={'id':plan['id'],'status':'queued','compute':'google','publication_eligible':False}
def save():
 temp=root/'state.tmp.json'
 temp.write_text(json.dumps(state,indent=2))
 temp.replace(root/'state.json')
save()
if not os.environ.get('COLAB_RELEASE_TAG'):
 raise RuntimeError('Google Colab is required.')
lease=pathlib.Path('/content/esports-trellis2/gpu-lease')
lease.mkdir(parents=True,exist_ok=True)
with (lease/'inference.lock').open('a+') as lock:
 try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:
  state.update(status='waiting_resources',reason='Another cloud stage owns the shared runtime.')
  save()
  raise SystemExit(0)
 python='/content/teamfight-preparation/venv/bin/python'
 process=None
 try:
  installed=json.loads(pathlib.Path('/content/teamfight-preparation/installation.json').read_text())
  state.update(status='running',started_unix=time.time(),runtime_id=installed['runtime_id'],environment_sha256=installed['environment_sha256'])
  save()
  for name,expected in plan['tools'].items():
   if hashlib.sha256((root/'tools'/name).read_bytes()).hexdigest()!=expected:
    raise RuntimeError('Frozen diagnostic source changed.')
  with (root/'analysis.log').open('ab') as log:
   process=subprocess.Popen([python,str(root/'tools/analyze_bind_twist.py'),'--source',str(root/'source.glb'),
    '--output',str(root/'output'),'--source-sha256',plan['source_sha256']],
    stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   state['process_pid']=process.pid
   save()
   result=process.wait(timeout=600)
  if result: raise RuntimeError('Controlled diagnostic failed; cloud log and frozen source retained.')
  report=root/'output/report.json'
  payload=json.loads(report.read_text())
  if payload['source_sha256']!=plan['source_sha256'] or payload['publication_eligible'] is not False:
   raise RuntimeError('Diagnostic output identity mismatch.')
  state.update(status='completed',completed_unix=time.time(),artifact={'sha256':hashlib.sha256(report.read_bytes()).hexdigest(),'bytes':report.stat().st_size},report=payload)
 except Exception as error:
  state.update(status='failed',error=str(error),completed_unix=time.time())
 finally:
  if process:
   try: os.killpg(process.pid,signal.SIGKILL)
   except ProcessLookupError: pass
   process.wait()
  save()
