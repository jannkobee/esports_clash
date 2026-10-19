const host=document.getElementById('generation-stage'),status=document.getElementById('generation-view-status');
let renderer,controls,scene,observer,model,mixer,animationFrame;
try{
    const [THREE,{GLTFLoader},{OrbitControls}]=await Promise.all([
        import('./evolution-vendor/three/three.module.js'),
        import('./evolution-vendor/three/addons/loaders/GLTFLoader.js'),
        import('./evolution-vendor/three/addons/controls/OrbitControls.js'),
    ]);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
    host.append(renderer.domElement);scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(35,1,.001,1000);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;
    scene.add(new THREE.HemisphereLight(0xe8f5ff,0x263345,2.2));
    const light=new THREE.DirectionalLight(0xffe9d0,3);light.position.set(-3,6,5);scene.add(light);
    const rim=new THREE.DirectionalLight(0x9bc5ff,1.5);rim.position.set(4,3,-4);scene.add(rim);
    const shaderErrors=[];renderer.debug.onShaderError=()=>shaderErrors.push('Shader compilation failed');
    let distance=3,radius=0;
    const render=()=>{renderer.render(scene,camera);};
    const fitDistance=()=>{const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.min(1,camera.aspect));distance=Math.max(.1,radius/Math.sin(halfFov))*1.15;};
    const resize=()=>{const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;if(radius){fitDistance();camera.position.setLength(distance);controls.update();}camera.updateProjectionMatrix();render();};
    const view=direction=>{const angle=direction==='side'?Math.PI/2:direction==='back'?Math.PI:direction==='fit'?0.6:0;camera.position.set(Math.sin(angle)*distance,distance*.18,Math.cos(angle)*distance);controls.target.set(0,0,0);controls.update();render();};
    controls.addEventListener('change',render);observer=new ResizeObserver(resize);observer.observe(host);resize();
    let loadTimer;
    let loaded;
    try{loaded=await Promise.race([
        new GLTFLoader().loadAsync(host.dataset.asset,event=>{if(event.loaded)status.textContent=`Loading model: ${(event.loaded/1048576).toFixed(1)} MiB received`;}),
        new Promise((_,reject)=>{loadTimer=setTimeout(()=>reject(Error('Model loading timed out. Reload this page or download the GLB to inspect it.')),60000);}),
    ]);}finally{clearTimeout(loadTimer);}
    model=loaded.scene;
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    if(bounds.isEmpty()||![...size,...center].every(Number.isFinite))throw Error('Generated mesh bounds are invalid');
    model.position.sub(center);scene.add(model);
    const selector=document.getElementById('generation-animation');
    if(selector){
        mixer=new THREE.AnimationMixer(model);let playing=false,last=performance.now();
        loaded.animations.forEach((clip,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=clip.name;selector.append(option);});
        selector.addEventListener('change',()=>{mixer.stopAllAction();if(selector.value!==''){mixer.clipAction(loaded.animations[Number(selector.value)]).reset().play();playing=true;}else playing=false;render();});
        document.getElementById('generation-play')?.addEventListener('click',()=>{playing=!playing;});
        const tick=now=>{const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;if(playing){mixer.update(dt);render();}animationFrame=requestAnimationFrame(tick);};animationFrame=requestAnimationFrame(tick);
    }
    radius=size.length()/2;fitDistance();
    camera.near=Math.max(.0001,distance/10000);camera.far=distance*30;controls.minDistance=distance*.12;controls.maxDistance=distance*8;camera.updateProjectionMatrix();
    const metrics={meshes:0,vertices:0,triangles:0,skinned_meshes:0,animation_clips:loaded.animations.length,shader_errors:shaderErrors};
    model.traverse(object=>{if(!object.isMesh)return;metrics.meshes++;metrics.vertices+=object.geometry.attributes.position?.count??0;metrics.triangles+=(object.geometry.index?.count??object.geometry.attributes.position?.count??0)/3;if(object.isSkinnedMesh)metrics.skinned_meshes++;});
    view('fit');metrics.draw_calls=renderer.info.render.calls;
    if(!metrics.meshes||shaderErrors.length)throw Error('Generated model did not render correctly');
    status.textContent=`${metrics.triangles.toLocaleString()} triangles · ${metrics.meshes} meshes · ${metrics.skinned_meshes} skinned meshes · ${metrics.animation_clips} native animation clips`;
    window.__trellisPreview={ready:true,...metrics};
    document.querySelectorAll('[data-model-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.modelView)));
}catch(error){status.textContent='Unable to display the generated source: '+error.message;window.__trellisPreview={ready:false,error:error.message};}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(animationFrame);mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);observer?.disconnect();controls?.dispose();const materials=new Set(),textures=new Set();model?.traverse(object=>{object.geometry?.dispose();for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});for(const texture of textures)texture.dispose();for(const material of materials)material.dispose();renderer?.dispose();renderer?.forceContextLoss();});
