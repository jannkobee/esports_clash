// Read-only browser review of an isolated candidate using the actual studio.
// Usage: node infrastructure/evolution/verify-avatar-natural-motion.mjs path/to/candidate.glb
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {withBrowser} from './backoffice-browser.mjs';

const candidate=process.argv[2];
assert.ok(candidate,'Provide an isolated candidate GLB');
const encoded=(await readFile(candidate)).toString('base64');
await withBrowser(async({send,evaluate,until,pause,errors})=>{
 await send('Page.navigate',{url:'http://localhost:8088/'});
 await until(`document.readyState==='complete'&&!!document.querySelector('#root')`);
 await evaluate(`window.__candidate=${JSON.stringify(encoded)};true`);
 await evaluate(`(async()=>{
   const [{AvatarPreview},{CHAMPIONS},{GLTFLoader}]=await Promise.all([
     import('/src/threeAvatarPreview.ts'),import('/src/mockData.ts'),import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js')]);
   const bytes=Uint8Array.from(atob(window.__candidate),c=>c.charCodeAt(0));delete window.__candidate;
   const file=await new GLTFLoader().parseAsync(bytes.buffer,'');
   document.body.innerHTML='<div id="natural-review" style="width:800px;height:700px;background:#101b2b"></div>';
   const host=document.querySelector('#natural-review'),preview=new AvatarPreview(host,()=>{});
   preview.assets.files.set('c_astra',file);
   preview.setKit(CHAMPIONS.find(c=>c.id==='c_astra'));preview.setView(.35,'idle',false);
   window.__review={preview,host,file};
 })()`);
 await until(`window.__review?.host.dataset.drawCalls>0`);
 const info=await evaluate(`(()=>{
   const {preview}=window.__review;let root;preview.model.body.traverse(n=>{if(n.userData.avatarPart==='avatar-root')root=n;});
   const names=new Set(Object.keys(root.userData.assetPreparation.secondary_bones));let secondaryVertices=0;
   preview.model.body.traverse(n=>{if(!n.isSkinnedMesh)return;
     const indices=n.geometry.getAttribute('skinIndex'),weights=n.geometry.getAttribute('skinWeight');
     for(let v=0;v<indices.count;v++){for(let c=0;c<4;c++){
       if(weights.getComponent(v,c)>0&&names.has(n.skeleton.bones[indices.getComponent(v,c)].name)){secondaryVertices++;break;}
     }}
   });
   return {clips:preview.model.body.userData.clips,strides:preview.model.body.userData.strideDistances,secondaryVertices,
     secondary:root.userData.assetPreparation.secondary_bones,height:preview.model.height};
 })()`);
 assert.equal(info.clips.length,10);assert.ok(Object.keys(info.secondary).length>0);
 assert.ok(info.secondaryVertices>100,'Secondary bones must deform actual skin');
 // A paused pose change must render intermediate frames and settle in 0.20 s.
 await evaluate(`window.__review.preview.setView(.35,'run',false);true`);
 const initial=await evaluate(`window.__review.preview.transition`);
 assert.ok(initial<.2);
 await until(`window.__review.preview.transition===.2&&window.__review.preview.frame===0`);
 const paused=await evaluate(`(()=>{const a=[];window.__review.preview.model.body.traverse(n=>{if(n.isBone)a.push(...n.quaternion.toArray());});return a;})()`);
 await pause(150);
 assert.deepEqual(await evaluate(`(()=>{const a=[];window.__review.preview.model.body.traverse(n=>{if(n.isBone)a.push(...n.quaternion.toArray());});return a;})()`),paused);
 const output=resolve('.local-tools/natural-motion-review');await mkdir(output,{recursive:true});
 async function capture(name){
   const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(output,name),Buffer.from(shot.data,'base64'));
 }
 await capture('aiselle-run.png');
 await evaluate(`window.__review.preview.setView(.35,'idle',true);true`);await pause(400);
 await capture('aiselle-idle.png');
 // Exercise interruptions, death and resume through the real preview.
 for(const state of ['run','attack','cast','idle','death','idle']){
   await evaluate(`window.__review.preview.setView(.35,${JSON.stringify(state)},true);true`);await pause(75);
 }
 await pause(250);
 const finite=await evaluate(`(()=>{let finite=true;const {preview}=window.__review;preview.model.body.updateMatrixWorld(true);
   preview.model.body.traverse(n=>{finite=finite&&n.matrixWorld.elements.every(Number.isFinite);});return finite;})()`);
 assert.ok(finite);assert.deepEqual(errors,[]);
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await evaluate(`window.__review.preview.setView(.35,'walk',false);true`);
 assert.equal(await evaluate(`window.__review.preview.transition`),.2);
 await evaluate(`window.__review.preview.dispose();true`);
 assert.equal(await evaluate(`window.__review.host.querySelectorAll('canvas').length`),0);
 const report={...info,pausedPoseTransition:true,pausedTransformsStable:true,interruptedStatesFinite:finite,reducedMotion:true,disposed:true,errors,publication:false};
 await writeFile(resolve(output,'browser-verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
});
