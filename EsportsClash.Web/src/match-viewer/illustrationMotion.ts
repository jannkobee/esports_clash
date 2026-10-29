import type {ViewerActor} from './MatchViewer';

/** Whole-drawing accents only. Never mirror asymmetric equipment or invent joint poses. */
export function sampleIllustrationMotion(actor:ViewerActor,second:number){
  const motion=actor.motion,elapsed=Math.max(0,second-(motion?.stateSince??second));
  const facing=actor.facing<0?-1:1;
  if(!actor.alive){const fall=Math.min(1,elapsed/.65);return {lift:0,tilt:facing*Math.PI/2*fall,stretch:1,opacity:1-fall*.55,state:'dead'};}
  const moving=motion?.state==='walk'||motion?.state==='run';
  const hit=motion?.hitAt!==undefined&&second>=motion.hitAt?Math.max(0,1-(second-motion.hitAt)/.18):0;
  const cast=motion?.castStart!==undefined&&motion.castEnd!==undefined&&second>=motion.castStart&&second<motion.castEnd;
  const phase=cast?Math.max(0,Math.min(1,(second-motion!.castStart!)/Math.max(.01,motion!.castEnd!-motion!.castStart!))):0;
  return {lift:moving?Math.abs(Math.sin(second*10))*.8:0,
    tilt:(moving?Math.sin(second*10)*.014:0)-facing*(hit*.07+Math.sin(phase*Math.PI)*.035),
    stretch:1+Math.sin(second*2.5)*.004,opacity:1,state:cast?'cast':moving?'moving':'idle'};
}
