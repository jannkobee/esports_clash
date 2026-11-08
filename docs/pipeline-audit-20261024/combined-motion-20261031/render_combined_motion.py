"""Colab Babylon views of evaluated combined-motion diagnostic snapshots."""
import os,sys,json,threading,hashlib
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG'):raise RuntimeError('Colab required')
r=json.loads((root/'combined-motion-report.json').read_text())
if r['status']!='requires_visual_review':raise ValueError('Motion sampling failed')
html=(root/'site/index.html').read_text().replace('/snapshots/baseline-ThighL-22.5.glb','/'+r['poses'][0]['snapshot']);(root/'site/combined.html').write_text(html)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root/'site')));threading.Thread(target=server.serve_forever,daemon=True).start()
out=root/'combined-screenshots';out.mkdir(exist_ok=True);report={'compute':'google','source_sha256':r['source_sha256'],'publication_eligible':False,'qualification_complete':False,'views':[],'errors':[]}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1100,'height':900})
  page.on('pageerror',lambda e:report['errors'].append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/combined.html');page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
  for pose in r['poses']:
   page.evaluate("""file=>{document.dispatchEvent(new Event('livewire:navigating'));document.querySelector('#base-inspection').dataset.asset='/'+file;document.dispatchEvent(new Event('livewire:navigated'));}""",pose['snapshot']);page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
   for view in ('front','side'):
    page.locator(f'[data-base-view="{view}"]').click();page.evaluate("""async()=>{const i=document.querySelector('#base-inspection').inspection;i.scene.getEngine().stopRenderLoop();i.scene.render();await i.scene.whenReadyAsync();i.scene.render();}""")
    file=out/(pose['case']+'-'+view+'.png');page.locator('#base-inspection').screenshot(path=str(file));report['views'].append({'case':pose['case'],'view':view,'file':str(file.relative_to(root)),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
  if report['errors']:raise ValueError('Babylon errors')
  report['status']='rendered_for_review';b.close()
except Exception as e:report.update(status='failed',error=str(e));raise
finally:server.shutdown();(root/'combined-visual-report.json').write_text(json.dumps(report,indent=2))
