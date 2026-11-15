import {createLiveRagdoll,stepLiveRagdoll,type LiveRagdoll,type RagJoint} from './fpsLiveRagdoll.ts';
import { Engine, Scene, FreeCamera, Viewport, Vector3, Color3, Color4, HemisphericLight, DirectionalLight, PointLight, StandardMaterial, MeshBuilder, DynamicTexture, Texture, ShadowGenerator, TransformNode, Mesh, type LinesMesh } from '@babylonjs/core';
import { FONTESSA_MAP_RUNTIME } from './fpsLiveMap.ts';
import { getLiveMapRuntime } from './fpsLiveMapRegistry.ts';
import type { LiveMapId, LiveMapRuntime } from './fpsLiveMapTypes.ts';
import {FreeMapControls} from './fpsFreeCamera.ts';
import { segmentHitsWall } from './fpsSpatialWorld.ts';
import type { LiveSnapshot, LivePlayer, LiveBlast } from './fpsLiveSimulation.ts';
import { buildLiveScenery } from './fpsLiveScenery.ts';
import { buildSpillwayScenery } from './fpsSpillwayScenery.ts';
import { buildLiveSky, liveBoxSurfaceUV, LIVE_SURFACE_METRES, LiveSurfaceLibrary, type LiveSurface } from './fpsLiveGraphics.ts';
import { LIVE_CANAL as LIVE_RIVER, LIVE_PORT, liveCutPavingRect, LIVE_CANAL_CROSSINGS as LIVE_RIVER_BRIDGES } from './fpsLiveTerrain.ts';
import { SPILLWAY_SHALLOW_WATERS } from './fpsSpillwayTerrain.ts';
import { liveVillageAsset } from './fpsVillageDesign.ts';
import { createLiveSmokeRenderVolume, updateLiveSmokeRenderVolume, type LiveSmokeRenderVolume } from './fpsSmokeRendering.ts';
import { LIVE_KNIFE, type LiveEquippedWeapon } from './fpsLiveWeapons.ts';
import { LIVE_WEAPONS } from './fpsLiveWeapons.ts';
import type { FpsTeamId } from './fpsTypes.ts';
import { liveSmokeCloudLobes } from './fpsLiveBrain.ts';
import { stepLiveGrenade, type LiveGrenade, type LiveGrenadeKind } from './fpsLiveGrenades.ts';
import {batchStaticLiveGeometry,interpolateLivePlayer,LiveRenderCache} from './fpsLiveRenderOptimization.ts';
import {buildVariantOperativeDetails,resolveOperativeStyle,resolveOperativeVariantIndex,type OperativeStyleProfile} from './fpsOperativeDesign.ts';

export function computeLiveGrenadeTrajectoryPoints(
  grenade: LiveGrenade,
  startTime = grenade.releaseAt,
  endTime = grenade.detonateAt,
  runtime: LiveMapRuntime = FONTESSA_MAP_RUNTIME,
): Vector3[] {
  const simulated: LiveGrenade = { ...grenade };
  const start = Math.max(startTime, grenade.releaseAt);
  const clampedEnd = Math.min(endTime, grenade.detonateAt);
  const points: Vector3[] = [new Vector3(simulated.x, simulated.y, simulated.z)];
  if (clampedEnd <= start + 1e-6) return points;
  const step = 1 / 30;
  for (let at = start; at < clampedEnd - 1e-6; at += step) {
    stepLiveGrenade(simulated, Math.min(step, clampedEnd - at), runtime);
    const prev = points[points.length - 1];
    if (Math.hypot(simulated.x - prev.x, simulated.y - prev.y, simulated.z - prev.z) >= 0.08 || at + step >= clampedEnd - 1e-6) {
      points.push(new Vector3(simulated.x, simulated.y, simulated.z));
    }
  }
  return points;
}
import {
  computeBombPlantPipPose,
  computeCinematicCameraPose,computeFreezeShowcasePose,computeOverviewCameraPose,computeTacticalCameraPose,
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

export interface OperativeView {
  root: TransformNode;
  spine: TransformNode;
  headPivot: TransformNode;
  leftArmPivot: TransformNode;
  rightArmPivot: TransformNode;
  leftElbowPivot:TransformNode;rightElbowPivot:TransformNode;
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
  variantIndex?: number;
  variantStyle?: OperativeStyleProfile;
  landSquash?: number;
  wasAirborne?: boolean;
  prevJumpY?: number;
  flinch?: number;
  lastHp?: number;
  poseMemory?:{nodes:TransformNode[];rotations:Float32Array;initialized:boolean};
}

export interface ActorView {
  operative: OperativeView;
  force:'ct'|'t';
  gunNode?: TransformNode;
  gunWeapon?: LiveEquippedWeapon;
  muzzleFlash?:Mesh;
  weaponViews?:LiveRenderCache<LiveEquippedWeapon,{root:TransformNode;flash?:Mesh}>;
}

const isPistolEquipped = (weapon: LiveEquippedWeapon): boolean =>
  weapon === 'pistol' || weapon === 'usp_s' || weapon === 'glock' || weapon === 'deagle'
  || weapon === 'p250' || weapon === 'fiveseven' || weapon === 'tec9' || weapon === 'cz75';

const isHeavyEquipped = (weapon: LiveEquippedWeapon): boolean =>
  weapon === 'negev' || weapon === 'nova' || weapon === 'mag7';

interface WeaponGripProfile {
  pistol?: boolean;
  rightOffset: number;
  fwd: number;
  yOffset: number;
  yawOffset: number;
  rightHand: readonly [number, number, number];
  leftHand: readonly [number, number, number];
  magWell?: readonly [number, number, number];
  boltHandle?: readonly [number, number, number];
}

const DEFAULT_GRIP_PROFILE: WeaponGripProfile = {
  rightOffset: .16,
  fwd: .30,
  yOffset: .08,
  yawOffset: 0,
  rightHand: [0, -.02, 0],
  leftHand: [-.025, .04, .02],
};

const RIFLE_T_GRIP: WeaponGripProfile = {
  rightOffset: .065,
  fwd: .23,
  yOffset: .135,
  yawOffset: -.26,
  rightHand: [0, -.058, -.055],
  leftHand: [0, -.010, .185],
  magWell: [0, -.06, .085],
  boltHandle: [.026, .042, .03],
};

const RIFLE_CT_GRIP: WeaponGripProfile = {
  rightOffset: .065,
  fwd: .225,
  yOffset: .135,
  yawOffset: -.26,
  rightHand: [0, -.055, -.055],
  leftHand: [0, -.010, .185],
  magWell: [0, -.07, .07],
  boltHandle: [-.015, .052, -.05],
};

const PISTOL_STANDARD_GRIP: WeaponGripProfile = {
  pistol: true,
  rightOffset: .025,
  fwd: .34,
  yOffset: .130,
  yawOffset: -.04,
  rightHand: [0, -.045, -.025],
  leftHand: [-.020, -.048, -.008],
  magWell: [0, -.06, -.025],
};

const WEAPON_GRIP_PROFILES: Partial<Record<LiveEquippedWeapon, WeaponGripProfile>> = {
  pistol: PISTOL_STANDARD_GRIP,
  usp_s: PISTOL_STANDARD_GRIP,
  glock: PISTOL_STANDARD_GRIP,
  p250: PISTOL_STANDARD_GRIP,
  fiveseven: PISTOL_STANDARD_GRIP,
  deagle: {
    pistol: true,
    rightOffset: .025,
    fwd: .33,
    yOffset: .135,
    yawOffset: -.04,
    rightHand: [0, -.056, -.030],
    leftHand: [-.020, -.054, -.006],
    magWell: [0, -.07, -.03],
  },
  tec9: {
    pistol: true,
    rightOffset: .035,
    fwd: .30,
    yOffset: .125,
    yawOffset: -.10,
    rightHand: [0, -.050, -.042],
    leftHand: [-.010, -.050, .072],
    magWell: [0, -.068, .085],
  },
  cz75: {
    pistol: true,
    rightOffset: .035,
    fwd: .29,
    yOffset: .125,
    yawOffset: -.10,
    rightHand: [0, -.048, -.028],
    leftHand: [-.010, -.044, .095],
    magWell: [0, -.048, .110],
  },
  smg: {
    rightOffset: .055,
    fwd: .225,
    yOffset: .130,
    yawOffset: -.22,
    rightHand: [0, -.048, -.015],
    leftHand: [0, -.038, .135],
    magWell: [0, -.07, .02],
  },
  mp9: {
    rightOffset: .055,
    fwd: .225,
    yOffset: .130,
    yawOffset: -.22,
    rightHand: [0, -.048, -.015],
    leftHand: [0, -.048, .138],
    magWell: [0, -.07, .02],
  },
  mac10: {
    rightOffset: .050,
    fwd: .24,
    yOffset: .130,
    yawOffset: -.20,
    rightHand: [0, -.048, -.020],
    leftHand: [-.015, -.010, .100],
    magWell: [0, -.08, -.02],
  },
  rifle: RIFLE_T_GRIP,
  budget_t: RIFLE_T_GRIP,
  ak47: RIFLE_T_GRIP,
  budget_ct: RIFLE_CT_GRIP,
  m4a1_s: RIFLE_CT_GRIP,
  sniper: {
    rightOffset: .075,
    fwd: .25,
    yOffset: .135,
    yawOffset: -.22,
    rightHand: [0, -.055, -.115],
    leftHand: [0, .012, .125],
    magWell: [0, -.05, .02],
    boltHandle: [.032, .042, -.040],
  },
  scout: {
    rightOffset: .070,
    fwd: .24,
    yOffset: .135,
    yawOffset: -.22,
    rightHand: [0, -.048, -.095],
    leftHand: [0, .010, .135],
    magWell: [0, -.045, .02],
    boltHandle: [.028, .036, -.030],
  },
  nova: {
    rightOffset: .065,
    fwd: .20,
    yOffset: .130,
    yawOffset: -.27,
    rightHand: [0, -.050, -.055],
    leftHand: [0, .008, .195],
    magWell: [0, -.025, .05],
  },
  mag7: {
    rightOffset: .065,
    fwd: .21,
    yOffset: .130,
    yawOffset: -.25,
    rightHand: [0, -.055, -.075],
    leftHand: [0, .008, .175],
    magWell: [0, -.06, -.075],
  },
  negev: {
    rightOffset: .080,
    fwd: .21,
    yOffset: .095,
    yawOffset: -.25,
    rightHand: [0, -.048, -.085],
    leftHand: [-.015, -.012, .155],
    magWell: [0, -.075, .06],
  },
  knife: {
    rightOffset: .15,
    fwd: .28,
    yOffset: .06,
    yawOffset: -.08,
    rightHand: [0, -.01, -.01],
    leftHand: [-.16, .08, .02],
  },
  bomb: {
    rightOffset: .02,
    fwd: .26,
    yOffset: .04,
    yawOffset: 0,
    rightHand: [.08, -.01, .04],
    leftHand: [-.08, -.01, .04],
  },
};

const rotateGunAnchorToRoot = (
  anchor: readonly [number, number, number],
  gunRight: number,
  localGunY: number,
  gunFwd: number,
  rx: number,
  ryYawOffset: number,
  rz: number,
): [number, number, number] => {
  const [lx, ly, lz] = anchor;
  const cz = Math.cos(rz), sz = Math.sin(rz);
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ryYawOffset), sy = Math.sin(ryYawOffset);
  const x1 = lx * cz - ly * sz;
  const y1 = lx * sz + ly * cz;
  const y2 = y1 * cx - lz * sx;
  const z2 = y1 * sx + lz * cx;
  return [
    gunRight + x1 * cy + z2 * sy,
    localGunY + y2,
    gunFwd - x1 * sy + z2 * cy,
  ];
};

const solveArmToTarget = (
  shoulderX: number,
  shoulderY: number,
  target: readonly [number, number, number],
  armPivot: TransformNode,
  elbowPivot: TransformNode,
  upperLen = .25,
  lowerLen = .24,
): void => {
  const vx = target[0] - shoulderX;
  const vy = target[1] - shoulderY;
  const vz = target[2];
  const horiz = Math.hypot(vx, vz);
  const ry = horiz > 1e-4 ? Math.atan2(vx, vz) : 0;
  const dist = Math.min(upperLen + lowerLen - .002, Math.max(Math.abs(upperLen - lowerLen) + .003, Math.hypot(horiz, vy)));
  const alpha = Math.atan2(horiz, -vy);
  const cosS = Math.max(-1, Math.min(1, (upperLen * upperLen + dist * dist - lowerLen * lowerLen) / (2 * upperLen * dist)));
  const cosE = Math.max(-1, Math.min(1, (upperLen * upperLen + lowerLen * lowerLen - dist * dist) / (2 * upperLen * lowerLen)));
  armPivot.rotation.set(-(alpha - Math.acos(cosS)), ry, 0);
  elbowPivot.rotation.set(-(Math.PI - Math.acos(cosE)), 0, 0);
};

