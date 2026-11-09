"""Colab Playwright Babylon multi-view rendering and playback verification for 10 combat clips."""
import os, sys, json, threading, hashlib, shutil, math
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

if not os.environ.get('COLAB_RELEASE_TAG'):
    raise RuntimeError('Colab required')

os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/content/teamfight-inspection/browsers'
from playwright.sync_api import sync_playwright

stage_dir = Path(sys.argv[1]).resolve()
v14_root = Path('/content/teamfight-preparation/reviews/5f2cfdb2-73eb-40c4-87af-2fac5fa43fa4')

export_report = json.loads((stage_dir / 'combat-clips-export-report.json').read_text())
glb_path = stage_dir / 'mirelle-combat-clips.glb'
glb_sha = hashlib.sha256(glb_path.read_bytes()).hexdigest()

site_dir = stage_dir / 'site'
if site_dir.exists():
    shutil.rmtree(site_dir)
shutil.copytree(v14_root / 'site', site_dir)

# Copy combat glb into site
shutil.copyfile(glb_path, site_dir / 'mirelle-combat-clips.glb')

# Create combat.html
html = (site_dir / 'index.html').read_text().replace('/snapshots/baseline-ThighL-22.5.glb', '/mirelle-combat-clips.glb')
(site_dir / 'combat.html').write_text(html)

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(site_dir)))
threading.Thread(target=server.serve_forever, daemon=True).start()

out_shots = stage_dir / 'combat-screenshots'
out_shots.mkdir(exist_ok=True)

report = {
    'compute': 'google',
    'asset_sha256': glb_sha,
    'publication_eligible': False,
    'qualification_complete': False,
    'loaded_clips': [],
    'playback': {},
    'samples': [],
    'errors': []
}

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        )
        page = browser.new_page(viewport={'width': 1100, 'height': 900})
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        
        page.goto(f'http://127.0.0.1:{server.server_port}/combat.html')
        page.wait_for_selector('#base-inspection[data-ready="true"]', timeout=60000)

        report['loaded'] = page.evaluate("""()=>{
            const i = document.querySelector('#base-inspection').inspection;
            return {
                clips: i.container.animationGroups.map(a => a.name),
                meshes: i.container.meshes.filter(m => m.skeleton).map(m => ({
                    name: m.name,
                    influences: m.numBoneInfluencers,
                    bones: m.skeleton.bones.length,
                    extraWeights: !!m.getVerticesData('matricesWeightsExtra'),
                    morphs: m.morphTargetManager?.numTargets
                }))
            };
        }""")
        report['loaded_clips'] = report['loaded']['clips']
        print('LOADED_CLIPS_IN_BABYLON=', report['loaded_clips'])

        # Verify active playback on Idle
        report['playback'] = page.evaluate("""async () => {
            const i = document.querySelector('#base-inspection').inspection;
            const a = i.container.animationGroups.find(g => g.name === 'Idle') || i.container.animationGroups[0];
            a.stop();
            a.start(true);
            a.goToFrame(a.from);
            a.restart();
            const engine = i.scene.getEngine();
            engine.runRenderLoop(() => i.scene.render());
            await new Promise(r => setTimeout(r, 1200));
            const frame = a.animatables[0]?.masterFrame;
            a.pause();
            engine.stopRenderLoop();
            return {clip: a.name, from: a.from, to: a.to, frame: frame, advanced: frame > a.from};
        }""")
        print('PLAYBACK_CHECK_IDLE=', report['playback'])
        if not report['playback'].get('advanced'):
            raise ValueError('Babylon animation playback did not advance')

        # Sample camera shots
        SHOT_LIST = [
            ('Idle', 0.5),
            ('Walk', 0.25),
            ('Walk', 0.75),
            ('Run', 0.3),
            ('Run', 0.8),
            ('Attack', 0.42),
            ('Cast', 0.5),
            ('Hit', 0.22),
            ('Death', 0.5),
            ('Death', 1.0),
            ('Strafe', 0.5),
            ('TurnLeft', 0.5),
            ('TurnRight', 0.5),
        ]

        for clip_name, phase in SHOT_LIST:
            for view_name, alpha_val in [('front', math.pi / 2), ('side', 0.0), ('perspective', math.pi / 4)]:
                shot_data = page.evaluate("""x => {
                    const i = document.querySelector('#base-inspection').inspection;
                    i.container.animationGroups.forEach(g => g.stop());
                    const a = i.container.animationGroups.find(g => g.name === x.clip);
                    if (a) {
                        const targetFrame = a.from + x.phase * (a.to - a.from);
                        a.start(false);
                        a.goToFrame(targetFrame);
                        a.pause();
                    }
                    const c = i.camera;
                    c.target.x = 0;
                    c.target.y = 0.9;
                    c.target.z = 0;
                    c.alpha = x.alpha;
                    c.beta = Math.PI / 2.2;
                    c.radius = 2.4;
                    i.scene.getEngine().stopRenderLoop();
                    i.scene.render();
                    const morphs = i.container.meshes.filter(m => m.morphTargetManager).map(m =>
                        Array.from({length: m.morphTargetManager.numTargets}, (_, j) => ({
                            name: m.morphTargetManager.getTarget(j).name,
                            influence: m.morphTargetManager.getTarget(j).influence
                        }))
                    );
                    return {clip: x.clip, phase: x.phase, morphs: morphs};
                }""", {'clip': clip_name, 'phase': phase, 'alpha': alpha_val})

                shot_filename = f'{clip_name}-p{int(phase*100):03d}-{view_name}.png'
                shot_file = out_shots / shot_filename
                page.locator('#base-inspection').screenshot(path=str(shot_file))

                shot_row = {
                    'clip': clip_name,
                    'phase': phase,
                    'view': view_name,
                    'file': str(shot_file.relative_to(stage_dir)),
                    'sha256': hashlib.sha256(shot_file.read_bytes()).hexdigest(),
                    'morphs': shot_data.get('morphs', [])
                }
                report['samples'].append(shot_row)

        report['status'] = 'rendered_for_visual_review'
        browser.close()
        print(f'CAPTURED_{len(report["samples"])}_SCREENSHOTS')
except Exception as e:
    report['status'] = 'failed'
    report['error'] = str(e)
    print('RENDER_FAILED:', e)
    raise
finally:
    server.shutdown()
    (stage_dir / 'babylon-combat-report.json').write_text(json.dumps(report, indent=2))
