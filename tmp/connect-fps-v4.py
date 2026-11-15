from pathlib import Path
import re
base=Path('EsportsClash.Web/src')
def edit(file,fn):
 p=base/file;p.write_text(fn(p.read_text(encoding='utf-8')),encoding='utf-8')
edit('types.ts',lambda s:re.sub(r'export interface PlayerAttributes \{.*?\n\}', '''export interface PlayerAttributes {
  rifling:number; sniping:number; entry:number; utility:number; positioning:number; shotcalling:number;
}''',s,count=1,flags=re.S))
edit('marketBatchEngine.ts',lambda s:s.replace(')), Math.min(99, baseStat99 + jitter())),',')),').replace('(stats.rifling + stats.entry + stats.positioning + stats.sniping + stats.utility + stats.utility + stats.shotcalling) / 7','(stats.rifling + stats.entry + stats.positioning + stats.sniping + stats.utility + stats.shotcalling) / 6'))
edit('rosterResearch.ts',lambda s:s.replace('), ovr + (index % 6) - 3),','), shotcalling: positioning,'))
edit('fps/fpsLiveAttributes.ts',lambda s:s.replace('clutch:unit(stats.sniping),stamina:unit(stats.utility),flexibility:unit(stats.utility)','clutch:.5,stamina:.5,flexibility:.5'))
edit('fps/fpsLiveSimulation.ts',lambda s:s.replace('pinFpsSkillProfile, fpsAbilityUnit','estimateLegacyFpsSkillProfile, pinFpsSkillProfile, fpsAbilityUnit')
 .replace("import { FPS_ROLES } from './fpsRoleFit.ts';", "import {fpsExecutionRole,naturalFpsIdentity,fpsBehaviorPreferences,emptyFpsObservedBehavior,observeFpsBehavior,observedFpsIdentity,type FpsPosition,type FpsObservedBehavior} from './fpsPlayerArchitecture.ts';")
 .replace('this.detailed=options.skillProfiles!==undefined;','this.detailed=true;')
 .replace('profile:options.skillProfiles?pinFpsSkillProfile(options.skillProfiles[card.id],card.id):undefined,',"profile:options.skillProfiles?pinFpsSkillProfile(options.skillProfiles[card.id],card.id):pinFpsSkillProfile(estimateLegacyFpsSkillProfile(card.id,card.stats,seed,'2026-11-14T00:00:00.000Z'),card.id),")
 .replace("personality:string; lastShot:number;", "personality:string;position?:FpsPosition;naturalIdentity?:string;observedIdentity?:string;behavior?:FpsObservedBehavior;lastShot:number;")
 .replace('personality:this.identity.players[card.id].personality.name,','personality:this.identity.players[card.id].personality.name,behavior:emptyFpsObservedBehavior(),')
 .replace('blinded:number; channel:number; personality:string; specialty?:string;', 'blinded:number; channel:number; personality:string;')
 .replace("if(!this.identity.players[p.id].assignedRole){if(!p.attacking&&p.role==='entry')p.role='anchor';else if(p.attacking&&p.role==='anchor')p.role='entry';}","p.position=this.identity.players[p.id].assignments![p.attacking?'t':'ct'];p.role=fpsExecutionRole(p.position);p.naturalIdentity=naturalFpsIdentity(this.identity.players[p.id].personality,p.position);")
 .replace('personality:p.personality,lastShot:', 'personality:p.personality,position:p.position,naturalIdentity:p.naturalIdentity,observedIdentity:observedFpsIdentity(p.behavior),behavior:structuredClone(p.behavior),lastShot:'))
