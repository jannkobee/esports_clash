import type { LiveWeapon } from './fpsLiveWeapons.ts';
import { LIVE_WEAPONS } from './fpsLiveWeapons.ts';

/**
 * Counter-Strike-style gunplay for the live exhibition.
 *
 * Aim: bots move a crosshair the way a hand moves a mouse. A fast ballistic flick that can overshoot or
 * undershoot, then small corrective adjustments, each limited by reaction speed and carrying error that
 * grows with the size of the movement. A moving target is only partly followed. Nothing locks onto a head.
 *
 * Recoil: every gun has a fixed spray pattern (the same bullet-by-bullet path every spray). The shooter
 * pulls against it from memory as well as their recoil control allows; whatever they fail to cancel goes
 * into the bullet. The pattern resets when the trigger is released for long enough.
 */

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const gauss = (random: () => number) => (random() + random() + random() - 1.5) * 1.414;

export interface LiveAimSkills {
  /** Speed and accuracy of large ballistic movements. */ flick: number;
  /** How much of a moving target's motion the hand follows. */ tracking: number;
  /** Size of the final error and how fine the corrections are. */ precision: number;
  /** Time between corrective adjustments. */ reactions: number;
  /** Steadiness under pressure. */ composure: number;
}

export interface LiveManualAim {
  targetId: string;
  /** Crosshair error relative to the intended aim point, in radians. */
  errYaw: number; errPitch: number;
  /** Current corrective movement: interpolates the planned part of the error. */
  fromYaw: number; fromPitch: number; toYaw: number; toPitch: number; moveStart: number; moveEnd: number;
  /** Target motion the hand did not follow since the movement started. */
  lagYaw: number; lagPitch: number;
  nextAdjustAt: number;
  lastDesiredYaw: number; lastDesiredPitch: number;
  adjustments: number;
  /** Last step timestamp and human hand-pan angular velocity (rad/s) updated at visual sample intervals. */
  lastStepAt?: number;
  velYaw?: number; velPitch?: number;
  prevSensedYaw?: number; prevSensedPitch?: number; prevSensedAt?: number;
}

export function startLiveManualAim(targetId: string, viewYaw: number, viewPitch: number, desiredYaw: number, desiredPitch: number, now: number, perceptionDelay: number): LiveManualAim {
  const errYaw = wrap(viewYaw - desiredYaw), errPitch = viewPitch - desiredPitch;
  return {targetId, errYaw, errPitch, fromYaw: errYaw, fromPitch: errPitch, toYaw: errYaw, toPitch: errPitch, moveStart: now, moveEnd: now,
    lagYaw: 0, lagPitch: 0, nextAdjustAt: now + Math.max(0, perceptionDelay), lastDesiredYaw: desiredYaw, lastDesiredPitch: desiredPitch, adjustments: 0,
    lastStepAt: now, velYaw: 0, velPitch: 0, prevSensedYaw: desiredYaw, prevSensedPitch: desiredPitch, prevSensedAt: now};
}

export interface LiveManualAimStep { yaw: number; pitch: number; errYaw: number; errPitch: number; error: number }

export interface LiveManualAimOptions {
  /**
   * Looking through a sniper optic. The magnified sight picture makes the small corrective movements
   * finer (and a little slower, as scoped sensitivity is lower); the ballistic flick itself is unchanged.
   */
  scoped?: boolean;
}

/**
 * Advance the crosshair one tick toward the intended point. Desired angles are the true direction to the
 * point the bot means to hit; the returned view is where the crosshair actually is.
 */
