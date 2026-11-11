import {writeFile} from 'node:fs/promises';
import {createEqualizedRoster} from '../src/equalizedMode.ts';
import {FPS_IDENTITY_PERSONALITIES,FPS_SPECIALTIES,generatePlayerDNA} from '../src/fps/fpsIdentity.ts';
import {simulateFpsMatch} from '../src/fps/fpsSimulationEngine.ts';
const plan={tempo:.5,structure:.5,aggression:.5,preparation:.5,freedom:.5,economy:.5};
const coach={tempo:.5,rigidity:.5,aggression:.5,preparation:.5,freedom:.5,economy:.5,communication:.5,leadership:.5,adaptability:.5,development:.5};
const chemistry={trust:.5,communication:.5,understanding:.5,leadershipAcceptance:.5,roleCompetition:.5};
const result={diagnosticOnly:true,balanceQualified:false,matches:0,specialties:{},personalityTriggers:{},roles:{},averageDecisionEntropy:0};let entropy=0,decisions=0;
for(const specialty of FPS_SPECIALTIES) {
  let activations=0,opportunities=0;
  for(const [index,map] of ['breakwater','foundry','old-quarter','red-mesa','northpoint'].entries()) {
    const blue=createEqualizedRoster('blue'),red=createEqualizedRoster('red');
    const players=Object.fromEntries([...blue,...red].map((p,i)=>[p.id,{id:p.id,personality:FPS_IDENTITY_PERSONALITIES[(index*10+i)%24],specialty,intensity:.8,dna:generatePlayerDNA(p.id),roleSuitability:.5,familiarity:.3}]));
    const report=simulateFpsMatch(blue,red,map,319+index,{identityExperiment:{players,teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}}});result.matches++;
    for(const event of report.events) {
      if(event.type==='specialty_activated')activations++;
      if(['duel_engagement','utility_deployed','player_moved'].includes(event.type))opportunities++;
      if(event.decision){decisions++;entropy+=-event.decision.scores.reduce((sum,s)=>sum+(s.probability?s.probability*Math.log(s.probability):0),0);for(const trigger of event.decision.triggers)result.personalityTriggers[trigger]=(result.personalityTriggers[trigger]??0)+1;}
    }
    for(const snapshot of report.roundSnapshots)result.roles[snapshot.tactics.role]=(result.roles[snapshot.tactics.role]??0)+1;
  }
  result.specialties[specialty.id]={activations,executionEvents:opportunities};
}
result.averageDecisionEntropy=entropy/decisions;
await writeFile(process.argv[2]??'fps-identity-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({matches:result.matches,activeSpecialties:Object.values(result.specialties).filter(x=>x.activations>0).length,averageDecisionEntropy:result.averageDecisionEntropy,balanceQualified:false}));
