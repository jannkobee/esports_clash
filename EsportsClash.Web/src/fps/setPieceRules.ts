import type {
  FpsBombsite,
  FpsMap,
  FpsMatchEvent,
  FpsPlayerState,
  FpsWeaponId,
  SetPieceCall,
  SetPieceStrategy
} from './types.ts';
import { getWeaponDef } from './weapons.ts';
import { simulateFpsRound } from './fpsRoundSimulation.ts';
import type { FpsMatchSettings, FpsRoundEndReason, FpsSide } from './types.ts';
import { getFpsPreferences, rankFpsPlayers, shouldSaveFpsRetake } from './fpsPersonality.ts';
import { evaluatePlayerAction, type PersonalityTrigger, type ScoredTacticalAction } from './fpsIdentity.ts';
import type { FpsIdentityExperiment } from './types.ts';

export interface SetPieceResolution {
  call: SetPieceCall;
  events: FpsMatchEvent[];
  siteSecured: boolean;
  targetSite: FpsBombsite;
  entryDuelWon: boolean;
  tradeSuccess: boolean;
  utilityEffectiveness: number; // 0.0 - 1.0
  devicePlanted: boolean;
  planterId?: string;
  defused: boolean;
  defuserPlayerId?: string;
  endReason: FpsRoundEndReason;
  winnerSide: FpsSide;
  durationSeconds: number;
}

export function generateSetPieceCall(
  attackers: FpsPlayerState[],
  defenders: FpsPlayerState[],
  map: FpsMap,
  roundNumber: number,
  random: () => number,
  identityExperiment?: FpsIdentityExperiment
): SetPieceCall {
  const livingAttackers = attackers.filter(p => p.isAlive);
  if (!livingAttackers.length) throw new Error('A tactical call requires a living attacker.');
  const preferences = livingAttackers.map(p => getFpsPreferences(p.card, p.psychology));
  const aggression = preferences.reduce((sum, p) => sum + p.aggression, 0) / preferences.length;
  const discipline = preferences.reduce((sum, p) => sum + (p.coordination + p.patience) / 2, 0) / preferences.length;
  const totalSmokes = livingAttackers.reduce(
    (count, p) => count + p.loadout.utilities.filter(u => u === 'utility_smoke').length,
    0
  );
  const totalFlashes = livingAttackers.reduce(
    (count, p) => count + p.loadout.utilities.filter(u => u === 'utility_flash').length,
    0
  );

  // Pick target site (A or B)
  const targetSite: FpsBombsite = random() < 0.5 ? 'A' : 'B';
  const oppositeSite: FpsBombsite = targetSite === 'A' ? 'B' : 'A';

  const igl = (identityExperiment ? livingAttackers.find(p=>p.tactics?.isCaller) : undefined) ?? rankFpsPlayers(livingAttackers, 'caller')[0];

  // Determine tactical strategy
  let strategy: SetPieceStrategy = 'set_piece_execute';
  const fakeChance = Math.max(0.1, Math.min(0.6, 0.35 + discipline * 0.08 - aggression * 0.05));
  const rushChance = Math.max(0.1, Math.min(0.55, 0.30 + aggression * 0.10 - discipline * 0.08));
  if (totalSmokes + totalFlashes >= 4 && random() < fakeChance) {
    strategy = 'fake_execute';
  } else if (totalSmokes === 0 && random() < rushChance) {
    strategy = 'fast_rush';
  } else if (livingAttackers.every(p => !p.loadout.primaryWeapon)) {
    strategy = random() < 0.5 ? 'fast_rush' : 'default_probe';
  } else if (totalSmokes + totalFlashes < 4 && discipline > .4 && aggression < .2) {
    strategy = 'default_probe';
  }

  let identityReason = '';
  const identity = identityExperiment?.players[igl.playerId];
  const environment = identityExperiment?.teams[igl.team];
  if (identity && environment) {
    const mood = igl.psychology;
    const triggers = new Set<PersonalityTrigger>(['preparedPlan','probeOpportunity']);
    if (roundNumber <= 4) triggers.add('earlyRound');
    if (roundNumber >= 20) triggers.add('lateRound');
    if (roundNumber >= 28) triggers.add('pressure');
    if (igl.lastRoundEarlyDeath) triggers.add('personalMistake');
    if (totalSmokes+totalFlashes>=2) triggers.add('utilityExecute');
    if ((mood?.winStreak ?? 0) >= 3) triggers.add('winningStreak');
    if ((mood?.lossStreak ?? 0) >= 2) { triggers.add('losingStreak'); triggers.add('setback'); }
    if ((mood?.confidence ?? 50) < 35) triggers.add('pressure');
    const actions: ScoredTacticalAction[] = [
      {action:'pressure',legal:true,tacticalValue:totalSmokes===0 ? .55 : .35,instruction:environment.plan.tempo*2-1},
      {action:'prepare',legal:true,tacticalValue:totalSmokes+totalFlashes>=2 ? .65 : .25,instruction:environment.plan.preparation*2-1},
      {action:'probe',legal:true,tacticalValue:.45,instruction:1-environment.plan.tempo*2},
      {action:'coordinate',legal:totalSmokes+totalFlashes>=4,tacticalValue:.55,instruction:environment.plan.structure*2-1},
    ];
    const decision=evaluatePlayerAction(identity,{triggers,opportunities:new Set(),teamIdentity:environment.culture,confidence:(mood?.confidence ?? 50)/100,fatigue:0},environment.coach,environment.plan,environment.chemistry,actions,random);
    strategy='default_probe';
    identityReason=` ${identity.personality.name}: ${decision.triggers.length ? 'situational tendency considered' : 'no personality trigger'}; the opening stays adaptive while each player responds to observed information (${decision.action}).`;
  }

  const entryFragger = (identityExperiment ? livingAttackers.find(p=>p.tactics?.role==='entry') : undefined) ?? rankFpsPlayers(livingAttackers, 'entry')[0];

  // Pick trade fraggers (highest TF)
  const otherAttackers = livingAttackers.filter(p => p.playerId !== entryFragger.playerId);
  const sortedByTf = identityExperiment ? [...otherAttackers].sort((a,b)=>Number(b.tactics?.role==='trade')-Number(a.tactics?.role==='trade') || a.playerId.localeCompare(b.playerId)) : rankFpsPlayers(otherAttackers, 'trade');
  const tradeFraggerIds = sortedByTf.slice(0, 2).map(p => p.playerId);
  const supportFraggerIds = sortedByTf.slice(2).map(p => p.playerId);

  const entryChokeZone = targetSite === 'A' ? map.chokeZones[0] : map.chokeZones[1] || map.chokeZones[0];
  const smokeZones = targetSite === 'A' ? [map.siteAZones[0]] : [map.siteBZones[0]];
  const flashZones = targetSite === 'A' ? map.siteAZones : map.siteBZones;

  const confidence = Math.min(
    0.95,
    0.50 +
      ((igl?.card.stats.iq || 70) - 70) * 0.005 +
      (totalSmokes + totalFlashes) * 0.04
  );

  return {
    id: `sp_${roundNumber}_${targetSite}_${Math.floor(random() * 10000)}`,
    strategy,
    targetSite,
    fakeSite: strategy === 'fake_execute' ? oppositeSite : undefined,
    entryChokeZone,
    smokeZones,
    flashZones,
    entryFraggerId: entryFragger.playerId,
    tradeFraggerIds,
    supportFraggerIds,
    confidence,
    utilityCount: totalSmokes + totalFlashes,
    callerId: igl.playerId,
    decisionReason: `${identityExperiment ? 'Contextual plan' : aggression > .4 ? 'The team favors early pressure' : discipline > .4 ? 'The team favors prepared contact' : 'The team takes a balanced approach'}, with ${totalSmokes} smokes and ${totalFlashes} flashes available.${identityReason}`
  };
}

