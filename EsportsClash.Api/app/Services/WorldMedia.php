<?php
namespace App\Services;
use App\Models\{ClubFixture,ClubTournament,OnlineMatch};
use Illuminate\Support\Facades\DB;

class WorldMedia
{
    public function install():void{
        foreach([
            ['relay','Mara Relay','caster','Play-by-play','Fictional Hexatrick caster covering verified Arena finishes.'],
            ['lantern','Ivo Lantern','analyst','Competition desk','Fictional analyst following published tournaments and results.'],
            ['pixels','Neri Pixels','streamer','Club spotlight','Fictional streamer discussing the living club world.'],
        ] as [$slug,$name,$role,$style,$bio])DB::table('world_media_personalities')->insertOrIgnore(compact('slug','name','role','style','bio'));
    }
    private function post(string $key,string $desk,string $kind,string $headline,string $body,array $facts=[],array $links=[]):void{
        $this->install();
        DB::table('world_news_posts')->insertOrIgnore(['event_key'=>$key,'personality_id'=>DB::table('world_media_personalities')->where('slug',$desk)->value('id'),
            'kind'=>$kind,'headline'=>$headline,'body'=>$body,'facts'=>json_encode($facts),'published_at'=>now(),...$links]);
    }
    public function match(string $id):void{
        $match=OnlineMatch::find($id);if(!$match||$match->status!=='completed'||!isset($match->plan['fixture']))return;
        $fixture=ClubFixture::where('match_id',$id)->first();if(!$fixture)return;
        $winner=$match->plan['clubs'][$match->result['winner']];$loser=$match->plan['clubs'][$match->result['winner']==='blue'?'red':'blue'];
        $accelerated=($match->result['execution']['mode']??null)==='owner_requested_fast_forward';
        $r=$match->result['report'];$minutes=(int)floor($r['durationSeconds']/60);$seconds=str_pad((string)((int)$r['durationSeconds']%60),2,'0',STR_PAD_LEFT);
        $exhibition=$fixture->tournament_id&&ClubTournament::find($fixture->tournament_id)?->provenance==='launch_simulation';
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
    public function tick():void{
        $this->install();
        // Recovery is bounded; unique event keys also cover lost after-commit dispatches.
        foreach(OnlineMatch::where('status','completed')->where('completed_at','>=',now()->subDays(7))->orderByDesc('completed_at')->limit(30)->pluck('id') as $id)$this->match($id);
        foreach(ClubTournament::whereIn('status',['registration','active','launch_history'])->orderByDesc('id')->limit(30)->get() as $event){
            $archive=$event->provenance==='launch_simulation';
            $this->post('edition:'.$event->id.':'.$event->status,'lantern',$archive?'launch_archive':'tournament',($archive?'Launch exhibition: ':'Tournament desk: ').$event->title(),
                $archive?($event->regulations['notice']??'Labeled launch simulation.'):('Published '.$event->status.' event. Registration closes '.$event->registration_closes_at->toIso8601String().'. Read the regulations, entry paths and schedule in Hexapedia.'),
                ['provenance'=>$event->provenance,'status'=>$event->status],['tournament_id'=>$event->id]);
        }
        foreach(OnlineMatch::where('status','running')->where('spectator_ready',true)->limit(20)->get() as $live){
            if(!$live->canSpectate())continue;
            $this->post('broadcast:'.$live->id,'relay','tournament',$live->plan['clubs']['blue'].' vs '.$live->plan['clubs']['red'].' ? live',
                'The scheduled Arena broadcast is open. Follow the same recorded action in the Arena and text views; join the manager discussion below.',
                ['provenance'=>'verified_live'],['match_id'=>$live->id]);
        }
        $leader=DB::table('competition_ratings as r')->join('online_clubs as c','c.id','=','r.participant_id')->where('r.system','HGR')->where('r.games','>',0)->orderByDesc('r.score')->first(['c.id','c.name','r.score','r.games']);
        if($leader)$this->post('spotlight:'.now('UTC')->toDateString(),'pixels','spotlight',$leader->name.' lead the club rating table',
            $leader->name.' currently have '.round($leader->score,1).' HGR after '.$leader->games.' rated games. Follow their published club record in Hexapedia.', ['team_id'=>$leader->id,'score'=>(float)$leader->score,'games'=>$leader->games,'provenance'=>'verified']);
        $player=DB::table('club_training_sessions as s')->join('owned_player_cards as p','p.id','=','s.card_id')->whereNull('p.retired_at')->whereNotNull('p.persona_name')
            ->groupBy('p.id','p.persona_name')->orderByRaw('COUNT(*) DESC')->orderBy('p.id')->selectRaw('p.id,p.persona_name,COUNT(*) as appearances')->first();
        if($player)$this->post('player-spotlight:'.now('UTC')->toDateString(),'pixels','spotlight','Player spotlight: '.$player->persona_name,
            $player->persona_name.' have recorded '.$player->appearances.' verified scheduled Arena appearances. Their Hexapedia record follows the same person through training and transfers.',
            ['player_id'=>$player->id,'appearances'=>$player->appearances,'provenance'=>'verified']);
        $this->previews();
        $this->development();
        DB::table('world_broadcast_presence')->where('seen_at','<',now()->subMinutes(5))->delete();
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
    private function previews():void{
        foreach(ClubFixture::whereNull('match_id')->whereNull('hold_reason')->whereBetween('kickoff_at',[now(),now()->addDays(2)])->with(['homeClub:id,name','awayClub:id,name'])->orderBy('kickoff_at')->limit(3)->get() as $f){
            if(!$f->homeClub||!$f->awayClub)continue;
            $this->post('preview:'.$f->id,'relay','tournament',$f->homeClub->name.' vs '.$f->awayClub->name.': next on the calendar',
                $f->competition.' is scheduled for '.$f->kickoff_at->setTimezone('Asia/Manila')->format('j M Y, g:i A').' Manila. Orders close fifteen minutes before kickoff. Follow the published fixture; the teams, coach draft and outcome will be reported from the actual Arena. No result is predicted.',
                ['provenance'=>'scheduled','fixture_id'=>$f->id,'home_id'=>$f->home_club_id,'away_id'=>$f->away_club_id],['tournament_id'=>$f->tournament_id]);
        }
    }
    private function development():void{
        $recent=DB::table('player_progress_snapshots')->whereNull('media_reviewed_at')->where('observed_at','>=',now()->subDays(8))->orderBy('id')->limit(100)->get();$published=0;
        foreach($recent as $latest){
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
