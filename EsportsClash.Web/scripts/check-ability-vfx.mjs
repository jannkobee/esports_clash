// Render real Three VFX in controlled fixtures, plus a short looping WebM for visual review.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const cdp=process.env.CDP_PORT??'9232',vite=process.env.VITE_PORT??'5182';
const details=process.env.VFX_DETAILS==='1',prefix=process.env.OUTPUT_PREFIX??'ability-vfx';assert.match(prefix,/^[a-z0-9-]+$/);
const page=(await(await fetch(`http://127.0.0.1:${cdp}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(done=>ws.addEventListener('open',done,{once:true}));
let id=0;const pending=new Map();ws.onmessage=event=>{const r=JSON.parse(event.data);if(!r.id)return;const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
try{
  let ready=false;
  for(let attempt=0;attempt<100;attempt++){
    try{ready=(await fetch(`http://127.0.0.1:${vite}/`)).ok;}catch{}
    if(ready)break;await new Promise(done=>setTimeout(done,100));
  }
  assert.ok(ready,'local review server ready');
  await send('Page.navigate',{url:`http://127.0.0.1:${vite}/`});
  for(let attempt=0;attempt<100;attempt++){
    if(await evaluate(`location.origin===${JSON.stringify(`http://127.0.0.1:${vite}`)}`))break;
    if(attempt===99)throw Error('Review page did not navigate');await new Promise(done=>setTimeout(done,100));
  }
  const result=await evaluate(`(async()=>{
    const THREE=await import('/node_modules/.vite/deps/three.js');
    const {ArenaAbilityEffects}=await import('/src/threeAbilityEffects.ts');
    const {KAELEN_INVOKED_SPELLS}=await import('/src/kaelenAbilities.ts');
    const {kaelenCastLifetime}=await import('/src/kaelenSpellRuntime.ts');
    const {disposeArenaTerrainResources}=await import('/src/threeArenaTerrain.ts');
    const {AvatarModelResources,bindAvatarModel}=await import('/src/threeAvatarModels.ts');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {clone}=await import('/node_modules/three/examples/jsm/utils/SkeletonUtils.js');
    const file=await new GLTFLoader().loadAsync('/models/avatars-v2/c_invoker.glb?art=3');
    const resources=new AvatarModelResources();
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setSize(1600,960,false);renderer.setScissorTest(true);renderer.autoClear=true;
    const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1100;document.body.replaceChildren(canvas);const ctx=canvas.getContext('2d');
    const detailed=${details};
    const definitions=detailed?[
      ['Hook + linked chain','Mirehook','hook_fixture','#afd9e6','hook'],['Electric dash','Raijin','dash_raijin_bolt','#70ddff','none'],
      ['Ember dash','Xin','dash_cinder_lunge','#fa9953','none'],['Feathered dash','Renn','dash_renn_vault','#f4d195','none'],
      ['Death Mark','Kage','death_mark','#e67d98','none'],['Shallow Grave','Zal','shallow_grave','#d7a1fa','none'],
      ['Singularity Well','Nullweaver','black_hole','#b48cff','none'],['Court of Branches','Stonebranch','branch_court','#86efac','none'],
      ['Cyclone Dance','Cloudtail','cyclone_dance','#fbbf24','none'],['Broadside Waltz','Corsara','broadside_channel','#fb7185','none'],
      ['Prism formation','Kaelen','kaelen_invoke','#fb7185','none'],['Entangling Claws','Sylla','spirit_bear','#69c78f','none']
    ]:[['Melee crescents','Valkira','skill_burst','#f5b1c6','shuriken'],['Chain lightning','Raijin','skill_burst','#76dfff','electric_spark'],
      ['Frost shards','Astra','skill_burst','#a4e9ff','ult_arrow'],['Fire eruption','Xin','cinder_verdict','#ff9857','boss_breath'],
      ['Earth rupture','Stonewake','faultline','#e1b378','boulder'],['Growing roots','Tequoia','sprout_ring','#97e2ac','nature_bolt'],
      ['Healing motes','Solana','daybreak_veil','#ffdc8b','orb'],['Gravity vortex','Nullweaver','black_hole','#b48cff','orb'],
      ['Wind currents','Kazemaru','skill_burst','#98e9ed','tornado'],['Resonant waves','Croakwell','bogbeat','#80eac8','seed_shot'],
      ['Wind barrier','Kazemaru','wind_wall','#78d6fa','arrow'],['Solar Meteor','Kaelen','kaelen_invoke','#ff9857','flak_round']];
    const fixtures=definitions.map(([label,avatarName,type,color,projectile])=>{
      const fx=new ArenaAbilityEffects(),scene=new THREE.Scene();scene.background=new THREE.Color('#101d2b');scene.add(fx.root);
      scene.add(new THREE.HemisphereLight('#e4f3ff','#243546',2.2));const key=new THREE.DirectionalLight('#ffe9ce',2.5);key.position.set(-100,250,150);scene.add(key);
      const floor=new THREE.Mesh(new THREE.PlaneGeometry(440,300),new THREE.MeshStandardMaterial({color:'#192b37',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.set(210,-.5,120);scene.add(floor);
      const grid=new THREE.GridHelper(420,14,'#293d49','#233642');grid.position.set(210,0,120);scene.add(grid);
      const model=clone(file.scene),outer=new THREE.Group();outer.scale.setScalar(40);outer.add(model);outer.position.set(75,0,130);scene.add(outer);
      let inner;model.traverse(n=>{if(n.userData.avatarPart==='avatar-root')inner=n;});const rig=bindAvatarModel(inner,resources);inner.rotation.y=Math.PI/2;
      // Effect fixtures use the same source character as a scale reference, not different simulated kits.
      const camera=new THREE.OrthographicCamera(-210,210,150,-150,1,1500);camera.position.set(210,350,440);camera.lookAt(210,0,120);camera.updateProjectionMatrix();
      return {label,avatarName,type,color,projectile,scene,fx,camera,rig,outer};
    });
    const render=time=>{
      for(let i=0;i<fixtures.length;i++){
        const f=fixtures[i],elapsed=time%2,progress=elapsed/2;
        let spell={id:'fixture',type:f.type,avatarName:f.avatarName,abilitySlot:'ultimate',x:265,y:120,sourceX:75,sourceY:130,radius:65,duration:2-elapsed,maxDuration:2,color:f.color};
        if(f.type==='kaelen_invoke'){
          const kit=KAELEN_INVOKED_SPELLS.find(s=>s.id===(detailed?'solar-pike':'sirocco-flare')),elapsed=time%kaelenCastLifetime(kit);
          spell={...spell,maxDuration:kaelenCastLifetime(kit),duration:kaelenCastLifetime(kit)-elapsed,kaelenCast:{spellId:kit.id,origin:{x:75,y:130},aim:{x:265,y:120},elapsed,hitIds:[],resolved:false}};
        }
        const source={id:'caster',isAlive:true,x:75,y:130};let spells=[spell];
        const shots=f.projectile==='none'?[]:[{id:'shot',x:130+progress*230,y:detailed?130:185,angle:0,type:f.projectile,size:5,color:f.color,attackerId:'caster'}];
        if(f.type==='hook_fixture')spells=[];
        if(f.type.startsWith('dash_')){
          source.x=75+progress*240;source.dash={kind:f.type.slice(5),remaining:.2,startX:75,startY:130};spells=[];
        }
        if(detailed){
          const key={black_hole:'blackHole',branch_court:'monkeyCourt',cyclone_dance:'monkeySpin',broadside_channel:'corsaraBarrage'}[f.type];
          if(key){source[key]={x:265,y:120,remaining:2-elapsed,facing:'right'};spell={...spell,sourceUnitId:'caster'};spells=[spell];}
          if(f.type==='cyclone_dance')source.x=245;
          if(f.type==='broadside_channel')spell.radius=260;
        }
        f.outer.position.set(source.x,0,source.y);
        f.fx.update(shots,spells,time,[source]);f.rig.animate({animState:source.dash?'walk':'cast',animTimer:time},time);
        const col=i%4,row=Math.floor(i/4);renderer.setViewport(col*400,(2-row)*320,400,320);renderer.setScissor(col*400,(2-row)*320,400,320);renderer.render(f.scene,f.camera);
      }
      ctx.fillStyle='#08121f';ctx.fillRect(0,0,1600,1100);ctx.drawImage(renderer.domElement,0,110);
      ctx.fillStyle='#e6e7df';ctx.font='bold 32px system-ui';ctx.fillText('ABILITY ANIMATIONS / ACTUAL 3D EFFECTS',24,43);
      ctx.fillStyle='#8da9bd';ctx.font='16px system-ui';ctx.fillText('Controlled effect fixtures • simulation-time motion • real GLB used as scale reference • no gameplay changes',25,76);
      for(let i=0;i<fixtures.length;i++){const x=(i%4)*400,y=Math.floor(i/4)*320+110;ctx.fillStyle='rgba(5,12,22,.8)';ctx.fillRect(x,y,400,29);ctx.fillStyle='#cbe3ef';ctx.font='bold 15px system-ui';ctx.fillText(fixtures[i].label,x+12,y+20);ctx.strokeStyle='#294050';ctx.strokeRect(x+.5,y+.5,399,319);}
    };
    render(.46);const png=canvas.toDataURL('image/png');
    const counts=fixtures.map(f=>({label:f.label,...f.fx.stats()}));
    const stream=canvas.captureStream(24),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
    const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4500000}),chunks=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(done=>recorder.onstop=done);recorder.start();
    const started=performance.now();await new Promise(done=>{const tick=()=>{const time=(performance.now()-started)/1000;render(time);if(time<4.1)requestAnimationFrame(tick);else done();};requestAnimationFrame(tick);});
    recorder.stop();await stopped;stream.getTracks().forEach(track=>track.stop());
    const video=await new Promise(done=>{const reader=new FileReader();reader.onload=()=>done(reader.result);reader.readAsDataURL(new Blob(chunks,{type:mime}));});
    fixtures.forEach(f=>{f.rig.dispose();disposeArenaTerrainResources(f.scene);});disposeArenaTerrainResources(file.scene);disposeArenaTerrainResources(resources.owner);renderer.dispose();renderer.forceContextLoss();
    return {png,video,counts,mime};
  })()`);
  assert.equal(result.counts.length,12);assert.ok(result.counts.every(row=>row.effects>3));
  await writeFile(`../docs/${prefix}-preview.png`,Buffer.from(result.png.split(',')[1],'base64'));
  await writeFile(`../docs/${prefix}-preview.webm`,Buffer.from(result.video.split(',')[1],'base64'));
  await writeFile(`../docs/${prefix}-fixtures.json`,JSON.stringify({date:'2026-10-17',details,fixtures:result.counts,videoMime:result.mime,limits:'Controlled renderer fixtures; the source GLB is a scale reference. Full live ability matrix and device frame times remain unmeasured.'},null,2)+'\n');
  console.log('Rendered 12 effect families and a 4-second actual WebGL animation preview.');
}finally{ws.close();}
