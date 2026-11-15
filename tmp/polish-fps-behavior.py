from pathlib import Path
import re
b=Path('EsportsClash.Web/src')
def change(name,fn):
 p=b/name;p.write_text(fn(p.read_text(encoding='utf-8')),encoding='utf-8')
change('fps/fpsSimulationEngine.ts',lambda s:s.replace('    currentSecond += 0.33;','    // Metadata shares the current simulation timestamp; log volume cannot lengthen a round.').replace('currentSecond + .33 - roundStartedAt','currentSecond - roundStartedAt'))
change('fpsMatchSimulation.test.mjs',lambda s:s.replace("mindset:'TEAM_FIRST',decisionStyle:'METHODICAL'","mindset:'TEAM_FIRST',decisionStyle:personality==='aggressive'?'INSTINCTIVE':'METHODICAL'"))
change('fps/fpsLiveBrain.ts',lambda s:s.replace('export interface LiveApproachContext {',"export interface LiveApproachContext {\n  behavior?:import('./fpsPlayerArchitecture.ts').FpsBehaviorPreferences;decision?:string;")
 .replace('return {candidate,score:roleValue-',"const behavior=context.behavior;\n    const preference=!behavior?0:candidate.purpose==='entry'?(behavior.initiative-.5)*1.2+(context.decision==='pressure'?.8:0):candidate.purpose==='flank'?(1-behavior.coordination)*.5+(context.decision==='improvise'?.8:0):candidate.purpose==='control'?(.5-behavior.initiative)*.6:behavior.deliberation*.2;\n    return {candidate,score:roleValue+preference-"))
change('fps/fpsLiveSimulation.ts',lambda s:s.replace('judgment,\n            allies:','judgment,behavior:fpsBehaviorPreferences(identity.personality),decision:p.decision,\n            allies:')
 .replace("!p.bomb&&front&&['trade','support','caller'].includes(p.role)","!p.bomb&&front&&p.decision!=='pressure'&&p.decision!=='improvise'&&['trade','support','caller'].includes(p.role)")
 .replace("if(seen.length||memoryFresh){observeFpsBehavior", "if(seen.length){observeFpsBehavior")
 .replace("      {action:'react',legal:!cannotDefuse", "      {action:'improvise',legal:!cannotDefuse&&memoryFresh&&!p.target,tacticalValue:.25,instruction:team.plan.freedom},\n      {action:'react',legal:!cannotDefuse")
 .replace("      if(memoryFresh&&p.flash+p.smoke+p.incendiary+p.he>0)observeFpsBehavior(p.behavior,'utilitySupport',decision==='coordinate');", """      if(memoryFresh&&p.flash+p.smoke+p.incendiary+p.he>0)observeFpsBehavior(p.behavior,'utilitySupport',decision==='coordinate');
      if(activeCall.responders.includes(p.id)&&['rotate','reinforce'].includes(activeCall.mode))observeFpsBehavior(p.behavior,'rotation',decision==='react'||decision==='coordinate'||decision==='pressure');
      if(memoryFresh&&!p.target)observeFpsBehavior(p.behavior,'improvisation',decision==='improvise');
      if(p.position==='T_LURKER'&&executing)observeFpsBehavior(p.behavior,'lurkTiming',decision==='pressure'||decision==='improvise');
      if(seen.length&&allies.some(a=>a!==p&&(a.channel>0||a.reload>0)&&distance(p,a)<12))observeFpsBehavior(p.behavior,'sacrifice',decision==='coordinate');
      if(this.bomb.status==='planted'&&!p.attacking&&!cannotDefuse)observeFpsBehavior(p.behavior,'retake',decision!=='save');
"""))
# Remove now-unused specialty opportunity calculations, including their obsolete hidden-state reads.
p=b/'fps/fpsRoundSimulation.ts';s=p.read_text(encoding='utf-8');s=re.sub(r'        const utilityOpportunities=.*?        const utilityFactor=1;','        const utilityFactor=1;',s,flags=re.S)
a=s.index('      const opportunities = new Set<');z=s.index('      const accuracy =',a);s=s[:a]+s[z:];s=s.replace('type FpsTacticalOpportunity, ','');p.write_text(s,encoding='utf-8')
p=b/'fps/fpsLiveSimulation.ts';s=p.read_text(encoding='utf-8');a=s.index('    const opportunities=new Set<');z=s.index('    const movement=',a);s=s[:a]+s[z:];s=s.replace(', type FpsTacticalOpportunity','');p.write_text(s,encoding='utf-8')
# Intensity and opportunity cards are retired; four dimensions are the single behavioral source.
for p in [*list((b/'fps').glob('*.ts')),*list((b/'components').glob('Fps*.tsx'))]:
 s=p.read_text(encoding='utf-8');s=re.sub(r'\bintensity:\s*number;','',s);s=re.sub(r'\bintensity:\s*\.?\d+(?:\.\d+)?\s*,','',s);s=re.sub(r'intensity:\.4\+generatePlayerDNA\(card.id\).competitiveDrive/200,','',s)
 p.write_text(s,encoding='utf-8')