export function stepLiveManualAim(
  aim: LiveManualAim, desiredYaw: number, desiredPitch: number, skills: LiveAimSkills, now: number, pressure: number, random: () => number,
  options: LiveManualAimOptions = {},
): LiveManualAimStep {
  const flick = clamp01(skills.flick), tracking = clamp01(skills.tracking), precision = clamp01(skills.precision);
  const reactions = clamp01(skills.reactions), composure = clamp01(skills.composure);
  const stepDt = Math.max(0, Math.min(.1, now - (aim.lastStepAt ?? now)));
  aim.lastStepAt = now;
  const dYaw = wrap(desiredYaw - aim.lastDesiredYaw), dPitch = desiredPitch - aim.lastDesiredPitch;
  // Before the first visual adjustment finishes, a holding crosshair stays dead still so an enemy
  // crossing the angle walks cleanly into the pre-placed reticle instead of being magnetically chased.
  // After reaction, smooth pursuit combines a light ocular reflex with discrete-sampled hand velocity.
  let handYaw = 0, handPitch = 0;
  if (aim.adjustments > 0) {
    const follow = .04 + tracking * .1;
    const maxTrackStep = .018 + tracking * .024;
    const reflexYaw = Math.abs(dYaw) <= maxTrackStep ? dYaw * follow : Math.sign(dYaw) * maxTrackStep * follow;
    const reflexPitch = Math.abs(dPitch) <= maxTrackStep ? dPitch * follow : Math.sign(dPitch) * maxTrackStep * follow;
    const maxPan = 1.6 * stepDt;
    handYaw = reflexYaw + clamp((aim.velYaw ?? 0) * stepDt, -maxPan, maxPan);
    handPitch = reflexPitch + clamp((aim.velPitch ?? 0) * stepDt, -maxPan, maxPan);
  }
  aim.lagYaw -= dYaw - handYaw;
  aim.lagPitch -= dPitch - handPitch;
  aim.lastDesiredYaw = desiredYaw; aim.lastDesiredPitch = desiredPitch;

  const span = Math.max(1e-6, aim.moveEnd - aim.moveStart), s = clamp01((now - aim.moveStart) / span);
  const eased = s * s * (3 - 2 * s);
  aim.errYaw = aim.fromYaw + (aim.toYaw - aim.fromYaw) * eased + aim.lagYaw;
  aim.errPitch = aim.fromPitch + (aim.toPitch - aim.fromPitch) * eased + aim.lagPitch;

  if (now >= aim.moveEnd && now >= aim.nextAdjustAt) {
    const senseDt = now - (aim.prevSensedAt ?? now);
    if (senseDt > 1e-4) {
      const obsVelYaw = wrap(desiredYaw - (aim.prevSensedYaw ?? desiredYaw)) / senseDt;
      const obsVelPitch = (desiredPitch - (aim.prevSensedPitch ?? desiredPitch)) / senseDt;
      const alpha = .35 + tracking * .45;
      if (Math.hypot(obsVelYaw, obsVelPitch) > 1e-4) {
        const trackGain = .24 + tracking * .58;
        const trackNoise = (.04 + (1 - tracking) * .22) * (1 + pressure * (1 - composure) * .6);
        const nextVelYaw = clamp(obsVelYaw * trackGain + gauss(random) * Math.abs(obsVelYaw) * trackNoise, -1.6, 1.6);
        const nextVelPitch = clamp(obsVelPitch * trackGain + gauss(random) * Math.abs(obsVelPitch) * trackNoise, -1.1, 1.1);
        aim.velYaw = (aim.velYaw ?? 0) * (1 - alpha) + nextVelYaw * alpha;
        aim.velPitch = (aim.velPitch ?? 0) * (1 - alpha) + nextVelPitch * alpha;
        aim.adjustments = Math.max(aim.adjustments, 1);
      } else {
        aim.velYaw = (aim.velYaw ?? 0) * (1 - alpha);
        aim.velPitch = (aim.velPitch ?? 0) * (1 - alpha);
      }
    }
    aim.prevSensedYaw = desiredYaw;
    aim.prevSensedPitch = desiredPitch;
    aim.prevSensedAt = now;
    const size = Math.hypot(aim.errYaw, aim.errPitch);
    const deadband = .0012 + (1 - precision) * .0045;
    if (size > deadband) {
      const ballistic = size > .12;
      const skill = ballistic ? flick : precision;
      // Gain near 1 removes the error; above 1 overshoots, below 1 falls short.
      const gain = (ballistic ? .94 + flick * .05 : .88 + precision * .1) + gauss(random) * ((ballistic ? .11 : .07) * (1 - skill) + .025);
      // Signal-dependent noise: bigger, faster movements land less precisely; pressure adds shake.
      const shake = 1 + pressure * (1 - composure) * .8;
      const optic = options.scoped && !ballistic ? .55 : 1;
      const sd = (size * (.035 + .1 * (1 - skill)) + .0007 + (1 - precision) * .0035) * shake * optic;
      aim.fromYaw = aim.errYaw; aim.fromPitch = aim.errPitch;
      aim.toYaw = aim.errYaw * (1 - gain) + gauss(random) * sd;
      aim.toPitch = aim.errPitch * (1 - gain) + gauss(random) * sd * .75;
      aim.lagYaw = 0; aim.lagPitch = 0;
      aim.moveStart = now;
      aim.moveEnd = now + .04 + size * (.32 - flick * .16) + (options.scoped && !ballistic ? .025 : 0);
      aim.adjustments++;
    }
    aim.nextAdjustAt = Math.max(aim.moveEnd, now) + .03 + (1 - reactions) * .07 + random() * .035;
  }
  return {yaw: wrap(desiredYaw + aim.errYaw), pitch: desiredPitch + aim.errPitch, errYaw: aim.errYaw, errPitch: aim.errPitch, error: Math.hypot(aim.errYaw, aim.errPitch)};
}

