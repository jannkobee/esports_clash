"""Render static field-comparison snapshots in Babylon, exclusively in Colab."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import os
from pathlib import Path
import sys
import threading
from playwright.sync_api import sync_playwright

root = Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
    raise RuntimeError('Google Colab required')
report = json.loads((root / 'pose-report.json').read_text())
if report['status'] != 'snapshots_exported':
    raise ValueError('Snapshots not ready')
for name, expected in report['plan']['files'].items():
    if hashlib.sha256((root/name).read_bytes()).hexdigest() != expected:
        raise ValueError('Input changed: '+name)
report.update(status='rendering', views=[], errors=[])
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root/'site')))
threading.Thread(target=server.serve_forever, daemon=True).start()
(root/'screenshots').mkdir()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width': 1000, 'height': 900})
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
        page.wait_for_selector('#base-inspection[data-ready="true"]', timeout=60000)
        for asset in report['assets']:
            if hashlib.sha256((root/asset['file']).read_bytes()).hexdigest() != asset['sha256']:
                raise ValueError('Snapshot changed')
            page.evaluate('''file=>{document.dispatchEvent(new Event('livewire:navigating'));document.querySelector('#base-inspection').dataset.asset='/'+file;document.dispatchEvent(new Event('livewire:navigated'));}''', asset['file'].removeprefix('site/'))
            page.wait_for_selector('#base-inspection[data-ready="true"]', timeout=60000)
            for orbit in report['plan']['orbits']:
                meta = page.evaluate('''async x=>{const i=document.querySelector('#base-inspection').inspection;
                    if(i.container.skeletons.length || i.container.animationGroups.length)throw Error('Snapshot unexpectedly rigged');
                    i.scene.getEngine().stopRenderLoop();i.camera.setTarget(i.camera.target.constructor.FromArray(x.target));
                    i.camera.lowerRadiusLimit=x.radius/10;i.camera.upperRadiusLimit=x.radius*10;i.camera.radius=x.radius;
                    i.camera.alpha=x.orbit*Math.PI/4;i.camera.beta=1.35;i.camera.minZ=x.radius/100;
                    i.camera.inertialAlphaOffset=0;i.camera.inertialBetaOffset=0;i.camera.inertialRadiusOffset=0;
                    i.scene.render();await i.scene.whenReadyAsync();i.scene.render();
                    return {right_handed:i.scene.useRightHandedSystem,camera:{alpha:i.camera.alpha,beta:i.camera.beta,radius:i.camera.radius,target:i.camera.target.asArray()}}}''',
                    {'target': asset['camera_target_gltf'], 'radius': report['body_height']*.42, 'orbit': orbit})
                if not meta['right_handed']:
                    raise ValueError('Inspector coordinate system changed')
                filename = f"screenshots/{asset['mode']}-{asset['joint']}-{asset['degrees']}-orbit{orbit}.png"
                page.locator('#base-inspection').screenshot(path=str(root/filename))
                report['views'].append({'file': filename, 'sha256': hashlib.sha256((root/filename).read_bytes()).hexdigest(),
                                        'mode': asset['mode'], 'joint': asset['joint'], 'degrees': asset['degrees'], 'orbit': orbit,
                                        'snapshot_sha256': asset['sha256'], **meta})
        if report['errors']:
            raise ValueError(str(report['errors']))
        report['status'] = 'rendered_for_review'
        browser.close()
except Exception as error:
    report.update(status='failed', error=f'{type(error).__name__}: {error}')
    raise
finally:
    server.shutdown()
    (root/'visual-report.json').write_text(json.dumps(report, indent=2))