/** Articulated CT/T 3D operative animation covering reloads, throw styles, bolt/pump cycles, defusal, landing compression, hit flinch, weapon stances, and stride. */
export function applyOperativeAnimation(view: ActorView, player: LivePlayer, currentTime: number, elapsed: number): void {
  if (player.hp <= 0) return;
  const rig=view.operative;
  const memory=rig.poseMemory??(rig.poseMemory={nodes:[rig.spine,rig.headPivot,rig.leftArmPivot,rig.rightArmPivot,rig.leftElbowPivot,rig.rightElbowPivot,rig.leftLegPivot,rig.rightLegPivot,rig.leftKneePivot,rig.rightKneePivot],rotations:new Float32Array(30),initialized:false});
  for(let i=0;i<memory.nodes.length;i++){
    const r=memory.nodes[i].rotation;memory.rotations[i*3]=r.x;memory.rotations[i*3+1]=r.y;memory.rotations[i*3+2]=r.z;
  }
  const sampleDt = Math.max(.001, Math.min(.1, elapsed));
  const defusing = player.channel > 0 && !player.attacking;
  const planting = player.equipped === 'bomb' && player.channel > 0;
  const targetCrouch = defusing ? .92 : player.crouch ? 1 : 0;
  const blend = 1 - Math.exp(-sampleDt * 13);
  view.operative.crouchPose = mix(view.operative.crouchPose, targetCrouch, blend);
  const crouchPose = view.operative.crouchPose;

  const jumpY = player.jumpY ?? 0;
  const airborne = Boolean(player.jump || jumpY > .08);
  const wasAirborne = view.operative.wasAirborne ?? false;
  const airVel = (jumpY - (view.operative.prevJumpY ?? jumpY)) / sampleDt;
  if (!airborne && wasAirborne) {
    view.operative.landSquash = Math.min(1, (view.operative.landSquash ?? 0) + .85);
  }
  view.operative.wasAirborne = airborne;
  view.operative.prevJumpY = jumpY;
  view.operative.landSquash = (view.operative.landSquash ?? 0) * Math.exp(-sampleDt * 15);
  const landSquash = view.operative.landSquash;

  if (view.operative.lastHp !== undefined && player.hp < view.operative.lastHp) {
    view.operative.flinch = Math.min(1, (view.operative.flinch ?? 0) + Math.min(1, (view.operative.lastHp - player.hp) / 35));
  }
  view.operative.lastHp = player.hp;
  view.operative.flinch = (view.operative.flinch ?? 0) * Math.exp(-sampleDt * 14);
  const flinch = view.operative.flinch;

  const activeThrowStyle = player.utilityPrep?.throwStyle ?? player.throwStyle;
  const isUnderhand = activeThrowStyle === 'underhand';
  const isMediumThrow = activeThrowStyle === 'medium';
  const isJumpThrow = activeThrowStyle === 'jump' || activeThrowStyle === 'crouch-jump' || activeThrowStyle === 'walk-jump' || activeThrowStyle === 'run-jump';
  const throwElapsed = player.throwAt === undefined ? -1 : currentTime - player.throwAt;
  const throwPhase = throwElapsed < 0 || throwElapsed > .65 ? undefined : throwElapsed / .65;
  const throwLift = throwPhase === undefined ? 0 : throwPhase < .3 ? ease01(throwPhase / .3) : 1 - ease01((throwPhase - .3) / .7);
  const throwRelease = throwPhase === undefined || throwPhase < .3 ? 0 : 1 - ease01((throwPhase - .3) / .2);
  const throwFollow = throwPhase === undefined || throwPhase < .3 ? 0 : ease01(Math.min(1, (throwPhase - .3) / .35)) * (1 - ease01(Math.max(0, (throwPhase - .65) / .35)));
  const isThrowing = throwPhase !== undefined;
  const prepPhase = player.utilityPrep?.phase;
  const inUtilityPrep = Boolean(prepPhase);

  const weaponStats = LIVE_WEAPONS[player.weapon];
  const isReloading = player.reload > 0;
  const isTubeShotgun = player.weapon === 'nova';
  const reloadProgress = isReloading ? 1 - Math.max(0, Math.min(1, player.reload / (player.reloadDuration || weaponStats.reload))) : 0;
  const reloadWeight = isReloading ? Math.sin(reloadProgress * Math.PI) : 0;
  const shellCycle = isReloading && isTubeShotgun && reloadProgress >= .10 && reloadProgress < .80
    ? ((reloadProgress - .10) / .70) * 3
    : 0;
  const shellFrac = shellCycle > 0 ? shellCycle - Math.floor(shellCycle) : 0;
  const stripPhase = isReloading && !isTubeShotgun && reloadProgress < .22 ? Math.sin((reloadProgress / .22) * Math.PI) : 0;
  const pouchReach = isReloading && !isTubeShotgun && reloadProgress >= .18 && reloadProgress < .54 ? Math.sin(((reloadProgress - .18) / .36) * Math.PI) : 0;
  const insertPhase = isReloading && !isTubeShotgun && reloadProgress >= .50 && reloadProgress < .76 ? ease01((reloadProgress - .50) / .26) : 0;
  const magSlap = isReloading && !isTubeShotgun && reloadProgress >= .70 && reloadProgress < .80 ? Math.sin(((reloadProgress - .70) / .10) * Math.PI) : 0;
  const rackPhase = isReloading && reloadProgress >= .78 ? Math.sin(((reloadProgress - .78) / .22) * Math.PI) : 0;

  const sinceShot = currentTime - player.lastShot;
  const hasRecentShot = sinceShot >= 0 && sinceShot < .18;
  const recoilImpulse = hasRecentShot ? Math.sin(Math.min(1, sinceShot / .06) * Math.PI * .5) * Math.exp(-sinceShot * 16) : 0;
  const recoilScale = (player.equipped === 'sniper' || player.equipped === 'deagle' || player.equipped === 'mag7' || player.equipped === 'nova') ? 1.45 : (player.equipped === 'ak47' || player.equipped === 'scout') ? 1.15 : .8;
  const shotKick = recoilImpulse * recoilScale;

  const isBoltWeapon = player.equipped === 'sniper' || player.equipped === 'scout';
  const boltFromShot = isBoltWeapon && sinceShot >= .16 && sinceShot < .92 ? Math.sin(((sinceShot - .16) / .76) * Math.PI) : 0;
  const boltCycling = !isReloading && !inUtilityPrep && !isThrowing ? (player.scopeState === 'cycling' ? Math.max(.65, boltFromShot) : boltFromShot) : 0;

  const isPumpWeapon = player.equipped === 'nova' || player.equipped === 'mag7';
  const shotgunPump = !isReloading && !inUtilityPrep && !isThrowing && isPumpWeapon && sinceShot >= .14 && sinceShot < .62 ? Math.sin(((sinceShot - .14) / .48) * Math.PI) : 0;

  const scopedAds = !isReloading && !inUtilityPrep && !isThrowing && !boltCycling && (player.scopeState === 'scoped' || player.scopeState === 'raising')
    ? Math.max(0,Math.min(1,player.scopeLevel??(player.scopeState === 'scoped' ? 1 : .6)))
    : 0;
  const isBlinded = player.blinded > .15 && !defusing && !planting && !isReloading && !inUtilityPrep && !isThrowing;
  const blindBlend = isBlinded ? Math.min(1, (player.blinded - .15) / .5) : 0;
  const sinceRadio = player.radioAt === undefined ? -1 : currentTime - player.radioAt;
  const isRadioCalling = Boolean(player.radioMessage) && sinceRadio >= 0 && sinceRadio < 1.15 && (player.stance === 'run' || player.stance === 'walk') && !isReloading && !inUtilityPrep && !isThrowing && !defusing && !planting && !isBlinded && !boltCycling && player.weaponReady <= 0 && !hasRecentShot;

  const pistolGrip = isPistolEquipped(player.equipped);
  const heavyGrip = isHeavyEquipped(player.equipped);

  const totalPitch = (player.pitch ?? 0) + (player.recoilPitch ?? 0);
  const pitchArm = -totalPitch * .65;

  // Footfall phase follows actual travel distance; upper body and weapon remain CS2-steady while walking.
  const dx = view.operative.hasMotion ? player.x - view.operative.lastX : 0;
  const dz = view.operative.hasMotion ? player.z - view.operative.lastZ : 0;
  view.operative.lastX = player.x;
  view.operative.lastZ = player.z;
  view.operative.hasMotion = true;
  const forward = Math.sin(player.yaw) * dx + Math.cos(player.yaw) * dz;
  const lateral = Math.cos(player.yaw) * dx - Math.sin(player.yaw) * dz;
  const walkAmount = Math.max(0, Math.min(1, player.speed / (crouchPose > .5 ? 1.8 : 2.8)));
  if (player.speed > .12) view.operative.stridePhase += (forward < -.002 ? -1 : 1) * Math.hypot(dx, dz) * (crouchPose > .5 ? 3.5 : 4.4);
  const cycle = Math.sin(view.operative.stridePhase) * walkAmount * (1 - crouchPose * .45);
  const lateralStep = Math.max(-1, Math.min(1, (lateral / sampleDt) / (crouchPose > .5 ? 1.8 : 2.8)));
  const shuffle = Math.max(0, Math.min(1, Math.abs(lateralStep)));
  const legSwing = cycle * (1 - shuffle * .72);
  const forwardDir = forward < -.002 ? -.4 : 1;
  const sprintLean = walkAmount * .045 * forwardDir * (1 - crouchPose * .65) * (1 - scopedAds * .9);

  let idSeed = 0;
  for (let i = 0; i < player.id.length; i++) idSeed = (idSeed * 31 + player.id.charCodeAt(i)) & 0xff;
  const breathe = player.speed <= .12 && !airborne ? Math.sin(currentTime * 1.9 + idSeed * .19) : 0;

  const underhandDip = isUnderhand && (prepPhase === 'pin' || prepPhase === 'ready' || isThrowing)
    ? .05 * (prepPhase ? 1 : throwLift)
    : 0;
  const shoulderX = .192;
  const spineHeight = 1.05 - .23 * crouchPose - .065 * landSquash - underhandDip;
  const shoulderY = 1.29 - .23 * crouchPose - .065 * landSquash - underhandDip;
  const combatStanceYaw = !inUtilityPrep && !isThrowing && player.equipped !== 'knife' && player.equipped !== 'bomb'
    ? (scopedAds > 0 ? .16 + scopedAds * .08 : pistolGrip ? .06 : .14)
    : 0;

  view.operative.spine.position.y = spineHeight;
  view.operative.spine.rotation.x = .16 * crouchPose + sprintLean + .14 * landSquash + .04 * reloadWeight + pouchReach * .08 - shotKick * .06 - flinch * .09 + scopedAds * .04 + breathe * .004;
  view.operative.spine.rotation.y = combatStanceYaw - pouchReach * .15;
  view.operative.spine.rotation.z = -lateralStep * .028 + boltCycling * .07 + flinch * .07;

  view.operative.headPivot.position.y = 1.54 - .37 * crouchPose - .065 * landSquash - underhandDip;
  view.operative.headPivot.rotation.x = -.06 * crouchPose - totalPitch * .72 + .06 * landSquash + (pouchReach + insertPhase * .4) * .20 + scopedAds * .11 - flinch * .07 + rackPhase * .06;
  view.operative.headPivot.rotation.y = isBlinded ? -.24 * blindBlend : 0;
  view.operative.headPivot.rotation.z = lateralStep * .018 - scopedAds * (isBoltWeapon ? .18 : .14) + boltCycling * .06 + flinch * .04;

  view.operative.leftArmPivot.position.y = shoulderY;
  view.operative.rightArmPivot.position.y = shoulderY;
  view.operative.leftLegPivot.position.y = .74 - .14 * crouchPose - .03 * landSquash;
  view.operative.rightLegPivot.position.y = .74 - .14 * crouchPose - .03 * landSquash;
  view.operative.leftKneePivot.position.y = -.36 + .04 * crouchPose;
  view.operative.rightKneePivot.position.y = -.36 + .04 * crouchPose;

  // Solve third-person weapon pose first so two-handed IK locks hands directly onto weapon sockets.
  const rightX = Math.cos(player.yaw), rightZ = -Math.sin(player.yaw);
  const forwardX = Math.sin(player.yaw), forwardZ = Math.cos(player.yaw);
  const underhandGunDrop = isUnderhand && (inUtilityPrep || isThrowing)
    ? (inUtilityPrep ? (prepPhase === 'equip' ? .14 : .26) : mix(.26, .04, throwFollow))
    : 0;
  const overhandGunLift = !isUnderhand && !isMediumThrow && ((prepPhase === 'pin' || prepPhase === 'ready') || (isThrowing && throwLift > 0))
    ? (prepPhase ? .18 : .16 * throwLift - .10 * throwFollow)
    : 0;
  const profile = WEAPON_GRIP_PROFILES[player.equipped] ?? DEFAULT_GRIP_PROFILE;
  const pitchRad = Math.min(1, player.weaponReady / .35) * .45 + reloadWeight * .32 + pouchReach * .08 - magSlap * .12 - totalPitch * .85 - shotKick * (pistolGrip ? .22 : .14) - rackPhase * .14;

  let gunRight = profile.rightOffset;
  let gunFwd = profile.fwd;
  let localGunY = (1.05 - .23 * crouchPose) - .065 * landSquash + profile.yOffset;
  let gunYawOffset = profile.yawOffset;
  let gunRotX = pitchRad;
  let gunRotZ = 0;

  if (planting) {
    const plant = Math.min(1, player.channel / 3.2);
    gunRight = 0;
    gunFwd = .35;
    localGunY = .5 - plant * .15;
    gunYawOffset = 0;
    gunRotX = .5;
  } else if (defusing) {
    gunRight = .28;
    gunFwd = .12;
    localGunY = .45;
    gunYawOffset = 0;
    gunRotX = .68;
    gunRotZ = .42;
  } else if (inUtilityPrep || isThrowing) {
    gunRight = .2 + (overhandGunLift > .08 ? .07 : 0);
    gunFwd = .35 - (overhandGunLift > .08 ? .08 : 0);
    localGunY = (1.05 - .25 * crouchPose) - .065 * landSquash - underhandGunDrop + overhandGunLift;
    gunYawOffset = 0;
    gunRotX = Math.min(1, player.weaponReady / .35) * .5 - totalPitch * .85 - shotKick * .16;
  } else {
    const fwdKick = -shotKick * .045 - rackPhase * .06 - shotgunPump * .04;
    const pitchLift = -Math.sin(-totalPitch * .85) * (profile.pistol ? .20 : .14);
    const pitchFwdAdj = -(1 - Math.cos(-totalPitch * .85)) * .07;
    gunRight = profile.rightOffset + scopedAds * (profile.pistol ? 0 : -.025);
    gunFwd = profile.fwd + fwdKick + pitchFwdAdj;
    localGunY = (1.05 - .23 * crouchPose) - .065 * landSquash + profile.yOffset + pitchLift - reloadWeight * .09 + magSlap * .02 - (heavyGrip ? .02 : 0);
    gunYawOffset = profile.yawOffset;
    gunRotZ = player.equipped === 'knife'
      ? Math.sin(Math.min(1, Math.max(0, (currentTime - player.lastSwing) / .35)) * Math.PI)
      : reloadWeight * .34 + pouchReach * .16 - magSlap * .18 + rackPhase * .08 + boltCycling * .38;
  }

  const gunY = localGunY + jumpY;
  if (view.gunNode) {
    view.gunNode.position.set(player.x + forwardX * gunFwd + rightX * gunRight, gunY, player.z + forwardZ * gunFwd + rightZ * gunRight);
    view.gunNode.rotation.y = player.yaw + gunYawOffset + (player.recoilYaw ?? 0) * .35;
    view.gunNode.rotation.x = gunRotX;
    view.gunNode.rotation.z = gunRotZ;
    if (!planting && !defusing && (prepPhase === 'pin' || prepPhase === 'ready')) {
      for (const mesh of view.gunNode.getChildMeshes()) {
        if (mesh.name.endsWith('-grenade-pull-ring')) mesh.position.x = -.025 - Math.min(.1, (player.utilityPrep!.releaseAt - currentTime) * .08);
      }
    }
  }

  // Upper-body animation state machine with 2-bone weapon-socket IK
  const rightGripTarget = rotateGunAnchorToRoot(profile.rightHand, gunRight, localGunY, gunFwd, gunRotX, gunYawOffset, gunRotZ);
  const leftGripAnchor: readonly [number, number, number] = isPumpWeapon && shotgunPump > 0
    ? [profile.leftHand[0], profile.leftHand[1], profile.leftHand[2] - shotgunPump * .055]
    : profile.leftHand;
  const leftGripTarget = rotateGunAnchorToRoot(leftGripAnchor, gunRight, localGunY, gunFwd, gunRotX, gunYawOffset, gunRotZ);

  if (planting) {
    const plant = Math.min(1, player.channel / 3.2), tap = Math.sin(plant * 22) * .04;
    view.operative.spine.rotation.x = .24 + plant * .18;
    view.operative.headPivot.rotation.x = .35;
    view.operative.leftArmPivot.rotation.set(-1.05 + tap, .25, 0);
    view.operative.rightArmPivot.rotation.set(-1.1 - tap, -.22, 0);
    view.operative.leftElbowPivot.rotation.x = -.7;
    view.operative.rightElbowPivot.rotation.x = -.75;
  } else if (defusing) {
    const cutOsc = Math.sin(currentTime * 11);
    view.operative.spine.rotation.x = .44;
    view.operative.spine.rotation.y = .08;
    view.operative.headPivot.rotation.x = .48;
    view.operative.leftArmPivot.rotation.set(-1.12 + cutOsc * .08, .32, -.08);
    view.operative.rightArmPivot.rotation.set(-1.08 - cutOsc * .12, -.30, .08);
    view.operative.leftElbowPivot.rotation.x = -.92 + cutOsc * .16;
    view.operative.rightElbowPivot.rotation.x = -.96 - cutOsc * .22;
  } else if (inUtilityPrep) {
    if (prepPhase === 'equip') {
      view.operative.spine.rotation.y += .10;
      view.operative.rightArmPivot.rotation.set(-.58 + pitchArm * .3, -.32, .12);
      view.operative.rightElbowPivot.rotation.x = -1.18;
      view.operative.leftArmPivot.rotation.set(-.64 + pitchArm * .3, .45, -.10);
      view.operative.leftElbowPivot.rotation.x = -1.10;
    } else if (isUnderhand) {
      view.operative.spine.rotation.x += .16;
      view.operative.spine.rotation.y += .18;
      view.operative.rightArmPivot.rotation.set(.36 + pitchArm * .35, -.14, .14);
      view.operative.rightElbowPivot.rotation.x = -.45;
      view.operative.leftArmPivot.rotation.set(-.52 + pitchArm * .35, .36, -.08);
      view.operative.leftElbowPivot.rotation.x = -.95;
    } else if (isMediumThrow) {
      view.operative.spine.rotation.y += .22;
      view.operative.rightArmPivot.rotation.set(-.38 + pitchArm * .45, -.32, .28);
      view.operative.rightElbowPivot.rotation.x = -.88;
      view.operative.leftArmPivot.rotation.set(-.62 + pitchArm * .45, .44, -.10);
      view.operative.leftElbowPivot.rotation.x = -.92;
    } else {
      view.operative.spine.rotation.y += .30;
      view.operative.spine.rotation.x -= .08;
      view.operative.rightArmPivot.rotation.set(-2.05 + pitchArm * .45, -.18, .12);
      view.operative.rightElbowPivot.rotation.x = -1.22;
      view.operative.leftArmPivot.rotation.set(-.88 + pitchArm * .55, .34, -.06);
      view.operative.leftElbowPivot.rotation.x = -.78;
    }
  } else if (isThrowing && throwPhase !== undefined) {
    if (isUnderhand) {
      view.operative.spine.rotation.x += throwLift * .14 - throwFollow * .08;
      view.operative.spine.rotation.y += throwLift * .16 - throwFollow * .18;
      const scoopArm = throwPhase < .3 ? mix(.36, .42, ease01(throwPhase / .3)) : mix(.42, -1.12, ease01((throwPhase - .3) / .35));
      view.operative.rightArmPivot.rotation.set(scoopArm + pitchArm * .5, -.16, .10);
      view.operative.rightElbowPivot.rotation.x = -.48 - throwFollow * .60;
      view.operative.leftArmPivot.rotation.set(-.44 - throwLift * .12 + pitchArm * .4, .34, -.05);
      view.operative.leftElbowPivot.rotation.x = -.98;
    } else if (isMediumThrow) {
      view.operative.spine.rotation.y += throwLift * .22 - throwFollow * .24;
      view.operative.rightArmPivot.rotation.set(-.45 - throwLift * .25 + throwRelease * .55 + pitchArm * .5, -.35 + throwFollow * .63, .28 * throwLift);
      view.operative.rightElbowPivot.rotation.x = -.85 + throwRelease * .38;
      view.operative.leftArmPivot.rotation.set(-.58 - throwLift * .18 + pitchArm * .4, .42, -.05);
      view.operative.leftElbowPivot.rotation.x = -.95;
    } else {
      view.operative.spine.rotation.y += throwLift * .28 - throwFollow * .30;
      view.operative.spine.rotation.x += throwFollow * .20 - throwLift * .06;
      const overArm = throwPhase < .3 ? mix(-.95, -2.15, ease01(throwPhase / .3)) : mix(-2.15, -.28, ease01((throwPhase - .3) / .38));
      view.operative.rightArmPivot.rotation.set(overArm + pitchArm * .5, -.22 + throwFollow * .26, .12 * throwLift);
      view.operative.rightElbowPivot.rotation.x = mix(-1.24, -.45, throwFollow);
      view.operative.leftArmPivot.rotation.set(-.78 - throwLift * .25 + pitchArm * .4, .36, -.05);
      view.operative.leftElbowPivot.rotation.x = -.88;
    }
  } else if (player.equipped === 'knife') {
    const swing = Math.sin(Math.min(1, Math.max(0, (currentTime - player.lastSwing) / .35)) * Math.PI);
    view.operative.spine.rotation.x += .04 * walkAmount + swing * .08;
    view.operative.spine.rotation.y -= swing * .26;
    solveArmToTarget(shoulderX, shoulderY, rightGripTarget, view.operative.rightArmPivot, view.operative.rightElbowPivot);
    view.operative.leftArmPivot.rotation.set(-.54 + cycle * .06 + pitchArm * .35, .36, -.04);
    view.operative.leftElbowPivot.rotation.x = -1.08;
  } else if (isReloading) {
    view.operative.spine.rotation.x += reloadWeight * .10;
    view.operative.spine.rotation.y += pouchReach * .14 - rackPhase * .10;
    view.operative.spine.rotation.z -= reloadWeight * .08;
    view.operative.headPivot.rotation.x += reloadWeight * .20;
    solveArmToTarget(shoulderX, shoulderY, rightGripTarget, view.operative.rightArmPivot, view.operative.rightElbowPivot);
    const magSocket = profile.magWell ?? profile.leftHand;
    const magWorld = rotateGunAnchorToRoot(magSocket, gunRight, localGunY, gunFwd, gunRotX, gunYawOffset, gunRotZ);
    const pouchTarget: readonly [number, number, number] = [-.15, shoulderY - .40, .06];
    if (isTubeShotgun && reloadProgress < .78) {
      const feedBlend = shellCycle > 0 ? Math.sin(Math.min(1, shellFrac / .85) * Math.PI) : 0;
      const shellTarget: readonly [number, number, number] = [
        mix(pouchTarget[0], magWorld[0], feedBlend),
        mix(pouchTarget[1], magWorld[1] + (shellFrac >= .45 && shellFrac < .8 ? .04 : 0), feedBlend),
        mix(pouchTarget[2], magWorld[2], feedBlend),
      ];
      solveArmToTarget(-shoulderX, shoulderY, shellTarget, view.operative.leftArmPivot, view.operative.leftElbowPivot);
    } else if (!isTubeShotgun && reloadProgress < .20) {
      solveArmToTarget(-shoulderX, shoulderY, [magWorld[0], magWorld[1] - stripPhase * .10, magWorld[2]], view.operative.leftArmPivot, view.operative.leftElbowPivot);
    } else if (!isTubeShotgun && reloadProgress < .54) {
      const fetchTarget: readonly [number, number, number] = [
        mix(magWorld[0], pouchTarget[0], pouchReach),
        mix(magWorld[1] - .06, pouchTarget[1], pouchReach),
        mix(magWorld[2], pouchTarget[2], pouchReach),
      ];
      solveArmToTarget(-shoulderX, shoulderY, fetchTarget, view.operative.leftArmPivot, view.operative.leftElbowPivot);
    } else if (!isTubeShotgun && reloadProgress < .78) {
      const seatBlend = Math.min(1, (reloadProgress - .54) / .20);
      const seatTarget: readonly [number, number, number] = [
        mix(pouchTarget[0], magWorld[0], seatBlend),
        mix(pouchTarget[1], magWorld[1] + magSlap * .045, seatBlend),
        mix(pouchTarget[2], magWorld[2], seatBlend),
      ];
      solveArmToTarget(-shoulderX, shoulderY, seatTarget, view.operative.leftArmPivot, view.operative.leftElbowPivot);
    } else {
      view.operative.leftArmPivot.rotation.set(-1.02 + rackPhase * .22 + pitchArm * .65, .20, -.20 * rackPhase);
      view.operative.leftElbowPivot.rotation.x = -1.38 + rackPhase * .34;
    }
  } else if (boltCycling > 0) {
    const boltAnchor = profile.boltHandle ?? [profile.rightHand[0] + .03, profile.rightHand[1] + .09, profile.rightHand[2] + .06];
    const boltCycleTarget = rotateGunAnchorToRoot(
      [mix(profile.rightHand[0], boltAnchor[0], boltCycling), mix(profile.rightHand[1], boltAnchor[1], boltCycling), mix(profile.rightHand[2], boltAnchor[2] - .065 * boltCycling, boltCycling)],
      gunRight,
      localGunY,
      gunFwd,
      gunRotX,
      gunYawOffset,
      gunRotZ,
    );
    solveArmToTarget(shoulderX, shoulderY, boltCycleTarget, view.operative.rightArmPivot, view.operative.rightElbowPivot);
    solveArmToTarget(-shoulderX, shoulderY, leftGripTarget, view.operative.leftArmPivot, view.operative.leftElbowPivot);
  } else if (isBlinded) {
    solveArmToTarget(shoulderX, shoulderY, rightGripTarget, view.operative.rightArmPivot, view.operative.rightElbowPivot);
    view.operative.leftArmPivot.rotation.set(mix(-.58, -1.68, blindBlend) + pitchArm * .3, mix(.42, .58, blindBlend), .18 * blindBlend);
    view.operative.leftElbowPivot.rotation.x = mix(-1.05, -1.72, blindBlend);
  } else {
    solveArmToTarget(shoulderX, shoulderY, rightGripTarget, view.operative.rightArmPivot, view.operative.rightElbowPivot);
    if (isRadioCalling) {
      const pttTarget: readonly [number, number, number] = [-.09, shoulderY - .06, .13];
      solveArmToTarget(-shoulderX, shoulderY, pttTarget, view.operative.leftArmPivot, view.operative.leftElbowPivot);
    } else {
      solveArmToTarget(-shoulderX, shoulderY, leftGripTarget, view.operative.leftArmPivot, view.operative.leftElbowPivot);
    }
  }

  view.operative.leftLegPivot.rotation.z = .085 * lateralStep;
  view.operative.rightLegPivot.rotation.z = -.085 * lateralStep;
  if (airborne) {
    const jumpThrowSplit = isJumpThrow && (isThrowing || inUtilityPrep) ? .22 : 0;
    const riseTuck = airVel > .4 ? .16 : airVel < -.4 ? -.10 : 0;
    view.operative.leftLegPivot.rotation.x = -.36 - riseTuck - .42 * crouchPose - jumpThrowSplit;
    view.operative.rightLegPivot.rotation.x = -.24 - riseTuck * .7 - .42 * crouchPose + jumpThrowSplit * .8;
    view.operative.leftKneePivot.rotation.x = .55 + riseTuck * .7 + .55 * crouchPose;
    view.operative.rightKneePivot.rotation.x = .60 + riseTuck * .5 + .55 * crouchPose;
  } else {
    view.operative.leftLegPivot.rotation.x = legSwing * .48 - .58 * crouchPose - .32 * landSquash;
    view.operative.rightLegPivot.rotation.x = -legSwing * .48 - .58 * crouchPose - .32 * landSquash;
    view.operative.leftKneePivot.rotation.x = 1.08 * crouchPose + .64 * landSquash + Math.max(0, legSwing) * .46 + Math.max(0, -legSwing) * .18;
    view.operative.rightKneePivot.rotation.x = 1.08 * crouchPose + .64 * landSquash + Math.max(0, -legSwing) * .46 + Math.max(0, legSwing) * .18;
  }

  const magazineOut = isReloading && !isTubeShotgun && reloadProgress > .10 && reloadProgress < .78;
  view.operative.magazine.setEnabled(magazineOut);
  if (magazineOut) {
    // Magazine is parented to operative.root; anchor to the weapon's true magWell in root-local coordinates.
    const magBase = rotateGunAnchorToRoot(profile.magWell ?? profile.leftHand, gunRight, localGunY, gunFwd, gunRotX, gunYawOffset, gunRotZ);
    const magLocalX = mix(magBase[0], -.12, pouchReach * .75);
    const magLocalZ = mix(magBase[2], .08, pouchReach * .75);
    const magY = reloadProgress < .50
      ? magBase[1] - .06 - Math.sin(((reloadProgress - .10) / .40) * Math.PI) * .16
      : magBase[1] - .20 * (1 - insertPhase) + magSlap * .035;
    view.operative.magazine.position.set(magLocalX, magY, magLocalZ);
    view.operative.magazine.rotation.set(.28 + reloadWeight * .58 - insertPhase * .22, gunYawOffset, gunRotZ * .5 - pouchReach * .35);
  }
  if(memory.initialized){
    const weight=1-Math.exp(-sampleDt*22);
    for(let i=0;i<memory.nodes.length;i++){
      const r=memory.nodes[i].rotation;
      r.set(mix(memory.rotations[i*3],r.x,weight),mix(memory.rotations[i*3+1],r.y,weight),mix(memory.rotations[i*3+2],r.z,weight));
    }
  }
  memory.initialized=true;
}

interface SmokeView { root:TransformNode; lobes:Mesh[]; material:StandardMaterial|LiveSmokeRenderVolume['material'];volume?:LiveSmokeRenderVolume }
interface FireView { root:TransformNode; ground:Mesh; groundFlames:Mesh[]; groundFlameMaterials:StandardMaterial[]; flames:Mesh[]; groundMaterial:StandardMaterial; flameMaterials:StandardMaterial[] }
interface BloodView { splats:Mesh[] }
interface BlastView {sphere:Mesh;ring:Mesh;sphereMaterial:StandardMaterial;ringMaterial:StandardMaterial}
type ViewmodelReloadFamily = 'rifle_ak' | 'rifle_stanag' | 'sniper' | 'smg' | 'shotgun_tube' | 'shotgun_mag' | 'lmg' | 'pistol' | 'other';
interface ViewmodelReloadParts { arm:TransformNode; wrist:TransformNode; magazine:Mesh; leftArmMeshes:Mesh[]; family:ViewmodelReloadFamily; magHome:readonly [number,number,number] }
interface WeaponViewMetadata {weaponRoot?:TransformNode;muzzle?:TransformNode;reloadParts?:ViewmodelReloadParts;name?:string}
interface TracerView {world:LinesMesh;firstPerson?:LinesMesh;actorId:string}