/**
 * Angular half-size of what the bot is aiming at, used to decide when the crosshair is "on". Matches the
 * hit volumes in `fpsLiveBallistics.ts`: a skull-sized head (slightly inside its 0.09 x 0.113 m half-axes)
 * and the chest/abdomen block.
 */
export function liveAimTargetSize(distance: number, head: boolean): {halfWidth: number; halfHeight: number} {
  const d = Math.max(.5, distance);
  return head ? {halfWidth: Math.atan(.085 / d), halfHeight: Math.atan(.105 / d)} : {halfWidth: Math.atan(.19 / d), halfHeight: Math.atan(.32 / d)};
}

/** Where on the body a shooter means to put the crosshair. */
export type LiveAimZone = 'head' | 'neck' | 'body';

/** Distance (m) inside which this weapon family can realistically one-tap a skull-sized head, at precision 1. */
const HEAD_REACH: Partial<Record<LiveWeapon, number>> = {
  deagle: 20, usp_s: 17, p250: 16, fiveseven: 16, glock: 11, pistol: 11, tec9: 11, cz75: 9,
  ak47: 16, m4a1_s: 16, rifle: 15, budget_ct: 13, budget_t: 13, smg: 8, mp9: 8, mac10: 7.5, scout: 50,
};

/**
 * Head, neck or centre mass, from whether the small head is realistically hittable for this shooter. A
 * one-tap weapon at close range in precise hands goes for the head; at mid/long range, mid-spray, against
 * a moving target or under pressure, average shooters put the crosshair on the chest and let the spray work.
 * The AWP (lethal to the chest) and shotguns (pellet spread) aim centre mass. Decision-only: it chooses the
 * aim point; the hand still has to get there and every bullet still flies with its normal error.
 */
export function liveAimZone(input: {weapon: LiveWeapon; distance: number; precision: number; spraying?: boolean; targetSpeed?: number; pressure?: number}): LiveAimZone {
  const base = HEAD_REACH[input.weapon];
  if (!base) return 'body';
  const p = clamp01(input.precision);
  const sniper = input.weapon === 'scout';
  // High-tier pros keep head-level crosshair discipline on first shots well past 20 m rather than
  // pulling down to torso at mid-range; lower skill or sustained spray drops toward chest/neck.
  const reachMult = sniper ? .45 + .55 * p : p <= .7 ? Math.max(0, p * 1.1 - .05) : .72 + Math.pow((p - .7) / .3, 1.35) * .92;
  let reach = base * reachMult;
  if (input.spraying && !sniper) reach *= .55;
  reach *= 1 - .35 * clamp01((input.targetSpeed ?? 0) / 2.5);
  reach *= 1 - .25 * clamp01(input.pressure ?? 0);
  if (input.distance <= reach) return 'head';
  return input.distance <= reach * 2 + 3 ? 'neck' : 'body';
}

/**
 * Whether the crosshair is close enough to the intended point for this shooter to pull the trigger.
 * Disciplined (precise) shooters wait until they are on; impatient ones fire while still settling.
 * `scale` widens the window for deliberate area fire (panic or decoy noise), never for a real duel.
 */
export function liveTriggerReady(step: Pick<LiveManualAimStep, 'errYaw' | 'errPitch'>, size: {halfWidth: number; halfHeight: number}, precision: number, options: {scoped?: boolean; scale?: number; inSpray?: boolean; head?: boolean} = {}): boolean {
  const p = clamp01(precision);
  const head = options.head ?? Math.abs(size.halfHeight - size.halfWidth) < 1e-9;
  // A bolt-action shot is one deliberate pull: snipers wait to be on rather than firing while settling.
  // Unscoped headshots fire near the head/neck edge rather than waiting for dead-center lock; body shots stay within the torso.
  const unscoped = head ? 1.10 + (1 - p) * 1.10 : .85 + (1 - p) * .75;
  const baseTolerance = options.scoped ? .6 + (1 - p) * .6 : unscoped * (options.inSpray ? 2.2 : 1);
  const tolerance = baseTolerance * Math.max(1, options.scale ?? 1);
  return Math.abs(step.errYaw) <= size.halfWidth * tolerance && Math.abs(step.errPitch) <= size.halfHeight * tolerance;
}

