"""Render generated-source and controlled raw-rig bends with the shipped Babylon inspector."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import hashlib,json,os
from pathlib import Path
import sys,threading
from playwright.sync_api import sync_playwright


def main():
    root=Path(sys.argv[1]).resolve()
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-inspection/reviews'):
        raise RuntimeError('Google Colab inspection environment required')
    plan=json.loads((root/'plan.json').read_text())
    for name,expected in plan['files'].items():
        if hashlib.sha256((root/name).read_bytes()).hexdigest()!=expected:raise RuntimeError('Frozen viewer input mismatch: '+name)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root/'site')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    report={'compute':'google','publication_eligible':False,'plan':plan,'views':[],'errors':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
            page=browser.new_page(viewport={'width':1000,'height':820})
            page.on('pageerror',lambda error:report['errors'].append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
            page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
            for file in ('source.glb','stress.glb'):
                page.evaluate('''file=>{document.dispatchEvent(new Event('livewire:navigating'));document.querySelector('#base-inspection').dataset.asset='/'+file;document.dispatchEvent(new Event('livewire:navigated'));}''',file)
                page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
                clips=json.loads(page.locator('#base-inspection').get_attribute('data-clips'))
                expected=0 if file=='source.glb' else 8
                assert len(clips)==expected,(file,clips)
                cases=[''] if file=='source.glb' else ['', 'Stress_UpperArmL','Stress_ForearmL','Stress_ThighL','Stress_CalfL']
                for clip in cases:
                    page.evaluate("clip=>document.querySelector('#base-inspection').inspection.sample(clip,.5)",clip)
                    for view in ('front','side'):
                        page.locator(f'[data-base-view="{view}"]').click()
                        page.wait_for_timeout(150)
                        name=file.removesuffix('.glb')+'-'+(clip or 'rest')+'-'+view+'.png'
                        page.screenshot(path=str(root/name))
                        report['views'].append({'file':name,'source':file,'clip':clip,'phase':.5 if clip else 0,'view':view,
                            'sha256':hashlib.sha256((root/name).read_bytes()).hexdigest()})
            assert not report['errors'],report['errors']
            browser.close();report['status']='rendered_for_review'
    except Exception as error:report.update(status='failed',error=str(error));raise
    finally:
        server.shutdown();(root/'report.json').write_text(json.dumps(report,indent=2))


if __name__=='__main__':main()
