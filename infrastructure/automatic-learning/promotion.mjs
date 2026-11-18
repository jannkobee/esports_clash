// Pure promotion decisions for the automatic-learning coordinator (kept separate so they are testable
// without running matches). Evaluation scores are paired: each seed pair is played with the candidate
// on both teams; a pair scores wins/2 - 0.5 (so 0 = even, +0.5 = won both).
import {summarizeFpsPlaybook} from '../../EsportsClash.Web/src/fps/fpsLivePlaybook.ts';

export function interval(values){
  const mean=values.reduce((a,b)=>a+b,0)/Math.max(1,values.length);
  const variance=values.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,values.length-1);
  const margin=1.96*Math.sqrt(variance/Math.max(1,values.length));return {mean,lower:mean-margin,upper:mean+margin,n:values.length};
}
/** Paired scores from completed results (`result(id)`), plus completeness. */
export function pairedScores(result,prefix,pairs){
  const values=[];let complete=true;
  for(let pair=0;pair<pairs;pair++){
    let wins=0;
    for(const side of ['blue','red']){const r=result(`${prefix}-${pair}-${side}`);if(r?.status!=='completed')complete=false;if(r?.winner===side)wins++;}
    values.push(wins/2-.5);
  }
  return {...interval(values),complete};
}
/**
 * League check against previously promoted versions: the candidate must not be significantly worse
 * than any of them (guards against forgetting and rock-paper-scissors cycling).
 */
export function leagueVerdict(entries){
  const regressions=entries.filter(e=>!e.complete||e.upper<0);
  return {passed:regressions.length===0,regressions:regressions.map(e=>e.sha256)};
}
/** Performance rating from a paired score against an opponent of known rating (bounded). */
export function eloFromScore(opponentElo,meanScore){
  const s=Math.min(.97,Math.max(.03,meanScore+.5));
  return Math.round(opponentElo+400*Math.log10(s/(1-s)));
}
/** Candidate rating: average of its performance ratings against the incumbent and league opponents. */
export function candidateElo(ratings){
  if(!ratings.length)return 1500;
  return Math.round(ratings.reduce((n,r)=>n+eloFromScore(r.opponentElo,r.mean),0)/ratings.length);
}
/** Automatic promotion needs a passed screening, complete ablations, a clean league and no pause. */
export function promotionDecision({report,league,paused,autoPromote}){
  if(!report?.passed)return {promote:false,reason:'screening or ablations did not pass'};
  if(league&&!league.passed)return {promote:false,reason:'regressed against an earlier promoted version'};
  if(!autoPromote)return {promote:false,reason:'automatic promotion disabled'};
  if(paused)return {promote:false,reason:'promotion paused by owner'};
  return {promote:true,reason:'passed screening, ablations and league'};
}
/** Post-promotion monitor: roll back only on a significant regression against the previous version. */
export function monitorDecision(score){
  if(!score.complete)return {rollback:false,reason:'monitor incomplete'};
  return score.upper<0?{rollback:true,reason:`regressed against the previous version (mean ${score.mean.toFixed(3)}, upper ${score.upper.toFixed(3)})`}:{rollback:false,reason:'no significant regression'};
}
/** Meta report for one cycle: per lineage and map, popular plays, best counters, innovation counts. */
export function metaReport(lineages){
  return {version:1,at:new Date().toISOString(),lineages:Object.fromEntries(Object.entries(lineages).map(([key,bundle])=>[key,{
    maps:Object.fromEntries(Object.entries(bundle?.playbooks??{}).map(([map,book])=>[map,summarizeFpsPlaybook(book)])),
    opponents:Object.fromEntries(Object.entries(bundle?.opponents?.opponents??{}).map(([k,p])=>[k,{rounds:p.rounds,plants:p.plants,earlyRushRate:p.attackRounds?p.earlyRush/p.attackRounds:null}])),
  }]))};
}