/** Bolt-action rifles fire single aimed shots: every shot after the bolt cycles is a first shot. */
export function liveBoltAction(weapon: LiveWeapon): boolean {
  return LIVE_WEAPONS[weapon].category === 'sniper';
}

/**
 * Cumulative spray patterns (radians: pitch up, yaw right) for shot n of an uninterrupted spray, modelled
 * on CS2 shapes. AK: about nine shots straight up, then a swing left, then right, then back.
 */
const AK_PATTERN: readonly [number, number][] = [
  [0, 0], [.0055, 0], [.0145, .0006], [.0265, .0012], [.0405, .0008], [.0545, -.0006], [.0675, -.0028], [.0785, -.0062], [.0870, -.0108],
  [.0930, -.0165], [.0968, -.0225], [.0990, -.0278], [.1003, -.0308], [.1012, -.0300], [.1018, -.0255], [.1022, -.0182], [.1026, -.0090],
  [.1030, .0010], [.1034, .0104], [.1038, .0180], [.1042, .0228], [.1046, .0242], [.1050, .0220], [.1054, .0170], [.1058, .0102],
  [.1062, .0028], [.1066, -.0042], [.1070, -.0098], [.1074, -.0132], [.1078, -.0140],
];
const PATTERN_SCALE: Partial<Record<LiveWeapon, number>> = {ak47: 1, rifle: .9, m4a1_s: .7, budget_t: .8, budget_ct: .74, smg: .5, mp9: .48, mac10: .55, negev: .9};

/** Pistol and single-shot kicks: [pitch per follow-up shot, yaw spread, shots to full reset per second]. */
const KICK: Partial<Record<LiveWeapon, [number, number, number]>> = {
  deagle: [.055, .006, 2.2], cz75: [.016, .004, 9], tec9: [.018, .005, 7], fiveseven: [.016, .004, 7], p250: [.019, .004, 6],
  glock: [.012, .004, 9], usp_s: [.013, .003, 8], pistol: [.013, .003, 8], sniper: [0, 0, 6], scout: [0, 0, 6],
  mag7: [.035, .006, 2], nova: [.035, .006, 2],
};

/** Where shot `index` (0 = first shot) of an uninterrupted spray goes, before the shooter compensates. */
export function liveSprayOffset(weapon: LiveWeapon, index: number): {pitch: number; yaw: number} {
  const i = Math.max(0, index);
  // No spray for bolt-action rifles: the kick is visual only and is gone by the time the bolt has cycled.
  if (liveBoltAction(weapon)) return {pitch: 0, yaw: 0};
  const scale = PATTERN_SCALE[weapon];
  if (scale !== undefined) {
    const at = Math.min(Math.floor(i), AK_PATTERN.length - 1), next = Math.min(at + 1, AK_PATTERN.length - 1), f = i - Math.floor(i);
    const [p0, y0] = AK_PATTERN[at], [p1, y1] = AK_PATTERN[next];
    return {pitch: (p0 + (p1 - p0) * f) * scale, yaw: (y0 + (y1 - y0) * f) * scale};
  }
  const kick = KICK[weapon] ?? [.015, .004, 8];
  // Fixed alternating drift so repeated follow-ups land the same way every time.
  return {pitch: kick[0] * Math.min(i, 4) * (1 - Math.min(i, 4) * .06), yaw: kick[1] * Math.sin(Math.floor(i) * 1.7) * Math.min(i, 3)};
}

/** How fast an idle trigger resets the spray (pattern shots per second), and after how long. */
export function liveSprayRecovery(weapon: LiveWeapon): {delay: number; rate: number} {
  if (PATTERN_SCALE[weapon] !== undefined) return {delay: Math.max(.16, LIVE_WEAPONS[weapon].interval * 1.55), rate: weapon === 'negev' ? 14 : LIVE_WEAPONS[weapon].category === 'smg' ? 26 : 20};
  return {delay: Math.max(.05, LIVE_WEAPONS[weapon].interval * .6), rate: (KICK[weapon] ?? [0, 0, 8])[2]};
}

