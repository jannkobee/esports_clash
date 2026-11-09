"""Package frozen backoffice artifact bytes for the Colab libigl trial; no local 3D processing."""
import argparse,hashlib,io,json,uuid,zipfile
from pathlib import Path

parser=argparse.ArgumentParser();parser.add_argument('--source-bundle',type=Path,required=True)
parser.add_argument('--stage',choices=['admission','proxy'],default='admission')
parser.add_argument('--proxy-mode',choices=['winding','solid-envelope'],default='winding')
parser.add_argument('--regularize-empty-cells',action='store_true')
parser.add_argument('--baseline-report',type=Path,required=True);parser.add_argument('--output-dir',type=Path,required=True)
args=parser.parse_args();repo=Path(__file__).resolve().parents[2];baseline=json.loads(args.baseline_report.read_text())
with zipfile.ZipFile(args.source_bundle) as z:
    files={'source.glb':z.read('source.glb'),'raw.glb':z.read('raw.glb')}
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(files['source.glb'])==baseline['source_sha256'] and sha(files['raw.glb'])==baseline['rig_sha256']
files['baseline-report.json']=args.baseline_report.read_bytes()
for name in ('bbw_solver.py','review_bbw_preflight.py','review_bbw_proxy.py','review_generated_rig.py','bone_mapping.py','mesh_validation.py','asset_pipeline/__init__.py','asset_pipeline/edge_deformation.py'):
    files['tools/'+name]=(repo/'infrastructure/avatar-evolution'/name).read_bytes()
rid=str(uuid.uuid4());out=args.output_dir/rid;out.mkdir(parents=True,exist_ok=False)
plan={'id':rid,'method':'libigl-volume-bbw-admission-v1' if args.stage=='admission' else 'libigl-voxel-volume-correspondence-v1','compute':'google','publication_eligible':False,
    'qualification_complete':False,'rig_attempt_id':baseline['rig_attempt_id'],'generation_id':baseline['source_generation_id'],
    'libigl_version':'2.6.3','files':{n:sha(b) for n,b in files.items()}}
if args.stage=='proxy':plan['proxy_mode']=args.proxy_mode
if args.regularize_empty_cells:plan['regularize_empty_cells']=True
files['plan.json']=json.dumps(plan,indent=2).encode();buf=io.BytesIO()
with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as z:
    for n,b in files.items():z.writestr(n,b)
(out/'input.zip').write_bytes(buf.getvalue());(out/'plan.json').write_bytes(files['plan.json'])
driver='review_bbw_preflight.py' if args.stage=='admission' else 'review_bbw_proxy.py'
launch=f'''import pathlib,zipfile,hashlib,json,subprocess,sys,os
assert os.environ.get('COLAB_RELEASE_TAG')
incoming=pathlib.Path('/content/bbw-input.zip');assert hashlib.sha256(incoming.read_bytes()).hexdigest()=={sha(buf.getvalue())!r}
r=pathlib.Path('/content/teamfight-preparation/reviews')/{rid!r};r.mkdir(parents=True,exist_ok=False)
with zipfile.ZipFile(incoming) as z:
 assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in z.namelist());z.extractall(r)
packages=pathlib.Path('/content/teamfight-bbw/packages');packages.mkdir(parents=True,exist_ok=True)
with (r/'install.log').open('w') as log:
 subprocess.run([sys.executable,'-m','uv','pip','install','--python','/content/teamfight-preparation/venv/bin/python','--target',str(packages),'--no-deps','libigl==2.6.3'],stdout=log,stderr=subprocess.STDOUT,check=True,timeout=180)
with (r/'run.log').open('w') as log:
 p=subprocess.Popen(['timeout','1200','/content/teamfight-preparation/venv/bin/python','-u',str(r/'tools'/{driver!r}),str(r)],stdout=log,stderr=subprocess.STDOUT,start_new_session=True,env={{**os.environ,'PYTHONPATH':str(packages),'OMP_NUM_THREADS':'2','OPENBLAS_NUM_THREADS':'2'}})
(r/'pid').write_text(str(p.pid));print(json.dumps({{'id':r.name,'pid':p.pid,'status':'started'}}))
'''
(out/'launch.py').write_text(launch);print(json.dumps({'id':rid,'folder':str(out.resolve())}))
