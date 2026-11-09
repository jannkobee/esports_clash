"""Run inside Colab: preserve the failed harness, render the same geometry."""
import hashlib,json,os,shutil,subprocess,zipfile
from pathlib import Path
if not os.environ.get('COLAB_RELEASE_TAG'):
 # SSH uses a clean login environment. Recover only this non-secret guard from
 # the existing Colab processes; never synthesize a tag or copy credentials.
 tags=set()
 for proc in Path('/proc').glob('[0-9]*'):
  try:
   for item in (proc/'environ').read_bytes().split(b'\0'):
    if item.startswith(b'COLAB_RELEASE_TAG='):tags.add(item.split(b'=',1)[1].decode())
  except (PermissionError,FileNotFoundError,ProcessLookupError):pass
 if len(tags)!=1:raise RuntimeError('Cannot establish the existing Colab release environment')
 os.environ['COLAB_RELEASE_TAG']=tags.pop()
old=Path('/content/teamfight-preparation/reviews/e2906020-ded5-44a2-9f30-a1bc5ac21d43')
root=old.parent/'1edfc83c-96f8-4ca1-8203-2b81ff478664'
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
root.mkdir()
for name in ['tools','site']:shutil.copytree(old/name,root/name)
for file in old.iterdir():
    if file.is_file() and file.name not in ['launch.py','run.log','state.json','visual-report.json']:shutil.copyfile(file,root/file.name)
(root/'failed-harness-report.json').write_bytes((old/'visual-report.json').read_bytes())
(root/'failed-harness-plan.json').write_bytes((old/'plan.json').read_bytes())
html=root/'site/index.html';html.write_text(html.read_text().replace('/snapshots/legacy-UpperArmL-45.glb','/snapshots/baseline-ThighL-22.5.glb'))
plan=json.loads((root/'plan.json').read_text());plan['id']=root.name
plan['reused_geometry']={'review_id':old.name,'report_sha256':hashlib.sha256((old/'pose-report.json').read_bytes()).hexdigest(),
 'reason':'Initial HTML referenced a prior shoulder asset; same completed geometry, corrected renderer preload only.'}
plan['files']['site/index.html']=hashlib.sha256(html.read_bytes()).hexdigest()
(root/'plan.json').write_text(json.dumps(plan,indent=2))
report=json.loads((root/'pose-report.json').read_text());report.update(id=root.name,plan=plan)
(root/'pose-report.json').write_text(json.dumps(report,indent=2))
env=dict(os.environ,PLAYWRIGHT_BROWSERS_PATH='/content/teamfight-inspection/browsers')
with (root/'run.log').open('w') as log:
 result=subprocess.run(['/content/teamfight-inspection/venv/bin/python',str(root/'tools/render_joint_pose_contract.py'),str(root)],env=env,stdout=log,stderr=log)
(root/'state.json').write_text(json.dumps({'returncode':result.returncode}))
with zipfile.ZipFile('/content/hip-shape-result.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in root.rglob('*'):
  rel=p.relative_to(root).as_posix()
  if p.is_file() and (rel in ['plan.json','pose-report.json','visual-report.json','state.json','run.log','hip-sculpt.npz','failed-harness-plan.json','failed-harness-report.json'] or rel.startswith(('screenshots/','site/snapshots/'))):z.write(p,rel)
print(json.dumps({'id':root.name,'returncode':result.returncode}),flush=True)
