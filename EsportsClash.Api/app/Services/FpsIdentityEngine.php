<?php

namespace App\Services;

use App\Models\{OnlineClub, OnlineMatch, OwnedPlayerCard};
use Illuminate\Support\Facades\{DB, Schema};

/** Private allocation inputs and event-derived, idempotent career progression. */
class FpsIdentityEngine
{
    public const PLAN = ['tempo'=>.5,'structure'=>.5,'aggression'=>.5,'preparation'=>.5,'freedom'=>.5,'economy'=>.5];
    public const CHEMISTRY = ['trust'=>.5,'communication'=>.5,'understanding'=>.5,'leadershipAcceptance'=>.5,'roleCompetition'=>.5];

    public function ready(): bool { return Schema::hasTable('fps_identity_applications'); }
    public function enabled(): bool { return $this->ready() && (bool) DB::table('fps_identity_settings')->where('id',1)->value('enabled'); }

    public function coach(OnlineClub $club): array
    {
        $staff=app(ClubStaffService::class)->snapshot($club);
        $head=$staff['head_coach'];
        $member=\App\Models\ClubStaff::where('club_id',$club->id)->where('role','head_coach')->firstOrFail();
        $key=$member->contract_id ? (DB::table('club_staff_contracts')->where('id',$member->contract_id)->value('candidate_key')??'staff:'.$member->id) : 'staff:'.$member->id.':founding';
        $dna=app(FpsIdentityProfiles::class)->dna('coach:'.$key);
        // Philosophy is a stable preference of the employed person, not a rating bonus.
        return ['key'=>hash('sha256',$key),'name'=>$head['name'],'profile'=>[
            'tempo'=>$dna['riskTolerance']/100,'rigidity'=>$dna['tacticalDiscipline']/100,
            'aggression'=>$dna['competitiveDrive']/100,'preparation'=>$dna['preparationPreference']/100,
            'freedom'=>$dna['creativity']/100,'economy'=>1-$dna['riskTolerance']/100,
            'communication'=>$dna['teamOrientation']/100,'leadership'=>$dna['leadershipInitiative']/100,
            'adaptability'=>$dna['adaptability']/100,'development'=>($staff['performance_coach']['attributes']['development']??5)/10,
        ]];
    }

    public function pin(array $blue, array $red, ?int $blueUser, ?int $redUser, array $templates): array
    {
        $profiles=app(FpsIdentityProfiles::class); $players=[]; $teams=[];
        foreach (['blue'=>[$blue,$blueUser],'red'=>[$red,$redUser]] as $side=>[$slots,$user]) {
            $club=OnlineClub::where('user_id',$user)->firstOrFail();
            $system=DB::table('fps_team_systems')->where('club_id',$club->id)->first();
            $plan=$system ? json_decode($system->gameplan,true) : self::PLAN;
            $culture=$system ? json_decode($system->culture,true) : self::PLAN;
            $instructions=$system?->instructions ? json_decode($system->instructions,true) : [];
            $coach=$this->coach($club); $ids=array_column($slots,'instance_id');
            $relations=DB::table('fps_player_relationships')->whereIn('player_id',$ids)->whereIn('teammate_id',$ids)->get();
            $chemistry=self::CHEMISTRY;
            if ($relations->isNotEmpty()) foreach ($chemistry as $key=>$value) $chemistry[$key]=$relations->avg(fn($r)=>json_decode($r->relationship,true)[$key]??$value);
            $teams[$side]=['clubId'=>$club->id,'coachKey'=>$coach['key'],'coach'=>$coach['profile'],'coachName'=>$coach['name'],'plan'=>$plan,'culture'=>$culture,'chemistry'=>$chemistry];
            foreach (OwnedPlayerCard::whereIn('id',$ids)->orderBy('id')->get() as $player) {
                $definition=app(WorldPlayerProfiles::class)->definition($player,$templates[$player->definition_id]);
                $profiles->initialize($player,$definition);
                $row=DB::table('fps_player_identities')->where('player_id',$player->id)->first();
                $dna=json_decode($row->dna,true); $development=json_decode($row->development,true);
                $key=hash('sha256',json_encode($plan));
                $familiarity=$development['systems'][$key]??0;
                if (($development['coach_key']??$coach['key'])!==$coach['key']) $familiarity*=.8;
                $players[$player->id]=['id'=>$player->id,'personality'=>['id'=>$row->personality_id??'slow_burner'],
                    'specialty'=>$row->specialty_id ? ['id'=>$row->specialty_id] : null,'dna'=>$dna,
                    'intensity'=>.4+$dna['competitiveDrive']/200,'specialtyProficiency'=>$development['specialty_proficiency']??.5,
                    'roleSuitability'=>.5,'familiarity'=>$familiarity,'roleFamiliarity'=>$development['role_familiarity']??[],
                    'assignedRole'=>$instructions[$player->id]['role']??null,'instruction'=>$instructions[$player->id]['instruction']??'balanced','trainingFocus'=>$instructions[$player->id]['training']??'system'];
            }
        }
        return ['schema'=>1,'players'=>$players,'teams'=>$teams];
    }

