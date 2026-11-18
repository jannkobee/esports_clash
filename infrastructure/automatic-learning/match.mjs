import {segmentHitsWall} from '../../EsportsClash.Web/src/fps/fpsSpatialWorld.ts';
import {FpsLiveSimulation,LIVE_FPS_STEP} from '../../EsportsClash.Web/src/fps/fpsLiveSimulation.ts';
import {LIVE_ACTOR_RADIUS} from '../../EsportsClash.Web/src/fps/fpsLiveMap.ts';
import {fixture} from './fixtures.mjs';
import {getLiveMapRuntime} from '../../EsportsClash.Web/src/fps/fpsLiveMapRegistry.ts';
import {validateBundle,sha,utilityOf} from './model.mjs';
import {diffFpsUtilityBrain,validFpsUtilityBundleBrain} from '../../EsportsClash.Web/src/fps/fpsUtilityLearningExperience.ts';
export async function runMatch(job,emit=()=>{},cancelled=()=>false){
  validateBundle(job.blue);validateBundle(job.red);
  // Evaluation jobs pin one shared utility brain (job.utility). Training jobs with team lineages
  // (job.lineages) give each team its own brain from its own lineage, so both sides co-evolve.
  if(job.utility!==undefined&&!validFpsUtilityBundleBrain(job.utility))throw Error('Incompatible or invalid utility brain');
  const lineageOf=team=>job.lineages?.[team];
  const teamUtility=job.utility===undefined&&!!job.lineages;
  let utilityBefore=structuredClone(job.utility??utilityOf(job.blue)),utilityRounds=0;
  const utilityModel=structuredClone(utilityBefore);
  const utilityLearning={mode:job.mode,model:utilityModel,onRound:brain=>{
    const payload=diffFpsUtilityBrain(`${job.id}:utility:${++utilityRounds}`,utilityBefore,brain);utilityBefore=brain;
    emit({id:payload.id,kind:'utility',payload});
  }};
  const {cards,identity,profiles,configuration}=fixture(job.seed,job.group);
  const start=performance.now();let rounds=0,plants=0,defuses=0,stalledActorSeconds=0;
  const roundSides={attack:{wins:0,rounds:0},defend:{wins:0,rounds:0}};
  const tag=team=>lineageOf(team)?{lineage:lineageOf(team)}:{};
  const mapId=job.mapId??'fontessa',runtime=getLiveMapRuntime(mapId),bounds=runtime.definition.bounds;
  const teamLearning=Object.fromEntries(['blue','red'].map(team=>{
    let before=structuredClone(utilityOf(job[team])),rounds=0;
    return [team,{
      learning:{mode:job.mode,updateModel:false,model:job[team].navigation,onRound:payload=>emit({id:payload.id,kind:'navigation',payload,...tag(team)})},
      mechanicsLearning:{mode:job.mode,updateModel:false,model:job[team].combat,onRound:payload=>emit({id:payload.id,kind:'combat',payload,...tag(team)})},
      movementLearning:{mode:job.mode,updateModel:false,model:job[team].movement,onRound:payload=>emit({id:payload.id,kind:'movement',payload,...tag(team)})},
      // Team playbook: plays are called and learned per team; the opponent is the rival lineage.
      ...(job.lineages||job[team].playbooks?{playbook:{mode:job.mode,model:job[team].playbooks?.[mapId],opponents:job[team].opponents,
        ...(lineageOf(team==='blue'?'red':'blue')?{opponent:lineageOf(team==='blue'?'red':'blue')}:{}),
        onRound:update=>emit({id:update.round.id,kind:'playbook',payload:{id:update.round.id,map:mapId,round:update.round,...(update.observed?{observed:update.observed}:{})},...tag(team)})}}:{}),
      ...(teamUtility?{utilityLearning:{mode:job.mode,model:structuredClone(before),onRound:brain=>{
        const payload=diffFpsUtilityBrain(`${job.id}:utility:${team}:${++rounds}`,before,brain);before=brain;
        emit({id:payload.id,kind:'utility',payload,...tag(team)});
      }}}:{}),
    }];
  }));
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),job.seed,identity,{mapId,skillProfiles:profiles,episodeId:job.id,teamLearning,utilityLearning,onRoundComplete:round=>{
    rounds++;if(round.planted)plants++;if(/defus/i.test(round.reason))defuses++;
    if(job.candidateTeam){const side=round.attackTeam===job.candidateTeam?'attack':'defend';roundSides[side].rounds++;if(round.winner===job.candidateTeam)roundSides[side].wins++;}
    emit({id:`${job.id}:${round.round}:outcome`,kind:'round',payload:round});
  }});
  emit({id:job.id+':start',kind:'start',payload:{seed:job.seed,group:job.group,configuration,engine:job.blue.engine,models:{blue:sha(job.blue),red:sha(job.red),utility:sha(utilityModel)},lineages:job.lineages??null,mode:job.mode}});
  let snapshot=sim.snapshot(),status='aborted',failure='simulation-time-limit';
  for(let tick=0;tick<Math.ceil(job.maxSimulatedSeconds/LIVE_FPS_STEP);tick++){
    sim.step();sim.drainAudioCues();
    if(tick%30===0){
      snapshot=sim.snapshot();
      for(const p of snapshot.players){
        if(![p.x,p.z,p.hp].every(Number.isFinite)||p.x<bounds.clampMinX-.01||p.x>bounds.clampMaxX+.01||p.z<bounds.clampMinZ-.01||p.z>bounds.clampMaxZ+.01)throw Error('Position/health invariant');
        if(p.hp>0&&!p.isBoosted&&!p.jump&&runtime.actorSolids(p,p.jumpY??0,p.crouch?1.3:1.72).some(w=>segmentHitsWall(p,p,w,LIVE_ACTOR_RADIUS-0.001)))throw Error('Collision invariant');
        if(snapshot.phase==='live'&&p.hp>0&&p.speed<.1&&/moving|advanc|rotat|push/i.test(p.action))stalledActorSeconds++;
      }
      if(snapshot.bomb.status==='carried'&&snapshot.players.filter(p=>p.hp>0&&p.bomb).length!==1)throw Error('Bomb ownership invariant');
      if(snapshot.phase==='finished'){status='completed';failure=null;break;}
      if(cancelled()){failure='shutdown';break;}
      if(performance.now()-start>job.maxMatchWallSeconds*1000){failure='wall-time-limit';break;}
      await new Promise(resolve=>setImmediate(resolve));
    }
  }
  snapshot=sim.snapshot();
  return {status,failure,winner:snapshot.winner??null,score:snapshot.score,rounds,plants,defuses,stalledActorSeconds,roundSides,
    teamKills:snapshot.players.reduce((n,p)=>n+p.teamKills,0),friendlyDamage:sim.trainingDiagnostics().friendlyDamage,
    utility:(()=>{const stats=snapshot.utilityLearningByTeam?Object.values(snapshot.utilityLearningByTeam):[snapshot.utilityLearning].filter(Boolean);
      return {throws:stats.reduce((n,u)=>n+(u.thisMatch?.throws??0),0),successes:stats.reduce((n,u)=>n+(u.thisMatch?.successes??0),0)};})(),
    simulatedSeconds:snapshot.time,wallSeconds:(performance.now()-start)/1000,group:job.group,candidateTeam:job.candidateTeam??null,lineages:job.lineages??null};
}
if(process.send){
  let stopping=false;process.on('SIGTERM',()=>{stopping=true;});
  process.on('message',async job=>{
    try {const result=await runMatch(job,record=>process.send({type:'record',record}),()=>stopping);process.send({type:'result',result},()=>process.exit(0));}
    catch(error){process.send({type:'result',result:{status:'aborted',failure:String(error),rounds:0}},()=>process.exit(1));}
  });
}
