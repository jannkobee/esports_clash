"""Actual Babylon diagnostic playback in Colab's pinned browser."""
import os,sys,json,shutil,hashlib,threading
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
export=json.loads((root/'animation-export-report.json').read_text())
if export['status']!='ready_for_babylon_review':raise ValueError('Export not validated')
asset=root/'current-hip-animation.glb'
if hashlib.sha256(asset.read_bytes()).hexdigest()!=export['sha256']:raise ValueError('Changed GLB')
shutil.copyfile(asset,root/'site/current-hip-animation.glb')
html=(root/'site/index.html').read_text().replace('/snapshots/baseline-ThighL-22.5.glb','/current-hip-animation.glb')
(root/'site/animation.html').write_text(html)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root/'site')))
threading.Thread(target=server.serve_forever,daemon=True).start();out=root/'animation-screenshots';out.mkdir(exist_ok=True)
r={'compute':'google','asset_sha256':export['sha256'],'publication_eligible':False,'qualification_complete':False,'errors':[],'samples':[]}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':1100,'height':900});page.on('pageerror',lambda e:r['errors'].append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/animation.html');page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
  r['loaded']=page.evaluate("""()=>{const i=document.querySelector('#base-inspection').inspection;return {clips:i.container.animationGroups.map(a=>a.name),meshes:i.container.meshes.filter(m=>m.skeleton).map(m=>({name:m.name,influences:m.numBoneInfluencers,bones:m.skeleton.bones.length,extraWeights:!!m.getVerticesData('matricesWeightsExtra'),morphs:m.morphTargetManager?.numTargets}))}}""")
  if not r['loaded']['clips'] or not r['loaded']['meshes'] or any(m['influences']!=8 or not m['extraWeights'] or m['morphs']!=2 for m in r['loaded']['meshes']):raise ValueError('Missing eight-influence skin or corrective targets')
  clip=r['loaded']['clips'][0]
  for phase in (0,.125,.25,.375,.5,.625,.75,.875,1):
   for view in ('front','side'):
    page.locator(f'[data-base-view="{view}"]').click()
    row=page.evaluate("""x=>{const i=document.querySelector('#base-inspection').inspection;i.sample(x.clip,x.phase);i.scene.getEngine().stopRenderLoop();i.scene.render();return {phase:x.phase,morphs:i.container.meshes.filter(m=>m.morphTargetManager).map(m=>Array.from({length:m.morphTargetManager.numTargets},(_,j)=>m.morphTargetManager.getTarget(j).influence))}}""",{'clip':clip,'phase':phase})
    file=out/f'phase-{phase}-{view}.png';page.locator('#base-inspection').screenshot(path=str(file));row.update(view=view,file=str(file.relative_to(root)),sha256=hashlib.sha256(file.read_bytes()).hexdigest());r['samples'].append(row)
  r['playback']=page.evaluate("""async clip=>{const i=document.querySelector('#base-inspection').inspection;const a=i.container.animationGroups.find(a=>a.name===clip);a.stop();a.start(true);a.goToFrame(a.from);a.restart();const engine=i.scene.getEngine();engine.runRenderLoop(()=>i.scene.render());await new Promise(r=>setTimeout(r,1200));const frame=a.animatables[0]?.masterFrame;a.pause();engine.stopRenderLoop();return {from:a.from,to:a.to,frame,advanced:frame>a.from};}""",clip)
  if not r['playback']['advanced'] or r['errors']:raise ValueError('Playback failed')
  r['status']='rendered_for_visual_review';browser.close()
except Exception as e:r.update(status='failed',error=str(e));raise
finally:server.shutdown();(root/'babylon-animation-report.json').write_text(json.dumps(r,indent=2))
