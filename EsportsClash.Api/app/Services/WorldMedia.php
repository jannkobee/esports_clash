<?php
namespace App\Services;
use App\Models\{ClubFixture,ClubTournament,OnlineMatch};
use Illuminate\Support\Facades\DB;

class WorldMedia
{
    private bool $installed=false;
    public function install():void{
        if($this->installed)return;
        foreach([
            ['relay','Mara Relay','caster','Play-by-play','Fictional Hexatrick caster covering verified Arena finishes.'],
            ['lantern','Ivo Lantern','analyst','Competition desk','Fictional analyst following published tournaments and results.'],
            ['pixels','Neri Pixels','streamer','Club spotlight','Fictional streamer discussing the living club world.'],
        ] as [$slug,$name,$role,$style,$bio])DB::table('world_media_personalities')->insertOrIgnore(compact('slug','name','role','style','bio'));
        $this->installed=true;
    }
    private function post(string $key,string $desk,string $kind,string $headline,string $body,array $facts=[],array $links=[]):void{
        if(DB::table('world_news_posts')->where('event_key',$key)->exists())return;
        $this->install();
        $role=match($desk){'relay'=>'caster','lantern'=>'analyst',default=>'streamer'};
        // Give assignments to the actual registry, with a per-person cooldown.
        // Busy broadcast crew retain their fixture duties instead of taking another desk shift.
        $writer=DB::table('world_media_personalities as t')->where('t.role',$role)
            ->whereNotExists(fn($q)=>$q->selectRaw('1')->from('world_news_posts as p')->whereColumn('p.personality_id','t.id')->where('p.published_at','>',now()->subHours(2)))
            ->whereNotExists(fn($q)=>$q->selectRaw('1')->from('fixture_talent_assignments as a')->join('club_fixtures as f','f.id','=','a.fixture_id')->whereColumn('a.talent_id','t.id')->whereBetween('f.kickoff_at',[now()->subHours(2),now()->addHours(2)]))
            ->select('t.id')->orderByRaw('(SELECT COUNT(*) FROM world_news_posts p WHERE p.personality_id=t.id)')->orderBy('t.id')->first();
        $writerId=$writer?->id??DB::table('world_media_personalities')->where('slug',$desk)->value('id');
        $account=null;
        if($kind==='tournament'&&isset($links['tournament_id'])&&str_starts_with($key,'edition:')&&app(WireAccounts::class)->ready()){
            $event=ClubTournament::find($links['tournament_id']);if($event){$account=app(WireAccounts::class)->tournament($event);app(WireAccounts::class)->organizerNotice($event);}
        }
        DB::table('world_news_posts')->insertOrIgnore(['event_key'=>$key,'personality_id'=>$account?null:$writerId,...($account?['wire_account_id'=>$account]:[]),
            'kind'=>$kind,'headline'=>$headline,'body'=>$body,'facts'=>json_encode($facts),'published_at'=>now(),...$links]);
    }
    public function match(string $id):void{
        $match=OnlineMatch::find($id);if(!$match||$match->status!=='completed'||!isset($match->plan['fixture']))return;
        $fixture=ClubFixture::where('match_id',$id)->first();if(!$fixture)return;
        $winner=$match->plan['clubs'][$match->result['winner']];$loser=$match->plan['clubs'][$match->result['winner']==='blue'?'red':'blue'];
        $accelerated=($match->result['execution']['mode']??null)==='owner_requested_fast_forward';
        $r=$match->result['report'];$minutes=(int)floor($r['durationSeconds']/60);$seconds=str_pad((string)((int)$r['durationSeconds']%60),2,'0',STR_PAD_LEFT);
        $exhibition=$fixture->tournament_id&&ClubTournament::find($fixture->tournament_id)?->provenance==='launch_simulation';
        if(($r['format']??null)==='MR15_TACTICAL_FPS'){
            $score=$r['finalScore'];$scoreText=$score['blue'].'–'.$score['red'];
            $this->post('match:'.$id,'relay','result',"$winner take the tactical series against $loser",
                "$winner won the scheduled {$fixture->competition} FPS match $scoreText on {$r['mapName']}. Open the tactical replay and synchronized round report.".($exhibition?' This verified exhibition game is excluded from official rankings.':''),
                ['provenance'=>'verified','winner'=>$winner,'format'=>'MR15_TACTICAL_FPS','map_id'=>$r['mapId'],'map_name'=>$r['mapName'],
                    'score'=>$score,'duration_seconds'=>$r['durationSeconds']],['match_id'=>$id,'tournament_id'=>$fixture->tournament_id]);
            $this->rivalry($fixture,$match);
            return;
        }
        $this->post('match:'.$id,'relay','result',"$winner take the Nexus against $loser", "$winner won the scheduled {$fixture->competition} game in $minutes:$seconds. ".($accelerated?'The owner interrupted live coverage and requested simulated completion; later Arena frames are sampled. ':'').($exhibition?'This verified exhibition game is excluded from official rankings. ':'')."Open the Arena recording and synchronized event report.",
            ['provenance'=>'verified','blueKills'=>$r['blueKills']??null,'redKills'=>$r['redKills']??null,'winner'=>$winner,'duration_seconds'=>$r['durationSeconds']],['match_id'=>$id,'tournament_id'=>$fixture->tournament_id]);
        $this->rivalry($fixture,$match);
    }
    public function statisticalExhibition(string $id,array $report):void{
        $winner=$report['clubs'][$report['winner']];
        $this->post('statistical-exhibition:'.$id,'lantern','launch_archive','Exhibition simulation: '.$winner.' advance',
            $winner.' advance through an owner-approved statistical launch-exhibition result. The Arena was interrupted without a Nexus finish; its recording remains available. This is not a verified live victory and awards no official ranking points, player ratings, training or money.',
            ['provenance'=>'statistical_exhibition','method'=>$report['method']],['match_id'=>$id,'launch_game_id'=>DB::table('launch_history_games')->where('fixture_id',ClubFixture::where('match_id',$id)->value('id'))->value('id'),'tournament_id'=>ClubFixture::where('match_id',$id)->value('tournament_id')]);
    }
    public function archive(int $id):void{
        $g=DB::table('launch_history_games')->find($id);if(!$g||!$g->report)return;
        $p=json_decode($g->allocation,true);$r=json_decode($g->report,true);$winner=$p['clubs'][$r['winner']];
        $this->post('archive:'.$id,'lantern','launch_archive',"Launch simulation: $winner advance", "Simulated launch history for the {$g->phase} game dated {$g->scheduled_at}. Generated from launch rosters using the historical baseline; this is not a verified live result and awards no ranking points or money.",
            ['provenance'=>'launch_simulation','scheduled_at'=>$g->scheduled_at,'generated_at'=>$g->generated_at,'blueKills'=>$r['blueKills'],'redKills'=>$r['redKills']],['tournament_id'=>$g->tournament_id,'launch_game_id'=>$id]);
    }
    public function tick(?float $deadline=null):void{
        $this->install();
        // Recovery is bounded; unique event keys also cover lost after-commit dispatches.
        foreach(OnlineMatch::where('status','completed')->where('completed_at','>=',now()->subDays(7))
            ->whereNotExists(fn($q)=>$q->selectRaw('1')->from('world_news_posts as p')->whereColumn('p.match_id','online_matches.id')->where('p.kind','result'))
            ->orderByDesc('completed_at')->limit(10)->pluck('id') as $id){if($deadline!==null&&microtime(true)>=$deadline)return;$this->match($id);}
        foreach(ClubTournament::whereIn('status',['registration','active','launch_history'])->orderByDesc('id')->limit(30)->get() as $event){
            if($deadline!==null&&microtime(true)>=$deadline)return;
            $archive=$event->provenance==='launch_simulation';
            $this->post('edition:'.$event->id.':'.$event->status,'lantern',$archive?'launch_archive':'tournament',($archive?'Launch exhibition: ':'Tournament desk: ').$event->title(),
                $archive?($event->regulations['notice']??'Labeled launch simulation.'):($event->status==='registration'?'Registration is open. Entries close '.$event->registration_closes_at->setTimezone('Asia/Manila')->format('j M Y, g:i A').' Manila. Read the entry requirements and schedule in Hexapedia.':'The competition is underway. Follow its published fixtures, standings and regulations in Hexapedia.'),
                ['provenance'=>$event->provenance,'status'=>$event->status,'registration_closes_at'=>$event->registration_closes_at?->toIso8601String()],['tournament_id'=>$event->id]);
        }
        $this->live($deadline);
        if($deadline!==null&&microtime(true)>=$deadline)return;
        $leader=DB::table('world_news_posts')->where('event_key','spotlight:'.now('UTC')->toDateString())->exists()?null:
            DB::table('competition_ratings as r')->join('online_clubs as c','c.id','=','r.participant_id')->where('r.system','HGR')->where('r.games','>',0)->orderByDesc('r.score')->first(['c.id','c.name','r.score','r.games']);
        if($leader)$this->post('spotlight:'.now('UTC')->toDateString(),'pixels','spotlight',$leader->name.' lead the club rating table',
            $leader->name.' currently have '.round($leader->score,1).' HGR after '.$leader->games.' rated games. Follow their published club record in Hexapedia.', ['team_id'=>$leader->id,'score'=>(float)$leader->score,'games'=>$leader->games,'provenance'=>'verified']);
        $player=DB::table('world_news_posts')->where('event_key','player-spotlight:'.now('UTC')->toDateString())->exists()?null:
            DB::table('club_training_sessions as s')->join('owned_player_cards as p','p.id','=','s.card_id')->whereNull('p.retired_at')->whereNotNull('p.persona_name')
            ->groupBy('p.id','p.persona_name')->orderByRaw('COUNT(*) DESC')->orderBy('p.id')->selectRaw('p.id,p.persona_name,COUNT(*) as appearances')->first();
        if($player)$this->post('player-spotlight:'.now('UTC')->toDateString(),'pixels','spotlight','Player spotlight: '.$player->persona_name,
            $player->persona_name.' have recorded '.$player->appearances.' development sessions. Their Hexapedia record follows the same person through training and transfers.',
            ['player_id'=>$player->id,'development_sessions'=>$player->appearances,'provenance'=>'verified']);
        $this->previews($deadline);
        $this->development($deadline);
        $this->worldActivity($deadline);
        DB::table('world_broadcast_presence')->where('seen_at','<',now()->subMinutes(5))->delete();
    }

