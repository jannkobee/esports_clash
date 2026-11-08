"""Minimal pinned Colab restoration, trial execution and durable retrieval bundle."""
import json,os,pathlib,subprocess,sys,zipfile,time
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
root=None;state=pathlib.Path('/content/hip-current-state.json')
def update(stage,**extra):state.write_text(json.dumps({'stage':stage,'compute':'google',**extra}))
def run(args,stage,timeout=600):
 update(stage);subprocess.run(args,check=True,timeout=timeout)
try:
 run([sys.executable,'-m','pip','install','uv==0.9.5'],'installing_uv')
 run([sys.executable,'-m','uv','venv','--python','3.11','/content/teamfight-preparation/venv'],'creating_blender_environment')
 py='/content/teamfight-preparation/venv/bin/python'
 run([sys.executable,'-m','uv','pip','install','--python',py,'numpy==1.26.4','scipy==1.15.2','bpy==4.5.3'],'installing_blender')
 run([sys.executable,'-m','uv','venv','--python','3.12','/content/teamfight-inspection/venv'],'creating_browser_environment')
 browser='/content/teamfight-inspection/venv/bin/python'
 run([sys.executable,'-m','uv','pip','install','--python',browser,'playwright==1.55.0'],'installing_playwright')
 os.environ['PLAYWRIGHT_BROWSERS_PATH']='/content/teamfight-inspection/browsers'
 run([browser,'-m','playwright','install','--with-deps','chromium'],'installing_chromium')
 with zipfile.ZipFile('/content/hip-current-input.zip') as z:
  plan=json.loads(z.read('plan.json'));root=pathlib.Path('/content/teamfight-preparation/reviews')/plan['id'];root.mkdir(parents=True);z.extractall(root)
 run([py,str(root/'tools/hip_shape_trial.py'),str(root)],'sculpting')
 run([browser,str(root/'tools/render_joint_pose_contract.py'),str(root)],'rendering')
 update('packaging',id=root.name)
 with zipfile.ZipFile('/content/hip-current-result.zip','w',zipfile.ZIP_DEFLATED) as z:
  for p in root.rglob('*'):
   rel=p.relative_to(root).as_posix()
   if p.is_file() and (rel in ['plan.json','pose-report.json','visual-report.json','hip-sculpt.npz'] or rel.startswith(('screenshots/','site/snapshots/'))):z.write(p,rel)
 update('complete',id=root.name,result='/content/hip-current-result.zip')
except Exception as error:
 update('failed',error=str(error),root=str(root));raise
