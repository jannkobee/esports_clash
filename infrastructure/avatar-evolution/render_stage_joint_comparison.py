"""Render hash-frozen stage stress clips with the shipped Babylon inspector in Colab."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import hashlib,json,os,sys,threading
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(sys.argv[1]).resolve()
if not os.environ.get('COLAB_RELEASE_TAG') or not any(root.is_relative_to(p) for p in ('/content/teamfight-inspection/reviews','/content/teamfight-preparation/reviews')):
    raise RuntimeError('Google Colab inspection environment required')
plan=json.loads((root/'plan.json').read_text())
for name,expected in plan['files'].items():
    if hashlib.sha256((root/name).read_bytes()).hexdigest()!=expected: raise ValueError('Input mismatch: '+name)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root/'site')))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={'id':plan['id'],'compute':'google','publication_eligible':False,'qualification_complete':False,
    'status':'running','plan':plan,'views':[],'errors':[],
    'scope':'Single-joint stress clips at the same nominal angles; axes and joint locations may vary by stage. Not game motions or proof of matching world-space limb endpoints.'}
if plan.get('stages')==['raw','fitted']:
    from candidate_visual_contract import validate_diagnostic_sources
    exported=json.loads((root/'bend-export-report.json').read_text())
    validate_diagnostic_sources(root,plan,exported);report['bend_export']=exported
out=root/'screenshots';out.mkdir()
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=browser.new_page(viewport={'width':1000,'height':900})
        page.on('pageerror',lambda error: report['errors'].append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
        page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
        for stage in plan.get('stages',['raw','early','corrected']):
            page.evaluate('''file=>{document.dispatchEvent(new Event('livewire:navigating'));document.querySelector('#base-inspection').dataset.asset='/'+file;document.dispatchEvent(new Event('livewire:navigated'));}''',plan.get('stress_files',{}).get(stage,stage+'.glb'))
            page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
            if len(json.loads(page.locator('#base-inspection').get_attribute('data-clips')))!=8: raise ValueError('Expected eight stress clips')
            page.evaluate('''async()=>{const s=document.querySelector('#base-inspection').inspection.scene;s.getEngine().stopRenderLoop();s.render();await s.whenReadyAsync();s.render()}''')
            for role in ('UpperArmL','UpperArmR','ThighL','ThighR'):
                for degrees,phase in ((45,.25),(90,.5)):
                    page.evaluate('''x=>document.querySelector('#base-inspection').inspection.sample('Stress_'+x.role,x.phase)''',{'role':role,'phase':phase})
                    for orbit in (0,1,3):
                        page.locator('[data-base-view="front"]').click()
                        meta=page.evaluate('''x=>{const i=document.querySelector('#base-inspection').inspection;const joint=i.container.transformNodes.find(n=>n.name===x.bone);if(!joint)throw Error('Joint missing: '+x.bone);joint.computeWorldMatrix(true);i.camera.setTarget(joint.getAbsolutePosition());i.camera.alpha=x.orbit*Math.PI/4;i.camera.beta=1.35;i.camera.inertialAlphaOffset=0;i.camera.inertialBetaOffset=0;i.camera.inertialRadiusOffset=0;i.camera.radius=Math.max(i.camera.lowerRadiusLimit,i.camera.radius*.3);if(i.camera.minZ>i.camera.radius*.1)throw Error('Near plane clips joint');i.scene.render();const morphs={};for(const mesh of i.container.meshes){const m=mesh.morphTargetManager;if(m)for(let n=0;n<m.numTargets;n++){const t=m.getTarget(n);morphs[t.name]=t.influence}}return {camera:{alpha:i.camera.alpha,beta:i.camera.beta,radius:i.camera.radius,target:i.camera.target.asArray()},morphs}}''',{'bone':plan['bone_map'][role],'orbit':orbit})
                        page.evaluate('''async()=>{const s=document.querySelector('#base-inspection').inspection.scene;s.render();await s.whenReadyAsync();s.render()}''')
                        name=f'{stage}-{role}-{degrees}-orbit{orbit}.png';page.locator('#base-inspection').screenshot(path=str(out/name))
                        report['views'].append({'file':'screenshots/'+name,'stage':stage,'joint':role,'degrees':degrees,'phase':phase,'orbit':orbit,'sha256':hashlib.sha256((out/name).read_bytes()).hexdigest(),**meta})
        if report['errors']:raise ValueError(str(report['errors']))
        browser.close();report['status']='rendered_for_review'
except Exception as error:
    report.update(status='failed',error=f'{type(error).__name__}: {error}');raise
finally:
    server.shutdown();(root/'visual-report.json').write_text(json.dumps(report,indent=2))
