from pathlib import Path
import re
b=Path('EsportsClash.Web/src')
def change(name,fn):
 p=b/name;p.write_text(fn(p.read_text(encoding='utf-8')),encoding='utf-8')
change('fps/fpsRoundSimulation.ts',lambda s:re.sub(r'    const moveOpportunities=.*?    const progress', '    const progress',s,flags=re.S).replace("const early=progress<seconds && progress+.5>=seconds && (activation?.executionBonus ?? 0)>0 && random()<Math.min(1,seconds*activation!.executionBonus/.5);",'const early=false;'))
(b/'playerPersonality.ts').write_text('''import type {PlayerCard,PlayerAttributes} from './types.ts';
import {generateFpsPersonality,validateFpsPersonality} from './fps/fpsPlayerArchitecture.ts';
/** Explicit persisted-roster migration, shared policy with the server migration. */
export function migratePlayerAttributes(input:unknown):PlayerAttributes {
 const s=input as Record<string,number>,bounded=(v:number)=>Math.round(Math.max(1,Math.min(99,v)));
 if(s&&Number.isFinite(s.rifling))return Object.fromEntries(['rifling','sniping','entry','utility','positioning','shotcalling'].map(key=>[key,bounded(s[key]??50)])) as unknown as PlayerAttributes;
 return {rifling:bounded(s?.lan??50),sniping:bounded((s?.lan??50)*.55+(s?.clu??50)*.35+(s?.iq??50)*.1),entry:bounded((s?.lan??50)*.6+(s?.tf??50)*.4),utility:bounded(((s?.tf??50)+(s?.flx??50))/2),positioning:bounded(s?.iq??50),shotcalling:bounded(s?.ldr??s?.iq??50)};
}
export function normalizePlayerPersonality<T extends PlayerCard>(player:T):T {
 const personality=player.fpsIdentity?.personality?validateFpsPersonality(player.fpsIdentity.personality):generateFpsPersonality(player.id);
 const copy={...player,stats:migratePlayerAttributes(player.stats),personality:personality.name,fpsIdentity:player.fpsIdentity??{player_id:player.id,personality,mapping:'deterministic_id_v4',confidence:'natural preferences; insufficient match observations',observations:{risk:personality.playstyle,adaptability:personality.decisionStyle,preparation:personality.decisionStyle,team_orientation:personality.mindset}}};
 delete (copy as any).primaryPersonality;delete (copy as any).secondaryPersonality;
 return copy;
}
''',encoding='utf-8')
change('types.ts',lambda s:re.sub(r'^.*(?:primaryPersonality\?|secondaryPersonality\?).*\n','',s,flags=re.M).replace('/** Legacy presentation text; use primaryPersonality / secondaryPersonality for gameplay. */','/** Derived display label for the four personality dimensions. */'))
for name in ['mockData.ts','equalizedMode.ts']:
 change(name,lambda s:re.sub(r'^.*(?:primaryPersonality:|secondaryPersonality:).*\n','',s,flags=re.M))
p=b/'equalizedMode.ts';s=p.read_text(encoding='utf-8').replace("import { personalityOf } from './playerPersonality.ts';",'');a=s.index('    let traitScore = 0;');z=s.index('    const currentOrigins',a);s=s[:a]+'''    const traitScore=0; // Recruitment uses contextual tactical fit, never badge matching.
'''+s[z:];p.write_text(s,encoding='utf-8')
change('worldPlayerProfile.ts',lambda s:s.replace("'utility', 'utility'","'utility'"))
change('fps/fpsRoleFit.ts',lambda s:s.replace("|'utility'|'utility'","|'utility'").replace("return rankFpsRoleFits(stats)[0]?.name??'Unscouted';","if(!stats)return 'Unscouted';const labels:Record<string,string>={rifling:'Rifling',sniping:'Sniping',entry:'Entry',utility:'Utility',positioning:'Positioning',shotcalling:'Shotcalling'};const best=Object.keys(labels).filter(k=>Number.isFinite(stats[k as FpsSkillKey])).sort((a,b)=>stats[b as FpsSkillKey]!-stats[a as FpsSkillKey]!)[0];return best?labels[best]+' execution':'Unscouted';"))
(b/'components/FpsPlayerRole.tsx').write_text('''import {Crosshair} from 'lucide-react';
import {fpsRoleFit} from '../fps/fpsRoleFit';
import './role-label.css';
export function FpsPlayerRole({stats}:{stats?:Record<string,number>}){return <span className="role-label" title="Execution strength; tactical assignments are managed separately"><Crosshair size={13}/>{fpsRoleFit(stats)}</span>;}
''',encoding='utf-8')
change('fps/fpsLiveSimulation.ts',lambda s:s.replace("    return this.defenseSetup==='stack_b'", "    if(p.position==='CT_ANCHOR_A')return 'A';if(p.position==='CT_ANCHOR_B')return 'B';\n    return this.defenseSetup==='stack_b'")
 .replace("if((this.defenseSetup==='standard'||this.defenseSetup==='retake_setup')&&p.slot===2&&p.role!=='anchor')", "if((this.defenseSetup==='standard'||this.defenseSetup==='retake_setup')&&p.position==='CT_FLEX')")
 .replace("if((this.defenseSetup==='standard'||this.defenseSetup==='stack_b')&&p.slot===4)","if((this.defenseSetup==='standard'||this.defenseSetup==='stack_b')&&p.position==='CT_ANCHOR_B')"))
