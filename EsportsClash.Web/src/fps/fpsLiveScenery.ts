import { MeshBuilder, Mesh, Vector3, StandardMaterial, Color3, DynamicTexture, type Scene } from '@babylonjs/core';
import { liveBoxSurfaceUV, LIVE_SURFACE_BOX_WRAP, LIVE_SURFACE_METRES, type LiveSurface, type LiveSurfaceLibrary } from './fpsLiveGraphics.ts';
import { LIVE_B_APARTMENTS, LIVE_BRIDGE, LIVE_RIVER, LIVE_CANAL_BANK, liveCutPavingRect } from './fpsLiveTerrain.ts';
import { buildVillageArchitecture } from './fpsVillageArchitecture.ts';
import { buildCanalWaterfront } from './fpsCanalWaterfront.ts';
import { buildMidWindowScenery } from './fpsMidWindowScenery.ts';
import {batchStaticLiveGeometry} from './fpsLiveRenderOptimization.ts';
import {MERCATO_GATE} from './fpsVillageMercato.ts';
import {buildVillageDetails} from './fpsVillageDetails.ts';

export const LIVE_FESTOON_SPANS = [
  { id:'banana-south', from:{x:14.04,y:5.1,z:-14}, to:{x:33.49,y:4.7,z:-14}, sag:.68 },
  { id:'banana-mid', from:{x:14.04,y:5.1,z:-6}, to:{x:21.96,y:4.7,z:-6}, sag:.68 },
  // Over the Mercato gate; shallow enough that the bulbs clear its roof-terrace balustrade and flower box.
  { id:'banana-north', from:{x:16.04,y:4.85,z:7.65}, to:{x:20.96,y:4.85,z:7.65}, sag:.36 },
  { id:'fountain-gallery', from:{x:16.04,y:4.25,z:15}, to:{x:30.4,y:4.25,z:15}, sag:.42 },
  { id:'mid-pizzeria', from:{x:-2.0,y:5.05,z:-13.5}, to:{x:3.0,y:5.15,z:-13.5}, sag:.38 },
] as const;
export function liveFestoonCablePoint(span:typeof LIVE_FESTOON_SPANS[number],t:number):Vector3 {
  return new Vector3(span.from.x+(span.to.x-span.from.x)*t,
    span.from.y+(span.to.y-span.from.y)*t-4*span.sag*t*(1-t),span.from.z+(span.to.z-span.from.z)*t);
}

