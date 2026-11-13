import {segmentHitsWall} from '../../EsportsClash.Web/src/fps/fpsSpatialWorld.ts';
import {FpsLiveSimulation,LIVE_FPS_STEP} from '../../EsportsClash.Web/src/fps/fpsLiveSimulation.ts';
import {LIVE_FPS_MAP,LIVE_ACTOR_RADIUS} from '../../EsportsClash.Web/src/fps/fpsLiveMap.ts';
import {fixture} from './fixtures.mjs';
import {validateBundle,sha} from './model.mjs';
export async function runMatch(job,emit=()=>{},cancelled=()=>false){
  validateBundle(job.blue);validateBundle(job.red);
  const {cards,identity,profiles,configuration}=fixture(job.seed,job.group);
  const start=performance.now();let rounds=0,plants=0,defuses=0,stalledActorSeconds=0;
  const roundSides={attack:{wins:0,rounds:0},defend:{wins:0,rounds:0}};
  const teamLearning=Object.fromEntries(['blue','red'].map(team=>[team,{
    learning:{mode:job.mode,updateModel:false,model:job[team].navigation,onRound:payload=>emit({id:payload.id,kind:'navigation',payload})},
    mechanicsLearning:{mode:job.mode,updateModel:false,model:job[team].combat,onRound:payload=>emit({id:payload.id,kind:'combat',payload})},
    movementLearning:{mode:job.mode,updateModel:false,model:job[team].movement,onRound:payload=>emit({id:payload.id,kind:'movement',payload})}
  }]));
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),job.seed,identity,{skillProfiles:profiles,episodeId:job.id,teamLearning,onRoundComplete:round=>{
    rounds++;if(round.planted)plants++;if(/defus/i.test(round.reason))defuses++;
    if(job.candidateTeam){const side=round.attackTeam===job.candidateTeam?'attack':'defend';roundSides[side].rounds++;if(round.winner===job.candidateTeam)roundSides[side].wins++;}
    emit({id:`${job.id}:${round.round}:outcome`,kind:'round',payload:round});
  }});
  emit({id:job.id+':start',kind:'start',payload:{seed:job.seed,group:job.group,configuration,engine:job.blue.engine,models:{blue:sha(job.blue),red:sha(job.red)},mode:job.mode}});
  let snapshot=sim.snapshot(),status='aborted',failure='simulation-time-limit';
  for(let tick=0;tick<Math.ceil(job.maxSimulatedSeconds/LIVE_FPS_STEP);tick++){
    sim.step();sim.drainAudioCues();
    if(tick%30===0){
      snapshot=sim.snapshot();
      for(const p of snapshot.players){
        if(![p.x,p.z,p.hp].every(Number.isFinite)||Math.abs(p.x)>34.01||Math.abs(p.z)>43.01)throw Error('Position/health invariant');
        if(p.hp>0&&!p.isBoosted&&!p.jump&& LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(p,p,w,LIVE_ACTOR_RADIUS-0.001)))throw Error('Collision invariant');
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
    simulatedSeconds:snapshot.time,wallSeconds:(performance.now()-start)/1000,group:job.group,candidateTeam:job.candidateTeam??null};
}
if(process.send){
  let stopping=false;process.on('SIGTERM',()=>{stopping=true;});
  process.on('message',async job=>{
    try {const result=await runMatch(job,record=>process.send({type:'record',record}),()=>stopping);process.send({type:'result',result},()=>process.exit(0));}
    catch(error){process.send({type:'result',result:{status:'aborted',failure:String(error),rounds:0}},()=>process.exit(1));}
  });
}
