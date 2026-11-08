"""Colab close-up Babylon before/after views and exact GLB playback."""
import os,sys,json,threading,hashlib,shutil,math
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
r=json.loads((root/'repair-report.json').read_text());out=root/'repair-screenshots';out.mkdir(exist_ok=True)
html=(root/'site/index.html').read_text().replace('/snapshots/baseline-ThighL-22.5.glb','/'+r['poses'][0]['baseline']['snapshot']);(root/'site/repair.html').write_text(html)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root/'site')));threading.Thread(target=server.serve_forever,daemon=True).start()
report={'compute':'google','source_sha256':r['source_sha256'],'publication_eligible':False,'qualification_complete':False,'views':[],'playback_samples':[],'errors':[]}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=browser.new_page(viewport={'width':1100,'height':900})
  page.on('pageerror',lambda e:report['errors'].append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/repair.html');page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
  def asset(file):
   page.evaluate("""file=>{document.dispatchEvent(new Event('livewire:navigating'));document.querySelector('#base-inspection').dataset.asset='/'+file;document.dispatchEvent(new Event('livewire:navigated'));}""",file);page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
  def capture(case,mode,target,view,phase=None):
   camera=page.evaluate("""x=>{const i=document.querySelector('#base-inspection').inspection;const c=i.camera;
    if(x.phase!==null)i.sample('Mirelle_ContourTrial',x.phase);
    const target=c.target.clone();target.set(...x.target);c.setTarget(target);c.radius=x.radius;c.alpha=x.alpha;c.beta=Math.PI/2;c.minZ=.0001;
    i.scene.getEngine().stopRenderLoop();i.scene.render();return {target:x.target,radius:c.radius,alpha:c.alpha,beta:c.beta,minZ:c.minZ,
      morphs:i.container.meshes.filter(m=>m.morphTargetManager).map(m=>Array.from({length:m.morphTargetManager.numTargets},(_,j)=>({name:m.morphTargetManager.getTarget(j).name,value:m.morphTargetManager.getTarget(j).influence})))}}""",
     {'phase':phase,'target':target,'radius':r['body_height']*(1.2 if 'Rest' in case else .34),'alpha':{'front':-math.pi/2,'side':0,'oblique':-math.pi/4,'back':math.pi/2}[view]})
   path=out/(case+'-'+mode+'-'+view+'.png');page.locator('#base-inspection').screenshot(path=str(path));return {'case':case,'mode':mode,'view':view,'file':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'camera':camera}
  # Every combined pose plus isolated baselines; no geometry hidden for closeups.
  for pose in r['poses']:
   for mode in ('baseline','candidate'):
    asset(pose[mode]['snapshot'])
    for view in ('front','side','oblique'):
     report['views'].append(capture(pose['case'],mode,pose['camera_target_gltf'],view))
   (root/'repair-render-progress.json').write_text(json.dumps({'completed':len(report['views']),'total':len(r['poses'])*6}))
  ex=root/'export-report.json'
  if ex.exists() and json.loads(ex.read_text()).get('status')=='ready_for_babylon_review':
   export=json.loads(ex.read_text());shutil.copyfile(root/'contour-diagnostic.glb',root/'site/contour-diagnostic.glb');asset('contour-diagnostic.glb')
   report['loaded']=page.evaluate("""()=>{const i=document.querySelector('#base-inspection').inspection;return {clips:i.container.animationGroups.map(a=>a.name),meshes:i.container.meshes.filter(m=>m.skeleton).map(m=>({influences:m.numBoneInfluencers,bones:m.skeleton.bones.length,extraWeights:!!m.getVerticesData('matricesWeightsExtra'),morphs:m.morphTargetManager?.numTargets}))}}""")
   if any(m['influences']!=8 or m['bones']!=52 or m['morphs']!=7 or not m['extraWeights'] for m in report['loaded']['meshes']) or not report['loaded']['meshes']:raise ValueError('Skin/morph load failed')
   for sample in export['samples']:
    row=capture(sample['case'],'playback',sample['camera_target_gltf'],'oblique',sample['phase'])
    got={m['name']:m['value'] for m in row['camera']['morphs'][0]}
    if max(abs(got[k]-v) for k,v in sample['morphs'].items())>1e-5:raise ValueError('Morph animation mismatch')
    report['playback_samples'].append(row)
   report['playback']=page.evaluate("""async()=>{const i=document.querySelector('#base-inspection').inspection;const a=i.container.animationGroups[0];a.stop();a.start(true);a.goToFrame(a.from);a.restart();const e=i.scene.getEngine();e.runRenderLoop(()=>i.scene.render());await new Promise(r=>setTimeout(r,1200));const frame=a.animatables[0]?.masterFrame;a.pause();e.stopRenderLoop();return {from:a.from,to:a.to,frame,advanced:frame>a.from}}""")
   if not report['playback']['advanced']:raise ValueError('Playback did not advance')
  if report['errors']:raise ValueError('Browser errors')
  report['status']='rendered_for_review';browser.close()
except Exception as e:report.update(status='failed',error=str(e));raise
finally:server.shutdown();(root/'repair-visual-report.json').write_text(json.dumps(report,indent=2))