/** Original Fontessa village: public market, civic courtyard and residential streets. */
/** `batch: false` keeps every piece as its own named mesh (visual/collision audits); rendering always batches. */
export function buildLiveScenery(scene:Scene,material:(color:string)=>StandardMaterial,surfaces?:LiveSurfaceLibrary,options:{batch?:boolean}={}):Mesh[] {
  const details:Mesh[]=[];
  const detailMesh=<T extends Mesh>(mesh:T,color:string)=>{
    mesh.material=material(color);mesh.isPickable=false;mesh.receiveShadows=true;details.push(mesh);return mesh;
  };
  const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{
    const kind:LiveSurface|undefined=/tile-roof|terracotta-eave|ridge|chimney-pot|coping/.test(name)?'clay':/door-board|crossbar|crate|gallery|balcony|side-shutter|side-slat|shutter-\d|shutter--1|rafter|corbel|door-leaf/.test(name)?'timber'
      :/arch-|loggia-|plinth|capital|side-sill|side-frame|mortar|quoin|stringcourse|cornice|pilaster|window-frame|door-surround|door-cornice|window-sill|edicola|chimney-shaft|chimney-cap/.test(name)?'stone':undefined;
    const mesh=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d,...(kind?{faceUV:liveBoxSurfaceUV(w,h,d,LIVE_SURFACE_METRES[kind]),wrap:LIVE_SURFACE_BOX_WRAP}:{})},scene);
    mesh.position.set(x,y,z);mesh.material=kind&&surfaces?surfaces.material(kind,color):material(color);
    mesh.isPickable=false;mesh.receiveShadows=true;details.push(mesh);return mesh;
  };

  buildVillageArchitecture(scene,{box,detail:detailMesh},material,surfaces);
  buildCanalWaterfront(scene,{box,detail:detailMesh},surfaces);
  buildMidWindowScenery(scene,{box,detail:detailMesh});
  buildVillageDetails(scene,{box,detail:detailMesh},surfaces);

  // The attackers start in an actual dining room with a clear central departure aisle.
  // Beams sit flush under the 4.4 m roof slab; lamp cables run from it.
  box('trattoria-ceiling-beam',0,4.31,-31.5,18,.18,.2,'#69503a');
  box('trattoria-ceiling-beam-rear',0,4.31,-37,18,.18,.2,'#69503a');
  for(const side of [-1,1]){
    const x=side*6,z=-37;
    box(`trattoria-table-top-${side}`,x,.8,z,1.7,.08,1.2,'#8d6848');
    for(const sx of [-1,1])for(const sz of [-1,1])box(`trattoria-table-leg-${side}-${sx}-${sz}`,x+sx*.7,.38,z+sz*.45,.08,.76,.08,'#65503b');
    for(const seat of [-1,1]){
      const plate=detailMesh(MeshBuilder.CreateCylinder(`trattoria-plate-${side}-${seat}`,{height:.018,diameter:.32,tessellation:20},scene),'#e1dcc7');plate.position.set(x+seat*.45,.853,z);
      const cup=detailMesh(MeshBuilder.CreateCylinder(`trattoria-cup-${side}-${seat}`,{height:.14,diameter:.1,tessellation:12},scene),'#c1b692');cup.position.set(x+seat*.45,.914,z+.27);
      box(`trattoria-stool-${side}-${seat}`,x+seat*.5,.24,z+.42,.34,.48,.34,'#786248');
    }
    const cable=detailMesh(MeshBuilder.CreateCylinder(`trattoria-lamp-cable-${side}`,{height:1.12,diameter:.014,tessellation:6},scene),'#3e4340');cable.position.set(side*3,3.84,-36);
    const shade=detailMesh(MeshBuilder.CreateCylinder(`trattoria-lamp-shade-${side}`,{height:.2,diameterTop:.12,diameterBottom:.4,tessellation:16},scene),'#a18550');shade.position.set(side*3,3.23,-36);
  }
  // Original Jade Lantern frontage: brick piers, jade tile eave and gold lettering.
  /**
   * Painted shop sign: a solid backing board (reads as the frame) with separate, correctly oriented
   * lettering faces on the front and back. Text is never mapped onto the box itself, which mirrored it on
   * the back and turned it sideways or upside down on the edges. The canvas matches the sign's real
   * proportions so lettering is not stretched.
   */
  const paintedSign=(name:string,text:string,x:number,y:number,z:number,w:number,h:number,bg:string,fg:string)=>{
    const texW=1024,texH=Math.max(64,Math.min(1024,Math.round(texW*h/w)));
    const texture=new DynamicTexture(`${name}-paint`,{width:texW,height:texH},scene,true);
    const ctx=texture.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle=bg;ctx.fillRect(0,0,texW,texH);
    // Light weathering: faint horizontal brush streaks so the paint is not a flat digital fill.
    for(let i=0;i<18;i++){
      const seed=Math.sin((i+1)*12.9898+name.length*78.233)*43758.5453,r=seed-Math.floor(seed);
      ctx.fillStyle=`rgba(${r>.5?255:0},${r>.5?255:0},${r>.5?255:0},${.025+r*.03})`;
      ctx.fillRect(0,Math.floor(r*texH),texW,Math.max(1,Math.round(texH*.02)));
    }
    const inset=Math.max(3,Math.round(texH*.07));
    ctx.strokeStyle=fg;ctx.globalAlpha=.55;ctx.lineWidth=Math.max(2,Math.round(texH*.035));
    ctx.strokeRect(inset,inset,texW-inset*2,texH-inset*2);
    ctx.globalAlpha=.3;ctx.lineWidth=Math.max(1,Math.round(texH*.012));
    ctx.strokeRect(inset*1.9,inset*1.9,texW-inset*3.8,texH-inset*3.8);ctx.globalAlpha=1;
    let fontPx=Math.round(texH*.6);
    ctx.font=`bold ${fontPx}px Georgia`;
    const fit=(texW-inset*6)/Math.max(1,ctx.measureText(text).width);
    if(fit<1){fontPx=Math.max(10,Math.floor(fontPx*fit));ctx.font=`bold ${fontPx}px Georgia`;}
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillText(text,texW/2+Math.max(1,fontPx*.04),texH/2+Math.max(1,fontPx*.05));
    ctx.fillStyle=fg;ctx.fillText(text,texW/2,texH/2);
    texture.update();texture.anisotropicFilteringLevel=8;
    const face=new StandardMaterial(`${name}-material`,scene);face.diffuseTexture=texture;face.specularColor=Color3.Black();
    const d=.035,panel=box(name,x,y,z,w,h,d,bg);
    // Own backing material (slightly darker than the paint) keeps the sign out of static batching.
    const backing=new StandardMaterial(`${name}-backing`,scene);backing.diffuseColor=Color3.FromHexString(bg).scale(.72);backing.specularColor=Color3.Black();
    panel.material=backing;
    for(const side of [-1,1]){
      const plane=MeshBuilder.CreatePlane(`${name}-face-${side<0?'front':'back'}`,{width:w*.97,height:h*.92},scene);
      plane.parent=panel;plane.position.z=side*(d/2+.006);plane.rotation.y=side<0?0:Math.PI;
      plane.material=face;plane.isPickable=false;plane.receiveShadows=true;
    }
    return panel;
  };
  paintedSign('jade-lantern-gold-sign','JADE LANTERN',0,3.87,-29.28,10.8,.72,'#293f37','#dfc38c');
  paintedSign('port-customs-name','DOGANA / PORTO FONTESSA',0,.51,43.9,6.8,.4,'#3d5c58','#e4d1a6');
  paintedSign('jade-lantern-subtitle','NOODLE HOUSE  /  FONTESSA',0,3.35,-29.24,8,.24,'#293f37','#dbcaa4');
  // Italian neighborhood shop signage & architectural landmarks across Mid and B Square.
  const pizzeriaSign=paintedSign('pizzeria-rusticanella-sign','RUSTICANELLA  •  PIZZERIA',-1.95,3.25,-15,3.8,.62,'#f2ead8','#8f392d');
  pizzeriaSign.rotation.y=Math.PI/2;
  const pizzeriaMenu=paintedSign('pizzeria-wall-menu','PIZZA  /  VINO',-1.95,1.1,-17.5,.66,.92,'#2a3531','#ede4cc');
  pizzeriaMenu.rotation.y=Math.PI/2;
  const formaggiSign=paintedSign('formaggi-market-sign','FORMAGGI  &  SALUMI',2.94,3.22,-12.5,3.6,.56,'#efe4c8','#8c3b2f');
  formaggiSign.rotation.y=Math.PI/2;
  const albergoSign=paintedSign('albergo-blade-sign','ALBERGO',-9.82,4.9,-6.2,1.1,.45,'#c64d38','#f8f1e3');
  albergoSign.rotation.z=Math.PI/2;
  box('albergo-blade-bracket',-9.92,4.9,-6.2,.24,.045,.045,'#3d4541');
  box('farmacia-cross-back',-1.96,3.15,-6.8,.05,.62,.62,'#e5decb');
  box('farmacia-cross-v',-1.92,3.15,-6.8,.04,.46,.14,'#2d7a4d');
  box('farmacia-cross-h',-1.92,3.15,-6.8,.04,.14,.46,'#2d7a4d');
  if(MERCATO_GATE){
    // Inscriptions sit just proud of each frieze (and of the keystone), not on the old floating lintel.
    const gateX=(MERCATO_GATE.minX+MERCATO_GATE.maxX)/2;
    paintedSign('mercato-arch-sign','MERCATO  DI  FONTESSA',gateX,MERCATO_GATE.signY,MERCATO_GATE.southFaceZ-.0375,3.4,.27,'#354e41','#ead8ad');
    paintedSign('mercato-arch-sign-north','SOTTOPORTICO  DEL  MERCATO',gateX,MERCATO_GATE.signY,MERCATO_GATE.northFaceZ+.0375,3.4,.27,'#354e41','#ead8ad');
  }
  // Venetian street-name boards ("nizioleti"): white paint with a dark frame, flat on the wall above head height.
  const nizioleto=(name:string,text:string,x:number,y:number,z:number,w:number,alongX=true)=>{
    const sign=paintedSign(`nizioleto-${name}`,text,x,y,z,w,.24,'#efe9dc','#2b2722');
    if(!alongX)sign.rotation.y=Math.PI/2;
    return sign;
  };
  nizioleto('fondamenta','FONDAMENTA  DEI  BARCAIOLI',13.2,2.55,5.965,1.7);
  nizioleto('campo','CAMPO  DELLA  FONTANA',26.6,2.55,14.835,1.45);
  nizioleto('forneri','CALLE  DEI  FORNERI',21.965,2.55,-8.2,1.3,false);
  nizioleto('farmacia','CALLE  DELLA  FARMACIA',-1.965,2.55,-2.95,1.0,false);
  nizioleto('corte','CORTE  DEL  COMUNE',-16.035,2.55,19.5,1.35,false);
  nizioleto('dogana','RIVA  DELLA  DOGANA',16.55,2.55,38.465,1.1);
  paintedSign('b-canal-shop-valance-sign','FRUTTA  E  VERDURA',24.45,2.43,6.511,1.9,.12,'#efe3c6','#7a3128');
  // Names over the inn wings either side of the attackers' square, and the civic guardhouse's plaques.
  paintedSign('inn-west-name','LOCANDA  DEL  PONTE',-17.965,3.05,-27,2.6,.34,'#2f4b3f','#e8d7ae').rotation.y=Math.PI/2;
  paintedSign('inn-east-name','OSTERIA  DEL  MERCATO',17.965,3.05,-27,2.6,.34,'#7a3128','#efe3c6').rotation.y=Math.PI/2;
  paintedSign('mid-window-dogana-sign','UFFICIO  DOGANALE',-3.1,2.98,16.8425,1.25,.24,'#e8e0ca','#3c4a45');
  paintedSign('guardhouse-plaque-north','GUARDIA  CIVICA',0,3.32,36.035,2.3,.3,'#e8e0ca','#3c4a45');
  paintedSign('guardhouse-plaque-south','GUARDIA  CIVICA',0,3.32,29.965,2.3,.3,'#e8e0ca','#3c4a45');
  paintedSign('trattoria-chalkboard','MENU  DEL  GIORNO',-6,1.85,-39.8,1.05,.36,'#1f2421','#e9e4d6');
  paintedSign('trattoria-chalkboard-dishes','RAGU  ·  RISOTTO  ·  TIRAMISU',-6,1.55,-39.8,1.05,.2,'#1f2421','#cfc8b6');
  // Arrival kiosk map: a painted plan of the village with the canal, the two squares and "you are here".
  {
    const texture=new DynamicTexture('village-map-board-paint',{width:512,height:412},scene,true);
    const ctx=texture.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle='#e9dfc4';ctx.fillRect(0,0,512,412);
    ctx.strokeStyle='#5b4a34';ctx.lineWidth=8;ctx.strokeRect(10,10,492,392);
    ctx.fillStyle='#cdbf9f';for(const [bx,by,bw,bh] of [[60,70,90,70],[180,60,70,110],[300,70,80,60],[400,60,60,120],[60,250,100,90],[200,250,60,80],[300,240,90,100],[410,260,50,80]])ctx.fillRect(bx,by,bw,bh);
    // Round markers where the canvas supports arcs (the CPU test canvas does not); squares otherwise.
    const dot=(cx:number,cy:number,r:number)=>{if(typeof ctx.arc==='function'){ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();}else ctx.fillRect(cx-r,cy-r,r*2,r*2);};
    ctx.fillStyle='#5f8ea0';ctx.fillRect(20,192,472,30);
    ctx.fillStyle='#4f7fa0';dot(390,300,22);
    ctx.fillStyle='#8a6a4a';ctx.fillRect(108,292,24,24);
    ctx.fillStyle='#b83a2e';dot(256,372,13);
    ctx.fillStyle='#2b2722';ctx.font='bold 34px Georgia';ctx.textAlign='center';ctx.fillText('FONTESSA',256,46);
    ctx.font='bold 18px Georgia';ctx.fillText('SEI QUI',256,350);ctx.fillText('MERCATO',390,240);ctx.fillText('COMUNE',120,240);
    texture.update();texture.anisotropicFilteringLevel=8;
    const face=new StandardMaterial('village-map-board-material',scene);face.diffuseTexture=texture;face.specularColor=Color3.Black();
    const board=box('village-map-board',-.45,1.68,-26.6155,.74,.6,.035,'#5b4a34');
    const backing=new StandardMaterial('village-map-board-backing',scene);backing.diffuseColor=Color3.FromHexString('#5b4a34');backing.specularColor=Color3.Black();board.material=backing;
    const plane=MeshBuilder.CreatePlane('village-map-board-face',{width:.7,height:.56},scene);
    plane.parent=board;plane.position.z=-(.035/2+.006);plane.material=face;plane.isPickable=false;plane.receiveShadows=true;
  }
  paintedSign('casa-dolce-vigna-sign','CASA  DOLCE  VIGNA',17.55,4.62,26.44,3.3,.46,'#e8e0ca','#5c4d3c');
  box('pizzeria-trattoria-cloth-west',-6,.843,-37,1.4,.012,1.24,'#b94c42');
  box('pizzeria-trattoria-cloth-east',6,.843,-37,1.4,.012,1.24,'#b94c42');
  for(const side of [-1,1]){
    for(let row=0;row<13;row++)for(let col=0;col<5;col++){
      const x=side*6+(col-2)*.99+(row%2?.25:0);
      box(`jade-brick-${side}-${row}-${col}`,x,.2+row*.215,-29.33,.96,.195,.05,row%3?'#a56d52':'#996044');
    }
    for(const x of [side*3.15,side*8.78])box(`jade-front-pier-${x}`,x,1.48,-29.22,.16,2.9,.17,'#354d42');
    // Display windows reveal warm shelves; they are glass, not pretend doorways.
    box(`jade-display-dark-${side}`,side*6,1.6,-29.25,4.85,1.45,.07,'#243e3c');
    for(const offset of [-2.45,0,2.45])box(`jade-display-mullion-${side}-${offset}`,side*6+offset,1.6,-29.17,.065,1.56,.075,'#b7985f');
    box(`jade-display-sill-${side}`,side*6,.85,-29.15,5.1,.15,.18,'#b79c70');
    for(let shelf=0;shelf<2;shelf++){
      box(`jade-window-shelf-${side}-${shelf}`,side*6,1.2+shelf*.55,-29.15,4.6,.045,.08,'#95744b');
      for(let bowl=0;bowl<5;bowl++){
        const vessel=detailMesh(MeshBuilder.CreateCylinder(`jade-display-bowl-${side}-${shelf}-${bowl}`,{height:.12,diameterTop:.24,diameterBottom:.14,tessellation:10},scene),'#d6c99b');
        vessel.position.set(side*6-1.65+bowl*.8,1.28+shelf*.55,-29.1);
      }
    }
    const lantern=detailMesh(MeshBuilder.CreateSphere(`jade-red-lantern-${side}`,{diameter:.48,segments:12},scene),'#a94335');lantern.scaling.y=1.25;lantern.position.set(side*3.6,2.67,-28.55);
    box(`jade-lantern-tassel-${side}`,side*3.6,2.24,-28.55,.05,.3,.05,'#c6a45b');
    box(`jade-lantern-hanger-${side}`,side*3.6,3.01,-28.55,.025,.32,.025,'#403b2f');
    const x=side*6.5,z=-26.8;
    box(`jade-outside-table-top-${side}`,x,.74,z,1.4,.08,1.2,'#84613e');
    for(const sx of [-1,1])for(const sz of [-1,1])box(`jade-outside-table-leg-${side}-${sx}-${sz}`,x+sx*.56,.35,z+sz*.46,.07,.7,.07,'#4f5547');
    for(const sx of [-1,1]){
      box(`jade-outside-bench-${side}-${sx}`,x,.43,z+sx*.5,1.25,.06,.24,'#ac8654');
      for(const dx of [-.45,.45])box(`jade-outside-bench-leg-${side}-${sx}-${dx}`,x+dx,.2,z+sx*.5,.075,.4,.18,'#4f5547');
      const bowl=detailMesh(MeshBuilder.CreateCylinder(`jade-outside-bowl-${side}-${sx}`,{height:.12,diameterTop:.24,diameterBottom:.12,tessellation:12},scene),'#dcd2b5');bowl.position.set(x+sx*.32,.85,z);
    }
  }
  // Eave tiles start at the facade's outer face; at 1.82 m they ran 15 cm through the wall into the dining room.
  for(let i=0;i<58;i++){
    const tile=detailMesh(MeshBuilder.CreateCylinder(`jade-eave-tile-${i}`,{height:1.4,diameter:.32,tessellation:8},scene),i%3?'#4d8578':'#3f6d67');
    tile.rotation.x=Math.PI/2;tile.position.set(-9.2+i*.322,3.25,-28.65);
  }
  box('jade-eave-gold-edge',0,3.08,-28,18.9,.09,.1,'#bea367');
  paintedSign('jade-street-menu','NOODLES / TEA',-10.5,1.35,-30.55,.78,.72,'#253c34','#d9c998');
  for(const side of [-1,1])box(`jade-menu-foot-${side}`,-10.5+side*.29,.56,-30.8,.06,1.12,.38,'#6e583a');

  // The lower central bridge uses one masonry vocabulary, from arch to stair cheeks.
  for(const side of [-1,1]){
    for(const [span,[a,b]] of [[LIVE_RIVER.minZ,LIVE_RIVER.maxZ],[2.9,5.6]].entries())for(let i=0;i<24;i++){
      const t=(i+.5)/24*Math.PI,half=(b-a)/2,centre=(a+b)/2,rise=span===0?2.82:.82,spring=span===0?-2.1:-.1;
      const z=centre-Math.cos(t)*half,y=spring+Math.sin(t)*rise;
      const stone=box(`bridge-arch-dressed-stone-${side}-${span}-${i}`,side*1.67,y+.055,z,.22,.22,span===0?.38:.17,i%3?'#c4b294':'#dac8a6');
      stone.rotation.x=Math.atan2(-Math.cos(t)*rise,Math.sin(t)*half);
    }
    box(`bridge-coping-river-${side}`,side*1.65,LIVE_BRIDGE.parapetY-.04,(LIVE_RIVER.minZ+LIVE_RIVER.maxZ)/2,.3,.1,LIVE_RIVER.maxZ-LIVE_RIVER.minZ+.18,'#d2bf9e');
    box(`bridge-coping-bank-${side}`,side*1.65,LIVE_BRIDGE.parapetY-.04,4.25,.3,.1,2.8,'#d2bf9e');
    for(const z of [LIVE_RIVER.minZ,2.85,5.62]){
      box(`bridge-pilaster-${side}-${z}`,side*1.66,1.45,z,.32,.9,.3,'#b3a083');
      box(`bridge-pilaster-cap-${side}-${z}`,side*1.66,1.96,z,.43,.13,.42,'#d2bf9e');
      box(`bridge-lantern-post-${side}-${z}`,side*1.66,2.14,z,.035,.24,.035,'#414a3b');
      box(`bridge-lantern-cage-${side}-${z}`,side*1.66,2.38,z,.17,.27,.17,'#4e5040');
      box(`bridge-lantern-glass-${side}-${z}`,side*1.66,2.38,z,.13,.2,.18,'#d8ac60');
      const cap=detailMesh(MeshBuilder.CreateCylinder(`bridge-lantern-roof-${side}-${z}`,{height:.1,diameterTop:0,diameterBottom:.28,tessellation:4},scene),'#47513e');cap.position.set(side*1.66,2.56,z);
    }
    box(`bridge-civic-banner-${side}`,side*1.79,1.4,-1.7,.025,.6,.72,'#834747');
    box(`bridge-civic-banner-trim-${side}`,side*1.81,1.4,-1.7,.025,.51,.045,'#c2a363');
    for(const north of [false,true])for(let i=0;i<5;i++){
      const h=(north?5-i:i+1)*.2,z=(north?5.6:LIVE_BRIDGE.southApproach)+(i+.5)*.8;
      box(`bridge-stair-coping-${side}-${north}-${i}`,side*1.7,h+.82,z,.28,.08,.81,'#d2bf9e');
      box(`bridge-stair-nosing-${side}-${north}-${i}`,0,h+.012,z-.37,3.2,.025,.07,'#d8c7a6');
    }
    for(let i=0;i<21;i++){
      const leaf=detailMesh(MeshBuilder.CreateSphere(`bridge-ivy-${side}-${i}`,{diameter:.17+(i%3)*.04,segments:5},scene),i%2?'#61794a':'#7f8c50');leaf.scaling.set(1,.4,.7);leaf.position.set(side*1.66,.98-(i%6)*.15,-1.2+Math.floor(i/6)*.34);
    }
  }
  // Waterline masonry, service inlets and restrained weathering give the quay a purpose.
  for(const x of [-18,-10,-3,7,15,27]){
    box(`canal-waterline-stain-${x}`,x,-1.49,2.792,2.8,.16,.015,'#647a62');
    box(`canal-quay-sill-${x}`,x,-.18,5.581,1.2,.12,.06,'#a9ac95');
    box(`canal-wall-drain-${x}`,x,-.7,5.572,.42,.36,.025,'#3d504b');
    for(let bar=0;bar<4;bar++)box(`canal-drain-grille-${x}-${bar}`,x-.15+bar*.1,-.7,5.553,.023,.31,.018,'#718077');
    box(`canal-wall-sconce-${x}`,x,-.22,5.54,.15,.23,.16,'#4a5549');
    box(`canal-wall-sconce-glass-${x}`,x,-.22,5.45,.09,.15,.02,'#d0ad68');
    for(let moss=0;moss<5;moss++)box(`canal-joint-moss-${x}-${moss}`,x-1.2+moss*.46,-1.12+(moss%3)*.08,5.571,.2,.026,.015,'#697c54');
  }
  for(const z of [-5,-3,-1,1])for(const x of [-16,12,28]){
    const rock=detailMesh(MeshBuilder.CreateSphere(`river-rounded-bed-stone-${x}-${z}`,{diameter:.3,segments:6},scene),'#7a8573');rock.position.set(x+(z%2)*.2,LIVE_RIVER.bedY+.09,z);rock.scaling.set(1,.5,.7);rock.metadata={castShadow:false};
  }
  for(let x=-18;x<29;x+=3){
    box(`canal-edge-coping-${x}`,x,-.7,2.98,2.9,.15,.16,'#c3baa0');
  }
  for(const x of [-18,-12,-6,3,9,15,22,27]){
    const post=detailMesh(MeshBuilder.CreateCylinder(`canal-iron-bollard-${x}`,{diameter:.17,height:.85,tessellation:8},scene),'#697260');post.position.set(x,-.775,3.04);
  }
  for(const [a,b] of [[-18,-12],[-12,-6],[-6,3],[3,9],[9,15],[15,22],[22,27]]){
    const chain=detailMesh(MeshBuilder.CreateTube(`canal-safety-chain-${a}`,{path:Array.from({length:9},(_,i)=>{const t=i/8;return new Vector3(a+(b-a)*t,-.43-.14*4*t*(1-t),3.04);}),radius:.016,tessellation:5},scene),'#626b5d');chain.metadata={castShadow:false};
  }
  // Paving is visible at the lower level, with drainage strips against the bank.
  box('canal-lower-drain',4,-1.185,5.42,48,.025,.13,'#737f72');
  // Metre-scaled UVs: stretched once across 51 m, the setts had become 6 m planks along the towpath.
  const lowerWidth=LIVE_CANAL_BANK.maxX-LIVE_CANAL_BANK.minX,lowerRepeat=LIVE_SURFACE_METRES.paving;
  const lower=MeshBuilder.CreateGround('canal-lower-paving',{width:lowerWidth,height:2.7},scene);lower.position.set((LIVE_CANAL_BANK.minX+LIVE_CANAL_BANK.maxX)/2,-1.188,4.25);lower.material=surfaces?.material('paving','#a19e85')??material('#a19e85');lower.isPickable=false;lower.receiveShadows=true;details.push(lower);
  lower.setVerticesData('uv',[0,0,lowerWidth/lowerRepeat,0,0,2.7/lowerRepeat,lowerWidth/lowerRepeat,2.7/lowerRepeat]);

  // A real raised gallery, reached by the shared ten-tread staircase on its south side.
  // Decorations stay on its solid back wall, columns, parapet and roof.
  const gallery=LIVE_B_APARTMENTS;
  const galleryFloor=MeshBuilder.CreateGround('b-apartments-tiled-floor',{width:2.84,height:7.72},scene);
  galleryFloor.position.set(31.94,gallery.height+.014,17.9);
  galleryFloor.material=surfaces?.material('clay','#b29d7e')??material('#b29d7e');
  galleryFloor.setVerticesData('uv',[0,0,.9,0,0,2.4,.9,2.4]);galleryFloor.isPickable=false;galleryFloor.receiveShadows=true;details.push(galleryFloor);
  for(const z of [15.5,18,20.5]) {
    box(`b-apartments-window-reveal-${z}`,33.47,3.12,z,.05,1.38,1.32,'#d7c8a9');
    box(`b-apartments-window-inset-${z}`,33.43,3.12,z,.035,1.15,1.08,'#334b50');
    for(const side of [-1,1]) {
      box(`b-apartments-side-shutter-${z}-${side}`,33.39,3.12,z+side*.29,.04,1.12,.52,'#47716b');
      for(let slat=0;slat<8;slat++)box(`b-apartments-side-slat-${z}-${side}-${slat}`,33.36,2.65+slat*.13,z+side*.29,.025,.035,.46,'#739189');
    }
    box(`b-apartments-stone-sill-${z}`,33.36,2.4,z,.24,.12,1.48,'#ded0af');
    const arch=detailMesh(MeshBuilder.CreateTube(`b-apartments-window-arch-${z}`,{path:Array.from({length:17},(_,i)=>{
      const angle=i/16*Math.PI;return new Vector3(33.42,3.8+Math.sin(angle)*.4,z+Math.cos(angle)*.65);
    }),radius:.065,tessellation:6},scene),'#d7c8a9');
    arch.freezeWorldMatrix();
  }
  for(const z of [14.9,21.6]) {
    box(`b-apartments-column-plinth-${z}`,30.4,1.9,z,.36,.2,.36,'#d7c8a9');
    box(`b-apartments-column-capital-${z}`,30.4,4.22,z,.36,.15,.36,'#e2d5b7');
  }
  for(const z of [14.3,16.4,18.5,20.6])box(`b-apartments-roof-beam-${z}`,31.95,4.31,z,3.5,.08,.13,'#66513c');
  box('b-apartments-front-cornice',30.3,4.5,18,.34,.2,8.65,'#dfcaa4');
  box('b-apartments-parapet-coping',30.4,2.51,18.3,.3,.06,7.04,'#e1d2b2');
  for(let step=0;step<gallery.steps;step++) {
    const z=gallery.stairStart+step*(gallery.stairEnd-gallery.stairStart)/gallery.steps+.025;
    box(`b-apartments-stair-nosing-${step}`,29.4,(step+1)*gallery.height/gallery.steps+.006,z,2,.012,.08,'#dfd2b7');
  }
  // Upper shutters and terracotta eaves complete the apartment facade above the gallery.
  for(const z of [15.7,18.4,21]) {
    box(`b-apartments-upper-frame-${z}`,33.47,5.7,z,.055,1.36,1.32,'#e4d3b0');
    box(`b-apartments-upper-shutter-${z}`,33.42,5.7,z,.045,1.16,1.08,'#3e625f');
    box(`b-apartments-upper-mullion-${z}`,33.38,5.7,z,.035,1.16,.05,'#92a79a');
  }
  box('b-apartments-terracotta-eave',38.5,7.04,18,10.3,.16,8.65,'#ae6447');

  // 1. Central scalloped stone fountain at B. Its complete silhouette stays
  // inside the existing 4.6 m collision footprint in LIVE_FPS_MAP.
  const fx=23, fz=21;
  const fBase=detailMesh(MeshBuilder.CreateCylinder('fountain-stepped-base',{height:.24,diameter:4.25,tessellation:24},scene),'#777a70');
  fBase.position.set(fx,.15,fz);
  const fCurb=detailMesh(MeshBuilder.CreateCylinder('fountain-basin-shell',{height:.58,diameterTop:4.02,diameterBottom:3.7,tessellation:24},scene),'#b5aa91');
  fCurb.position.set(fx,.55,fz);
  const rim=detailMesh(MeshBuilder.CreateTorus('fountain-scalloped-rim',{diameter:3.77,thickness:.14,tessellation:32},scene),'#e0d3b5');
  rim.position.set(fx,.91,fz);
  // Low rounded stone lobes make the basin outline read as the flower-like
  // scalloped rim in the reference without extending beyond the collision box.
  for(let i=0;i<12;i++) {
    const angle=(i/12)*Math.PI*2;
    const lobe=detailMesh(MeshBuilder.CreateSphere(`fountain-rim-lobe-${i}`,{diameter:.34,segments:8},scene),'#d0c5aa');
    lobe.position.set(fx+Math.cos(angle)*1.88,.82,fz+Math.sin(angle)*1.88);
    lobe.scaling.y=.42;
  }
  const fWater=detailMesh(MeshBuilder.CreateCylinder('fountain-water',{height:.035,diameter:3.25,tessellation:32},scene),'#477d81');
  fWater.position.set(fx,.87,fz);
  const waterMat=surfaces?.water('#477d81')??new StandardMaterial('fountain-water-mat',scene);
  waterMat.diffuseColor=new Color3(.28,.54,.57);waterMat.specularColor=new Color3(.4,.6,.62);
  waterMat.emissiveColor=new Color3(.025,.045,.045);
  fWater.material=waterMat;

  // Tiered central jet and shallow upper bowl.
  const fPedestal=detailMesh(MeshBuilder.CreateCylinder('fountain-pedestal',{height:.66,diameter:.72,tessellation:12},scene),'#a89d87');
  fPedestal.position.set(fx,1.18,fz);
  const fBowl=detailMesh(MeshBuilder.CreateCylinder('fountain-upper-bowl',{height:.24,diameterTop:1.42,diameterBottom:.78,tessellation:16},scene),'#c2b69e');
  fBowl.position.set(fx,1.6,fz);
  const fUpperWater=detailMesh(MeshBuilder.CreateCylinder('fountain-upper-water',{height:.025,diameter:1.2,tessellation:16},scene),'#5e9a99');
  fUpperWater.position.set(fx,1.735,fz);fUpperWater.material=waterMat;
  const fFinial=detailMesh(MeshBuilder.CreateCylinder('fountain-finial',{height:.42,diameterTop:.2,diameterBottom:.4,tessellation:12},scene),'#a89d87');
  fFinial.position.set(fx,1.96,fz);
  // Running water: four masks on the pedestal throw arcing jets into the basin (with splash rings), and the
  // upper bowl overflows in thin streams from its lip. All inside the fountain's collision footprint.
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2+Math.PI/4,dx=Math.cos(a),dz=Math.sin(a);
    const mask=detailMesh(MeshBuilder.CreateSphere(`fountain-mask-${i}`,{diameter:.15,segments:8},scene),'#9d927c');
    mask.position.set(fx+dx*.36,1.25,fz+dz*.36);mask.scaling.set(1,1.15,1);
    const jet=MeshBuilder.CreateTube(`fountain-jet-${i}`,{path:Array.from({length:9},(_,k)=>{const t=k/8;return new Vector3(fx+dx*(.44+.81*t),1.22+.22*t-.56*t*t,fz+dz*(.44+.81*t));}),radius:.022,tessellation:6},scene);
    jet.material=waterMat;jet.isPickable=false;jet.receiveShadows=true;jet.metadata={castShadow:false};details.push(jet);
    const splash=MeshBuilder.CreateTorus(`fountain-splash-${i}`,{diameter:.18,thickness:.018,tessellation:14},scene);
    splash.position.set(fx+dx*1.25,.892,fz+dz*1.25);splash.material=waterMat;splash.isPickable=false;splash.metadata={castShadow:false};details.push(splash);
  }
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5+.31,stream=MeshBuilder.CreateCylinder(`fountain-overflow-${i}`,{height:.8,diameter:.022,tessellation:5},scene);
    stream.position.set(fx+Math.cos(a)*.7,1.3,fz+Math.sin(a)*.7);stream.material=waterMat;stream.isPickable=false;stream.metadata={castShadow:false};details.push(stream);
  }
  const fSpire=detailMesh(MeshBuilder.CreateSphere('fountain-spire',{diameter:.32,segments:10},scene),'#d0c5aa');
  fSpire.position.set(fx,2.2,fz);

  // Lily pads and small flowers add life at a distance without particle clutter.
  const flowerColors=['#e9d8c2','#c78270','#e0bc67'];
  for(let i=0;i<10;i++) {
    const angle=i*2.399, radius=.58+(i%3)*.27;
    const x=fx+Math.cos(angle)*radius,z=fz+Math.sin(angle)*radius;
    const pad=detailMesh(MeshBuilder.CreateSphere(`fountain-lily-${i}`,{diameter:.38,segments:8},scene),'#647e4c');
    pad.position.set(x,.91,z);pad.scaling.y=.12;
    const petal=detailMesh(MeshBuilder.CreateSphere(`fountain-flower-${i}`,{diameter:.14,segments:6},scene),flowerColors[i%flowerColors.length]);
    petal.position.set(x+.07,.96,z-.04);petal.scaling.y=.45;
  }

  // Every bulb hangs from its cable, and each cable ends on an actual wall/column.
  // Daytime bulbs: warm glass with a soft filament glow, not saturated orbs that out-shine the sun.
  const bulbMat=new StandardMaterial('festoon-bulb-mat',scene);
  bulbMat.emissiveColor=new Color3(.4,.27,.09);bulbMat.diffuseColor=new Color3(.84,.77,.57);bulbMat.specularColor=new Color3(.55,.5,.4);bulbMat.specularPower=72;
  for(const span of LIVE_FESTOON_SPANS) {
    const cable=detailMesh(MeshBuilder.CreateTube(`festoon-cable-${span.id}`,{path:Array.from({length:33},(_,i)=>liveFestoonCablePoint(span,i/32)),radius:.012,tessellation:4},scene),'#303731');
    cable.freezeWorldMatrix();
    for(const [index,point] of [span.from,span.to].entries())box(`festoon-wall-anchor-${span.id}-${index}`,point.x,point.y,point.z,.12,.18,.18,'#424b45');
    for(let i=1;i<=8;i++) {
      const point=liveFestoonCablePoint(span,i/9);
      const drop=detailMesh(MeshBuilder.CreateCylinder(`festoon-drop-${span.id}-${i}`,{height:.12,diameter:.022,tessellation:5},scene),'#303731');
      drop.position.copyFrom(point);drop.position.y-=.06;
      const socket=detailMesh(MeshBuilder.CreateCylinder(`festoon-socket-${span.id}-${i}`,{height:.075,diameter:.065,tessellation:8},scene),'#4c5148');
      socket.position.copyFrom(point);socket.position.y-=.145;
      const bulb=MeshBuilder.CreateSphere(`festoon-bulb-${span.id}-${i}`,{diameter:.135,segments:10},scene);
      bulb.position.copyFrom(point);bulb.position.y-=.235;bulb.scaling.y=1.25;bulb.material=bulbMat;bulb.isPickable=false;details.push(bulb);
    }
  }

  // Distinct paving belongs to residential streets, the market square and the civic forecourt.
  for(const [name,x,z,w,d,color] of [
    ['market-street-south',20,-15,12,22,'#aaa084'],['market-street-north',23,5,16,18,'#aaa084'],
    ['market-square',23,21,19,20,'#c0b292'],['civic-courtyard',-23,21,20,24,'#c9bda1'],
    ['residential-lane',0,-6,6,48,'#aca991'],['residential-passage',-8,-14,4,22,'#a6a18b'],
    ['civic-cross-street',12,35,24,5,'#b7ae96'],
  ] as [string,number,number,number,number,string][]){
    for(const [i,r] of liveCutPavingRect({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2}).entries()){
    const width=r.maxX-r.minX,depth=r.maxZ-r.minZ;
    const lane=MeshBuilder.CreateGround(`${name}-${i}`,{width,height:depth},scene);lane.position.set((r.minX+r.maxX)/2,.012,(r.minZ+r.maxZ)/2);
    lane.material=surfaces?.material('paving',color)??material(color);lane.isPickable=false;lane.receiveShadows=true;
    lane.setVerticesData('uv',[0,0,width/4,0,0,depth/4,width/4,depth/4]);lane.metadata={castShadow:false};details.push(lane);
    }
  }
  for(const mesh of details){
    mesh.computeWorldMatrix(true);
    const bounds=mesh.getBoundingInfo().boundingBox,low=bounds.minimumWorld,high=bounds.maximumWorld;
    // The sun's shadow map is fitted to every caster: the 230 m seawall and far palazzi had stretched it to
    // three times the playable width. Rods thinner than a texel (rafters, pipes, rails) only alias.
    const outsidePlay=low.x< -40||high.x>40||low.z< -48||high.z>48;
    const extents=[high.x-low.x,high.y-low.y,high.z-low.z].sort((a,b)=>a-b);
    mesh.metadata={...(mesh.metadata??{}),castShadow:mesh.metadata?.castShadow!==false&&!mesh.name.startsWith('village-outside')&&!outsidePlay&&extents[1]>=.11};
  }
  if(options.batch===false)return details.filter(mesh=>mesh.metadata?.castShadow!==false);
  // Roofs over cutaway slabs batch among themselves so the viewer can hide them with the slabs. Batched first:
  // the main batch's statistics are the ones recorded on the scene.
  const cutaway=batchStaticLiveGeometry(details.filter(mesh=>mesh.metadata?.cutawayRoof)).meshes;
  for(const mesh of cutaway)mesh.metadata={...(mesh.metadata??{}),cutawayRoof:true};
  const batched=batchStaticLiveGeometry(details.filter(mesh=>!mesh.metadata?.cutawayRoof));
  return [...batched.meshes,...cutaway].filter(mesh=>mesh.metadata?.castShadow!==false&&!mesh.material?.name.startsWith('water:')&&!/bulb|lantern/.test(mesh.material?.name??''));
}
