<?php
namespace App\Services;

use App\Models\{ClubFixture, ClubTournament, OnlineClub};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class CompetitionEngine
{
    public function advance(int $id): void
    {
        DB::transaction(function()use($id){
            $e=ClubTournament::whereKey($id)->lockForUpdate()->firstOrFail();
            if($e->provenance==='launch_simulation' || !$e->definition_id || in_array($e->status,['completed','cancelled','review'],true))return;
            if($e->status==='registration'){
                if($e->registration_closes_at->isFuture())return;
                app(AnnualQualificationGraph::class)->assertBound($e,true);
                $entries=DB::table('club_tournament_entries')->where('tournament_id',$id)->where('status','accepted')->orderBy('seed')->orderBy('id')->pluck('id')->all();
                if(count($entries)<($e->regulations['minimum']??2)){$e->update(['status'=>'cancelled']);return;}
                $rules=$e->regulations;
                if(($rules['stages'][0]['format']??null)==='groups'){
                    // Published smaller-format fallback: no invented countries or fake qualification results.
                    $sizes=$e->participant_type==='national'?[8,16,32,48]:($rules['fallback_sizes']??[$e->capacity]);
                    $valid=array_values(array_filter($sizes,fn($n)=>$n<=count($entries) && $n<=$e->capacity));
                    if(!$valid){$e->update(['status'=>'cancelled']);return;}
                    $n=max($valid);$entries=array_slice($entries,0,$n);
                    $rules['stages'][0]['groups']=$n/4;$rules['stages'][0]['advance']=$n===48?32:($n===24?16:$n/2);
                    DB::table('club_tournament_entries')->where('tournament_id',$id)->whereNotIn('id',$entries)->update(['status'=>'reserve']);
                }
                $e->update(['status'=>'active','frozen_at'=>now(),'regulations'=>$rules]);
                $this->startStage($e,0,$entries);
            }
            $stage=DB::table('competition_stages')->where('tournament_id',$id)->where('status','active')->orderBy('position')->first();
            if(!$stage)return;
            $state=json_decode($stage->state,true);$rules=json_decode($stage->rules,true);
            $fixtures=ClubFixture::where('stage_id',$stage->id)->with('match')->orderBy('id')->get();
            if($fixtures->contains(fn($f)=>$f->hold_reason || in_array($f->match?->status,['failed','interrupted'],true))){$e->update(['status'=>'review']);return;}
            $results=[];
            foreach($fixtures as $f){
                if($f->match?->status!=='completed')return;
                abort_unless($f->match->result_hash && (($f->match->result['terminal_nexus']['red']??true)===false || ($f->match->result['terminal_nexus']['blue']??true)===false),409,'Only verified Nexus finishes advance competitions.');
                $w=$f->match->result['winner']==='blue'?$f->home_entry_id:$f->away_entry_id;
                $l=$w===$f->home_entry_id?$f->away_entry_id:$f->home_entry_id;
                DB::table('competition_results')->insertOrIgnore(['fixture_id'=>$f->id,'match_id'=>$f->match_id,'tournament_id'=>$id,
                    'winner_entry_id'=>$w,'loser_entry_id'=>$l,'result_hash'=>$f->match->result_hash,'verified_at'=>$f->match->completed_at]);
                $receipt=DB::table('competition_results')->where('fixture_id',$f->id)->first();
                app(CompetitionRankings::class)->apply($e,$receipt);
                if($e->participant_type==='national')app(NationalTeamService::class)->recordAppearances($f,$receipt);
                $results[]=['winner'=>$w,'loser'=>$l,'group'=>$f->group_key,'round'=>$f->round];
            }
            $ids=$state['entrants'];$round=$state['round']??0;$format=$stage->format;
            $pairing=app(CompetitionPairing::class);
            $seeds=DB::table('club_tournament_entries')->whereIn('id',$ids)->pluck('seed','id')->all();
            $table=$pairing->standings($ids,$results,$seeds,$state['byes']??[]);
            $advancers=null;$pairs=[];
            if(in_array($format,['single_elimination','open_qualifier'],true)){
                $alive=$ids;
                foreach($results as $r)$alive=array_values(array_diff($alive,[$r['loser']]));
                if(count($alive)<=($rules['advance']??1))$advancers=$alive;
                else { for($i=0;$i+1<count($alive);$i+=2)$pairs[]=[$alive[$i],$alive[$i+1]]; }
            }elseif($format==='double_elimination'){
                $losses=array_fill_keys($ids,0);foreach($results as $r)$losses[$r['loser']]++;
                $alive=array_values(array_filter($ids,fn($id)=>$losses[$id]<2));
                if(count($alive)===1)$advancers=$alive;
                elseif(count($alive)===2)$pairs=[[$alive[0],$alive[1]]];
                else {foreach([0,1] as $loss){$pool=array_values(array_filter($alive,fn($id)=>$losses[$id]===$loss));for($i=0;$i+1<count($pool);$i+=2)$pairs[]=[$pool[$i],$pool[$i+1]];}if(!$pairs)$pairs=[[$alive[0],$alive[1]]];}
            }elseif($format==='swiss'){
                if($round>=($rules['rounds']??(int)ceil(log(count($ids),2))))$advancers=array_column(array_slice($table,0,$rules['advance']??1),'id');
                else {$played=[];foreach($results as $r)$played[min($r['winner'],$r['loser']).':'.max($r['winner'],$r['loser'])]=true;
                    $draw=$pairing->swiss(array_column($table,'id'),$played,$state['byes']??[]);$pairs=$draw['pairs'];if($draw['bye'])$state['byes'][]=$draw['bye'];}
            }elseif($format==='round_robin'){
                $rounds=count($ids)+(count($ids)%2)-1;
                if($round>=$rounds)$advancers=array_column(array_slice($table,0,$rules['advance']??1),'id');
                else $pairs=$pairing->roundRobin($ids,$round+1);
            }elseif($format==='groups'){
                $groups=$state['groups'];$rounds=max(array_map(fn($g)=>count($g)+(count($g)%2)-1,$groups));
                if($round>=$rounds){$tables=[];foreach($groups as $key=>$group)$tables[$key]=$pairing->standings($group,array_values(array_filter($results,fn($r)=>$r['group']===(string)$key)),$seeds);
                    $advancers=$pairing->groupAdvancers($tables,$rules['advance']);}
                else foreach($groups as $key=>$group)foreach($pairing->roundRobin($group,$round+1) as $pair)$pairs[]=[...$pair,(string)$key];
            }
            if($advancers!==null){
                DB::table('competition_stages')->where('id',$stage->id)->update(['status'=>'completed','state'=>json_encode($state+['advancers'=>$advancers])]);
                if(isset($e->regulations['stages'][$stage->position+1])){$this->startStage($e,$stage->position+1,$advancers);return;}
                if(count($advancers)!==1){$e->update(['status'=>'review']);return;}
                $this->finish($e,$advancers[0],$results,$table,$format);return;
            }
            if($pairs){$state['round']=$round+1;DB::table('competition_stages')->where('id',$stage->id)->update(['state'=>json_encode($state)]);$this->schedule($e,$stage->id,$round+1,$pairs);}
        },3);
    }

    private function startStage(ClubTournament $e,int $position,array $ids): void
    {
        $rules=$e->regulations['stages'][$position];$state=['entrants'=>$ids,'round'=>0,'byes'=>[]];
        if($rules['format']==='groups'){
            $groups=array_fill(0,(int)$rules['groups'],[]);
            // Serpentine seeding distributes ranked entrants evenly, frozen with the edition.
            foreach($ids as $i=>$id){$row=intdiv($i,count($groups));$index=$i%count($groups);if($row%2)$index=count($groups)-1-$index;$groups[$index][]=$id;}
            if($rules['geography_limits']??[]){
                $paths=DB::table('club_tournament_entries')->whereIn('id',$ids)->pluck('geography_path','id')->map(fn($p)=>json_decode($p??'[]',true))->all();
                $groups=app(CompetitionPairing::class)->drawGroups($ids,(int)$rules['groups'],$paths,$rules['geography_limits']);
            }
            $state['groups']=$groups;
        }
        DB::table('competition_stages')->insert(['tournament_id'=>$e->id,'position'=>$position,'format'=>$rules['format'],'rules'=>json_encode($rules),'state'=>json_encode($state),'status'=>'active']);
        // Recovery tick drives the first round, so each job remains bounded to one transition.
    }

    private function schedule(ClubTournament $e,int $stageId,int $round,array $pairs): void
    {
        $calendar=app(CompetitionCalendar::class);$recovery=$calendar->settings()['recovery_hours'];
        $latest=ClubFixture::where('tournament_id',$e->id)->max('kickoff_at');
        $start=max(CarbonImmutable::parse($e->starts_at),now('UTC')->toImmutable()->addHour()->startOfHour());
        if($latest)$start=max($start,CarbonImmutable::parse($latest)->addHours(max($recovery,$e->regulations['round_interval_hours']??$recovery)));
        $entries=DB::table('club_tournament_entries')->where('tournament_id',$e->id)->get()->keyBy('id');
        // Lock participating clubs in one order, also used by direct friendly scheduling.
        $clubIds=$entries->pluck('club_id')->filter()->sort()->values()->all();
        OnlineClub::whereKey($clubIds)->orderBy('id')->lockForUpdate()->get(['id']);
        $slot=(int)(ClubFixture::where('tournament_id',$e->id)->max('bracket_slot')??0);
        foreach($pairs as $offset=>$pair){
            [$a,$b]=$pair;$home=$entries[$a];$away=$entries[$b];
            // A single-worker deployment can serialize every fixture; concurrency is explicit configuration.
            $kickoff=$start->addHours($offset*($e->regulations['fixture_interval_hours']??1));
            $attempt=0;
            while(true){
                try{$calendar->validateSlot($e,$kickoff);}catch(\Symfony\Component\HttpKernel\Exception\HttpException $error){if(++$attempt>800)throw $error;$kickoff=$kickoff->addHours(3);continue;}
                if($e->participant_type==='club' && ClubFixture::conflicts([$home->club_id,$away->club_id],$kickoff)){$kickoff=$kickoff->addHours($recovery);if(++$attempt>800)abort(409,'Calendar conflict requires review.');continue;}
                if($e->participant_type==='national' && ClubFixture::whereBetween('kickoff_at',[$kickoff->subHours($recovery),$kickoff->addHours($recovery)])->where(fn($q)=>$q->whereIn('home_national_team_id',[$home->national_team_id,$away->national_team_id])->orWhereIn('away_national_team_id',[$home->national_team_id,$away->national_team_id]))->exists()){$kickoff=$kickoff->addHours($recovery);if(++$attempt>800)abort(409,'National calendar conflict requires review.');continue;}
                break;
            }
            ClubFixture::create(['tournament_id'=>$e->id,'stage_id'=>$stageId,'round'=>$round,'group_key'=>$pair[2]??null,
                'home_entry_id'=>$a,'away_entry_id'=>$b,'home_club_id'=>$home->club_id,'away_club_id'=>$away->club_id,
                'home_national_team_id'=>$home->national_team_id,'away_national_team_id'=>$away->national_team_id,
                'competition'=>$e->title(),'bracket_slot'=>++$slot,'kickoff_at'=>$kickoff,'orders_close_at'=>$kickoff->subMinutes(15)]);
        }
    }

    private function finish(ClubTournament $e,int $entryId,array $results,array $table,string $format): void
    {
        $entry=DB::table('club_tournament_entries')->find($entryId);
        $runner= in_array($format,['round_robin','swiss'],true) ? ($table[1]['id']??null) : ($results ? end($results)['loser'] : ($table[1]['id']??null));
        $runnerEntry=$runner?DB::table('club_tournament_entries')->find($runner):null;
        if($e->participant_type==='club'){
            $e->update(['status'=>'completed','champion_id'=>$entry->club_id]);
            foreach([[$entry->club_id,$e->champion_prize,'champion'],[$runnerEntry?->club_id,$e->runner_up_prize,'finalist']] as [$club,$amount,$place])if($club){
                if($amount>0)DB::table('club_money_entries')->insertOrIgnore(['club_id'=>$club,'amount'=>$amount,'kind'=>'Competition prize','reference'=>"competition:$e->id:$place",'created_at'=>now()]);
                $points=$e->regulations['circuit_points'][$place]??0;
                if($points)DB::table('competition_circuit_points')->insertOrIgnore(['tournament_id'=>$e->id,'club_id'=>$club,'year'=>$e->year,'points'=>$points,'achievement'=>$place]);
            }
        }else $e->update(['status'=>'completed','national_champion_id'=>$entry->national_team_id]);
        app(WorldPyramid::class)->promote($e,$entry->club_id);
        app(CommunityCups::class)->award($e,$entry->club_id,$runnerEntry?->club_id);
        DB::table('competition_audits')->insert(['action'=>'edition.completed','subject'=>(string)$e->id,'details'=>json_encode(['champion_entry'=>$entryId,'runner_entry'=>$runner]),'created_at'=>now()]);
    }
}
