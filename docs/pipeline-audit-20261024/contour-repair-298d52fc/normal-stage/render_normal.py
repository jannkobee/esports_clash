import os,sys,json,threading,hashlib,shutil,math
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
root=Path(sys.argv[1]).resolve();normal_dir=root/'normal-stage';shots=normal_dir/'screenshots';shots.mkdir(exist_ok=True)
r=json.loads((root/'repair-report.json').read_text());ex=json.loads((root/'export-report.json').read_text())
shutil.copyfile(normal_dir/'normal-corrected.glb',root/'site/normal-corrected.glb')
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root/'site')));threading.Thread(target=server.serve_forever,daemon=True).start()
out={'compute':'google','source_glb_sha256':ex['sha256'],'normal_corrected_glb_sha256':hashlib.sha256((normal_dir/'normal-corrected.glb').read_bytes()).hexdigest(),'publication_eligible':False,'qualification_complete':False,'views':[],'errors':[]}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=browser.new_page(viewport={'width':1100,'height':900})
  page.on('pageerror',lambda e:out['errors'].append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/repair.html');page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
  page.evaluate("""file=>{document.dispatchEvent(new Event('livewire:navigating'));document.querySelector('#base-inspection').dataset.asset='/'+file;document.dispatchEvent(new Event('livewire:navigated'));}""",'normal-corrected.glb')
  page.wait_for_selector('#base-inspection[data-ready="true"]',timeout=60000)
  out['loaded']=page.evaluate("""()=>{const i=document.querySelector('#base-inspection').inspection;return {clips:i.container.animationGroups.map(a=>a.name),meshes:i.container.meshes.filter(m=>m.skeleton).map(m=>({influences:m.numBoneInfluencers,bones:m.skeleton.bones.length,extraWeights:!!m.getVerticesData('matricesWeightsExtra'),morphs:m.morphTargetManager?.numTargets,supportsNormals:m.morphTargetManager?.supportsNormals,defines:m.material?.getEffect()?.defines}))}}""")
  samples_to_render=[ex['samples'][0],ex['samples'][1],ex['samples'][2],ex['samples'][3],ex['samples'][4],ex['samples'][10]]
  for sample in samples_to_render:
   for view in ('front','side','oblique'):
    alpha_val=math.pi/2 if view=='front' else (math.pi if sample['camera_target_gltf'][0]<=0 else 0) if view=='side' else (3*math.pi/4 if sample['camera_target_gltf'][0]<=0 else math.pi/4)
    cam=page.evaluate("""x=>{const i=document.querySelector('#base-inspection').inspection;const c=i.camera;
     i.sample('Mirelle_ContourTrial',x.phase);
     const target=c.target.clone();target.set(...x.target);c.setTarget(target);c.radius=x.radius;c.alpha=x.alpha;c.beta=Math.PI/2;c.minZ=.0001;
     i.scene.getEngine().stopRenderLoop();i.scene.render();return {target:x.target,radius:c.radius,alpha:c.alpha,beta:c.beta,minZ:c.minZ}}""",
     {'phase':sample['phase'],'target':sample['camera_target_gltf'],'radius':r['body_height']*(1.2 if 'Rest' in sample['case'] else .34),'alpha':alpha_val})
    p=shots/(sample['case']+'-normal-corrected-'+view+'.png');page.locator('#base-inspection').screenshot(path=str(p))
    out['views'].append({'case':sample['case'],'view':view,'file':str(p.relative_to(normal_dir)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'camera':cam})
  out['status']='rendered_for_review';browser.close()
finally:
 server.shutdown();(root/'site/normal-corrected.glb').unlink(missing_ok=True);(normal_dir/'render-report.json').write_text(json.dumps(out,indent=2))
