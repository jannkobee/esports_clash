import { Engine, Scene, FreeCamera, Vector3, Color3, Color4, HemisphericLight, DirectionalLight, StandardMaterial, MeshBuilder, DynamicTexture, ShadowGenerator, TransformNode, type Mesh, type LinesMesh } from '@babylonjs/core';
import { LIVE_FPS_MAP, distance, liveSightline } from './fpsLiveMap.ts';
import { segmentHitsWall } from './fpsSpatialWorld.ts';
import type { LiveSnapshot, LivePlayer } from './fpsLiveSimulation.ts';
import { buildLiveScenery } from './fpsLiveScenery.ts';
import { LIVE_KNIFE, type LiveEquippedWeapon } from './fpsLiveWeapons.ts';
import type { FpsTeamId } from './types.ts';

export type LiveCameraMode='director'|'first'|'third'|'overview';
const blue='#4bc5ef',red='#ed8d68';
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;

interface OperativeView {
  root: TransformNode;
  torso: Mesh;
  leftLeg: Mesh;
  rightLeg: Mesh;
  leftArm: Mesh;
  rightArm: Mesh;
  head: Mesh;
}

interface ActorView {
  operative: OperativeView;
  gunNode?: TransformNode;
  gunWeapon?: LiveEquippedWeapon;
}

function createTacticalOperativeMesh(team: FpsTeamId, id: string, scene: Scene, getMat: (hex: string) => StandardMaterial): OperativeView {
  const root = new TransformNode(`operative-${id}`, scene);

  const add = (m: Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    m.parent = root;
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    m.isPickable = false;
    m.receiveShadows = true;
    return m;
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

    const leftLeg = MeshBuilder.CreateBox(`${id}-leg-l`, { width: 0.15, height: 0.64, depth: 0.17 }, scene);
    leftLeg.material = navy; add(leftLeg, -0.11, 0.42, 0);

    const rightLeg = MeshBuilder.CreateBox(`${id}-leg-r`, { width: 0.15, height: 0.64, depth: 0.17 }, scene);
    rightLeg.material = navy; add(rightLeg, 0.11, 0.42, 0);

    const kneeL = MeshBuilder.CreateBox(`${id}-knee-l`, { width: 0.16, height: 0.12, depth: 0.06 }, scene);
    kneeL.material = darkGear; add(kneeL, -0.11, 0.42, 0.09);

    const kneeR = MeshBuilder.CreateBox(`${id}-knee-r`, { width: 0.16, height: 0.12, depth: 0.06 }, scene);
    kneeR.material = darkGear; add(kneeR, 0.11, 0.42, 0.09);

    const bootL = MeshBuilder.CreateBox(`${id}-boot-l`, { width: 0.16, height: 0.16, depth: 0.24 }, scene);
    bootL.material = darkGear; add(bootL, -0.11, 0.08, 0.03);

    const bootR = MeshBuilder.CreateBox(`${id}-boot-r`, { width: 0.16, height: 0.16, depth: 0.24 }, scene);
    bootR.material = darkGear; add(bootR, 0.11, 0.08, 0.03);

    const leftArm = MeshBuilder.CreateBox(`${id}-arm-l`, { width: 0.13, height: 0.52, depth: 0.14 }, scene);
    leftArm.material = navy; add(leftArm, -0.28, 1.05, 0);

    const rightArm = MeshBuilder.CreateBox(`${id}-arm-r`, { width: 0.13, height: 0.52, depth: 0.14 }, scene);
    rightArm.material = navy; add(rightArm, 0.28, 1.05, 0);

    const gloveL = MeshBuilder.CreateBox(`${id}-glove-l`, { width: 0.135, height: 0.14, depth: 0.145 }, scene);
    gloveL.material = darkGear; add(gloveL, -0.28, 0.84, 0);

    const gloveR = MeshBuilder.CreateBox(`${id}-glove-r`, { width: 0.135, height: 0.14, depth: 0.145 }, scene);
    gloveR.material = darkGear; add(gloveR, 0.28, 0.84, 0);

    return { root, torso, leftLeg, rightLeg, leftArm, rightArm, head };
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

    const leftLeg = MeshBuilder.CreateBox(`${id}-leg-l`, { width: 0.15, height: 0.64, depth: 0.17 }, scene);
    leftLeg.material = olivePants; add(leftLeg, -0.11, 0.42, 0);

    const rightLeg = MeshBuilder.CreateBox(`${id}-leg-r`, { width: 0.15, height: 0.64, depth: 0.17 }, scene);
    rightLeg.material = olivePants; add(rightLeg, 0.11, 0.42, 0);

    const pocketL = MeshBuilder.CreateBox(`${id}-pocket-l`, { width: 0.05, height: 0.15, depth: 0.15 }, scene);
    pocketL.material = olivePants; add(pocketL, -0.18, 0.45, 0);

    const pocketR = MeshBuilder.CreateBox(`${id}-pocket-r`, { width: 0.05, height: 0.15, depth: 0.15 }, scene);
    pocketR.material = olivePants; add(pocketR, 0.18, 0.45, 0);

    const bootL = MeshBuilder.CreateBox(`${id}-boot-l`, { width: 0.16, height: 0.16, depth: 0.24 }, scene);
    bootL.material = bootsMat; add(bootL, -0.11, 0.08, 0.03);

    const bootR = MeshBuilder.CreateBox(`${id}-boot-r`, { width: 0.16, height: 0.16, depth: 0.24 }, scene);
    bootR.material = bootsMat; add(bootR, 0.11, 0.08, 0.03);

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

    return { root, torso, leftLeg, rightLeg, leftArm, rightArm, head };
  }
}

