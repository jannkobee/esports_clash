import {Engine,Scene,FreeCamera,Camera,Vector3,Color3,Color4,MeshBuilder,StandardMaterial,Texture} from '@babylonjs/core';
import designs from './data/v3RosterDesign.json';
import './arena2dTrial.css';

// Isolated art review: no match simulation, damage, catalog writes or visual releases.
const host=document.querySelector<HTMLDivElement>('#app')!;
host.innerHTML=`<header><div><span class="eyebrow">EsportsClash / art laboratory</span><h1>The Painted Arena</h1></div><p>2.5D exploration · Babylon.js · Draft artwork</p></header><main><section class="stage"><canvas aria-label="Animated painted arena preview"></canvas><div class="badge" id="readout">Loading artwork…</div></section><aside><span class="eyebrow">First character study</span><h2>Mirelle Vane</h2><small>The Atelier Prodigy</small><p>Ink, ivory, oxblood and brass. Tailoring magic in a painted world.</p><label>Motion study</label><div class="buttons" id="motions"></div><label for="speed">Playback speed</label><input id="speed" type="range" min="0.25" max="2" step="0.25" value="1"><div class="buttons"><button id="pause">Pause</button><button id="restart">Restart</button><button id="step">Next frame</button></div><label for="effect">Stitchwork study</label><select id="effect"><option value="none">No effect</option><option value="seam">Baste Line — seam</option><option value="canopy">Grand Atelier — canopy</option></select><p class="status">Art trial only. Four keyframes per motion, one facing. Foot anchoring, costume consistency and all directions still need polish.</p><label for="roster">Explore the 45-avatar reference</label><select id="roster"></select><div id="reference"></div></aside></main>`;
const canvas=host.querySelector('canvas')!;
const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});
const scene=new Scene(engine);scene.clearColor=new Color4(.06,.1,.1,1);
const camera=new FreeCamera('painted-camera',new Vector3(0,0,-10),scene);camera.setTarget(Vector3.Zero());camera.mode=Camera.ORTHOGRAPHIC_CAMERA;
const fit=()=>{engine.resize();const aspect=canvas.clientWidth/canvas.clientHeight;camera.orthoLeft=-Math.max(7.5,5*aspect);camera.orthoRight=-camera.orthoLeft;camera.orthoTop=Math.max(5,7.5/aspect);camera.orthoBottom=-camera.orthoTop;};
const observer=new ResizeObserver(fit);observer.observe(canvas);fit();
const texture=(path:string,alpha=false)=>{const t=new Texture(path,scene,false,true,Texture.BILINEAR_SAMPLINGMODE);t.hasAlpha=alpha;t.wrapU=Texture.CLAMP_ADDRESSMODE;t.wrapV=Texture.CLAMP_ADDRESSMODE;return t;};
const paint=(name:string,t:Texture)=>{const m=new StandardMaterial(name,scene);m.disableLighting=true;m.emissiveColor=Color3.White();m.diffuseTexture=t;m.useAlphaFromDiffuseTexture=t.hasAlpha;m.backFaceCulling=false;return m;};
const backdrop=MeshBuilder.CreatePlane('painted-ruins',{width:15,height:10},scene);backdrop.position.z=3;backdrop.material=paint('ruins',texture('./art/arena-2d/ruins-v1.png'));
const sheet=texture('./art/arena-2d/mirelle-motion-v1.png',true);sheet.uScale=.25;sheet.vScale=.25;
const avatar=MeshBuilder.CreatePlane('mirelle-sprite',{width:2.6,height:2.08},scene);avatar.position.set(-1.3,-.15,0);avatar.material=paint('mirelle',sheet);
const motions=['Idle','Run','Cast','Death'] as const;let motion=0,elapsed=0,speed=1,paused=false,frame=0;
const motionHost=host.querySelector('#motions')!;
motions.forEach((name,i)=>{const b=document.createElement('button');b.textContent=name;b.onclick=()=>{motion=i;elapsed=0;update();};motionHost.append(b);});
function update(){const fps=motion===0?3:motion===3?5:7;frame=motion===3?Math.min(3,Math.floor(elapsed*fps)):Math.floor(elapsed*fps)%4;sheet.uOffset=frame*.25;sheet.vOffset=(3-motion)*.25;motionHost.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===motion)));host.querySelector('#readout')!.textContent=`Mirelle Vane · ${motions[motion]} · frame ${frame+1}/4 · ${speed}×${paused?' · paused':''}`;}
host.querySelector<HTMLInputElement>('#speed')!.oninput=e=>{speed=Number((e.target as HTMLInputElement).value);update();};
host.querySelector<HTMLButtonElement>('#pause')!.onclick=e=>{paused=!paused;(e.target as HTMLButtonElement).textContent=paused?'Play':'Pause';update();};
host.querySelector<HTMLButtonElement>('#restart')!.onclick=()=>{elapsed=0;update();};
host.querySelector<HTMLButtonElement>('#step')!.onclick=()=>{paused=true;host.querySelector('#pause')!.textContent='Play';elapsed=(frame+1)/(motion===0?3:motion===3?5:7);update();};
const gold=new Color3(.95,.76,.39),points=[new Vector3(.6,-.8,-.2),new Vector3(3.7,-.6,-.2),new Vector3(2,1,-.2)];
const seam=MeshBuilder.CreateDashedLines('stitch-seam',{points:points.slice(0,2),dashSize:.1,gapSize:.08,dashNb:20},scene);seam.color=gold;
const canopy=MeshBuilder.CreateDashedLines('canopy-supports',{points:[...points,points[0]],dashSize:.1,gapSize:.08,dashNb:45},scene);canopy.color=gold;
const pins=points.map((p,i)=>{const m=MeshBuilder.CreateDisc(`pin-${i}`,{radius:.065,tessellation:16},scene);m.position.copyFrom(p);const mat=new StandardMaterial(`pin-material-${i}`,scene);mat.disableLighting=true;mat.emissiveColor=gold;m.material=mat;return m;});
let effect='none';host.querySelector<HTMLSelectElement>('#effect')!.onchange=e=>{effect=(e.target as HTMLSelectElement).value;};
const roster=host.querySelector<HTMLSelectElement>('#roster')!;
for(const h of designs.heroes){const o=document.createElement('option');o.value=h.canonicalId;o.textContent=h.displayName;roster.append(o);}roster.value='mirelle-vane';
function reference(){const h=designs.heroes.find(h=>h.canonicalId===roster.value)!;const target=host.querySelector('#reference')!;target.replaceChildren();const p=document.createElement('p');p.textContent=h.artDirection.replaceAll('**','');target.append(p);for(const [slot,a] of Object.entries(h.abilities)){const d=document.createElement('details'),s=document.createElement('summary'),p=document.createElement('p');s.textContent=`${slot} · ${a.name}`;p.textContent=a.designText.replaceAll('**','');d.append(s,p);target.append(d);}const note=document.createElement('small');note.textContent='Reference selection does not change the Mirelle artwork. Kit design text; runtime is authoritative for values.';target.append(note);}
roster.onchange=reference;reference();update();
engine.runRenderLoop(()=>{if(!paused)elapsed+=Math.min(engine.getDeltaTime()/1000,.1)*speed;update();seam.setEnabled(effect==='seam');canopy.setEnabled(effect==='canopy');pins.forEach((p,i)=>p.setEnabled(effect==='canopy'||effect==='seam'&&i<2));avatar.position.x=motion===1?-1.3+Math.sin(elapsed*.8)*.8:-1.3;scene.render();});
window.addEventListener('pagehide',()=>{observer.disconnect();engine.stopRenderLoop();scene.dispose();engine.dispose();},{once:true});

