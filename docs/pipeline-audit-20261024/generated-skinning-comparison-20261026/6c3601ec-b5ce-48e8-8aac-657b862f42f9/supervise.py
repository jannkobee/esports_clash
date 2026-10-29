import fcntl,hashlib,json,os,pathlib,signal,subprocess,time
r=pathlib.Path(__file__).parent
state={'id':r.name,'compute':'google','publication_eligible':False,'status':'queued'}
def save():
 p=r/'state.tmp.json';p.write_text(json.dumps(state,indent=2));p.replace(r/'state.json')
save()
assert os.environ.get('COLAB_RELEASE_TAG')
lease=pathlib.Path('/content/esports-trellis2/gpu-lease/inference.lock');lease.parent.mkdir(parents=True,exist_ok=True)
with lease.open('a+') as lock:
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:state.update(status='waiting_resources');save();raise SystemExit()
 process=None
 try:
  installed=json.loads(pathlib.Path('/content/teamfight-preparation/installation.json').read_text())
  if installed['status']!='installed_unqualified':raise RuntimeError('Environment installation not complete')
  state.update(status='running',runtime_id=installed['runtime_id'],environment_sha256=installed['environment_sha256'],started_unix=time.time());save()
  with (r/'review.log').open('ab') as log:
   process=subprocess.Popen(['/content/teamfight-preparation/venv/bin/python',str(r/'tools/compare_generated_skinning.py'),str(r)],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   result=process.wait(timeout=1200)
  if result:raise RuntimeError('Comparison failed; retained log has details')
  report=r/'output/report.json';state.update(status='completed',report_sha256=hashlib.sha256(report.read_bytes()).hexdigest())
 except Exception as error:state.update(status='failed',error=str(error))
 finally:
  if process:
   try:os.killpg(process.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   process.wait()
  state['completed_unix']=time.time();save()
