from pathlib import Path
import re
b=Path('EsportsClash.Api')
p=b/'app/Services/FpsIdentityProfiles.php';s=p.read_text(encoding='utf-8');a=s.index('    public function dna(');z=s.index('    /** Initial estimates',a);dna=s[a:z]
p.write_text('''<?php
namespace App\\Services;
use App\\Models\\OwnedPlayerCard;
use Illuminate\\Support\\Facades\\DB;
class FpsIdentityProfiles
{
'''+dna+'''
    public function initialize(OwnedPlayerCard $player,array $definition,bool $newIdentity=false): void
    {
        DB::table('fps_player_identities')->insertOrIgnore(['player_id'=>$player->id,'schema_version'=>4,
            'dna'=>json_encode($this->dna($player->id),JSON_THROW_ON_ERROR),
            'personality'=>json_encode(app(FpsPlayerArchitecture::class)->generate($player->id),JSON_THROW_ON_ERROR),
            'behavior'=>json_encode(['version'=>4,'matches'=>0,'metrics'=>(object)[]]),
            'development'=>json_encode(['familiarity'=>0,'role_familiarity'=>(object)[],'mapping'=>'deterministic_id_v4']),
            'created_at'=>now(),'updated_at'=>now()]);
    }
    public function scouting(object $row,?array $plan=null,?array $coach=null): array
    {
        $p=app(FpsPlayerArchitecture::class)->personality(json_decode($row->personality,true,512,JSON_THROW_ON_ERROR));
        $dev=json_decode($row->development,true);$behavior=json_decode($row->behavior??'null',true);
        $initiative=match($p['playstyle']){'AGGRESSIVE'=>.9,'PASSIVE'=>.1,default=>.5};
        $deliberation=match($p['decisionStyle']){'METHODICAL'=>.85,'INSTINCTIVE'=>.15,default=>.5};
        $coordination=$p['mindset']==='TEAM_FIRST'?.85:.25;
        $describe=fn($fit)=>$fit>=.75?'promising':($fit>=.55?'mixed':'potential friction');
        $gameplanFit=$plan?$describe((4-abs($initiative-$plan['aggression'])-abs($deliberation-$plan['preparation'])-abs($coordination-$plan['structure'])-abs(1-$deliberation-$plan['freedom']))/4):null;
        $coachFit=$coach?$describe((4-abs($initiative-$coach['aggression'])-abs($deliberation-$coach['preparation'])-abs($coordination-$coach['communication'])-abs(1-$deliberation-$coach['freedom']))/4):null;
        $appearances=$behavior['matches']??0;$sufficient=$appearances>=5&&($behavior['metrics']['engagement']['opportunities']??0)>=30;
        return ['player_id'=>$row->player_id,'personality'=>$p,'observed'=>$sufficient?$behavior:null,
            'mapping'=>$dev['mapping']??'deterministic_id_v4','confidence'=>$sufficient?'observed':'natural preferences; insufficient match observations',
            'appearances'=>$appearances,'gameplan_fit'=>$gameplanFit,'coach_fit'=>$coachFit,'role_familiarity'=>$dev['role_familiarity']??(object)[],
            'familiarity'=>($dev['familiarity']??0)>.3?'learning':'new system','recent_observations'=>$sufficient?($dev['recent_observations']??[]):[],
            'observations'=>['risk'=>strtolower($p['playstyle']),'adaptability'=>'universal; '.strtolower($p['decisionStyle']).' reassessment','preparation'=>$deliberation>.7?'deliberate':'contextual','team_orientation'=>strtolower($p['mindset']),'pressure_response'=>strtolower($p['temperament'])]];
    }
}
''',encoding='utf-8')
p=b/'app/Services/FpsIdentityEngine.php';s=p.read_text(encoding='utf-8').replace("return Schema::hasTable('fps_identity_applications');","return Schema::hasColumn('fps_player_identities','personality');")
s=s.replace("$coach=$this->coach($club); $ids=array_column($slots,'instance_id');","$coach=$this->coach($club); $ids=array_column($slots,'instance_id');\n            $assignments=app(FpsPlayerArchitecture::class)->assignments($ids,$instructions);")
a=s.index("                $players[$player->id]=");z=s.index('\n            }',a)
s=s[:a]+'''                $players[$player->id]=['id'=>$player->id,'personality'=>json_decode($row->personality,true),'assignments'=>$assignments[$player->id],
                    'observed'=>json_decode($row->behavior??'null',true),'dna'=>$dna,'intensity'=>.5,
                    'roleSuitability'=>.5,'familiarity'=>$familiarity,'roleFamiliarity'=>$development['role_familiarity']??[],
                    'instruction'=>$instructions[$player->id]['instruction']??'balanced','trainingFocus'=>$instructions[$player->id]['training']??'system'];'''+s[z:]
