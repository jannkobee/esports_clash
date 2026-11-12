import { Engine, Scene, FreeCamera, Viewport, Vector3, Color3, Color4, HemisphericLight, DirectionalLight, StandardMaterial, MeshBuilder, DynamicTexture, ShadowGenerator, TransformNode, type Mesh, type LinesMesh } from '@babylonjs/core';
import { LIVE_FPS_MAP } from './fpsLiveMap.ts';
import { segmentHitsWall } from './fpsSpatialWorld.ts';
import type { LiveSnapshot, LivePlayer } from './fpsLiveSimulation.ts';
import { buildLiveScenery } from './fpsLiveScenery.ts';
import { LIVE_KNIFE, type LiveEquippedWeapon } from './fpsLiveWeapons.ts';
import { LIVE_WEAPONS } from './fpsLiveWeapons.ts';
import type { FpsTeamId } from './fpsTypes.ts';
import {
  computeBombPlantPipPose,
  computeOverviewCameraPose,
  computeThirdPersonCameraPose,
  createDirectorState,
  evaluateBroadcastDirector,
  type BombPlantPipState,
  type DirectorState,
  type LiveCameraMode,
  type NormalizedViewport,
} from './fpsBroadcastDirector.ts';

export type { LiveCameraMode, BombPlantPipState, NormalizedViewport };
export interface LiveRenderResult {
  followedId: string;
  effectiveMode: Exclude<LiveCameraMode, 'director'>;
  pip: BombPlantPipState;
}
const blue='#4bc5ef',red='#ed8d68';
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const ease01=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};

interface OperativeView {
  root: TransformNode;
  spine: TransformNode;
  headPivot: TransformNode;
  leftArmPivot: TransformNode;
  rightArmPivot: TransformNode;
  leftLegPivot: TransformNode;
  rightLegPivot: TransformNode;
  leftKneePivot: TransformNode;
  rightKneePivot: TransformNode;
  torso: Mesh;
  leftLeg: Mesh;
  rightLeg: Mesh;
  leftArm: Mesh;
  rightArm: Mesh;
  head: Mesh;
  magazine: Mesh;
  crouchPose: number;
  stridePhase: number;
  lastX:number;
  lastZ:number;
  hasMotion:boolean;
}

interface ActorView {
  operative: OperativeView;
  gunNode?: TransformNode;
  gunWeapon?: LiveEquippedWeapon;
  muzzleFlash?:Mesh;
}

interface SmokeView { root:TransformNode; lobes:Mesh[]; material:StandardMaterial; phases:number[] }
interface FireView { root:TransformNode; ground:Mesh; groundFlames:Mesh[]; groundFlameMaterials:StandardMaterial[]; flames:Mesh[]; groundMaterial:StandardMaterial; flameMaterials:StandardMaterial[] }
interface ViewmodelReloadParts { arm:TransformNode; magazine:Mesh }
interface WeaponViewMetadata {muzzle?:TransformNode;reloadParts?:ViewmodelReloadParts;name?:string}
interface TracerView {world:LinesMesh;firstPerson?:LinesMesh;actorId:string}

