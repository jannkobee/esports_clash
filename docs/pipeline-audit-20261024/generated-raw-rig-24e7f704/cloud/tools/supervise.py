import fcntl,hashlib,json,os,pathlib,signal,subprocess,time
r=pathlib.Path(__file__).resolve().parent.parent
plan=json.loads((r/'plan.json').read_text())
state={'id':plan['id'],'compute':'google','status':'queued','publication_eligible':False}
def save():
 p=r/'state.tmp.json';p.write_text(json.dumps(state,indent=2));p.replace(r/'state.json')
save()
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Google Colab required')
with pathlib.Path('/content/esports-trellis2/gpu-lease/inference.lock').open('a+') as lease:
 try:fcntl.flock(lease,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:
  state.update(status='waiting_resources');save();raise SystemExit(0)
 process=None
 try:
  for name,expected in plan['files'].items():
   if hashlib.sha256((r/name).read_bytes()).hexdigest()!=expected:raise RuntimeError('Frozen review input changed')
  installed=json.loads(pathlib.Path('/content/teamfight-preparation/installation.json').read_text())
  state.update(status='running',started_unix=time.time(),runtime_id=installed['runtime_id'],environment_sha256=installed['environment_sha256']);save()
  with (r/'review.log').open('ab') as log:
   process=subprocess.Popen(['/content/teamfight-preparation/venv/bin/python',str(r/'tools/review_generated_rig.py'),str(r)],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   state['process_pid']=process.pid;save()
   result=process.wait(timeout=900)
  if result:raise RuntimeError('Controlled raw-rig review failed; inspect retained log')
  report=r/'output/report.json'
  state.update(status='completed',artifact={'sha256':hashlib.sha256(report.read_bytes()).hexdigest(),'bytes':report.stat().st_size})
 except Exception as error:state.update(status='failed',error=str(error))
 finally:
  if process:
   try:os.killpg(process.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   process.wait()
  state['completed_unix']=time.time();save()