/** Equipment detailing attaches to the articulated human pivots while keeping natural proportions. */
function finishOperativeKit(
  force: 'ct' | 't',
  id: string,
  scene: Scene,
  view: OperativeView,
  getMat: (hex: string) => StandardMaterial,
  style: OperativeStyleProfile,
): OperativeView {
  const groups=new Map<string,{parent:TransformNode;meshes:Mesh[]}>();
  const part=(name:string,parent:TransformNode,x:number,y:number,z:number,w:number,h:number,d:number,color:string,shape:'box'|'sphere'|'cylinder'='box',rotX=0,rotY=0,rotZ=0,topScale=1):Mesh=>{
    const fullName=`${id}-${force}-kit-${name}`;
    let mesh:Mesh;
    if(shape==='sphere'){
      mesh=MeshBuilder.CreateSphere(fullName,{diameter:1,segments:12},scene);
      mesh.scaling.set(w,h,d);
    }else if(shape==='cylinder'){
      mesh=MeshBuilder.CreateCylinder(fullName,{height:1,diameterTop:topScale,diameterBottom:1,tessellation:12},scene);
      mesh.scaling.set(w,h,d);
    }else{
      mesh=MeshBuilder.CreateBox(fullName,{width:1,height:1,depth:1},scene);
      mesh.scaling.set(w,h,d);
    }
    mesh.position.set(x,y,z);
    if(rotX||rotY||rotZ)mesh.rotation.set(rotX,rotY,rotZ);
    mesh.parent=parent;mesh.material=getMat(color);
    const key=`${parent.uniqueId}:${mesh.material.uniqueId}`,group=groups.get(key)??{parent,meshes:[]};
    group.meshes.push(mesh);groups.set(key,group);
    return mesh;
  };
  const {spine,headPivot,leftArmPivot,rightArmPivot,leftElbowPivot,rightElbowPivot,leftLegPivot,rightLegPivot,leftKneePivot,rightKneePivot}=view;
  const {fabric,trousers:pants,rig,pouch:pouchColor,hardware,trim:darkTrim,skin}=style;
  const isSuited=style.headgear==='syndicate-suit';
  const hasBackpack=style.headgear==='anarchist-hoodie';

  // Natural human neck, trapezius collar, and tapered pelvic/hip joint
  part('neck-column',spine,0,.355,.006,.11,.15,.11,skin,'cylinder',0,0,0,.88);
  part('trapezius',spine,0,.27,0,.38,.09,.195,fabric,'cylinder',0,0,0,.44);
  part('collar-seam',spine,0,.305,.006,.145,.045,.135,isSuited?style.secondaryAccent:rig,'cylinder',0,0,0,.92);
  part('pelvis',spine,0,-.265,0,.305,.155,.205,pants,'cylinder',0,0,0,.92);
  part('waist-belt',spine,0,-.21,0,.315,.038,.212,darkTrim,'cylinder',0,0,0,.98);
  part('belt-buckle',spine,0,-.21,.108,.048,.038,.014,hardware,'box');

  // Slim fitted hip holster (+ holstered sidearm), rear dump pouch & tourniquet, side utility pocket
  part('hip-holster',spine,.158,-.25,-.005,.036,.105,.08,darkTrim,'box',0,0,-.06);
  part('holster-pistol-grip',spine,.164,-.19,-.012,.028,.055,.038,darkTrim,'box',.35,0,-.1);
  part('holster-pistol-slide',spine,.164,-.21,.012,.026,.048,.075,hardware,'box',.18,0,-.06);
  part('side-medpouch',spine,-.158,-.245,-.01,.036,.085,.075,pouchColor,'box',0,0,.05);
  part('belt-dump-pouch',spine,-.075,-.245,-.118,.115,.11,.045,pouchColor,'box',.08,0,0);
  part('belt-tourniquet',spine,.085,-.22,.112,.042,.072,.032,darkTrim,'box');
  part('belt-tourniquet-tab',spine,.085,-.185,.124,.024,.026,.016,'#dc2626','box');

  if(!isSuited){
    // Fitted tactical chest carrier front/back, combat knife, utility canisters, PRC radio & hydration pack
    part('rig-chest-panel',spine,0,.105,.098,.26,.24,.032,rig,'box');
    part('rig-back-panel',spine,0,.105,-.098,.25,.24,.032,rig,'box');
    if(!hasBackpack){
      part('hydration-pack',spine,0,.095,-.13,.175,.23,.052,pouchColor,'cylinder',0,0,0,.86);
    }
    part('chest-knife-sheath',spine,-.098,.135,.118,.026,.115,.022,darkTrim,'box',0,0,.22);
    part('chest-knife-pommel',spine,-.112,.192,.12,.03,.04,.024,hardware,'box',0,0,.22);
    part('chest-smoke-canister',spine,.102,.015,.122,.044,.095,.044,'#64748b','cylinder');
    part('chest-flash-canister',spine,-.105,.015,.12,.038,.082,.038,'#475569','cylinder');
    for(const side of [-1,1]){
      part(`rig-shoulder-pad-${side}`,spine,side*.12,.225,0,.065,.045,.175,rig,'box',.05,0,-side*.14);
      part(`rig-strap-buckle-${side}`,spine,side*.11,.20,.105,.042,.024,.016,hardware,'box');
      part(`thigh-cargo-pouch-${side}`,side<0?leftLegPivot:rightLegPivot,side*.088,-.20,.005,.036,.13,.105,pouchColor,'box',0,0,-side*.04);
      part(`thigh-cargo-flap-${side}`,side<0?leftLegPivot:rightLegPivot,side*.092,-.145,.005,.034,.028,.102,rig,'box',0,0,-side*.04);
      part(`knee-pad-shell-${side}`,side<0?leftKneePivot:rightKneePivot,0,.005,.068,.112,.115,.034,darkTrim,'sphere');
      part(`knee-pad-strap-${side}`,side<0?leftKneePivot:rightKneePivot,0,.005,0,.122,.024,.128,rig,'cylinder');
    }
    for(let i=0;i<3;i++){
      const x=(i-1)*.074;
      part(`mag-pouch-${i}`,spine,x,-.01,.118,.062,.105,.034,pouchColor,'box');
      part(`mag-pull-${i}`,spine,x,.042,.126,.048,.018,.014,darkTrim,'box');
    }
  }
  part('prc-radio-body',spine,-.125,.09,-.115,.052,.115,.04,darkTrim,'box');
  part('prc-whip-antenna',spine,-.135,.235,-.12,.01,.18,.01,hardware,'cylinder');

  buildVariantOperativeDetails(
    style,
    {
      spine,
      headPivot,
      leftArmPivot,
      rightArmPivot,
      leftElbowPivot,
      rightElbowPivot,
      leftLegPivot,
      rightLegPivot,
      leftKneePivot,
      rightKneePivot,
    },
    part,
  );

  // Batch rigid fittings on each animated pivot; keep articulated limbs and the reload prop separate.
  for(const mesh of view.root.getChildMeshes()){
    if(!(mesh instanceof Mesh)||mesh===view.magazine||mesh.name.includes(`-${force}-kit-`)
      ||/(-torso|-head|-arm-[lr]|-leg-[lr]|-shin-[lr]|-boot-[lr]|-forearm-[lr])$/.test(mesh.name))continue;
    const parent=mesh.parent as TransformNode,mat=mesh.material;
    if(!parent||!mat)continue;
    const key=`${parent.uniqueId}:${mat.uniqueId}`,group=groups.get(key)??{parent,meshes:[]};
    group.meshes.push(mesh);groups.set(key,group);
  }
  for(const {parent,meshes} of groups.values()) {
    for(const mesh of meshes)mesh.parent=null;
    const merged=Mesh.MergeMeshes(meshes,true,true);
    if(merged){merged.parent=parent;merged.isPickable=false;merged.receiveShadows=true;}
  }
  return view;
}

export function createTacticalOperativeMesh(
  force: 'ct' | 't',
  id: string,
  scene: Scene,
  getMat: (hex: string) => StandardMaterial,
  variantHint?: number,
): OperativeView {
  const variantIndex = resolveOperativeVariantIndex(force, id, variantHint);
  const style = resolveOperativeStyle(force, id, variantIndex);
  const root = new TransformNode(`operative-${id}`, scene);
  const spine = new TransformNode(`${id}-spine-pivot`, scene); spine.parent=root; spine.position.set(0,1.05,0);
  const headPivot = new TransformNode(`${id}-head-pivot`, scene); headPivot.parent=root; headPivot.position.set(0,1.54,0);
  const leftArmPivot = new TransformNode(`${id}-arm-l-pivot`, scene); leftArmPivot.parent=root; leftArmPivot.position.set(-.192,1.29,0);
  const rightArmPivot = new TransformNode(`${id}-arm-r-pivot`, scene); rightArmPivot.parent=root; rightArmPivot.position.set(.192,1.29,0);
  const leftLegPivot = new TransformNode(`${id}-leg-l-pivot`, scene); leftLegPivot.parent=root; leftLegPivot.position.set(-.105,.74,0);
  const rightLegPivot = new TransformNode(`${id}-leg-r-pivot`, scene); rightLegPivot.parent=root; rightLegPivot.position.set(.105,.74,0);
  const leftKneePivot = new TransformNode(`${id}-knee-l-pivot`, scene); leftKneePivot.parent=leftLegPivot; leftKneePivot.position.set(0,-.36,0);
  const rightKneePivot = new TransformNode(`${id}-knee-r-pivot`, scene); rightKneePivot.parent=rightLegPivot; rightKneePivot.position.set(0,-.36,0);

  const leftElbowPivot=new TransformNode(`${id}-elbow-l-pivot`,scene);leftElbowPivot.parent=leftArmPivot;leftElbowPivot.position.y=-.25;
  const rightElbowPivot=new TransformNode(`${id}-elbow-r-pivot`,scene);rightElbowPivot.parent=rightArmPivot;rightElbowPivot.position.y=-.25;

  // Tapered anatomical human limb segment
  const taperedLimb=(name:string,topW:number,botW:number,h:number,dRatio=.96)=>{
    const mesh=MeshBuilder.CreateCylinder(name,{height:h,diameterTop:topW,diameterBottom:botW,tessellation:12},scene);
    mesh.scaling.z=dRatio;return mesh;
  };
  const add = (m: Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const name=m.name;
    const parent=name.includes('glove-l')||name.includes('bare-l')?leftElbowPivot:name.includes('glove-r')||name.includes('bare-r')?rightElbowPivot:name.includes('head')||name.includes('helmet')||name.includes('goggles')||name.includes('faceslit')||name.includes('shades')||name.includes('beanie')?headPivot
      :name.includes('arm-l')?leftArmPivot
      :name.includes('arm-r')?rightArmPivot
      :name.includes('leg-l')||name.includes('pocket-l')?leftLegPivot
      :name.includes('leg-r')||name.includes('pocket-r')?rightLegPivot
      :spine;
    m.parent = parent;
    const nested=parent===leftElbowPivot||parent===rightElbowPivot;
    const offset=nested?new Vector3((parent.parent as TransformNode).position.x,(parent.parent as TransformNode).position.y+parent.position.y,0):parent.position;
    m.position.set(x-offset.x,y-offset.y,z-offset.z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    m.isPickable = false;
    m.receiveShadows = true;
    return m;
  };
  const addKneePart = (m:Mesh,pivot:TransformNode,x:number,y:number,z:number) => {
    m.parent=pivot;m.position.set(x,y,z);m.isPickable=false;m.receiveShadows=true;return m;
  };

  const uniform = getMat(style.fabric);
  const trouserMat = getMat(style.trousers);
  const bootMat = getMat(style.boot);
  const gloveMat = getMat(style.glove);
  const skinMat = getMat(style.skin);
  const forearmMat = style.sleeveRolled ? skinMat : uniform;
  const fullBalaclava = style.headgear === 'fast-nvg' || style.headgear === 'gign-shield' || style.headgear === 'swat-cap';

  // V-taper human ribcage & waist
  const torso = MeshBuilder.CreateCylinder(`${id}-torso`, { height: .49, diameterTop: .35, diameterBottom: .275, tessellation: 14 }, scene);
  torso.scaling.z = .59;
  torso.material = uniform;
  add(torso, 0, 1.07, 0);

  // Proportional human cranium & face
  const head = MeshBuilder.CreateSphere(`${id}-head`, { diameter: .215, segments: 14 }, scene);
  head.scaling.set(.86 * (style.face?.headScaleX ?? 1), 1.04 * (style.face?.headScaleY ?? 1), .92);
  head.material = fullBalaclava ? getMat(style.eyePatchColor) : skinMat;
  add(head, 0, 1.545, 0);

  // Muscular tapered thighs & calves
  const leftLeg = taperedLimb(`${id}-leg-l`, .155, .118, .38, 1.06);
  leftLeg.material = trouserMat;
  add(leftLeg, -.105, .55, 0);

  const rightLeg = taperedLimb(`${id}-leg-r`, .155, .118, .38, 1.06);
  rightLeg.material = trouserMat;
  add(rightLeg, .105, .55, 0);

  const leftShin = taperedLimb(`${id}-shin-l`, .118, .086, .35, 1.04);
  leftShin.material = trouserMat;
  addKneePart(leftShin, leftKneePivot, 0, -.175, 0);

  const rightShin = taperedLimb(`${id}-shin-r`, .118, .086, .35, 1.04);
  rightShin.material = trouserMat;
  addKneePart(rightShin, rightKneePivot, 0, -.175, 0);

  // Contoured combat boots
  const bootL = MeshBuilder.CreateBox(`${id}-boot-l`, { width: .096, height: .076, depth: .195 }, scene);
  bootL.material = bootMat;
  addKneePart(bootL, leftKneePivot, 0, -.355, .034);

  const bootR = MeshBuilder.CreateBox(`${id}-boot-r`, { width: .096, height: .076, depth: .195 }, scene);
  bootR.material = bootMat;
  addKneePart(bootR, rightKneePivot, 0, -.355, .034);

  // Tapered upper arms & forearms
  const leftArm = taperedLimb(`${id}-arm-l`, .106, .088, .27, 1.02);
  leftArm.material = uniform;
  add(leftArm, -.192, 1.165, 0);

  const rightArm = taperedLimb(`${id}-arm-r`, .106, .088, .27, 1.02);
  rightArm.material = uniform;
  add(rightArm, .192, 1.165, 0);

  for (const [side, pivot] of [[-1, leftElbowPivot], [1, rightElbowPivot]] as const) {
    const forearm = taperedLimb(`${id}-forearm-${side < 0 ? 'l' : 'r'}`, .086, .066, .25, 1);
    forearm.parent = pivot;
    forearm.position.y = -.12;
    forearm.material = forearmMat;
    forearm.isPickable = false;
    forearm.receiveShadows = true;
  }

  // Tactically articulated hands/gloves at wrist (palm center aligns with IK lowerLen = 0.24)
  const gloveL = MeshBuilder.CreateBox(`${id}-glove-l`, { width: .064, height: .082, depth: .076 }, scene);
  gloveL.material = gloveMat;
  add(gloveL, -.192, .80, 0);

  const gloveR = MeshBuilder.CreateBox(`${id}-glove-r`, { width: .064, height: .082, depth: .076 }, scene);
  gloveR.material = gloveMat;
  add(gloveR, .192, .80, 0);

  const magazine = MeshBuilder.CreateBox(`${id}-reload-magazine`, { width: .062, height: .165, depth: .048 }, scene);
  magazine.material = bootMat;
  magazine.parent = root;
  magazine.isPickable = false;
  magazine.setEnabled(false);

  return finishOperativeKit(
    force,
    id,
    scene,
    {
      root,
      spine,
      headPivot,
      leftArmPivot,
      rightArmPivot,
      leftElbowPivot,
      rightElbowPivot,
      leftLegPivot,
      rightLegPivot,
      leftKneePivot,
      rightKneePivot,
      torso,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      head,
      magazine,
      crouchPose: 0,
      stridePhase: id.length * .7,
      lastX: 0,
      lastZ: 0,
      hasMotion: false,
      variantIndex,
      variantStyle: style,
      landSquash: 0,
      wasAirborne: false,
      prevJumpY: 0,
      flinch: 0,
    },
    getMat,
    style,
  );
}

export function create3DWeaponMesh(weapon: LiveEquippedWeapon, id: string, scene: Scene, getMat: (hex: string) => StandardMaterial, attacking=false): TransformNode {
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
  } else if (weapon === 'flash' || weapon === 'smoke' || weapon === 'incendiary' || weapon==='he') {
    const cylinder=(name:string,height:number,diameter:number,y:number,color:string)=>{
      const part=MeshBuilder.CreateCylinder(`${id}-${name}`,{height,diameter,tessellation:16},scene);part.material=getMat(color);add(part,0,y,0);return part;
    };
    if(weapon==='incendiary'&&attacking){
      const bottle=cylinder('molotov-glass-body',.16,.063,-.01,'#635e31');
      bottle.scaling.x=.92;
      cylinder('molotov-shoulder',.035,.047,.087,'#777044');
      cylinder('molotov-neck',.067,.024,.132,'#576344');
      cylinder('molotov-cloth',.035,.03,.174,'#cfb78c');
      const rag=MeshBuilder.CreateBox(`${id}-molotov-rag`,{width:.018,height:.09,depth:.009},scene);rag.material=getMat('#d7c9a3');add(rag,.023,.19,0,0,0,-.55);
      const label=MeshBuilder.CreateBox(`${id}-molotov-label`,{width:.049,height:.052,depth:.006},scene);label.material=getMat('#bda675');add(label,0,-.015,-.032);
    }else if(weapon==='he'){
      const shell=MeshBuilder.CreateSphere(`${id}-he-segmented-shell`,{diameter:.086,segments:12},scene);shell.material=olive;shell.scaling.y=1.23;add(shell,0,-.005,0);
      for(let rib=0;rib<4;rib++){
        const ring=MeshBuilder.CreateTorus(`${id}-he-rib-${rib}`,{diameter:.081-Math.abs(rib-1.5)*.008,thickness:.005,tessellation:16},scene);ring.material=gunmetal;add(ring,0,-.037+rib*.024,0);
      }
      cylinder('he-yellow-collar',.018,.048,.052,'#d5b748');
    }else if(weapon==='flash'){
      cylinder('flash-perforated-silver-body',.16,.047,0,'#a6aca8');
      for(let band=0;band<5;band++)cylinder(`flash-dark-rib-${band}`,.012,.051,-.06+band*.03,'#30383a');
      cylinder('flash-blue-neck',.025,.034,.09,'#779ba6');
    }else{
      cylinder(weapon==='smoke'?'smoke-wide-canister':'incendiary-red-canister',.15,.078,0,weapon==='smoke'?'#607d67':'#a6462f');
      for(const y of [-.073,.073])cylinder(`canister-end-${y}`,.014,.082,y,'#a3aaa0');
      cylinder('canister-identification-band',.025,.08,.03,weapon==='smoke'?'#dedbc0':'#e2b34e');
      const mark=MeshBuilder.CreateBox(`${id}-canister-symbol`,{width:.022,height:weapon==='smoke'?.04:.055,depth:.006},scene);mark.material=darkMetal;add(mark,0,-.015,-.04,0,0,weapon==='smoke'?0:.45);
    }
    if(!(weapon==='incendiary'&&attacking)){
      cylinder('grenade-fuse',.025,.032,weapon==='flash'?.11:.09,'#40494a');
      const lever=MeshBuilder.CreateBox(`${id}-grenade-spoon`,{width:.015,height:.105,depth:.026},scene);lever.material=silver;add(lever,.032,.038,0,0,0,-.17);
      const ring=MeshBuilder.CreateTorus(`${id}-grenade-pull-ring`,{diameter:.032,thickness:.004,tessellation:12},scene);ring.material=silver;add(ring,-.025,.1,0,Math.PI/2);
    }
    root.metadata={utilityKind:weapon,force:attacking?'t':'ct'};
  } else if(weapon==='bomb'){
    const block=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=MeshBuilder.CreateBox(`${id}-c4-${name}`,{width:w,height:h,depth:d},scene);m.material=getMat(color);add(m,x,y,z);return m;};
    block('backplate',0,0,0,.3,.24,.065,'#283434');
    for(const x of [-.105,0,.105])block(`charge-${x}`,x,0,.045,.092,.21,.065,'#9b9168');
    for(const y of [-.075,.075])block(`strap-${y}`,0,y,.083,.32,.023,.018,'#252b2b');
    block('controller',.025,.015,.093,.15,.16,.035,'#263b3c');
    block('display',.025,.064,.114,.116,.034,.004,'#77d99d');
    for(let row=0;row<3;row++)for(let col=0;col<3;col++)block(`key-${row}-${col}`,-.02+col*.04,.015-row*.033,.115,.025,.02,.009,'#bbc0ad');
    for(const [i,color] of ['#b54d42','#d5b345','#3f7991'].entries()){
      const wire=MeshBuilder.CreateTube(`${id}-c4-wire-${i}`,{path:[new Vector3(-.12+i*.03,.1,.055),new Vector3(-.13+i*.025,.16,.06),new Vector3(.05,.14,.095),new Vector3(.055,.09,.11)],radius:.003,tessellation:5},scene);wire.material=getMat(color);wire.parent=root;wire.isPickable=false;
    }
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
  } else if (weapon === 'm4a1_s'||weapon==='budget_ct') {
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
  } else if (weapon === 'ak47' || weapon === 'rifle'||weapon==='budget_t') {
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
    for(const [segment,y,z,height,angle] of [[0,-.045,.085,.105,-.12],[1,-.13,.115,.09,-.38],[2,-.195,.16,.07,-.63]]){
      const mag=MeshBuilder.CreateBox(`${id}-mag-${segment}`,{width:.038,height,depth:.072},scene);
      mag.material=gunmetal;add(mag,0,y,z,angle,0,0);
    }
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
  } else if (weapon === 'p250') {
    const slide = MeshBuilder.CreateBox(`${id}-slide`, { width: 0.044, height: 0.052, depth: 0.21 }, scene);
    slide.material = darkMetal; add(slide, 0, 0.028, 0.03);
    const frame = MeshBuilder.CreateBox(`${id}-frame`, { width: 0.042, height: 0.026, depth: 0.19 }, scene);
    frame.material = olive; add(frame, 0, -0.005, 0.025);
    const grip = MeshBuilder.CreateBox(`${id}-grip`, { width: 0.040, height: 0.115, depth: 0.052 }, scene);
    grip.material = gunmetal; add(grip, 0, -0.05, -0.025, 0.21, 0, 0);
    const barrel = MeshBuilder.CreateCylinder(`${id}-barrel`, { height: 0.05, diameter: 0.022 }, scene);
    barrel.material = silver; add(barrel, 0, 0.036, 0.155, Math.PI / 2, 0, 0);
  } else if (weapon === 'fiveseven') {
    const slide = MeshBuilder.CreateBox(`${id}-slide`, { width: 0.046, height: 0.054, depth: 0.25 }, scene);
    slide.material = gunmetal; add(slide, 0, 0.030, 0.055);
    const frame = MeshBuilder.CreateBox(`${id}-frame`, { width: 0.044, height: 0.032, depth: 0.24 }, scene);
    frame.material = darkMetal; add(frame, 0, -0.006, 0.045);
    const grip = MeshBuilder.CreateBox(`${id}-grip`, { width: 0.042, height: 0.122, depth: 0.058 }, scene);
    grip.material = darkMetal; add(grip, 0, -0.055, -0.03, 0.20, 0, 0);
    const barrel = MeshBuilder.CreateCylinder(`${id}-barrel`, { height: 0.06, diameter: 0.022 }, scene);
    barrel.material = silver; add(barrel, 0, 0.038, 0.19, Math.PI / 2, 0, 0);
  } else if (weapon === 'tec9') {
    const rec = MeshBuilder.CreateBox(`${id}-rec`, { width: 0.048, height: 0.062, depth: 0.21 }, scene);
    rec.material = darkMetal; add(rec, 0, 0.026, 0.01);
    const shroud = MeshBuilder.CreateCylinder(`${id}-shroud`, { height: 0.14, diameter: 0.038 }, scene);
    shroud.material = gunmetal; add(shroud, 0, 0.036, 0.185, Math.PI / 2, 0, 0);
    const grip = MeshBuilder.CreateBox(`${id}-grip`, { width: 0.040, height: 0.12, depth: 0.054 }, scene);
    grip.material = darkMetal; add(grip, 0, -0.055, -0.045, 0.22, 0, 0);
    const frontMag = MeshBuilder.CreateBox(`${id}-front-mag`, { width: 0.034, height: 0.145, depth: 0.044 }, scene);
    frontMag.material = gunmetal; add(frontMag, 0, -0.068, 0.085, -0.08, 0, 0);
  } else if (weapon === 'cz75') {
    const slide = MeshBuilder.CreateBox(`${id}-slide`, { width: 0.044, height: 0.050, depth: 0.23 }, scene);
    slide.material = gunmetal; add(slide, 0, 0.029, 0.045);
    const frame = MeshBuilder.CreateBox(`${id}-frame`, { width: 0.042, height: 0.028, depth: 0.21 }, scene);
    frame.material = silver; add(frame, 0, -0.005, 0.035);
    const grip = MeshBuilder.CreateBox(`${id}-grip`, { width: 0.040, height: 0.118, depth: 0.054 }, scene);
    grip.material = darkMetal; add(grip, 0, -0.052, -0.03, 0.22, 0, 0);
    const spareMag = MeshBuilder.CreateBox(`${id}-spare-mag`, { width: 0.030, height: 0.11, depth: 0.040 }, scene);
    spareMag.material = darkMetal; add(spareMag, 0, -0.048, 0.11, 0.16, 0, 0);
    const barrel = MeshBuilder.CreateCylinder(`${id}-barrel`, { height: 0.07, diameter: 0.024 }, scene);
    barrel.material = silver; add(barrel, 0, 0.038, 0.175, Math.PI / 2, 0, 0);
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

  if(weapon==='budget_ct'||weapon==='budget_t'){for(const mesh of root.getChildMeshes()){if(mesh.name.endsWith('-silencer'))mesh.scaling.y=.35;if(mesh.name.endsWith('-stock'))mesh.scaling.x=1.25;if(mesh.name.includes('-handguard'))mesh.material=getMat(weapon==='budget_ct'?'#777e72':'#596850');}}
  if(Object.hasOwn(LIVE_WEAPONS,weapon)) {
    const family=LIVE_WEAPONS[weapon as keyof typeof LIVE_WEAPONS].category;
    const details:Mesh[]=[];
    const detail=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,hex='#52616a')=>{
      const mesh=MeshBuilder.CreateBox(`${id}-detail-${name}`,{width:w,height:h,depth:d},scene);
      const finish=getMat(hex);finish.specularColor=new Color3(.3,.32,.33);finish.specularPower=48;mesh.material=finish;
      add(mesh,x,y,z);details.push(mesh);return mesh;
    };
    const pistol=family==='pistol';
    detail('ejection-port',.028,.042,pistol?.015:.035,.004,.025,pistol?.055:.08,'#151c20');
    detail('bolt',.032,.039,pistol?.005:.07,.008,.012,.025,'#819098');
    if(!root.getChildMeshes().some(mesh=>mesh.name.endsWith('-grip'))){
      detail('pistol-grip',0,-.07,-.055,.038,.115,.055,'#283236').rotation.x=.24;
    }
    const trigger=MeshBuilder.CreateTorus(`${id}-detail-trigger-guard`,{diameter:.064,thickness:.008,tessellation:14},scene);
    trigger.material=gunmetal;add(trigger,0,-.035,pistol?.025:-.025,0,0,Math.PI/2);details.push(trigger);
    if(pistol){
      for(const side of [-1,1])for(let i=0;i<6;i++)detail(`slide-serration-${side}-${i}`,side*.024,.04,-.055+i*.012,.003,.035,.004,'#78858a');
      detail('rear-sight',0,.065,-.07,.04,.015,.015,'#101719');
      detail('front-sight',0,.065,.105,.012,.013,.012,'#101719');
    }else{
      for(let i=0;i<7;i++)detail(`top-rail-${i}`,0,.079,-.08+i*.025,.048,.012,.012,'#667279');
      for(const side of [-1,1])for(let i=0;i<5;i++)detail(`handguard-vent-${side}-${i}`,side*.031,.038,.16+i*.027,.003,.025,.015,'#151c20');
      if(family==='rifle'){for(const side of [-1,1])detail(`rear-iron-${side}`,side*.018,.104,-.1,.012,.024,.015,'#151b1f');detail('front-iron',0,.1,.3,.009,.028,.012,'#151b1f');}
      detail('selector',-.03,.012,-.07,.006,.018,.027,'#94a0a2');
      detail('receiver-pin-a',.032,.008,-.08,.005,.01,.01,'#a5ada9');
      detail('receiver-pin-b',.032,.008,.06,.005,.01,.01,'#a5ada9');
    }
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
      const bounds=barrel.getBoundingInfo().boundingBox;
      const bore=MeshBuilder.CreateDisc(`${id}-detail-bore`,{radius:Math.min(bounds.maximumWorld.x-bounds.minimumWorld.x,bounds.maximumWorld.y-bounds.minimumWorld.y)*.31,tessellation:16},scene);
      bore.material=getMat('#0c1114');add(bore,muzzle.position.x,muzzle.position.y,muzzle.position.z+.0005);details.push(bore);
    }
    const groups=new Map<StandardMaterial,Mesh[]>();
    for(const mesh of details){mesh.parent=null;const mat=mesh.material as StandardMaterial;groups.set(mat,[...(groups.get(mat)??[]),mesh]);}
    for(const group of groups.values()){const merged=Mesh.MergeMeshes(group,true,true);if(merged){merged.parent=root;merged.isPickable=false;merged.receiveShadows=true;}}
  }
  return root;
}

