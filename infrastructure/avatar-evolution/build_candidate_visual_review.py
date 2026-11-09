"""Package an explicit API candidate fixture for Colab-only diagnostic animation/rendering.

This command bundles bytes and metadata locally; it performs no 3D asset processing.
"""
import argparse, hashlib, io, json, pathlib, re, uuid, zipfile
repo=pathlib.Path(__file__).resolve().parents[2];rid=str(uuid.uuid4())
parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=pathlib.Path,required=True)
parser.add_argument('--output-dir',type=pathlib.Path,required=True)
parser.add_argument('--inspector-dir',type=pathlib.Path,default=repo/'EsportsClash.Api/public/base-inspector')
parser.add_argument('--details',action='store_true')
parser.add_argument('--include-details',action='store_true');parser.add_argument('--previous-review-dir',type=pathlib.Path)
parser.add_argument('--detail-view',action='append',choices=['front','side','oblique'])
parser.add_argument('--parent-stress-file',type=pathlib.Path);parser.add_argument('--current-stress-file',type=pathlib.Path)
parser.add_argument('--hip-camera-sweep',action='store_true')
args=parser.parse_args()
out=args.output_dir/rid;out.mkdir(parents=True,exist_ok=False)
files={}
detail_only=args.details
bundle=args.inspector_dir
if not (bundle/'base-inspector.js').is_file():raise ValueError('Build or export the shipped inspector first')
for p in bundle.glob('*.js'):files['site/base-inspector/'+p.name]=p.read_bytes()
for label in ('parent','current'):
 files['site/'+label+'.glb']=(args.source_dir/(label+'.glb')).read_bytes()
 files[label+'-report.json']=(args.source_dir/(label+'-report.json')).read_bytes()
for name in ('backoffice-proof.json','baseline-report.json'):files[name]=(args.source_dir/name).read_bytes()
for label in ('parent','current'):
 stress=getattr(args,label+'_stress_file')
 if stress is not None:
  report=json.loads(files[label+'-report.json']);data=stress.read_bytes()
  if hashlib.sha256(data).hexdigest()!=report['corrective_stress_artifact']['sha256']:raise ValueError('Corrective stress bytes mismatch: '+label)
  files['prebaked/'+label+'-stress.glb']=data
if detail_only:
 if args.previous_review_dir is None:raise ValueError('Detail mode requires an explicit prior review folder')
 previous=args.previous_review_dir
 files['bend-export-report.json']=(previous/'bend-export-report.json').read_bytes()
 for label in ('parent','current'):files['site/'+label+'-stress.glb']=(previous/'site'/(label+'-stress.glb')).read_bytes()
proof=json.loads(files['backoffice-proof.json'])
for label in ('parent','current'):
 assert hashlib.sha256(files['site/'+label+'.glb']).hexdigest()==proof['candidates'][label]['artifact_sha256']
view=(repo/'EsportsClash.Api/resources/views/evolution/avatars/cloud-raw-rig-preview.blade.php').read_text(encoding='utf-8')
start=view.index('<section class="panel"><div id="base-inspection"');end=view.index('</section>',start)+len('</section>')
html=re.sub(r'data-asset="[^"]*"','data-asset="/current.glb"',view[start:end])
html='<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{background:#101722;color:#dce8ef;font:14px sans-serif}button,select,input{margin:5px;padding:6px}.actions{display:flex;flex-wrap:wrap;align-items:center}</style></head><body>'+html+'<script type="module" src="/base-inspector/base-inspector.js"></script></body></html>'
files['site/index.html']=html.encode()
for name in ('export_candidate_inspection_bends.py','candidate_animation.py','glb_morph_animation.py','render_candidate_comparison_colab.py','candidate_visual_contract.py','review_generated_rig.py','mesh_validation.py','bone_mapping.py','asset_pipeline/__init__.py','asset_pipeline/edge_deformation.py'):
 files['tools/'+name]=(repo/'infrastructure/avatar-evolution'/name).read_bytes()
