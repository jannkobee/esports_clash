const host=document.getElementById('generation-stage'),status=document.getElementById('generation-view-status');
let renderer,controls,scene,observer,model,mixer,animationFrame,skeletonHelper,gridHelper;
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

    // Skeleton helper inspection
    let hasBones=false;
    model.traverse(object=>{if(object.isBone||object.isSkinnedMesh)hasBones=true;});
    let skeletonVisible=false;
    if(hasBones){
        skeletonHelper=new THREE.SkeletonHelper(model);
        skeletonHelper.visible=false;
        scene.add(skeletonHelper);
    }
    const skeletonBtn=document.getElementById('generation-skeleton');
    if(skeletonBtn){
        if(!hasBones){
            skeletonBtn.disabled=true;
            skeletonBtn.title='No skeleton or bones detected';
        }else{
            skeletonBtn.addEventListener('click',()=>{
                skeletonVisible=!skeletonVisible;
                if(skeletonHelper){
                    skeletonHelper.visible=skeletonVisible;
                    if(skeletonVisible)skeletonHelper.update();
                }
                skeletonBtn.setAttribute('aria-pressed',String(skeletonVisible));
                skeletonBtn.classList.toggle('is-active',skeletonVisible);
                render();
            });
        }
    }

    // Wireframe inspection
    let wireframeVisible=false;
    const wireframeBtn=document.getElementById('generation-wireframe');
    if(wireframeBtn){
        wireframeBtn.addEventListener('click',()=>{
            wireframeVisible=!wireframeVisible;
            model.traverse(object=>{
                if(object.isMesh&&object.material){
                    const mats=Array.isArray(object.material)?object.material:[object.material];
                    mats.forEach(m=>{m.wireframe=wireframeVisible;m.needsUpdate=true;});
                }
            });
            wireframeBtn.setAttribute('aria-pressed',String(wireframeVisible));
            wireframeBtn.classList.toggle('is-active',wireframeVisible);
            render();
        });
    }

    // Grid floor helper
    let gridVisible=false;
    const gridBtn=document.getElementById('generation-grid');
    if(gridBtn){
        const groundY=-size.y/2;
        const gridSpan=Math.max(size.x,size.z,size.y)*2;
        gridHelper=new THREE.GridHelper(gridSpan,20,0x38bdf8,0x223249);
        gridHelper.position.y=groundY;
        gridHelper.visible=false;
        scene.add(gridHelper);
        gridBtn.addEventListener('click',()=>{
            gridVisible=!gridVisible;
            gridHelper.visible=gridVisible;
            gridBtn.setAttribute('aria-pressed',String(gridVisible));
            gridBtn.classList.toggle('is-active',gridVisible);
            render();
        });
    }

    // Animation & Playback Speed
    const selector=document.getElementById('generation-animation');
    let playing=false;
    if(selector){
        mixer=new THREE.AnimationMixer(model);let last=performance.now();
        const playButton=document.getElementById('generation-play');
        const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const updatePlayback=()=>{
            host.dataset.animation=selector.value===''?'rest':loaded.animations[Number(selector.value)].name;
            host.dataset.playing=String(playing);
            if(playButton){playButton.disabled=selector.value==='';playButton.textContent=playing?'Pause':'Play';playButton.setAttribute('aria-pressed',String(playing));}
        };
        loaded.animations.forEach((clip,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=clip.name;selector.append(option);});
        const selectClip=()=>{
            mixer.stopAllAction();
            if(selector.value!==''){mixer.clipAction(loaded.animations[Number(selector.value)]).reset().play();playing=!reducedMotion;}else playing=false;
            // Evaluate the selected pose immediately, including when motion is paused.
            mixer.update(0);updatePlayback();render();
        };
        selector.addEventListener('change',selectClip);
        playButton?.addEventListener('click',()=>{if(selector.value==='')return;playing=!playing;updatePlayback();});
        const idleIndex=loaded.animations.findIndex(clip=>clip.name.toLowerCase()==='idle');
        if(idleIndex>=0)selector.value=String(idleIndex);
        selectClip();
        const speedSelector=document.getElementById('generation-speed');
        if(speedSelector){
            speedSelector.addEventListener('change',()=>{
                const spd=parseFloat(speedSelector.value)||1.0;
                mixer.timeScale=spd;
            });
        }
        const tick=now=>{const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;if(playing){mixer.update(dt);if(skeletonHelper&&skeletonVisible)skeletonHelper.update();render();}animationFrame=requestAnimationFrame(tick);};animationFrame=requestAnimationFrame(tick);
    }
    // Fit the displayed Idle pose, including its equipment, rather than the
    // wider bind pose used by the skeleton before mixer evaluation.
    model.updateMatrixWorld(true);
    model.traverse(object=>{if(object.isSkinnedMesh){object.skeleton.update();object.computeBoundingBox();}});
    const displayBounds=new THREE.Box3().setFromObject(model),displayCenter=displayBounds.getCenter(new THREE.Vector3());
    displayBounds.getSize(size);model.position.sub(displayCenter);model.updateMatrixWorld(true);
    if(gridHelper)gridHelper.position.y=displayBounds.min.y-displayCenter.y;
    radius=size.length()/2;fitDistance();
    camera.near=Math.max(.0001,distance/10000);camera.far=distance*30;controls.minDistance=distance*.12;controls.maxDistance=distance*8;camera.updateProjectionMatrix();
    const metrics={meshes:0,vertices:0,triangles:0,skinned_meshes:0,animation_clips:loaded.animations.length,shader_errors:shaderErrors,equipment_slots:[]};
    model.traverse(object=>{if(!object.isMesh)return;metrics.meshes++;metrics.vertices+=object.geometry.attributes.position?.count??0;metrics.triangles+=(object.geometry.index?.count??object.geometry.attributes.position?.count??0)/3;if(object.isSkinnedMesh)metrics.skinned_meshes++;const slot=object.userData.modularEquipment?.slot;if(['primary','secondary'].includes(slot)&&!metrics.equipment_slots.includes(slot))metrics.equipment_slots.push(slot);});
    metrics.equipment_slots.sort();
    model.updateMatrixWorld(true);
    metrics.initial_pose={};
    for(const name of ['UpperArmL','UpperArmR','HandL','HandR']){const bone=model.getObjectByName(name);if(bone)metrics.initial_pose[name]=bone.getWorldPosition(new THREE.Vector3()).toArray();}
    view('fit');metrics.draw_calls=renderer.info.render.calls;
    if(!metrics.meshes||shaderErrors.length)throw Error('Generated model did not render correctly');
    status.textContent=`${metrics.triangles.toLocaleString()} triangles · ${metrics.meshes} meshes · ${metrics.skinned_meshes} skinned meshes · ${metrics.animation_clips} native animation clips${metrics.equipment_slots.length?' · '+metrics.equipment_slots.length+' equipped hands':''}`;
    window.__trellisPreview={ready:true,...metrics};
    document.querySelectorAll('[data-model-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.modelView)));
}catch(error){status.textContent='Unable to display the generated source: '+error.message;window.__trellisPreview={ready:false,error:error.message};}
window.addEventListener('pagehide',()=>{
    cancelAnimationFrame(animationFrame);
    mixer?.stopAllAction();
    if(model)mixer?.uncacheRoot(model);
    if(skeletonHelper){scene?.remove(skeletonHelper);skeletonHelper.dispose();}
    if(gridHelper){scene?.remove(gridHelper);gridHelper.geometry?.dispose();gridHelper.material?.dispose();}
    observer?.disconnect();
    controls?.dispose();
    const materials=new Set(),textures=new Set();
    model?.traverse(object=>{object.geometry?.dispose();for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
    for(const texture of textures)texture.dispose();
    for(const material of materials)material.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
});
