<?php
namespace App\Services;
use App\Models\{ClubFixture,OnlineClub};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class ClubMatchHistory {
 private function base(int $club){return ClubFixture::where(fn($q)=>$q->where('home_club_id',$club)->orWhere('away_club_id',$club));}
 private function verified($q){return $q->where('status','completed')->whereNotNull('result_hash')->where(fn($q)=>$q->where(fn($q)=>$q->where('result->winner','blue')->where('result->terminal_nexus->red',true))->orWhere(fn($q)=>$q->where('result->winner','red')->where('result->terminal_nexus->blue',true)));}
 private function dateFilter($q,array $filters,string $column):void {
  if($filters['from']??null)$q->where($column,'>=',CarbonImmutable::parse($filters['from'],'Asia/Manila')->startOfDay()->utc());
  if($filters['to']??null)$q->where($column,'<',CarbonImmutable::parse($filters['to'],'Asia/Manila')->startOfDay()->addDay()->utc());
 }
 public function page(OnlineClub $club,array $filters):array {
  $base=$this->base($club->id);$archive=DB::table('launch_history_games')->where(fn($q)=>$q->where('home_club_id',$club->id)->orWhere('away_club_id',$club->id))->whereNull('fixture_id')->whereIn('status',['simulated','statistical_exhibition','completed']);
  $verified=(clone $base)->whereHas('match',fn($q)=>$this->verified($q));
  $wins=(clone $verified)->where(fn($q)=>$q->where(fn($q)=>$q->where('home_club_id',$club->id)->whereHas('match',fn($q)=>$q->where('result->winner','blue')))->orWhere(fn($q)=>$q->where('away_club_id',$club->id)->whereHas('match',fn($q)=>$q->where('result->winner','red'))))->count();
  $games=(clone $verified)->count();$summary=['verified_games'=>$games,'wins'=>$wins,'losses'=>$games-$wins,'interrupted'=>(clone $base)->whereHas('match',fn($q)=>$q->where('status','interrupted'))->count(),'scheduled'=>(clone $base)->where('kickoff_at','>',now())->where(fn($q)=>$q->whereNull('match_id')->orWhereHas('match',fn($q)=>$q->where('status','allocated')))->count(),'archive'=>$archive->count()];
  if(($filters['view']??'fixtures')==='archive'){
   if($filters['q']??null){$term='%'.mb_strtolower($filters['q']).'%';$archive->where(fn($q)=>$q->whereRaw('LOWER(phase) LIKE ?',[$term])->orWhereIn('home_club_id',OnlineClub::whereRaw('LOWER(name) LIKE ?',[$term])->select('id'))->orWhereIn('away_club_id',OnlineClub::whereRaw('LOWER(name) LIKE ?',[$term])->select('id'))->orWhereRaw('LOWER(?) LIKE ?',['Crown 2026 launch archive',$term]));}
   $this->dateFilter($archive,$filters,'scheduled_at');$page=$archive->orderBy('scheduled_at',($filters['sort']??'newest')==='oldest'?'asc':'desc')->orderBy('id')->paginate($filters['per_page']??20,['id','phase','scheduled_at','home_club_id','away_club_id','winner_id','status'],'page',$filters['page']??1);
   $names=OnlineClub::whereIn('id',$page->getCollection()->flatMap(fn($g)=>[$g->home_club_id,$g->away_club_id])->unique())->pluck('name','id');
   $page->setCollection($page->getCollection()->map(fn($g)=>['id'=>$g->id,'competition'=>'Crown 2026 launch archive · '.str_replace('_',' ',$g->phase),'kickoff_at'=>$g->scheduled_at,'home'=>['id'=>$g->home_club_id,'name'=>$names[$g->home_club_id]??'Archived club'],'away'=>['id'=>$g->away_club_id,'name'=>$names[$g->away_club_id]??'Archived club'],'status'=>$g->status,'outcome'=>$g->winner_id?($g->winner_id===$club->id?'simulated_win':'simulated_loss'):'unresolved','verified'=>false,'scope'=>'launch_archive','watch_id'=>null,'archive_id'=>$g->id]));
   return ['club'=>$club->only(['id','name']),'summary'=>$summary,'page'=>$page];
  }
  $q=clone $base;$status=$filters['status']??'played';
  match($status){'played'=>$q->whereHas('match',fn($q)=>$q->whereIn('status',['completed','interrupted','failed'])),'verified'=>$q->whereHas('match',fn($q)=>$this->verified($q)),'interrupted'=>$q->whereHas('match',fn($q)=>$q->where('status','interrupted')),'upcoming'=>$q->where('kickoff_at','>=',now())->where(fn($q)=>$q->whereNull('match_id')->orWhereHas('match',fn($q)=>$q->where('status','allocated'))),default=>null};
  if(in_array($status,['wins','losses'],true))$q->whereHas('match',fn($q)=>$this->verified($q))->where(fn($q)=>$q->where(fn($q)=>$q->where('home_club_id',$club->id)->whereHas('match',fn($q)=>$q->where('result->winner',$status==='wins'?'blue':'red')))->orWhere(fn($q)=>$q->where('away_club_id',$club->id)->whereHas('match',fn($q)=>$q->where('result->winner',$status==='wins'?'red':'blue'))));
  $kind=$filters['kind']??'all';if($kind==='tournaments')$q->whereHas('tournament',fn($q)=>$q->where(fn($q)=>$q->whereNull('accreditation')->orWhere('accreditation','!=',CommunityCups::ACCREDITATION)));elseif($kind==='community')$q->whereHas('tournament',fn($q)=>$q->where('accreditation',CommunityCups::ACCREDITATION));elseif($kind==='scrimmages')$q->whereNull('tournament_id')->whereIn('competition',['Club Friendly','Scrimmage']);
  if($filters['q']??null){$term='%'.mb_strtolower($filters['q']).'%';$q->where(fn($q)=>$q->whereRaw('LOWER(competition) LIKE ?',[$term])->orWhereHas('homeClub',fn($q)=>$q->whereRaw('LOWER(name) LIKE ?',[$term]))->orWhereHas('awayClub',fn($q)=>$q->whereRaw('LOWER(name) LIKE ?',[$term])));}
  $this->dateFilter($q,$filters,'kickoff_at');
  $page=$q->with(['match','tournament','homeClub:id,name,identity','awayClub:id,name,identity'])->orderBy('kickoff_at',($filters['sort']??'newest')==='oldest'?'asc':'desc')->orderByDesc('id')->paginate($filters['per_page']??20,['*'],'page',$filters['page']??1);
  $archiveLinks=DB::table('launch_history_games')->whereIn('fixture_id',$page->getCollection()->pluck('id'))->where('status','statistical_exhibition')->pluck('id','fixture_id');
  $page->setCollection($page->getCollection()->map(function($f)use($club,$archiveLinks){$m=$f->match;$winner=$m?->status==='completed'?($m->result['winner']??null):null;$confirmed=in_array($winner,['blue','red'],true)&&$m->result_hash&&($m->result['terminal_nexus'][$winner==='blue'?'red':'blue']??false)===true;$ownSide=$f->home_club_id===$club->id?'blue':'red';
   return ['id'=>$f->id,'competition'=>$f->competition,'tournament_id'=>$f->tournament_id,'kickoff_at'=>$f->kickoff_at,'completed_at'=>$m?->completed_at,'home'=>['id'=>$f->home_club_id,'name'=>$m?->plan['clubs']['blue']??$f->homeClub?->name,'identity'=>$m?->plan['club_identities']['blue']??$f->homeClub?->identity],'away'=>['id'=>$f->away_club_id,'name'=>$m?->plan['clubs']['red']??$f->awayClub?->name,'identity'=>$m?->plan['club_identities']['red']??$f->awayClub?->identity],
    'status'=>$f->hold_reason?'review':($m?->status??'scheduled'),'scope'=>$f->tournament?(CommunityCups::isFun($f->tournament)?'community':'tournament'):(in_array($f->competition,['Club Friendly','Scrimmage'])?'scrimmage':'club_fixture'),
    'verified'=>(bool)$confirmed,'outcome'=>$winner?(($confirmed?'':'recorded_').($winner===$ownSide?'win':'loss')):'unresolved','score'=>$winner?['blue'=>$m->result['report']['blueKills']??null,'red'=>$m->result['report']['redKills']??null]:null,'duration_seconds'=>$winner?($m->result['report']['durationSeconds']??null):null,'watch_id'=>$m?->canSpectate()?$m->id:null,'archive_id'=>$archiveLinks[$f->id]??null,'result_hash'=>$m?->result_hash];
  }));
  return ['club'=>$club->only(['id','name']),'summary'=>$summary,'page'=>$page];
 }
}