function create3DWeaponMesh(weapon: LiveEquippedWeapon, id: string, scene: Scene, getMat: (hex: string) => StandardMaterial): TransformNode {
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
  } else if (weapon === 'flash' || weapon === 'smoke') {
    const can = MeshBuilder.CreateCylinder(`${id}-grenade-body`, { height: .13, diameter: .062, tessellation: 12 }, scene);
    can.material = weapon === 'flash' ? darkMetal : olive; add(can, 0, 0, 0);
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

  return root;
}

function createViewmodelMesh(weapon: LiveEquippedWeapon, team: FpsTeamId, id: string, scene: Scene, getMat: (hex: string) => StandardMaterial): TransformNode {
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
  const isGrenade = weapon === 'flash' || weapon === 'smoke';

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

  return root;
}

/** Presentation only: collision-volume proxies, never generated or qualified character assets. */
export class FpsLiveViewer {
  private engine:Engine;
  private scene:Scene;
  private camera:FreeCamera;
  private resize:ResizeObserver;
  private actors=new Map<string,ActorView>();
  private droppedMeshes=new Map<number,{root:TransformNode;ring:Mesh}>();
  private smokes=new Map<number,Mesh>();
  private tracers=new Map<number,LinesMesh>();
  private grenades=new Map<number,Mesh>();
  private materials=new Map<string,StandardMaterial>();
  private fpGunRoot?:TransformNode;
  private fpGunWeapon?:LiveEquippedWeapon;
  private fpGunTeam?:FpsTeamId;
  private currentEyeY=1.6;
  private fpMuzzleFlash?:Mesh;
  private device:Mesh;
  private followed='';
  private cutAt=-100;
  private disposed=false;
  private shadows!:ShadowGenerator;
  private previousCamera='';
  private previousRound=0;
  private cameraTarget=new Vector3(0,0,4);
  effectiveMode:Exclude<LiveCameraMode,'director'>='overview';