# Persistent generated-player identity does not require a preliminary match allocation.
# Training and coaching retain private DNA records but do not add a second source of personality choices.
p=b/'fps/fpsIdentity.ts';s=p.read_text(encoding='utf-8');start=s.index('export function evolveFpsTeamIdentity(');s=s[:start]+'''export function evolveFpsTeamIdentity(current:FpsTeamIdentity,coach:FpsCoach,plan:FpsGameplan,roster:readonly FpsPersonality[]):FpsTeamIdentity {
 const preferences=roster.map(fpsBehaviorPreferences),mean=(key:'initiative'|'coordination'|'deliberation')=>preferences.length?preferences.reduce((n,p)=>n+p[key],0)/preferences.length:.5;
 const shift=(old:number,target:number)=>clamp01(old+Math.max(-.01,Math.min(.01,(target-old)*.03)));
 return {tempo:shift(current.tempo,(coach.tempo+plan.tempo+mean('initiative'))/3),structure:shift(current.structure,(coach.rigidity+plan.structure+mean('coordination'))/3),aggression:shift(current.aggression,(coach.aggression+plan.aggression+mean('initiative'))/3),preparation:shift(current.preparation,(coach.preparation+plan.preparation+mean('deliberation'))/3),freedom:shift(current.freedom,(coach.freedom+plan.freedom+1-mean('deliberation'))/3),economy:shift(current.economy,(coach.economy+plan.economy+.5)/3)};
}
''';p.write_text(s,encoding='utf-8')
change('fps/fpsSimulationEngine.ts',lambda s:s.replace('identities.map(p=>p.dna)','identities.map(p=>p.personality)').replace('1,identity.dna.adaptability/100','1,.5'))
# Cross-language natural preferences also drive slow team culture changes.
p=Path('EsportsClash.Api/app/Services/FpsIdentityEngine.php');s=p.read_text(encoding='utf-8');s=re.sub(r"\s*'intensity'=>\.5,",'',s);a=s.index("                $trait=match($key)");z=s.index("                $target=",a);s=s[:a]+'''                $roster=array_sum(array_map(function($id)use($pin,$key){$p=$pin['players'][$id]['personality'];return match($key){'tempo','aggression'=>match($p['playstyle']){'AGGRESSIVE'=>.9,'PASSIVE'=>.1,default=>.5},'structure'=>$p['mindset']==='TEAM_FIRST'?.85:.25,'preparation'=>match($p['decisionStyle']){'METHODICAL'=>.85,'INSTINCTIVE'=>.15,default=>.5},'freedom'=>match($p['decisionStyle']){'METHODICAL'=>.15,'INSTINCTIVE'=>.85,default=>.5},default=>.5};},$ids))/count($ids);
'''+s[z:];s=s.replace(".003*$dna['adaptability']/100",'.003*.5');p.write_text(s,encoding='utf-8')
