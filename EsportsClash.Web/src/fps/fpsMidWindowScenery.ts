import {MeshBuilder,type Scene} from '@babylonjs/core';
import {LIVE_MID_WINDOW as w} from './fpsLiveTerrain.ts';
import type {VillageBuilder} from './fpsVillageArchitecture.ts';
import {LIVE_WINDOW_FURNITURE} from './fpsMidWindowInterior.ts';

/** Enlarged customs house: civic side wing and ground-level open T door on Mid. */
export function buildMidWindowScenery(scene:Scene,{box,detail}:VillageBuilder):void {
  const front=16.84;
  const winMid=(w.windowMinX+w.windowMaxX)/2,winW=w.windowMaxX-w.windowMinX,winH=w.lintelY-w.sillY;
  // Jamb stones sit on the piers either side of the opening (inside it they were solid-looking but bullet-thin),
  // 4 cm proud of the facade (they stood 10 cm out, where shots grazed past the pier collision).
  for(const x of [w.windowMinX-.06,w.windowMaxX+.06])box(`mid-window-stone-reveal-${x}`,x,(w.sillY+w.lintelY)/2,front+.06,.13,winH,.12,'#dcc8a5');
  box('mid-window-stone-sill',winMid,w.sillY-.03,front,winW+.15,.12,.24,'#dfcaa8');
  box('mid-window-lintel-reveal',winMid,w.lintelY+.03,front+.065,winW+.15,.14,.13,'#d7c3a1');
  // Ground-level open wooden doorway facing T-side lower Mid with upper shuttered window.
  // A normal street door: frame, header and an opened leaf hinged on its west jamb.
  const doorMid=(w.doorMinX+w.doorMaxX)/2,doorW=w.doorMaxX-w.doorMinX;
  for(const x of [w.doorMinX,w.doorMaxX]){
    // Frame posts and plinths stand on the jambs beside the opening, not 5-11 cm inside it.
    const px=x<doorMid?x-.06:x+.06,fz=front+.04;
    box(`mid-window-t-door-plinth-${x}`,px,.16,fz,.16,.32,.08,'#b9aa90');
    box(`mid-window-t-door-frame-${x}`,px,w.doorTopY/2,fz,.12,w.doorTopY,.08,'#d4c2a1');
  }
  // Header and cornice sit on the lintel within 5 cm of its face (they hung below and 20 cm in front of it).
  box('mid-window-t-door-header',doorMid,w.doorTopY+.09,front+.04,doorW+.12,.18,.08,'#dcc8a5');
  box('mid-window-t-door-cornice',doorMid,w.doorTopY+.23,front+.04,doorW+.28,.1,.1,'#c8b698');
  box('mid-window-t-open-door-board',w.doorMinX+.06,w.doorTopY/2-.02,17.17+doorW*.45,.07,w.doorTopY-.08,doorW*.9,'#6f4b2f');
  for(const y of [.6,1.7])box(`mid-window-t-door-crossbar-${y}`,w.doorMinX+.11,y,17.17+doorW*.45,.04,.1,doorW*.88,'#593a23');
  box('mid-window-t-door-handle',w.doorMinX+.12,1.02,17.17+doorW*.85,.05,.06,.14,'#c7a76c');
  box('mid-window-t-upper-frame',-3.1,4.05,front,1.35,1.35,.08,'#dac6a4');
  box('mid-window-t-upper-shutter',-3.1,4.05,front-.04,1.12,1.12,.05,'#57716a');
  for(const side of [-1,1])for(let row=0;row<8;row++){
    const x=winMid+side*(winW/2+.18+(row%3)*.18);
    box(`mid-window-brick-${side}-${row}`,x,2.82+row*.23,front,.26,.13,.035,row%3?'#ae8d70':'#c2a080');
  }
  // The flat tile-coloured caps that sat on these roofs are replaced by pitched clay roofs (village architecture).
  for(const z of [18,21,24,26])box(`mid-window-house-beam-${z}`,0,5.34,z,8.75,.12,.16,'#74583d');
  // Door posts sit on the wall ends at the edges of the side opening, not inside it.
  for(const z of [22.14,26.44])box(`mid-window-wide-door-frame-${z}`,-4.47,3.05,z,.12,2.5,.12,'#d4c2a1');
  // Visible stair flights remain inside the house and civic wing behind street doors.
  // Street door posts stand on the jamb ends at most 4 cm proud of the wall (they stood 8 cm into the opening,
  // where bullets crossed them).
  for(const z of [22.47,26.23])box(`mid-window-civic-street-frame-${z}`,-15.61,1.3,z,.1,2.6,.1,'#dcc8a5');
  box('mid-window-civic-street-top',-15.61,2.65,24.35,.1,.14,3.86,'#dcc8a5');
  for(let i=0;i<12;i++){
    const h=(i+1)*.15,z=w.stairStart+(i+1)*(w.stairEnd-w.stairStart)/w.steps-.025;
    box(`mid-window-t-interior-tread-${i}`,-3.1,h+.008,z,2.4,.016,.07,'#d7c6a5');
    const sh=(12-i)*.15,x=-7.2-(i+1)*.675+.025;
    box(`mid-window-civic-interior-tread-${i}`,x,sh+.008,24.3,.07,.016,3.6,'#d7c6a5');
  }
  for(let i=0;i<12;i++)box(`mid-window-ct-interior-tread-${i}`,2.8,(12-i)*.15+.008,20.5+(i+1)*.5-.025,3.05,.016,.07,'#d7c6a5');
  for(const x of [1.2,4.5]){
    const px=x>3?4.44:1.14;
    box(`mid-window-ct-street-frame-${x}`,px,1.4,26.59,.12,2.8,.14,'#dcc8a5');
  }
  box('mid-window-ct-street-top',2.79,2.85,26.59,3.42,.14,.14,'#dcc8a5');
  // Upper windows stay above the ground-level CT doorway.
  for(const x of [-2.8,0,2.8]){
    box(`mid-window-rear-frame-${x}`,x,4.2,w.maxZ+.14,1.35,1.4,.08,'#dac6a4');
    box(`mid-window-rear-shutter-${x}`,x,4.2,w.maxZ+.19,1.12,1.15,.05,'#57716a');
  }
  // Italian masonry trim: corner quoins, belt course, doorway lantern, plaque and roof chimney.
  // Bonded quoins 3 cm proud of the house corners (they stood up to 16 cm out, where shots grazed through them).
  // Beside the CT door (rear east corner) the return along the rear face stays short of the doorway.
  const proud=.03,course=.44,step=.48;
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const fx=sx*(w.maxX+.12),fz=sz<0?w.frontZ-.12:w.maxZ+.12;
    for(let idx=0,y=.38+course/2;y<5.15;y+=step,idx++){
      const nearDoor=y<2.9&&sx>0&&sz>0,alongX=nearDoor?.22:(idx%2===0?.42:.26),alongZ=idx%2===0?.26:.42;
      const qw=alongX+proud,qd=alongZ+proud,qx=fx+sx*(proud-qw/2),qz=fz+sz*(proud-qd/2);
      box(`mid-window-quoin-${sx}-${sz}-${idx}`,qx,y,qz,qw,course,qd,idx%2?'#d9ccb0':'#cdc0a2');
    }
  }
  // Belt course across the whole Mid facade under the window sill (it was a 1.6 m stub on the east end).
  box('mid-window-east-belt-course',0,2.66,front,9.04,.14,.16,'#d9ccb0');
  box('mid-window-door-sconce-arm',-1.56,2.56,front-.08,.05,.05,.18,'#3d4541');
  box('mid-window-door-sconce-lantern',-1.56,2.42,front-.16,.14,.2,.14,'#e2b86b');
  box('mid-window-house-plaque',-1.56,1.52,front-.03,.24,.18,.03,'#e8dec2');
  box('mid-window-brass-postbox',-1.56,1.18,front-.04,.22,.28,.06,'#b9985a');
  box('mid-window-chimney-shaft',2.2,6.05,23.5,.5,.8,.5,'#d4c7ab');
  box('mid-window-chimney-cap',2.2,6.48,23.5,.62,.08,.62,'#c5b698');
  box('mid-window-chimney-pot',2.2,6.64,23.5,.22,.24,.22,'#b56e50');
  // The substantial desk, cabinet and trunk are rendered from the shared map
  // solids. Only their fittings and small dressing are added here.
  const desk=LIVE_WINDOW_FURNITURE[0],top=desk.baseY+desk.height;
  box('mid-window-interior-desk-top',desk.x,top+.025,desk.z,desk.width+.06,.05,desk.depth+.06,'#997650');
  for(const x of [3.06,3.55])for(let row=0;row<2;row++){
    box(`mid-window-interior-desk-drawer-${x}-${row}`,x,2.12+row*.25,18.484,.42,.21,.035,'#97744f');
    box(`mid-window-interior-desk-pull-${x}-${row}`,x,2.12+row*.25,18.458,.12,.025,.025,'#bba573');
  }
  box('mid-window-interior-desk-blotter',3.35,top+.058,18.94,.72,.012,.55,'#365d51');
  for(let i=0;i<3;i++){
    box(`mid-window-interior-ledger-${i}`,3.84,top+.065+i*.055,19.1,.29,.05,.36,['#5c6f62','#8b493d','#b49a65'][i]);
    box(`mid-window-interior-ledger-pages-${i}`,3.828,top+.067+i*.055,19.085,.27,.035,.325,'#dacdb1');
  }
  for(let i=0;i<2;i++)box(`mid-window-interior-desk-paper-${i}`,3.18+i*.07,top+.068+i*.009,18.84+i*.06,.3,.008,.25,'#e4dbc1');
  for(let i=0;i<4;i++)box(`mid-window-interior-desk-writing-${i}`,3.15,top+.087,18.81+i*.035,.16,.002,.006,'#737667');
  box('mid-window-interior-radio-body',2.98,top+.15,19.18,.27,.18,.17,'#3d4842');
  box('mid-window-interior-radio-grille',2.98,top+.16,19.087,.2,.105,.012,'#202d2a');
  box('mid-window-interior-radio-aerial',2.87,top+.44,19.2,.014,.5,.014,'#5a625a');
  const lamp=detail(MeshBuilder.CreateCylinder('mid-window-interior-desk-lamp-shade',{height:.14,diameterTop:.14,diameterBottom:.3,tessellation:12},scene),'#59796c');
  lamp.position.set(3.91,top+.56,18.77);
  box('mid-window-interior-desk-lamp-base',3.91,top+.075,18.77,.2,.04,.15,'#ac945f');
  box('mid-window-interior-desk-lamp-stem',3.91,top+.3,18.77,.025,.44,.025,'#ac945f');
  for(const [i,x] of [-3.16,-2.44].entries()){
    box(`mid-window-interior-archive-door-${i}`,x,2.72,25.728,.66,1.68,.045,'#8c6e4d');
    box(`mid-window-interior-archive-inset-${i}`,x,2.88,25.699,.51,1.02,.018,'#6e5943');
    box(`mid-window-interior-archive-handle-${i}`,x+(i?-.2:.2),2.74,25.675,.025,.14,.025,'#c4ad73');
  }
  box('mid-window-interior-bench-cushion',-.25,2.287,26.02,1.02,.055,.48,'#46675c');
  box('mid-window-interior-bench-latch',-.25,2.04,25.758,.08,.12,.025,'#b89b66');
  // Wall-mounted charts, dispatch slips and hooks stay out of all stair bays.
  box('mid-window-interior-harbor-chart-frame',4.335,4.05,19.03,.08,1.04,1.22,'#785e41');
  box('mid-window-interior-harbor-chart-paper',4.287,4.05,19.03,.018,.9,1.08,'#ded2ae');
  box('mid-window-interior-harbor-chart-canal',4.272,4.02,19.03,.008,.09,.91,'#708c94');
  for(let i=0;i<5;i++)box(`mid-window-interior-harbor-chart-block-${i}`,4.266,3.78+(i%2)*.45,18.64+i*.18,.009,.17,.12,'#a18d65');
  box('mid-window-interior-notice-board',-.25,3.4,26.32,1.3,.85,.055,'#786244');
  for(let i=0;i<4;i++){
    box(`mid-window-interior-dispatch-slip-${i}`,-.7+i*.3,3.36+(i%2)*.12,26.282,.23,.38,.018,'#e0d4b5');
    box(`mid-window-interior-dispatch-pin-${i}`,-.7+i*.3,3.5+(i%2)*.12,26.266,.035,.035,.015,i%2?'#58765c':'#a65d49');
  }
  for(const x of [-1.2,.65]){
    box(`mid-window-interior-wall-lamp-back-${x}`,x,4.58,26.32,.17,.25,.05,'#594f3d');
    box(`mid-window-interior-wall-lamp-glass-${x}`,x,4.58,26.25,.12,.17,.08,'#e4bd7a');
  }
  box('mid-window-interior-annex-route-board',-10.7,3.65,26.32,1.5,.6,.045,'#537265');
  for(let i=0;i<3;i++)box(`mid-window-interior-annex-route-mark-${i}`,-11.1+i*.36,3.65,26.289,.25,.06,.012,'#d9cba6');
}
