"""Render exact candidate bind poses and verified diagnostic clips in the packaged Babylon inspector."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import os
from pathlib import Path
import sys
import threading

from playwright.sync_api import sync_playwright
from candidate_visual_contract import validate_diagnostic_sources


def main(root):
    if not os.environ.get('COLAB_RELEASE_TAG') or not root.is_relative_to('/content/teamfight-preparation/reviews'):
        raise RuntimeError('Google Colab inspection environment required')
    plan = json.loads((root / 'plan.json').read_text())
    for name, expected in plan['files'].items():
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
            raise ValueError('Frozen viewer input mismatch: ' + name)
    exported = json.loads((root / 'bend-export-report.json').read_text())
    detail_only = plan.get('mode') == 'joint-details'
    validate_diagnostic_sources(root, plan, exported)
    mapping = json.loads((root / 'baseline-report.json').read_text())['bone_map']
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root / 'site')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    screenshots = root / 'screenshots'
    screenshots.mkdir(exist_ok=False)
    report = {'id': plan['id'], 'compute': 'google', 'publication_eligible': False,
        'qualification_complete': False, 'views': [], 'errors': [], 'plan': plan,
        'frame_capture': 'Explicit Babylon renders of paused poses; continuous render loop stopped during screenshot capture.'}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage',
                '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            page = browser.new_page(viewport={'width': 1000, 'height': 900})
            page.on('pageerror', lambda error: report['errors'].append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
            page.wait_for_selector('#base-inspection[data-ready="true"]', timeout=60000)
            def load(file, clips):
                page.evaluate('''file=>{document.dispatchEvent(new Event('livewire:navigating'));document.querySelector('#base-inspection').dataset.asset='/'+file;document.dispatchEvent(new Event('livewire:navigated'));}''', file)
                page.wait_for_selector('#base-inspection[data-ready="true"]', timeout=60000)
                names = json.loads(page.locator('#base-inspection').get_attribute('data-clips'))
                if len(names) != clips:
                    raise ValueError(f'Unexpected clip count: {file}: {names}')
                page.evaluate('''async()=>{const s=document.querySelector('#base-inspection').inspection.scene;
                    s.getEngine().stopRenderLoop();s.render();await s.whenReadyAsync();s.render();}''')
            def capture(label, kind, role, degrees, view, skeleton=False, detail=False):
                is_orbit = view.startswith('hiporbit-')
                page.locator(f'[data-base-view="{"front" if view == "oblique" or is_orbit else view}"]').click()
                if detail:
                    page.evaluate('''x=>{const i=document.querySelector('#base-inspection').inspection;
                        const joint=i.container.transformNodes.find(node=>node.name===x.bone);
                        if(!joint)throw new Error('Inspection joint missing: '+x.bone);
                        const alpha=i.camera.alpha,beta=i.camera.beta;
                        joint.computeWorldMatrix(true);i.camera.setTarget(joint.getAbsolutePosition());
                        i.camera.alpha=x.orbit===null?alpha+(x.view==='oblique'?(x.left?Math.PI/4:-Math.PI/4):0):x.orbit*Math.PI/4;
                        i.camera.beta=x.orbit===null?(x.view==='oblique'?Math.PI/2.15:beta):1.35;
                        i.camera.inertialAlphaOffset=0;i.camera.inertialBetaOffset=0;i.camera.inertialRadiusOffset=0;
                        i.camera.radius=Math.max(i.camera.lowerRadiusLimit,i.camera.radius*.3);
                        if(i.camera.minZ>i.camera.radius*.1)throw new Error('Near clipping plane prevents joint detail review');
                        i.scene.render();}''', {'bone': mapping[role], 'view': view, 'left': role.endswith('L'), 'orbit': int(view.split('-')[1]) if is_orbit else None})
                if skeleton:
                    page.locator('#base-skeleton').click()
                page.evaluate('''async()=>{const s=document.querySelector('#base-inspection').inspection.scene;
                    s.render();await s.whenReadyAsync();s.render();}''')
                morph_weights = page.evaluate('''()=>{const i=document.querySelector('#base-inspection').inspection;const values={};
                    for(const mesh of i.container.meshes){const m=mesh.morphTargetManager;if(!m)continue;
                        for(let n=0;n<m.numTargets;n++){const t=m.getTarget(n);if(t.name in values && Math.abs(values[t.name]-t.influence)>1e-6)throw new Error('Inconsistent morph instances');values[t.name]=t.influence;}}
                    return values;}''')
                expected_asset = next(asset for asset in exported['assets'] if asset['label'] == label)
                expected_pose = next((pose for pose in expected_asset['poses'] if pose['joint'] == role and pose['degrees'] == degrees), None)
                expected_morphs = expected_pose.get('morph_weights', {}) if expected_pose else {}
                if expected_morphs and (set(morph_weights) != set(expected_morphs)
                        or any(abs(morph_weights[name] - value) > 1e-5 for name, value in expected_morphs.items())):
                    raise ValueError('Babylon corrective morphs do not match the verified native clip')
                if kind == 'exact-bind' and any(abs(value) > 1e-6 for value in morph_weights.values()):
                    raise ValueError('Corrective base bind has nonzero morph influences')
                page.wait_for_timeout(180)
                name = f'{label}-{kind}-{role}-{degrees}-{view}' + ('-skeleton' if skeleton else '') + ('-detail' if detail else '') + '.png'
                page.locator('#base-inspection').screenshot(path=str(screenshots / name))
                report['views'].append({'file': 'screenshots/' + name, 'asset': label, 'kind': kind,
                    'joint': role, 'degrees': degrees, 'view': view, 'skeleton': skeleton, 'detail': detail,
                    'camera': page.evaluate('''()=>{const c=document.querySelector('#base-inspection').inspection.camera;return {alpha:c.alpha,beta:c.beta,radius:c.radius,minZ:c.minZ,target:c.target.asArray()}}'''),
                    'morph_weights': morph_weights,
                    'sha256': hashlib.sha256((screenshots / name).read_bytes()).hexdigest()})
                if skeleton:
                    page.locator('#base-skeleton').click()
            for label in ('parent', 'current'):
                if not detail_only:
                    load(label + '.glb', 0)
                    for view in ('front', 'side', 'back'):
                        capture(label, 'exact-bind', 'rest', 0, view)
                    capture(label, 'exact-bind', 'rest', 0, 'front', skeleton=True)
                load(label + '-stress.glb', 8)
                if plan.get('hip_camera_sweep'):
                    for role in ('ThighL', 'ThighR'):
                        page.evaluate('''x=>document.querySelector('#base-inspection').inspection.sample('Stress_'+x.role,.5)''', {'role': role})
                        for index in range(plan['hip_camera_sweep']['angles']):
                            capture(label, 'verified-bend', role, 90, f'hiporbit-{index}', detail=True)
                    continue
                for role in ('UpperArmL', 'UpperArmR', 'ThighL', 'ThighR'):
                    for degrees, phase in (((90, .5),) if detail_only else ((45, .25), (90, .5))):
                        page.evaluate('''x=>document.querySelector('#base-inspection').inspection.sample('Stress_'+x.role,x.phase)''', {'role': role, 'phase': phase})
                        for view in (plan.get('detail_views', ['front', 'side']) if detail_only else ['front', 'side']):
                            capture(label, 'verified-bend', role, degrees, view, detail=detail_only)
                            if not detail_only and degrees == 90 and plan.get('include_joint_details'):
                                capture(label, 'verified-bend', role, degrees, view, detail=True)
                    if not detail_only and role.startswith('UpperArm'):
                        capture(label, 'verified-bend', role, 90, 'back')
                    if not detail_only and plan.get('include_joint_details') and 'oblique' in plan.get('detail_views', []):
                        capture(label, 'verified-bend', role, 90, 'oblique', detail=True)
            if report['errors']:
                raise ValueError(str(report['errors']))
            browser.close()
            report['status'] = 'rendered_for_review'
    except Exception as error:
        report.update(status='failed', error=f'{type(error).__name__}: {error}')
        raise
    finally:
        server.shutdown()
        (root / 'visual-report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main(Path(sys.argv[1]).resolve())
