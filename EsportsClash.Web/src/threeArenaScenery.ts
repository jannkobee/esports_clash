import { arenaGroundHeight, RIDGE_RAMPS } from './arenaElevation.ts';
import { arenaCampArt } from './arenaArtDirection.ts';
import { ArenaSceneryVisibility } from './arenaSceneryVisibility.ts';
import { lowlandRegionDistance, stoneLaneEdges, LANDSCAPE, HEALING_SHRINE_Y } from './arenaLandform.ts';
import { createArenaCliffs, campCliffCrest } from './threeArenaCliffs.ts';
import * as THREE from 'three';
import {ARAM_BUSHES,CAMP_ROCK_RINGS,ROCK_TERRAIN} from './arenaRules.ts';
import {WELL_X} from './arenaLayout.ts';
import type {LaneStructure} from './types.ts';

type V=[number,number,number];
type Batch={geometry:THREE.BufferGeometry;material:THREE.Material;matrices:THREE.Matrix4[]};
type Emitter={x:number;y:number;z:number;color:string};
const noise=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const particleVertex=/* glsl */`
 uniform float uTime;uniform float uKind;
 attribute vec3 aData;attribute vec3 aColor;
 varying vec3 vColor;varying float vAlpha;varying float vSeed;
 void main(){
  float s=aData.x,t=uTime,phase=fract(t*(.13+s*.13)+s);vec3 p=position;
  vAlpha=1.;vColor=aColor;vSeed=s;
  float size=aData.y;
  if(uKind<.5){p.y+=phase*48.;p.x+=sin(s*44.+phase*5.)*4.;p.z+=cos(s*29.+phase*4.)*4.;vAlpha=pow(1.-phase,1.5)*.8;}
  else if(uKind<1.5){p+=vec3(sin(t*.7+s*50.)*7.,sin(t*.9+s*22.)*4.,cos(t*.6+s*34.)*7.);vAlpha=.2+.5*pow(sin(t*1.4+s*30.)*.5+.5,3.);}
  else if(uKind<2.5){p.y+=phase*57.;p.x+=sin(s*40.+phase*2.)*10.;p.z+=phase*8.;size*=.6+phase;vAlpha=sin(phase*3.14159)*.10;}
  else if(uKind<3.5){p.y+=(1.-phase)*34.;p.x+=phase*23.+sin(t+s*30.)*4.;p.z+=sin(phase*5.+s*40.)*7.;vAlpha=sin(phase*3.14159)*.48;}
  else if(uKind<4.5){p.y+=4.+sin(t*5.+s*30.)*2.;p.x+=sin(t*6.+s*20.)*1.3;size*=.85+sin(t*9.+s*30.)*.15;vAlpha=.7;}
  else {float a=s*6.28318+t*.45;p.x+=cos(a)*22.;p.z+=sin(a)*22.;p.y+=phase*29.;vAlpha=sin(phase*3.14159)*.45;}
  vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
  gl_PointSize=clamp(size*projectionMatrix[1][1]*520.,1.2,62.);
 }
`;
const particleFragment=/* glsl */`
 uniform float uTime;uniform float uKind;
 varying vec3 vColor;varying float vAlpha;varying float vSeed;
 void main(){
  vec2 p=gl_PointCoord*2.-1.;float alpha;
  if(uKind>2.5&&uKind<3.5){float a=uTime*.8+vSeed*40.;p=mat2(cos(a),-sin(a),sin(a),cos(a))*p;alpha=(1.-smoothstep(.5,1.,length(p*vec2(.8,2.3))))*.65;}
  else if(uKind>3.5&&uKind<4.5){p.x*=1.4;p.y*=.85;alpha=exp(-dot(p,p)*3.5)*(1.-smoothstep(.55,1.,length(p)));}
  else{alpha=1.-smoothstep(.1,1.,dot(p,p));alpha*=alpha;}
  if(alpha*vAlpha<.008)discard;
  gl_FragColor=vec4(vColor,alpha*vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;

/** Map art only. Layout is deterministic and animation is a pure function of
 * the match clock, so pause/replay never advances an independent particle sim. */
export class ArenaScenery{
 readonly root=new THREE.Group();
 readonly visibility=new ArenaSceneryVisibility();
 private readonly owner=new THREE.Group();
 private readonly time={value:0};
 private readonly materials=new Map<string,THREE.Material>();
 private readonly batches=new Map<string,Batch>();
 private readonly emitters:Emitter[]=[];
 private readonly geometries={
  stone:new THREE.DodecahedronGeometry(1,0),crown:new THREE.IcosahedronGeometry(1,1),
  rod:new THREE.CylinderGeometry(.72,1,1,7),box:new THREE.BoxGeometry(1,1,1),
  ring:new THREE.TorusGeometry(1,.07,4,32),disc:new THREE.CylinderGeometry(1,1,1,32),
  roof:new THREE.ConeGeometry(1,1,4),pine:new THREE.ConeGeometry(1,1,7),
  arch:new THREE.ShapeGeometry(new THREE.Shape().moveTo(-.5,0).lineTo(.5,0).lineTo(.5,.65).quadraticCurveTo(.5,1,.0,1).quadraticCurveTo(-.5,1,-.5,.65).closePath()),
  shard:new THREE.OctahedronGeometry(1,0),leaf:new THREE.ShapeGeometry(new THREE.Shape().moveTo(0,0).quadraticCurveTo(-.6,.4,0,1).quadraticCurveTo(.6,.4,0,0)),
  banner:new THREE.PlaneGeometry(9,23,3,8),
  shade:new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2),
 };
 private readonly matrix=new THREE.Matrix4();private readonly rotation=new THREE.Quaternion();private readonly euler=new THREE.Euler();
 readonly footprints:{kind:'tree'|'rock'|'brush'|'torch';x:number;y:number;radius:number}[]=[];
 private cliffDraws=0;private batchCount=0;private particleCount=0;private particleDraws=0;private instanceCount=0;

 constructor(width:number,height:number){
  this.root.name='arena-environment';this.owner.visible=false;this.root.add(this.owner);
  const hidden=new THREE.MeshBasicMaterial();for(const geometry of Object.values(this.geometries))this.owner.add(new THREE.Mesh(geometry,hidden));
  this.rocks();this.forest(width,height);this.brush();this.camps();this.wells();this.lowlands(width,height);this.flush();this.particles(width,height);
 }
 private material(color:string,glow=false){
  const key=color+glow;let material=this.materials.get(key);
  if(!material){const surface=new THREE.MeshStandardMaterial({color,roughness:.91,metalness:glow?.35:.07,flatShading:true,side:THREE.DoubleSide,emissive:glow?color:'#000000',emissiveIntensity:glow?.75:0});this.visibility.bind(surface);material=surface;this.materials.set(key,material);this.owner.add(new THREE.Mesh(this.geometries.box,material));}
  return material;
 }
 private stamp(shape:keyof ArenaScenery['geometries'],color:string,scale:V,position:V,rotation:V=[0,0,0],glow=false,worldHeight=false){
  const key=shape+color+glow;let batch=this.batches.get(key);
  if(!batch){
   let material:THREE.Material;
   if(shape==='shade'){
    material=this.materials.get('ground-shadow')??new THREE.ShaderMaterial({transparent:true,depthWrite:false,
     vertexShader:'varying vec2 vUv;void main(){vUv=uv;vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*p;}',
     fragmentShader:'varying vec2 vUv;void main(){float a=(1.-smoothstep(.05,1.,length(vUv*2.-1.)))*.46;gl_FragColor=vec4(.015,.04,.03,a);}' });
    this.materials.set('ground-shadow',material);
   }else material=this.material(color,glow);
   batch={geometry:this.geometries[shape],material,matrices:[]};this.batches.set(key,batch);
  }
  this.rotation.setFromEuler(this.euler.set(...rotation));this.matrix.compose(new THREE.Vector3(position[0],position[1]+(worldHeight?0:arenaGroundHeight(position[0],position[2])),position[2]),this.rotation,new THREE.Vector3(...scale));batch.matrices.push(this.matrix.clone());
 }
 private flush(){
  for(const [key,batch] of this.batches){const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.matrices.length);mesh.name='map-'+key;
   batch.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.computeBoundingSphere();this.root.add(mesh);this.batchCount++;this.instanceCount+=batch.matrices.length;}
  this.batches.clear();
 }
 private beam(a:V,b:V,radius:number,color:string){
  const start=new THREE.Vector3(a[0],a[1]+arenaGroundHeight(a[0],a[2]),a[2]),end=new THREE.Vector3(b[0],b[1]+arenaGroundHeight(b[0],b[2]),b[2]),delta=end.clone().sub(start),mid=start.add(end).multiplyScalar(.5);
  this.rotation.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());this.euler.setFromQuaternion(this.rotation);
  this.stamp('rod',color,[radius,delta.length(),radius],mid.toArray(),[this.euler.x,this.euler.y,this.euler.z],false,true);
 }
 private rocks(){
  const cliffs=createArenaCliffs();this.cliffDraws=cliffs.children.length;this.root.add(cliffs);
  cliffs.traverse(node=>{if(node instanceof THREE.Mesh&&node.material instanceof THREE.MeshStandardMaterial)this.visibility.bind(node.material);});
  // Small talus, seams and foliage belong to the continuous bank, rather than
  // each collider becoming a separate large boulder.
  ROCK_TERRAIN.forEach((rock,i)=>{
   const r=rock.radius;this.footprints.push({kind:'rock',x:rock.x,y:rock.y,radius:r});
   this.stamp('shade','shadow',[r*1.3,1,r*1.2],[rock.x,-.35,rock.y]);
   for(let j=0;j<2;j++){
    const a=j*2.1+i*1.4;
    this.stamp('stone',j?'#70786c':'#4c5b53',[r*.20,r*.13,r*.17],[rock.x+Math.cos(a)*r*.62,1.5,rock.y+Math.sin(a)*r*.62],[.18,a,.12]);
   }
  });
 }
 private forest(width:number,height:number){
  for(let i=0;i<140;i++){
   const side=i%2,row=Math.floor(i/2)%2,x=20+Math.floor(i/4)*(width-40)/34+(noise(i+80)-.5)*26,z=side?height+57+noise(i)*28+row*51:-48-noise(i)*30-row*51;
   const h=49+noise(i+10)*39,r=18+noise(i+20)*13,red=x>width*.6;
   this.footprints.push({kind:'tree',x,y:z,radius:r});
   this.stamp('shade','shadow',[r*1.4,1,r*1.2],[x,-1.2,z]);
   this.stamp('rod',red?'#584738':'#4d5140',[5,h,5],[x,h/2,z],[0,i,.04]);
   // Three branch clusters retain the canopy while keeping the established instance budget.
   for(let j=0;j<3;j++){
    const a=j*Math.PI*2/3+noise(i)*3,tip:V=[x+Math.cos(a)*r*.65,h*.77+j*2,z+Math.sin(a)*r*.65];
    this.beam([x,h*.48,z],tip,2.2,red?'#584738':'#4d5140');
    this.stamp('crown',red?(j%2?'#495541':'#62634a'):(j%2?'#527450':'#365f46'),[r*.78,r*.56,r*.8],tip,[0,a,.1]);
    this.beam([x,3,z],[x+Math.cos(a)*12,1,z+Math.sin(a)*12],2.6,'#454c3b');
   }
   this.stamp('crown',red?'#6b7050':'#69845a',[r*.74,r*.57,r*.75],[x,h+5,z],[0,i,.2]);
  }
 }
 private brush(){
  ARAM_BUSHES.forEach((b,i)=>{
   this.footprints.push({kind:'brush',x:b.x,y:b.y,radius:Math.max(b.width,b.height)/2});
   this.stamp('shade','shadow',[b.width*.52,1,b.height*.55],[b.x,-.35,b.y]);
   for(let j=0;j<55;j++){
    const a=j*2.399963,r=Math.sqrt((j+.5)/55)*.82,x=b.x+Math.cos(a)*b.width*.5*r,z=b.y+Math.sin(a)*b.height*.5*r;
    this.stamp('leaf',j%3?'#587947':'#829456',[6,13+noise(j+i*55)*10,1],[x,0,z],[.1,a,Math.sin(j)*.3]);
    if(j%4===0)this.stamp('crown','#42684a',[6,5,4],[x,6,z],[0,a,0]);
   }
   // A sparse low leaf/root fringe follows the exact concealment ellipse.
   for(let j=0;j<20;j++){
    const a=j*Math.PI/10,x=b.x+Math.cos(a)*b.width*.49,z=b.y+Math.sin(a)*b.height*.49;
    this.stamp('leaf',j%3?'#72814c':'#829456',[3,6,1],[x,.1,z],[.16,-a,.12]);
   }
  });
 }
 private brazier(rock:(typeof ROCK_TERRAIN)[number],color:string){
  const ring=CAMP_ROCK_RINGS.find(r=>r.id===rock.campId);
  const h=(ring?.stones===16?43:31)+8,x=rock.x,z=rock.y;this.footprints.push({kind:'torch',x,y:z,radius:5});
  this.stamp('rod','#454443',[2.5,h-1,2.5],[x,(h-1)/2,z]);this.stamp('disc','#a18b63',[5,3,5],[x,h,z]);
  this.stamp('shard',color,[2.8,7,2.8],[x,h+4,z],[0,0,.08],true);
  for(let i=0;i<4;i++){const a=i*Math.PI*.5;this.stamp('rod','#76664d',[.8,7,.8],[x+Math.cos(a)*4,h+2,z+Math.sin(a)*4],[Math.sin(a)*.35,0,-Math.cos(a)*.35]);}
  this.emitters.push({x,y:h+4,z,color});
 }
 private camps(){
  CAMP_ROCK_RINGS.forEach((ring,ringIndex)=>{
   const boss=ring.stones===16,volcanic=ring.id==='dragon_boss';
   const frost=ring.id.includes('blue_buff')||ring.id.includes('golem');
   const color=arenaCampArt(ring.id).accent;
   // Bare soil and roots replace the old fitted floor tiles.
   const stones=ROCK_TERRAIN.filter(r=>r.campId===ring.id);
   const entranceGap=(rock:(typeof stones)[number])=>{const a=Math.atan2(rock.y-ring.y,rock.x-ring.x)-ring.entrance;return Math.abs(Math.atan2(Math.sin(a),Math.cos(a)));};
   const gate=stones.slice().sort((a,b)=>entranceGap(a)-entranceGap(b)).slice(0,2);
   gate.forEach(rock=>{
    this.brazier(rock,color);
    const angle=Math.atan2(rock.y-ring.y,rock.x-ring.x),crest=campCliffCrest(ring,angle,ringIndex);
    for(let j=0;j<3;j++)this.stamp('box','#b2aa87',[7,1.2,3],
     [rock.x+Math.sin(angle)*(j-1)*3,crest+.5,rock.y-Math.cos(angle)*(j-1)*3],[0,-angle,0]);
   });
   stones.forEach((rock,i)=>{
    const a=Math.atan2(rock.y-ring.y,rock.x-ring.x),r=rock.radius,crest=campCliffCrest(ring,a,ringIndex);
    // Root tangles sit on actual blocking banks, leaving the real entrance open.
    const rootMid:V=[rock.x-Math.cos(a)*r*.32+Math.sin(a)*3,crest*.57,rock.y-Math.sin(a)*r*.32-Math.cos(a)*3];
    this.beam([rock.x,crest+1,rock.y],rootMid,2.5,'#65543b');
    this.beam(rootMid,[rock.x-Math.cos(a)*r*.72,2,rock.y-Math.sin(a)*r*.72],1.7,'#65543b');
    if(i%2===0)this.beam(rootMid,[rock.x+Math.sin(a)*r*.55,3,rock.y-Math.cos(a)*r*.55],1.2,'#65543b');
    const backAngle=Math.abs(Math.atan2(Math.sin(a-ring.entrance),Math.cos(a-ring.entrance)));
    if(i%3===0&&backAngle>2.1){
     this.stamp('rod','#61563f',[1.6,14,1.6],[rock.x,crest+7,rock.y]);
     for(let tier=0;tier<3;tier++)this.stamp('pine',tier%2?'#4a6a4e':'#355c49',[9-tier*1.5,14-tier*2,9-tier*1.5],[rock.x,crest+13+tier*5,rock.y],[0,a,0]);
    }
    for(let j=0;j<2;j++)this.stamp('leaf',j?'#768b4d':'#4b7040',[8,15+j*4,1],[rock.x+Math.sin(a)*j*4,crest-2,rock.y-Math.cos(a)*j*4],[.25,a+j,.4]);
    if(i%3===0){
     if(frost||volcanic){
      for(let j=0;j<3;j++)this.stamp('shard',color,[3,8+j*3,3],[rock.x+(j-1)*4,crest+3,rock.y],[.1,a,j*.15],true);
     }else{
      this.stamp('rod','#d7c6a0',[1.2,13,1.2],[rock.x,crest+2,rock.y],[.5,a,.8]);
      this.stamp('crown',ring.id.includes('drake')?'#b48163':'#c1b59a',[5,3,4],[rock.x,crest+6,rock.y],[0,a,0]);
     }
    }
    if(i%2===0){
     this.stamp('rod','#d9cba0',[.8,4,.8],[rock.x+4,crest+1,rock.y]);
     this.stamp('crown',boss?'#b79762':'#c3926c',[3,1.5,3],[rock.x+4,crest+4,rock.y]);
    }
   });
   const back=ring.entrance+Math.PI,bx=ring.x+Math.cos(back)*ring.radius*.56,bz=ring.y+Math.sin(back)*ring.radius*.56;
   if(ring.id.includes('wolves')){
    for(let i=0;i<6;i++){
     const a=i*1.1;
     this.stamp('rod','#c5bea1',[1.2,9,1.2],[bx+Math.cos(a)*16,1.5,bz+Math.sin(a)*9],[Math.PI/2,a,.2]);
    }
    this.stamp('shade','shadow',[26,1,19],[bx,0,bz]);
    this.beam([bx-15,4,bz],[bx+15,5,bz+5],4,'#5d5143');
   }else if(ring.id.includes('drake')||ring.id.includes('red_buff')){
    this.stamp('ring','#67523b',[18,13,18],[bx,1,bz],[Math.PI/2,0,0]);
    for(let i=0;i<5;i++){
     const a=i*Math.PI*.4;
     this.beam([bx+Math.cos(a)*12,1,bz+Math.sin(a)*10],[bx+Math.cos(a+1)*15,1,bz+Math.sin(a+1)*12],.8,'#8b7850');
    }
    for(let i=0;i<3;i++)this.stamp('crown',i%2?'#b8ae88':'#8d8e78',[3,5,3],[bx+(i-1)*6,4,bz+(i%2)*4],[0,i,.2]);
   }else if(ring.id.includes('behemoth')){
    this.beam([bx-17,3,bz-6],[bx+15,6,bz+4],7,'#5b5740');
    for(let i=0;i<5;i++){
     this.stamp('rod','#b5ae7b',[1,4,1],[bx-10+i*5,7,bz]);
     this.stamp('crown','#a99867',[3,1.4,3],[bx-10+i*5,10,bz]);
    }
   }
   if(boss){
    // Ruined guardian pillars are rooted on the back wall, away from its opening.
    const rear=stones.filter(rock=>Math.abs(Math.atan2(Math.sin(Math.atan2(rock.y-ring.y,rock.x-ring.x)-ring.entrance),Math.cos(Math.atan2(rock.y-ring.y,rock.x-ring.x)-ring.entrance)))>2.4);
    for(const rock of [rear[0],rear[rear.length-1]])if(rock){
     const top=campCliffCrest(ring,Math.atan2(rock.y-ring.y,rock.x-ring.x),ringIndex);
     this.stamp('box','#738079',[10,5,10],[rock.x,top+2,rock.y]);
     this.stamp('box','#858c7a',[6,22,6],[rock.x,top+15,rock.y],[.04,ringIndex*.3,.06]);
     this.stamp('box','#b9aa82',[11,4,10],[rock.x,top+28,rock.y],[.04,ringIndex*.3,.06]);
     this.stamp('shard',volcanic?'#c4a46f':'#829d8f',[2,6,1.2],[rock.x,top+16,rock.y+3.2],[0,0,0],true);
    }
    for(let i=0;i<12;i++){
     const a=i*Math.PI/6;
     this.stamp('box','#727c70',[9,.9,5],[ring.x+Math.cos(a)*ring.radius*.49,.2,ring.y+Math.sin(a)*ring.radius*.49],[0,-a,.03]);
    }
   }
   this.campLandmark(ring,ringIndex,stones);
  });
 }
 private campLandmark(ring:(typeof CAMP_ROCK_RINGS)[number],index:number,stones:typeof ROCK_TERRAIN){
  // Each silhouette grows from one real rear-bank collider. No decoration spans
  // a camp opening or invents a second wall in the walkable clearing.
  const back=ring.entrance+Math.PI;
  const gap=(rock:(typeof ROCK_TERRAIN)[number])=>{
   const delta=Math.atan2(rock.y-ring.y,rock.x-ring.x)-back;
   return Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)));
  };
  const rock=stones.slice().sort((a,b)=>gap(a)-gap(b))[0];if(!rock)return;
  const angle=Math.atan2(rock.y-ring.y,rock.x-ring.x),crest=campCliffCrest(ring,angle,index);
  const art=arenaCampArt(ring.id),tangent=[-Math.sin(angle),Math.cos(angle)],radial=[Math.cos(angle),Math.sin(angle)];
  const at=(t:number,h:number,d=0):V=>[rock.x+tangent[0]*t+radial[0]*d,crest+h,rock.y+tangent[1]*t+radial[1]*d];
  const part=(shape:keyof ArenaScenery['geometries'],color:string,scale:V,t:number,h:number,d=0,tilt=0,glow=false)=>
   this.stamp(shape,color,scale,at(t,h,d),[0,Math.PI/2-angle,tilt],glow);
  const link=(a:V,b:V,r:number,color:string)=>this.beam(at(...a),at(...b),r,color);
  part('stone',art.stone,[12,3,9],0,2);
  if(art.family==='azure'){
   // A split rune obelisk: broad stone shoulders and one quiet inset crystal.
   part('box',art.stone,[10,21,7],-4,13,0,-.10);
   part('box',art.stone,[6,16,6],6,10,1,.13);
   part('box','#b2aa87',[13,3,9],-4,24,0,-.10);
   part('shard',art.accent,[2.4,7,1.5],-4,14,-4,0,true);
   for(let i=0;i<3;i++)part('box','#b2aa87',[3,1,1],-4,6+i*3,-4.1);
  }else if(art.family==='frost'){
   // Uneven swept blades distinguish Frost Sentinel from the rune camps.
   for(let i=0;i<3;i++){
    const h=[8,14,10][i];
    part('shard',art.stone,[4,h+2,4],(i-1)*6,h+2,0,(i-1)*-.19);
    part('shard',art.accent,[2,h,2],(i-1)*6,h+4,-1,(i-1)*-.19);
   }
  }else if(art.family==='shadow'){
   // Forked deadwood and a small hanging tooth; no dark portal across the mouth.
   link([-7,1,0],[-3,21,1],3.2,'#5d5143');
   link([-3,21,1],[9,29,0],2.1,'#5d5143');
   link([-3,18,1],[-11,27,-1],1.6,'#5d5143');
   link([4,25,0],[6,15,-1],.6,'#8b7850');
   part('shard','#c5bea1',[1.5,4,1.2],6,12,-1,.14);
   part('crown',art.stone,[5,3,4],-5,2,-5);
   for(let i=0;i<3;i++)part('crown',art.accent,[2.3,.9,2],-8+i*5,4,-5);
  }else if(art.family==='hollow'){
   // A hollow fallen trunk with shelf fungi, rather than another crystal shrine.
   link([-10,6,0],[10,9,0],6,'#5d5143');
   part('disc','#ab9366',[4.4,.6,4.4],10,9,0,Math.PI/2);
   part('disc','#3f4334',[2.5,.7,2.5],10.5,9,0,Math.PI/2);
   for(let i=0;i<4;i++){
    part('rod','#b5ae7b',[.9,6+i%2*3,.9],-8+i*5,11+i%2,-3);
    part('crown',art.accent,[4,1.2,3],-8+i*5,15+i%2*3,-3);
   }
   link([-8,7,0],[-12,20,1],1.4,'#5d5143');
  }else if(art.family==='ember'){
   // Low hooked ribs and scale plates frame an amber nest on the rear ledge.
   for(const side of [-1,1]){
    link([side*10,1,1],[side*12,12,0],2.2,'#82705c');
    link([side*12,12,0],[side*6,20,0],1.6,'#b8ae88');
    part('shard',art.stone,[4,7,2],side*6,5,-4,side*.45);
   }
   for(let i=0;i<3;i++)part('crown',i%2?art.accent:'#b8ae88',[2.5,4,2.5],-5+i*5,5,-1);
  }else if(art.family==='siege'){
   // A broken stepped guardian relief echoes the Siege Golem's heavy shoulders.
   part('box',art.stone,[20,4,12],0,4);
   part('box',art.stone,[13,16,9],0,14);
   for(const side of [-1,1])part('box','#858c7a',[7,9,10],side*9,15,0,side*.14);
   part('stone','#b2aa87',[6,6,5],0,25);
   part('shard',art.accent,[2.3,4,1.3],0,15,-5,0,true);
   part('box','#454c46',[8,1.1,1],0,26,-4.5);
  }else{
   // Embermaw's basalt crown and ribs sit on its rear bank, leaving the mouth open.
   for(let i=0;i<5;i++){
    const h=8+(2-Math.abs(i-2))*3;
    part('shard',art.stone,[3,h,3],(i-2)*5,h,1,(i-2)*-.12);
   }
   for(const side of [-1,1]){
    link([side*9,3,-4],[side*12,16,-3],1.8,'#b8ae88');
    link([side*12,16,-3],[side*7,23,-2],1.1,'#b8ae88');
   }
   part('shard',art.accent,[1.4,6,1],0,12,-3.5,0,true);
  }
 }
 private wells(){
  for(const team of ['blue','red'] as const){
   const x=WELL_X[team],dir=team==='blue'?1:-1,accent=team==='blue'?'#6ecfd4':'#dc8b9b';
   const roof=team==='blue'?'#536b72':'#825961';
   // A modest healing lantern stands in a lived-in stone courtyard.
   this.stamp('disc','#a89d7e',[18,2,18],[x,1,HEALING_SHRINE_Y]);
   this.stamp('box','#566d58',[12,9,12],[x,6,HEALING_SHRINE_Y]);
   this.stamp('rod','#c0ac79',[2.8,21,2.8],[x,19,HEALING_SHRINE_Y]);
   this.stamp('shard',accent,[7,13,7],[x,35,HEALING_SHRINE_Y],[0,.4,0],true);
   this.stamp('roof','#897955',[13,6,13],[x,49,HEALING_SHRINE_Y],[0,Math.PI/4,0]);
   for(const side of [-1,1]){
    const z=380+side*193,hx=x+dir*16;
    // Timber, plaster, steep roof, lit windows and a little entrance awning.
    this.stamp('box','#b7ad8c',[48,29,38],[hx,15,z]);
    this.stamp('roof',roof,[43,23,36],[hx,40,z],[0,Math.PI/4,0]);
    this.stamp('box','#6b5840',[5,31,5],[hx-21,16,z+17]);
    this.stamp('box','#6b5840',[5,31,5],[hx+21,16,z+17]);
    this.stamp('box','#6b5840',[48,3,3],[hx,28,z+20]);
    this.stamp('arch','#66543c',[13,22,1],[hx,1,z+19.2]);
    for(const dx of [-15,15]){
     this.stamp('arch','#edc785',[8,10,1],[hx+dx,14,z+19.4],[0,0,0],true);
     this.stamp('box','#786345',[1.1,10,1.2],[hx+dx,18,z+20]);
     this.stamp('box','#786345',[8,1.1,1.2],[hx+dx,18,z+20]);
    }
    this.stamp('box','#777568',[8,22,8],[hx-15,45,z-5]);
    this.stamp('box','#ada28a',[11,3,11],[hx-15,57,z-5]);
    this.stamp('box','#958663',[31,2,18],[hx,2,z+26]);
    for(const dx of [-18,18])this.stamp('rod','#7a6546',[1.7,23,1.7],[hx+dx,11,z+30]);
    this.stamp('box',roof,[42,2,18],[hx,25,z+25],[.13,0,0]);
    // Low planters, flowers, stacked provisions and a bench give the base scale.
    for(const dx of [-31,31]){
     this.stamp('box','#7c7459',[11,5,17],[hx+dx,3,z+10]);
     this.stamp('crown','#617b4f',[6,4,9],[hx+dx,6,z+10]);
     for(let i=0;i<3;i++)this.stamp('crown',i%2?'#c9af83':accent,[1.4,1.3,1.4],[hx+dx+(i-1)*3,10,z+10]);
    }
    this.stamp('box','#8b7350',[26,2.5,9],[hx+dir*54,7,z+12]);
    for(const dx of [-9,9])this.stamp('box','#66583f',[3,8,7],[hx+dir*54+dx,3,z+12]);
    for(let i=0;i<3;i++){
     const cx=hx+dir*(43+i*9),cz=z-13;
     this.stamp('box','#806c4b',[8,8,8],[cx,4,cz],[0,i*.2,0]);
     this.stamp('box','#b49a65',[9,1.2,1.2],[cx,7,cz],[0,i*.2,0]);
    }
   }
   // A cloth merchant stall and a small warm brazier, away from the spawn route.
   const sx=x+dir*44,sz=485;
   for(const dx of [-15,15])for(const dz of [-10,10])this.stamp('rod','#7d6747',[1.4,24,1.4],[sx+dx,12,sz+dz]);
   for(let i=0;i<5;i++)this.stamp('box',i%2?'#d0ba8b':roof,[7,2,29],[sx-14+i*7,27,sz],[.08,0,0]);
   this.stamp('box','#9c8055',[34,10,16],[sx,6,sz]);
   for(let i=0;i<4;i++)this.stamp('shard',i%2?'#dfba75':accent,[2,3,2],[sx-10+i*7,13,sz],[0,i,0],true);
   for(const z of [292,468]){
    const lx=x+dir*42;
    this.stamp('rod','#5a5543',[1.8,27,1.8],[lx,13,z]);
    this.stamp('box','#d1a56a',[6,7,6],[lx,27,z],[0,0,0],true);
    this.stamp('roof','#7d7054',[7,5,7],[lx,33,z],[0,Math.PI/4,0]);
   }
  }
 }
 private lowlands(width:number,height:number){
  // Ferns and flowers have low silhouettes; dense concealing plants stay in real brush.
  for(let i=0;i<620;i++){
   const x=LANDSCAPE.left+noise(i+100)*(LANDSCAPE.right-LANDSCAPE.left),z=24+noise(i+400)*(height-48);
   if(lowlandRegionDistance(x,z)>-14)continue;
   if(Math.min(Math.abs(z-(174+Math.sin(x*.006)*13)),Math.abs(z-(584+Math.sin(x*.006)*13)))<19)continue;
   if(CAMP_ROCK_RINGS.some(r=>Math.hypot(x-r.x,z-r.y)<r.radius*.82)||ROCK_TERRAIN.some(r=>Math.hypot(x-r.x,z-r.y)<r.radius+5))continue;
   for(let j=0;j<3;j++)this.stamp('leaf',j%2?'#72814c':'#45694b',[3,5+j*1.3,1],[x+j*1.5,.1,z+j],[.35,i+j,.4]);
   if(i%7===0){
    this.stamp('rod','#6b7846',[.7,5,.7],[x,2.5,z]);
    this.stamp('crown',i%2?'#bdb38c':'#9aa9bd',[1.7,1.1,1.7],[x,5,z]);
   }
   if(i%11===0)this.stamp('stone','#6a7460',[3,1.4,2],[x+6,1,z+3],[0,i,.2]);
  }
  // Fallen timber, carved fragments and vines rest on existing blocking banks.
  ROCK_TERRAIN.filter((_,i)=>i%9===0).forEach((rock,i)=>{
   const ring=CAMP_ROCK_RINGS.find(r=>r.id===rock.campId);
   const index=ring?CAMP_ROCK_RINGS.indexOf(ring):0;
   const top=ring?campCliffCrest(ring,Math.atan2(rock.y-ring.y,rock.x-ring.x),index):19;
   if(i%2){
    this.beam([rock.x-7,top+1,rock.y-2],[rock.x+8,top+3,rock.y+3],3.2,'#6a5b40');
    this.stamp('disc','#ab9366',[2.7,1,2.7],[rock.x+8,top+3,rock.y+3],[Math.PI/2,0,Math.PI/2]);
   }else{
    this.stamp('box','#808476',[6,13,5],[rock.x,top+6,rock.y],[.10,i,.09]);
    this.stamp('box','#b2aa87',[7,2,6],[rock.x,top+13,rock.y],[.10,i,.09]);
    this.stamp('leaf','#6d8151',[5,11,1],[rock.x+2,top+2,rock.y+3],[0,i,.4]);
   }
  });
  // Paired waystones identify the broad ramps, with no gate or new blocker.
  for(const north of [true,false])for(const x of north?RIDGE_RAMPS.north:RIDGE_RAMPS.south){
   const edge=stoneLaneEdges(x),z=north?edge.top-18:edge.bottom+18;
   for(const side of [-1,1]){
    const px=x+side*37;
    this.stamp('box','#7b8170',[8,6,8],[px,3,z],[0,.2*side,0]);
    this.stamp('box','#b2a778',[8,1.5,8],[px,6.5,z],[0,.2*side,0]);
    this.stamp('shard',x<width/2?'#73bdb2':'#c4a487',[2,4,2],[px,10,z],[0,0,0],true);
   }
   // Broken edge chips follow the slope; the broad ramp center remains open.
   for(let step=0;step<6;step++)for(const side of [-1,1]){
    const px=x+side*22,pz=(north?edge.top:edge.bottom)+(north?-1:1)*(8+step*11);
    this.stamp('box','#b2aa87',[5,.8,2.5],[px,.15,pz],[0,step%2*.08,0]);
   }
  }
 }
 private cloud(kind:number,origins:Emitter[],count:number,size:number,additive:boolean){
  const positions=new Float32Array(count*3),data=new Float32Array(count*3),colors=new Float32Array(count*3),color=new THREE.Color();
  for(let i=0;i<count;i++){
   const p=origins[i%origins.length],spread=kind===1?5:kind===3?10:1;
   positions.set([p.x+(noise(i+4)-.5)*spread,p.y+arenaGroundHeight(p.x,p.z),p.z+(noise(i+8)-.5)*spread],i*3);
   data.set([noise(i+kind*547),size*(.75+noise(i+5)*.5),0],i*3);color.set(p.color);colors.set(color.toArray(),i*3);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aData',new THREE.BufferAttribute(data,3));geometry.setAttribute('aColor',new THREE.BufferAttribute(colors,3));
  const material=new THREE.ShaderMaterial({uniforms:{uTime:this.time,uKind:{value:kind}},vertexShader:particleVertex,fragmentShader:particleFragment,transparent:true,depthWrite:false,depthTest:true,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});
  const points=new THREE.Points(geometry,material);points.name=['map-embers','map-fireflies','map-smoke','map-leaves','map-flames','map-well-motes'][kind];points.frustumCulled=false;points.renderOrder=1;this.root.add(points);this.particleCount+=count;this.particleDraws++;
 }
 private particles(width:number,height:number){
  this.cloud(0,this.emitters,160,3.5,true);this.cloud(4,this.emitters,60,19,true);
  this.cloud(2,this.emitters.map(p=>({...p,y:p.y+5,color:'#747e76'})),80,31,false);
  const flies=ARAM_BUSHES.flatMap(b=>Array.from({length:5},(_,i)=>({x:b.x+(noise(i+b.x)-.5)*b.width,y:13+noise(i)*10,z:b.y+(noise(i+30)-.5)*b.height,color:i%2?'#b9cf86':'#78c6ad'})));
  this.cloud(1,flies,110,3.2,true);
  const leaves=Array.from({length:80},(_,i)=>({x:noise(i+22)*width,y:4,z:i%4<2?(i%2?height-18:18):(i%2?575:170),color:i%3?'#a2ae6c':'#c5a271'}));
  this.cloud(3,leaves,120,7,false);
  this.cloud(5,(['blue','red'] as const).map(team=>({x:WELL_X[team],y:19,z:HEALING_SHRINE_Y,color:team==='blue'?'#8ddaf0':'#f2a9bb'})),36,2.6,true);
 }
 decorateStructure(parent:THREE.Group,structure:Pick<LaneStructure,'type'|'team'>){
  const nexus=structure.type==='nexus',barracks=structure.type==='barracks',team=structure.team,color=team==='blue'?'#58bbd1':'#ce7185';
  const r=nexus?42:barracks?23:24,top=nexus?65:barracks?29:67;
  const columns=new THREE.InstancedMesh(this.geometries.box,this.material('#6c7875'),4);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;this.matrix.compose(new THREE.Vector3(Math.cos(a)*r*.84,top*.45,Math.sin(a)*r*.84),this.rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),-a),new THREE.Vector3(8,top*.8,10));columns.setMatrixAt(i,this.matrix);}parent.add(columns);
  const trim=new THREE.InstancedMesh(this.geometries.ring,this.material('#b6a680'),3);
  for(let i=0;i<3;i++){this.matrix.compose(new THREE.Vector3(0,8+i*(top-8)/2,0),this.rotation.setFromEuler(this.euler.set(Math.PI/2,0,0)),new THREE.Vector3(r-2,r-2,r-2));trim.setMatrixAt(i,this.matrix);}parent.add(trim);
  if(!barracks){
   const key='banner-'+team;let material=this.materials.get(key);
   if(!material){
    material=new THREE.ShaderMaterial({uniforms:{uTime:this.time,uColor:{value:new THREE.Color(color)}},side:THREE.DoubleSide,
     vertexShader:'uniform float uTime;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.z+=sin(uTime*2.+uv.y*5.)*pow(1.-uv.y,1.4)*2.;vec4 q=vec4(p,1.);\n#ifdef USE_INSTANCING\nq=instanceMatrix*q;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*q;}',
     fragmentShader:'uniform vec3 uColor;varying vec2 vUv;void main(){float edge=step(vUv.x,.08)+step(.92,vUv.x);float sig=1.-smoothstep(.18,.22,abs(vUv.x-.5)+abs(vUv.y-.6)*.6);vec3 c=mix(uColor*.65,vec3(.72,.64,.43),clamp(edge+sig,0.,1.));gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
    this.materials.set(key,material);this.owner.add(new THREE.Mesh(this.geometries.banner,material));
   }
   const flags=new THREE.InstancedMesh(this.geometries.banner,material,2);
   for(let i=0;i<2;i++){this.matrix.compose(new THREE.Vector3((i?1:-1)*r*.66,top-5,r*.7),new THREE.Quaternion(),new THREE.Vector3(1,1,1));flags.setMatrixAt(i,this.matrix);}parent.add(flags);
  }
 }
 update(second:number){this.time.value=Math.max(0,Number.isFinite(second)?second:0);}
 stats(){return {staticBatches:this.batchCount,cliffMeshes:this.cliffDraws,instances:this.instanceCount,particleDraws:this.particleDraws,particles:this.particleCount};}
}
