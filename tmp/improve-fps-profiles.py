from pathlib import Path
import re
b=Path('EsportsClash.Web/src')
p=b/'components/FpsSimulationLab.tsx';s=p.read_text(encoding='utf-8').replace('type FpsCoach,type FpsGameplan','type FpsAssignments,type FpsPersonality,type FpsCoach,type FpsGameplan')
s=s.replace('FPS_IDENTITY_PERSONALITIES,defaultFpsAssignments,','FPS_IDENTITY_PERSONALITIES,FPS_T_POSITIONS,FPS_CT_POSITIONS,FPS_POSITION_LABELS,defaultFpsAssignments,')
s=s.replace('Record<string,{personality:string}>','Record<string,{personality:string;assignments:FpsAssignments}>')
s=s.replace('{personality:FPS_IDENTITY_PERSONALITIES[index % FPS_IDENTITY_PERSONALITIES.length].id}',"{personality:FPS_IDENTITY_PERSONALITIES[index % FPS_IDENTITY_PERSONALITIES.length].id,assignments:defaultFpsAssignments((index<5?blueRoster:redRoster).map(p=>p.id))[card.id]}")
s=s.replace("assignments:(defaultFpsAssignments((blue.some(p=>p.id===card.id)?blue:red).map(p=>p.id)))[card.id]", "assignments:{...identities[card.id].assignments}")
old='<label>Personality<select value={identities[card.id].personality} onChange={e=>setIdentities(previous=>({...previous,[card.id]:{...previous[card.id],personality:e.target.value}}))}>{FPS_IDENTITY_PERSONALITIES.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>'
new='''{Object.entries(FPS_PERSONALITY_DIMENSIONS).map(([dimension,values])=><label key={dimension}>{dimension==='decisionStyle'?'Decision Style':personalityLabel(dimension)}<select value={FPS_IDENTITY_PERSONALITIES.find(p=>p.id===identities[card.id].personality)![dimension as keyof typeof FPS_PERSONALITY_DIMENSIONS]} onChange={e=>setIdentities(previous=>({...previous,[card.id]:{...previous[card.id],personality:validateFpsPersonality({...FPS_IDENTITY_PERSONALITIES.find(p=>p.id===previous[card.id].personality)!,[dimension]:e.target.value}).id}}))}>{values.map(value=><option key={value} value={value}>{personalityLabel(value)}</option>)}</select></label>)}{(['t','ct'] as const).map(side=><label key={side}>{side.toUpperCase()} position<select value={identities[card.id].assignments[side]} onChange={e=>setIdentities(previous=>{const next=e.target.value as FpsAssignments[typeof side],old=previous[card.id].assignments[side],partner=roster.slice(index<5?0:5,index<5?5:10).find(p=>previous[p.id].assignments[side]===next)!;return {...previous,[card.id]:{...previous[card.id],assignments:{...previous[card.id].assignments,[side]:next}},[partner.id]:{...previous[partner.id],assignments:{...previous[partner.id].assignments,[side]:old}}};})}>{(side==='t'?FPS_T_POSITIONS:FPS_CT_POSITIONS).map(position=><option key={position} value={position}>{FPS_POSITION_LABELS[position]}</option>)}</select></label>)}'''
assert old in s;s=s.replace(old,new);p.write_text(s,encoding='utf-8')
p=b/'components/FpsLiveBroadcast.tsx';s=p.read_text(encoding='utf-8');s="import {FPS_POSITION_LABELS} from '../fps/fpsPlayerArchitecture';\n"+s;s=s.replace('<small>{p.role}</small>',"<small title={p.naturalIdentity}>{p.position?FPS_POSITION_LABELS[p.position]:p.role}</small>");p.write_text(s,encoding='utf-8')
p=b/'playerTraits.test.mjs';p.write_text('''import test from 'node:test';
import assert from 'node:assert/strict';
import {FPS_IDENTITY_PERSONALITIES} from './fps/fpsPlayerArchitecture.ts';
import {getFpsPreferences} from './fps/fpsPersonality.ts';
test('all 54 preference sets remain independent of execution attributes and kills',()=>{
 for(const personality of FPS_IDENTITY_PERSONALITIES){const card={id:'identity',fpsIdentity:{personality},stats:{rifling:1,sniping:1,entry:1,utility:1,positioning:1,shotcalling:1}};const expert={...card,kills:1000,stats:Object.fromEntries(Object.keys(card.stats).map(k=>[k,99]))};assert.deepEqual(getFpsPreferences(card),getFpsPreferences(expert));}
});
''',encoding='utf-8')
# Contextual assignments on the public player profile, without exposing private DNA.
p=Path('EsportsClash.Api/app/Services/FpsIdentityProfiles.php');s=p.read_text(encoding='utf-8');i=s.index('    public function scouting(');s=s[:i]+'''    public function assignmentsFor(OwnedPlayerCard $player): ?array
    {
        $club=\\App\\Models\\OnlineClub::where('user_id',$player->user_id)->first();if(!$club)return null;
        $ids=array_column($club->starters??$club->lineup,'instance_id');if(!in_array($player->id,$ids,true))return null;
        $orders=json_decode(DB::table('fps_team_systems')->where('club_id',$club->id)->value('instructions')??'{}',true);
        return app(FpsPlayerArchitecture::class)->assignments($ids,$orders)[$player->id];
    }
'''+s[i:];p.write_text(s,encoding='utf-8')
p=Path('EsportsClash.Api/app/Services/WorldPlayerProfiles.php');s=p.read_text(encoding='utf-8').replace("if($identity)$out['fpsIdentity']=app(FpsIdentityProfiles::class)->scouting($identity);", "if($identity)$out['fpsIdentity']=[...app(FpsIdentityProfiles::class)->scouting($identity),'assignments'=>app(FpsIdentityProfiles::class)->assignmentsFor($player)];");p.write_text(s,encoding='utf-8')
p=Path('EsportsClash.Api/app/Services/FpsIdentityEngine.php');s=p.read_text(encoding='utf-8').replace("$role=$snapshot['tactics']['role']??null;", "$role=$snapshot['tactics']['position']??null;")
s=s.replace("$value=$dev['role_familiarity'][$focus]??0;$dev['role_familiarity'][$focus]=$value+(1-$value)*$amount;", "$value=$dev['attribute_practice'][$focus]??0;$dev['attribute_practice'][$focus]=$value+(1-$value)*$amount;")
p.write_text(s,encoding='utf-8')
p=Path('EsportsClash.Api/tests/Feature/FpsIdentityTest.php');s=p.read_text(encoding='utf-8').replace("['role'=>'trade']","['role'=>'trade','position'=>'T_FLEX']").replace("$dev['role_familiarity']['trade']","$dev['role_familiarity']['T_FLEX']");p.write_text(s,encoding='utf-8')