    public function apply(OnlineMatch $match): void
    {
        if (($match->plan['fps']['simulation_version']??0)!==3) return;
        abort_unless($match->status==='completed',409,'Identity development requires a verified completed match.');
        if (!DB::table('fps_identity_applications')->insertOrIgnore(['match_id'=>$match->id,'created_at'=>now()])) return;
        $pin=$match->plan['fps_identity']; $events=$match->result['report']['events'];
        $rounds=$match->result['report']['totalRounds'];
        foreach (['blue','red'] as $side) {
            $team=$pin['teams'][$side]; $ids=array_column($match->plan[$side],'instance_id');
            foreach ($ids as $id) {
                $row=DB::table('fps_player_identities')->where('player_id',$id)->lockForUpdate()->first();
                $dev=json_decode($row->development,true); $dna=json_decode($row->dna,true);
                $systemKey=hash('sha256',json_encode($team['plan']));
                $old=$dev['systems'][$systemKey]??0;
                if (($dev['coach_key']??$team['coachKey'])!==$team['coachKey']) $old*=.8;
                $dev['systems'][$systemKey]=min(1,$old+(1-$old)*min(.08,$rounds*(.002+.003*$dna['adaptability']/100)));
                // Keep bounded history of systems without changing personality or specialty.
                if (count($dev['systems'])>24) array_shift($dev['systems']);
                $activations=count(array_filter($events,fn($e)=>($e['type']??'')==='specialty_activated'&&($e['actorId']??'')===$id));
                $proficiency=$dev['specialty_proficiency']??.5;
                $dev['specialty_proficiency']=min(1,$proficiency+(1-$proficiency)*min(.015,$activations*.0005));
                $dev['appearances']=($dev['appearances']??0)+1; $dev['coach_key']=$team['coachKey'];
                $observations=[];
                foreach ($events as $event) if (($event['actorId']??null)===$id && in_array($event['type'],['tactical_decision','specialty_activated'],true)) $observations[]=$event['text'];
                $dev['recent_observations']=array_slice($observations,-5);
                foreach ($match->result['report']['roundSnapshots']??[] as $snapshot) if ($snapshot['playerId']===$id) {
                    $role=$snapshot['tactics']['role']??null;
                    if ($role) { $value=$dev['role_familiarity'][$role]??0; $dev['role_familiarity'][$role]=$value+(1-$value)*.002; }
                }
                $dna['adaptability']+=.03*(1-$dna['adaptability']/100)*$team['coach']['development'];
                DB::table('fps_player_identities')->where('player_id',$id)->update(['dna'=>json_encode($dna),'development'=>json_encode($dev),'updated_at'=>now()]);
            }
            // Relationship learning uses recorded trades; a loss alone is not a chemistry penalty.
            foreach ($events as $event) if (($event['type']??'')==='trade_kill' && in_array($event['actorId']??null,$ids,true)) {
                $preceding=null;
                foreach ($events as $candidate) if (($candidate['actorId']??null)===($event['targetId']??null) && in_array($candidate['targetId']??null,$ids,true) && $candidate['second']<=$event['second'] && $event['second']-$candidate['second']<=1.5 && in_array($candidate['type'],['kill','trade_kill'],true)) $preceding=$candidate;
                if (!$preceding) continue;
                foreach ([[$event['actorId'],$preceding['targetId']],[$preceding['targetId'],$event['actorId']]] as [$a,$b]) {
                    DB::table('fps_player_relationships')->insertOrIgnore(['player_id'=>$a,'teammate_id'=>$b,'relationship'=>json_encode(self::CHEMISTRY),'observations'=>0,'updated_at'=>now()]);
                    $relation=DB::table('fps_player_relationships')->where('player_id',$a)->where('teammate_id',$b)->lockForUpdate()->first();
                    $values=json_decode($relation->relationship,true);
                    foreach (['trust','communication','understanding'] as $key) $values[$key]+=(1-$values[$key])*.004;
                    DB::table('fps_player_relationships')->where('id',$relation->id)->update(['relationship'=>json_encode($values),'observations'=>$relation->observations+1,'updated_at'=>now()]);
                }
            }
            $caller=collect($match->result['report']['roundSnapshots']??[])->first(fn($s)=>in_array($s['playerId'],$ids,true)&&($s['tactics']['isCaller']??false));
            if($caller)foreach($ids as $id)if($id!==$caller['playerId']) {
                $decisions=array_values(array_filter($events,fn($e)=>($e['actorId']??null)===$id&&isset($e['decision']['instructionAdherence'])));
                if(!$decisions)continue;
                $acceptance=array_sum(array_map(fn($e)=>(float)$e['decision']['instructionAdherence'],$decisions))/count($decisions);
                $other=$caller['playerId'];
                DB::table('fps_player_relationships')->insertOrIgnore(['player_id'=>$id,'teammate_id'=>$other,'relationship'=>json_encode(self::CHEMISTRY),'observations'=>0,'updated_at'=>now()]);
                $relation=DB::table('fps_player_relationships')->where('player_id',$id)->where('teammate_id',$other)->lockForUpdate()->first();
                $values=json_decode($relation->relationship,true);$values['leadershipAcceptance']+=($acceptance-$values['leadershipAcceptance'])*.01;
                DB::table('fps_player_relationships')->where('id',$relation->id)->update(['relationship'=>json_encode($values),'observations'=>$relation->observations+1,'updated_at'=>now()]);
            }
            DB::table('fps_team_systems')->insertOrIgnore(['club_id'=>$team['clubId'],'revision'=>1,'gameplan'=>json_encode($team['plan']),'culture'=>json_encode($team['culture']),'created_at'=>now(),'updated_at'=>now()]);
            $system=DB::table('fps_team_systems')->where('club_id',$team['clubId'])->lockForUpdate()->first();
            $culture=json_decode($system->culture,true);
            foreach (self::PLAN as $key=>$value) {
                $trait=match($key){'structure'=>'tacticalDiscipline','preparation'=>'preparationPreference','freedom'=>'creativity',default=>'riskTolerance'};
                $roster=array_sum(array_map(fn($id)=>$pin['players'][$id]['dna'][$trait]/100,$ids))/count($ids);
                $target=($team['plan'][$key]+$roster+($team['coach'][match($key){'structure'=>'rigidity',default=>$key}]??.5))/3;
                $culture[$key]+=max(-.03,min(.03,($target-$culture[$key])*.08));
            }
            DB::table('fps_team_systems')->where('club_id',$team['clubId'])->update(['culture'=>json_encode($culture),'updated_at'=>now()]);
        }
    }