# Add decision-derived observations to recorded reports and match-local aggregates.
change('fps/fpsTypes.ts',lambda s:s.replace("  | 'tactical_decision'","  | 'behavior_observation'\n  | 'tactical_decision'").replace('  decision?: import(',"  observation?:{metric:import('./fpsPlayerArchitecture.ts').FpsBehaviorMetric;attempted:boolean};\n  decision?: import("))
p=b/'fps/fpsRoundSimulation.ts';s=p.read_text(encoding='utf-8');s="import {observeFpsBehavior,emptyFpsObservedBehavior,type FpsBehaviorMetric} from './fpsPlayerArchitecture.ts';\n"+s
needle="  const visible = (a: FpsPlayerState"
i=s.index(needle);s=s[:i]+'''  const observe=(p:FpsPlayerState,metric:FpsBehaviorMetric,attempted:boolean)=>{
    const identity=settings.identityExperiment?.players[p.playerId];if(!identity)return;
    identity.observed??=emptyFpsObservedBehavior();observeFpsBehavior(identity.observed,metric,attempted);
    emit('behavior_observation',`${p.name}: ${metric} ${attempted?'attempted':'declined'}`,{actorId:p.playerId,observation:{metric,attempted}});
  };
'''+s[i:]
s=s.replace("saving=decision.action==='save';", "saving=decision.action==='save';observe(leader,'retake',!saving);")
s=s.replace("              const direct=findFpsRoute", "              if(contact)observe(p,'engagement',['pressure','react'].includes(decision.action));\n              if(supported)observe(p,'coordination',decision.action==='coordinate');\n              if(compromised)observe(p,'failedExecuteAdjustment',decision.action==='improvise');\n              observe(p,'improvisation',decision.action==='improvise');\n              const direct=findFpsRoute")
s=s.replace("            choice={until:t+4,advance:decision.action!=='react'", "            observe(p,'rotation',decision.action!=='react');\n            choice={until:t+4,advance:decision.action!=='react'")
s=s.replace("p.loadout.utilities.shift(); utilityUsed++;", "p.loadout.utilities.shift(); utilityUsed++;observe(p,'utilitySupport',true);")
p.write_text(s,encoding='utf-8')
change('fps/fpsSimulationEngine.ts',lambda s:s.replace('  return {\n    version: 1,',"  for(const identity of Object.values(settings.identityExperiment!.players))if(identity.observed)identity.observed.matches++;\n  return {\n    version: 1,"))
# The worker only executes the current revision; historical result recordings remain readable.
p=Path('infrastructure/online/fps-match-worker.mjs');s=p.read_text(encoding='utf-8').replace('[2,3]','[4]').replace('simulation_version === 3','simulation_version === 4').replace('simulation_version===3','simulation_version===4');p.write_text(s,encoding='utf-8')
# Reject retired mechanics from new report submissions.
p=Path('EsportsClash.Api/app/Services/OnlineService.php');s=p.read_text(encoding='utf-8');a=s.index("            foreach($report['events'] as $event) if(($event['type']??null)==='specialty_activated')");z=s.index('\n            }',a)+len('\n            }');s=s[:a]+"            foreach($report['events'] as $event)if(($event['type']??null)==='specialty_activated')$this->invalid('Retired specialty telemetry is forbidden.');"+s[z:];p.write_text(s,encoding='utf-8')
for p in [Path('EsportsClash.Api/app/Services/AuctionDirectory.php'),Path('EsportsClash.Api/app/Http/Controllers/Api/V1/ClubMarketController.php'),Path('EsportsClash.Api/app/Services/AvatarpediaService.php')]:
 s=p.read_text(encoding='utf-8');s=re.sub(r",?'primaryPersonality'\s*=>[^,\n]+,?",',',s);s=re.sub(r",?'secondaryPersonality'\s*=>[^,\n]+,?",',',s);s=s.replace(',,',',');p.write_text(s,encoding='utf-8')
