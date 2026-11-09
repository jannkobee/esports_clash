"""Colab Babylon contact-overlay views; original topology stays visible."""
import os,sys,json,threading,hashlib,math
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
root=Path(sys.argv[1]);assert os.environ.get('COLAB_RELEASE_TAG')
r=json.loads((root/'handle-inspection.json').read_text());target=r['bones']['UpperArmL']['head'];target=[target[0],target[2],-target[1]]
html=(root/'site/index.html').read_text().replace('/snapshots/baseline-ThighL-22.5.glb','/handles/left-60-contact.glb');(root/'site/handles.html').write_text(html)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root/'site')));threading.Thread(target=server.serve_forever,daemon=True).start()
out=root/'handle-screenshots';out.mkdir(exist_ok=True);report={'compute':'google','views':[],'errors':[]}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=browser.new_page(viewport={'width':1100,'height':900})
  page.on('pageerror',lambda e:report['errors'].append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/handles.html');page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
  for angle in (60,90):
   page.evaluate("""file=>{document.dispatchEvent(new Event('livewire:navigating'));document.querySelector('#base-inspection').dataset.asset='/'+file;document.dispatchEvent(new Event('livewire:navigated'));}""",f'handles/left-{angle}-contact.glb');page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
   for view,alpha in [('front',math.pi/2),('side',math.pi),('oblique',math.pi*3/4),('inner',math.pi/4),('back',-math.pi/2)]:
    camera=page.evaluate("""x=>{const i=document.querySelector('#base-inspection').inspection;const c=i.camera;c.target.set(...x.target);c.radius=x.radius;c.alpha=x.alpha;c.beta=Math.PI/2;c.minZ=.0001;i.scene.getEngine().stopRenderLoop();i.scene.render();return {target:c.target.asArray(),radius:c.radius,alpha:c.alpha,beta:c.beta}}""",{'target':target,'radius':r['body_height']*.25,'alpha':alpha})
    path=out/f'left-{angle}-{view}.png';page.locator('#base-inspection').screenshot(path=str(path));report['views'].append({'file':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'camera':camera})
  browser.close()
finally:server.shutdown();(root/'handle-render.json').write_text(json.dumps(report,indent=2))
