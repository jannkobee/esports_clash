import { Mesh, Vector3, VertexBuffer, VertexData, type TransformNode } from '@babylonjs/core';
import { liveSprayOffset } from './fpsLiveGunplay.ts';
import { LIVE_WEAPONS, type LiveEquippedWeapon, type LiveWeapon } from './fpsLiveWeapons.ts';

/**
 * Display-only operative shaping and motion helpers. Nothing here feeds back into the simulation: hitboxes,
 * collision and sight checks are computed from player state in `fpsLiveSimulation.ts`, never from these meshes.
 */

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const pos = (n: number) => Math.max(0, n);
const bump = (t: number, centre: number, width: number) => {
  const u = (t - centre) / Math.max(1e-4, width);
  return Math.abs(u) >= 1 ? 0 : (1 - u * u) * (1 - u * u);
};

/** Anatomical profile along a segment, t = 0 at its bottom and 1 at its top. */
export interface OperativeSegmentProfile {
  /** Width multiplier (x). */ width: (t: number) => number;
  /** Depth multiplier (z). */ depth: (t: number) => number;
  /** Forward (+z) offset in metres before mesh scaling. */ forward?: (t: number) => number;
  /** Lateral shift in metres before mesh scaling (multiplied by `side`). */ lateral?: (t: number) => number;
  /**
   * 3D cross-sectional asymmetry along normalized radial directions: `nx` is outer/lateral
   * (`+1`) vs inner/medial (`-1`) once multiplied by `side`; `nz` is anterior (`+1`) vs posterior (`-1`).
   */
  harmonic?: (t: number, nx: number, nz: number) => { rx?: number; rz?: number; dy?: number };
}

