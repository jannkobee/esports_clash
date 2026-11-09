<?php
namespace App\Services;

use App\Models\{ClubFixture,ClubTournament,CompetitionDefinition,OnlineCatalog,OnlineClub,OwnedPlayerCard};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Explicitly approved fictional launch archive. Never creates backdated OnlineMatch records. */
class LaunchChampionship
{
    public function install(): ClubTournament
    {
        return DB::transaction(function(){
            $catalog=OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();
            if($event=ClubTournament::where('scope','launch-archive')->where('year',2026)->first())return $event;
            abort_unless(now('UTC')->year===2026 && now('UTC')->month>=10,409,'This is the explicitly approved 2026 launch archive.');
            $clubs=OnlineClub::whereNotNull('tag')->orderBy('id')->get()->filter(fn($c)=>count($c->lineup??[])===5)->take(16);
            abort_unless($clubs->count()===16,409,'Sixteen established clubs are required.');
            $groups=array_chunk($clubs->pluck('id')->all(),4);
            $event=ClubTournament::create(['definition_id'=>CompetitionDefinition::where('slug','crown-championship')->value('id'),
                'year'=>2026,'tier'=>null,'scope'=>'launch-archive','name'=>'Hexatrick Crown 2026 — Launch Exhibition','participant_type'=>'club',
                'capacity'=>16,'status'=>'launch_history','provenance'=>'launch_simulation','ranked'=>false,'accreditation'=>'unranked',
                'registration_closes_at'=>'2026-10-14 10:00:00+00','starts_at'=>'2026-10-15 10:00:00+00','ends_at'=>'2026-11-14 15:59:00+00',
                'semifinals_at'=>'2026-11-07 10:00:00+00','final_at'=>'2026-11-14 10:00:00+00','champion_prize'=>0,'runner_up_prize'=>0,
                'regulations'=>['launch_groups'=>$groups,'selection'=>'First sixteen published clubs by registry ID; current launch rosters, not claimed historical contracts.',
                    'history_cutoff'=>now()->toIso8601String(),'history_controller'=>'explicit-historical-baseline','stages'=>[['format'=>'groups','advance'=>8],['format'=>'single_elimination','advance'=>1]],
                    'notice'=>'Simulated launch history. No official titles, rewards, rankings, circuit points or training from archive games. Future games use the scheduled Arena.'],
                'qualification'=>[],'sponsors'=>[]]);
            foreach($clubs as $i=>$club)DB::table('club_tournament_entries')->insert(['tournament_id'=>$event->id,'club_id'=>$club->id,'seed'=>$i+1,'source'=>json_encode(['method'=>'launch_exhibition']),'status'=>'accepted']);
            $slot=0;
            foreach($groups as $g=>$ids)foreach([1,2,3] as $round)foreach(app(CompetitionPairing::class)->roundRobin($ids,$round) as [$home,$away]){
                $day=[1=>15,2=>20,3=>25][$round];
                DB::table('launch_history_games')->insert(['tournament_id'=>$event->id,'slot'=>++$slot,'phase'=>'groups','group_key'=>chr(65+$g),'round'=>$round,
                    'home_club_id'=>$home,'away_club_id'=>$away,'scheduled_at'=>CarbonImmutable::create(2026,10,$day,10+$g,0,0,'UTC')]);
            }
            return $event;
        },3);
    }

    public function tick(): void
    {
        foreach(ClubTournament::where('scope','launch-archive')->where('status','launch_history')->get() as $event){
            DB::transaction(function()use($event){
                ClubTournament::whereKey($event->id)->lockForUpdate()->firstOrFail();
                foreach(DB::table('launch_history_games')->where('tournament_id',$event->id)->whereNotNull('fixture_id')->whereNull('winner_id')->get() as $game){
                    $match=ClubFixture::find($game->fixture_id)?->match;
                    if($match?->status==='completed')DB::table('launch_history_games')->where('id',$game->id)->update(['status'=>($match->result['execution']['mode']??null)==='owner_requested_fast_forward'?'accelerated_exhibition':'verified_exhibition','winner_id'=>$match->result['winner']==='blue'?$game->home_club_id:$game->away_club_id]);
                }
                $games=DB::table('launch_history_games')->where('tournament_id',$event->id)->orderBy('slot')->get();
                $groups=$games->where('phase','groups');
                if($groups->count()===24 && $groups->every(fn($g)=>$g->winner_id) && !$games->contains('phase','quarterfinal')){
                    $tables=[];foreach($event->regulations['launch_groups'] as $i=>$ids){
                        $results=$groups->where('group_key',chr(65+$i))->map(fn($g)=>['winner'=>$g->winner_id,'loser'=>$g->winner_id===$g->home_club_id?$g->away_club_id:$g->home_club_id])->all();
                        $tables[]=app(CompetitionPairing::class)->standings($ids,$results);
                    }
                    $pairs=[[$tables[0][0]['id'],$tables[1][1]['id']],[$tables[2][0]['id'],$tables[3][1]['id']],[$tables[1][0]['id'],$tables[0][1]['id']],[$tables[3][0]['id'],$tables[2][1]['id']]];
                    foreach($pairs as $i=>[$a,$b])$this->game($event,25+$i,'quarterfinal',4,$a,$b,"2026-11-".str_pad((string)(3+$i),2,'0',STR_PAD_LEFT).' 10:00:00+00');
                }
                foreach([['quarterfinal','semifinal',29,5,7],['semifinal','final',31,6,14]] as [$from,$to,$slot,$round,$day]){
                    $previous=$games->where('phase',$from)->values();$expected=$from==='quarterfinal'?4:2;
                    if($previous->count()===$expected && $previous->every(fn($g)=>$g->winner_id) && !$games->contains('phase',$to)){
                        foreach(array_chunk($previous->pluck('winner_id')->all(),2) as $i=>[$a,$b])$this->game($event,$slot+$i,$to,$round,$a,$b,'2026-11-'.str_pad((string)($day+$i),2,'0',STR_PAD_LEFT).' 10:00:00+00');
                    }
                }
                if($final=$games->first(fn($g)=>$g->phase==='final' && $g->winner_id))$event->update(['status'=>'launch_complete','champion_id'=>$final->winner_id]);
            },3);
            // One archived game at a time; all later games retain their real future dates.
            $cutoff=CarbonImmutable::parse($event->regulations['history_cutoff']);
            $game=DB::table('launch_history_games')->where('tournament_id',$event->id)->whereNull('fixture_id')->whereNull('winner_id')->where('scheduled_at','<=',$cutoff)->where('status','<>','failed')->orderBy('slot')->first();
            if($game)\App\Jobs\PollLaunchHistoryGame::dispatch($game->id);
            foreach(DB::table('launch_history_games')->where('tournament_id',$event->id)->whereNull('fixture_id')->whereNull('winner_id')->where('scheduled_at','>',$cutoff)->get() as $future)$this->schedule($event,$future);
        }
    }

