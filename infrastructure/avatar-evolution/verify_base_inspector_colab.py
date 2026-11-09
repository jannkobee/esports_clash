"""Browser playback checks only; never qualifies or changes the source avatar."""
import functools
import hashlib
import json
import os
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import sys
import threading
import time

from playwright.sync_api import sync_playwright


def main():
    root = Path(sys.argv[1]).resolve()
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-inspection/reviews'):
        raise RuntimeError('Run this review in the isolated Google Colab inspection environment.')
    plan = json.loads((root / 'plan.json').read_text())
    for name, expected in plan['files'].items():
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError('Frozen review input mismatch: ' + name)
    report = {'compute': 'google', 'scope': 'Packaged Babylon inspector playback',
              'publication_eligible': False, 'plan': plan, 'checks': [], 'page_errors': [],
              'started_unix': time.time(), 'status': 'running'}
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(root / 'site'))
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=[
                '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            page = browser.new_page(viewport={'width': 1100, 'height': 850})
            page.on('pageerror', lambda error: report['page_errors'].append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
            page.wait_for_selector('#base-inspection[data-ready="true"]', timeout=60000)
            initial = page.evaluate('''() => {
                const {container}=document.querySelector('#base-inspection').inspection;
                return {bones:container.skeletons.reduce((n,s)=>n+s.bones.length,0),clips:container.animationGroups.map(g=>g.name)};
            }''')
            assert initial['bones'] == 48 and len(initial['clips']) == 10, initial
            report['asset'] = initial
            report['checks'].append('Exact failed source loads: 48 bones and 10 clips')
            for name in initial['clips']:
                result = page.evaluate('''name => {
                    const h=document.querySelector('#base-inspection'); h.inspection.sample(name,.42);
                    const {container}=h.inspection;
                    const g=container.animationGroups.find(g=>g.name===name);
                    return {frame:g.getCurrentFrame(),expected:g.from+.42*(g.to-g.from),finite:container.meshes.every(m=>Array.from(m.getWorldMatrix().m).every(Number.isFinite))};
                }''', name)
                assert result['finite'] and abs(result['frame'] - result['expected']) < .05, (name, result)
            report['checks'].append('All ten clips seek to phase 0.42 with finite mesh transforms')
            page.select_option('#base-clip', 'Idle')
            page.fill('#base-time', '0.8')
            scrub = page.evaluate('''() => {
                const g=document.querySelector('#base-inspection').inspection.container.animationGroups.find(g=>g.name==='Idle');
                return {actual:g.getCurrentFrame(),expected:g.from+.8*g.targetedAnimations[0].animation.framePerSecond};
            }''')
            assert abs(scrub['actual'] - scrub['expected']) < .06, scrub
            report['checks'].append('Exact time scrubbing updates the exported clip frame')
            page.select_option('#base-clip', '')
            assert page.locator('#base-time').input_value() == '0.000'
            page.locator('[data-base-view="front"]').click()
            page.screenshot(path=str(root / 'bind-front.png'))
            for view in ('side', 'back', 'fit'):
                page.locator(f'[data-base-view="{view}"]').click()
            page.locator('#base-skeleton').click()
            page.locator('#base-wireframe').click()
            assert page.locator('#base-skeleton').get_attribute('aria-pressed') == 'true'
            assert page.evaluate("document.querySelector('#base-inspection').inspection.container.materials.every(m=>m.wireframe)")
            page.locator('#base-skeleton').click()
            page.locator('#base-wireframe').click()
            report['checks'].append('Bind pose, camera presets, skeleton and wireframe controls respond')
            page.select_option('#base-clip', 'Run')
            page.locator('#base-play').click()
            page.wait_for_timeout(500)
            assert float(page.locator('#base-phase').input_value()) > 0
            page.locator('#base-play').click()
            held = page.locator('#base-phase').input_value()
            page.wait_for_timeout(200)
            assert page.locator('#base-phase').input_value() == held
            page.screenshot(path=str(root / 'run-paused.png'))
            report['checks'].append('Playback advances and pause holds the sampled frame')
            page.select_option('#base-clip', 'Death')
            page.select_option('#base-speed', '4')
            page.locator('#base-play').click()
            page.wait_for_function("document.querySelector('#base-phase').value==='1'", timeout=15000)
            assert page.locator('#base-play').inner_text() == 'Play'
            page.wait_for_timeout(200)
            assert page.locator('#base-phase').input_value() == '1'
            report['checks'].append('Death holds its terminal exported frame')
            page.evaluate('''() => {
                window.oldScene=document.querySelector('#base-inspection').inspection.scene;
                document.dispatchEvent(new Event('livewire:navigating'));
                if(!window.oldScene.isDisposed)throw Error('Old scene was not disposed');
                document.dispatchEvent(new Event('livewire:navigated'));
            }''')
            page.wait_for_selector('#base-inspection[data-ready="true"]', timeout=60000)
            assert page.locator('#base-clip option').count() == 11
            assert page.locator('#base-inspection canvas').count() == 1
            assert not report['page_errors'], report['page_errors']
            report['checks'].append('Livewire navigation disposes and recreates one inspector without duplicate clips')
            browser.close()
        report['status'] = 'passed'
    except Exception as error:
        report.update(status='failed', error=str(error))
        raise
    finally:
        server.shutdown()
        report['completed_unix'] = time.time()
        (root / 'report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