export function createViewmodelMesh(
  weapon: LiveEquippedWeapon,
  team: FpsTeamId,
  id: string,
  scene: Scene,
  getMat: (hex: string) => StandardMaterial,
  attacking?: boolean,
  variantStyle?: OperativeStyleProfile,
): TransformNode {
  const root = new TransformNode(`viewmodel-${id}`, scene);

  // 1. Weapon model
  const gun = create3DWeaponMesh(weapon, `${id}-gun`, scene, getMat,attacking??team==='red');
  gun.parent = root;
  gun.position.set(0, 0, 0);

  // 2. Operative hands & arms materials matching active CT/T specialist variant
  const isCT = attacking===undefined?team==='blue':!attacking;
  const style = variantStyle ?? resolveOperativeStyle(isCT ? 'ct' : 't', id);
  const sleeveMat = getMat(style.sleeveRolled ? style.skin : style.fabric);
  const cuffMat = getMat(style.fabric);
  const gloveMat = getMat(style.glove);
  const knuckleMat = getMat(style.knuckle);
  const fingerMat = getMat(style.fingerless ? style.skin : style.glove);
  const strapMat = getMat(style.trim);

  const addPart = (m: Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    m.parent = root;
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    m.isPickable = false;
    return m;
  };

  // 3. Right Arm & Hand (holding pistol grip / trigger)
  const isPistolWeapon = weapon === 'pistol' || weapon === 'usp_s' || weapon === 'glock' || weapon === 'deagle' || weapon === 'p250' || weapon === 'fiveseven' || weapon === 'tec9' || weapon === 'cz75';
  const isSmgWeapon = weapon === 'smg' || weapon === 'mp9' || weapon === 'mac10';
  const isRifleWeapon = weapon === 'rifle' || weapon === 'm4a1_s' || weapon === 'ak47'||weapon==='budget_ct'||weapon==='budget_t' || weapon === 'mag7' || weapon === 'nova' || weapon === 'negev';
  const isSniperWeapon = weapon === 'sniper' || weapon === 'scout';
  const isGrenade = weapon === 'flash' || weapon === 'smoke' || weapon === 'incendiary' || weapon==='he';

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
  knuckleR.material = knuckleMat;
  addPart(knuckleR, gripPos.x + 0.028, gripPos.y + 0.018, gripPos.z - 0.01, 0.25, -0.1, 0.05);

  // Fingers wrapped around grip
  const fingersR = MeshBuilder.CreateBox(`${id}-r-fingers`, { width: 0.052, height: 0.066, depth: 0.048 }, scene);
  fingersR.material = fingerMat;
  addPart(fingersR, gripPos.x - 0.008, gripPos.y - 0.012, gripPos.z + 0.026, 0.2, -0.05, 0);

  // Thumb
  const thumbR = MeshBuilder.CreateBox(`${id}-r-thumb`, { width: 0.028, height: 0.032, depth: 0.048 }, scene);
  thumbR.material = fingerMat;
  addPart(thumbR, gripPos.x + 0.026, gripPos.y + 0.02, gripPos.z - 0.016, -0.2, 0.28, 0);

  // Forearm extending back into bottom-right viewport
  const forearmR = MeshBuilder.CreateBox(`${id}-r-forearm`, { width: 0.085, height: 0.095, depth: 0.28 }, scene);
  forearmR.material = sleeveMat;
  addPart(forearmR, gripPos.x + 0.075, gripPos.y - 0.12, gripPos.z - 0.17, 0.44, -0.24, -0.15);

  if (style.sleeveRolled) {
    const rolledR = MeshBuilder.CreateBox(`${id}-r-sleeve`, { width: 0.098, height: 0.108, depth: 0.13 }, scene);
    rolledR.material = cuffMat;
    addPart(rolledR, gripPos.x + 0.105, gripPos.y - 0.20, gripPos.z - 0.27, 0.44, -0.24, -0.15);
  } else {
    const strapR = MeshBuilder.CreateBox(`${id}-r-strap`, { width: 0.09, height: 0.10, depth: 0.045 }, scene);
    strapR.material = strapMat;
    addPart(strapR, gripPos.x + 0.045, gripPos.y - 0.065, gripPos.z - 0.09, 0.44, -0.24, -0.15);
  }

  // 4. Left Arm & Hand (supporting the weapon; tracked so reload motion swaps in without ghosting a duplicate hand)
  const leftArmMeshes: Mesh[] = [];
  const addLeftPart = (m: Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    addPart(m, x, y, z, rx, ry, rz);
    leftArmMeshes.push(m);
    return m;
  };
  const addLeftCuff = (w: number, h: number, d: number, x: number, y: number, z: number, rx: number, ry: number, rz: number) => {
    if (!style.sleeveRolled) return;
    const rolledL = MeshBuilder.CreateBox(`${id}-l-sleeve`, { width: w, height: h, depth: d }, scene);
    rolledL.material = cuffMat;
    addLeftPart(rolledL, x, y, z, rx, ry, rz);
  };
  if (isRifleWeapon) {
    // Support hand cradles underneath the forward barrel handguard while fingers and thumb wrap the left wood guard (CS2 right-side rifle hold)
    const palmL = MeshBuilder.CreateBox(`${id}-l-palm`, { width: 0.068, height: 0.044, depth: 0.084 }, scene);
    palmL.material = gloveMat;
    addLeftPart(palmL, -0.008, -0.022, 0.23, 0.08, 0.32, 0.18);

    const fingersL = MeshBuilder.CreateBox(`${id}-l-fingers`, { width: 0.042, height: 0.056, depth: 0.068 }, scene);
    fingersL.material = fingerMat;
    addLeftPart(fingersL, -0.032, 0.010, 0.238, 0.08, 0.26, -0.08);

    const thumbL = MeshBuilder.CreateBox(`${id}-l-thumb`, { width: 0.026, height: 0.048, depth: 0.036 }, scene);
    thumbL.material = fingerMat;
    addLeftPart(thumbL, -0.033, 0.036, 0.212, -0.24, 0.22, -0.18);

    const forearmL = MeshBuilder.CreateBox(`${id}-l-forearm`, { width: 0.085, height: 0.095, depth: 0.32 }, scene);
    forearmL.material = sleeveMat;
    addLeftPart(forearmL, -0.125, -0.145, 0.065, -0.44, 0.52, -0.32);

    addLeftCuff(0.098, 0.108, 0.14, -0.195, -0.235, -0.035, -0.44, 0.52, -0.32);
  } else if (isSmgWeapon) {
    const palmL = MeshBuilder.CreateBox(`${id}-l-palm`, { width: 0.06, height: 0.05, depth: 0.076 }, scene);
    palmL.material = gloveMat;
    addLeftPart(palmL, -0.018, -0.01, 0.17, 0.1, 0.3, 0.25);

    const fingersL = MeshBuilder.CreateBox(`${id}-l-fingers`, { width: 0.04, height: 0.055, depth: 0.062 }, scene);
    fingersL.material = fingerMat;
    addLeftPart(fingersL, -0.034, 0.015, 0.18, 0.1, 0.3, 0.1);

    const forearmL = MeshBuilder.CreateBox(`${id}-l-forearm`, { width: 0.082, height: 0.092, depth: 0.30 }, scene);
    forearmL.material = sleeveMat;
    addLeftPart(forearmL, -0.13, -0.14, 0.02, -0.4, 0.5, -0.3);

    addLeftCuff(0.095, 0.105, 0.13, -0.19, -0.22, -0.07, -0.4, 0.5, -0.3);
  } else if (isSniperWeapon) {
    const palmL = MeshBuilder.CreateBox(`${id}-l-palm`, { width: 0.068, height: 0.052, depth: 0.092 }, scene);
    palmL.material = gloveMat;
    addLeftPart(palmL, -0.02, 0.005, 0.23, 0.1, 0.35, 0.3);

    const fingersL = MeshBuilder.CreateBox(`${id}-l-fingers`, { width: 0.044, height: 0.06, depth: 0.072 }, scene);
    fingersL.material = fingerMat;
    addLeftPart(fingersL, -0.038, 0.032, 0.24, 0.1, 0.3, 0.1);

    const forearmL = MeshBuilder.CreateBox(`${id}-l-forearm`, { width: 0.086, height: 0.096, depth: 0.34 }, scene);
    forearmL.material = sleeveMat;
    addLeftPart(forearmL, -0.15, -0.15, 0.05, -0.45, 0.55, -0.35);

    addLeftCuff(0.098, 0.108, 0.14, -0.22, -0.24, -0.06, -0.45, 0.55, -0.35);
  } else if (isPistolWeapon) {
    const palmL = MeshBuilder.CreateBox(`${id}-l-palm`, { width: 0.066, height: 0.076, depth: 0.082 }, scene);
    palmL.material = gloveMat;
    addLeftPart(palmL, -0.024, -0.065, -0.02, 0.15, 0.2, 0.1);

    const fingersL = MeshBuilder.CreateBox(`${id}-l-fingers`, { width: 0.046, height: 0.066, depth: 0.062 }, scene);
    fingersL.material = fingerMat;
    addLeftPart(fingersL, 0.012, -0.07, 0.016, 0.1, 0.05, 0);

    const forearmL = MeshBuilder.CreateBox(`${id}-l-forearm`, { width: 0.082, height: 0.088, depth: 0.27 }, scene);
    forearmL.material = sleeveMat;
    addLeftPart(forearmL, -0.11, -0.17, -0.14, 0.4, 0.3, -0.15);

    addLeftCuff(0.095, 0.102, 0.13, -0.16, -0.25, -0.24, 0.4, 0.3, -0.15);
  } else if (isGrenade) {
    const palmL = MeshBuilder.CreateBox(`${id}-l-palm`, { width: 0.056, height: 0.065, depth: 0.072 }, scene);
    palmL.material = gloveMat;
    addLeftPart(palmL, -0.05, 0.04, 0.02, 0.2, 0.4, 0.2);
    const fingersL = MeshBuilder.CreateBox(`${id}-l-fingers`, { width: 0.038, height: 0.045, depth: 0.052 }, scene);
    fingersL.material = fingerMat;
    addLeftPart(fingersL, -0.025, 0.065, 0.01, 0.2, 0.4, 0.2);
    const forearmL = MeshBuilder.CreateBox(`${id}-l-forearm`, { width: 0.082, height: 0.092, depth: 0.27 }, scene);
    forearmL.material = sleeveMat;
    addLeftPart(forearmL, -0.16, -0.08, -0.08, -0.3, 0.4, -0.2);
  } else {
    // Knife off-hand guard
    const palmL = MeshBuilder.CreateBox(`${id}-l-palm`, { width: 0.062, height: 0.072, depth: 0.082 }, scene);
    palmL.material = gloveMat;
    addLeftPart(palmL, -0.18, -0.14, 0.08, 0.2, 0.4, 0.2);

    const forearmL = MeshBuilder.CreateBox(`${id}-l-forearm`, { width: 0.082, height: 0.092, depth: 0.27 }, scene);
    forearmL.material = sleeveMat;
    addLeftPart(forearmL, -0.25, -0.22, -0.04, 0.3, 0.5, -0.2);

    addLeftCuff(0.095, 0.105, 0.13, -0.31, -0.30, -0.14, 0.3, 0.5, -0.2);
  }

  const reloadFamily: ViewmodelReloadFamily = (weapon === 'ak47' || weapon === 'rifle' || weapon === 'budget_t') ? 'rifle_ak'
    : (weapon === 'm4a1_s' || weapon === 'budget_ct') ? 'rifle_stanag'
    : isSniperWeapon ? 'sniper'
    : isSmgWeapon ? 'smg'
    : weapon === 'nova' ? 'shotgun_tube'
    : weapon === 'mag7' ? 'shotgun_mag'
    : weapon === 'negev' ? 'lmg'
    : isPistolWeapon ? 'pistol'
    : 'other';
  const magHome = WEAPON_GRIP_PROFILES[weapon]?.magWell ?? (isPistolWeapon ? [0, -.06, -.025] : [0, -.065, .06]);

  const reloadArm = new TransformNode(`${id}-reload-arm`, scene); reloadArm.parent = root; reloadArm.setEnabled(false);
  const reloadSleeve = MeshBuilder.CreateBox(`${id}-reload-sleeve`, { width: .082, height: .092, depth: .26 }, scene);
  reloadSleeve.material = sleeveMat; reloadSleeve.parent = reloadArm; reloadSleeve.position.set(-.01, -.02, -.14); reloadSleeve.isPickable = false;
  if (style.sleeveRolled) {
    const reloadCuff = MeshBuilder.CreateBox(`${id}-reload-cuff`, { width: .095, height: .104, depth: .11 }, scene);
    reloadCuff.material = cuffMat; reloadCuff.parent = reloadArm; reloadCuff.position.set(-.015, -.03, -.24); reloadCuff.isPickable = false;
  }
  const reloadWrist = new TransformNode(`${id}-reload-wrist`, scene); reloadWrist.parent = reloadArm; reloadWrist.position.set(0, 0, .005);
  const reloadHand = MeshBuilder.CreateBox(`${id}-reload-hand`, { width: .064, height: .052, depth: .078 }, scene);
  reloadHand.material = gloveMat; reloadHand.parent = reloadWrist; reloadHand.position.set(0, 0, .035); reloadHand.isPickable = false;
  const reloadKnuckle = MeshBuilder.CreateBox(`${id}-reload-knuckle`, { width: .066, height: .022, depth: .05 }, scene);
  reloadKnuckle.material = knuckleMat; reloadKnuckle.parent = reloadWrist; reloadKnuckle.position.set(0, .022, .032); reloadKnuckle.isPickable = false;
  const reloadFingers = MeshBuilder.CreateBox(`${id}-reload-fingers`, { width: .058, height: .042, depth: .054 }, scene);
  reloadFingers.material = fingerMat; reloadFingers.parent = reloadWrist; reloadFingers.position.set(.018, -.014, .066); reloadFingers.rotation.set(.32, -.16, 0); reloadFingers.isPickable = false;
  const reloadThumb = MeshBuilder.CreateBox(`${id}-reload-thumb`, { width: .026, height: .036, depth: .046 }, scene);
  reloadThumb.material = fingerMat; reloadThumb.parent = reloadWrist; reloadThumb.position.set(-.028, .016, .05); reloadThumb.rotation.set(-.2, .24, 0); reloadThumb.isPickable = false;

  const reloadMagazine = reloadFamily === 'shotgun_tube'
    ? MeshBuilder.CreateCylinder(`${id}-reload-shell`, { height: .062, diameter: .024 }, scene)
    : MeshBuilder.CreateBox(`${id}-reload-magazine`, reloadFamily === 'lmg' ? { width: .086, height: .105, depth: .096 } : reloadFamily === 'sniper' ? { width: .044, height: .112, depth: .068 } : reloadFamily === 'pistol' ? { width: .024, height: .112, depth: .035 } : reloadFamily === 'smg' ? { width: .025, height: .165, depth: .034 } : { width: .032, height: .150, depth: .054 }, scene);
  if (reloadFamily === 'shotgun_tube') {
    reloadMagazine.rotation.x = Math.PI / 2;
    reloadMagazine.material = getMat('#9c2824');
    const shellBrass = MeshBuilder.CreateCylinder(`${id}-reload-shell-brass`, { height: .018, diameter: .025 }, scene);
    shellBrass.material = getMat('#c49c48'); shellBrass.parent = reloadMagazine; shellBrass.position.y = -.025; shellBrass.isPickable = false;
  } else if (reloadFamily === 'rifle_ak') {
    reloadMagazine.material = getMat(weapon === 'budget_t' ? '#2c3439' : '#5e3422');
    const curveTip = MeshBuilder.CreateBox(`${id}-reload-mag-curve`, { width: .030, height: .075, depth: .052 }, scene);
    curveTip.material = reloadMagazine.material; curveTip.parent = reloadMagazine; curveTip.position.set(0, -.075, .014); curveTip.rotation.x = .32; curveTip.isPickable = false;
  } else if (reloadFamily === 'lmg') {
    reloadMagazine.material = getMat('#434b3b');
  } else if (reloadFamily === 'pistol') {
    reloadMagazine.material = getMat('#232a2f');
    const basePad = MeshBuilder.CreateBox(`${id}-reload-mag-pad`, { width: .028, height: .016, depth: .042 }, scene);
    basePad.material = getMat('#6f7b82'); basePad.parent = reloadMagazine; basePad.position.y = -.054; basePad.isPickable = false;
  } else {
    reloadMagazine.material = getMat('#252d33');
  }
  reloadMagazine.parent = root; reloadMagazine.isPickable = false; reloadMagazine.setEnabled(false);
  root.metadata = { weaponRoot: gun, muzzle: (gun.metadata as WeaponViewMetadata | undefined)?.muzzle,
    reloadParts: { arm: reloadArm, wrist: reloadWrist, magazine: reloadMagazine, leftArmMeshes, family: reloadFamily, magHome } } satisfies WeaponViewMetadata;

  return root;
}