export function calculateDuelHitDamage(
  shooter: FpsPlayerState,
  target: FpsPlayerState,
  engagementDistance: 'close' | 'medium' | 'long',
  shooterHasAdvantage: boolean,
  targetIsBlinded: boolean,
  random: () => number
): { damage: number; isHeadshot: boolean; weaponId: FpsWeaponId } {
  const weaponId = shooter.loadout.primaryWeapon || shooter.loadout.secondaryWeapon;
  const def = getWeaponDef(weaponId);

  // Baseline headshot chance based on LAN mechanics
  let headshotChance = (shooter.card.stats.lan / 100) * 0.35;
  if (def.category === 'sniper') headshotChance = 0.65;
  if (shooterHasAdvantage) headshotChance += 0.15;
  if (targetIsBlinded) headshotChance += 0.25;

  const isHeadshot = random() < Math.min(headshotChance, 0.85);

  let rawDamage = def.baseDamage;
  if (isHeadshot) {
    rawDamage *= def.headshotMultiplier;
  } else {
    // Multi-shot burst
    const hits = 1 + Math.floor(random() * Math.min(def.fireRate, 3));
    rawDamage *= hits;
  }

  // Distance adjustment
  if (engagementDistance === 'long' && def.range === 'close') {
    rawDamage *= 0.65;
  } else if (engagementDistance === 'close' && def.range === 'close') {
    rawDamage *= 1.25;
  }

  // Armor mitigation
  if (target.loadout.armor > 0) {
    if (isHeadshot && !target.loadout.hasHelmet) {
      // No helmet: full headshot damage!
    } else {
      const reduction = (1 - def.armorPenetration) * 0.5;
      rawDamage *= 1 - reduction;
      target.loadout.armor = Math.max(0, target.loadout.armor - Math.round(rawDamage * 0.3));
    }
  }

  const finalDamage = Math.max(12, Math.round(rawDamage));
  return { damage: finalDamage, isHeadshot, weaponId };
}

export function executeSetPiece(call: SetPieceCall, attackers: FpsPlayerState[], defenders: FpsPlayerState[], map: FpsMap,
  roundNumber: number, tickOffset: number, secondOffset: number, random: () => number, settings: FpsMatchSettings = {}): SetPieceResolution {
  return simulateFpsRound(call, attackers, defenders, map, roundNumber, tickOffset, secondOffset, random, settings);
}