export const OPERATIVE_SEGMENT_PROFILES = {
  /** Athletic 3D human torso: sculpted pecs, sternal dip, obliques, lats/scapulae, spinal furrow & waist taper. */
  torso: {
    width: (t: number) =>
      .92 + .125 * bump(t, .68, .40) - .065 * bump(t, .29, .18) - .07 * clamp01((t - .90) / .10) + .045 * bump(t, .09, .14),
    depth: (t: number) =>
      .88 + .175 * bump(t, .64, .38) - .07 * bump(t, .28, .18) - .06 * clamp01((t - .92) / .08),
    forward: (t: number) => .014 * bump(t, .64, .28) - .007 * bump(t, .22, .18) - .004 * bump(t, .88, .16),
    harmonic: (t, nx, nz) => {
      const front = pos(nz), back = pos(-nz), absX = Math.abs(nx);
      // Pectoralis major swell on upper-front chest with subtle central sternum valley & costal/oblique taper below
      const pec = bump(t, .68, .18) * front * (1 - .08 * bump(absX, 0, .28)) * .115;
      const absContour = bump(t, .41, .19) * front * (1 - .04 * bump(absX, 0, .22)) * .05;
      const beltTuck = -.035 * bump(t, .22, .09);
      // Posterior scapula/latissimus volume + midline erector spinae furrow + gluteal tie-in
      const lats = bump(t, .70, .22) * back * bump(absX, .50, .44) * .11;
      const spineFurrow = -bump(t, .58, .34) * back * bump(absX, 0, .28) * .085;
      const glutes = bump(t, .10, .13) * back * bump(absX, .44, .44) * .095;
      const serratus = bump(t, .72, .24) * bump(absX, .85, .30) * .055;
      return {
        rx: 1 + lats * .45 + serratus + beltTuck * .7,
        rz: 1 + pec + absContour + lats * .65 + spineFurrow + glutes + beltTuck,
      };
    },
  },
  /** Asymmetric 3D thigh: rectus femoris, sweeping vastus lateralis, teardrop vastus medialis & hamstring curve. */
  thigh: {
    width: (t: number) => .92 + .115 * bump(t, .62, .44) - .04 * bump(t, .12, .10),
    depth: (t: number) => .90 + .135 * bump(t, .58, .42) - .03 * bump(t, .11, .09),
    forward: (t: number) => .009 * bump(t, .56, .38),
    harmonic: (t, nx, nz) => {
      const front = pos(nz), back = pos(-nz), outer = pos(nx), inner = pos(-nx);
      const rectus = front * bump(t, .55, .38) * .105;
      const vastusLat = outer * bump(t, .56, .34) * .095;
      const vastusMed = inner * clamp01((nz + .35) / 1.35) * bump(t, .32, .22) * .085;
      const hamstring = back * bump(t, .70, .28) * .075;
      const kneeCrease = -.032 * bump(t, .11, .08);
      return {
        rx: 1 + vastusLat + vastusMed + kneeCrease,
        rz: 1 + rectus + hamstring + kneeCrease,
      };
    },
  },
  /** Asymmetric lower leg: dual-headed gastrocnemius calf belly, tibial crest, Achilles taper & trouser cuffing. */
  shin: {
    width: (t: number) => .87 + .135 * bump(t, .70, .36) + .05 * bump(t, .13, .08),
    depth: (t: number) => .89 + .175 * bump(t, .72, .32) + .045 * bump(t, .13, .08),
    forward: (t: number) => -.011 * bump(t, .68, .32) + .004 * bump(t, .13, .09),
    harmonic: (t, nx, nz) => {
      const back = pos(-nz), front = pos(nz), outer = pos(nx), inner = pos(-nx);
      const gastrocLat = back * outer * bump(t, .72, .22) * .10;
      const gastrocMed = back * inner * bump(t, .66, .22) * .125;
      const calfSplit = -back * bump(Math.abs(nx), 0, .24) * bump(t, .70, .20) * .035;
      const tibialCrest = front * bump(t, .52, .38) * .06;
      const blousedCuff = bump(t, .13, .075) * .07;
      return {
        rx: 1 + gastrocLat * .55 + gastrocMed * .65 - tibialCrest * .25 + blousedCuff,
        rz: 1 + gastrocLat * .8 + gastrocMed * .85 + calfSplit + tibialCrest + blousedCuff * .8,
      };
    },
  },
  /** Lateral deltoid cap, anterior biceps peak & posterior triceps horseshoe. */
  upperArm: {
    width: (t: number) => .93 + .095 * bump(t, .54, .44),
    depth: (t: number) => .93 + .135 * bump(t, .56, .42),
    lateral: (t: number) => .004 * bump(t, .78, .22),
    harmonic: (t, nx, nz) => {
      const outer = pos(nx), front = pos(nz), back = pos(-nz);
      const deltoid = outer * bump(t, .78, .22) * .135;
      const biceps = front * bump(t, .46, .28) * .10;
      const triceps = back * bump(t, .56, .28) * .095;
      const sleeveFold = bump(t, .20, .09) * .045;
      return {
        rx: 1 + deltoid + sleeveFold,
        rz: 1 + biceps + triceps + deltoid * .3 + sleeveFold,
      };
    },
  },
  /** Brachioradialis outer ridge below elbow tapering into an oval anatomical wrist. */
  forearm: {
    width: (t: number) => .86 + .175 * bump(t, .78, .36) + .05 * bump(t, .10, .14),
    depth: (t: number) => .88 + .135 * bump(t, .76, .38) - .09 * bump(t, .10, .16),
    harmonic: (t, nx, nz) => {
      const brachio = pos(nx * .65 + nz * .75) * bump(t, .76, .24) * .115;
      const flexors = pos(-nx * .4 - nz * .6) * bump(t, .68, .26) * .085;
      const wristOval = bump(t, .08, .14);
      return {
        rx: 1 + brachio * .75 + flexors * .5 + wristOval * .06,
        rz: 1 + brachio * .5 + flexors * .65 - wristOval * .08,
      };
    },
  },
} satisfies Record<string, OperativeSegmentProfile>;

