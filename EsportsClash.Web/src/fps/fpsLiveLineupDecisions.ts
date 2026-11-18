import type {FpsPoint} from './fpsSpatialWorld.ts';
import type {LiveIntelBelief} from './fpsLiveIntel.ts';
import type {LiveSmokeLineup} from './fpsSmokeLineupDefinitions.ts';
import {LIVE_RUN_SPEED} from './fpsLiveMovement.ts';
import {liveDrawTime} from './fpsLiveWeapons.ts';
import {LIVE_UTILITY_RULES} from './fpsLiveGrenades.ts';
import {LIVE_PLANT_RULES} from './fpsLivePlanning.ts';

export const LIVE_LINEUP_DECISION_RULES=Object.freeze({
  minimumCertainty:.45,maximumAge:4.5,maximumUncertainty:6,
  threatWeight:24,sniperWeight:2,travelWeight:.15,
  openingUsefulUntil:20,assignmentSeconds:12,travelSpeedScale:.8,
  settleSeconds:.35,releaseSeconds:.2,bloomSeconds:1.2,plantApproachReserve:4,
});
const distance=(a:FpsPoint,b:FpsPoint)=>Math.hypot(a.x-b.x,a.z-b.z);

/** Rank known map techniques using personal evidence and reachable route metres.
 * A report can increase coverage value, never supply a hidden opponent position.
 * Taking the strongest clue prevents copied reports from multiplying its value.
 * Callers retain the chosen order while executing the coordinated utility phase. */
export function rankLiveSmokeLineups(lineups:readonly LiveSmokeLineup[],context:{
  from:FpsPoint;beliefs:readonly LiveIntelBelief[];travelTo:(point:FpsPoint)=>number;
}):LiveSmokeLineup[] {
  const rules=LIVE_LINEUP_DECISION_RULES;
  const beliefs=context.beliefs.filter(b=>b.certainty>=rules.minimumCertainty&&b.age<=rules.maximumAge
    &&b.radius<=rules.maximumUncertainty&&(b.source==='sight'||b.weaponHint==='sniper'||b.weaponHint==='heavy'));
  return lineups.map((lineup,index)=>{
    const route=context.travelTo(lineup.position),travel=Number.isFinite(route)&&route>=0?route:Infinity;
    const threat=beliefs.reduce((best,belief)=>{
      // A smoke beyond a nearby opponent does not cover that opponent's angle.
      if(distance(context.from,belief)+LIVE_UTILITY_RULES.smokeRadius<distance(context.from,lineup.target))return best;
      const proximity=Math.max(0,1-distance(belief,lineup.target)/(LIVE_UTILITY_RULES.smokeRadius+4));
      const weaponWeight=belief.weaponHint==='sniper'?rules.sniperWeight:belief.weaponHint==='heavy'?1.65:belief.weaponHint==='rifle'||belief.weaponHint==='suppressed'?1.15:1;
      const value=belief.certainty*proximity/(1+Math.max(0,belief.radius)*.12)*weaponWeight;
      return Math.max(best,value);
    },0);
    return {lineup,index,travel,score:threat*rules.threatWeight-travel*rules.travelWeight};
  }).sort((a,b)=>{
    if(!Number.isFinite(a.travel)||!Number.isFinite(b.travel))return Number.isFinite(a.travel)?-1:Number.isFinite(b.travel)?1:a.index-b.index;
    return b.score-a.score||a.index-b.index;
  }).map(entry=>entry.lineup);
}

/** Estimate travel, braking, smoke draw/pin, release, flight and useful bloom.
 * This is a conservative planning budget; authoritative solving and collisions
 * still decide whether a real throw can be made after reaching its launch point. */
export function canReachLiveOpeningLineup(travelMeters:number,liveElapsed:number,remaining:number,utilitySkill:number,distanceToTarget:number):boolean {
  if(!Number.isFinite(travelMeters+liveElapsed+remaining+utilitySkill+distanceToTarget)
    ||travelMeters<0||liveElapsed<0||remaining<=0||distanceToTarget<0)return false;
  const rules=LIVE_LINEUP_DECISION_RULES,skill=Math.max(0,Math.min(1,utilitySkill));
  // Account for parabolic arc time plus floor/wall bounce settling before bloom.
  const flight=Math.max(.85,Math.min(4.8,distanceToTarget/12+.75));
  const seconds=travelMeters/(LIVE_RUN_SPEED*rules.travelSpeedScale)+rules.settleSeconds
    +liveDrawTime('smoke')+.48+(1-skill)*.30+rules.releaseSeconds+flight+rules.bloomSeconds;
  return seconds<=Math.min(rules.openingUsefulUntil-liveElapsed,rules.assignmentSeconds,
    remaining-LIVE_PLANT_RULES.seconds-rules.plantApproachReserve);
}