const SPILLWAY_SCULPTED_SOLIDS = new Set([
  'b-silo-pillar',
  'b-pump-west',
  'b-pump-east',
  'gardens-fountain',
  'gardens-pergola-roof',
  't-service-truck',
  'a-response-truck',
  'ct-security-van',
  'gardens-tree-sw',
  'promenade-tree-mid',
  'terrace-tree-nw',
  'hq-tree-east',
]);

function toRenderSurface(surface: string | undefined, fallback: LiveSurface = 'stone'): LiveSurface {
  if (surface === 'wood') return 'timber';
  if (surface === 'brick') return 'clay';
  if (surface === 'dirt' || surface === 'water') return 'stone';
  if (surface === 'plaster' || surface === 'stone' || surface === 'paving' || surface === 'timber' || surface === 'metal' || surface === 'clay' || surface === 'concrete' || surface === 'grass') {
    return surface;
  }
  return fallback;
}

function cutRectHoles(
  rect: { minX: number; maxX: number; minZ: number; maxZ: number },
  holes: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[],
) {
  let parts = [rect];
  for (const hole of holes) {
    parts = parts.flatMap(r => {
      const a = Math.max(r.minX, hole.minX);
      const b = Math.min(r.maxX, hole.maxX);
      const c = Math.max(r.minZ, hole.minZ);
      const d = Math.min(r.maxZ, hole.maxZ);
      if (a >= b || c >= d) return [r];
      return [
        { minX: r.minX, maxX: a, minZ: r.minZ, maxZ: r.maxZ },
        { minX: b, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ },
        { minX: a, maxX: b, minZ: r.minZ, maxZ: c },
        { minX: a, maxX: b, minZ: d, maxZ: r.maxZ },
      ].filter(p => p.maxX - p.minX > .005 && p.maxZ - p.minZ > .005);
    });
  }
  return parts;
}

/** Presentation only: collision-volume proxies, never generated or qualified character assets. */
export class FpsLiveViewer {
  private engine:Engine;
  private scene:Scene;
  private camera:FreeCamera;
  private freeControls:FreeMapControls;
  private pipCamera:FreeCamera;
  private resize:ResizeObserver;
  private actors=new Map<string,ActorView>();
  private droppedMeshes=new Map<number,{root:TransformNode;ring:Mesh;lift:number}>();
  private corpseTime=0;
  private bloodMeshes=new Map<number,BloodView>();
  private bloodMaterials:StandardMaterial[]=[];
  private smokes=new Map<number,SmokeView>();
  private fires=new Map<number,FireView>();
  private blasts=new Map<number,BlastView>();
  private smokeTexture?:DynamicTexture;
  private tracers=new Map<number,TracerView>();
  private grenades=new Map<number,TransformNode>();
  private grenadeLineups=new Map<string,{tube:Mesh;line:LinesMesh;ring:Mesh;material:StandardMaterial;fadeUntil:number;baseTubeAlpha:number;baseLineAlpha:number;builtUntil:number;path:Vector3[]}>();
  private grenadeOrigins=new Map<number,{origin:LiveGrenade;originTime:number}>();
  private lineupRound=-1;
  private lineupTime=0;
  private animationRound=0;
  private materials=new Map<string,StandardMaterial>();
  private surfaces:LiveSurfaceLibrary;
  private fpGunRoot?:TransformNode;
  private fpGunWeapon?:LiveEquippedWeapon;
  private fpGunTeam?:FpsTeamId;
  private fpGunAttacking?:boolean;
  private fpGunVariant=-1;
  private fpMoveBlend=0;
  private currentEyeY=1.6;
  private fpMuzzleFlash?:Mesh;
  private fpWeaponViews=new LiveRenderCache<string,{root:TransformNode;flash?:Mesh}>(48,value=>{value.flash?.material?.dispose();value.root.dispose();});
  private prewarmedSig='';
  private readonly scratchVecA=new Vector3();
  private readonly scratchVecB=new Vector3();
  private readonly scratchVecC=new Vector3();
  private device:TransformNode;
  private corpseViews=new Map<number,{operative:OperativeView;rag:LiveRagdoll;borrowed:boolean}>();
  private utilityDrops=new Map<number,TransformNode>();
  private waterFlows:Texture[]=[];
  private mapMeshes:Mesh[]=[];
  private cutawayMeshes:Mesh[]=[];
  private mapLights:PointLight[]=[];
  private mapTextures:Texture[]=[];
  private mapMaterials:StandardMaterial[]=[];
  private cutawayEnabled=false;
  private debugEnabled=false;
  private overviewEnabled=false;
  private debugRoot?:TransformNode;
  private debugMaterials:StandardMaterial[]=[];
  private mapRuntime:LiveMapRuntime=FONTESSA_MAP_RUNTIME;
  private skyLight!:HemisphericLight;
  private sunLight!:DirectionalLight;
  private deviceClock?:DynamicTexture;private deviceSecond=-1;
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
  private directorKey='';
  private directorDecision?:ReturnType<typeof evaluateBroadcastDirector>;
  private frameAverage=1/60;private qualityAt=0;
  effectiveMode:Exclude<LiveCameraMode,'director'>='cinematic';