  constructor(canvas:HTMLCanvasElement,onLost:()=>void) {
    this.engine=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true});
    this.scene=new Scene(this.engine);
    this.camera=new FreeCamera('broadcast-camera',new Vector3(0,72,-63),this.scene);
    this.device=MeshBuilder.CreateBox('objective-device',{width:.5,height:.2,depth:.35},this.scene);
    this.resize=new ResizeObserver(()=>{if(!this.disposed)this.engine.resize();});
    try {
      this.engine.setHardwareScalingLevel(1/Math.min(1.5,window.devicePixelRatio||1));
      this.scene.clearColor=new Color4(.58,.74,.82,1);
      this.scene.fogMode=Scene.FOGMODE_EXP2;this.scene.fogDensity=.0026;this.scene.fogColor=new Color3(.58,.74,.82);
      this.scene.imageProcessingConfiguration.contrast=1.15;this.scene.imageProcessingConfiguration.exposure=1.08;
      this.camera.minZ=.06;this.camera.maxZ=300;this.camera.fov=1.12;
      this.scene.activeCamera=this.camera;
      const sky=new HemisphericLight('harbor-sky',Vector3.Up(),this.scene);sky.intensity=.68;sky.groundColor=new Color3(.32,.34,.32);
      const sun=new DirectionalLight('mediterranean-sun',new Vector3(-.55,-1,.32),this.scene);sun.position.set(35,65,-35);sun.intensity=1.35;sun.diffuse=new Color3(1,.94,.82);
      this.shadows=new ShadowGenerator(1024,sun);this.shadows.usePercentageCloserFiltering=true;this.shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;this.shadows.bias=.002;this.shadows.normalBias=.1;this.shadows.setDarkness(.32);
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
      for(const [site,position] of Object.entries(LIVE_FPS_MAP.sites)) {
        const pad=MeshBuilder.CreateGround(`site-${site}`,{width:8.5,height:8.5},this.scene);pad.position.set(position.x,.025,position.z);pad.material=this.material(site==='A'?'#9e4536':'#7a3227');pad.receiveShadows=true;
        const label=MeshBuilder.CreateGround(`site-${site}-label`,{width:4.2,height:4.2},this.scene);label.position.set(position.x,.04,position.z);
        const mat=new StandardMaterial(`site-${site}-type`,this.scene),tex=new DynamicTexture(`site-${site}-text`,256,this.scene,false);
        tex.hasAlpha=true;tex.drawText(site,null,195,'bold 190px sans-serif','#fff4dc','transparent',true);mat.diffuseTexture=tex;mat.useAlphaFromDiffuseTexture=true;mat.specularColor=Color3.Black();label.material=mat;
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
  render(previous:LiveSnapshot,current:LiveSnapshot,alpha:number,mode:LiveCameraMode,selected:string,elapsed=1/60):string {
    if(this.disposed)return '';
    const players=current.players.map(p=>{
      const before=previous.round===current.round?previous.players.find(a=>a.id===p.id):undefined;
      if(!before)return p;
      const delta=Math.atan2(Math.sin(p.yaw-before.yaw),Math.cos(p.yaw-before.yaw));
      return {...p,x:mix(before.x,p.x,alpha),z:mix(before.z,p.z,alpha),yaw:before.yaw+delta*alpha};
    });
    const alive=players.filter(p=>p.hp>0);
    if(mode==='director') {
      const value=(p:LivePlayer)=>{
        const combat=Math.max(0,3-(current.time-p.lastShot))*1.5;
        const action=p.channel>0?10:0;
        const nearby=alive.some(a=>a.team!==p.team&&distance(p,a)<22&&liveSightline(p,a))?1.5:0;
        return action+combat+nearby+(p.bomb?.6:0);
      };
      const focus=[...alive].sort((a,b)=>value(b)-value(a))[0]??players[0];
      const existing=players.find(p=>p.id===this.followed);
      if(!existing || existing.hp<=0 || (current.time-this.cutAt>6 && value(focus)>value(existing)+.8) || (focus.channel>0&&current.time-this.cutAt>1.5)){
        if(this.followed!==focus.id){this.followed=focus.id;this.cutAt=current.time;}
      }
    } else {
      const selectedPlayer=players.find(p=>p.id===selected);
      this.followed=(selectedPlayer&&selectedPlayer.hp>0?selectedPlayer:alive.find(p=>p.team===selectedPlayer?.team)??alive[0]??players[0]).id;
    }
    const followed=players.find(p=>p.id===this.followed)??players[0];
    const effectiveMode=mode==='director'?(current.phase!=='live'?'overview':current.time-followed.lastShot<3?'first':'third'):mode;
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
      }
      let hidden=player.hp<=0 || (effectiveMode==='first' && followed.id===player.id);
      if(effectiveMode==='first' && !hidden && player.team===followed.team) {
        const camDist=Vector3.Distance(this.camera.position, view.operative.root.position);
        if(camDist<1.05) hidden=true;
      }
      view.operative.root.setEnabled(!hidden);
      view.gunNode.setEnabled(!hidden);

      const jumpY = player.jumpY ?? 0;
      view.operative.root.position.set(player.x,jumpY,player.z);
      view.operative.root.rotation.y=player.yaw;

      if(!hidden) {
        const isCrouching=player.crouch;
        const crouchDrop=isCrouching?0.38:0;
        const throwElapsed=player.throwAt===undefined?-1:current.time-player.throwAt;
        const throwPhase=throwElapsed<0||throwElapsed>.55?undefined:throwElapsed/.55;
        const throwLift=throwPhase===undefined?0:throwPhase<.35?throwPhase/.35:Math.max(0,1-(throwPhase-.35)/.65);
        const throwRelease=throwPhase===undefined||throwPhase<.35?0:Math.sin(((throwPhase-.35)/.65)*Math.PI);

        view.operative.torso.position.y=1.05-crouchDrop;
        view.operative.head.position.y=1.54-crouchDrop;
        view.operative.leftArm.position.y=1.05-crouchDrop;
        view.operative.rightArm.position.y=1.05-crouchDrop;
        view.operative.leftLeg.scaling.y=isCrouching?0.62:1.0;
        view.operative.rightLeg.scaling.y=isCrouching?0.62:1.0;
        view.operative.leftLeg.position.y=isCrouching?0.26:0.42;
        view.operative.rightLeg.position.y=isCrouching?0.26:0.42;

        // Weapon holding arm poses
        if(player.equipped==='knife') {
          const swing=Math.sin(Math.min(1,Math.max(0,(current.time-player.lastSwing)/.35))*Math.PI);
          view.operative.rightArm.rotation.x=-0.65+swing*0.9;
          view.operative.rightArm.rotation.y=-0.2;
          view.operative.leftArm.rotation.x=-0.4;
          view.operative.leftArm.rotation.y=0.3;
        } else {
          view.operative.rightArm.rotation.x=-0.72-throwLift*.82+throwRelease*1.35;
          view.operative.rightArm.rotation.y=-0.28+throwRelease*.24;
          view.operative.leftArm.rotation.x=-0.82;
          view.operative.leftArm.rotation.y=0.42;
        }
        if(player.equipped==='knife') {
          view.operative.rightArm.rotation.x-=throwLift*.3;
          view.operative.rightArm.rotation.z=throwRelease*.35;
        } else {
          view.operative.rightArm.rotation.z=-throwLift*.2+throwRelease*.3;
        }

        // Natural stride animation when moving or tucking when jumping
        if(jumpY > 0.06) {
          view.operative.leftLeg.rotation.x=-0.38;
          view.operative.rightLeg.rotation.x=-0.28;
          view.operative.leftArm.rotation.x=-0.6;
          view.operative.rightArm.rotation.x=-0.5;
        } else if(player.speed>.15) {
          const strideRate=player.speed>2.5?12:(isCrouching?6:7);
          const cycle=Math.sin(current.time*strideRate);
          view.operative.leftLeg.rotation.x=cycle*(isCrouching?0.22:0.38);
          view.operative.rightLeg.rotation.x=-cycle*(isCrouching?0.22:0.38);
          view.operative.leftArm.rotation.x+=-cycle*0.12;
          view.operative.rightArm.rotation.x+=cycle*0.08;
        } else {
          view.operative.leftLeg.rotation.x=0;
          view.operative.rightLeg.rotation.x=0;
        }

        const rightX=Math.cos(player.yaw), rightZ=-Math.sin(player.yaw);
        const forwardX=Math.sin(player.yaw), forwardZ=Math.cos(player.yaw);
        const gunY=(isCrouching?0.68:1.05)+jumpY;
        view.gunNode.position.set(player.x+forwardX*.35+rightX*.2, gunY, player.z+forwardZ*.35+rightZ*.2);
        view.gunNode.rotation.y=player.yaw;
        view.gunNode.rotation.x=player.weaponReady>0?.5:0;
        view.gunNode.rotation.z=player.equipped==='knife'?Math.sin(Math.min(1,Math.max(0,(current.time-player.lastSwing)/.35))*Math.PI):0;
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
    for(const [id,mesh] of this.smokes)if(!current.smokes.some(s=>s.id===id)){mesh.material?.dispose();mesh.dispose();this.smokes.delete(id);}
    for(const smoke of current.smokes) {
      if(!this.smokes.has(smoke.id)) {
        const mesh=MeshBuilder.CreateSphere(`smoke-${smoke.id}`,{diameter:smoke.radius*2,segments:12},this.scene);
        mesh.position.set(smoke.x,smoke.y,smoke.z);
        const mat=new StandardMaterial(`smoke-material-${smoke.id}`,this.scene);mat.diffuseColor=new Color3(.7,.74,.73);mat.alpha=.92;mat.specularColor=Color3.Black();mesh.material=mat;
        this.smokes.set(smoke.id,mesh);
      }
    }
    for(const [id,mesh] of this.grenades)if(!current.grenades.some(g=>g.id===id)){mesh.dispose();this.grenades.delete(id);}
    for(const grenade of current.grenades) {
      let mesh=this.grenades.get(grenade.id);
      if(!mesh){mesh=MeshBuilder.CreateSphere(`grenade-${grenade.id}`,{diameter:.22,segments:8},this.scene);mesh.material=this.material(grenade.kind==='flash'?'#e4d6a3':'#687e78');this.grenades.set(grenade.id,mesh);}
      mesh.position.set(grenade.x,grenade.y,grenade.z);
    }
    for(const [id,mesh] of this.tracers)if(!current.shots.some(s=>s.id===id)){mesh.dispose();this.tracers.delete(id);}
    for(const shot of current.shots)if(!this.tracers.has(shot.id)) {
      const line=MeshBuilder.CreateLines(`shot-${shot.id}`,{points:[new Vector3(shot.from.x,1.45,shot.from.z),new Vector3(shot.to.x,1.45,shot.to.z)]},this.scene);
      line.color=Color3.FromHexString(shot.team==='blue'?'#b1efff':'#ffe1aa');this.tracers.set(shot.id,line);
    }
    this.device.setEnabled(current.bomb.status==='planted'||current.bomb.status==='dropped');this.device.position.set(current.bomb.x,.15,current.bomb.z);
    const zoom=effectiveMode==='first'&&followed.equipped==='sniper'&&followed.action==='Engaging';
    const desiredFov=effectiveMode==='overview'?.95:zoom?.6:1.12;
    const cameraKey=`${effectiveMode}:${followed.id}`,cut=cameraKey!==this.previousCamera||this.previousRound!==current.round;
    const blend=cut?1:1-Math.exp(-Math.max(0,Math.min(.1,elapsed))*9);
    this.camera.fov=mix(this.camera.fov,desiredFov,blend);
    if(effectiveMode==='overview') {
      this.camera.position=Vector3.Lerp(this.camera.position,new Vector3(0,68,-52),blend);
      this.cameraTarget=Vector3.Lerp(this.cameraTarget,new Vector3(0,0,2),blend);this.camera.setTarget(this.cameraTarget);
    } else this.followCamera(followed,effectiveMode==='first',blend,current.time);
    this.previousCamera=cameraKey;this.previousRound=current.round;
    // First-person viewmodel and muzzle flash
    if(effectiveMode==='first' && followed.hp>0) {
      if(!this.fpGunRoot || this.fpGunWeapon!==followed.equipped || this.fpGunTeam!==followed.team) {
        this.fpGunRoot?.dispose();
        this.fpGunRoot=createViewmodelMesh(followed.equipped,followed.team,'viewmodel-gun',this.scene,hex=>this.material(hex));
        this.fpGunWeapon=followed.equipped;
        this.fpGunTeam=followed.team;
      }
      this.fpGunRoot.setEnabled(true);
      const firing=followed.equipped!=='knife'&&current.time-followed.lastShot<.08;
      const swing=followed.equipped==='knife'?Math.sin(Math.min(1,Math.max(0,(current.time-followed.lastSwing)/.35))*Math.PI):0;
      const throwElapsed=followed.throwAt===undefined?-1:current.time-followed.throwAt;
      const throwPhase=throwElapsed<0||throwElapsed>.55?undefined:throwElapsed/.55;
      const throwLift=throwPhase===undefined?0:throwPhase<.35?throwPhase/.35:Math.max(0,1-(throwPhase-.35)/.65);
      const throwRelease=throwPhase===undefined||throwPhase<.35?0:Math.sin(((throwPhase-.35)/.65)*Math.PI);
      const draw=Math.min(1,followed.weaponReady/.45);
      const reload=followed.reload>0?Math.sin(Math.min(1,followed.reload/3.1)*Math.PI):0;
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

      if(!this.fpMuzzleFlash) {
        this.fpMuzzleFlash=MeshBuilder.CreateSphere('fp-muzzle-flash',{diameter:.11,segments:6},this.scene);
        const flashMat=new StandardMaterial('flash-mat',this.scene);
        flashMat.emissiveColor=new Color3(1,.85,.3);
        flashMat.diffuseColor=new Color3(1,.9,.4);
        flashMat.specularColor=Color3.Black();
        this.fpMuzzleFlash.material=flashMat;
        this.fpMuzzleFlash.isPickable=false;
      }
      this.fpMuzzleFlash.setEnabled(firing);
      if(firing) {
        const barrelOffset=followed.equipped==='sniper'?.85:followed.equipped==='rifle'?.6:.32;
        this.fpMuzzleFlash.position.copyFrom(vp.add(fwd.scale(barrelOffset)));
      }
    } else {
      this.fpGunRoot?.setEnabled(false);
      this.fpMuzzleFlash?.setEnabled(false);
    }
    this.scene.render();return followed.id;
  }
  private followCamera(player:LivePlayer,first:boolean,blend:number,time:number) {
    const dx=Math.sin(player.yaw),dz=Math.cos(player.yaw);
    const jumpOffset=player.jumpY??0;
    const clampedX=Math.max(-33.5,Math.min(33.5,player.x));
    const clampedZ=Math.max(-42.5,Math.min(42.5,player.z));
    if(first){
      const targetY=(player.crouch?1.08:1.6)+jumpOffset;
      this.currentEyeY=mix(this.currentEyeY,targetY,Math.min(1,blend*2.2));
      const bob=player.speed>2.5?Math.sin(time*12)*.015:(player.crouch&&player.speed>.3?Math.sin(time*7)*.008:0);
      this.camera.position.set(clampedX,this.currentEyeY+bob,clampedZ);
      this.cameraTarget.set(clampedX+dx*20,this.currentEyeY+bob,clampedZ+dz*20);
      this.camera.setTarget(this.cameraTarget);
      return;
    }
    let offset=5;
    while(offset>.3 && LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(player,{x:clampedX-dx*offset,z:clampedZ-dz*offset},w,.15)))offset-=.2;
    const targetY=(player.crouch?1.85:2.5)+jumpOffset;
    const desired=new Vector3(Math.max(-33.5,Math.min(33.5,clampedX-dx*offset)),targetY+offset*.14,Math.max(-42.5,Math.min(42.5,clampedZ-dz*offset)));
    const smooth=Vector3.Lerp(this.camera.position,desired,blend);
    // A smooth camera still cannot travel through the wall around a corner.
    const crosses=LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(player,{x:smooth.x,z:smooth.z},w,.15));
    this.camera.position.copyFrom(crosses?desired:smooth);
    this.cameraTarget=Vector3.Lerp(this.cameraTarget,new Vector3(clampedX+dx*3,(player.crouch?0.85:1.25)+jumpOffset,clampedZ+dz*3),blend);
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