export function recoverLiveSpray(index: number, weapon: LiveWeapon, sinceShot: number, dt: number): number {
  const r = liveSprayRecovery(weapon);
  return sinceShot < r.delay ? index : Math.max(0, index - r.rate * dt);
}

/**
 * The part of the pattern the shooter fails to cancel. Compensation is learned pull-down of the known
 * pattern, imperfect by skill, with per-shot variation; it never sees the bullet before it is fired.
 */
export function liveRecoilResidual(weapon: LiveWeapon, index: number, recoilControl: number, consistency: number, random: () => number): {pitch: number; yaw: number} {
  const offset = liveSprayOffset(weapon, index), control = clamp01(recoilControl);
  const compensation = .12 + control * .8;
  const wobble = (1 - clamp01(consistency)) * .22 + (1 - control) * .1;
  const pull = (v: number) => v * compensation * (1 + gauss(random) * wobble);
  return {pitch: offset.pitch - pull(offset.pitch), yaw: offset.yaw - pull(offset.yaw)};
}

/** Extra inaccuracy from firing again before a heavy pistol has recovered (CS2 Deagle spam penalty). */
export function liveSpamInaccuracy(weapon: LiveWeapon, index: number): number {
  if (weapon === 'deagle') return 1 + Math.min(3, index) * 1.1;
  if (LIVE_WEAPONS[weapon].category === 'pistol') return 1 + Math.min(4, index) * .22;
  return 1;
}

export interface LiveAnticipationReadinessInput {
  angularError: number;
  isTradeTarget?: boolean;
  isPreAimedContact?: boolean;
  isPeekingContact?: boolean;
  partnerFightingNear?: boolean;
  tradingSkill?: number;
  crosshairSkill?: number;
  communication?: number;
}

/**
 * Anticipated target acquisition readiness: a player swinging a known death callout, peeking a known
 * contact, assisting a teammate in an active fight, or holding a tight pre-aim has anticipated visual
 * confirmation rather than a cold-start surprise reaction.
 */
export function computeLiveAnticipationReadiness(input: LiveAnticipationReadinessInput): { reactionScale: number; perceptionScale: number } {
  let readiness = 0;
  if (input.isTradeTarget) {
    readiness += 0.42 * (0.5 + clamp01(input.tradingSkill ?? 0.5) * 0.5) * (0.6 + clamp01(input.communication ?? 0.5) * 0.4);
  }
  if (input.angularError < 0.22) {
    readiness += (1 - Math.max(0, input.angularError) / 0.22) * 0.28 * (0.4 + clamp01(input.crosshairSkill ?? 0.5) * 0.6);
  }
  if (input.isPeekingContact || input.isPreAimedContact) {
    readiness += 0.18;
  }
  if (input.partnerFightingNear) {
    readiness += 0.16;
  }
  readiness = Math.max(0, Math.min(0.62, readiness));
  return {
    reactionScale: 1 - readiness * 0.52,
    perceptionScale: Math.max(0.22, 1 - readiness * 0.65),
  };
}

/**
 * Physical aim-punch on high-impact or headshot hits (e.g. helmet dink or heavy unarmored hit).
 * Perturbs the victim's manual crosshair upward and slightly sideways, scaled by armor and composure,
 * requiring a short corrective adjustment to pull the crosshair back on target.
 */
export function applyLiveAimPunch(
  aim: LiveManualAim | undefined,
  input: { damage: number; isHeadshot: boolean; armor: number; composure: number },
  random: () => number,
): void {
  if (!aim || input.damage < 18) return;
  if (!input.isHeadshot && input.armor > 0 && input.damage < 42) return;
  const baseKick = input.isHeadshot ? (input.armor > 0 ? 0.016 : 0.028) : (input.armor > 0 ? 0.006 : 0.018) * Math.min(1.4, input.damage / 35);
  const kick = baseKick * (1.15 - clamp01(input.composure) * 0.55);
  aim.errPitch -= kick;
  aim.fromPitch = aim.errPitch;
  aim.errYaw += (random() - 0.5) * kick * 0.45;
  aim.fromYaw = aim.errYaw;
  aim.nextAdjustAt = Math.max(aim.nextAdjustAt, aim.moveStart + 0.035);
}