  constructor(canvas:HTMLCanvasElement,onLost:()=>void) {
    this.engine=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true});
    this.scene=new Scene(this.engine);
    this.surfaces=new LiveSurfaceLibrary(this.scene);
    this.camera=new FreeCamera('broadcast-camera',new Vector3(0,72,-63),this.scene);
    this.freeControls=new FreeMapControls(canvas);
    this.pipCamera=new FreeCamera('bomb-plant-pip-camera',new Vector3(0,3,0),this.scene);
    this.device=create3DWeaponMesh('bomb','objective-device',this.scene,hex=>this.material(hex));
    this.device.rotation.x=-Math.PI/2;
    this.resize=new ResizeObserver(()=>{if(!this.disposed)this.engine.resize();});
    try {
      // Render near CSS-pixel resolution instead of supersampling the whole 3D scene on retina screens.
      this.engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio||1));
      this.scene.skipPointerMovePicking=true;
      this.scene.clearColor=new Color4(.74,.81,.82,1);
      this.scene.fogMode=Scene.FOGMODE_EXP2;this.scene.fogDensity=.0032;this.scene.fogColor=new Color3(.74,.81,.82);
      this.scene.imageProcessingConfiguration.contrast=1.08;this.scene.imageProcessingConfiguration.exposure=1.02;
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
      this.skyLight=new HemisphericLight('harbor-sky',Vector3.Up(),this.scene);
      this.sunLight=new DirectionalLight('mediterranean-sun',new Vector3(-.55,-1,.32),this.scene);
      this.sunLight.autoCalcShadowZBounds=false;this.sunLight.shadowMinZ=10;this.sunLight.shadowMaxZ=220;this.sunLight.shadowOrthoScale=.04;
      this.shadows=new ShadowGenerator(1024,this.sunLight);this.shadows.usePercentageCloserFiltering=true;this.shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;this.shadows.bias=.0032;this.shadows.normalBias=.05;this.shadows.setDarkness(.22);const shadowMap=this.shadows.getShadowMap();if(shadowMap)shadowMap.refreshRate=1;
      const display=this.device.getChildMeshes().find(m=>m.name.endsWith('-c4-display'));
      if(display){this.deviceClock=new DynamicTexture('device-countdown',{width:128,height:64},this.scene,false);const mat=new StandardMaterial('device-countdown-screen',this.scene);mat.diffuseTexture=this.deviceClock;mat.emissiveTexture=this.deviceClock;mat.disableLighting=true;display.material=mat;}
      this.buildMapEnvironment(this.mapRuntime);
      this.engine.onContextLostObservable.add(()=>{if(!this.disposed)onLost();});
      this.resize.observe(canvas);this.engine.resize();
    } catch(error){this.dispose();throw error;}
  }
  getMapId():LiveMapId {
    return this.mapRuntime.id;
  }
  setMap(mapId:LiveMapId):void {
    if(this.disposed)return;
    const runtime=getLiveMapRuntime(mapId);
    if(runtime.id===this.mapRuntime.id && this.mapMeshes.length>0)return;
    this.prewarmedSig='';
    this.buildMapEnvironment(runtime);
  }
  setCutawayRoofs(enabled:boolean):void {
    this.cutawayEnabled=enabled;
    for(const mesh of this.cutawayMeshes){
      if(!mesh.isDisposed())mesh.setEnabled(!enabled);
    }
  }
  setOverview(enabled:boolean):void {
    this.overviewEnabled=enabled;
  }
  setDebugOverlays(enabled:boolean):void {
    this.debugEnabled=enabled;
    this.rebuildDebugOverlays();
  }
  private clearDebugOverlays():void {
    if(this.debugRoot){
      this.debugRoot.dispose(false,false);
      this.debugRoot=undefined;
    }
    for(const mat of this.debugMaterials)mat.dispose();
    this.debugMaterials=[];
  }
  private rebuildDebugOverlays():void {
    this.clearDebugOverlays();
    if(this.disposed||!this.debugEnabled)return;
    const root=new TransformNode('tactical-debug-root',this.scene);
    this.debugRoot=root;
    const makeMat=(name:string,hex:string,alpha=.86)=>{
      const m=new StandardMaterial(`dbg-${name}`,this.scene);
      const c=Color3.FromHexString(hex);
      m.diffuseColor=c;m.emissiveColor=c;m.disableLighting=true;m.alpha=alpha;
      this.debugMaterials.push(m);
      return m;
    };
    const matStreet=makeMat('nav-street','#38bdf8');
    const matUpper=makeMat('nav-upper','#f59e0b');
    const matCanal=makeMat('nav-canal','#14b8a6');
    const matDrop=makeMat('drop','#f43f5e');
    const matPerch=makeMat('perch','#84cc16');
    const matSite=makeMat('site','#f97316',.72);
    const rt=this.mapRuntime;

    for(const [i,node] of rt.navNodes.entries()){
      const marker=MeshBuilder.CreateDisc(`dbg-nav-${i}`,{radius:.24,tessellation:8},this.scene);
      marker.rotation.x=Math.PI/2;
      marker.position.set(node.x,rt.terrain.groundHeight(node)+.16,node.z);
      marker.material=node.level==='upper'?matUpper:node.level==='canal'?matCanal:matStreet;
      marker.isPickable=false;marker.parent=root;
    }

    const lines:Vector3[][]=[];
    for(let i=0;i<rt.navNodes.length;i++){
      const a=rt.navNodes[i];
      const ay=rt.terrain.groundHeight(a)+.2;
      for(const j of rt.neighbors[i]??[]){
        if(j<=i)continue;
        const b=rt.navNodes[j];
        const by=rt.terrain.groundHeight(b)+.2;
        lines.push([new Vector3(a.x,ay,a.z),new Vector3(b.x,by,b.z)]);
      }
    }
    if(lines.length){
      const net=MeshBuilder.CreateLineSystem('dbg-nav-links',{lines},this.scene);
      net.color=new Color3(.22,.74,.97);
      net.alpha=.48;net.isPickable=false;net.parent=root;
    }

    for(const [site,pt] of Object.entries(rt.definition.sites) as ['A'|'B',{x:number;z:number}][]){
      const rad=rt.definition.siteRadii?.[site]??4.5;
      const ring=MeshBuilder.CreateTorus(`dbg-site-${site}`,{diameter:rad*2,thickness:.12,tessellation:36},this.scene);
      ring.position.set(pt.x,rt.terrain.groundHeight(pt)+.1,pt.z);
      ring.material=matSite;ring.isPickable=false;ring.parent=root;
    }

    for(const drop of rt.elevationDrops){
      const fx=(drop.from.minX+drop.from.maxX)/2,fz=(drop.from.minZ+drop.from.maxZ)/2;
      const fy=rt.terrain.groundHeight({x:fx,z:fz,level:drop.fromLevel})+.25;
      const ly=rt.terrain.groundHeight(drop.landing)+.25;
      const arc=MeshBuilder.CreateLines(`dbg-drop-${drop.id}`,{points:[new Vector3(fx,fy,fz),new Vector3((fx+drop.landing.x)/2,Math.max(fy,ly)+.7,(fz+drop.landing.z)/2),new Vector3(drop.landing.x,ly,drop.landing.z)]},this.scene);
      arc.color=new Color3(.96,.25,.37);arc.isPickable=false;arc.parent=root;
      const target=MeshBuilder.CreateTorus(`dbg-drop-target-${drop.id}`,{diameter:.75,thickness:.07,tessellation:16},this.scene);
      target.position.set(drop.landing.x,ly-.12,drop.landing.z);target.material=matDrop;target.isPickable=false;target.parent=root;
    }

    for(const perch of rt.jumpablePerches){
      const ring=MeshBuilder.CreateTorus(`dbg-perch-${perch.id}`,{diameter:.82,thickness:.07,tessellation:16},this.scene);
      ring.position.set(perch.top.x,perch.height+.08,perch.top.z);ring.material=matPerch;ring.isPickable=false;ring.parent=root;
    }
  }
  private clearMapEnvironment():void {
    this.clearDebugOverlays();
    const skyDome=this.scene.getMeshByName('harbor-atmosphere-dome');
    if(skyDome){
      const skyMat=skyDome.material as StandardMaterial|null;
      skyMat?.emissiveTexture?.dispose();
      skyMat?.diffuseTexture?.dispose();
      skyMat?.dispose();
      skyDome.dispose();
    }
    for(const mesh of this.mapMeshes){
      this.shadows.removeShadowCaster(mesh);
      if(!mesh.isDisposed())mesh.dispose();
    }
    this.mapMeshes=[];
    for(const mesh of this.cutawayMeshes){
      this.shadows.removeShadowCaster(mesh);
      if(!mesh.isDisposed())mesh.dispose();
    }
    this.cutawayMeshes=[];
    for(const tex of this.waterFlows)if(!this.mapTextures.includes(tex))tex.dispose();
    this.waterFlows=[];
    for(const tex of this.mapTextures)tex.dispose();
    this.mapTextures=[];
    for(const mat of this.mapMaterials)mat.dispose();
    this.mapMaterials=[];
    for(const light of this.mapLights)light.dispose();
    this.mapLights=[];
    for(const view of this.bloodMeshes.values())for(const splat of view.splats)splat.dispose();
    this.bloodMeshes.clear();
  }
  private buildMapEnvironment(runtime:LiveMapRuntime):void {
    this.clearMapEnvironment();
    this.mapRuntime=runtime;
    this.freeControls.setBounds(runtime.definition.bounds);
    this.director=createDirectorState();
    this.directorKey='';
    this.previousCamera='';
    this.previousPipKey='';

    const atm=runtime.definition.atmosphere;
    buildLiveSky(this.scene,atm.sky);

    if(runtime.id==='fontessa'){
      this.scene.clearColor=new Color4(.74,.81,.82,1);
      this.scene.fogDensity=.0032;this.scene.fogColor=new Color3(.74,.81,.82);
      this.skyLight.intensity=.72;this.skyLight.diffuse=new Color3(.83,.91,1);this.skyLight.groundColor=new Color3(.34,.29,.23);
      this.sunLight.direction=new Vector3(-.55,-1,.32);this.sunLight.position.set(35,65,-35);
      this.sunLight.intensity=1.08;this.sunLight.diffuse=new Color3(1,.91,.77);

      const staticStart=this.scene.meshes.length;
      for(const [index,rect] of liveCutPavingRect({minX:-36,maxX:36,minZ:-46,maxZ:46}).entries()){
        const w=rect.maxX-rect.minX,d=rect.maxZ-rect.minZ;
        const floor=MeshBuilder.CreateGround(`village-paving-${index}`,{width:w,height:d},this.scene);floor.position.set((rect.minX+rect.maxX)/2,.003,(rect.minZ+rect.maxZ)/2);
        floor.setVerticesData('uv',[0,0,w/4,0,0,d/4,w/4,d/4]);floor.material=this.surfaces.material('paving','#aba38f');floor.receiveShadows=true;floor.isPickable=false;
      }
      const river=MeshBuilder.CreateGround('fontessa-canal',{width:230,height:LIVE_RIVER.maxZ-LIVE_RIVER.minZ},this.scene);river.position.set(0,LIVE_RIVER.waterY,(LIVE_RIVER.minZ+LIVE_RIVER.maxZ)/2);
      const riverMat=new StandardMaterial('canal-water',this.scene);riverMat.diffuseColor=new Color3(.17,.38,.34);riverMat.specularColor=new Color3(.65,.8,.75);riverMat.specularPower=92;riverMat.alpha=.96;river.material=riverMat;river.isPickable=false;
      this.mapMaterials.push(riverMat);
      const riverBed=MeshBuilder.CreateGround('canal-stone-bed',{width:230,height:LIVE_RIVER.maxZ-LIVE_RIVER.minZ},this.scene);riverBed.position.set(0,LIVE_RIVER.bedY,(LIVE_RIVER.minZ+LIVE_RIVER.maxZ)/2);riverBed.material=this.surfaces.material('stone','#697d69');riverBed.isPickable=false;
      const harbor=MeshBuilder.CreateGround('ct-port-water',{width:LIVE_PORT.maxX-LIVE_PORT.minX,height:LIVE_PORT.maxZ-LIVE_PORT.minZ},this.scene);harbor.position.set(0,LIVE_PORT.waterY,(LIVE_PORT.minZ+LIVE_PORT.maxZ)/2);harbor.material=riverMat;harbor.isPickable=false;
      harbor.setVerticesData('uv',[0,0,1,0,0,16,1,16]);
      const flow=new DynamicTexture('river-flow-lines',{width:256,height:128},this.scene,false),flowContext=flow.getContext() as unknown as CanvasRenderingContext2D;flowContext.fillStyle='#3b756c';flowContext.fillRect(0,0,256,128);for(let i=0;i<22;i++){flowContext.strokeStyle=i%3?'#5a8d7d':'#83a493';flowContext.lineWidth=i%3?1:2;flowContext.beginPath();flowContext.moveTo((i*71)%256,(i*37)%128);flowContext.bezierCurveTo((i*71)%256+10,(i*37)%128+4,(i*71)%256+22,(i*37)%128-4,(i*71)%256+34,(i*37)%128);flowContext.stroke();}flow.update();flow.uScale=40;flow.vScale=1;riverMat.diffuseTexture=flow;
      this.waterFlows.push(flow);this.mapTextures.push(flow);
      for(const [i,[minX,maxX,z]] of [[-115,115,LIVE_RIVER.minZ],[-115,-20.5,LIVE_RIVER.maxZ],[30.4,115,LIVE_RIVER.maxZ]].entries()){
        const bank=MeshBuilder.CreateBox(`canal-masonry-bank-${i}`,{width:maxX-minX,height:-LIVE_RIVER.bedY,depth:.12},this.scene);
        bank.position.set((minX+maxX)/2,LIVE_RIVER.bedY/2,z);bank.material=this.surfaces.material('stone','#8d9b8e');bank.isPickable=false;
      }
      for(const [i,bridge] of LIVE_RIVER_BRIDGES.entries()){
        if(i!==4)continue;const width=bridge.maxX-bridge.minX,deck=MeshBuilder.CreateBox(`canal-street-crossing-${i}`,{width,height:.22,depth:LIVE_RIVER.maxZ-LIVE_RIVER.minZ},this.scene);deck.position.set((bridge.minX+bridge.maxX)/2,1.8-.11,(LIVE_RIVER.minZ+LIVE_RIVER.maxZ)/2);deck.material=this.surfaces.material('stone','#c3b99b');deck.receiveShadows=true;deck.isPickable=false;
      }
      for(const wall of [...runtime.definition.solids,...runtime.terrain.terrainSolids]) {
        // The fountain's visible radial geometry is built below; its rectangle is movement clearance only.
        if(wall.id==='b-fountain'||wall.id==='mid-window-front-pier-west'||(wall.id.startsWith('restaurant-table-')||wall.id.startsWith('restaurant-outside-table-'))||wall.id.startsWith('village-tree-')||wall.id.startsWith('village-bin-'))continue;
        let minX=wall.minX,maxX=wall.maxX,minZ=wall.minZ,maxZ=wall.maxZ,top=wall.height;
        const base=wall.baseY??0;
        if(wall.id==='mid-window-upper-gallery'){minX+=.13;maxX-=.09;maxZ-=.13;}
        else if(wall.id==='mid-window-upper-hall'){minX+=.13;maxX-=.09;}
        else if(wall.id==='mid-window-room-floor'){minX+=.13;maxX-=.13;minZ+=.13;}
        else if(wall.id.startsWith('mid-window-rear-stair-')){minX+=.03;maxX-=.02;}
        else if(wall.id.startsWith('mid-window-ct-interior-stair-')){minX+=.02;maxX-=.13;}
        else if(wall.id.startsWith('mid-window-side-stair-')||wall.id==='mid-window-side-passage-floor'){minZ+=.03;maxZ-=.03;}
        else if(wall.id.startsWith('canal-quay-')||wall.id.startsWith('canal-stair-landing-')){top=-.015;}
        const width=maxX-minX,depth=maxZ-minZ,height=top-base;
        const design=wall.id.startsWith('village-terrace-stone-')?undefined:liveVillageAsset(wall.id);
        const kind:LiveSurface=wall.id==='b-apartments-roof'?'clay':design?.surface??'stone';
        const mesh=MeshBuilder.CreateBox(wall.id,{width,height,depth,faceUV:liveBoxSurfaceUV(width,height,depth,LIVE_SURFACE_METRES[kind])},this.scene);
        mesh.position.set((minX+maxX)/2,base+height/2,(minZ+maxZ)/2);mesh.material=this.surfaces.material(kind,wall.color);
        mesh.isPickable=false;mesh.receiveShadows=true;if(top>.05)this.shadows.addShadowCaster(mesh);mesh.freezeWorldMatrix();
        mesh.metadata={purpose:design?.purpose??'Walkable apartment stair or deck'};
        if(wall.cutawayGroup){mesh.setEnabled(!this.cutawayEnabled);this.cutawayMeshes.push(mesh);}
      }
      for(const mesh of buildLiveScenery(this.scene,color=>this.material(color),this.surfaces)){
        if(mesh.metadata?.castShadow!==false&&Math.abs(mesh.position.x)<=42&&Math.abs(mesh.position.z)<=50&&!/paving|floor|court|road|street|cloth|plaque|paint/.test(mesh.name))this.shadows.addShadowCaster(mesh);
      }
      const mosaicTexture=new DynamicTexture('b-basin-blue-mosaic',{width:512,height:512},this.scene,false);
      this.mapTextures.push(mosaicTexture);
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
      mosaicTexture.update();mosaicTexture.uScale=2;mosaicTexture.vScale=2;
      mosaicTexture.wrapU=mosaicTexture.wrapV=Texture.WRAP_ADDRESSMODE;mosaicTexture.anisotropicFilteringLevel=8;
      const mosaicMaterial=new StandardMaterial('b-basin-mosaic-material',this.scene);
      mosaicMaterial.diffuseTexture=mosaicTexture;mosaicMaterial.specularColor=new Color3(.13,.16,.16);
      this.mapMaterials.push(mosaicMaterial);
      for(const [site,position] of Object.entries(runtime.definition.sites)) {
        const siteSize=site==='B'?6.2:8.5;
        const pad=MeshBuilder.CreateGround(`site-${site}`,{width:siteSize,height:siteSize},this.scene);pad.position.set(position.x,.025,position.z);pad.material=site==='B'?mosaicMaterial:this.surfaces.material('paving','#d0c5aa');pad.receiveShadows=true;pad.isPickable=false;
        if(site==='A'){const repeat=siteSize/LIVE_SURFACE_METRES.paving;pad.setVerticesData('uv',[0,0,repeat,0,0,repeat,repeat,repeat]);}
        if(site==='B')for(const [edgeX,edgeZ,width,depth] of [
          [position.x,position.z-2.96,6.2,.28],[position.x,position.z+2.96,6.2,.28],
          [position.x-2.96,position.z,.28,6.2],[position.x+2.96,position.z,.28,6.2],
        ] as [number,number,number,number][]) {
          const border=MeshBuilder.CreateBox(`b-basin-stone-border-${edgeX}-${edgeZ}`,{width,height:.018,depth},this.scene);
          border.position.set(edgeX,.04,edgeZ);border.material=this.material('#d2c7ad');border.isPickable=false;border.receiveShadows=true;
        }
      }
      const cutawaySet=new Set<Mesh>(this.cutawayMeshes);
      batchStaticLiveGeometry(this.scene.meshes.slice(staticStart).filter((mesh):mesh is Mesh=>mesh instanceof Mesh&&!cutawaySet.has(mesh)),this.shadows);
      this.mapMeshes=this.scene.meshes.slice(staticStart).filter((mesh):mesh is Mesh=>mesh instanceof Mesh);
    } else {
      const fogColor=Color3.FromHexString(atm.fogHex);
      this.scene.clearColor=new Color4(fogColor.r,fogColor.g,fogColor.b,1);
      this.scene.fogColor=fogColor;this.scene.fogDensity=atm.fogDensity;
      this.skyLight.intensity=atm.hemiIntensity;
      this.skyLight.diffuse=Color3.FromHexString(atm.hemiSkyHex);
      this.skyLight.groundColor=Color3.FromHexString(atm.hemiGroundHex);
      const sd=atm.sunDirection;
      this.sunLight.direction=new Vector3(sd.x,sd.y,sd.z).normalize();
      this.sunLight.position=new Vector3(-sd.x*68,82,-sd.z*68);
      this.sunLight.intensity=atm.sunIntensity;
      this.sunLight.diffuse=Color3.FromHexString(atm.sunHex);

      const staticStart=this.scene.meshes.length;
      const baseHoles=runtime.id==='spillway'?SPILLWAY_SHALLOW_WATERS:[];
      for(const [index,rect] of cutRectHoles({minX:-120,maxX:120,minZ:-120,maxZ:120},baseHoles).entries()){
        const w=rect.maxX-rect.minX,d=rect.maxZ-rect.minZ;
        const floor=MeshBuilder.CreateGround(`${runtime.id}-ground-${index}`,{width:w,height:d},this.scene);
        floor.position.set((rect.minX+rect.maxX)/2,-.002,(rect.minZ+rect.maxZ)/2);
        const uScale=LIVE_SURFACE_METRES[atm.baseGroundSurface];
        floor.setVerticesData('uv',[0,0,w/uScale,0,0,d/uScale,w/uScale,d/uScale]);
        floor.material=this.surfaces.material(atm.baseGroundSurface,atm.baseGroundHex);
        floor.receiveShadows=true;floor.isPickable=false;
      }

      const staticCandidates:Mesh[]=[];
      for(const wall of [...runtime.definition.solids,...runtime.terrain.terrainSolids]){
        if(runtime.id==='spillway'&&SPILLWAY_SCULPTED_SOLIDS.has(wall.id))continue;
        const base=wall.baseY??0,height=wall.height-base;
        if(height<=.005)continue;
        const width=wall.maxX-wall.minX,depth=wall.maxZ-wall.minZ;
        const design=runtime.definition.resolveAssetStyle?.(wall.id);
        const kind=toRenderSurface(wall.surface??design?.surface,'concrete');
        const hex=wall.color||design?.color||'#8c9092';
        const mesh=MeshBuilder.CreateBox(wall.id,{width,height,depth,faceUV:liveBoxSurfaceUV(width,height,depth,LIVE_SURFACE_METRES[kind])},this.scene);
        mesh.position.set((wall.minX+wall.maxX)/2,base+height/2,(wall.minZ+wall.maxZ)/2);
        mesh.material=this.surfaces.material(kind,hex);
        mesh.isPickable=false;mesh.receiveShadows=true;
        if(wall.height>.05)this.shadows.addShadowCaster(mesh);
        mesh.freezeWorldMatrix();
        if(design?.purpose)mesh.metadata={purpose:design.purpose};
        if(wall.cutawayGroup){
          mesh.setEnabled(!this.cutawayEnabled);
          this.cutawayMeshes.push(mesh);
        } else {
          staticCandidates.push(mesh);
        }
      }
      batchStaticLiveGeometry(staticCandidates,this.shadows);

      if(runtime.id==='spillway'){
        const built=buildSpillwayScenery(this.scene,color=>this.material(color),this.surfaces);
        for(const mesh of built.cutawayMeshes){
          mesh.setEnabled(!this.cutawayEnabled);
          this.cutawayMeshes.push(mesh);
        }
        for(const caster of built.shadowCasters)this.shadows.addShadowCaster(caster);
        this.waterFlows.push(...built.waterTextures);
        this.mapTextures.push(...built.waterTextures);
        this.mapLights.push(...built.lights);
      }
      this.mapMeshes=this.scene.meshes.slice(staticStart).filter((mesh):mesh is Mesh=>mesh instanceof Mesh);
    }
    this.rebuildDebugOverlays();
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
    for(let i=0;i<72;i++){
      const x=30+random()*196,y=30+random()*196,radius=18+random()*42;
      const gradient=ctx.createRadialGradient(x,y,0,x,y,radius);
      gradient.addColorStop(0,`rgba(255,255,255,${.48+random()*.28})`);
      gradient.addColorStop(.55,'rgba(255,255,255,.32)');
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
    const material=new StandardMaterial(`${name}-mat`,this.scene);
    material.diffuseColor=Color3.FromHexString('#ffefa8');material.emissiveColor=new Color3(1,.85,.3);
    material.specularColor=Color3.Black();material.disableLighting=true;material.disableDepthWrite=true;material.alpha=.92;
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
    const shots=current.shots.filter(shot=>current.time>=shot.time&&current.time-shot.time<.1),ids=new Set(shots.map(shot=>shot.id));
    for(const [id,tracer] of this.tracers)if(!ids.has(id)){
      tracer.world.dispose();tracer.firstPerson?.dispose();this.tracers.delete(id);
    }
    for(const shot of shots){
      // Tracers use the same recorded origin and impact point as hit resolution.
      const origin=new Vector3(shot.from.x,shot.fromY,shot.from.z);
      const endpoint=new Vector3(shot.to.x,shot.toY,shot.to.z);
      let tracer=this.tracers.get(shot.id);
      if(!tracer){
        const world=MeshBuilder.CreateLines(`shot-${shot.id}`,{points:[origin,endpoint],updatable:true},this.scene);
        world.color=Color3.FromHexString(shot.team===current.attackTeam?'#ff9b9b':'#99d9ff');world.isPickable=false;
        tracer={world,actorId:shot.actorId};this.tracers.set(shot.id,tracer);
      }else MeshBuilder.CreateLines(`shot-${shot.id}`,{points:[origin,endpoint],instance:tracer.world});
      const firstOrigin=this.mainFpEnabled&&shot.actorId===this.mainFollowedId?origin:undefined;
      if(firstOrigin){
        if(!tracer.firstPerson){
          tracer.firstPerson=MeshBuilder.CreateLines(`fp-shot-${shot.id}`,{points:[firstOrigin,endpoint],updatable:true},this.scene);
          tracer.firstPerson.color=tracer.world.color;tracer.firstPerson.isPickable=false;
        }else MeshBuilder.CreateLines(`fp-shot-${shot.id}`,{points:[firstOrigin,endpoint],instance:tracer.firstPerson});
      }
    }
  }
  private clearGrenadeLineups(): void {
    for (const view of this.grenadeLineups.values()) {
      view.tube.dispose();
      view.line.dispose();
      view.ring.dispose();
      view.material.dispose();
    }
    this.grenadeLineups.clear();
    this.grenadeOrigins.clear();
  }
  private ensureGrenadeLineup(
    key: string,
    grenade: LiveGrenade,
    startTime: number,
    endTime: number,
    detonateAt: number,
    isAttack: boolean,
    kind: LiveGrenadeKind,
    now: number,
  ): void {
    const existing = this.grenadeLineups.get(key);
    const glowHex = isAttack ? '#fb7185' : '#60a5fa';
    const coreHex = kind === 'flash' ? '#fef9c3' : kind === 'incendiary' ? '#fed7aa' : kind === 'he' ? '#fecaca' : isAttack ? '#ffe4e6' : '#e0f2fe';
    if (existing) {
      existing.fadeUntil = now + 1.5;
      if (endTime - existing.builtUntil >= 0.04 || (endTime >= detonateAt - 0.02 && existing.builtUntil < endTime - 0.005)) {
        const points = computeLiveGrenadeTrajectoryPoints(grenade, startTime, endTime, this.mapRuntime);
        if (points.length >= 2) {
          for(let i=0;i<existing.path.length;i++)existing.path[i].copyFrom(points[points.length>existing.path.length?Math.round(i*(points.length-1)/(existing.path.length-1)):Math.min(i,points.length-1)]);
          MeshBuilder.CreateTube(`lineup-tube-${key}`, { path: existing.path, instance:existing.tube }, this.scene);
          MeshBuilder.CreateLines(`lineup-core-${key}`, { points:existing.path, instance:existing.line }, this.scene);
          const end = points[points.length - 1];
          existing.ring.position.set(end.x, end.y + 0.03, end.z);
          existing.builtUntil = endTime;
        }
      }
      existing.ring.setEnabled(now >= detonateAt - 0.22);
      return;
    }
    const points = computeLiveGrenadeTrajectoryPoints(grenade, startTime, endTime, this.mapRuntime);
    if (points.length < 2) return;
    const path=Array.from({length:192},(_,i)=>points[points.length>192?Math.round(i*(points.length-1)/191):Math.min(i,points.length-1)].clone());
    const baseTubeAlpha = 0.72;
    const baseLineAlpha = 0.96;
    const material = new StandardMaterial(`lineup-mat-${key}`, this.scene);
    const glowColor = Color3.FromHexString(glowHex);
    material.diffuseColor = glowColor;
    material.emissiveColor = glowColor;
    material.disableLighting = true;
    material.disableDepthWrite = true;
    material.alpha = baseTubeAlpha;
    const tube = MeshBuilder.CreateTube(`lineup-tube-${key}`, { path, radius: 0.032, tessellation: 6, updatable: true }, this.scene);
    tube.material = material;
    tube.isPickable = false;
    tube.alwaysSelectAsActiveMesh = true;
    const line = MeshBuilder.CreateLines(`lineup-core-${key}`, { points:path, updatable: true }, this.scene);
    line.color = Color3.FromHexString(coreHex);
    line.alpha = baseLineAlpha;
    line.isPickable = false;
    line.alwaysSelectAsActiveMesh = true;
    const end = points[points.length - 1];
    const ring = MeshBuilder.CreateTorus(`lineup-ring-${key}`, { diameter: 0.68, thickness: 0.042, tessellation: 20 }, this.scene);
    ring.position.set(end.x, end.y + 0.03, end.z);
    ring.material = material;
    ring.isPickable = false;
    ring.alwaysSelectAsActiveMesh = true;
    ring.setEnabled(now >= detonateAt - 0.22);
    this.grenadeLineups.set(key, { tube, line, ring, material, fadeUntil: now + 1.5, baseTubeAlpha, baseLineAlpha, builtUntil: endTime,path });
  }
  private updateGrenadeLineups(current: LiveSnapshot, renderTime: number): void {
    if (current.round !== this.lineupRound || current.time < this.lineupTime - 1e-4) {
      this.clearGrenadeLineups();
    }
    this.lineupRound = current.round;
    this.lineupTime = current.time;
    const liveIds = new Set(current.grenades.map(g => g.id));
    for (const id of this.grenadeOrigins.keys()) {
      if (!liveIds.has(id)) this.grenadeOrigins.delete(id);
    }
    for (const grenade of current.grenades) {
      if (!this.grenadeOrigins.has(grenade.id)) {
        this.grenadeOrigins.set(grenade.id, { origin: { ...grenade }, originTime: Math.max(current.time, grenade.releaseAt) });
      }
    }
    const activeKeys = new Set<string>();
    for (const grenade of current.grenades) {
      if (renderTime < grenade.releaseAt) continue;
      const key = `grenade:${grenade.id}`;
      activeKeys.add(key);
      const originEntry = this.grenadeOrigins.get(grenade.id)!;
      const trailEnd = Math.min(grenade.detonateAt, renderTime);
      this.ensureGrenadeLineup(key, originEntry.origin, originEntry.originTime, trailEnd, grenade.detonateAt, grenade.team === current.attackTeam, grenade.kind, renderTime);
    }
    for (const [key, view] of this.grenadeLineups) {
      if (activeKeys.has(key)) {
        view.material.alpha = view.baseTubeAlpha;
        view.line.alpha = view.baseLineAlpha;
        continue;
      }
      if (renderTime >= view.fadeUntil) {
        view.tube.dispose();
        view.line.dispose();
        view.ring.dispose();
        view.material.dispose();
        this.grenadeLineups.delete(key);
        continue;
      }
      const fade = Math.max(0, Math.min(1, (view.fadeUntil - renderTime) / 1.5));
      view.material.alpha = view.baseTubeAlpha * fade;
      view.line.alpha = view.baseLineAlpha * fade;
    }
  }
  private resetOperativeMotion(o:OperativeView,resetStride=false):void {
    o.hasMotion=false;o.crouchPose=0;o.landSquash=0;o.wasAirborne=false;o.prevJumpY=0;o.flinch=0;o.lastHp=undefined;
    if(resetStride)o.stridePhase=0;
    if(o.poseMemory)o.poseMemory.initialized=false;
  }
  private updateCorpses(current:LiveSnapshot,playerVariants:Map<string,number>):void {
    const delta=Math.max(0,Math.min(.1,current.time-this.corpseTime));this.corpseTime=current.time;
    for(const [id,view] of this.corpseViews)if(!current.corpses?.some(c=>c.id===id)){
      const o=view.operative;
      if(view.borrowed){
        o.root.setEnabled(false);o.root.position.setAll(0);o.root.rotation.setAll(0);
        o.spine.position.set(0,1.05,0);o.headPivot.position.set(0,1.54,0);
        o.leftArmPivot.position.set(-.192,1.29,0);o.rightArmPivot.position.set(.192,1.29,0);
        o.leftLegPivot.position.set(-.105,.74,0);o.rightLegPivot.position.set(.105,.74,0);
        for(const [joint,parent,y] of [[o.leftElbowPivot,o.leftArmPivot,-.25],[o.rightElbowPivot,o.rightArmPivot,-.25],[o.leftKneePivot,o.leftLegPivot,-.36],[o.rightKneePivot,o.rightLegPivot,-.36]] as const){joint.parent=parent;joint.position.set(0,y,0);}
        for(const pivot of [o.spine,o.headPivot,o.leftArmPivot,o.rightArmPivot,o.leftElbowPivot,o.rightElbowPivot,o.leftLegPivot,o.rightLegPivot,o.leftKneePivot,o.rightKneePivot])pivot.rotation.setAll(0);
        this.resetOperativeMotion(o);
      }else{for(const mesh of o.root.getChildMeshes())this.shadows.removeShadowCaster(mesh);o.root.dispose();}
      this.corpseViews.delete(id);
    }
    for(const corpse of current.corpses??[]){
      let view=this.corpseViews.get(corpse.id);
      if(!view){const existing=this.actors.get(corpse.playerId)?.operative;
        const variantHint=existing?.variantIndex??playerVariants.get(corpse.playerId);
        const operative=existing??createTacticalOperativeMesh(corpse.attacking?'t':'ct',`body-${corpse.id}`,this.scene,hex=>this.material(hex),variantHint);
        operative.root.position.setAll(0);operative.root.rotation.setAll(0);operative.root.setEnabled(true);
        for(const pivot of [operative.leftElbowPivot,operative.rightElbowPivot,operative.leftKneePivot,operative.rightKneePivot])pivot.parent=operative.root;
        operative.magazine.setEnabled(false);view={operative,rag:createLiveRagdoll(corpse,this.mapRuntime),borrowed:!!existing};this.corpseViews.set(corpse.id,view);
      }
      if(view.rag.age>4)continue;
      stepLiveRagdoll(view.rag,delta);const p=view.rag.points,o=view.operative;
      const bone=(pivot:TransformNode,a:RagJoint,b:RagJoint)=>{const start=p[a],end=p[b],dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z,len=Math.hypot(dx,dy,dz)||1;pivot.position.set(start.x,start.y,start.z);pivot.rotation.set(0,Math.atan2(-dz,dx),Math.acos(Math.max(-1,Math.min(1,-dy/len))));};
      bone(o.spine,'chest','pelvis');o.spine.position.set((p.chest.x+p.pelvis.x)/2,(p.chest.y+p.pelvis.y)/2,(p.chest.z+p.pelvis.z)/2);
      bone(o.headPivot,'head','chest');
      bone(o.leftArmPivot,'ls','le');bone(o.leftElbowPivot,'le','lh');bone(o.rightArmPivot,'rs','re');bone(o.rightElbowPivot,'re','rh');bone(o.leftLegPivot,'lhp','lk');bone(o.leftKneePivot,'lk','lf');bone(o.rightLegPivot,'rhp','rk');bone(o.rightKneePivot,'rk','rf');
    }
  }
  private updateBloodMarks(current:LiveSnapshot) {
    const marks=current.bloodMarks??[],ids=new Set(marks.map(mark=>mark.id));
    for(const [id,view] of this.bloodMeshes)if(!ids.has(id)){for(const splat of view.splats)splat.dispose();this.bloodMeshes.delete(id);}
    if(marks.length&&!this.bloodMaterials.length){
      for(const [index,hex] of ['#55181c','#792128','#a33a3c'].entries()){
        const material=new StandardMaterial(`round-blood-${index}`,this.scene);
        material.diffuseColor=Color3.FromHexString(hex);material.emissiveColor=Color3.FromHexString(hex).scale(.18);
        material.alpha=.76;material.disableLighting=true;material.disableDepthWrite=true;material.zOffset=-2;material.backFaceCulling=false;
        this.bloodMaterials.push(material);
      }
    }
    for(const mark of marks){
      if(this.bloodMeshes.has(mark.id))continue;
      const splats:Mesh[]=[];
      for(let index=0;index<4;index++){
        const angle=(mark.id*1.731+index*2.399)% (Math.PI*2);
        const reach=index===0?0:mark.radius*(.25+((mark.id+index*3)%7)/12);
        const size=mark.radius*(index===0 ? .9 : .24+((mark.id+index)%4)*.055);
        const splat=MeshBuilder.CreateDisc(`blood-${mark.id}-${index}`,{radius:1,tessellation:14},this.scene);
        splat.rotation.x=Math.PI/2;splat.position.set(mark.x+Math.cos(angle)*reach,this.mapRuntime.terrain.groundHeight(mark)+.036+index*.0018,mark.z+Math.sin(angle)*reach);
        splat.scaling.set(size*(index===0?1.25:.72),size*(index===0 ? .72 : .5),1);
        splat.material=this.bloodMaterials[(mark.id+index+(mark.region==='head'?1:0))%this.bloodMaterials.length];
        splat.isPickable=false;splats.push(splat);
      }
      this.bloodMeshes.set(mark.id,{splats});
    }
  }
  render(previous:LiveSnapshot,current:LiveSnapshot,alpha:number,mode:LiveCameraMode,selected:string,elapsed=1/60,allowPip=true,lookAhead?:LiveSnapshot,showLineups=true):LiveRenderResult {
    if(this.disposed)return {followedId:selected,effectiveMode:'cinematic',pip:{active:false,phase:'planting',progress:0,duration:3.2,spot:{x:0,z:0}}};
    const nextMap=current.mapId??'fontessa';
    if(nextMap!==this.mapRuntime.id)this.setMap(nextMap);
    const renderTime=previous.round===current.round&&current.time>=previous.time?mix(previous.time,current.time,alpha):current.time;
    if(this.animationRound!==current.round){
      this.animationRound=current.round;
      for(const view of this.actors.values())this.resetOperativeMotion(view.operative,true);
    }
    this.surfaces.update(renderTime);for(const tex of this.waterFlows)tex.uOffset=renderTime*.035;
    const players=current.players.map(p=>interpolateLivePlayer(previous.round===current.round?previous.players.find(a=>a.id===p.id):undefined,p,alpha));
    const playerVariants=new Map<string,number>();
    let ctSlot=0,tSlot=0;
    for(const p of players){
      const sideSlot=p.attacking?tSlot++:ctSlot++;
      playerVariants.set(p.id,(sideSlot+(p.team==='red'?2:0))%5);
    }
    const directorKey=`${current.time}:${lookAhead?.time}:${mode}:${selected}`;
    if(this.directorKey!==directorKey){this.directorDecision=evaluateBroadcastDirector(current,this.director,mode,selected,lookAhead);this.directorKey=directorKey;}
    const decision=this.directorDecision!;
    const followed=players.find(p=>p.id===decision.followedId)??players[0];
    const effectiveMode=decision.effectiveMode;
    this.effectiveMode=effectiveMode;
    this.updateCorpses({...current,time:renderTime},playerVariants);
    for(const player of players) {
      let view=this.actors.get(player.id);
      if(player.hp<=0){
        if(view){if(!current.corpses?.some(c=>c.playerId===player.id))view.operative.root.setEnabled(false);view.gunNode?.setEnabled(false);view.muzzleFlash?.setEnabled(false);}
        continue;
      }
      const force=player.attacking?'t':'ct';
      const variantHint=playerVariants.get(player.id);
      if(!view||view.force!==force||view.operative.variantIndex!==variantHint) {
        if(view){
          for(const mesh of view.operative.root.getChildMeshes())this.shadows.removeShadowCaster(mesh);
          view.operative.root.dispose();if(view.weaponViews)view.weaponViews.clear();else view.gunNode?.dispose();
        }
        const operative=createTacticalOperativeMesh(force,player.id,this.scene,hex=>this.material(hex),variantHint);
        // Include the limbs and boots so moving operatives cast a grounded full silhouette.
        for(const mesh of operative.root.getChildMeshes())if(/-torso$|-head$|-arm-[lr]$|-leg-[lr]$|-shin-[lr]$|-forearm-[lr]$|-boot-[lr]$/.test(mesh.name))this.shadows.addShadowCaster(mesh);
        view={operative,force};
        this.actors.set(player.id,view);
      }
      if(!view.gunNode || view.gunWeapon!==player.equipped) {
        view.gunNode?.setEnabled(false);view.muzzleFlash?.setEnabled(false);
        const cache=view.weaponViews??(view.weaponViews=new LiveRenderCache(4,value=>{value.flash?.material?.dispose();value.root.dispose();}));
        const weapon=cache.get(player.equipped,()=>{
          const root=create3DWeaponMesh(player.equipped,`proxy-gun-${player.id}-${player.equipped}`,this.scene,hex=>this.material(hex),player.attacking);
          const muzzle=(root.metadata as WeaponViewMetadata|undefined)?.muzzle;
          return {root,flash:muzzle?this.createMuzzleFlash(`muzzle-${player.id}-${player.equipped}`,muzzle):undefined};
        });
        view.gunNode=weapon.root;view.muzzleFlash=weapon.flash;
        view.gunWeapon=player.equipped;
      }
      const alivePlayer=player.hp>0;
      view.operative.root.setEnabled(alivePlayer);
      view.gunNode.setEnabled(alivePlayer&&!(player.throwAt!==undefined&&player.throwKind===player.equipped&&current.time>=player.throwAt+.2));
      view.muzzleFlash?.setEnabled(alivePlayer&&renderTime>=player.lastShot&&renderTime-player.lastShot<.07);

      const jumpY = player.jumpY ?? 0;
      view.operative.root.position.set(player.x,jumpY,player.z);
      view.operative.root.rotation.y=player.yaw;

      if (alivePlayer) {
        applyOperativeAnimation(view, player, renderTime, elapsed);
      }
    }
    for(const [id,mesh] of this.utilityDrops)if(!current.droppedUtility?.some(w=>w.id===id)){mesh.dispose();this.utilityDrops.delete(id);}
    for(const item of current.droppedUtility??[]){
      let mesh=this.utilityDrops.get(item.id);
      if(!mesh){mesh=create3DWeaponMesh(item.kind,`utility-stock-${item.id}`,this.scene,hex=>this.material(hex),item.team===current.attackTeam);mesh.rotation.set(Math.PI/2,item.id*.7,0);this.utilityDrops.set(item.id,mesh);}
      const t=item.airUntil?Math.max(0,Math.min(1,1-(item.airUntil-current.time)/.7)):1,from=item.from??item;
      mesh.position.set(mix(from.x,item.x,t),mix(item.fromY??this.mapRuntime.terrain.groundHeight(from)+.14,this.mapRuntime.terrain.groundHeight(item)+.14,t)+Math.sin(t*Math.PI)*.4,mix(from.z,item.z,t));
    }
    // Roll lays the firearm on its side; yaw rotates it in the floor plane. Bounds keep every part above stone.
    for(const [id,item] of this.droppedMeshes)if(!current.droppedWeapons.some(w=>w.id===id)){item.root.dispose();item.ring.dispose();this.droppedMeshes.delete(id);}
    for(const dropped of current.droppedWeapons){
      let item=this.droppedMeshes.get(dropped.id);
      if(!item){
        const root=create3DWeaponMesh(dropped.weapon,`dropped-${dropped.id}`,this.scene,hex=>this.material(hex));root.rotation.set(0,((dropped.id*73)%360)*Math.PI/180,Math.PI/2);root.computeWorldMatrix(true);
        let minY=Infinity;for(const mesh of root.getChildMeshes()){mesh.computeWorldMatrix(true);minY=Math.min(minY,mesh.getBoundingInfo().boundingBox.minimumWorld.y);}
        const ring=MeshBuilder.CreateTorus(`drop-ring-${dropped.id}`,{diameter:.65,thickness:.012,tessellation:16},this.scene);ring.position.set(dropped.x,this.mapRuntime.terrain.groundHeight(dropped)+.024,dropped.z);ring.material=this.material('#93836b');ring.isPickable=false;ring.freezeWorldMatrix();
        item={root,ring,lift:Number.isFinite(minY)?.035-minY:.12};this.droppedMeshes.set(dropped.id,item);
      }
      const t=dropped.airUntil?Math.max(0,Math.min(1,1-(dropped.airUntil-current.time)/.7)):1,from=dropped.from??dropped;
      const x=mix(from.x,dropped.x,t),z=mix(from.z,dropped.z,t),y=mix(dropped.fromY??this.mapRuntime.terrain.groundHeight(from)+item.lift,this.mapRuntime.terrain.groundHeight(dropped)+item.lift,t)+Math.sin(t*Math.PI)*.45;
      item.root.position.set(x,y,z);item.ring.setEnabled(t>=1);
    }
    for(const [id,cloud] of this.smokes)if(!current.smokes.some(s=>s.id===id)){cloud.root.dispose(false,false);cloud.material.dispose(false,false);this.smokes.delete(id);}
    for(const rawSmoke of current.smokes) {
      const prevSmoke=previous.round===current.round?previous.smokes.find(s=>s.id===rawSmoke.id):undefined;
      const smoke=prevSmoke?{...rawSmoke,radius:mix(prevSmoke.radius,rawSmoke.radius,alpha)}:rawSmoke;
      if(!this.smokes.has(smoke.id)) {
        const volume=createLiveSmokeRenderVolume(this.scene,smoke.id);
        if(volume){this.smokes.set(smoke.id,{...volume,lobes:[],volume});}
        else {
        const root=new TransformNode(`smoke-cloud-${smoke.id}`,this.scene);root.position.set(smoke.x,smoke.y,smoke.z);
        const lobes:Mesh[]=[];
        const cloudTexture=this.smokeVolumeTexture();
        const material=new StandardMaterial(`smoke-material-${smoke.id}`,this.scene);material.diffuseColor=new Color3(.6,.63,.62);material.emissiveColor=new Color3(.06,.07,.07);material.diffuseTexture=cloudTexture;material.useAlphaFromDiffuseTexture=true;material.alpha=.99;material.backFaceCulling=false;material.disableLighting=true;material.disableDepthWrite=true;material.specularColor=Color3.Black();
        for(let i=0;i<15;i++){
          const mesh=MeshBuilder.CreateSphere(`smoke-${smoke.id}-${i}`,{diameter:1,segments:12},this.scene);mesh.parent=root;mesh.isPickable=false;
          mesh.material=material;
          mesh.position.set(0,.05+(i%3)*.12,0);
          mesh.scaling.set(.4,.34,.4);lobes.push(mesh);
        }
        this.smokes.set(smoke.id,{root,lobes,material});
        }
      }
      const cloud=this.smokes.get(smoke.id)!;cloud.root.position.set(smoke.x,smoke.y,smoke.z);
      if(cloud.volume){updateLiveSmokeRenderVolume(cloud.volume,smoke,renderTime);continue;}
      const cloudLobes=liveSmokeCloudLobes(smoke,renderTime);
      for(let i=0;i<cloud.lobes.length;i++){
        const lobe=cloudLobes[i];
        cloud.lobes[i].position.set(lobe.x,lobe.y,lobe.z);
        cloud.lobes[i].rotation.y=0;
        cloud.lobes[i].scaling.set(lobe.scaleX,lobe.scaleY,lobe.scaleZ);
      }
      cloud.material.alpha=.94*(1-.08*Math.min(1,smoke.disturbance??0));
    }
    for(const [id,view] of this.fires)if(!current.fires?.some(f=>f.id===id)){view.root.dispose(false,true);this.fires.delete(id);}
    for(const fire of current.fires??[]) {
      const prevFire=previous.round===current.round?previous.fires?.find(f=>f.id===fire.id):undefined;
      const fireRadius=prevFire?mix(prevFire.radius,fire.radius,alpha):fire.radius;
      let view=this.fires.get(fire.id);
      if(!view){
        const root=new TransformNode(`fire-zone-${fire.id}`,this.scene);root.position.set(fire.x,.07,fire.z);
        const ground=MeshBuilder.CreateCylinder(`fire-ground-${fire.id}`,{height:.035,diameter:1,tessellation:32},this.scene);ground.parent=root;ground.position.y=.02;ground.isPickable=false;
        const groundMaterial=new StandardMaterial(`fire-ground-material-${fire.id}`,this.scene);groundMaterial.diffuseColor=new Color3(1,.24,.012);groundMaterial.emissiveColor=new Color3(1,.18,.005);groundMaterial.alpha=.5;groundMaterial.disableLighting=true;groundMaterial.disableDepthWrite=true;groundMaterial.zOffset=-1;groundMaterial.specularColor=Color3.Black();ground.material=groundMaterial;
        const groundFlames:Mesh[]=[],groundFlameMaterials:StandardMaterial[]=[],patchColors=[new Color3(1,.17,.012),new Color3(1,.32,.015),new Color3(1,.58,.045)];
        for(let i=0;i<12;i++){
          const patch=MeshBuilder.CreateSphere(`fire-ground-flame-${fire.id}-${i}`,{diameter:1,segments:8},this.scene);patch.parent=root;patch.isPickable=false;
          const material=new StandardMaterial(`fire-ground-flame-material-${fire.id}-${i}`,this.scene);material.diffuseColor=patchColors[i%patchColors.length];material.emissiveColor=patchColors[i%patchColors.length];material.alpha=.68;material.disableLighting=true;material.disableDepthWrite=true;material.zOffset=-2;material.specularColor=Color3.Black();patch.material=material;
          groundFlames.push(patch);groundFlameMaterials.push(material);
        }
        const flames:Mesh[]=[],flameMaterials:StandardMaterial[]=[];
        for(let i=0;i<7;i++){
          const flame=MeshBuilder.CreateCylinder(`fire-flame-${fire.id}-${i}`,{height:.62+(i%3)*.12,diameterTop:.015,diameterBottom:.38,tessellation:7},this.scene);flame.parent=root;flame.isPickable=false;
          const material=new StandardMaterial(`fire-flame-material-${fire.id}-${i}`,this.scene);material.diffuseColor=i%2?new Color3(1,.55,.05):new Color3(1,.2,.015);material.emissiveColor=new Color3(1,.24,.02);material.alpha=.82;material.disableLighting=true;material.disableDepthWrite=true;material.specularColor=Color3.Black();flame.material=material;
          const theta=i/7*Math.PI*2;flame.position.set(Math.cos(theta)*.36,.35,Math.sin(theta)*.36);flames.push(flame);flameMaterials.push(material);
        }
        view={root,ground,groundFlames,groundFlameMaterials,flames,groundMaterial,flameMaterials};this.fires.set(fire.id,view);
      }
      view.root.position.set(fire.x,this.mapRuntime.terrain.groundHeight(fire)+.045,fire.z);view.ground.scaling.set(fireRadius*2,1,fireRadius*2);
      const fade=Math.min(1,Math.max(0,(fire.expires-renderTime)/1.2));view.groundMaterial.alpha=.5*Math.min(1,fade+.2);
      for(let i=0;i<view.groundFlames.length;i++){
        const phase=i*2.399,theta=phase+Math.sin(renderTime*2.3+phase)*.08,radial=.12+(i%4)*.17,pulse=.78+Math.sin(renderTime*6.2+phase)*.18;
        const width=fireRadius*(.12+(i%3)*.025);
        view.groundFlames[i].position.set(Math.cos(theta)*fireRadius*radial,.042+Math.max(0,Math.sin(renderTime*5.4+phase))*.012,Math.sin(theta)*fireRadius*radial);
        view.groundFlames[i].scaling.set(width,.035,width*(.7+(i%2)*.15));view.groundFlameMaterials[i].alpha=.66*Math.min(1,fade+.2)*pulse;
      }
      for(let i=0;i<view.flames.length;i++){
        const theta=i/7*Math.PI*2+Math.sin(renderTime*2.6+i)*.12,scale=fireRadius/4.2;
        view.flames[i].position.set(Math.cos(theta)*fireRadius*.56,.31+Math.sin(renderTime*8+i)*.065,Math.sin(theta)*fireRadius*.56);
        view.flames[i].scaling.set(scale*(.9+Math.sin(renderTime*7+i)*.1),scale*(.72+Math.sin(renderTime*7+i)*.12),scale);view.flameMaterials[i].alpha=.82*Math.min(1,fade+.2);
      }
    }
    const liveBlasts:LiveBlast[]=current.blasts??[];
    for(const [id,view] of this.blasts)if(!liveBlasts.some(blast=>blast.id===id)){view.sphere.dispose();view.ring.dispose();view.sphereMaterial.dispose();view.ringMaterial.dispose();this.blasts.delete(id);}
    for(const blast of liveBlasts){
      let view=this.blasts.get(blast.id);
      if(!view){
        const sphere=MeshBuilder.CreateSphere(`he-blast-${blast.id}`,{diameter:1,segments:10},this.scene);
        const ring=MeshBuilder.CreateTorus(`he-blast-ring-${blast.id}`,{diameter:1,thickness:.08,tessellation:24},this.scene);
        const sphereMaterial=new StandardMaterial(`he-blast-material-${blast.id}`,this.scene);sphereMaterial.diffuseColor=new Color3(1,.68,.2);sphereMaterial.emissiveColor=new Color3(1,.32,.04);sphereMaterial.alpha=.7;sphereMaterial.disableLighting=true;sphereMaterial.disableDepthWrite=true;sphere.material=sphereMaterial;
        const ringMaterial=new StandardMaterial(`he-blast-ring-material-${blast.id}`,this.scene);ringMaterial.diffuseColor=new Color3(1,.28,.04);ringMaterial.emissiveColor=new Color3(1,.2,.015);ringMaterial.alpha=.78;ringMaterial.disableLighting=true;ringMaterial.disableDepthWrite=true;ringMaterial.zOffset=-1;ring.material=ringMaterial;
        sphere.isPickable=false;ring.isPickable=false;view={sphere,ring,sphereMaterial,ringMaterial};this.blasts.set(blast.id,view);
      }
      const age=Math.max(0,renderTime-blast.startedAt),life=Math.max(0,Math.min(1,(blast.endsAt-renderTime)/Math.max(.01,blast.endsAt-blast.startedAt)));
      const scale=.35+age*13;
      view.sphere.position.set(blast.x,this.mapRuntime.terrain.groundHeight(blast)+.75,blast.z);view.sphere.scaling.set(scale,scale*.45,scale);
      view.ring.position.set(blast.x,this.mapRuntime.terrain.groundHeight(blast)+.08,blast.z);view.ring.scaling.set(scale*1.1,1,scale*1.1);
      view.sphereMaterial.alpha=.7*life;view.ringMaterial.alpha=.78*life;
    }
    for(const [id,mesh] of this.grenades)if(!current.grenades.some(g=>g.id===id)){mesh.dispose();this.grenades.delete(id);}
    for(const grenade of current.grenades) {
      const prevGrenade=previous.round===current.round?previous.grenades.find(g=>g.id===grenade.id):undefined;
      let mesh=this.grenades.get(grenade.id);
      if(!mesh){mesh=create3DWeaponMesh(grenade.kind,`grenade-${grenade.id}`,this.scene,hex=>this.material(hex),grenade.team===current.attackTeam);mesh.scaling.setAll(1.35);this.grenades.set(grenade.id,mesh);}
      mesh.setEnabled(renderTime>=grenade.releaseAt);
      const flight=Math.max(0,renderTime-grenade.releaseAt);
      mesh.rotation.set(flight*7,flight*3,flight*2);
      if(renderTime<grenade.releaseAt) {
        const thrower=players.find(player=>player.id===grenade.actorId);
        if(thrower) {
          const forwardX=Math.sin(thrower.yaw),forwardZ=Math.cos(thrower.yaw),rightX=Math.cos(thrower.yaw),rightZ=-Math.sin(thrower.yaw);
          mesh.position.set(thrower.x+forwardX*.2+rightX*.16,1.55+(thrower.jumpY??0),thrower.z+forwardZ*.2+rightZ*.16);
        } else mesh.position.set(grenade.x,grenade.y,grenade.z);
      } else if(prevGrenade&&prevGrenade.releaseAt<=previous.time) {
        mesh.position.set(mix(prevGrenade.x,grenade.x,alpha),mix(prevGrenade.y,grenade.y,alpha),mix(prevGrenade.z,grenade.z,alpha));
      } else mesh.position.set(grenade.x,grenade.y,grenade.z);
    }

    this.device.setEnabled(current.bomb.status==='planted'||current.bomb.status==='dropped');this.device.position.set(current.bomb.x,this.mapRuntime.terrain.groundHeight(current.bomb)+.14,current.bomb.z);
    const second=Math.ceil(current.bomb.remaining);if(this.deviceClock&&this.deviceSecond!==second){this.deviceSecond=second;this.deviceClock.drawText(second.toString().padStart(2,'0')+':00',8,48,'bold 48px monospace','#b5ffba','#142b25',true);}
    if(current.bomb.status==='exploded'&&this.explosionRound!==current.round){
      this.explosionRound=current.round;this.explosionStartedAt=current.time;
      this.explosionSphere=MeshBuilder.CreateSphere('bomb-explosion-flash',{diameter:1,segments:10},this.scene);this.explosionSphere.position.set(current.bomb.x,this.mapRuntime.terrain.groundHeight(current.bomb)+.8,current.bomb.z);
      this.explosionRing=MeshBuilder.CreateTorus('bomb-explosion-ring',{diameter:1,thickness:.18,tessellation:24},this.scene);this.explosionRing.position.set(current.bomb.x,this.mapRuntime.terrain.groundHeight(current.bomb)+.1,current.bomb.z);
      const flashMaterial=new StandardMaterial('bomb-explosion-flash-material',this.scene);flashMaterial.emissiveColor=new Color3(1,.48,.06);flashMaterial.diffuseColor=new Color3(1,.64,.14);flashMaterial.alpha=.9;flashMaterial.disableLighting=true;flashMaterial.disableDepthWrite=true;
      const ringMaterial=new StandardMaterial('bomb-explosion-ring-material',this.scene);ringMaterial.emissiveColor=new Color3(1,.18,.015);ringMaterial.diffuseColor=new Color3(1,.3,.025);ringMaterial.alpha=.88;ringMaterial.disableLighting=true;ringMaterial.disableDepthWrite=true;ringMaterial.zOffset=-1;
      this.explosionSphere.material=flashMaterial;this.explosionRing.material=ringMaterial;this.explosionMaterials=[flashMaterial,ringMaterial];
    }
    if(this.explosionSphere&&this.explosionRing&&this.explosionMaterials){
      const age=Math.max(0,renderTime-this.explosionStartedAt);const life=Math.max(0,1-age/1.25);
      this.explosionSphere.setEnabled(life>0);this.explosionRing.setEnabled(life>0);
      const flashScale=.5+age*3.2;this.explosionSphere.scaling.set(flashScale,flashScale*.72,flashScale);
      this.explosionRing.scaling.set(1+age*9,1,1+age*9);
      this.explosionMaterials[0].alpha=.9*life;this.explosionMaterials[1].alpha=.88*life;
    }
    const sniper=followed.equipped==='sniper'||followed.equipped==='scout';
    const zoom=effectiveMode==='first'&&!this.overviewEnabled&&followed.hp>0?(sniper&&followed.scopeState==='scoped'?(followed.scopeLevel===2?.16:.28):false):false;
    const activeView=this.overviewEnabled&&effectiveMode!=='free'?'overview':effectiveMode;
    const cameraKey=`${this.mapRuntime.id}:${activeView}:${activeView==='cinematic'?`film-${current.round}`:activeView==='tactical'||activeView==='overview'?'wide':followed.id}`,cut=cameraKey!==this.previousCamera||this.previousRound!==current.round;
    if(cut)this.fpMoveBlend=0;
    const blend=cut?1:1-Math.exp(-Math.max(0,Math.min(.1,elapsed))*9);
    const flight=this.freeControls.update(effectiveMode==='free',elapsed);
    const aspect=this.engine.getRenderWidth()/Math.max(1,this.engine.getRenderHeight());
    if(effectiveMode==='free'){
      this.camera.fov=1.1;this.camera.position.set(flight.x,flight.y,flight.z);
      this.camera.rotation.set(flight.pitch,flight.yaw,0);
    }else if(this.overviewEnabled){
      const pose=computeOverviewCameraPose(aspect,this.mapRuntime);
      this.camera.fov=mix(this.camera.fov,pose.fov,blend);
      this.scratchVecA.set(pose.position.x,pose.position.y,pose.position.z);
      Vector3.LerpToRef(this.camera.position,this.scratchVecA,blend,this.camera.position);
      this.scratchVecB.set(pose.target.x,pose.target.y,pose.target.z);
      Vector3.LerpToRef(this.cameraTarget,this.scratchVecB,blend,this.cameraTarget);
      this.camera.setTarget(this.cameraTarget);
    }else if(effectiveMode==='tactical'){
      const pose=computeTacticalCameraPose(decision.engagements?.length?decision.engagements:[followed],aspect,this.mapRuntime);
      this.camera.fov=mix(this.camera.fov,pose.fov,blend);
      this.scratchVecA.set(pose.position.x,pose.position.y,pose.position.z);
      Vector3.LerpToRef(this.camera.position,this.scratchVecA,blend,this.camera.position);
      this.scratchVecB.set(pose.target.x,pose.target.y,pose.target.z);
      Vector3.LerpToRef(this.cameraTarget,this.scratchVecB,blend,this.cameraTarget);
      this.camera.setTarget(this.cameraTarget);
    }else if(effectiveMode==='cinematic') {
      const cinematicPose=computeCinematicCameraPose(current.time,current.round,current.bomb.site??current.teams[current.attackTeam].site,this.mapRuntime);
      this.camera.fov=mix(this.camera.fov,cinematicPose.fov,blend);
      this.scratchVecA.set(cinematicPose.position.x,cinematicPose.position.y,cinematicPose.position.z);
      Vector3.LerpToRef(this.camera.position,this.scratchVecA,blend,this.camera.position);
      this.scratchVecB.set(cinematicPose.target.x,cinematicPose.target.y,cinematicPose.target.z);
      Vector3.LerpToRef(this.cameraTarget,this.scratchVecB,blend,this.cameraTarget);
      this.camera.setTarget(this.cameraTarget);
    } else this.followCamera(followed,effectiveMode==='first',blend,renderTime,zoom,mode==='director'&&current.phase==='freeze');
    this.previousCamera=cameraKey;this.previousRound=current.round;

    this.mainHiddenIds.clear();
    if(effectiveMode==='first' && !this.overviewEnabled && followed.hp>0) {
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
    this.mainFpEnabled=effectiveMode==='first' && !this.overviewEnabled && followed.hp>0;
    this.mainFollowedId=followed.id;
    this.mainMuzzleEnabled=false;
    if(this.mainFpEnabled) {
      const followedOp=this.actors.get(followed.id)?.operative;
      const fpForce=followed.attacking?'t':'ct';
      const variantIdx=followedOp?.variantIndex??playerVariants.get(followed.id)??resolveOperativeVariantIndex(fpForce,followed.id);
      const variantStyle=followedOp?.variantStyle??resolveOperativeStyle(fpForce,followed.id,variantIdx);
      if(!this.fpGunRoot || this.fpGunWeapon!==followed.equipped || this.fpGunTeam!==followed.team || this.fpGunAttacking!==followed.attacking || this.fpGunVariant!==variantIdx) {
        this.fpMuzzleFlash?.setEnabled(false);this.fpGunRoot?.setEnabled(false);
        const weapon=this.fpWeaponViews.get(`${followed.attacking}:${followed.team}:${followed.equipped}:${variantIdx}`,()=>{
          const root=createViewmodelMesh(followed.equipped,followed.team,'viewmodel-gun',this.scene,hex=>this.material(hex),followed.attacking,variantStyle);
          const muzzle=(root.metadata as WeaponViewMetadata|undefined)?.muzzle;
          return {root,flash:muzzle?this.createMuzzleFlash('fp-muzzle-flash',muzzle):undefined};
        });
        this.fpGunRoot=weapon.root;this.fpMuzzleFlash=weapon.flash;
        this.fpGunWeapon=followed.equipped;
        this.fpGunTeam=followed.team;
        this.fpGunAttacking=followed.attacking;
        this.fpGunVariant=variantIdx;
      }
      this.fpGunRoot.setEnabled(true);
      (this.fpGunRoot.metadata as WeaponViewMetadata|undefined)?.weaponRoot?.setEnabled(!(followed.throwAt!==undefined&&followed.throwKind===followed.equipped&&renderTime>=followed.throwAt+.2));
      const firing=Object.hasOwn(LIVE_WEAPONS,followed.equipped)&&renderTime>=followed.lastShot&&renderTime-followed.lastShot<.08;
      const swing=followed.equipped==='knife'?Math.sin(Math.min(1,Math.max(0,(renderTime-followed.lastSwing)/.35))*Math.PI):0;
      const throwElapsed=followed.throwAt===undefined?-1:renderTime-followed.throwAt;
      const throwPhase=throwElapsed<0||throwElapsed>.65?undefined:throwElapsed/.65;
      const throwLift=throwPhase===undefined?0:throwPhase<.3?ease01(throwPhase/.3):1-ease01((throwPhase-.3)/.7);
      const throwRelease=throwPhase===undefined||throwPhase<.3?0:1-ease01((throwPhase-.3)/.2);
      const draw=followed.utilityPrep?.phase==='pin'||followed.utilityPrep?.phase==='ready'?0:Math.min(1,followed.weaponReady/.45);
      const plant=followed.equipped==='bomb'?Math.min(1,followed.channel/3.2):0,pin=followed.utilityPrep?.phase==='pin'||followed.utilityPrep?.phase==='ready'?1:0;
      const fpStyle=followed.utilityPrep?.throwStyle??followed.throwStyle;
      const fpUnderhand=fpStyle==='underhand';
      const fpMedium=fpStyle==='medium';
      const reloadProgress=followed.reload>0?1-Math.max(0,Math.min(1,followed.reload/(followed.reloadDuration||LIVE_WEAPONS[followed.weapon].reload))):0;
      const reload=followed.reload>0?Math.sin(reloadProgress*Math.PI):0;
      const reloadParts=(this.fpGunRoot.metadata as {reloadParts?:ViewmodelReloadParts}|undefined)?.reloadParts;
      const isShellReload=reloadParts?.family==='shotgun_tube';
      const fpInsert=followed.reload>0&&!isShellReload&&reloadProgress>=.52&&reloadProgress<.74?ease01((reloadProgress-.52)/.22):0;
      const fpSlap=followed.reload>0&&!isShellReload&&reloadProgress>=.72&&reloadProgress<.82?Math.sin(((reloadProgress-.72)/.10)*Math.PI):0;
      const fpRack=followed.reload>0&&reloadProgress>=.81&&reloadProgress<.97?Math.sin(((reloadProgress-.81)/.16)*Math.PI):0;
      let fpReloadRoll=reload*.42;
      let fpReloadPitch=reload*.34;
      let fpReloadLift=0;
      let fpReloadPull=0;
      if(reloadParts){
        const inReloadMotion=followed.reload>0&&reloadProgress>.04&&reloadProgress<.97;
        for(const mesh of reloadParts.leftArmMeshes)mesh.setEnabled(!inReloadMotion);
        reloadParts.arm.setEnabled(inReloadMotion);
        const [mhX,mhY,mhZ]=reloadParts.magHome;
        if(inReloadMotion&&isShellReload){
          const inFeed=reloadProgress>=.10&&reloadProgress<.81;
          const shellFrac=inFeed?(((reloadProgress-.10)/.71)*3)%1:0;
          const feedBlend=inFeed?Math.sin(Math.min(1,shellFrac/.82)*Math.PI):0;
          const pushPulse=inFeed&&shellFrac>=.40&&shellFrac<.74?Math.sin(((shellFrac-.40)/.34)*Math.PI):0;
          reloadParts.magazine.setEnabled(inFeed&&shellFrac<.76);
          reloadParts.magazine.position.set(mix(-.20,mhX-.02,feedBlend),mix(-.26,mhY+.02*pushPulse,feedBlend),mix(-.04,mhZ-.03,feedBlend));
          reloadParts.magazine.rotation.set(mix(.35,Math.PI/2,feedBlend),0,mix(-.4,0,feedBlend));
          if(fpRack>0){
            reloadParts.arm.position.set(mhX-.04,mhY+.01,mhZ+.14-.10*fpRack);
            reloadParts.arm.rotation.set(-.22,.16,0);
            reloadParts.wrist.rotation.set(-.15*fpRack,0,.15);
          }else{
            reloadParts.arm.position.set(mix(-.22,mhX-.05,feedBlend),mix(-.26,mhY-.03+pushPulse*.035,feedBlend),mix(-.06,mhZ-.06,feedBlend));
            reloadParts.arm.rotation.set(-.32*feedBlend,.24*feedBlend,0);
            reloadParts.wrist.rotation.set(.32*pushPulse,.15*feedBlend,.25);
          }
          fpReloadRoll=reload*.48+pushPulse*.06-.10*fpRack;
          fpReloadPitch=reload*.28-.06*pushPulse+.12*fpRack;
          fpReloadLift=-.02*pushPulse;
          fpReloadPull=.04*fpRack;
        }else if(inReloadMotion){
          const pouchPos:readonly [number,number,number]=[-.25,-.26,-.08];
          const unseat=reloadProgress<.22?ease01((reloadProgress-.04)/.18):1;
          const toPouch=reloadProgress>=.20&&reloadProgress<.54?Math.sin(((reloadProgress-.20)/.34)*Math.PI):0;
          const seat=fpInsert;
          const magVisible=followed.reload>0&&reloadProgress>.08&&reloadProgress<.76&&(reloadProgress<.28||reloadProgress>.38);
          reloadParts.magazine.setEnabled(magVisible);
          const isAk=reloadParts.family==='rifle_ak';
          if(reloadProgress<.52){
            const dropRatio=ease01(Math.max(0,(reloadProgress-.08)/.42));
            const curX=mix(mhX,pouchPos[0],Math.max(0,(dropRatio-.35)/.65));
            const curY=mhY-.06-.28*dropRatio;
            const curZ=mix(mhZ,pouchPos[2],Math.max(0,(dropRatio-.35)/.65))+(isAk?.03*unseat:0);
            reloadParts.magazine.position.set(curX,curY,curZ);
            reloadParts.magazine.rotation.set((isAk?.42:.18)*dropRatio,.05*dropRatio,-.18*toPouch);
          }else{
            const rise=fpInsert;
            reloadParts.magazine.position.set(mix(pouchPos[0],mhX,rise),mix(pouchPos[1]+.02,mhY-.02,rise)+fpSlap*.032,mix(pouchPos[2],mhZ,rise));
            reloadParts.magazine.rotation.set((isAk?.46*(1-rise):.22*(1-rise)),0,-.22*(1-rise));
          }
          if(fpRack>0){
            const akOrSniper=reloadParts.family==='rifle_ak'||reloadParts.family==='sniper';
            const rackStart:[number,number,number]=akOrSniper?[mhX+.05,.045,mhZ-.02]:[-.075,.042,mhZ-.05];
            reloadParts.arm.position.set(rackStart[0],rackStart[1],rackStart[2]-.095*fpRack);
            reloadParts.arm.rotation.set(-.18-.18*fpRack,akOrSniper?-.28:.22,akOrSniper?-.35:.18);
            reloadParts.wrist.rotation.set(-.22*fpRack,akOrSniper?.25:-.15,0);
          }else{
            let handX:number,handY:number,handZ:number;
            if(reloadProgress<.22){
              handX=mix(-.12,mhX-.03,unseat);handY=mix(-.18,mhY-.06,unseat);handZ=mix(.14,mhZ-.03,unseat);
            }else if(reloadProgress<.54){
              handX=mix(mhX-.03,pouchPos[0],toPouch);handY=mix(mhY-.08,pouchPos[1],toPouch);handZ=mix(mhZ-.03,pouchPos[2],toPouch);
            }else if(reloadProgress<.81){
              handX=mix(pouchPos[0],mhX-.03,seat);handY=mix(pouchPos[1],mhY-.07+fpSlap*.045,seat);handZ=mix(pouchPos[2],mhZ-.03,seat);
            }else{
              const ret=ease01((reloadProgress-.94)/.04);
              handX=mix(mhX-.03,-.10,ret);handY=mix(mhY-.06,-.16,ret);handZ=mix(mhZ-.02,.14,ret);
            }
            reloadParts.arm.position.set(handX,handY,handZ);
            reloadParts.arm.rotation.set(-.34*unseat-.24*toPouch+.14*fpSlap,.22*unseat,.18*toPouch-.24*fpSlap);
            reloadParts.wrist.rotation.set(fpSlap*.42+.20*(1-seat),-.14*toPouch,.15*fpSlap);
          }
          fpReloadRoll=reload*.38+toPouch*.24-fpSlap*.16-.12*fpRack;
          fpReloadPitch=reload*.30+toPouch*.10-fpSlap*.10+.15*fpRack;
          fpReloadLift=-fpSlap*.028;
          fpReloadPull=fpRack*.055;
        }else{
          reloadParts.magazine.setEnabled(false);
        }
      }
      const sinceShot=renderTime-followed.lastShot,pulse=sinceShot>=0?Math.exp(-sinceShot*24):0;
      const kick=Object.hasOwn(LIVE_WEAPONS,followed.equipped)?.045*pulse:0;
      const kickPitch=Object.hasOwn(LIVE_WEAPONS,followed.equipped)?.035*pulse:0;
      const fpBolt=(followed.equipped==='sniper'||followed.equipped==='scout')&&(followed.scopeState==='cycling'||(sinceShot>=.16&&sinceShot<.92))
        ?(followed.scopeState==='cycling'?.65:Math.sin(((sinceShot-.16)/.76)*Math.PI)):0;
      const fpPump=(followed.equipped==='nova'||followed.equipped==='mag7')&&sinceShot>=.14&&sinceShot<.62
        ?Math.sin(((sinceShot-.14)/.48)*Math.PI):0;

      const fwd=this.cameraTarget.subtract(this.camera.position).normalize();
      const right=Vector3.Cross(Vector3.Up(),fwd).normalize();
      const up=Vector3.Cross(fwd,right).normalize();

      const underhandOffset=fpUnderhand?(pin*.09+throwLift*.14-throwRelease*.14):0;
      const overhandLift=!fpUnderhand&&!fpMedium?(pin*.04+throwLift*.06):0;
      const targetFpMove=Math.max(0,Math.min(1,(followed.speed-.25)/2.6))*((followed.jumpY??0)>.02?.2:1);
      const fpDt=Math.max(0,Math.min(.1,elapsed));
      this.fpMoveBlend=mix(this.fpMoveBlend,targetFpMove,1-Math.exp(-fpDt*8));
      const fpPullBack=this.fpMoveBlend*.016;
      const fpDrop=this.fpMoveBlend*.005;
      const vp=this.camera.position
        .add(right.scale(.22-swing*.2-(fpMedium?throwLift*.08-throwRelease*.12:0)))
        .subtract(up.scale(.18+fpDrop+draw*.25+reload*.13+fpReloadLift+underhandOffset-overhandLift+fpPump*.03))
        .add(fwd.scale(.42-fpPullBack-kick+swing*.18-fpReloadPull-fpPump*.05));

      this.fpGunRoot.position.copyFrom(vp);
      this.fpGunRoot.rotation.y=followed.yaw+(followed.recoilYaw??0)*.35-(fpMedium?throwLift*.25-throwRelease*.4:0);
      const throwPitchOffset=fpUnderhand?(pin*.22+throwLift*.36-throwRelease*.64):fpMedium?(pin*.06-throwRelease*.35):(-pin*.16-throwLift*.34+throwRelease*.74);
      this.fpGunRoot.rotation.x=-(followed.pitch??0)-kickPitch-(followed.recoilPitch??0)*.4+draw*.5+fpReloadPitch+fpSlap*.08+plant*.3+throwPitchOffset;
      this.fpGunRoot.rotation.z=swing*1.1+fpReloadRoll+fpBolt*.48+(fpUnderhand?(throwLift*.14-throwRelease*.24):(-throwLift*.22+throwRelease*.36));

      const muzzle=(this.fpGunRoot.metadata as WeaponViewMetadata|undefined)?.muzzle;
      if(!this.fpMuzzleFlash&&muzzle)this.fpMuzzleFlash=this.createMuzzleFlash('fp-muzzle-flash',muzzle);
      this.mainMuzzleEnabled=firing&&!!this.fpMuzzleFlash;
      this.fpMuzzleFlash?.setEnabled(this.mainMuzzleEnabled);
    } else {
      this.fpMoveBlend=0;
      this.fpGunRoot?.setEnabled(false);
      this.fpMuzzleFlash?.setEnabled(false);
    }
    this.prewarmNextViewmodel(players,playerVariants,current.round);
    // Resolve both views after their weapon poses, recoil and camera transforms.
    this.updateShotTracers({...current,time:renderTime});
    if (showLineups) {
      this.updateGrenadeLineups(current, renderTime);
    } else {
      this.clearGrenadeLineups();
    }
    this.updateBloodMarks(current);

    // Secondary Bomb-Plant PIP camera: strictly active only during C4 plant/settle beat, and never when main cam already watches the planter.
    const watchingPlanter = Boolean(decision.pip.planterId && decision.followedId === decision.pip.planterId && (effectiveMode === 'first' || effectiveMode === 'third'));
    const pipShouldRender = effectiveMode !== 'free' && allowPip && decision.pip.active && !watchingPlanter && this.pipViewport !== null;
    if(decision.pip.active) {
      const pipPose=computeBombPlantPipPose(decision.pip,players,this.mapRuntime);
      const pipKey=`${current.round}:${decision.pip.site??''}:${decision.pip.planterId??''}`;
      const pipCut=pipKey!==this.previousPipKey;
      const pipBlend=pipCut?1:1-Math.exp(-Math.max(0,Math.min(.1,elapsed))*7);
      this.scratchVecA.set(pipPose.position.x,pipPose.position.y,pipPose.position.z);
      this.scratchVecB.set(pipPose.target.x,pipPose.target.y,pipPose.target.z);
      Vector3.LerpToRef(this.pipCamera.position,this.scratchVecA,pipBlend,this.pipCamera.position);
      Vector3.LerpToRef(this.pipTarget,this.scratchVecB,pipBlend,this.pipTarget);
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

    if(elapsed>0&&elapsed<.25)this.frameAverage=this.frameAverage*.96+elapsed*.04;
    if(current.time-this.qualityAt>2){
      this.qualityAt=current.time;
      const base=Math.max(1,window.devicePixelRatio||1),scale=this.engine.getHardwareScalingLevel();
      if(this.frameAverage>1/38&&scale<base*1.8)this.engine.setHardwareScalingLevel(Math.min(base*1.8,scale*1.12));
      else if(this.frameAverage<1/58&&scale>base)this.engine.setHardwareScalingLevel(Math.max(base,scale/1.08));
    }
    this.scene.render();
    return decision;
  }
  private followCamera(player:LivePlayer,first:boolean,blend:number,_time:number,zoom:number|false,freezeShowcase=false) {
    const jumpOffset=player.jumpY??0;
    const b=this.mapRuntime.definition.bounds;
    const clampedX=Math.max(b.clampMinX,Math.min(b.clampMaxX,player.x));
    const clampedZ=Math.max(b.clampMinZ,Math.min(b.clampMaxZ,player.z));
    if(first){
      const eyeY=player.crouch?1.08:1.6;
      this.currentEyeY=eyeY;
      const eyeWorld=jumpOffset+eyeY;
      this.camera.fov=zoom?zoom:1.12;
      this.camera.position.set(clampedX,eyeWorld,clampedZ);
      const pitch=(player.pitch??0)+(player.recoilPitch??0),yaw=player.yaw+(player.recoilYaw??0),horizontal=Math.cos(pitch)*20;
      this.cameraTarget.set(clampedX+Math.sin(yaw)*horizontal,eyeWorld+Math.sin(pitch)*20,clampedZ+Math.cos(yaw)*horizontal);
      this.camera.setTarget(this.cameraTarget);
      return;
    }
    const pose=freezeShowcase?computeFreezeShowcasePose(player,_time,this.mapRuntime):computeThirdPersonCameraPose(player,this.mapRuntime);
    const trackBlend=blend>=1?1:Math.min(1,blend*1.85);
    this.camera.fov=mix(this.camera.fov,pose.fov,trackBlend);
    this.scratchVecA.set(pose.position.x,pose.position.y,pose.position.z);
    Vector3.LerpToRef(this.camera.position,this.scratchVecA,trackBlend,this.scratchVecB);
    // Keep camera close to the model's back without letting lerp sweep through a wall corner.
    const eyeY=(player.crouch?1.08:1.6)+(player.jumpY??0);
    const hitsWall=(w:typeof this.mapRuntime.definition.solids[number])=>eyeY>=(w.baseY??0)-.22&&eyeY<=w.height+.22&&segmentHitsWall(player,{x:this.scratchVecB.x,z:this.scratchVecB.z},w,.22);
    const crosses=this.mapRuntime.definition.solids.some(hitsWall)||this.mapRuntime.terrain.terrainSolids.some(hitsWall);
    this.camera.position.copyFrom(crosses?this.scratchVecA:this.scratchVecB);
    this.scratchVecC.set(pose.target.x,pose.target.y,pose.target.z);
    Vector3.LerpToRef(this.cameraTarget,this.scratchVecC,Math.min(1,trackBlend*1.2),this.cameraTarget);
    this.camera.setTarget(this.cameraTarget);
  }
  /** Incrementally build at most one uncached FP viewmodel per frame to prevent POV switch hitches. */
  private prewarmNextViewmodel(players:readonly LivePlayer[],playerVariants:Map<string,number>,round:number):void {
    const sig=`${round}:${players.map(p=>`${p.id}:${p.equipped}:${p.primaryWeapon ?? ''}:${p.secondaryWeapon ?? ''}`).join('|')}`;
    if(this.prewarmedSig===sig)return;
    for(const player of players){
      const force=player.attacking?'t':'ct';
      const op=this.actors.get(player.id)?.operative;
      const variantIdx=op?.variantIndex??playerVariants.get(player.id)??resolveOperativeVariantIndex(force,player.id);
      const variantStyle=op?.variantStyle??resolveOperativeStyle(force,player.id,variantIdx);
      const candidates:LiveEquippedWeapon[]=[player.equipped,'knife'];
      if(player.primaryWeapon)candidates.push(player.primaryWeapon);
      if(player.secondaryWeapon)candidates.push(player.secondaryWeapon);
      for(const eq of candidates){
        const key=`${player.attacking}:${player.team}:${eq}:${variantIdx}`;
        if(!this.fpWeaponViews.has(key)){
          this.fpWeaponViews.get(key,()=>{
            const root=createViewmodelMesh(eq,player.team,'viewmodel-gun',this.scene,hex=>this.material(hex),player.attacking,variantStyle);
            root.setEnabled(false);
            const muzzle=(root.metadata as WeaponViewMetadata|undefined)?.muzzle;
            const flash=muzzle?this.createMuzzleFlash('fp-muzzle-flash',muzzle):undefined;
            flash?.setEnabled(false);
            return {root,flash};
          });
          return;
        }
      }
    }
    this.prewarmedSig=sig;
  }
  dispose() {
    if(this.disposed)return;this.disposed=true;this.resize.disconnect();
    this.clearMapEnvironment();
    this.shadows.dispose();
    this.freeControls.dispose();
    this.fpWeaponViews.clear();
    for(const item of this.droppedMeshes.values()){item.root.dispose();item.ring.dispose();}
    this.droppedMeshes.clear();
    for(const view of this.corpseViews.values())if(!view.borrowed)view.operative.root.dispose();this.corpseViews.clear();
    for(const mesh of this.utilityDrops.values())mesh.dispose();this.utilityDrops.clear();this.deviceClock?.dispose();
    for(const mesh of this.grenades.values())mesh.dispose();this.grenades.clear();
    this.clearGrenadeLineups();
    for(const view of this.bloodMeshes.values())for(const splat of view.splats)splat.dispose();
    this.bloodMeshes.clear();for(const material of this.bloodMaterials)material.dispose();this.bloodMaterials=[];
    for(const view of this.actors.values()){
      view.operative.root.dispose();
      if(view.weaponViews)view.weaponViews.clear();else view.gunNode?.dispose();
    }
    this.scene.dispose();this.engine.dispose();
  }
}
