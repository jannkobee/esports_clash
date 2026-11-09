import type { ViewerActor } from './MatchViewer';

export type AnimationSample={clip:string;phase:number;loop:boolean};
/** Pure presentation sampling from the authoritative clock; never resolves an effect. */
export function sampleAvatarAnimation(actor:ViewerActor,second:number,started:number,hitAt=-Infinity):AnimationSample {
  const m=actor.motion;
  started=m?.stateSince??started;hitAt=m?.hitAt??hitAt;
  if(!actor.alive)return {clip:'death',phase:Math.max(0,second-started),loop:false};
  if(actor.controlled)return {clip:'hit',phase:.18,loop:false};
  if(m?.castStart!==undefined&&m.castCommit!==undefined&&m.castEnd!==undefined&&second<m.castEnd){
    const phase=second<=m.castCommit ? .45*(second-m.castStart)/Math.max(1/30,m.castCommit-m.castStart) :
      .45+.55*(second-m.castCommit)/Math.max(1/30,m.castEnd-m.castCommit);
    return {clip:'cast',phase:Math.max(0,Math.min(1,phase)),loop:false};
  }
  if(m?.attackReleased!==undefined&&second>=m.attackReleased&&second-m.attackReleased<.28)
    return {clip:'attack',phase:Math.min(1,.42+(second-m.attackReleased)*2),loop:false};
  if(second-hitAt<.2)return {clip:'hit',phase:Math.max(0,second-hitAt)/.2,loop:false};
  if(m?.state==='attack'||m?.state==='cast')return {clip:m.state,phase:Math.min(1,Math.max(0,second-started)/.8),loop:false};
  const moving=m&&Math.hypot(m.vx,m.vy)>1;
  return {clip:moving?(Math.hypot(m.vx,m.vy)>120?'run':'walk'):'idle',phase:Math.max(0,second),loop:true};
}