/** Reshape a vertical limb/torso/head segment with 3D anatomical asymmetry and recompute smooth normals. */
export function sculptOperativeSegment(mesh: Mesh, profile: OperativeSegmentProfile, side = 1): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  if (!positions || !indices) return;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < positions.length; i += 3) { minY = Math.min(minY, positions[i]); maxY = Math.max(maxY, positions[i]); }
  const span = Math.max(1e-6, maxY - minY);
  for (let i = 0; i < positions.length; i += 3) {
    const x0 = positions[i], z0 = positions[i + 2];
    const t = clamp01((positions[i + 1] - minY) / span);
    const r = Math.hypot(x0, z0);
    const nx = r > 1e-5 ? (x0 * side) / r : 0;
    const nz = r > 1e-5 ? z0 / r : 0;
    const harm = profile.harmonic?.(t, nx, nz);
    const rx = harm?.rx ?? 1, rz = harm?.rz ?? 1, dy = harm?.dy ?? 0;
    positions[i] = x0 * profile.width(t) * rx + side * (profile.lateral?.(t) ?? 0);
    if (dy) positions[i + 1] += dy;
    positions[i + 2] = z0 * profile.depth(t) * rz + (profile.forward?.(t) ?? 0);
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
  mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
  mesh.refreshBoundingInfo();
}

export interface OperativeGaitPose {
  leftHip: number; rightHip: number; leftKnee: number; rightKnee: number;
  leftSpread: number; rightSpread: number; pelvisRoll: number;
}

/**
 * Gait from the travel-driven stride phase. The thigh moves at a near-constant rate through stance (so the
 * planted foot does not skate) and swings forward with a tucked knee; jogging tucks more than walking.
 * Strafing alternates a lead-leg step out with a trailing close-in instead of scissoring forward.
 */
export function operativeGaitPose(phase: number, walkAmount: number, runAmount: number, crouch: number, lateral: number): OperativeGaitPose {
  const shuffle = clamp01(Math.abs(lateral));
  const sagittal = walkAmount * (1 - crouch * .45) * (1 - shuffle * .72);
  const hipAmp = .48 * sagittal;
  const leg = (p: number) => {
    const s = Math.sin(p), tri = (2 / Math.PI) * Math.asin(Math.max(-1, Math.min(1, s)));
    const hip = hipAmp * (s * .55 + tri * .45);
    // Positive hip = foot behind. Swing (thigh travelling forward) is where cos < 0; the knee tucks most
    // just after toe-off, then extends for heel strike and takes a small loading flex in early stance.
    const swing = Math.max(0, -Math.cos(p + .3));
    const tuck = (.5 + runAmount * .6) * Math.pow(swing, 1.35);
    const loading = .1 * Math.pow(Math.max(0, -Math.sin(p - .4)), 3) * (1 - runAmount * .4);
    return {hip, knee: sagittal * (tuck + loading + .04)};
  };
  const left = leg(phase), right = leg(phase + Math.PI);
  const open = .5 + .5 * Math.sin(phase);
  const dir = lateral >= 0 ? 1 : -1, side = shuffle * walkAmount * (1 - crouch * .5);
  const lead = .2 * open * side, close = .12 * (1 - open) * side;
  return {
    leftHip: left.hip, rightHip: right.hip, leftKnee: left.knee, rightKnee: right.knee,
    leftSpread: dir > 0 ? close : -lead, rightSpread: dir > 0 ? lead : -close,
    pelvisRoll: .012 * Math.sin(phase) * walkAmount * (1 - shuffle) * (1 - crouch * .6),
  };
}

/** Third-person draw/holster pose (0 = ready, 1 = fully lowered at the start of an equip). */
export function operativeDrawPose(weaponReady: number, pistol: boolean): {drop: number; out: number; back: number; cant: number; tilt: number; yaw: number} {
  const e = clamp01(weaponReady / .35), s = e * e * (3 - 2 * e);
  return pistol
    ? {drop: .16 * s, out: .035 * s, back: .06 * s, cant: .25 * s, tilt: .2 * s, yaw: .1 * s}
    : {drop: .1 * s, out: .03 * s, back: .05 * s, cant: .42 * s, tilt: 0, yaw: .25 * s};
}

export interface LiveViewmodelKick {
  push: number;
  pitch: number;
  roll: number;
  yawKick: number;
  decay: number;
  chatter: number;
  slideTravel: number;
}

const kickCache = new Map<string, LiveViewmodelKick>();
/**
 * Visual kick and mechanical recoil signature per weapon, derived from weapon class and spray pattern so
 * first-person and third-person viewmodels punch authentically (AWP/Shotgun > Deagle > AK > M4A1-S > SMG).
 */