    /** Essential factual notices remain active while optional work yields. */
    public function live(?float $deadline=null): void {
        foreach(OnlineMatch::where('status','running')->where('spectator_ready',true)->limit(4)->get() as $live){
            if($deadline!==null&&microtime(true)>=$deadline)return;
            if(!$live->canSpectate())continue;
            $this->post('broadcast:'.$live->id,'relay','tournament',$live->plan['clubs']['blue'].' vs '.$live->plan['clubs']['red'].' ? live',
                'The scheduled Arena broadcast is open. Follow the same recorded action in the Arena and text views; join the manager discussion below.',
                ['provenance'=>'verified_live'],['match_id'=>$live->id]);
        }
    }

    private function worldActivity(?float $deadline=null): void
    {
        // Cover real actions from both human and managed clubs, with bounded global and club budgets.
        $budget=max(6,min(24,(int)ceil(\App\Models\OnlineClub::count()/20)));
        $used=DB::table('world_news_posts')->where('kind','world_activity')->where('published_at','>=',now()->subHour())->get(['facts']);
        if($used->count()>=$budget)return;
        $byClub=$used->map(fn($p)=>json_decode($p->facts??'{}',true)['team_id']??0)->countBy()->all();
        $events=DB::table('club_world_events')->where('occurred_at','>=',now()->subDay())->whereIn('kind',['transfer','recruitment','club','competition','auction'])->orderByDesc('id')->limit(200)->get()->reverse();
        $keys=$events->map(fn($e)=>'activity:'.$e->id)->all();
        $seen=DB::table('world_news_posts')->whereIn('event_key',$keys)->pluck('event_key')->flip();
        $count=$used->count();
        foreach($events as $event){
            if($deadline!==null&&microtime(true)>=$deadline)return;
            if(isset($seen['activity:'.$event->id])||($byClub[$event->actor_club_id??0]??0)>=2)continue;
            $facts=json_decode($event->payload??'{}',true);
            $public=array_intersect_key($facts,array_flip(['player_id','player_instance_id','team_id','seller_id','buyer_id','tournament_id','auction_id','amount','currency']));
            if(isset($public['player_instance_id']))$public['player_id']=$public['player_instance_id'];
            $this->post('activity:'.$event->id,$event->kind==='competition'?'lantern':'pixels','world_activity',
                match($event->kind){'transfer'=>'Transfer desk','recruitment'=>'New signing','competition'=>'Competition entry','auction'=>'On the market',default=>'Club office'},
                $event->message,$public+['provenance'=>'recorded_activity','activity_id'=>$event->id,'team_id'=>$event->actor_club_id,'occurred_at'=>\Illuminate\Support\Carbon::parse($event->occurred_at)->toIso8601String()],
                isset($facts['tournament_id'])?['tournament_id'=>$facts['tournament_id']]:[]);
            $byClub[$event->actor_club_id??0]=($byClub[$event->actor_club_id??0]??0)+1;
            if(++$count>=$budget)break;
        }
    }