    public function train(string $playerId, string $matchId, int $xp): void
    {
        if(!$this->ready())return;
        $match=OnlineMatch::find($matchId);
        if(($match?->plan['fps']['simulation_version']??0)!==3)return;
        $pin=$match->plan['fps_identity'];$identity=$pin['players'][$playerId]??null;
        if(!$identity)return;
        $row=DB::table('fps_player_identities')->where('player_id',$playerId)->lockForUpdate()->first();
        if(!$row)return;
        $dev=json_decode($row->development,true);$amount=min(.02,max(0,$xp)*.0002);$focus=$identity['trainingFocus']??'system';
        if($focus==='specialty') {
            $used=collect($match->result['report']['events'])->contains(fn($e)=>($e['actorId']??null)===$playerId&&$e['type']==='specialty_activated');
            if($used){$value=$dev['specialty_proficiency']??.5;$dev['specialty_proficiency']=$value+(1-$value)*$amount;}
        } elseif($focus!=='system') {
            $value=$dev['role_familiarity'][$focus]??0;$dev['role_familiarity'][$focus]=$value+(1-$value)*$amount;
        } else {
            $side=in_array($playerId,array_column($match->plan['blue'],'instance_id'),true)?'blue':'red';
            $key=hash('sha256',json_encode($pin['teams'][$side]['plan']));$value=$dev['systems'][$key]??0;$dev['systems'][$key]=$value+(1-$value)*$amount;
        }
        DB::table('fps_player_identities')->where('player_id',$playerId)->update(['development'=>json_encode($dev),'updated_at'=>now()]);
    }
}