supervisor='''import fcntl,hashlib,json,os,pathlib,subprocess,time
r=pathlib.Path(__file__).parent
state={'id':r.name,'compute':'google','publication_eligible':False,'qualification_complete':False,'status':'queued'}
def save():
 p=r/'state.tmp.json';p.write_text(json.dumps(state,indent=2));p.replace(r/'state.json')
save()
assert os.environ.get('COLAB_RELEASE_TAG')
lease=pathlib.Path('/content/esports-trellis2/gpu-lease/inference.lock');lease.parent.mkdir(parents=True,exist_ok=True)
with lease.open('a+') as lock:
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:state.update(status='waiting_resources');save();raise SystemExit()
 try:
  installed=json.loads(pathlib.Path('/content/teamfight-preparation/installation.json').read_text())
  assert installed['status']=='installed_unqualified' and installed['profile']=='t4-fp32'
  inspector=pathlib.Path('/content/teamfight-inspection/installation.json')
  browser_install=json.loads(inspector.read_text())
  assert browser_install['status']=='installed' and browser_install['playwright']=='1.55.0'
  assert pathlib.Path('/content/teamfight-inspection/venv/bin/python').is_file()
  state['inspector_installation_sha256']=hashlib.sha256(inspector.read_bytes()).hexdigest()
  state.update(status='running',runtime_id=installed['runtime_id'],environment_sha256=installed['environment_sha256'],started_unix=time.time());save()
  stages=[('diagnostic-export','/content/teamfight-preparation/venv/bin/python','export_candidate_inspection_bends.py'),('babylon-render','/content/teamfight-inspection/venv/bin/python','render_candidate_comparison_colab.py')]
  if json.loads((r/'plan.json').read_text()).get('mode')=='joint-details':stages=stages[1:]
  for stage,python,script in stages:
   state['stage']=stage;save()
   with (r/(stage+'.log')).open('ab') as log:
    process=subprocess.run([python,'-u',str(r/'tools'/script),str(r)],stdout=log,stderr=subprocess.STDOUT,timeout=1200,env={**os.environ,'PLAYWRIGHT_BROWSERS_PATH':'/content/teamfight-inspection/browsers'})
   state['exit_code']=process.returncode;save()
   if process.returncode:raise RuntimeError(stage+' exited '+str(process.returncode))
  report=r/'visual-report.json';data=json.loads(report.read_text())
  if data['status']!='rendered_for_review':raise RuntimeError('Visual render incomplete')
  state.update(status='completed',report_sha256=hashlib.sha256(report.read_bytes()).hexdigest())
 except Exception as error:state.update(status='failed',error=f'{type(error).__name__}: {error}')
 finally:state['completed_unix']=time.time();save()
'''
files['supervisor.py']=supervisor.encode()
plan={'id':rid,'compute':'google','publication_eligible':False,'qualification_complete':False,'mode':'joint-details' if detail_only else 'full-body','method':'exact-api-candidates-babylon-visual-comparison-v1','preparation_id':proof['preparation_id'],'candidates':proof['candidates'],'files':{n:hashlib.sha256(b).hexdigest() for n,b in files.items()}}
plan['include_joint_details']=args.include_details
if args.hip_camera_sweep:
 if detail_only:raise ValueError('Hip camera sweep requires a full independent review')
 plan['hip_camera_sweep']={'angles':8,'beta_radians':1.35,'radius_factor':0.30,'target':'animated hip joint','geometry_hidden':False}
plan['detail_views']=args.detail_view or ['front','side']
plan['comparison_roles']={'parent':'immutable visual reference; not a rewritten asset-lineage parent','current':'candidate under visual review'}
if detail_only:plan['parent_visual_review_id']=json.loads((previous/'visual-report.json').read_text())['id']
files['plan.json']=json.dumps(plan,indent=2).encode()
buf=io.BytesIO()
with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as z:
 for name,b in files.items():z.writestr(name,b)
(out/'input.zip').write_bytes(buf.getvalue());(out/'plan.json').write_bytes(files['plan.json'])
launch=f'''import hashlib,json,os,pathlib,shutil,subprocess,zipfile
assert os.environ.get('COLAB_RELEASE_TAG')
rid={rid!r};root=pathlib.Path('/content/teamfight-preparation');incoming=root/('incoming-'+rid+'.zip');review=root/'reviews'/rid
assert hashlib.sha256(incoming.read_bytes()).hexdigest()=={hashlib.sha256(buf.getvalue()).hexdigest()!r}
review.mkdir(parents=True,exist_ok=False);shutil.copy2(incoming,review/'input.zip')
with zipfile.ZipFile(incoming) as z:
 assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in z.namelist())
 z.extractall(review)
plan=json.loads((review/'plan.json').read_text());assert plan['id']==rid
for n,h in plan['files'].items():assert hashlib.sha256((review/n).read_bytes()).hexdigest()==h,n
with (review/'supervisor.log').open('ab') as log:
 p=subprocess.Popen(['/content/teamfight-preparation/venv/bin/python','-u',str(review/'supervisor.py')],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
print(json.dumps({{'id':rid,'pid':p.pid,'status':'queued'}}))
'''
(out/'launch.py').write_text(launch)
print(json.dumps({'id':rid,'bytes':len(buf.getvalue()),'folder':str(out.resolve())}))