p=base/'fps/fpsLiveSimulation.ts';s=p.read_text(encoding='utf-8');start=s.index('    // Role assignment uses skills');end=s.index('    this.startRound();',start);s=s[:start]+s[end:]
# Match-local opportunity counts: one observation per selected decision, never from kills or damage.
needle="    if(this.time>=(p.shotCommitUntil??0)||p.hp<35||p.reload>0)p.decision=decision;"
s=s.replace(needle,needle+'''
    if(p.behavior){
      if(seen.length||memoryFresh){observeFpsBehavior(p.behavior,'engagement',decision==='pressure'||decision==='react');observeFpsBehavior(p.behavior,'risk',decision==='pressure');}
      if(allies.some(a=>a!==p&&distance(p,a)<16)){observeFpsBehavior(p.behavior,'coordination',decision==='coordinate');observeFpsBehavior(p.behavior,'strategyCompliance',decision==='coordinate'||decision==='prepare');}
      if(executing&&!p.bomb)observeFpsBehavior(p.behavior,'firstContact',decision==='pressure');
      if(memoryFresh&&p.flash+p.smoke+p.incendiary+p.he>0)observeFpsBehavior(p.behavior,'utilitySupport',decision==='coordinate');
    }
''')
s=s.replace("const delay=(1-this.skill(p,'adaptability',p.skills.flexibility))*1.6", "const delay=.2+(1-fpsBehaviorPreferences(this.identity.players[p.id].personality).reassessment)*1.6")
# Temperament changes willingness under pressure, never shot spread.
s=s.replace("confidence:p.profile?.55:clamp(.55-p.pressure*(1-p.skills.clutch)*.2,.1,.9)","confidence:clamp(.5+(this.score[p.team]-this.score[other(p.team)])*.025-this.losses[p.team]*.04,.1,.9)")
p.write_text(s,encoding='utf-8')
edit('fps/fpsSimulationEngine.ts',lambda s:s.replace('assignContextualRoles,hydrateFpsIdentityContext','createFpsIdentityContext,assignContextualRoles,hydrateFpsIdentityContext')
 .replace('const initialIdentity=settings.identityExperiment ? hydrateFpsIdentityContext(settings.identityExperiment,[...blueRoster,...redRoster].map(p=>p.id)) : undefined;', 'const initialIdentity=hydrateFpsIdentityContext(settings.identityExperiment??createFpsIdentityContext(blueRoster,redRoster),[...blueRoster,...redRoster].map(p=>p.id));')
 .replace('simulationVersion: settings.identityExperiment ? 3 : 2','simulationVersion: 4'))
edit('fps/fpsTypes.ts',lambda s:s.replace("  | 'specialty_activated'\n",'').replace('  specialtyId?: string;\n','').replace('  executionBonus?: number;\n','').replace('simulationVersion?: 2 | 3','simulationVersion?: 2 | 3 | 4'))
edit('fps/fpsRoundSimulation.ts',lambda s:s.replace('p.card.stats.rifling/150',"(weapon.category==='sniper'?p.card.stats.sniping:p.card.stats.rifling)/150").replace('const fatigue = Math.max(.8, 1-Math.max(0,roundNumber-15)*(.0015+(100-p.card.stats.utility)*.000025));','const fatigue=Math.max(.9,1-Math.max(0,roundNumber-15)*.002);').replace("const flex = weapon.category === 'sidearm' || weapon.category === 'smg' ? .85+p.card.stats.utility*.0015 : 1;",'const flex=1;'))
edit('components/FpsSkillEditor.tsx',lambda s:s.replace('generateFpsSkillProfile, validateFpsSkillProfile','generateFpsSkillProfile, migrateFpsSkillProfile, validateFpsSkillProfile').replace("const storageKey='hexatrick:fps-skill-lab:v1'","const storageKey='hexatrick:fps-skill-lab:v2'")
 .replace("localStorage.getItem(storageKey)??'{}'","localStorage.getItem(storageKey)??localStorage.getItem('hexatrick:fps-skill-lab:v1')??'{}'")
 .replace('validateFpsSkillProfile(saved[card.id],card.id)','migrateFpsSkillProfile(saved[card.id],card.id)').replace('lab-custom-v1','lab-custom-v2').replace('lab-generated-v1','lab-generated-v2').replace('legacy_estimate_v1','migrated-25-v1').replace('hexatrick-fps-skill-lab-v1','hexatrick-fps-skill-lab-v2').replace('25 skills','6 attributes').replace('25-ability','six-attribute')
 .replace('Twenty-four abilities affect live behavior; Economy Judgment is reserved while team policy controls purchases.','Six attributes control execution quality. Personality and assignments guide intentions.')
 .replace("group==='tactical'?'Tactics & information':group==='team'?'Team execution':group==='mental'?'Mental & endurance':'Execution'", "'Core attributes'"))
