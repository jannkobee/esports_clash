<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;
use App\Models\{ClubFixture,ClubTournament,OnlineMatch};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorldMediaController extends Controller
{
    public function flag(Request $r,int $id){
        $v=$r->validate(['comment_id'=>'nullable|integer|min:1','reason'=>'required|in:spam,harassment,misleading,other','detail'=>'nullable|string|max:500']);
        abort_unless(DB::table('world_news_posts')->where('id',$id)->whereNull('hidden_at')->exists(),404);
        if(isset($v['comment_id']))abort_unless(DB::table('world_news_comments')->where('id',$v['comment_id'])->where('post_id',$id)->whereNull('hidden_at')->exists(),404);
        $target=isset($v['comment_id'])?'comment:'.$v['comment_id']:'post:'.$id;
        DB::table('world_media_reports')->insertOrIgnore(['post_id'=>$id,'comment_id'=>$v['comment_id']??null,'user_id'=>$r->user()->id,'target_key'=>$target,'reason'=>$v['reason'],'detail'=>$v['detail']??null,'created_at'=>now()]);
        return response()->noContent();
    }
    public function moderation(Request $r){
        abort_unless($r->user()->is_evolution_admin,403);
        return ['data'=>DB::table('world_media_reports as r')->join('world_news_posts as p','p.id','=','r.post_id')->leftJoin('world_news_comments as c','c.id','=','r.comment_id')->where('r.status','open')->orderBy('r.id')->limit(50)->get(['r.id','r.post_id','r.comment_id','r.reason','r.detail','r.created_at','p.headline','p.body','c.body as comment_body'])];
    }
    public function review(Request $r,int $id){
        abort_unless($r->user()->is_evolution_admin,403);$v=$r->validate(['decision'=>'required|in:hide,dismiss']);
        DB::transaction(function()use($r,$id,$v){$report=DB::table('world_media_reports')->where('id',$id)->lockForUpdate()->first();abort_unless($report,404);if($report->status==='reviewed')return;
            if($v['decision']==='hide'){
                if($report->comment_id)DB::table('world_news_comments')->where('id',$report->comment_id)->where('post_id',$report->post_id)->update(['hidden_at'=>now()]);
                else DB::table('world_news_posts')->where('id',$report->post_id)->update(['hidden_at'=>now()]);
            }
            DB::table('world_media_reports')->where('id',$id)->update(['status'=>'reviewed','resolution'=>$v['decision'],'reviewer_id'=>$r->user()->id,'reviewed_at'=>now()]);
            DB::table('competition_audits')->insert(['user_id'=>$r->user()->id,'action'=>'media.report-reviewed','subject'=>'media-report:'.$id,'details'=>json_encode($v),'created_at'=>now()]);
        },3);return response()->noContent();
    }
    public function feed(Request $r){
        $v=$r->validate(['before'=>'nullable|integer|min:1','kind'=>'nullable|in:result,tournament,spotlight,launch_archive,community','match'=>'nullable|uuid','post'=>'nullable|integer|min:1']);
        $q=DB::table('world_news_posts as p')->leftJoin('world_media_personalities as n','n.id','=','p.personality_id')->leftJoin('users as u','u.id','=','p.author_id')->leftJoin('online_matches as m','m.id','=','p.match_id')->whereNull('p.hidden_at');
        if(isset($v['post']))$q->where('p.id',$v['post']);
        if(isset($v['before']))$q->where('p.id','<',$v['before']);if(isset($v['kind']))$q->where('p.kind',$v['kind']);if(isset($v['match']))$q->where('p.match_id',$v['match']);
        $q->selectSub(DB::table('world_news_comments as c')->selectRaw('COUNT(*)')->whereColumn('c.post_id','p.id')->whereNull('c.hidden_at'),'comments');
        $posts=$q->orderByDesc('p.id')->addSelect(['p.*','n.name as personality','n.role','n.bio','u.name as manager','m.status as match_status'])->limit(25)->get()->map(function($p){$p->facts=json_decode($p->facts??'{}',true);$p->comments=(int)$p->comments;unset($p->event_key);return $p;});
        return ['data'=>$posts,'next_before'=>$posts->count()===25?$posts->last()->id:null,'personalities'=>DB::table('world_media_personalities')->whereIn('role',['caster','analyst','streamer','host'])->orderBy('id')->limit(12)->get()];
    }
    public function comments(Request $r,int $id){
        $v=$r->validate(['before'=>'nullable|integer|min:1']);abort_unless(DB::table('world_news_posts')->where('id',$id)->whereNull('hidden_at')->exists(),404);
        $q=DB::table('world_news_comments as c')->join('users as u','u.id','=','c.user_id')->where('post_id',$id)->whereNull('c.hidden_at');if(isset($v['before']))$q->where('c.id','<',$v['before']);
        return ['data'=>$q->orderByDesc('c.id')->limit(50)->get(['c.id','c.user_id','c.body','c.created_at','u.name'])];
    }
    public function comment(Request $r,int $id){
        abort_unless(DB::table('world_news_posts')->where('id',$id)->whereNull('hidden_at')->exists(),404);
        $v=$r->validate(['body'=>'required|string|min:1|max:1500']);abort_if(trim($v['body'])==='',422);
        $id=DB::table('world_news_comments')->insertGetId(['post_id'=>$id,'user_id'=>$r->user()->id,'body'=>trim($v['body']),'created_at'=>now()]);return response()->json(['data'=>['id'=>$id]],201);
    }
    public function hideComment(Request $r,int $id){
        $c=DB::table('world_news_comments')->find($id);abort_unless($c,404);abort_unless($c->user_id===$r->user()->id || $r->user()->is_evolution_admin,403);
        DB::table('world_news_comments')->where('id',$id)->update(['hidden_at'=>now()]);return response()->noContent();
    }
    public function publish(Request $r){
        $v=$r->validate(['body'=>'required|string|min:1|max:2000']);abort_if(trim($v['body'])==='',422);
        $id=DB::table('world_news_posts')->insertGetId(['event_key'=>'community:'.\Illuminate\Support\Str::uuid(),'author_id'=>$r->user()->id,'kind'=>'community','headline'=>'From the club office','body'=>trim($v['body']),'published_at'=>now()]);return response()->json(['data'=>['id'=>$id]],201);
    }
    public function hidePost(Request $r,int $id){
        $p=DB::table('world_news_posts')->find($id);abort_unless($p,404);abort_unless($p->author_id===$r->user()->id || $r->user()->is_evolution_admin,403);
        DB::table('world_news_posts')->where('id',$id)->update(['hidden_at'=>now()]);return response()->noContent();
    }
    public function broadcasts(Request $request){
        $v=$request->validate(['q'=>'nullable|string|max:100','tier'=>'nullable|integer|between:1,5','upcoming_page'=>'nullable|integer|min:1|max:1000000','replay_page'=>'nullable|integer|min:1|max:1000000']);
        $base=ClubFixture::whereNull('hold_reason')->whereBetween('kickoff_at',[now()->subDays(30),now()->addDays(14)]);
        if($v['q']??null){$term='%'.mb_strtolower($v['q']).'%';$base->where(fn($q)=>$q->whereRaw('LOWER(competition) LIKE ?',[$term])->orWhereHas('homeClub',fn($q)=>$q->whereRaw('LOWER(name) LIKE ?',[$term]))->orWhereHas('awayClub',fn($q)=>$q->whereRaw('LOWER(name) LIKE ?',[$term]))->orWhereHas('homeNation',fn($q)=>$q->whereRaw('LOWER(name) LIKE ?',[$term]))->orWhereHas('awayNation',fn($q)=>$q->whereRaw('LOWER(name) LIKE ?',[$term])));}
        if($v['tier']??null)$base->where(fn($q)=>$q->whereHas('homeClub',fn($q)=>$q->where('tier',$v['tier']))->orWhereHas('awayClub',fn($q)=>$q->where('tier',$v['tier'])));
        $relations=['match','homeClub:id,name,identity,tier','awayClub:id,name,identity,tier','homeNation:id,name','awayNation:id,name'];
        $liveQuery=(clone $base)->where('kickoff_at','<=',now())->whereHas('match',fn($q)=>$q->where('status','running')->where('spectator_ready',true));
        $liveTotal=(clone $liveQuery)->count();$live=$liveQuery->with($relations)->orderByDesc('kickoff_at')->limit(30)->get();
        $upcoming=(clone $base)->where('kickoff_at','>=',now())->where(fn($q)=>$q->whereNull('match_id')->orWhereHas('match',fn($q)=>$q->where('status','allocated')))->with($relations)->orderBy('kickoff_at')->paginate(20,['*'],'upcoming_page',$v['upcoming_page']??1);
        $replays=(clone $base)->where('kickoff_at','<=',now())->whereHas('match',fn($q)=>$q->whereIn('status',['completed','interrupted'])->where('spectator_ready',true))->with($relations)->orderByDesc('kickoff_at')->paginate(20,['*'],'replay_page',$v['replay_page']??1);
        $fixtures=$live->concat($upcoming->getCollection())->concat($replays->getCollection());
        $events=ClubTournament::whereIn('id',$fixtures->pluck('tournament_id')->filter())->get()->keyBy('id');
        $counts=DB::table('world_broadcast_presence')->where('seen_at','>',now()->subSeconds(90))->selectRaw('match_id, COUNT(*) AS viewers')->groupBy('match_id')->pluck('viewers','match_id');
        $crews=DB::table('fixture_talent_assignments as a')->join('world_media_personalities as t','t.id','=','a.talent_id')->whereIn('a.fixture_id',$fixtures->pluck('id'))->get(['a.fixture_id','t.id','t.name','a.role'])->groupBy('fixture_id');
        $project=function($f)use($events,$counts,$crews){$m=$f->match;$event=$events[$f->tournament_id]??null;
            return ['fixture_id'=>$f->id,'competition'=>$f->competition,'tournament_id'=>$f->tournament_id,'kickoff_at'=>$f->kickoff_at,'status'=>$m?->status??'scheduled',
                'home'=>$f->homeClub?->only(['id','name','identity','tier'])??($f->homeNation?->only(['id','name'])?['id'=>$f->homeNation->id,'name'=>$f->homeNation->name,'national'=>true]:null),'away'=>$f->awayClub?->only(['id','name','identity','tier'])??($f->awayNation?->only(['id','name'])?['id'=>$f->awayNation->id,'name'=>$f->awayNation->name,'national'=>true]:null),
                'watch_id'=>$m?->canSpectate()?$m->id:null,'viewers'=>$m?(int)($counts[$m->id]??0):0,'featured'=>$event?->accreditation==='official'||min($f->homeClub?->tier??5,$f->awayClub?->tier??5)===1,
                'provenance'=>$event?->provenance??'verified','crew'=>$crews[$f->id]??[],'score'=>$m?->status==='completed'?['blue'=>$m->result['report']['blueKills']??null,'red'=>$m->result['report']['redKills']??null]:null,
                'duration_seconds'=>$m?->status==='completed'?($m->result['report']['durationSeconds']??null):null];};
        return ['data'=>['live'=>$live->map($project)->sortByDesc(fn($x)=>($x['featured']?1000000:0)+$x['viewers'])->values(),'upcoming'=>$upcoming->getCollection()->map($project),'replays'=>$replays->getCollection()->map($project),
            'meta'=>['live_total'=>$liveTotal,'upcoming_total'=>$upcoming->total(),'replay_total'=>$replays->total(),'upcoming_pages'=>$upcoming->lastPage(),'replay_pages'=>$replays->lastPage()]]];
    }
    public function presence(Request $r,string $id){
        $m=OnlineMatch::findOrFail($id);abort_unless($m->canSpectate()&&$m->status==='running',409,'This broadcast is not live.');
        DB::table('world_broadcast_presence')->updateOrInsert(['match_id'=>$id,'viewer_hash'=>hash('sha256','account:'.$r->user()->id)],['seen_at'=>now()]);return response()->noContent();
    }
    public function launch(){
        $event=ClubTournament::where('scope','launch-archive')->where('year',2026)->first();if(!$event)return ['data'=>null];
        $games=DB::table('launch_history_games as g')->leftJoin('online_clubs as h','h.id','=','g.home_club_id')->leftJoin('online_clubs as a','a.id','=','g.away_club_id')->leftJoin('club_fixtures as f','f.id','=','g.fixture_id')->where('g.tournament_id',$event->id)->orderBy('g.slot')->get(['g.id','g.slot','g.phase','g.group_key','g.round','g.home_club_id','g.away_club_id','g.scheduled_at','g.status','g.winner_id','g.fixture_id','g.generated_at','g.error','h.name as home','a.name as away','f.match_id','f.kickoff_at']);
        return ['data'=>['event'=>$event,'games'=>$games]];
    }
    public function launchReport(int $id){
        $g=DB::table('launch_history_games')->find($id);abort_unless($g,404);
        $report=$g->report?json_decode($g->report,true):null;
        return ['data'=>['id'=>$g->id,'provenance'=>$report['provenance']??'launch_simulation','scheduled_at'=>$g->scheduled_at,'generated_at'=>$g->generated_at,'status'=>$g->status,'report'=>$report]];
    }
    public function report(int $id){
        $f=ClubFixture::with(['match','homeClub:id,name','awayClub:id,name','homeNation:id,name','awayNation:id,name'])->findOrFail($id);$m=$f->match;
        abort_unless($m?->canSpectate()&&$m->status==='completed',404,'A public verified report is not available yet.');
        $r=$m->result['report'];$players=[];
        foreach(['blue','red'] as $side)foreach($m->plan[$side] as $i=>$slot){$p=$m->plan['player_profiles'][$slot['instance_id']]??[];
            $draft=$r['draft'][$side][$i]??[];$players[]=['id'=>$slot['instance_id'],'name'=>$p['name']??$m->plan['player_identities'][$slot['instance_id']]??$draft['player']['name']??'Archived player',
                'team'=>$side,'nationality'=>$p['nationality']??null,'avatar'=>$draft['champion']['displayName']??$draft['champion']['name']??$slot['avatar_id']];}
        return ['data'=>['fixture_id'=>$f->id,'competition'=>$f->competition,'kickoff_at'=>$f->kickoff_at,'started_at'=>$m->started_at,'completed_at'=>$m->completed_at,'match_id'=>$m->id,
            'clubs'=>$m->plan['clubs'],'winner'=>$m->result['winner'],'duration_seconds'=>$r['durationSeconds'],'blue_kills'=>$r['blueKills']??null,'red_kills'=>$r['redKills']??null,
            'terminal_nexus'=>$m->result['terminal_nexus'],'players'=>$players,'events'=>array_map(fn($e)=>array_intersect_key($e,array_flip(['second','text','type','sequence','tick'])),$r['events']??[]),
            'provenance'=>'verified','execution'=>array_intersect_key($m->result['execution']??[],array_flip(['mode','from_second','notice'])),'tournament_id'=>$f->tournament_id]];
    }
}
