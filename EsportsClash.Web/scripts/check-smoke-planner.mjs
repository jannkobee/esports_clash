// Prints the smokes the bots work out for each side/purpose/area on each map (no stored lineups),
// and whether a throw can be calculated straight from the chosen staging spot.
// Usage (from EsportsClash.Web): node scripts/check-smoke-planner.mjs
import {getLiveMapRuntime} from '../src/fps/fpsLiveMapRegistry.ts';
import {planLiveSmokes,liveSmokeRequest} from '../src/fps/fpsSmokePlanner.ts';
import {calculateLiveThrow,findFpsThrowSpot} from '../src/fps/fpsUtilityBrain.ts';
for(const mapId of ['fontessa','spillway']){
  const rt=getLiveMapRuntime(mapId);const t0=performance.now();let n=0,direct=0,nearby=0;
  for(const [attacking,purpose,area] of [[true,'execute','A'],[true,'execute','B'],[true,'opening','A'],[true,'opening','B'],[true,'control','Mid'],[false,'opening','A'],[false,'opening','B'],[false,'control','Mid']]){
    const plans=planLiveSmokes(rt,liveSmokeRequest(rt,attacking,purpose,area));
    for(const p of plans){
      n++;
      const ok=!!calculateLiveThrow('smoke',p.position,p.target,rt.terrain.groundHeight(p.position)+1.55,rt);
      const spot=ok?undefined:findFpsThrowSpot('smoke',p.position,p.target,rt);
      if(ok)direct++;else if(spot)nearby++;
      console.log(mapId,attacking?'T ':'CT',purpose.padEnd(8),area.padEnd(3),p.name.padEnd(46),JSON.stringify(p.target),ok?'throwable':spot?'throwable after moving':'NO THROW');
    }
    if(!plans.length)console.log(mapId,attacking?'T ':'CT',purpose,area,'NONE');
  }
  console.log(mapId,`${n} smokes: ${direct} throwable from staging, ${nearby} after moving nearby, ${(performance.now()-t0).toFixed(0)} ms`);
}