    private function rivalry(ClubFixture $fixture,OnlineMatch $match):void{
        if(!$fixture->home_club_id||!$fixture->away_club_id)return;
        $a=$fixture->home_club_id;$b=$fixture->away_club_id;
        $games=ClubFixture::where(fn($q)=>$q->where(fn($q)=>$q->where('home_club_id',$a)->where('away_club_id',$b))->orWhere(fn($q)=>$q->where('home_club_id',$b)->where('away_club_id',$a)))
            ->whereHas('match',fn($q)=>$q->where('status','completed')->where('completed_at','<=',$match->completed_at))->with('match')->orderByDesc('kickoff_at')->limit(20)->get();
        if($games->count()<3)return;
        $wins=$games->filter(fn($g)=>($g->match->result['winner']==='blue'?$g->home_club_id:$g->away_club_id)===$a)->count();$losses=$games->count()-$wins;
        $blue=$match->plan['clubs']['blue'];$red=$match->plan['clubs']['red'];
        $this->post('rivalry:'.$match->id,'lantern','spotlight',"Rivalry desk: $blue and $red", "$blue have $wins wins and $losses losses across the last {$games->count()} verified scheduled meetings with $red. These are game wins, not Arena kill totals; exhibition and scrimmage meetings are included and confer no ranked status by themselves.",
            ['provenance'=>'verified','fixture_ids'=>$games->pluck('id'),'home_wins'=>$wins,'away_wins'=>$losses],['match_id'=>$match->id,'tournament_id'=>$fixture->tournament_id]);
    }
    private function previews(?float $deadline=null):void{
        foreach(ClubFixture::whereNull('match_id')->whereNull('hold_reason')->whereBetween('kickoff_at',[now(),now()->addDays(2)])->with(['homeClub:id,name','awayClub:id,name'])->orderBy('kickoff_at')->limit(3)->get() as $f){
            if($deadline!==null&&microtime(true)>=$deadline)return;
            if(!$f->homeClub||!$f->awayClub)continue;
            $this->post('preview:'.$f->id,'relay','tournament',$f->homeClub->name.' vs '.$f->awayClub->name.': next on the calendar',
                $f->competition.' is scheduled for '.$f->kickoff_at->setTimezone('Asia/Manila')->format('j M Y, g:i A').' Manila. Orders close fifteen minutes before kickoff. Follow the published fixture; the teams, coach draft and outcome will be reported from the actual Arena. No result is predicted.',
                ['provenance'=>'scheduled','fixture_id'=>$f->id,'home_id'=>$f->home_club_id,'away_id'=>$f->away_club_id],['tournament_id'=>$f->tournament_id]);
        }
    }
    private function development(?float $deadline=null):void{
        $recent=DB::table('player_progress_snapshots')->whereNull('media_reviewed_at')->where('observed_at','>=',now()->subDays(8))->orderBy('id')->limit(20)->get();$published=0;
        foreach($recent as $latest){
            if($deadline!==null&&microtime(true)>=$deadline)return;
            $earlier=DB::table('player_progress_snapshots')->where('player_id',$latest->player_id)->where('observed_at','<',$latest->observed_at)->orderByDesc('observed_at')->first();
            if(!$earlier||$latest->overall<=$earlier->overall){DB::table('player_progress_snapshots')->where('id',$latest->id)->update(['media_reviewed_at'=>now()]);continue;}
            $person=\App\Models\OwnedPlayerCard::find($latest->player_id);if(!$person){DB::table('player_progress_snapshots')->where('id',$latest->id)->update(['media_reviewed_at'=>now()]);continue;}
            $gain=$latest->overall-$earlier->overall;
            $this->post('development:'.$latest->id,'pixels','spotlight','Development watch: '.$person->persona_name,
                $person->persona_name.' improved by '.$gain.' recorded overall points between two observed development reports. The career page shows the dated attributes and training XP; this is observed progress, not an invented historical biography.',
                ['provenance'=>'observed_development','player_id'=>$person->id,'earlier_observation'=>$earlier->id,'latest_observation'=>$latest->id]);
            DB::table('player_progress_snapshots')->where('id',$latest->id)->update(['media_reviewed_at'=>now()]);
            if(++$published>=3)break;
        }
    }
}