export function liveViewmodelKick(weapon: LiveEquippedWeapon): LiveViewmodelKick {
  const cached = kickCache.get(weapon);
  if (cached) return cached;
  let result: LiveViewmodelKick = {push: .02, pitch: .02, roll: .03, yawKick: .012, decay: 24, chatter: .006, slideTravel: 0};
  if (Object.hasOwn(LIVE_WEAPONS, weapon)) {
    const w = weapon as LiveWeapon;
    const cat = LIVE_WEAPONS[w].category;
    const step = Math.max(liveSprayOffset(w, 1).pitch, liveSprayOffset(w, 4).pitch - liveSprayOffset(w, 3).pitch);
    if (cat === 'sniper') {
      const heavy = w === 'sniper';
      result = {push: heavy ? .078 : .056, pitch: heavy ? .125 : .085, roll: heavy ? .08 : .055, yawKick: .025, decay: heavy ? 13 : 16, chatter: 0, slideTravel: 0};
    } else if (cat === 'shotgun') {
      result = {push: .082, pitch: .13, roll: .095, yawKick: .032, decay: 12, chatter: 0, slideTravel: 0};
    } else if (w === 'deagle') {
      result = {push: .068, pitch: .14, roll: .11, yawKick: .036, decay: 15, chatter: .008, slideTravel: .036};
    } else if (cat === 'pistol') {
      const auto = w === 'cz75' || w === 'tec9';
      const suppressed = w === 'usp_s';
      result = {
        push: Math.min(.042, .016 + step * 1.1),
        pitch: Math.min(.06, .018 + step * (suppressed ? 1.15 : 1.45)),
        roll: suppressed ? .026 : auto ? .046 : .036,
        yawKick: auto ? .018 : .011,
        decay: suppressed ? 29 : 26,
        chatter: auto ? .012 : .004,
        slideTravel: suppressed ? .025 : .03,
      };
    } else if (w === 'negev') {
      result = {push: .042, pitch: .054, roll: .058, yawKick: .03, decay: 22, chatter: .022, slideTravel: 0};
    } else if (cat === 'smg') {
      result = {push: Math.min(.032, .014 + step * .9), pitch: Math.min(.04, .015 + step * 1.3), roll: .032, yawKick: .018, decay: 32, chatter: .011, slideTravel: 0};
    } else {
      const suppressed = w === 'm4a1_s' || w === 'budget_ct';
      const heavyRifle = w === 'ak47' || w === 'rifle';
      result = {
        push: Math.min(.06, (heavyRifle ? .032 : suppressed ? .02 : .026) + step * 1.25),
        pitch: Math.min(.09, (heavyRifle ? .042 : suppressed ? .024 : .032) + step * 1.85),
        roll: heavyRifle ? .068 : suppressed ? .036 : .052,
        yawKick: heavyRifle ? .028 : suppressed ? .015 : .021,
        decay: heavyRifle ? 19 : suppressed ? 25 : 22,
        chatter: heavyRifle ? .015 : suppressed ? .008 : .011,
        slideTravel: 0,
      };
    }
  }
  kickCache.set(weapon, result);
  return result;
}

/** World-space joint frame for a ragdoll bone: local -Y runs from `from` to `to`, +Z faces `forward`. */
export function orientOperativeBone(pivot: TransformNode, from: Vector3, to: Vector3, forward: Vector3, scratch: {x: Vector3; y: Vector3; z: Vector3}): void {
  const y = scratch.y.copyFrom(from).subtractInPlace(to);
  if (y.lengthSquared() < 1e-10) y.set(0, 1, 0);
  y.normalize();
  const z = scratch.z.copyFrom(forward);
  z.subtractInPlace(scratch.x.copyFrom(y).scaleInPlace(Vector3.Dot(z, y)));
  if (z.lengthSquared() < 1e-8) {
    // Forward is parallel to the bone: fall back to any perpendicular axis.
    z.set(Math.abs(y.y) < .9 ? 0 : 1, Math.abs(y.y) < .9 ? 1 : 0, 0);
    z.subtractInPlace(scratch.x.copyFrom(y).scaleInPlace(Vector3.Dot(z, y)));
  }
  z.normalize();
  const x = Vector3.CrossToRef(y, z, scratch.x);
  pivot.position.copyFrom(from);
  Vector3.RotationFromAxisToRef(x, y, z, pivot.rotation);
}