function createTacticalOperativeMesh(team: FpsTeamId, id: string, scene: Scene, getMat: (hex: string) => StandardMaterial): OperativeView {
  const root = new TransformNode(`operative-${id}`, scene);
  const spine = new TransformNode(`${id}-spine-pivot`, scene); spine.parent=root; spine.position.set(0,1.05,0);
  const headPivot = new TransformNode(`${id}-head-pivot`, scene); headPivot.parent=root; headPivot.position.set(0,1.54,0);
  const leftArmPivot = new TransformNode(`${id}-arm-l-pivot`, scene); leftArmPivot.parent=root; leftArmPivot.position.set(-.28,1.31,0);
  const rightArmPivot = new TransformNode(`${id}-arm-r-pivot`, scene); rightArmPivot.parent=root; rightArmPivot.position.set(.28,1.31,0);
  const leftLegPivot = new TransformNode(`${id}-leg-l-pivot`, scene); leftLegPivot.parent=root; leftLegPivot.position.set(-.11,.74,0);
  const rightLegPivot = new TransformNode(`${id}-leg-r-pivot`, scene); rightLegPivot.parent=root; rightLegPivot.position.set(.11,.74,0);
  const leftKneePivot = new TransformNode(`${id}-knee-l-pivot`, scene); leftKneePivot.parent=leftLegPivot; leftKneePivot.position.set(0,-.36,0);
  const rightKneePivot = new TransformNode(`${id}-knee-r-pivot`, scene); rightKneePivot.parent=rightLegPivot; rightKneePivot.position.set(0,-.36,0);

  const add = (m: Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const name=m.name;
    const parent=name.includes('head')||name.includes('helmet')||name.includes('goggles')||name.includes('faceslit')||name.includes('shades')||name.includes('beanie')?headPivot
      :name.includes('arm-l')||name.includes('glove-l')||name.includes('bare-l')?leftArmPivot
      :name.includes('arm-r')||name.includes('glove-r')||name.includes('bare-r')?rightArmPivot
      :name.includes('leg-l')||name.includes('pocket-l')?leftLegPivot
      :name.includes('leg-r')||name.includes('pocket-r')?rightLegPivot
      :spine;
    m.parent = parent;
    m.position.set(x-parent.position.x, y-parent.position.y, z-parent.position.z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    m.isPickable = false;
    m.receiveShadows = true;
    return m;
  };
  const addKneePart = (m:Mesh,pivot:TransformNode,x:number,y:number,z:number) => {
    m.parent=pivot;m.position.set(x,y,z);m.isPickable=false;m.receiveShadows=true;return m;
  };

  if (team === 'blue') {
    // CT Force (Counter-Terrorist Operative / Tactical Navy Plate Carrier)
    const navy = getMat('#182633');
    const plateCarrier = getMat('#111a24');
    const helmetMat = getMat('#15202b');
    const cyanPatch = getMat('#0ea5e9');
    const visorMat = getMat('#38bdf8');
    const darkGear = getMat('#0b0e12');

    const torso = MeshBuilder.CreateBox(`${id}-torso`, { width: 0.44, height: 0.54, depth: 0.28 }, scene);
    torso.material = navy; add(torso, 0, 1.05, 0);

    const vest = MeshBuilder.CreateBox(`${id}-vest`, { width: 0.47, height: 0.46, depth: 0.32 }, scene);
    vest.material = plateCarrier; add(vest, 0, 1.07, 0);

    const pouches = MeshBuilder.CreateBox(`${id}-pouches`, { width: 0.32, height: 0.16, depth: 0.08 }, scene);
    pouches.material = darkGear; add(pouches, 0, 0.96, 0.18);

    const radio = MeshBuilder.CreateBox(`${id}-radio`, { width: 0.08, height: 0.16, depth: 0.08 }, scene);
    radio.material = darkGear; add(radio, -0.18, 1.18, 0.14);

    const shoulderL=MeshBuilder.CreateSphere(`${id}-shoulder-l`,{diameter:.25,segments:8},scene);
    shoulderL.scaling.set(1,.68,1.18);shoulderL.material=plateCarrier;add(shoulderL,-.25,1.28,0);
    const shoulderR=MeshBuilder.CreateSphere(`${id}-shoulder-r`,{diameter:.25,segments:8},scene);
    shoulderR.scaling.set(1,.68,1.18);shoulderR.material=plateCarrier;add(shoulderR,.25,1.28,0);

    const patchL = MeshBuilder.CreateBox(`${id}-patch-l`, { width: 0.02, height: 0.09, depth: 0.08 }, scene);
    patchL.material = cyanPatch; add(patchL, -0.23, 1.22, 0);

    const patchR = MeshBuilder.CreateBox(`${id}-patch-r`, { width: 0.02, height: 0.09, depth: 0.08 }, scene);
    patchR.material = cyanPatch; add(patchR, 0.23, 1.22, 0);

    const head = MeshBuilder.CreateSphere(`${id}-head`, { diameter: 0.28, segments: 8 }, scene);
    head.material = navy; add(head, 0, 1.54, 0);

    const helmet = MeshBuilder.CreateSphere(`${id}-helmet`, { diameter: 0.32, segments: 10 }, scene);
    helmet.scaling.y = 0.85; helmet.material = helmetMat; add(helmet, 0, 1.58, 0);

    const goggles = MeshBuilder.CreateBox(`${id}-goggles`, { width: 0.22, height: 0.065, depth: 0.12 }, scene);
    goggles.material = visorMat; add(goggles, 0, 1.54, 0.12);

    const gogglesBand = MeshBuilder.CreateBox(`${id}-goggles-band`, { width: 0.31, height: 0.04, depth: 0.28 }, scene);
    gogglesBand.material = darkGear; add(gogglesBand, 0, 1.54, 0);

    const leftLeg = MeshBuilder.CreateBox(`${id}-leg-l`, { width: 0.15, height: 0.36, depth: 0.17 }, scene);
    leftLeg.material = navy; add(leftLeg, -0.11, 0.56, 0);

    const rightLeg = MeshBuilder.CreateBox(`${id}-leg-r`, { width: 0.15, height: 0.36, depth: 0.17 }, scene);
    rightLeg.material = navy; add(rightLeg, 0.11, 0.56, 0);

    const leftShin=MeshBuilder.CreateBox(`${id}-shin-l`,{width:.14,height:.36,depth:.16},scene);leftShin.material=navy;addKneePart(leftShin,leftKneePivot,0,-.18,0);
    const rightShin=MeshBuilder.CreateBox(`${id}-shin-r`,{width:.14,height:.36,depth:.16},scene);rightShin.material=navy;addKneePart(rightShin,rightKneePivot,0,-.18,0);

    const kneeL = MeshBuilder.CreateBox(`${id}-knee-l`, { width: 0.16, height: 0.12, depth: 0.06 }, scene);
    kneeL.material = darkGear; addKneePart(kneeL,leftKneePivot,0,0,.09);

    const kneeR = MeshBuilder.CreateBox(`${id}-knee-r`, { width: 0.16, height: 0.12, depth: 0.06 }, scene);
    kneeR.material = darkGear; addKneePart(kneeR,rightKneePivot,0,0,.09);

    const bootL = MeshBuilder.CreateBox(`${id}-boot-l`, { width: 0.16, height: 0.16, depth: 0.24 }, scene);
    bootL.material = darkGear; addKneePart(bootL,leftKneePivot,0,-.27,.03);

    const bootR = MeshBuilder.CreateBox(`${id}-boot-r`, { width: 0.16, height: 0.16, depth: 0.24 }, scene);
    bootR.material = darkGear; addKneePart(bootR,rightKneePivot,0,-.27,.03);

    const leftArm = MeshBuilder.CreateBox(`${id}-arm-l`, { width: 0.13, height: 0.52, depth: 0.14 }, scene);
    leftArm.material = navy; add(leftArm, -0.28, 1.05, 0);

    const rightArm = MeshBuilder.CreateBox(`${id}-arm-r`, { width: 0.13, height: 0.52, depth: 0.14 }, scene);
    rightArm.material = navy; add(rightArm, 0.28, 1.05, 0);

    const gloveL = MeshBuilder.CreateBox(`${id}-glove-l`, { width: 0.135, height: 0.14, depth: 0.145 }, scene);
    gloveL.material = darkGear; add(gloveL, -0.28, 0.84, 0);

    const gloveR = MeshBuilder.CreateBox(`${id}-glove-r`, { width: 0.135, height: 0.14, depth: 0.145 }, scene);
    gloveR.material = darkGear; add(gloveR, 0.28, 0.84, 0);

    const magazine=MeshBuilder.CreateBox(`${id}-reload-magazine`,{width:.07,height:.18,depth:.055},scene);
    magazine.material=darkGear;magazine.parent=root;magazine.isPickable=false;magazine.setEnabled(false);
    return { root,spine,headPivot,leftArmPivot,rightArmPivot,leftLegPivot,rightLegPivot,leftKneePivot,rightKneePivot,torso,leftLeg,rightLeg,leftArm,rightArm,head,magazine,crouchPose:0,stridePhase:id.length*.7,lastX:0,lastZ:0,hasMotion:false };
  } else {
    // T Force (Terrorist Strike Force / Militia Guerrilla Jacket & Balaclava)
    const crimsonShirt = getMat('#832720');
    const harnessMat = getMat('#34261c');
    const olivePants = getMat('#444d36');
    const balaclavaMat = getMat('#202224');
    const skinMat = getMat('#cf9d76');
    const darkShades = getMat('#121314');
    const redArmband = getMat('#ef4444');
    const bootsMat = getMat('#181615');

    const torso = MeshBuilder.CreateBox(`${id}-torso`, { width: 0.44, height: 0.54, depth: 0.28 }, scene);
    torso.material = crimsonShirt; add(torso, 0, 1.05, 0);

    const harness = MeshBuilder.CreateBox(`${id}-harness`, { width: 0.47, height: 0.44, depth: 0.31 }, scene);
    harness.material = harnessMat; add(harness, 0, 1.07, 0);

    const strap = MeshBuilder.CreateBox(`${id}-strap`, { width: 0.12, height: 0.56, depth: 0.32 }, scene);
    strap.material = harnessMat; add(strap, 0.04, 1.06, 0, 0, 0, 0.28);

    const collar=MeshBuilder.CreateBox(`${id}-jacket-collar`,{width:.32,height:.12,depth:.28},scene);
    collar.material=crimsonShirt;add(collar,0,1.34,0);

    const pouches = MeshBuilder.CreateBox(`${id}-pouches`, { width: 0.34, height: 0.15, depth: 0.08 }, scene);
    pouches.material = harnessMat; add(pouches, 0, 0.95, 0.18);

    const armband = MeshBuilder.CreateBox(`${id}-armband`, { width: 0.03, height: 0.1, depth: 0.16 }, scene);
    armband.material = redArmband; add(armband, -0.28, 1.18, 0);

    const head = MeshBuilder.CreateSphere(`${id}-head`, { diameter: 0.28, segments: 8 }, scene);
    head.material = balaclavaMat; add(head, 0, 1.54, 0);

    const faceSlit = MeshBuilder.CreateBox(`${id}-faceslit`, { width: 0.16, height: 0.055, depth: 0.12 }, scene);
    faceSlit.material = skinMat; add(faceSlit, 0, 1.54, 0.1);

    const sunglasses = MeshBuilder.CreateBox(`${id}-shades`, { width: 0.18, height: 0.04, depth: 0.11 }, scene);
    sunglasses.material = darkShades; add(sunglasses, 0, 1.55, 0.12);

    const beanie = MeshBuilder.CreateSphere(`${id}-beanie`, { diameter: 0.3, segments: 8 }, scene);
    beanie.scaling.y = 0.75; beanie.material = balaclavaMat; add(beanie, 0, 1.62, 0);

    const leftLeg = MeshBuilder.CreateBox(`${id}-leg-l`, { width: 0.15, height: 0.36, depth: 0.17 }, scene);
    leftLeg.material = olivePants; add(leftLeg, -0.11, 0.56, 0);

    const rightLeg = MeshBuilder.CreateBox(`${id}-leg-r`, { width: 0.15, height: 0.36, depth: 0.17 }, scene);
    rightLeg.material = olivePants; add(rightLeg, 0.11, 0.56, 0);

    const leftShin=MeshBuilder.CreateBox(`${id}-shin-l`,{width:.14,height:.36,depth:.16},scene);leftShin.material=olivePants;addKneePart(leftShin,leftKneePivot,0,-.18,0);
    const rightShin=MeshBuilder.CreateBox(`${id}-shin-r`,{width:.14,height:.36,depth:.16},scene);rightShin.material=olivePants;addKneePart(rightShin,rightKneePivot,0,-.18,0);

    const pocketL = MeshBuilder.CreateBox(`${id}-pocket-l`, { width: 0.05, height: 0.15, depth: 0.15 }, scene);
    pocketL.material = olivePants; add(pocketL, -0.18, 0.45, 0);

    const pocketR = MeshBuilder.CreateBox(`${id}-pocket-r`, { width: 0.05, height: 0.15, depth: 0.15 }, scene);
    pocketR.material = olivePants; add(pocketR, 0.18, 0.45, 0);

    const bootL = MeshBuilder.CreateBox(`${id}-boot-l`, { width: 0.16, height: 0.16, depth: 0.24 }, scene);
    bootL.material = bootsMat; addKneePart(bootL,leftKneePivot,0,-.27,.03);

    const bootR = MeshBuilder.CreateBox(`${id}-boot-r`, { width: 0.16, height: 0.16, depth: 0.24 }, scene);
    bootR.material = bootsMat; addKneePart(bootR,rightKneePivot,0,-.27,.03);

    const leftArm = MeshBuilder.CreateBox(`${id}-arm-l`, { width: 0.13, height: 0.52, depth: 0.14 }, scene);
    leftArm.material = crimsonShirt; add(leftArm, -0.28, 1.05, 0);

    const rightArm = MeshBuilder.CreateBox(`${id}-arm-r`, { width: 0.13, height: 0.52, depth: 0.14 }, scene);
    rightArm.material = crimsonShirt; add(rightArm, 0.28, 1.05, 0);

    const bareL = MeshBuilder.CreateBox(`${id}-bare-l`, { width: 0.11, height: 0.14, depth: 0.12 }, scene);
    bareL.material = skinMat; add(bareL, -0.28, 0.88, 0);

    const bareR = MeshBuilder.CreateBox(`${id}-bare-r`, { width: 0.11, height: 0.14, depth: 0.12 }, scene);
    bareR.material = skinMat; add(bareR, 0.28, 0.88, 0);

    const gloveL = MeshBuilder.CreateBox(`${id}-glove-l`, { width: 0.13, height: 0.12, depth: 0.14 }, scene);
    gloveL.material = bootsMat; add(gloveL, -0.28, 0.76, 0);

    const gloveR = MeshBuilder.CreateBox(`${id}-glove-r`, { width: 0.13, height: 0.12, depth: 0.14 }, scene);
    gloveR.material = bootsMat; add(gloveR, 0.28, 0.76, 0);

    const magazine=MeshBuilder.CreateBox(`${id}-reload-magazine`,{width:.07,height:.18,depth:.055},scene);
    magazine.material=bootsMat;magazine.parent=root;magazine.isPickable=false;magazine.setEnabled(false);
    return { root,spine,headPivot,leftArmPivot,rightArmPivot,leftLegPivot,rightLegPivot,leftKneePivot,rightKneePivot,torso,leftLeg,rightLeg,leftArm,rightArm,head,magazine,crouchPose:0,stridePhase:id.length*.7,lastX:0,lastZ:0,hasMotion:false };
  }
}

export function create3DWeaponMesh(weapon: LiveEquippedWeapon, id: string, scene: Scene, getMat: (hex: string) => StandardMaterial): TransformNode {
  const root = new TransformNode(`weapon-${id}`, scene);
  const darkMetal = getMat('#1a1c20');
  const gunmetal = getMat('#2d3238');
  const wood = getMat('#4e3725');
  const olive = getMat('#333d32');
  const silver = getMat('#8a9199');

  const add = (m: Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    m.parent = root;
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    m.isPickable = false;
    return m;
  };

  if (weapon === 'knife') {
    const grip=MeshBuilder.CreateBox(`${id}-knife-grip`,{width:.04,height:.045,depth:.13},scene);
    grip.material=darkMetal;add(grip,0,0,0);
    const guard=MeshBuilder.CreateBox(`${id}-knife-guard`,{width:.1,height:.025,depth:.02},scene);
    guard.material=gunmetal;add(guard,0,0,.075);
    const blade=MeshBuilder.CreateCylinder(`${id}-knife-blade`,{height:.25,diameterTop:0,diameterBottom:.065,tessellation:4},scene);
    blade.scaling.z=.18;blade.material=silver;add(blade,0,0,.21,Math.PI/2);
    root.metadata={name:LIVE_KNIFE.name};
  } else if (weapon === 'flash' || weapon === 'smoke' || weapon === 'incendiary') {
    const can = MeshBuilder.CreateCylinder(`${id}-grenade-body`, { height: .13, diameter: .062, tessellation: 12 }, scene);
    can.material = weapon === 'flash' ? darkMetal : weapon==='incendiary'?getMat('#d84a19'):olive; add(can, 0, 0, 0);
    const cap = MeshBuilder.CreateCylinder(`${id}-grenade-cap`, { height: .025, diameter: .038, tessellation: 10 }, scene);
    cap.material = gunmetal; add(cap, 0, .075, 0);
    const lever = MeshBuilder.CreateBox(`${id}-grenade-lever`, { width: .018, height: .09, depth: .035 }, scene);
    lever.material = silver; add(lever, .025, .02, 0);
    const ring = MeshBuilder.CreateTorus(`${id}-grenade-pin`, { diameter: .028, thickness: .005, tessellation: 8 }, scene);
    ring.material = silver; add(ring, -.025, .075, 0);
  } else if (weapon === 'usp_s') {
    const slide = MeshBuilder.CreateBox(`${id}-slide`, { width: 0.042, height: 0.052, depth: 0.20 }, scene);
    slide.material = darkMetal; add(slide, 0, 0.028, 0.02);
    const grip = MeshBuilder.CreateBox(`${id}-grip`, { width: 0.038, height: 0.12, depth: 0.055 }, scene);
    grip.material = darkMetal; add(grip, 0, -0.05, -0.03, 0.2, 0, 0);
    const silencer = MeshBuilder.CreateCylinder(`${id}-silencer`, { height: 0.19, diameter: 0.038 }, scene);
    silencer.material = darkMetal; add(silencer, 0, 0.038, 0.21, Math.PI / 2, 0, 0);
  } else if (weapon === 'deagle') {
    const slide = MeshBuilder.CreateBox(`${id}-slide`, { width: 0.052, height: 0.065, depth: 0.26 }, scene);
    slide.material = silver; add(slide, 0, 0.032, 0.04);
    const frame = MeshBuilder.CreateBox(`${id}-frame`, { width: 0.048, height: 0.04, depth: 0.24 }, scene);
    frame.material = gunmetal; add(frame, 0, -0.015, 0.03);
    const grip = MeshBuilder.CreateBox(`${id}-grip`, { width: 0.045, height: 0.13, depth: 0.065 }, scene);
    grip.material = darkMetal; add(grip, 0, -0.065, -0.03, 0.24, 0, 0);
    const barrel = MeshBuilder.CreateCylinder(`${id}-barrel`, { height: 0.08, diameter: 0.032 }, scene);
    barrel.material = silver; add(barrel, 0, 0.04, 0.20, Math.PI / 2, 0, 0);
  } else if (weapon === 'm4a1_s') {
    const rec = MeshBuilder.CreateBox(`${id}-rec`, { width: 0.052, height: 0.078, depth: 0.30 }, scene);
    rec.material = darkMetal; add(rec, 0, 0.03, 0);
    const guard = MeshBuilder.CreateCylinder(`${id}-guard`, { height: 0.18, diameter: 0.046 }, scene);
    guard.material = darkMetal; add(guard, 0, 0.035, 0.22, Math.PI / 2, 0, 0);
    const silencer = MeshBuilder.CreateCylinder(`${id}-silencer`, { height: 0.24, diameter: 0.040 }, scene);
    silencer.material = darkMetal; add(silencer, 0, 0.035, 0.42, Math.PI / 2, 0, 0);
    const mag = MeshBuilder.CreateBox(`${id}-mag`, { width: 0.034, height: 0.16, depth: 0.055 }, scene);
    mag.material = gunmetal; add(mag, 0, -0.075, 0.07, -0.2, 0, 0);
    const stock = MeshBuilder.CreateBox(`${id}-stock`, { width: 0.045, height: 0.095, depth: 0.18 }, scene);
    stock.material = darkMetal; add(stock, 0, 0.01, -0.22);
    const handle = MeshBuilder.CreateBox(`${id}-handle`, { width: 0.032, height: 0.045, depth: 0.14 }, scene);
    handle.material = darkMetal; add(handle, 0, 0.085, 0.02);
  } else if (weapon === 'ak47' || weapon === 'rifle') {
    const receiver = MeshBuilder.CreateBox(`${id}-rec`, { width: 0.055, height: 0.08, depth: 0.32 }, scene);
    receiver.material = darkMetal; add(receiver, 0, 0.03, 0);
    const handguard = MeshBuilder.CreateBox(`${id}-guard`, { width: 0.06, height: 0.075, depth: 0.22 }, scene);
    handguard.material = wood; add(handguard, 0, 0.03, 0.24);
    const barrel = MeshBuilder.CreateCylinder(`${id}-barrel`, { height: 0.22, diameter: 0.024 }, scene);
    barrel.material = silver; add(barrel, 0, 0.035, 0.44, Math.PI / 2, 0, 0);
    const muzzle = MeshBuilder.CreateCylinder(`${id}-muzzle`, { height: 0.05, diameter: 0.032 }, scene);
    muzzle.material = gunmetal; add(muzzle, 0, 0.035, 0.56, Math.PI / 2, 0, 0);
    const grip = MeshBuilder.CreateBox(`${id}-grip`, { width: 0.044, height: 0.14, depth: 0.058 }, scene);
    grip.material = wood; add(grip, 0, -0.065, -0.06, 0.3, 0, 0);
    const mag = MeshBuilder.CreateBox(`${id}-mag`, { width: 0.038, height: 0.20, depth: 0.072 }, scene);
    mag.material = gunmetal; add(mag, 0, -0.085, 0.09, -0.32, 0, 0);
    const stock = MeshBuilder.CreateBox(`${id}-stock`, { width: 0.05, height: 0.11, depth: 0.2 }, scene);
    stock.material = wood; add(stock, 0, 0.01, -0.24);
  } else if (weapon === 'mp9') {
    const rec = MeshBuilder.CreateBox(`${id}-rec`, { width: 0.048, height: 0.072, depth: 0.28 }, scene);
    rec.material = darkMetal; add(rec, 0, 0.025, 0.04);
    const foregrip = MeshBuilder.CreateBox(`${id}-fgrip`, { width: 0.036, height: 0.10, depth: 0.042 }, scene);
    foregrip.material = darkMetal; add(foregrip, 0, -0.05, 0.14);
    const barrel = MeshBuilder.CreateCylinder(`${id}-barrel`, { height: 0.08, diameter: 0.026 }, scene);
    barrel.material = silver; add(barrel, 0, 0.035, 0.20, Math.PI / 2, 0, 0);
    const mag = MeshBuilder.CreateBox(`${id}-mag`, { width: 0.032, height: 0.18, depth: 0.042 }, scene);
    mag.material = gunmetal; add(mag, 0, -0.08, 0.02, 0.2, 0, 0);
  } else if (weapon === 'mac10') {
    const rec = MeshBuilder.CreateBox(`${id}-rec`, { width: 0.050, height: 0.075, depth: 0.26 }, scene);
    rec.material = gunmetal; add(rec, 0, 0.025, 0.02);
    const barrel = MeshBuilder.CreateCylinder(`${id}-barrel`, { height: 0.08, diameter: 0.024 }, scene);
    barrel.material = silver; add(barrel, 0, 0.03, 0.18, Math.PI / 2, 0, 0);
    const mag = MeshBuilder.CreateBox(`${id}-mag`, { width: 0.032, height: 0.20, depth: 0.042 }, scene);
    mag.material = darkMetal; add(mag, 0, -0.09, -0.02, 0.15, 0, 0);
  } else if (weapon === 'mag7') {
    const rec = MeshBuilder.CreateBox(`${id}-rec`, { width: 0.055, height: 0.095, depth: 0.34 }, scene);
    rec.material = darkMetal; add(rec, 0, 0.03, 0.04);
    const barrel = MeshBuilder.CreateCylinder(`${id}-barrel`, { height: 0.14, diameter: 0.032 }, scene);
    barrel.material = silver; add(barrel, 0, 0.045, 0.26, Math.PI / 2, 0, 0);
    const pump = MeshBuilder.CreateCylinder(`${id}-pump`, { height: 0.10, diameter: 0.042 }, scene);
    pump.material = gunmetal; add(pump, 0, 0.015, 0.22, Math.PI / 2, 0, 0);
    const grip = MeshBuilder.CreateBox(`${id}-grip`, { width: 0.044, height: 0.14, depth: 0.058 }, scene);
    grip.material = darkMetal; add(grip, 0, -0.065, -0.08, 0.25, 0, 0);
  } else if (weapon === 'nova') {
    const rec = MeshBuilder.CreateBox(`${id}-rec`, { width: 0.052, height: 0.085, depth: 0.38 }, scene);
    rec.material = darkMetal; add(rec, 0, 0.03, 0);
    const barrel = MeshBuilder.CreateCylinder(`${id}-barrel`, { height: 0.35, diameter: 0.028 }, scene);
    barrel.material = silver; add(barrel, 0, 0.042, 0.36, Math.PI / 2, 0, 0);
    const pump = MeshBuilder.CreateCylinder(`${id}-pump`, { height: 0.14, diameter: 0.044 }, scene);
    pump.material = gunmetal; add(pump, 0, 0.015, 0.28, Math.PI / 2, 0, 0);
    const stock = MeshBuilder.CreateBox(`${id}-stock`, { width: 0.048, height: 0.10, depth: 0.22 }, scene);
    stock.material = darkMetal; add(stock, 0, 0.01, -0.26);
  } else if (weapon === 'negev') {
    const rec = MeshBuilder.CreateBox(`${id}-rec`, { width: 0.065, height: 0.095, depth: 0.42 }, scene);
    rec.material = darkMetal; add(rec, 0, 0.035, 0.02);
    const shroud = MeshBuilder.CreateCylinder(`${id}-shroud`, { height: 0.26, diameter: 0.048 }, scene);
    shroud.material = gunmetal; add(shroud, 0, 0.04, 0.34, Math.PI / 2, 0, 0);
    const drum = MeshBuilder.CreateCylinder(`${id}-drum`, { height: 0.08, diameter: 0.15 }, scene);
    drum.material = olive; add(drum, 0, -0.075, 0.06, 0, 0, Math.PI / 2);
    const handle = MeshBuilder.CreateBox(`${id}-handle`, { width: 0.03, height: 0.06, depth: 0.16 }, scene);
    handle.material = gunmetal; add(handle, 0, 0.10, 0.12);
  } else if (weapon === 'scout') {
    const chassis = MeshBuilder.CreateBox(`${id}-chassis`, { width: 0.055, height: 0.075, depth: 0.44 }, scene);
    chassis.material = gunmetal; add(chassis, 0, 0.025, 0.04);
    const barrel = MeshBuilder.CreateCylinder(`${id}-barrel`, { height: 0.42, diameter: 0.024 }, scene);
    barrel.material = silver; add(barrel, 0, 0.035, 0.46, Math.PI / 2, 0, 0);
    const scopeTube = MeshBuilder.CreateCylinder(`${id}-scope`, { height: 0.24, diameter: 0.038 }, scene);
    scopeTube.material = darkMetal; add(scopeTube, 0, 0.095, 0.04, Math.PI / 2, 0, 0);
  } else if (weapon === 'pistol' || weapon === 'glock') {
    const slide = MeshBuilder.CreateBox(`${id}-slide`, { width: 0.045, height: 0.055, depth: 0.22 }, scene);
    slide.material = gunmetal; add(slide, 0, 0.028, 0.04);
    const grip = MeshBuilder.CreateBox(`${id}-grip`, { width: 0.04, height: 0.12, depth: 0.055 }, scene);
    grip.material = darkMetal; add(grip, 0, -0.05, -0.02, 0.2, 0, 0);
    const barrel = MeshBuilder.CreateCylinder(`${id}-barrel`, { height: 0.06, diameter: 0.022 }, scene);
    barrel.material = silver; add(barrel, 0, 0.038, 0.16, Math.PI / 2, 0, 0);
  } else if (weapon === 'smg') {
    const receiver = MeshBuilder.CreateBox(`${id}-rec`, { width: 0.052, height: 0.075, depth: 0.36 }, scene);
    receiver.material = darkMetal; add(receiver, 0, 0.025, 0.06);
    const grip = MeshBuilder.CreateBox(`${id}-grip`, { width: 0.042, height: 0.13, depth: 0.055 }, scene);
    grip.material = darkMetal; add(grip, 0, -0.055, -0.04, 0.25, 0, 0);
    const mag = MeshBuilder.CreateBox(`${id}-mag`, { width: 0.032, height: 0.18, depth: 0.048 }, scene);
    mag.material = gunmetal; add(mag, 0, -0.075, 0.08, -0.25, 0, 0);
    const shroud = MeshBuilder.CreateCylinder(`${id}-shroud`, { height: 0.14, diameter: 0.035 }, scene);
    shroud.material = gunmetal; add(shroud, 0, 0.03, 0.28, Math.PI / 2, 0, 0);
    const stock = MeshBuilder.CreateBox(`${id}-stock`, { width: 0.038, height: 0.06, depth: 0.15 }, scene);
    stock.material = darkMetal; add(stock, 0, 0.015, -0.18);
  } else {
    // SR-7 Sniper Rifle (heavy long chassis, elevated optical scope, muzzle brake)
    const chassis = MeshBuilder.CreateBox(`${id}-chassis`, { width: 0.065, height: 0.085, depth: 0.5 }, scene);
    chassis.material = olive; add(chassis, 0, 0.03, 0.05);
    const longBarrel = MeshBuilder.CreateCylinder(`${id}-barrel`, { height: 0.48, diameter: 0.028 }, scene);
    longBarrel.material = gunmetal; add(longBarrel, 0, 0.038, 0.52, Math.PI / 2, 0, 0);
    const brake = MeshBuilder.CreateBox(`${id}-brake`, { width: 0.045, height: 0.045, depth: 0.08 }, scene);
    brake.material = darkMetal; add(brake, 0, 0.038, 0.78);
    const scopeTube = MeshBuilder.CreateCylinder(`${id}-scope`, { height: 0.28, diameter: 0.044 }, scene);
    scopeTube.material = darkMetal; add(scopeTube, 0, 0.11, 0.04, Math.PI / 2, 0, 0);
    const scopeLens = MeshBuilder.CreateCylinder(`${id}-lens`, { height: 0.05, diameter: 0.056 }, scene);
    scopeLens.material = gunmetal; add(scopeLens, 0, 0.11, 0.18, Math.PI / 2, 0, 0);
    const mount = MeshBuilder.CreateBox(`${id}-mount`, { width: 0.03, height: 0.04, depth: 0.16 }, scene);
    mount.material = darkMetal; add(mount, 0, 0.075, 0.04);
    const grip = MeshBuilder.CreateBox(`${id}-grip`, { width: 0.045, height: 0.14, depth: 0.058 }, scene);
    grip.material = darkMetal; add(grip, 0, -0.065, -0.12, 0.25, 0, 0);
    const stock = MeshBuilder.CreateBox(`${id}-stock`, { width: 0.055, height: 0.12, depth: 0.24 }, scene);
    stock.material = olive; add(stock, 0, 0.015, -0.32);
  }

  if(Object.hasOwn(LIVE_WEAPONS,weapon)) {
    // The socket comes from the actual forward barrel/suppressor geometry,
    // including each weapon's bore height and muzzle brake length.
    const barrels=root.getChildMeshes().filter(mesh=>/-(barrel|silencer|muzzle|brake|shroud)$/.test(mesh.name));
    for(const part of barrels)part.computeWorldMatrix(true);
    barrels.sort((a,b)=>b.getBoundingInfo().boundingBox.maximumWorld.z-a.getBoundingInfo().boundingBox.maximumWorld.z);
    const barrel=barrels[0];
    if(barrel){
      const muzzle=new TransformNode(`${id}-muzzle-socket`,scene);muzzle.parent=root;
      muzzle.position.set(barrel.position.x,barrel.position.y,barrel.getBoundingInfo().boundingBox.maximumWorld.z);
      root.metadata={...root.metadata,muzzle} satisfies WeaponViewMetadata;
    }
  }
  return root;
}

export function createViewmodelMesh(weapon: LiveEquippedWeapon, team: FpsTeamId, id: string, scene: Scene, getMat: (hex: string) => StandardMaterial): TransformNode {
  const root = new TransformNode(`viewmodel-${id}`, scene);

  // 1. Weapon model
  const gun = create3DWeaponMesh(weapon, `${id}-gun`, scene, getMat);
  gun.parent = root;
  gun.position.set(0, 0, 0);

  // 2. Operative hands & arms materials
  const isCT = team === 'blue';
  const sleeveMat = getMat(isCT ? '#182633' : '#832720'); // Navy for CT, Crimson for T
  const skinMat = getMat('#cf9d76');                     // Arm skin tone
  const gloveMat = getMat(isCT ? '#111827' : '#202224');   // Tactical assault glove for CT, combat glove for T
  const knuckleMat = getMat('#1f2937');                   // Hardened knuckle plate
  const strapMat = getMat('#111a24');                     // Watch strap / gear band

  const addPart = (m: Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    m.parent = root;
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    m.isPickable = false;
    return m;
  };

  // 3. Right Arm & Hand (holding pistol grip / trigger)
  const isPistolWeapon = weapon === 'pistol' || weapon === 'usp_s' || weapon === 'glock' || weapon === 'deagle';
  const isSmgWeapon = weapon === 'smg' || weapon === 'mp9' || weapon === 'mac10';
  const isRifleWeapon = weapon === 'rifle' || weapon === 'm4a1_s' || weapon === 'ak47' || weapon === 'mag7' || weapon === 'nova' || weapon === 'negev';
  const isSniperWeapon = weapon === 'sniper' || weapon === 'scout';
  const isGrenade = weapon === 'flash' || weapon === 'smoke' || weapon === 'incendiary';

  const gripPos = isGrenade ? { x: 0, y: -0.04, z: 0.02 }
    : weapon === 'knife' ? { x: 0, y: -0.01, z: 0.01 }
    : isPistolWeapon ? { x: 0, y: -0.05, z: -0.02 }
    : isSmgWeapon ? { x: 0, y: -0.055, z: -0.04 }
    : isRifleWeapon ? { x: 0, y: -0.065, z: -0.06 }
    : { x: 0, y: -0.065, z: -0.12 };

  // Right palm
  const palmR = MeshBuilder.CreateBox(`${id}-r-palm`, { width: 0.056, height: 0.076, depth: 0.082 }, scene);
  palmR.material = gloveMat;
  addPart(palmR, gripPos.x + 0.014, gripPos.y, gripPos.z - 0.01, 0.25, -0.1, 0.05);

  // Knuckle guard
  const knuckleR = MeshBuilder.CreateBox(`${id}-r-knuckle`, { width: 0.058, height: 0.028, depth: 0.06 }, scene);
  knuckleR.material = isCT ? knuckleMat : gloveMat;
  addPart(knuckleR, gripPos.x + 0.028, gripPos.y + 0.018, gripPos.z - 0.01, 0.25, -0.1, 0.05);

  // Fingers wrapped around grip
  const fingersR = MeshBuilder.CreateBox(`${id}-r-fingers`, { width: 0.052, height: 0.066, depth: 0.048 }, scene);
  fingersR.material = isCT ? gloveMat : skinMat;
  addPart(fingersR, gripPos.x - 0.008, gripPos.y - 0.012, gripPos.z + 0.026, 0.2, -0.05, 0);

  // Thumb
  const thumbR = MeshBuilder.CreateBox(`${id}-r-thumb`, { width: 0.028, height: 0.032, depth: 0.048 }, scene);
  thumbR.material = isCT ? gloveMat : skinMat;
  addPart(thumbR, gripPos.x + 0.026, gripPos.y + 0.02, gripPos.z - 0.016, -0.2, 0.28, 0);

  // Forearm extending back into bottom-right viewport
  const forearmR = MeshBuilder.CreateBox(`${id}-r-forearm`, { width: 0.085, height: 0.095, depth: 0.28 }, scene);
  forearmR.material = isCT ? sleeveMat : skinMat;
  addPart(forearmR, gripPos.x + 0.075, gripPos.y - 0.12, gripPos.z - 0.17, 0.44, -0.24, -0.15);

  if (!isCT) {
    const rolledR = MeshBuilder.CreateBox(`${id}-r-sleeve`, { width: 0.098, height: 0.108, depth: 0.13 }, scene);
    rolledR.material = sleeveMat;
    addPart(rolledR, gripPos.x + 0.105, gripPos.y - 0.20, gripPos.z - 0.27, 0.44, -0.24, -0.15);
  } else {
    const strapR = MeshBuilder.CreateBox(`${id}-r-strap`, { width: 0.09, height: 0.10, depth: 0.045 }, scene);
    strapR.material = strapMat;
    addPart(strapR, gripPos.x + 0.045, gripPos.y - 0.065, gripPos.z - 0.09, 0.44, -0.24, -0.15);
  }

  // 4. Left Arm & Hand (supporting the weapon)
  if (isRifleWeapon) {
    const palmL = MeshBuilder.CreateBox(`${id}-l-palm`, { width: 0.065, height: 0.05, depth: 0.082 }, scene);
    palmL.material = gloveMat;
    addPart(palmL, -0.018, 0.005, 0.22, 0.1, 0.35, 0.3);

    const fingersL = MeshBuilder.CreateBox(`${id}-l-fingers`, { width: 0.042, height: 0.058, depth: 0.068 }, scene);
    fingersL.material = isCT ? gloveMat : skinMat;
    addPart(fingersL, -0.036, 0.03, 0.23, 0.1, 0.3, 0.1);

    const forearmL = MeshBuilder.CreateBox(`${id}-l-forearm`, { width: 0.085, height: 0.095, depth: 0.32 }, scene);
    forearmL.material = isCT ? sleeveMat : skinMat;
    addPart(forearmL, -0.14, -0.13, 0.06, -0.42, 0.55, -0.35);

    if (!isCT) {
      const rolledL = MeshBuilder.CreateBox(`${id}-l-sleeve`, { width: 0.098, height: 0.108, depth: 0.14 }, scene);
      rolledL.material = sleeveMat;
      addPart(rolledL, -0.21, -0.22, -0.04, -0.42, 0.55, -0.35);
    }
  } else if (isSmgWeapon) {
    const palmL = MeshBuilder.CreateBox(`${id}-l-palm`, { width: 0.06, height: 0.05, depth: 0.076 }, scene);
    palmL.material = gloveMat;
    addPart(palmL, -0.018, -0.01, 0.17, 0.1, 0.3, 0.25);

    const fingersL = MeshBuilder.CreateBox(`${id}-l-fingers`, { width: 0.04, height: 0.055, depth: 0.062 }, scene);
    fingersL.material = isCT ? gloveMat : skinMat;
    addPart(fingersL, -0.034, 0.015, 0.18, 0.1, 0.3, 0.1);

    const forearmL = MeshBuilder.CreateBox(`${id}-l-forearm`, { width: 0.082, height: 0.092, depth: 0.30 }, scene);
    forearmL.material = isCT ? sleeveMat : skinMat;
    addPart(forearmL, -0.13, -0.14, 0.02, -0.4, 0.5, -0.3);

    if (!isCT) {
      const rolledL = MeshBuilder.CreateBox(`${id}-l-sleeve`, { width: 0.095, height: 0.105, depth: 0.13 }, scene);
      rolledL.material = sleeveMat;
      addPart(rolledL, -0.19, -0.22, -0.07, -0.4, 0.5, -0.3);
    }
  } else if (isSniperWeapon) {
    const palmL = MeshBuilder.CreateBox(`${id}-l-palm`, { width: 0.068, height: 0.052, depth: 0.092 }, scene);
    palmL.material = gloveMat;
    addPart(palmL, -0.02, 0.005, 0.23, 0.1, 0.35, 0.3);

    const fingersL = MeshBuilder.CreateBox(`${id}-l-fingers`, { width: 0.044, height: 0.06, depth: 0.072 }, scene);
    fingersL.material = isCT ? gloveMat : skinMat;
    addPart(fingersL, -0.038, 0.032, 0.24, 0.1, 0.3, 0.1);

    const forearmL = MeshBuilder.CreateBox(`${id}-l-forearm`, { width: 0.086, height: 0.096, depth: 0.34 }, scene);
    forearmL.material = isCT ? sleeveMat : skinMat;
    addPart(forearmL, -0.15, -0.15, 0.05, -0.45, 0.55, -0.35);

    if (!isCT) {
      const rolledL = MeshBuilder.CreateBox(`${id}-l-sleeve`, { width: 0.098, height: 0.108, depth: 0.14 }, scene);
      rolledL.material = sleeveMat;
      addPart(rolledL, -0.22, -0.24, -0.06, -0.45, 0.55, -0.35);
    }
  } else if (isPistolWeapon) {
    const palmL = MeshBuilder.CreateBox(`${id}-l-palm`, { width: 0.066, height: 0.076, depth: 0.082 }, scene);
    palmL.material = gloveMat;
    addPart(palmL, -0.024, -0.065, -0.02, 0.15, 0.2, 0.1);

    const fingersL = MeshBuilder.CreateBox(`${id}-l-fingers`, { width: 0.046, height: 0.066, depth: 0.062 }, scene);
    fingersL.material = isCT ? gloveMat : skinMat;
    addPart(fingersL, 0.012, -0.07, 0.016, 0.1, 0.05, 0);

    const forearmL = MeshBuilder.CreateBox(`${id}-l-forearm`, { width: 0.082, height: 0.088, depth: 0.27 }, scene);
    forearmL.material = isCT ? sleeveMat : skinMat;
    addPart(forearmL, -0.11, -0.17, -0.14, 0.4, 0.3, -0.15);

    if (!isCT) {
      const rolledL = MeshBuilder.CreateBox(`${id}-l-sleeve`, { width: 0.095, height: 0.102, depth: 0.13 }, scene);
      rolledL.material = sleeveMat;
      addPart(rolledL, -0.16, -0.25, -0.24, 0.4, 0.3, -0.15);
    }
  } else if (isGrenade) {
    const palmL = MeshBuilder.CreateBox(`${id}-l-palm`, { width: 0.056, height: 0.065, depth: 0.072 }, scene);
    palmL.material = gloveMat;
    addPart(palmL, -0.05, 0.04, 0.02, 0.2, 0.4, 0.2);
    const fingersL = MeshBuilder.CreateBox(`${id}-l-fingers`, { width: 0.038, height: 0.045, depth: 0.052 }, scene);
    fingersL.material = isCT ? gloveMat : skinMat;
    addPart(fingersL, -0.025, 0.065, 0.01, 0.2, 0.4, 0.2);
    const forearmL = MeshBuilder.CreateBox(`${id}-l-forearm`, { width: 0.082, height: 0.092, depth: 0.27 }, scene);
    forearmL.material = isCT ? sleeveMat : skinMat;
    addPart(forearmL, -0.16, -0.08, -0.08, -0.3, 0.4, -0.2);
  } else {
    // Knife off-hand guard
    const palmL = MeshBuilder.CreateBox(`${id}-l-palm`, { width: 0.062, height: 0.072, depth: 0.082 }, scene);
    palmL.material = gloveMat;
    addPart(palmL, -0.18, -0.14, 0.08, 0.2, 0.4, 0.2);

    const forearmL = MeshBuilder.CreateBox(`${id}-l-forearm`, { width: 0.082, height: 0.092, depth: 0.27 }, scene);
    forearmL.material = isCT ? sleeveMat : skinMat;
    addPart(forearmL, -0.25, -0.22, -0.04, 0.3, 0.5, -0.2);

    if (!isCT) {
      const rolledL = MeshBuilder.CreateBox(`${id}-l-sleeve`, { width: 0.095, height: 0.105, depth: 0.13 }, scene);
      rolledL.material = sleeveMat;
      addPart(rolledL, -0.31, -0.30, -0.14, 0.3, 0.5, -0.2);
    }
  }

  const reloadArm=new TransformNode(`${id}-reload-arm`,scene);reloadArm.parent=root;reloadArm.setEnabled(false);
  const reloadSleeve=MeshBuilder.CreateBox(`${id}-reload-sleeve`,{width:.075,height:.085,depth:.24},scene);reloadSleeve.material=sleeveMat;reloadSleeve.parent=reloadArm;reloadSleeve.position.z=-.12;reloadSleeve.isPickable=false;
  const reloadHand=MeshBuilder.CreateBox(`${id}-reload-hand`,{width:.075,height:.062,depth:.09},scene);reloadHand.material=gloveMat;reloadHand.parent=reloadArm;reloadHand.position.z=.035;reloadHand.isPickable=false;
  const reloadMagazine=MeshBuilder.CreateBox(`${id}-reload-magazine`,{width:.045,height:.15,depth:.05},scene);reloadMagazine.material=strapMat;reloadMagazine.parent=root;reloadMagazine.isPickable=false;reloadMagazine.setEnabled(false);
  root.metadata={muzzle:(gun.metadata as WeaponViewMetadata|undefined)?.muzzle,
    reloadParts:{arm:reloadArm,magazine:reloadMagazine}} satisfies WeaponViewMetadata;

  return root;
}

/** Presentation only: collision-volume proxies, never generated or qualified character assets. */
export class FpsLiveViewer {
  private engine:Engine;
  private scene:Scene;
  private camera:FreeCamera;
  private pipCamera:FreeCamera;
  private resize:ResizeObserver;
  private actors=new Map<string,ActorView>();
  private droppedMeshes=new Map<number,{root:TransformNode;ring:Mesh}>();
  private smokes=new Map<number,SmokeView>();
  private fires=new Map<number,FireView>();
  private smokeTexture?:DynamicTexture;
  private tracers=new Map<number,TracerView>();
  private grenades=new Map<number,Mesh>();
  private materials=new Map<string,StandardMaterial>();
  private fpGunRoot?:TransformNode;
  private fpGunWeapon?:LiveEquippedWeapon;
  private fpGunTeam?:FpsTeamId;
  private currentEyeY=1.6;
  private fpMuzzleFlash?:Mesh;
  private device:Mesh;
  private explosionSphere?:Mesh;
  private explosionRing?:Mesh;
  private explosionMaterials?:StandardMaterial[];
  private explosionRound=0;
  private explosionStartedAt=0;
  private director:DirectorState=createDirectorState();
  private disposed=false;
  private shadows!:ShadowGenerator;
  private previousCamera='';
  private previousRound=0;
  private previousPipKey='';
  private cameraTarget=new Vector3(0,0,4);
  private pipTarget=new Vector3(0,.8,0);
  private pipViewport:NormalizedViewport|null=null;
  private pipActive=false;
  private readonly fullViewport=new Viewport(0,0,1,1);
  private mainHiddenIds=new Set<string>();
  private mainFpEnabled=false;
  private mainMuzzleEnabled=false;
  private mainFollowedId='';
  effectiveMode:Exclude<LiveCameraMode,'director'>='overview';

  constructor(canvas:HTMLCanvasElement,onLost:()=>void) {
    this.engine=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true});
    this.scene=new Scene(this.engine);
    this.camera=new FreeCamera('broadcast-camera',new Vector3(0,72,-63),this.scene);
    this.pipCamera=new FreeCamera('bomb-plant-pip-camera',new Vector3(0,3,0),this.scene);
    this.device=MeshBuilder.CreateBox('objective-device',{width:.5,height:.2,depth:.35},this.scene);
    this.resize=new ResizeObserver(()=>{if(!this.disposed)this.engine.resize();});
    try {
      // Render near CSS-pixel resolution instead of supersampling the whole 3D scene on retina screens.
      this.engine.setHardwareScalingLevel(Math.max(1,(window.devicePixelRatio||1)/1.25));
      this.scene.clearColor=new Color4(.58,.74,.82,1);
      this.scene.fogMode=Scene.FOGMODE_EXP2;this.scene.fogDensity=.0026;this.scene.fogColor=new Color3(.58,.74,.82);
      this.scene.imageProcessingConfiguration.contrast=1.15;this.scene.imageProcessingConfiguration.exposure=1.08;
      this.camera.minZ=.06;this.camera.maxZ=300;this.camera.fov=1.12;
      this.camera.viewport=this.fullViewport;
      this.pipCamera.minZ=.08;this.pipCamera.maxZ=220;this.pipCamera.fov=.9;
      this.pipCamera.viewport=new Viewport(.72,.26,.25,.22);
      this.scene.activeCamera=this.camera;
      this.scene.activeCameras=[this.camera];
      this.scene.onBeforeCameraRenderObservable.add(cam=>{
        if(this.disposed)return;
        if(cam===this.pipCamera){
          const rw=this.engine.getRenderWidth();
          const rh=this.engine.getRenderHeight();
          const vp=this.pipCamera.viewport;
          const sx=Math.max(0,Math.floor(vp.x*rw));
          const sy=Math.max(0,Math.floor(vp.y*rh));
          const sw=Math.max(1,Math.ceil(vp.width*rw));
          const sh=Math.max(1,Math.ceil(vp.height*rh));
          // Clear color + depth + stencil strictly within the PIP box so main-view geometry does not leak behind the sky.
          this.engine.scissorClear(sx,sy,sw,sh,this.scene.clearColor);
          for(const id of this.mainHiddenIds){
            const v=this.actors.get(id);
            if(v){v.operative.root.setEnabled(true);v.gunNode?.setEnabled(true);}
          }
          this.fpGunRoot?.setEnabled(false);
          this.fpMuzzleFlash?.setEnabled(false);
        } else {
          for(const id of this.mainHiddenIds){
            const v=this.actors.get(id);
            if(v){v.operative.root.setEnabled(false);v.gunNode?.setEnabled(false);}
          }
          this.fpGunRoot?.setEnabled(this.mainFpEnabled);
          this.fpMuzzleFlash?.setEnabled(this.mainMuzzleEnabled);
        }
        this.setTracerCamera(cam!==this.pipCamera&&this.mainFpEnabled);
      });
      const sky=new HemisphericLight('harbor-sky',Vector3.Up(),this.scene);sky.intensity=.68;sky.groundColor=new Color3(.32,.34,.32);
      const sun=new DirectionalLight('mediterranean-sun',new Vector3(-.55,-1,.32),this.scene);sun.position.set(35,65,-35);sun.intensity=1.35;sun.diffuse=new Color3(1,.94,.82);
      this.shadows=new ShadowGenerator(512,sun);this.shadows.usePercentageCloserFiltering=true;this.shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;this.shadows.bias=.002;this.shadows.normalBias=.1;this.shadows.setDarkness(.32);
      const floor=MeshBuilder.CreateGround('harbor-paving',{width:72,height:92},this.scene);
      const paving=new StandardMaterial('paving',this.scene);
      const texture=new DynamicTexture('paving-cobblestone',{width:512,height:512},this.scene,false);
      const ctx=texture.getContext();
      // Procedural Mediterranean cobblestone / flagstone floor texture
      ctx.fillStyle='#8f897b';ctx.fillRect(0,0,512,512);
      for(let row=0;row<16;row++){
        const y=row*32,offset=(row%2)*16;
        for(let col=0;col<18;col++){
          const x=((col*32+offset)%512);
          const hueVar=((row*7+col*13)%5);
          ctx.fillStyle=hueVar===0?'#827c6f':hueVar===1?'#968f80':hueVar===2?'#7a7468':hueVar===3?'#8e887a':'#9e9788';
          ctx.fillRect(x+1,y+1,30,30);
          // subtle stone highlights & mortar crevices
          ctx.strokeStyle='#5f5a4f';ctx.lineWidth=1.5;ctx.strokeRect(x+1,y+1,30,30);
        }
      }
      for(let i=0;i<1200;i++){const px=(i*137.53)%512,py=(i*73.19)%512;ctx.fillStyle=i%2?'#6e685c':'#a39c8c';ctx.fillRect(px,py,1.5,1.5);}
      texture.update();texture.uScale=18;texture.vScale=23;paving.diffuseTexture=texture;paving.specularColor=Color3.Black();floor.material=paving;floor.receiveShadows=true;
      for(const wall of LIVE_FPS_MAP.solids) {
        const mesh=MeshBuilder.CreateBox(wall.id,{width:wall.maxX-wall.minX,height:wall.height,depth:wall.maxZ-wall.minZ},this.scene);
        mesh.position.set((wall.minX+wall.maxX)/2,wall.height/2,(wall.minZ+wall.maxZ)/2);mesh.material=this.material(wall.color);
        mesh.receiveShadows=false;this.shadows.addShadowCaster(mesh);mesh.freezeWorldMatrix();
        // Roof coping with authentic terracotta clay tile eaves on tall buildings
        const roofColor=wall.height>=4?'#a84e36':wall.color;
        const roof=MeshBuilder.CreateBox(`${wall.id}-coping`,{width:wall.maxX-wall.minX+.14,height:.14,depth:wall.maxZ-wall.minZ+.14},this.scene);
        roof.position.copyFrom(mesh.position);roof.position.y=wall.height-.07;roof.material=this.material(roofColor);
        roof.receiveShadows=false;
      }
      buildLiveScenery(this.scene,color=>this.material(color));
      const mosaicTexture=new DynamicTexture('b-basin-blue-mosaic',{width:512,height:512},this.scene,false);
      const mosaicContext=mosaicTexture.getContext() as unknown as CanvasRenderingContext2D;
      const tileColors=['#28648a','#34789a','#3d81a0','#2d6b91','#4a87a1'];
      mosaicContext.fillStyle='#c6c1af';mosaicContext.fillRect(0,0,512,512);
      for(let row=0;row<16;row++)for(let column=0;column<16;column++) {
        const x=column*32,y=row*32,shade=(row*7+column*11)%tileColors.length;
        mosaicContext.fillStyle=tileColors[shade];mosaicContext.fillRect(x+2,y+2,28,28);
        mosaicContext.strokeStyle='#b6b4a8';mosaicContext.lineWidth=1;mosaicContext.strokeRect(x+2.5,y+2.5,27,27);
        if(row%4===1&&column%4===1) {
          mosaicContext.fillStyle='#bac8bd';mosaicContext.beginPath();mosaicContext.moveTo(x+16,y+7);mosaicContext.lineTo(x+25,y+16);mosaicContext.lineTo(x+16,y+25);mosaicContext.lineTo(x+7,y+16);mosaicContext.closePath();mosaicContext.fill();
          mosaicContext.fillStyle='#597f88';mosaicContext.fillRect(x+14,y+14,4,4);
        }
      }
      mosaicTexture.update();mosaicTexture.uScale=8;mosaicTexture.vScale=8;
      const mosaicMaterial=new StandardMaterial('b-basin-mosaic-material',this.scene);
      mosaicMaterial.diffuseTexture=mosaicTexture;mosaicMaterial.specularColor=new Color3(.13,.16,.16);
      for(const [site,position] of Object.entries(LIVE_FPS_MAP.sites)) {
        const siteSize=site==='B'?15.8:8.5;
        const pad=MeshBuilder.CreateGround(`site-${site}`,{width:siteSize,height:siteSize},this.scene);pad.position.set(position.x,.025,position.z);pad.material=site==='B'?mosaicMaterial:this.material('#9e4536');pad.receiveShadows=true;pad.isPickable=false;
        if(site==='B')for(const [edgeX,edgeZ,width,depth] of [
          [position.x,position.z-7.76,15.8,.28],[position.x,position.z+7.76,15.8,.28],
          [position.x-7.76,position.z,.28,15.8],[position.x+7.76,position.z,.28,15.8],
        ] as [number,number,number,number][]) {
          const border=MeshBuilder.CreateBox(`b-basin-stone-border-${edgeX}-${edgeZ}`,{width,height:.018,depth},this.scene);
          border.position.set(edgeX,.04,edgeZ);border.material=this.material('#d2c7ad');border.isPickable=false;border.receiveShadows=true;
        }
        const label=MeshBuilder.CreateGround(`site-${site}-label`,{width:4.2,height:4.2},this.scene);label.position.set(position.x,.04,position.z);
        const mat=new StandardMaterial(`site-${site}-type`,this.scene),tex=new DynamicTexture(`site-${site}-text`,256,this.scene,false);
        tex.hasAlpha=true;tex.drawText(site,null,195,'bold 190px sans-serif','#fff4dc','transparent',true);mat.diffuseTexture=tex;mat.useAlphaFromDiffuseTexture=true;mat.specularColor=Color3.Black();label.material=mat;label.isPickable=false;
      }
      // Non-collidable line markings are drawn flush with the floor.
      for(const x of [-32,32]) {
        const stripe=MeshBuilder.CreateGround(`lane-marking-${x}`,{width:.12,height:76},this.scene);stripe.position.set(x,.03,0);stripe.material=this.material('#d4b866');
      }
      this.device.material=this.material('#eab96c');
      this.engine.onContextLostObservable.add(()=>{if(!this.disposed)onLost();});
      this.resize.observe(canvas);this.engine.resize();
    } catch(error){this.dispose();throw error;}
  }
  private material(hex:string):StandardMaterial {
    const existing=this.materials.get(hex);if(existing)return existing;
    const material=new StandardMaterial(hex,this.scene);material.diffuseColor=Color3.FromHexString(hex);material.specularColor=new Color3(.08,.08,.08);
    this.materials.set(hex,material);return material;
  }
  private smokeVolumeTexture():DynamicTexture {
    if(this.smokeTexture)return this.smokeTexture;
    const texture=new DynamicTexture('smoke-volume-cloud-texture',{width:256,height:256},this.scene,false);
    texture.hasAlpha=true;
    const ctx=texture.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0,0,256,256);
    let state=0x51f15e;
    const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
    ctx.globalCompositeOperation='lighter';
    for(let i=0;i<54;i++){
      const x=30+random()*196,y=30+random()*196,radius=18+random()*42;
      const gradient=ctx.createRadialGradient(x,y,0,x,y,radius);
      gradient.addColorStop(0,`rgba(255,255,255,${.07+random()*.13})`);
      gradient.addColorStop(.55,'rgba(255,255,255,.055)');
      gradient.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    }
    ctx.globalCompositeOperation='destination-in';
    const edge=ctx.createRadialGradient(128,128,28,128,128,132);
    edge.addColorStop(0,'rgba(255,255,255,.96)');edge.addColorStop(.68,'rgba(255,255,255,.78)');edge.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=edge;ctx.fillRect(0,0,256,256);ctx.globalCompositeOperation='source-over';
    texture.update();this.smokeTexture=texture;return texture;
  }
  setPipViewport(rect:NormalizedViewport|null) {
    this.pipViewport=rect;
    if(rect){
      this.pipCamera.viewport.x=rect.x;
      this.pipCamera.viewport.y=rect.y;
      this.pipCamera.viewport.width=rect.width;
      this.pipCamera.viewport.height=rect.height;
    }
  }
  resizeNow() {
    if(!this.disposed)this.engine.resize();
  }
  private createMuzzleFlash(name:string,socket:TransformNode):Mesh {
    const flash=MeshBuilder.CreateSphere(name,{diameter:.11,segments:6},this.scene);
    const material=this.material('#ffefa8');material.emissiveColor=new Color3(1,.85,.3);material.specularColor=Color3.Black();
    flash.material=material;flash.isPickable=false;flash.parent=socket;
    flash.position.set(0,0,.045);flash.scaling.set(.7,.7,1.6);flash.setEnabled(false);
    return flash;
  }
  private muzzlePosition(root:TransformNode|undefined):Vector3|undefined {
    const muzzle=(root?.metadata as WeaponViewMetadata|undefined)?.muzzle;
    if(!root||!muzzle||muzzle.isDisposed())return undefined;
    root.computeWorldMatrix(true);muzzle.computeWorldMatrix(true);
    return muzzle.getAbsolutePosition().clone();
  }
  private setTracerCamera(firstPerson:boolean) {
    for(const tracer of this.tracers.values()){
      const showFirst=firstPerson&&tracer.actorId===this.mainFollowedId&&!!tracer.firstPerson;
      tracer.world.setEnabled(!showFirst);tracer.firstPerson?.setEnabled(showFirst);
    }
  }
  private updateShotTracers(current:LiveSnapshot) {
    const shots=current.shots.filter(shot=>current.time-shot.time<.1),ids=new Set(shots.map(shot=>shot.id));
    for(const [id,tracer] of this.tracers)if(!ids.has(id)){
      tracer.world.dispose();tracer.firstPerson?.dispose();this.tracers.delete(id);
    }
    for(const shot of shots){
      const actor=this.actors.get(shot.actorId);
      const origin=this.muzzlePosition(actor?.gunWeapon===shot.weapon?actor.gunNode:undefined)
        ??new Vector3(shot.from.x,shot.fromY,shot.from.z);
      const endpoint=new Vector3(shot.to.x,shot.toY,shot.to.z);
      let tracer=this.tracers.get(shot.id);
      if(!tracer){
        const world=MeshBuilder.CreateLines(`shot-${shot.id}`,{points:[origin,endpoint],updatable:true},this.scene);
        world.color=Color3.FromHexString(shot.team==='blue'?'#b1efff':'#ffe1aa');world.isPickable=false;
        tracer={world,actorId:shot.actorId};this.tracers.set(shot.id,tracer);
      }else MeshBuilder.CreateLines(`shot-${shot.id}`,{points:[origin,endpoint],instance:tracer.world});
      const firstOrigin=this.mainFpEnabled&&shot.actorId===this.mainFollowedId&&this.fpGunWeapon===shot.weapon?this.muzzlePosition(this.fpGunRoot):undefined;
      if(firstOrigin){
        if(!tracer.firstPerson){
          tracer.firstPerson=MeshBuilder.CreateLines(`fp-shot-${shot.id}`,{points:[firstOrigin,endpoint],updatable:true},this.scene);
          tracer.firstPerson.color=tracer.world.color;tracer.firstPerson.isPickable=false;
        }else MeshBuilder.CreateLines(`fp-shot-${shot.id}`,{points:[firstOrigin,endpoint],instance:tracer.firstPerson});
      }
    }
  }
  render(previous:LiveSnapshot,current:LiveSnapshot,alpha:number,mode:LiveCameraMode,selected:string,elapsed=1/60,allowPip=true):LiveRenderResult {
    if(this.disposed)return {followedId:selected,effectiveMode:'overview',pip:{active:false,phase:'planting',progress:0,duration:3.2,spot:{x:0,z:0}}};
    const players=current.players.map(p=>{
      const before=previous.round===current.round?previous.players.find(a=>a.id===p.id):undefined;
      if(!before)return p;
      const delta=Math.atan2(Math.sin(p.yaw-before.yaw),Math.cos(p.yaw-before.yaw));
      return {...p,x:mix(before.x,p.x,alpha),z:mix(before.z,p.z,alpha),yaw:before.yaw+delta*alpha,jumpY:mix(before.jumpY??0,p.jumpY??0,alpha)};
    });
    const decision=evaluateBroadcastDirector({...current,players},this.director,mode,selected);
    const followed=players.find(p=>p.id===decision.followedId)??players[0];
    const effectiveMode=decision.effectiveMode;
    this.effectiveMode=effectiveMode;
    for(const player of players) {
      let view=this.actors.get(player.id);
      if(!view) {
        const operative=createTacticalOperativeMesh(player.team,player.id,this.scene,hex=>this.material(hex));
        this.shadows.addShadowCaster(operative.torso);
        this.shadows.addShadowCaster(operative.head);
        view={operative};
        this.actors.set(player.id,view);
      }
      if(!view.gunNode || view.gunWeapon!==player.equipped) {
        view.gunNode?.dispose();
        view.gunNode=create3DWeaponMesh(player.equipped,`proxy-gun-${player.id}`,this.scene,hex=>this.material(hex));
        view.gunWeapon=player.equipped;
        const muzzle=(view.gunNode.metadata as WeaponViewMetadata|undefined)?.muzzle;
        view.muzzleFlash=muzzle?this.createMuzzleFlash(`muzzle-${player.id}`,muzzle):undefined;
      }
      const alivePlayer=player.hp>0;
      view.operative.root.setEnabled(alivePlayer);
      view.gunNode.setEnabled(alivePlayer);
      view.muzzleFlash?.setEnabled(alivePlayer&&current.time-player.lastShot<.07);

      const jumpY = player.jumpY ?? 0;
      view.operative.root.position.set(player.x,jumpY,player.z);
      view.operative.root.rotation.y=player.yaw;

      if(alivePlayer) {
        const isCrouching=player.crouch;
        const blend=1-Math.exp(-Math.max(0,Math.min(.1,elapsed))*13);
        view.operative.crouchPose=mix(view.operative.crouchPose,isCrouching?1:0,blend);
        const crouchPose=view.operative.crouchPose;
        const throwElapsed=player.throwAt===undefined?-1:current.time-player.throwAt;
        const throwPhase=throwElapsed<0||throwElapsed>.65?undefined:throwElapsed/.65;
        const throwLift=throwPhase===undefined?0:throwPhase<.3?ease01(throwPhase/.3):1-ease01((throwPhase-.3)/.7);
        const throwRelease=throwPhase===undefined||throwPhase<.3?0:1-ease01((throwPhase-.3)/.2);
        const weaponStats=LIVE_WEAPONS[player.weapon];
        const reloadProgress=player.reload>0?1-Math.max(0,Math.min(1,player.reload/weaponStats.reload)):0;
        const reloadWeight=player.reload>0?Math.sin(reloadProgress*Math.PI):0;
        view.operative.spine.position.y=1.05-.23*crouchPose;
        view.operative.spine.rotation.x=.16*crouchPose+.04*reloadWeight;
        view.operative.headPivot.position.y=1.54-.37*crouchPose;
        view.operative.headPivot.rotation.x=-.06*crouchPose;
        view.operative.leftArmPivot.position.y=1.31-.23*crouchPose;
        view.operative.rightArmPivot.position.y=1.31-.23*crouchPose;
        view.operative.leftLegPivot.position.y=.74-.12*crouchPose;
        view.operative.rightLegPivot.position.y=.74-.12*crouchPose;
        view.operative.leftKneePivot.position.y=-.36+.05*crouchPose;
        view.operative.rightKneePivot.position.y=-.36+.05*crouchPose;
        view.operative.leftKneePivot.rotation.x=-.62*crouchPose;
        view.operative.rightKneePivot.rotation.x=-.62*crouchPose;

        // Weapon holding arm poses
        if(player.equipped==='knife') {
          const swing=Math.sin(Math.min(1,Math.max(0,(current.time-player.lastSwing)/.35))*Math.PI);
          view.operative.rightArmPivot.rotation.x=-0.48+swing*0.9;
          view.operative.rightArmPivot.rotation.y=-0.2;
          view.operative.leftArmPivot.rotation.x=-0.52-reloadWeight*.35-throwLift*.18;
          view.operative.leftArmPivot.rotation.y=0.3;
        } else {
          view.operative.rightArmPivot.rotation.x=-0.50-throwLift*.82+throwRelease*1.35+reloadWeight*.18;
          view.operative.rightArmPivot.rotation.y=-0.28+throwRelease*.24;
          view.operative.leftArmPivot.rotation.x=-0.58-reloadWeight*.7-throwLift*.22;
          view.operative.leftArmPivot.rotation.y=0.42-reloadWeight*.2-throwRelease*.12;
        }
        if(player.equipped==='knife') {
          view.operative.rightArmPivot.rotation.x-=throwLift*.3;
        }

        // Footfall phase follows actual travel distance, so reverse and side steps read correctly.
        const dx=view.operative.hasMotion?player.x-view.operative.lastX:0;
        const dz=view.operative.hasMotion?player.z-view.operative.lastZ:0;
        view.operative.lastX=player.x;view.operative.lastZ=player.z;view.operative.hasMotion=true;
        const forward=Math.sin(player.yaw)*dx+Math.cos(player.yaw)*dz;
        const lateral=Math.cos(player.yaw)*dx-Math.sin(player.yaw)*dz;
        const sampleDt=Math.max(.001,Math.min(.1,elapsed));
        const walkAmount=Math.max(0,Math.min(1,player.speed/(crouchPose>.5?1.8:2.8)));
        if(player.speed>.12)view.operative.stridePhase+=(forward<-.002?-1:1)*Math.hypot(dx,dz)*(crouchPose>.5?3.7:4.8);
        const cycle=Math.sin(view.operative.stridePhase)*walkAmount*(1-crouchPose*.5);
        const lateralStep=Math.max(-1,Math.min(1,(lateral/sampleDt)/(crouchPose>.5?1.8:2.8)));
        const shuffle=Math.max(0,Math.min(1,Math.abs(lateralStep)));
        const legSwing=cycle*(1-shuffle*.72);
        view.operative.spine.rotation.z=-lateralStep*.065;
        view.operative.spine.rotation.y=throwLift*.055;
        view.operative.headPivot.rotation.z=lateralStep*.025;
        view.operative.leftLegPivot.rotation.z=.1*lateralStep+.025*cycle;
        view.operative.rightLegPivot.rotation.z=-.1*lateralStep-.025*cycle;
        view.operative.leftArmPivot.rotation.z=-.035*lateralStep-throwLift*.2+throwRelease*.3;
        view.operative.rightArmPivot.rotation.z=-.025*lateralStep-throwLift*.2+throwRelease*.3;
        if(jumpY > 0.06) {
          view.operative.leftLegPivot.rotation.x=-.32+.38*crouchPose;
          view.operative.rightLegPivot.rotation.x=-.22+.38*crouchPose;
          view.operative.leftKneePivot.rotation.x=-.48-.25*crouchPose;
          view.operative.rightKneePivot.rotation.x=-.56-.25*crouchPose;
          view.operative.leftArmPivot.rotation.x=-.52;
          view.operative.rightArmPivot.rotation.x=-.45;
        } else {
          view.operative.leftLegPivot.rotation.x=legSwing*.48+.13*crouchPose;
          view.operative.rightLegPivot.rotation.x=-legSwing*.48+.13*crouchPose;
          view.operative.leftKneePivot.rotation.x=-.62*crouchPose+Math.max(0,legSwing)*.42;
          view.operative.rightKneePivot.rotation.x=-.62*crouchPose+Math.max(0,-legSwing)*.42;
          if(player.equipped==='knife') {
            view.operative.leftArmPivot.rotation.x=-.52-reloadWeight*.35-throwLift*.18-cycle*.035;
            view.operative.rightArmPivot.rotation.x=-.48+Math.sin(Math.min(1,Math.max(0,(current.time-player.lastSwing)/.35))*Math.PI)*.9+throwLift*.5+cycle*.035;
          } else {
            const armSwing=cycle*.055*(1-shuffle*.8)*(1-throwLift*.7);
            view.operative.leftArmPivot.rotation.x=-.58-reloadWeight*.7-throwLift*.22-armSwing;
            view.operative.rightArmPivot.rotation.x=-.50-throwLift*.82+throwRelease*1.35+reloadWeight*.18+armSwing;
          }
        }

        const rightX=Math.cos(player.yaw), rightZ=-Math.sin(player.yaw);
        const forwardX=Math.sin(player.yaw), forwardZ=Math.cos(player.yaw);
        const gunY=(1.05-.25*crouchPose)+jumpY-reloadWeight*.12;
        view.gunNode.position.set(player.x+forwardX*.35+rightX*.2, gunY, player.z+forwardZ*.35+rightZ*.2);
        view.gunNode.rotation.y=player.yaw;
        view.gunNode.rotation.x=(player.weaponReady>0?.5:0)+reloadWeight*.42;
        view.gunNode.rotation.z=player.equipped==='knife'?Math.sin(Math.min(1,Math.max(0,(current.time-player.lastSwing)/.35))*Math.PI):0;
        const magazineOut=player.reload>0&&reloadProgress>.12&&reloadProgress<.7;
        view.operative.magazine.setEnabled(magazineOut);
        if(magazineOut){
          const offset=-.16+Math.min(.15,Math.abs(reloadProgress-.42)*.42);
          view.operative.magazine.position.set(forwardX*.36+rightX*.12,gunY+offset,forwardZ*.36+rightZ*.12);
          view.operative.magazine.rotation.y=player.yaw;
          view.operative.magazine.rotation.x=.25+reloadWeight*.65;
        }
      }
    }
    // Ground dropped weapons
    for(const [id,item] of this.droppedMeshes) {
      if(!current.droppedWeapons?.some(w=>w.id===id)) {
        item.root.dispose();item.ring.dispose();this.droppedMeshes.delete(id);
      }
    }
    if(current.droppedWeapons) {
      for(const dropped of current.droppedWeapons) {
        let item=this.droppedMeshes.get(dropped.id);
        if(!item) {
          const root=create3DWeaponMesh(dropped.weapon,`dropped-${dropped.id}`,this.scene,hex=>this.material(hex));
          root.position.set(dropped.x,.08,dropped.z);
          root.rotation.x=Math.PI/2;
          root.rotation.z=((dropped.id*73)%360)*(Math.PI/180);

          const ring=MeshBuilder.CreateTorus(`drop-ring-${dropped.id}`,{diameter:1.0,thickness:.024,tessellation:24},this.scene);
          ring.position.set(dropped.x,.03,dropped.z);
          const ringMat=this.material('#ffc83b');ringMat.emissiveColor=new Color3(.7,.5,.1);ring.material=ringMat;ring.isPickable=false;
          ring.freezeWorldMatrix();

          item={root,ring};
          this.droppedMeshes.set(dropped.id,item);
        }
      }
    }
    for(const [id,cloud] of this.smokes)if(!current.smokes.some(s=>s.id===id)){cloud.root.dispose(false,false);cloud.material.dispose(false,false);this.smokes.delete(id);}
    for(const smoke of current.smokes) {
      if(!this.smokes.has(smoke.id)) {
        const root=new TransformNode(`smoke-cloud-${smoke.id}`,this.scene);root.position.set(smoke.x,smoke.y,smoke.z);
        const lobes:Mesh[]=[],phases:number[]=[];
        const cloudTexture=this.smokeVolumeTexture();
        const material=new StandardMaterial(`smoke-material-${smoke.id}`,this.scene);material.diffuseColor=new Color3(.72,.75,.76);material.emissiveColor=new Color3(.12,.14,.15);material.diffuseTexture=cloudTexture;material.useAlphaFromDiffuseTexture=true;material.alpha=.62;material.backFaceCulling=false;material.disableLighting=true;material.specularColor=Color3.Black();
        for(let i=0;i<9;i++){
          const mesh=MeshBuilder.CreateSphere(`smoke-${smoke.id}-${i}`,{diameter:1,segments:12},this.scene);mesh.parent=root;mesh.isPickable=false;
          mesh.material=material;
          const phase=(smoke.id*2.399+i*4.17)%(Math.PI*2);phases.push(phase);mesh.position.set(0,.05+(i%3)*.12,0);
          mesh.scaling.set(.4,.34,.4);lobes.push(mesh);
        }
        this.smokes.set(smoke.id,{root,lobes,material,phases});
      }
      const cloud=this.smokes.get(smoke.id)!;cloud.root.position.set(smoke.x,smoke.y,smoke.z);
      const fade=smoke.expires>current.time?Math.min(1,(smoke.expires-current.time)/1.5):0;
      for(let i=0;i<cloud.lobes.length;i++){
        const phase=cloud.phases[i],angle=phase+current.time*.045,spread=i===0?0:.22+(i%3)*.065;
        const width=smoke.radius*(i===0?.62:.45+(i%3)*.035),wobble=Math.sin(current.time*.48+phase);
        cloud.lobes[i].position.set(Math.cos(angle)*smoke.radius*spread+Math.sin(current.time*.37+phase)*smoke.radius*.025,smoke.radius*(.015+(i%4)*.055)+wobble*smoke.radius*.025,Math.sin(angle)*smoke.radius*spread+Math.cos(current.time*.31+phase)*smoke.radius*.025);
        cloud.lobes[i].rotation.y=phase+current.time*.025;
        cloud.lobes[i].scaling.set(width,width*(.7+(i%3)*.07),width);
      }
      cloud.material.alpha=.58*Math.min(1,fade+.2);
    }
    for(const [id,view] of this.fires)if(!current.fires?.some(f=>f.id===id)){view.root.dispose(false,true);this.fires.delete(id);}
    for(const fire of current.fires??[]) {
      let view=this.fires.get(fire.id);
      if(!view){
        const root=new TransformNode(`fire-zone-${fire.id}`,this.scene);root.position.set(fire.x,.07,fire.z);
        const ground=MeshBuilder.CreateCylinder(`fire-ground-${fire.id}`,{height:.035,diameter:1,tessellation:32},this.scene);ground.parent=root;ground.position.y=.02;ground.isPickable=false;
        const groundMaterial=new StandardMaterial(`fire-ground-material-${fire.id}`,this.scene);groundMaterial.diffuseColor=new Color3(1,.24,.012);groundMaterial.emissiveColor=new Color3(1,.18,.005);groundMaterial.alpha=.5;groundMaterial.disableLighting=true;groundMaterial.specularColor=Color3.Black();ground.material=groundMaterial;
        const groundFlames:Mesh[]=[],groundFlameMaterials:StandardMaterial[]=[],patchColors=[new Color3(1,.17,.012),new Color3(1,.32,.015),new Color3(1,.58,.045)];
        for(let i=0;i<12;i++){
          const patch=MeshBuilder.CreateSphere(`fire-ground-flame-${fire.id}-${i}`,{diameter:1,segments:8},this.scene);patch.parent=root;patch.isPickable=false;
          const material=new StandardMaterial(`fire-ground-flame-material-${fire.id}-${i}`,this.scene);material.diffuseColor=patchColors[i%patchColors.length];material.emissiveColor=patchColors[i%patchColors.length];material.alpha=.68;material.disableLighting=true;material.specularColor=Color3.Black();patch.material=material;
          groundFlames.push(patch);groundFlameMaterials.push(material);
        }
        const flames:Mesh[]=[],flameMaterials:StandardMaterial[]=[];
        for(let i=0;i<7;i++){
          const flame=MeshBuilder.CreateCylinder(`fire-flame-${fire.id}-${i}`,{height:.62+(i%3)*.12,diameterTop:.015,diameterBottom:.38,tessellation:7},this.scene);flame.parent=root;flame.isPickable=false;
          const material=new StandardMaterial(`fire-flame-material-${fire.id}-${i}`,this.scene);material.diffuseColor=i%2?new Color3(1,.55,.05):new Color3(1,.2,.015);material.emissiveColor=new Color3(1,.24,.02);material.alpha=.82;material.disableLighting=true;material.specularColor=Color3.Black();flame.material=material;
          const theta=i/7*Math.PI*2;flame.position.set(Math.cos(theta)*.36,.35,Math.sin(theta)*.36);flames.push(flame);flameMaterials.push(material);
        }
        view={root,ground,groundFlames,groundFlameMaterials,flames,groundMaterial,flameMaterials};this.fires.set(fire.id,view);
      }
      view.root.position.set(fire.x,.045,fire.z);view.ground.scaling.set(fire.radius*2,1,fire.radius*2);
      const fade=Math.min(1,(fire.expires-current.time)/1.2);view.groundMaterial.alpha=.5*Math.min(1,fade+.2);
      for(let i=0;i<view.groundFlames.length;i++){
        const phase=i*2.399,theta=phase+Math.sin(current.time*2.3+phase)*.08,radial=.12+(i%4)*.17,pulse=.78+Math.sin(current.time*6.2+phase)*.18;
        const width=fire.radius*(.12+(i%3)*.025);
        view.groundFlames[i].position.set(Math.cos(theta)*fire.radius*radial,.025+Math.max(0,Math.sin(current.time*5.4+phase))*.012,Math.sin(theta)*fire.radius*radial);
        view.groundFlames[i].scaling.set(width,.035,width*(.7+(i%2)*.15));view.groundFlameMaterials[i].alpha=.66*Math.min(1,fade+.2)*pulse;
      }
      for(let i=0;i<view.flames.length;i++){
        const theta=i/7*Math.PI*2+Math.sin(current.time*2.6+i)*.12,scale=fire.radius/4.2;
        view.flames[i].position.set(Math.cos(theta)*fire.radius*.56,.29+Math.sin(current.time*8+i)*.065,Math.sin(theta)*fire.radius*.56);
        view.flames[i].scaling.set(scale*(.9+Math.sin(current.time*7+i)*.1),scale*(.72+Math.sin(current.time*7+i)*.12),scale);view.flameMaterials[i].alpha=.82*Math.min(1,fade+.2);
      }
    }
    for(const [id,mesh] of this.grenades)if(!current.grenades.some(g=>g.id===id)){mesh.dispose();this.grenades.delete(id);}
    for(const grenade of current.grenades) {
      let mesh=this.grenades.get(grenade.id);
      if(!mesh){mesh=MeshBuilder.CreateSphere(`grenade-${grenade.id}`,{diameter:.22,segments:8},this.scene);mesh.material=this.material(grenade.kind==='flash'?'#e4d6a3':grenade.kind==='smoke'?'#687e78':'#f97316');this.grenades.set(grenade.id,mesh);}
      if(current.time<grenade.releaseAt) {
        const thrower=current.players.find(player=>player.id===grenade.actorId);
        if(thrower) {
          const forwardX=Math.sin(thrower.yaw),forwardZ=Math.cos(thrower.yaw),rightX=Math.cos(thrower.yaw),rightZ=-Math.sin(thrower.yaw);
          mesh.position.set(thrower.x+forwardX*.2+rightX*.16,1.55+(thrower.jumpY??0),thrower.z+forwardZ*.2+rightZ*.16);
        } else mesh.position.set(grenade.x,grenade.y,grenade.z);
      } else mesh.position.set(grenade.x,grenade.y,grenade.z);
    }
    this.device.setEnabled(current.bomb.status==='planted'||current.bomb.status==='dropped');this.device.position.set(current.bomb.x,.15,current.bomb.z);
    if(current.bomb.status==='exploded'&&this.explosionRound!==current.round){
      this.explosionRound=current.round;this.explosionStartedAt=current.time;
      this.explosionSphere=MeshBuilder.CreateSphere('bomb-explosion-flash',{diameter:1,segments:10},this.scene);this.explosionSphere.position.set(current.bomb.x,.8,current.bomb.z);
      this.explosionRing=MeshBuilder.CreateTorus('bomb-explosion-ring',{diameter:1,thickness:.18,tessellation:24},this.scene);this.explosionRing.position.set(current.bomb.x,.1,current.bomb.z);
      const flashMaterial=new StandardMaterial('bomb-explosion-flash-material',this.scene);flashMaterial.emissiveColor=new Color3(1,.48,.06);flashMaterial.diffuseColor=new Color3(1,.64,.14);flashMaterial.alpha=.9;flashMaterial.disableLighting=true;
      const ringMaterial=new StandardMaterial('bomb-explosion-ring-material',this.scene);ringMaterial.emissiveColor=new Color3(1,.18,.015);ringMaterial.diffuseColor=new Color3(1,.3,.025);ringMaterial.alpha=.88;ringMaterial.disableLighting=true;
      this.explosionSphere.material=flashMaterial;this.explosionRing.material=ringMaterial;this.explosionMaterials=[flashMaterial,ringMaterial];
    }
    if(this.explosionSphere&&this.explosionRing&&this.explosionMaterials){
      const age=current.time-this.explosionStartedAt;const life=Math.max(0,1-age/1.25);
      this.explosionSphere.setEnabled(life>0);this.explosionRing.setEnabled(life>0);
      const flashScale=.5+Math.max(0,age)*3.2;this.explosionSphere.scaling.set(flashScale,flashScale*.72,flashScale);
      this.explosionRing.scaling.set(1+Math.max(0,age)*9,1,1+Math.max(0,age)*9);
      this.explosionMaterials[0].alpha=.9*life;this.explosionMaterials[1].alpha=.88*life;
    }
    const zoom=effectiveMode==='first'&&followed.equipped==='sniper'&&followed.action==='Engaging';
    const cameraKey=`${effectiveMode}:${followed.id}`,cut=cameraKey!==this.previousCamera||this.previousRound!==current.round;
    const blend=cut?1:1-Math.exp(-Math.max(0,Math.min(.1,elapsed))*9);
    if(effectiveMode==='overview') {
      const overviewPose=computeOverviewCameraPose();
      this.camera.fov=mix(this.camera.fov,overviewPose.fov,blend);
      this.camera.position=Vector3.Lerp(this.camera.position,new Vector3(overviewPose.position.x,overviewPose.position.y,overviewPose.position.z),blend);
      this.cameraTarget=Vector3.Lerp(this.cameraTarget,new Vector3(overviewPose.target.x,overviewPose.target.y,overviewPose.target.z),blend);
      this.camera.setTarget(this.cameraTarget);
    } else this.followCamera(followed,effectiveMode==='first',blend,current.time,zoom);
    this.previousCamera=cameraKey;this.previousRound=current.round;

    this.mainHiddenIds.clear();
    if(effectiveMode==='first' && followed.hp>0) {
      this.mainHiddenIds.add(followed.id);
      for(const player of players) {
        if(player.hp>0 && player.id!==followed.id && player.team===followed.team) {
          const view=this.actors.get(player.id);
          if(view && Vector3.Distance(this.camera.position,view.operative.root.position)<1.05) {
            this.mainHiddenIds.add(player.id);
          }
        }
      }
    }

    // First-person viewmodel and muzzle flash (isolated to main camera via onBeforeCameraRenderObservable)
    this.mainFpEnabled=effectiveMode==='first' && followed.hp>0;
    this.mainFollowedId=followed.id;
    this.mainMuzzleEnabled=false;
    if(this.mainFpEnabled) {
      if(!this.fpGunRoot || this.fpGunWeapon!==followed.equipped || this.fpGunTeam!==followed.team) {
        this.fpMuzzleFlash?.dispose();this.fpMuzzleFlash=undefined;
        this.fpGunRoot?.dispose();
        this.fpGunRoot=createViewmodelMesh(followed.equipped,followed.team,'viewmodel-gun',this.scene,hex=>this.material(hex));
        this.fpGunWeapon=followed.equipped;
        this.fpGunTeam=followed.team;
      }
      this.fpGunRoot.setEnabled(true);
      const firing=Object.hasOwn(LIVE_WEAPONS,followed.equipped)&&current.time-followed.lastShot<.08;
      const swing=followed.equipped==='knife'?Math.sin(Math.min(1,Math.max(0,(current.time-followed.lastSwing)/.35))*Math.PI):0;
      const throwElapsed=followed.throwAt===undefined?-1:current.time-followed.throwAt;
      const throwPhase=throwElapsed<0||throwElapsed>.65?undefined:throwElapsed/.65;
      const throwLift=throwPhase===undefined?0:throwPhase<.3?ease01(throwPhase/.3):1-ease01((throwPhase-.3)/.7);
      const throwRelease=throwPhase===undefined||throwPhase<.3?0:1-ease01((throwPhase-.3)/.2);
      const draw=Math.min(1,followed.weaponReady/.45);
      const reloadProgress=followed.reload>0?1-Math.max(0,Math.min(1,followed.reload/LIVE_WEAPONS[followed.weapon].reload)):0;
      const reload=followed.reload>0?Math.sin(reloadProgress*Math.PI):0;
      const reloadParts=(this.fpGunRoot.metadata as {reloadParts?:ViewmodelReloadParts}|undefined)?.reloadParts;
      if(reloadParts){
        const inReloadMotion=followed.reload>0&&reloadProgress>.1&&reloadProgress<.86;
        reloadParts.arm.setEnabled(inReloadMotion);
        reloadParts.magazine.setEnabled(followed.reload>0&&reloadProgress>.18&&reloadProgress<.68);
        const reach=Math.max(0,Math.min(1,(reloadProgress-.1)/.2));
        const recover=Math.max(0,Math.min(1,(reloadProgress-.68)/.18));
        const reachBlend=reach*(1-recover);
        reloadParts.arm.position.set(-.27+.13*reachBlend,-.24+.12*reachBlend,-.06+.12*reachBlend);
        reloadParts.arm.rotation.x=-.35*reachBlend;
        reloadParts.magazine.position.set(-.05,-.2+Math.min(.13,Math.abs(reloadProgress-.42)*.42),.04);
        reloadParts.magazine.rotation.x=.28+reload*1.1;
      }
      const kick=firing?.04:0;
      const kickPitch=firing?.06:0;

      const fwd=this.cameraTarget.subtract(this.camera.position).normalize();
      const right=Vector3.Cross(Vector3.Up(),fwd).normalize();
      const up=Vector3.Cross(fwd,right).normalize();

      const vp=this.camera.position
        .add(right.scale(.22-swing*.2))
        .subtract(up.scale(.18+draw*.25+reload*.15))
        .add(fwd.scale(.42-kick+swing*.18));

      this.fpGunRoot.position.copyFrom(vp);
      this.fpGunRoot.rotation.y=followed.yaw;
      this.fpGunRoot.rotation.x=kickPitch+draw*.5+reload*.4-throwLift*.28+throwRelease*.68;
      this.fpGunRoot.rotation.z=swing*1.1+reload*.4-throwLift*.2+throwRelease*.35;

      const muzzle=(this.fpGunRoot.metadata as WeaponViewMetadata|undefined)?.muzzle;
      if(!this.fpMuzzleFlash&&muzzle)this.fpMuzzleFlash=this.createMuzzleFlash('fp-muzzle-flash',muzzle);
      this.mainMuzzleEnabled=firing&&!!this.fpMuzzleFlash;
      this.fpMuzzleFlash?.setEnabled(this.mainMuzzleEnabled);
    } else {
      this.fpGunRoot?.setEnabled(false);
      this.fpMuzzleFlash?.setEnabled(false);
    }
    // Resolve both views after their weapon poses, recoil and camera transforms.
    this.updateShotTracers(current);

    // Secondary Bomb-Plant PIP camera: strictly active only during C4 plant/settle beat.
    const pipShouldRender=allowPip && decision.pip.active && this.pipViewport!==null;
    if(decision.pip.active) {
      const pipPose=computeBombPlantPipPose(decision.pip,players);
      const pipKey=`${current.round}:${decision.pip.site??''}:${decision.pip.planterId??''}`;
      const pipCut=pipKey!==this.previousPipKey;
      const pipBlend=pipCut?1:1-Math.exp(-Math.max(0,Math.min(.1,elapsed))*7);
      const desiredPipPos=new Vector3(pipPose.position.x,pipPose.position.y,pipPose.position.z);
      const desiredPipTarget=new Vector3(pipPose.target.x,pipPose.target.y,pipPose.target.z);
      this.pipCamera.position=Vector3.Lerp(this.pipCamera.position,desiredPipPos,pipBlend);
      this.pipTarget=Vector3.Lerp(this.pipTarget,desiredPipTarget,pipBlend);
      this.pipCamera.setTarget(this.pipTarget);
      this.pipCamera.fov=mix(this.pipCamera.fov,pipPose.fov,pipBlend);
      this.previousPipKey=pipKey;
    } else {
      this.previousPipKey='';
    }

    if(pipShouldRender && !this.pipActive) {
      this.scene.activeCameras=[this.camera,this.pipCamera];
      this.pipActive=true;
    } else if(!pipShouldRender && this.pipActive) {
      this.scene.activeCameras=[this.camera];
      this.pipActive=false;
    }

    this.scene.render();
    return decision;
  }
  private followCamera(player:LivePlayer,first:boolean,blend:number,time:number,zoom:boolean) {
    const dx=Math.sin(player.yaw),dz=Math.cos(player.yaw);
    const jumpOffset=player.jumpY??0;
    const clampedX=Math.max(-33.5,Math.min(33.5,player.x));
    const clampedZ=Math.max(-42.5,Math.min(42.5,player.z));
    if(first){
      const targetY=(player.crouch?1.08:1.6)+jumpOffset;
      this.currentEyeY=mix(this.currentEyeY,targetY,Math.min(1,blend*2.2));
      const bob=player.speed>2.5?Math.sin(time*12)*.015:(player.crouch&&player.speed>.3?Math.sin(time*7)*.008:0);
      this.camera.fov=mix(this.camera.fov,zoom?.6:1.12,blend);
      this.camera.position.set(clampedX,this.currentEyeY+bob,clampedZ);
      this.cameraTarget.set(clampedX+dx*20,this.currentEyeY+bob,clampedZ+dz*20);
      this.camera.setTarget(this.cameraTarget);
      return;
    }
    const pose=computeThirdPersonCameraPose(player);
    this.camera.fov=mix(this.camera.fov,pose.fov,blend);
    const desired=new Vector3(pose.position.x,pose.position.y,pose.position.z);
    const smooth=Vector3.Lerp(this.camera.position,desired,blend);
    // Keep camera close to the model's back without letting lerp sweep through a wall corner.
    const crosses=LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(player,{x:smooth.x,z:smooth.z},w,.22));
    this.camera.position.copyFrom(crosses?desired:smooth);
    this.cameraTarget=Vector3.Lerp(this.cameraTarget,new Vector3(pose.target.x,pose.target.y,pose.target.z),blend);
    this.camera.setTarget(this.cameraTarget);
  }
  dispose() {
    if(this.disposed)return;this.disposed=true;this.resize.disconnect();
    this.fpGunRoot?.dispose();this.fpMuzzleFlash?.dispose();
    for(const item of this.droppedMeshes.values()){item.root.dispose();item.ring.dispose();}
    this.droppedMeshes.clear();
    for(const view of this.actors.values()){
      view.operative.root.dispose();
      view.gunNode?.dispose();
    }
    this.scene.dispose();this.engine.dispose();
  }
}