s=s.replace("return ['schema'=>1,","return ['schema'=>4,").replace("!==3)","!==4)").replace("!==3)return","!==4)return")
a=s.index("                $activations=count(");z=s.index("                $dev['appearances']",a);s=s[:a]+'''                $behavior=json_decode($row->behavior??'null',true)??['version'=>4,'matches'=>0,'metrics'=>[]];
                $behavior['matches']++;
                foreach($events as $event)if(($event['type']??'')==='behavior_observation'&&($event['actorId']??null)===$id){
                    $o=$event['observation'];$metric=$o['metric'];$item=$behavior['metrics'][$metric]??['opportunities'=>0,'attempts'=>0];
                    $item['opportunities']++;if($o['attempted'])$item['attempts']++;$behavior['metrics'][$metric]=$item;
                }
'''+s[z:]
s=s.replace("['tactical_decision','specialty_activated']","['tactical_decision']").replace("'development'=>json_encode($dev),'updated_at'=>now()","'development'=>json_encode($dev),'behavior'=>json_encode($behavior),'updated_at'=>now()",1)
a=s.index("        if($focus==='specialty')");z=s.index("            $value=$dev['role_familiarity']",a);s=s[:a]+"        if($focus!=='system') {\n"+s[z:]
p.write_text(s,encoding='utf-8')
# Six attributes through generation, training, scouting and manager evaluation.
mapping={'lan':'rifling','tf':'entry','iq':'positioning','clu':'sniping','sta':'utility','flx':'utility','ldr':'shotcalling'}
for p in (b/'app').rglob('*.php'):
 if p.name in ['FpsPlayerArchitecture.php']:continue
 s=p.read_text(encoding='utf-8')
 for key,value in mapping.items():s=s.replace("'"+key+"'","'"+value+"'").replace('"'+key+'"','"'+value+'"')
 s=s.replace("'utility', 'utility'","'utility'").replace("'utility','utility'","'utility'")
 p.write_text(s,encoding='utf-8')
p=b/'app/Services/OnlineService.php';s=p.read_text(encoding='utf-8').replace("$plan['fps']['simulation_version']=3;","$plan['fps']['simulation_version']=4;").replace("($fps['simulation_version']??0)===3","($fps['simulation_version']??0)>=3")
# Obsolete specialty telemetry is forbidden in new reports, rather than interpreted.
a=s.index("            foreach ($events as $event) if (($event['type']??'')==='specialty_activated')") if "            foreach ($events as $event) if (($event['type']??'')==='specialty_activated')" in s else -1
if a!=-1:
 z=s.index('\n            }',a)+len('\n            }');s=s[:a]+'''            foreach($events as $event)if(($event['type']??'')==='specialty_activated')$this->invalid('Retired specialty telemetry is forbidden.');'''+s[z:]
p.write_text(s,encoding='utf-8')
p=b/'app/Services/AuctionDirectory.php';s=p.read_text(encoding='utf-8');s=re.sub(r"  if\(\$filters\['personality'\].*?\n", "  if($filters['personality']??null){$q->whereIn('p.id',DB::table('fps_player_identities')->where('personality','like','%'.$filters['personality'].'%')->select('player_id'));}\n",s);p.write_text(s,encoding='utf-8')