    private function game(ClubTournament $event,int $slot,string $phase,int $round,int $home,int $away,string $date):void
    {
        DB::table('launch_history_games')->insertOrIgnore(['tournament_id'=>$event->id,'slot'=>$slot,'phase'=>$phase,'round'=>$round,'home_club_id'=>$home,'away_club_id'=>$away,'scheduled_at'=>$date]);
    }

    private function schedule(ClubTournament $event,object $game):void
    {
        DB::transaction(function()use($event,$game){
            $game=DB::table('launch_history_games')->where('id',$game->id)->lockForUpdate()->first();if($game->fixture_id)return;
            OnlineClub::whereKey([$game->home_club_id,$game->away_club_id])->orderBy('id')->lockForUpdate()->get();
            $date=CarbonImmutable::parse($game->scheduled_at)->max(CarbonImmutable::now('UTC')->addHours(2));
            while(ClubFixture::conflicts([$game->home_club_id,$game->away_club_id],$date)&&$date->lt($event->ends_at))$date=$date->addHours(25);
            if($date->gt($event->ends_at)){DB::table('launch_history_games')->where('id',$game->id)->update(['error'=>'No legal live slot remains; organizer review required.']);return;}
            $fixture=ClubFixture::create(['tournament_id'=>$event->id,'bracket_slot'=>$game->slot,'round'=>$game->round,'home_club_id'=>$game->home_club_id,'away_club_id'=>$game->away_club_id,
                'competition'=>'Crown Launch Exhibition','kickoff_at'=>$date,'orders_close_at'=>$date->subMinutes(15)]);
            DB::table('launch_history_games')->where('id',$game->id)->update(['fixture_id'=>$fixture->id,'status'=>'scheduled','error'=>null]);
        },3);
    }

    public function allocation(int $id):object
    {
        return DB::transaction(function()use($id){
            $catalog=OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();
            $game=DB::table('launch_history_games')->where('id',$id)->lockForUpdate()->first();
            abort_unless($game&&!$game->fixture_id,409);if($game->allocation)return $game;
            $online=app(OnlineService::class);$plan=['provenance'=>'launch_simulation','seed'=>random_int(1,2147483647),'player_profiles'=>[],'clubs'=>[]];
            $definitions=collect($catalog->payload['cards'])->keyBy('id');
            foreach(['blue'=>$game->home_club_id,'red'=>$game->away_club_id] as $side=>$clubId){
                $club=OnlineClub::findOrFail($clubId);$plan[$side]=$online->validatedLineup($club->user_id,$club->lineup,$catalog);$plan['clubs'][$side]=$club->name;
                foreach($plan[$side] as $slot){$p=OwnedPlayerCard::findOrFail($slot['instance_id']);$plan['player_profiles'][$p->id]=app(WorldPlayerProfiles::class)->snapshot($p,$definitions[$p->definition_id]);}
            }
            $json=json_encode($plan,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
            DB::table('launch_history_games')->where('id',$id)->update(['run_id'=>(string)Str::uuid(),'allocation'=>$json,'allocation_hash'=>hash('sha256',$json),'status'=>'queued']);
            return DB::table('launch_history_games')->find($id);
        },3);
    }

    public function settle(int $id,array $report):void
    {
        DB::transaction(function()use($id,$report){
            $game=DB::table('launch_history_games')->where('id',$id)->lockForUpdate()->first();$plan=json_decode($game->allocation,true);
            $json=json_encode($report,JSON_THROW_ON_ERROR);$hash=hash('sha256',$json);
            if($game->report_hash){abort_unless(hash_equals($game->report_hash,$hash),409,'Archive results are immutable.');return;}
            $n=$report['terminal_nexus']??[];$winner=($n['red']??null)===false?'blue':((($n['blue']??null)===false)?'red':null);
            abort_unless(($report['provenance']??null)==='launch_simulation' && $winner && $winner===$report['winner'] && $report['seed']===$plan['seed'] && $report['durationSeconds']>0 && is_bool($n['blue'])&&is_bool($n['red']),422,'Archive requires its allocated, actual Nexus finish.');
            abort_unless(array_column($report['champions'],'instance_id')===array_column([...$plan['blue'],...$plan['red']],'instance_id'),422,'Archive roster mismatch.');
            DB::table('launch_history_games')->where('id',$id)->update(['report'=>$json,'report_hash'=>$hash,'status'=>'simulated','generated_at'=>now(),'winner_id'=>$winner==='blue'?$game->home_club_id:$game->away_club_id,'error'=>null]);
        },3);
        app(WorldMedia::class)->archive($id);
    }
}
