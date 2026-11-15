from pathlib import Path
import re
b=Path('EsportsClash.Web/src')
def change(name,fn):
 p=b/name;p.write_text(fn(p.read_text(encoding='utf-8')),encoding='utf-8')
# Sniping governs sniper execution through the same physical resolver.
change('fps/fpsDetailedExecution.ts',lambda s:s.replace("key:FpsExecutionChannel)=>fpsAbilityUnit(p,key)","key:FpsExecutionChannel,sniper=false)=>fpsAbilityUnit(p,key,sniper)")
 .replace('detailedReactionDelay=(p:FpsSkillProfile)=>','detailedReactionDelay=(p:FpsSkillProfile,sniper=false)=>').replace("ability(p,'reactions')","ability(p,'reactions',sniper)")
 .replace("phase:'flick'|'track'|'fine',dt:number)","phase:'flick'|'track'|'fine',dt:number,sniper=false)").replace('skill=ability(p,key);','skill=ability(p,key,sniper);')
 .replace('pressure:number,random:()=>number):number','pressure:number,random:()=>number,sniper=false):number').replace("ability(p,'precision')","ability(p,'precision',sniper)")
 .replace('preparedAngleError=(p:FpsSkillProfile,random:()=>number)=>','preparedAngleError=(p:FpsSkillProfile,random:()=>number,sniper=false)=>').replace("ability(p,'crosshairPlacement')","ability(p,'crosshairPlacement',sniper)"))
change('fps/fpsLiveSimulation.ts',lambda s:s.replace('detailedReactionDelay(p.profile)','detailedReactionDelay(p.profile,LIVE_WEAPONS[p.weapon].category===\'sniper\')').replace('p.profile,phase,LIVE_FPS_STEP)','p.profile,phase,LIVE_FPS_STEP,LIVE_WEAPONS[p.weapon].category===\'sniper\')').replace('preparedAngleError(p.profile,this.executionRandom)','preparedAngleError(p.profile,this.executionRandom,LIVE_WEAPONS[p.weapon].category===\'sniper\')').replace('detailedInputError(p.profile,p.pressure,this.executionRandom)','detailedInputError(p.profile,p.pressure,this.executionRandom,LIVE_WEAPONS[p.weapon].category===\'sniper\')')
 .replace("p.position=this.identity.players[p.id].assignments![p.attacking?'t':'ct'];p.role=fpsExecutionRole(p.position);", "p.position=this.identity.players[p.id].assignments![p.attacking?'t':'ct'];p.role=fpsExecutionRole(p.position);p.preferSniper=p.position.endsWith('FLEX')&&p.profile!.values.sniping>p.profile!.values.rifling;")
 .replace('  pitch:number;\n','  pitch:number;preferSniper?:boolean;\n',1))
change('fps/fpsLiveEconomy.ts',lambda s:s.replace('export interface LiveBuyPlayer {','export interface LiveBuyPlayer {preferSniper?:boolean;').replace('he,attacking})','he,attacking,preferSniper})').replace('he,attacking,utilityStock','he,attacking,preferSniper,utilityStock').replace("receiver.role==='sniper'","(receiver.role==='sniper'||receiver.preferSniper)"))
# Personality scouting is separate from rating-based execution recommendations.
for p in b.rglob('*.ts*'):
 if p.name=='playerPersonality.ts':continue
 s=p.read_text(encoding='utf-8');s=re.sub(r'(?:primaryPersonality|secondaryPersonality)\?:\s*(?:string\s*\|\s*null|string)\s*;?','',s)
 p.write_text(s,encoding='utf-8')
p=Path('EsportsClash.Api/app/Http/Controllers/Api/V1/FpsTacticalSystemController.php');s=p.read_text(encoding='utf-8').replace("['array:role,instruction,training']","['array:t,ct,instruction,training']").replace("$rules['instructions.*.role']=['nullable','in:entry,caller,sniper,support,lurker,anchor,trade'];", "$rules['instructions.*.t']=['sometimes','in:T_IGL,T_ENTRY,T_SUPPORT,T_LURKER,T_FLEX'];\n        $rules['instructions.*.ct']=['sometimes','in:CT_IGL,CT_ROTATOR,CT_ANCHOR_A,CT_ANCHOR_B,CT_FLEX'];")
s=s.replace('in:system,specialty,entry,caller,sniper,support,lurker,anchor,trade','in:system,rifling,sniping,entry,utility,positioning,shotcalling')
s=s.replace("        return DB::transaction(function () use ($club,$data)","        $ids=array_column($club->starters??$club->lineup,'instance_id');\n        app(\\App\\Services\\FpsPlayerArchitecture::class)->assignments($ids,$data['instructions']??[]);\n        return DB::transaction(function () use ($club,$data)")
p.write_text(s,encoding='utf-8')
p=Path('EsportsClash.Api/app/Console/Commands/FpsIdentityRelease.php');s=p.read_text(encoding='utf-8').replace("whereNull('personality_id')","whereNull('personality')").replace('between v2 and v3','for tactical architecture v4');p.write_text(s,encoding='utf-8')
# Catalog mutation must address the actual payload array rather than a temporary expression.
p=Path('EsportsClash.Api/database/migrations/2026_11_14_000001_replace_fps_player_architecture.php');s=p.read_text(encoding='utf-8').replace("foreach($payload['cards']??[] as &$card)","foreach($payload['cards'] as &$card)");p.write_text(s,encoding='utf-8')
# Existing regression fixtures now pin both side assignments explicitly.
for p in b.glob('*.test.mjs'):
 if p.name in ['fpsIdentity.test.mjs','fpsPersonality.test.mjs','fpsSkillProfile.test.mjs','playerPersonality.test.mjs']:continue
 s=p.read_text(encoding='utf-8')
 if 'FPS_IDENTITY_PERSONALITIES' in s:
  s="import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';\n"+s
  s=re.sub(r'personality:\s*FPS_IDENTITY_PERSONALITIES\[([^\]]+)\]',lambda m:"assignments:{t:FPS_T_POSITIONS[("+('i' if re.search(r'\bi\b',m[1]) else 'index' if 'index' in m[1] else '0')+")%5],ct:FPS_CT_POSITIONS[("+('i' if re.search(r'\bi\b',m[1]) else 'index' if 'index' in m[1] else '0')+")%5]},"+m.group(0),s)
  # Named legacy personality lookups have no equivalent. Tests use a declared new profile.
  s=re.sub(r"FPS_IDENTITY_PERSONALITIES\.find\([^;\n]+?\)\s*\!?(?=[,}])",'FPS_IDENTITY_PERSONALITIES[0]',s)
 p.write_text(s,encoding='utf-8')
