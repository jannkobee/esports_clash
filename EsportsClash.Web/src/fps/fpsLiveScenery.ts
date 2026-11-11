import { MeshBuilder, Mesh, Vector3, StandardMaterial, DynamicTexture, Color3, type Scene } from '@babylonjs/core';
import { LIVE_FPS_MAP } from './fpsLiveMap.ts';

/**
 * Runtime map dressing inspired by CS2 Inferno aesthetics:
 * - Octagonal stone central Fountain at B with reflective pool & red brick circular paving.
 * - Banana curved slipway with overhead festoon string lights, stacked cargo barrels, and stenciled signs.
 * - Overhead stone archways bridging alleys (Banana arch, Port Arch, Church arch, Underpass lintel).
 * - A Courtyard with Tenuta-style arched loggia, Pit revetment railing/steps, and upper wooden gallery balcony.
 * - Walkable-space collision geometry remains strictly matched to the authoritative map.
 */
export function buildLiveScenery(scene:Scene,material:(color:string)=>StandardMaterial):Mesh[] {
  const details:Mesh[]=[];
  const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{
    const mesh=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);mesh.position.set(x,y,z);mesh.material=material(color);details.push(mesh);return mesh;
  };
  const plate=(name:string,x:number,y:number,z:number,w:number,h:number,color:string)=>box(name,x,y,z,w,h,.035,color);

  // Facade plates & architectural trims hugging all buildings
  for(const wall of LIVE_FPS_MAP.solids.filter(w=>!w.id.endsWith('wall')&&!w.id.startsWith('a-loggia'))) {
    const width=wall.maxX-wall.minX,depth=wall.maxZ-wall.minZ,x=(wall.minX+wall.maxX)/2,z=(wall.minZ+wall.maxZ)/2;
    for(const face of [-1,1]) {
      const faceZ=face<0?wall.minZ-.022:wall.maxZ+.022;
      plate(`${wall.id}-base-${face}`,x,.35,faceZ,width,.7,'#67736e');
      if(wall.id.includes('container')||wall.id.includes('screen')) {
        for(let at=wall.minX+.25;at<wall.maxX;at+=.5)plate(`${wall.id}-rib-${face}-${at}`,at,wall.height/2,faceZ,.045,wall.height-.18,'#50666b');
        plate(`${wall.id}-serial-${face}`,x,wall.height-.5,faceZ,width*.55,.24,'#d0bd91');
      } else if(wall.id.includes('fountain')) {
        // Basin curb is handled specially below
      } else if(wall.height>=4) {
        const doorWidth=Math.min(3,width*.5);
        plate(`${wall.id}-loading-door-${face}`,x,1.6,faceZ,doorWidth,3.1,'#435b60');
        for(let i=0;i<8;i++)plate(`${wall.id}-shutter-${face}-${i}`,x,.25+i*.37,faceZ+face*.023,doorWidth,.035,'#758984');
        if(wall.height>5)for(let at=wall.minX+2;at<wall.maxX-1;at+=3.5) {
          plate(`${wall.id}-window-frame-${face}-${at}`,at,wall.height-2,faceZ,2.2,1.5,'#d0c7ad');
          plate(`${wall.id}-window-${face}-${at}`,at,wall.height-2,faceZ+face*.025,1.95,1.24,'#334f5d');
          plate(`${wall.id}-mullion-${face}-${at}`,at,wall.height-2,faceZ+face*.05,.06,1.24,'#8b9995');
          // Mediterranean green wooden shutters flanking windows
          plate(`${wall.id}-shutter-l-${face}-${at}`,at-1.15,wall.height-2,faceZ+face*.03,.4,1.4,'#3a5944');
          plate(`${wall.id}-shutter-r-${face}-${at}`,at+1.15,wall.height-2,faceZ+face*.03,.4,1.4,'#3a5944');
        }
      } else {
        for(const at of [wall.minX+.2,wall.maxX-.2])plate(`${wall.id}-crate-edge-${face}-${at}`,at,wall.height/2,faceZ,.12,wall.height,'#c3a574');
        plate(`${wall.id}-crate-rail-${face}`,x,wall.height*.5,faceZ,width,.12,'#b59b73');
      }
    }
    // Dress the long side elevations too: recessed shutters, stone sills, rain pipes.
    // Keep volumes within the actor clearance margin; no walk-through cover props.
    if(wall.height>=4)for(const side of [-1,1]) {
      const faceX=side<0?wall.minX-.025:wall.maxX+.025;
      box(`${wall.id}-side-plinth-${side}`,faceX,.3,z,.04,.6,depth,'#877f70');
      for(let at=wall.minZ+1.8;at<wall.maxZ-1;at+=3.3) {
        box(`${wall.id}-side-frame-${side}-${at}`,faceX,3.5,at,.055,1.5,1.35,'#d0c7ad');
        box(`${wall.id}-side-shutter-${side}-${at}`,faceX+side*.03,3.5,at,.035,1.3,1.15,'#3a5944');
        for(let slat=0;slat<6;slat++)box(`${wall.id}-side-slat-${side}-${at}-${slat}`,faceX+side*.05,2.98+slat*.2,at,.02,.035,1.1,'#60715e');
        box(`${wall.id}-side-sill-${side}-${at}`,faceX,2.72,at,.14,.12,1.55,'#b7aa90');
      }
      box(`${wall.id}-downpipe-${side}`,faceX,wall.height/2,wall.minZ+.35,.09,wall.height-.2,.09,'#545f59');
      // Subtle plaster repairs add age without reducing target contrast.
      box(`${wall.id}-repair-${side}`,faceX,.95,wall.maxZ-.8,.035,.55,.9,'#a39c88');
    }
  }

  // 1. Central Octagonal Stone Fountain at B Bombsite (Authentic CS2 Mediterranean Design)
  const fx=23, fz=21;
  const fCurb=box('fountain-curb',fx,.45,fz,4.8,.9,4.8,'#7c8380');
  const fWater=MeshBuilder.CreateGround('fountain-water',{width:3.8,height:3.8},scene);
  fWater.position.set(fx,.78,fz);
  const waterMat=new StandardMaterial('fountain-water-mat',scene);
  waterMat.diffuseColor=new Color3(.21,.48,.56);waterMat.specularColor=new Color3(.4,.6,.7);
  fWater.material=waterMat;fWater.isPickable=false;

  // Authentic stone central fountain: pedestal, wide ornamental tiered bowl, upper water pool, and sculpted finial
  const fPedestal=MeshBuilder.CreateCylinder('fountain-pedestal',{height:1.1,diameter:1.2,tessellation:12},scene);
  fPedestal.position.set(fx,.55,fz);fPedestal.material=material('#a89d87');
  const fBowl=MeshBuilder.CreateCylinder('fountain-bowl',{height:.35,diameterTop:1.9,diameterBottom:1.1,tessellation:14},scene);
  fBowl.position.set(fx,1.25,fz);fBowl.material=material('#b8ac95');
  const fUpperWater=MeshBuilder.CreateDisc('fountain-upper-water',{radius:.85,tessellation:14},scene);
  fUpperWater.position.set(fx,1.38,fz);fUpperWater.rotation.x=Math.PI/2;fUpperWater.material=waterMat;fUpperWater.isPickable=false;
  const fFinial=MeshBuilder.CreateCylinder('fountain-finial',{height:.7,diameterTop:.3,diameterBottom:.65,tessellation:10},scene);
  fFinial.position.set(fx,1.75,fz);fFinial.material=material('#a89d87');
  const fSpire=MeshBuilder.CreateSphere('fountain-spire',{diameter:.38,segments:8},scene);
  fSpire.position.set(fx,2.15,fz);fSpire.material=material('#c2b7a0');
  // Lion head relief water spouts around bowl perimeter
  for(const [lx,lz] of [[fx+.9,fz],[fx-.9,fz],[fx,fz+.9],[fx,fz-.9]]) {
    const spout=box(`fountain-spout-${lx}-${lz}`,lx,1.26,lz,.16,.14,.16,'#8a7f6c');
    spout.freezeWorldMatrix();
  }
  fCurb.freezeWorldMatrix();fPedestal.freezeWorldMatrix();fBowl.freezeWorldMatrix();fFinial.freezeWorldMatrix();fSpire.freezeWorldMatrix();

  // Circular red brick pattern around B Fountain on the floor (Image 5)
  const fFloorRing=MeshBuilder.CreateDisc('fountain-floor-ring',{radius:4.6,tessellation:32},scene);
  fFloorRing.position.set(fx,.018,fz);fFloorRing.rotation.x=Math.PI/2;
  const ringMat=new StandardMaterial('fountain-ring-mat',scene);
  ringMat.diffuseColor=Color3.FromHexString('#983e32');ringMat.specularColor=Color3.Black();
  fFloorRing.material=ringMat;fFloorRing.receiveShadows=true;fFloorRing.isPickable=false;

  // 2. Banana Festoon Overhead String Lights (Image 6)
  const lightZ=[-14,-6,2];
  const bulbMat=new StandardMaterial('festoon-bulb-mat',scene);
  bulbMat.emissiveColor=new Color3(1,.88,.55);bulbMat.diffuseColor=new Color3(1,.92,.65);bulbMat.specularColor=Color3.Black();
  for(const z of lightZ) {
    const cable=MeshBuilder.CreateLines(`banana-cable-${z}`,{points:[
      new Vector3(14,4.4,z),new Vector3(16.5,4.05,z),new Vector3(21.5,4.1,z),new Vector3(24.5,4.35,z)
    ]},scene);
    cable.color=new Color3(.15,.15,.15);cable.isPickable=false;
    for(const x of [15.5,17.5,19.5,21.5,23.5]) {
      const bulb=MeshBuilder.CreateSphere(`festoon-bulb-${z}-${x}`,{diameter:.2,segments:6},scene);
      bulb.position.set(x,4.08,z);bulb.material=bulbMat;bulb.isPickable=false;
    }
  }

  // 3. Stacked Wooden Cargo Barrels at Banana Logs (Image 6)
  const barrelMat=material('#784f2c'), hoopMat=material('#2b2c2c');
  for(const [bx,by,bz] of [[13.8,.475,-11.75],[13.8,.475,-11.05],[13.8,1.425,-11.4]] as number[][]) {
    const barrel=MeshBuilder.CreateCylinder(`barrel-${bx}-${bz}`,{height:.95,diameter:.7,tessellation:12},scene);
    barrel.position.set(bx,by,bz);barrel.material=barrelMat;barrel.receiveShadows=true;barrel.isPickable=false;barrel.freezeWorldMatrix();
    for(const hoopY of [by-.3,by+.3]) {
      const hoop=MeshBuilder.CreateCylinder(`barrel-hoop-${bx}-${bz}-${hoopY}`,{height:.06,diameter:.72,tessellation:12},scene);
      hoop.position.set(bx,hoopY,bz);hoop.material=hoopMat;hoop.isPickable=false;hoop.freezeWorldMatrix();
    }
  }

  // 4. Overhead Stone Archways with Grounded Supporting Pillars (Eliminating Floating Boxes)
  // Banana archway spanning entrance to B
  box('banana-arch-lintel',20,3.9,7,7,1.2,1.2,'#b6aa92').freezeWorldMatrix();
  box('banana-arch-keystone',20,4.6,7,.8,.4,1.25,'#c8bd9f').freezeWorldMatrix();
  // Vertical stone piers grounding Banana archway to the pavement
  // Structural pier rendered from shared map geometry.
  box('banana-arch-plinth-l',16.7,.25,7,.9,.5,1.35,'#8a7f6c').freezeWorldMatrix();
  box('banana-arch-capital-l',16.7,3.2,7,.85,.2,1.3,'#c4b79b').freezeWorldMatrix();
  // Structural pier rendered from shared map geometry.
  box('banana-arch-plinth-r',23.3,.25,7,.9,.5,1.35,'#8a7f6c').freezeWorldMatrix();
  box('banana-arch-capital-r',23.3,3.2,7,.85,.2,1.3,'#c4b79b').freezeWorldMatrix();

  // Port Archway connecting Mid to CT Customs
  box('port-arch-lintel',-4,4.1,22,5.5,1.2,1.2,'#b0a48e').freezeWorldMatrix();
  box('port-arch-keystone',-4,4.8,22,.8,.4,1.25,'#c4b79b').freezeWorldMatrix();
  // Structural pier rendered from shared map geometry.
  box('port-arch-plinth-l',-6.6,.25,22,.85,.5,1.35,'#7c7360').freezeWorldMatrix();
  box('port-arch-capital-l',-6.6,3.4,22,.8,.2,1.3,'#c4b79b').freezeWorldMatrix();
  // Structural pier rendered from shared map geometry.
  box('port-arch-plinth-r',-1.4,.25,22,.85,.5,1.35,'#7c7360').freezeWorldMatrix();
  box('port-arch-capital-r',-1.4,3.4,22,.8,.2,1.3,'#c4b79b').freezeWorldMatrix();

  // Church / Ruins archway at B North exit
  box('church-arch-lintel',22,3.9,32,6,1.2,1.2,'#a89f8b').freezeWorldMatrix();
  // Structural pier rendered from shared map geometry.
  box('church-arch-plinth-l',19.2,.25,32,.9,.5,1.35,'#7c7360').freezeWorldMatrix();
  // Structural pier rendered from shared map geometry.
  box('church-arch-plinth-r',24.8,.25,32,.9,.5,1.35,'#7c7360').freezeWorldMatrix();

  // Underpass low stone lintel over the Sluice passage
  box('underpass-sluice-lintel',-4.75,2.6,-10,3.5,.7,.9,'#88928c').freezeWorldMatrix();
  // Structural pier rendered from shared map geometry.
  // Structural pier rendered from shared map geometry.

  // 5. A Site Arched Colonnade Loggia (Inspired by Tenuta Auti, Image 7)
  const loggiaX=-23, loggiaZ=26;
  box('loggia-roof',loggiaX,3.4,loggiaZ,10,1.1,.9,'#bfae92').freezeWorldMatrix();
  // Wall and columns are rendered from LIVE_FPS_MAP.solids, also used for bullets/navigation.
  for(const colX of [-27.5,-23,-18.5]) {
    box(`loggia-cap-${colX}`,colX,2.85,loggiaZ,.65,.18,.65,'#ded4b9').freezeWorldMatrix();
  }
  for(const z of [26.33,26.51]) {
    plate(`loggia-stone-base-${z}`,-23,.22,z,9.6,.44,'#9e826b');
    plate(`loggia-stone-band-${z}`,-23,2.9,z,9.6,.12,'#d0b99b');
  }

  // 6. A Pit Revetment Railing & Steps (Images 4, 7)
  const pitX=-30, pitZ=16;
  box('pit-wood-rail',pitX,1.3,pitZ,3,.1,.1,'#5e432c').freezeWorldMatrix();
  box('pit-post-l',pitX-1.4,.7,pitZ,.1,1.3,.1,'#5e432c').freezeWorldMatrix();
  box('pit-post-r',pitX+1.4,.7,pitZ,.1,1.3,.1,'#5e432c').freezeWorldMatrix();
  for(let step=0;step<3;step++) {
    box(`pit-step-${step}`,pitX+1.8,(.12+step*.14)/2,pitZ-step*.3,1,.12+step*.14,.35,'#8b927f').freezeWorldMatrix();
  }

  // 7. Warehouse Gallery Wooden Balcony (Apartments, Images 3, 4)
  const balX=-16, balZ=12;
  box('gallery-balcony-floor',balX,2.35,balZ,3.8,.18,1.8,'#63472c').freezeWorldMatrix();
  box('gallery-balcony-rail',balX,2.95,balZ+.85,3.8,.08,.08,'#4a341e').freezeWorldMatrix();
  for(const bPost of [balX-1.8,balX,balX+1.8]) {
    box(`gallery-balcony-post-${bPost}`,bPost,2.65,balZ+.85,.08,.6,.08,'#4a341e').freezeWorldMatrix();
    box(`gallery-balcony-corbel-${bPost}`,bPost,2.0,balZ-.1,Math.max(.12,(-16-bPost)*2+.12),.6,.8,'#4a341e').freezeWorldMatrix();
  }

  // 8. Wrought-Iron Wall Lanterns with Warm Amber Glow (Images 3, 5, 6)
  const lanternLocs:[number,number,number][]=[[13.5,2.4,-6],[-4.5,2.5,-4],[-21,2.4,16],[14,2.5,24],[-15.2,2.4,4]];
  for(let i=0;i<lanternLocs.length;i++) {
    const [lx,ly,lz]=lanternLocs[i];
    box(`lantern-bracket-${i}`,lx,ly,lz,.1,.24,.24,'#1f2427').freezeWorldMatrix();
    const glass=box(`lantern-glass-${i}`,lx,ly-.12,lz,.14,.22,.14,'#e8a846');
    const glassMat=material('#e8a846');glassMat.emissiveColor=new Color3(.85,.55,.2);glass.material=glassMat;glass.freezeWorldMatrix();
  }

  // 9. Terracotta Flower Planter Boxes & Lush Shrubbery (Images 3, 4, 7)
  const planterLocs:[number,number,number][]=[[-12.5,4.2,-6.05],[-11.5,4.2,5.95],[9.5,4.2,5.95]];
  for(let i=0;i<planterLocs.length;i++) {
    const [px,py,pz]=planterLocs[i];
    box(`planter-shelf-${i}`,px,py-.2,pz,1.55,.08,.55,'#726b5e');
    for(const offset of [-.5,.5])box(`planter-bracket-${i}-${offset}`,px+offset,py-.4,pz,.08,.4,.45,'#464c43');
    // Terracotta rectangular trough
    box(`planter-pot-${i}`,px,py,pz,1.4,.32,.45,'#b05336').freezeWorldMatrix();
    // Mound of vibrant Mediterranean foliage
    box(`planter-bush-${i}`,px,py+.26,pz,1.3,.24,.4,'#355c27').freezeWorldMatrix();
    // Vibrant flower blossoms (red, yellow, orange)
    box(`planter-flower-a-${i}`,px-.35,py+.42,pz,.22,.12,.22,'#c92828').freezeWorldMatrix();
    box(`planter-flower-b-${i}`,px+.35,py+.42,pz,.22,.12,.22,'#e8b62c').freezeWorldMatrix();
  }

  // 10. Striped Shopfront Fabric Awnings & Supply Tarps (Images 3, 5)
  // Pizzeria / Gelateria awning in Mid
  box('mid-shop-awning-red',-6.5,3.15,-2,4.2,.12,1.4,'#a63529').freezeWorldMatrix();
  box('mid-shop-awning-cream',-6.5,3.18,-2,4.0,.13,1.35,'#ebd9ba').freezeWorldMatrix();
  // Blue supply tarp draped over cargo crates at B site
  box('b-site-tarp-blue',15,2.77,26,2.6,.05,3.8,'#2a5b88').freezeWorldMatrix();

  // 11. Stacked Shipping Pallets & Crates (Images 4, 7)
  for(const [palX,palZ] of [[-28,20],[18,-20]]) {
    for(const offset of [-.45,.45])box(`pallet-runner-${palX}-${palZ}-${offset}`,palX+offset,.18,palZ,.12,.36,1.3,'#63472c');
    for(let layer=0;layer<3;layer++) {
      box(`pallet-${palX}-${palZ}-${layer}`,palX,.08+layer*.14,palZ,1.3,.08,1.3,'#8a6845').freezeWorldMatrix();
    }
  }

  // Authentic Mediterranean market crates & supply boxes
  for(const [cx,cz,cy] of [[15.2,-10,.25],[15.2,-9.2,.25],[15.2,-9.6,.65],[-20,-14,.25],[-20,-14,.65],[20.5,14,.25]] as [number,number,number][]) {
    box(`market-crate-${cx}-${cz}-${cy}`,cx,cy,cz,.65,.45,.65,'#8b6538').freezeWorldMatrix();
  }

  // Stone pavement curbings defining streets
  for(const [curbX,curbZ,curbW,curbD] of [
    [14.6,-3,.18,16],[25.4,-3,.18,16],[-3.2,-6,.18,36],[3.2,-6,.18,36],[-10,-14,.18,20]
  ] as [number,number,number,number][]) {
    box(`pavement-curb-${curbX}-${curbZ}`,curbX,.035,curbZ,curbW,.06,curbD,'#756d5e').freezeWorldMatrix();
  }

  // Flush drainage grates and expansion joints: detail without small movement snags.
  for(const [x,z] of [[-19,-14],[0,-10],[20,-15],[31,14],[-23,23],[12,35]]) {
    box(`drain-frame-${x}-${z}`,x,.019,z,.65,.018,1.1,'#575c57');
    for(let i=0;i<7;i++)box(`drain-slot-${x}-${z}-${i}`,x,.03,z-.43+i*.14,.5,.008,.055,'#292f2c');
  }

  // Mortar courses and mooring plates sit against existing cover, never in a lane.
  for(const wall of LIVE_FPS_MAP.solids.filter(w=>w.height>=4&&!w.id.endsWith('wall'))) {
    const x=(wall.minX+wall.maxX)/2,width=wall.maxX-wall.minX;
    for(const face of [-1,1]) {
      const z=face<0?wall.minZ-.045:wall.maxZ+.045;
      for(const y of [.16,.48,.8])box(`${wall.id}-mortar-${face}-${y}`,x,y,z,width,.018,.015,'#766f60');
      box(`${wall.id}-utility-plate-${face}`,x,.95,z,.34,.42,.035,'#555f58');
      for(const offset of [-.11,.11])box(`${wall.id}-plate-bolt-${face}-${offset}`,x+offset,1.08,z+face*.025,.035,.035,.025,'#b3ad96');
    }
  }

  // Merge static facade pieces by material to keep runtime rendering inexpensive
  const groups=new Map<StandardMaterial,Mesh[]>();
  for(const mesh of details){mesh.computeWorldMatrix(true);const mat=mesh.material as StandardMaterial;groups.set(mat,[...(groups.get(mat)??[]),mesh]);}
  const merged:Mesh[]=[];
  for(const group of groups.values()) {
    const mesh=Mesh.MergeMeshes(group,true,true);if(mesh){mesh.isPickable=false;mesh.receiveShadows=false;mesh.freezeWorldMatrix();merged.push(mesh);}
  }

  // Harbor waterfront exterior
  const water=MeshBuilder.CreateGround('harbor-water',{width:48,height:160},scene);water.position.set(64,-.8,0);water.material=material('#427c88');
  const bank=box('harbor-quay',39,-1,0,6,2,110,'#596f74');bank.freezeWorldMatrix();
  const exterior:Mesh[]=[water,bank];
  for(const [x,z,height] of [[-48,-12,12],[-49,27,9],[4,60,13],[29,58,10]] as number[][]) {
    exterior.push(box(`skyline-${x}-${z}`,x,height/2,z,12,height,20,'#8f9d99'));
  }
  for(const z of [-25,22]) {
    const x=51;
    exterior.push(box(`crane-tower-${z}`,x,12,z,1.4,24,1.4,'#bd9862'));
    exterior.push(box(`crane-jib-${z}`,x-7,24,z,20,.9,1,'#bd9862'));
    exterior.push(box(`crane-hook-${z}`,x-15,18,z,.08,11,.08,'#404f56'));
  }
  for(const x of [-37.5,37.5])for(const z of [-34,0,34]) {
    exterior.push(box(`lamp-pole-${x}-${z}`,x,4,z,.16,8,.16,'#465d63'));
    const lamp=box(`lamp-head-${x}-${z}`,x,8,z,1,.18,.5,'#f1d4a1');exterior.push(lamp);
  }
  // 12. Tuscan Hills Cypress Trees along Horizon Skyline (Image 5)
  const cypressMat=material('#203b22');
  for(const [cx,cz] of [[-42,42],[-38,48],[16,56],[24,54],[32,58]] as [number,number][]) {
    const trunk=box(`cypress-trunk-${cx}-${cz}`,cx,1.5,cz,.35,3,.35,'#4d3725');
    const foliage=MeshBuilder.CreateCylinder(`cypress-foliage-${cx}-${cz}`,{height:8,diameterTop:.1,diameterBottom:1.6,tessellation:8},scene);
    foliage.position.set(cx,6,cz);foliage.material=cypressMat;
    exterior.push(trunk,foliage);
  }
  for(const mesh of exterior){mesh.isPickable=false;mesh.freezeWorldMatrix();}

  // Walkway paving ground planes defining tactical avenues
  for(const [name,x,z,width,depth,color] of [
    ['Banana Slipway S',18,-16,7,22,'#857b6a'],
    ['Banana Slipway Mid',20,-3,8,16,'#807666'],
    ['Banana Slipway N',22,8,8,12,'#887d6b'],
    ['B Basin Piazza',23,21,17,17,'#928a78'],
    ['A Quayside Courtyard',-23,21,18,22,'#968c77'],
    ['Mid Lane Paving',0,-6,6,48,'#8e9688'],
    ['Second Mid Canal',-8,-14,4,22,'#7c8682'],
    ['Underpass Sluice Paving',-4.75,-10,4.5,4,'#67706d'],
    ['Speedway Dock Paving',12,35,24,5,'#828d92'],
  ] as [string,number,number,number,number,string][]) {
    const lane=MeshBuilder.CreateGround(name,{width,height:depth},scene);lane.position.set(x,.012,z);lane.material=material(color);lane.receiveShadows=true;lane.isPickable=false;
  }

  // Wayfinding text markers on the ground
  for(const [label,x,z] of [
    ['A MAIN',-19,-9],['BANANA',18,-15],['CAR / SANDBAGS',20,-1],
    ['MID',0,-21],['UNDERPASS',-4.75,-10],['MID CROSS',0,2],['SPEEDWAY',12,35]
  ] as [string,number,number][]) {
    const mark=MeshBuilder.CreateGround(`wayfinding-${label}`,{width:4.5,height:1.4},scene);mark.position.set(x,.028,z);
    const mat=new StandardMaterial(`wayfinding-material-${label}`,scene),tex=new DynamicTexture(`wayfinding-text-${label}`,{width:512,height:128},scene,false);
    tex.hasAlpha=true;tex.drawText(label,null,82,'bold 52px sans-serif','#ded4b6','transparent',true);mat.diffuseTexture=tex;mat.useAlphaFromDiffuseTexture=true;mat.specularColor=Color3.Black();mark.material=mat;mark.isPickable=false;
  }

  // Stenciled Banana sign with icon on Banana corner (Image 6)
  const bSign=MeshBuilder.CreatePlane('sign-banana-wall',{width:3.2,height:2},scene);
  bSign.position.set(14.035,2.4,-8);bSign.rotation.y=Math.PI/2;
  const bMat=new StandardMaterial('sign-banana-mat',scene),bTex=new DynamicTexture('sign-banana-tex',{width:512,height:320},scene,false);
  bTex.drawText('BANANA',null,120,'bold 64px sans-serif','#f4d35e','#2a2d30',true);
  bTex.drawText('➔ B SITE',null,240,'bold 48px sans-serif','#ffffff','transparent',true);
  bMat.diffuseTexture=bTex;bMat.backFaceCulling=false;bMat.specularColor=Color3.Black();bSign.material=bMat;bSign.isPickable=false;

  // Stenciled "B ➔" directional spray on wall (Image 6)
  const bArrow=MeshBuilder.CreatePlane('sign-b-arrow',{width:2.2,height:1.6},scene);
  bArrow.position.set(16.035,2.5,14);bArrow.rotation.y=Math.PI/2;
  const baMat=new StandardMaterial('sign-b-arrow-mat',scene),baTex=new DynamicTexture('sign-b-arrow-tex',{width:256,height:256},scene,false);
  baTex.hasAlpha=true;baTex.drawText('B ➔',null,160,'bold 110px sans-serif','#d9483b','transparent',true);
  baMat.diffuseTexture=baTex;baMat.useAlphaFromDiffuseTexture=true;baMat.specularColor=Color3.Black();bArrow.material=baMat;bArrow.isPickable=false;

  // District overhead banners
  for(const [label,x,z] of [['A · QUAYSIDE / PIT',-23,45.96],['B · FOUNTAIN BASIN',23,45.96],['HEXATRICK  /  BREAKWATER',0,-45.96]] as [string,number,number][]) {
    const sign=MeshBuilder.CreatePlane(`sign-${label}`,{width:11,height:1.8},scene);sign.position.set(x,3.6,z);sign.rotation.y=z<0?Math.PI:0;
    const mat=new StandardMaterial(`sign-material-${label}`,scene),tex=new DynamicTexture(`sign-text-${label}`,{width:1024,height:192},scene,false);
    tex.drawText(label,null,115,'bold 44px sans-serif','#e4dac0','#253e48',true);mat.diffuseTexture=tex;mat.backFaceCulling=false;mat.specularColor=Color3.Black();sign.material=mat;sign.isPickable=false;
  }
  return merged;
}
