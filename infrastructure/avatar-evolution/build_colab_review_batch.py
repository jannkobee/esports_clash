"""Bundle already-frozen review jobs for sequential Colab execution and retention.

Local work only packages bytes. Each original launcher, compute guard and GPU
lease remains authoritative; no production admission or local fallback is added.
"""
import argparse,hashlib,io,json,pathlib,uuid,zipfile

parser=argparse.ArgumentParser()
parser.add_argument('--job-dir',action='append',type=pathlib.Path,required=True)
parser.add_argument('--output-dir',type=pathlib.Path,required=True)
args=parser.parse_args();bid=str(uuid.uuid4());out=args.output_dir/bid;out.mkdir(parents=True,exist_ok=False)
sha=lambda b:hashlib.sha256(b).hexdigest();files={};jobs=[]
for folder in args.job_dir:
    plan=json.loads((folder/'plan.json').read_text());rid=plan['id'];uuid.UUID(rid)
    assert plan['compute']=='google' and plan['publication_eligible'] is False and plan['qualification_complete'] is False
    assert rid not in [job['id'] for job in jobs]
    for name in ('input.zip','launch.py'):files['jobs/'+rid+'/'+name]=(folder/name).read_bytes()
    jobs.append({'id':rid,'method':plan.get('method'),'input_sha256':sha(files['jobs/'+rid+'/input.zip']),
        'launch_sha256':sha(files['jobs/'+rid+'/launch.py'])})
runner='''import fcntl,hashlib,json,os,pathlib,shutil,subprocess,time,zipfile
assert os.environ.get('COLAB_RELEASE_TAG')
r=pathlib.Path(__file__).parent;root=pathlib.Path('/content/teamfight-preparation');plan=json.loads((r/'batch-plan.json').read_text())
s={'id':plan['id'],'compute':'google','status':'running','publication_eligible':False,'qualification_complete':False,'jobs':[]}
def save():
 p=r/'batch-state.tmp.json';p.write_text(json.dumps(s,indent=2));p.replace(r/'batch-state.json')
def collect(job_id):
 source=root/'reviews'/job_id;destination=r/(job_id+'-evidence.zip')
 with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED) as z:
  for p in source.rglob('*'):
   rel=p.relative_to(source)
   if p.is_file() and (rel.parts[0] in ('output','screenshots') or p.name in ('input.zip','plan.json','state.json','backoffice-proof.json','bend-export-report.json','visual-report.json') or p.suffix=='.log' or p.name.endswith('-stress.glb')):
    z.write(p,str(rel))
 return {'file':destination.name,'bytes':destination.stat().st_size,'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()}
def archive_batch():
 with zipfile.ZipFile(r/'evidence.tmp.zip','w',zipfile.ZIP_STORED) as z:
  for name in ('batch-plan.json','batch-state.json','runner.log'):
   p=r/name
   if p.exists():z.write(p,name)
  for p in r.glob('*-evidence.zip'):z.write(p,p.name)
 (r/'evidence.tmp.zip').replace(r/'evidence.zip')
try:
 for job in plan['jobs']:
  source=r/'jobs'/job['id'];incoming=root/('incoming-'+job['id']+'.zip')
  for name,key in [('input.zip','input_sha256'),('launch.py','launch_sha256')]:
   assert hashlib.sha256((source/name).read_bytes()).hexdigest()==job[key]
  if incoming.exists():assert hashlib.sha256(incoming.read_bytes()).hexdigest()==job['input_sha256']
  else:shutil.copy2(source/'input.zip',incoming)
  item={'id':job['id'],'status':'launching'};s['jobs'].append(item);save()
  p=subprocess.run(['/content/teamfight-preparation/venv/bin/python',str(source/'launch.py')],capture_output=True,text=True,timeout=60)
  (r/(job['id']+'-launch.log')).write_text(p.stdout+'\\n'+p.stderr)
  if p.returncode:raise RuntimeError('Launch failed: '+job['id'])
  started=time.monotonic()
  while time.monotonic()-started<3000:
   state_file=root/'reviews'/job['id']/'state.json'
   if state_file.exists():
    current=json.loads(state_file.read_text());item.update(status=current['status'],stage=current.get('stage'));save()
    if current['status'] in ('completed','failed'):
     item['evidence']=collect(job['id']);save();archive_batch()
     if current['status']=='failed':raise RuntimeError('Review failed: '+job['id'])
     time.sleep(1);break
    if current['status']=='waiting_resources':raise RuntimeError('Review is waiting for its existing GPU lease; no fallback or automatic relaunch')
   time.sleep(2)
  else:raise TimeoutError('Review timed out: '+job['id'])
 s['status']='completed'
except Exception as error:s.update(status='failed',error=f'{type(error).__name__}: {error}')
finally:s['completed_unix']=time.time();save();archive_batch()
'''
files['runner.py']=runner.encode()
plan={'id':bid,'compute':'google','publication_eligible':False,'qualification_complete':False,'jobs':jobs,
    'runner_sha256':sha(files['runner.py'])}
files['batch-plan.json']=json.dumps(plan,indent=2).encode();buf=io.BytesIO()
with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in files.items():z.writestr(name,data)
(out/'input.zip').write_bytes(buf.getvalue());(out/'batch-plan.json').write_bytes(files['batch-plan.json'])
launch=f'''import hashlib,json,os,pathlib,shutil,subprocess,zipfile
assert os.environ.get('COLAB_RELEASE_TAG');root=pathlib.Path('/content/teamfight-preparation');incoming=root/'batch-{bid}.zip';r=root/'batches'/{bid!r}
assert hashlib.sha256(incoming.read_bytes()).hexdigest()=={sha(buf.getvalue())!r};r.mkdir(parents=True,exist_ok=False)
with zipfile.ZipFile(incoming) as z:
 assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in z.namelist());z.extractall(r)
plan=json.loads((r/'batch-plan.json').read_text());assert hashlib.sha256((r/'runner.py').read_bytes()).hexdigest()==plan['runner_sha256']
with (r/'runner.log').open('ab') as log:p=subprocess.Popen(['/content/teamfight-preparation/venv/bin/python','-u',str(r/'runner.py')],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
print(json.dumps({{'id':{bid!r},'pid':p.pid,'status':'queued','jobs':len(plan['jobs'])}}))
'''
(out/'launch.py').write_text(launch)
print(json.dumps({'id':bid,'bytes':len(buf.getvalue()),'folder':str(out.resolve()),'jobs':len(jobs)}))
