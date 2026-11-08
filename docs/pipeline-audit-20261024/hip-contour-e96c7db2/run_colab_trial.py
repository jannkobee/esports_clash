"""Colab contour run with automatic result packaging, including failures."""
import json,os,pathlib,subprocess,zipfile
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
state=pathlib.Path('/content/hip-current-state.json')
with zipfile.ZipFile('/content/hip-current-input.zip') as z:
 plan=json.loads(z.read('plan.json'));root=pathlib.Path('/content/teamfight-preparation/reviews')/plan['id'];root.mkdir(parents=True);z.extractall(root)
env=dict(os.environ,PLAYWRIGHT_BROWSERS_PATH='/content/teamfight-inspection/browsers');result=None
with (root/'run.log').open('w') as log:
 for stage,python,script in [('contour_sculpt','/content/teamfight-preparation/venv/bin/python','hip_contour_trial.py'),('rendering','/content/teamfight-inspection/venv/bin/python','render_joint_pose_contract.py')]:
  state.write_text(json.dumps({'stage':stage,'compute':'google','id':root.name}))
  result=subprocess.run([python,str(root/'tools'/script),str(root)],stdout=log,stderr=log,env=env)
  if result.returncode:break
(root/'state.json').write_text(json.dumps({'returncode':result.returncode}))
with zipfile.ZipFile('/content/hip-current-result.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in root.rglob('*'):
  rel=p.relative_to(root).as_posix()
  if p.is_file() and (rel in ['plan.json','pose-report.json','visual-report.json','hip-sculpt.npz','run.log','state.json'] or rel.startswith(('screenshots/','site/snapshots/'))):z.write(p,rel)
state.write_text(json.dumps({'stage':'complete','id':root.name,'returncode':result.returncode,'result':'/content/hip-current-result.zip'}))
