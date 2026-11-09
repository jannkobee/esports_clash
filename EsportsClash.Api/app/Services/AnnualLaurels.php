<?php
namespace App\Services;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class AnnualLaurels {
 public const CATEGORIES=['player_of_the_year'=>'Player of the Year','rising_star'=>'Rising Star','match_mvp_leader'=>'MVP Laureate','assist_leader'=>'Playmaker of the Year'];
 public function ceremony(int $year):CarbonImmutable {return CarbonImmutable::create($year+1,1,1,20,0,0,'Asia/Manila')->nthOfMonth(2,CarbonImmutable::SATURDAY)->setTime(20,0);}
 public function refresh(int $year):void {
  DB::transaction(function()use($year){
   $ceremony=$this->ceremony($year);$end=CarbonImmutable::create($year+1,1,1,0,0,0,'Asia/Manila');
   $rules=['minimum_ranked_games'=>10,'categories'=>self::CATEGORIES,'calendar_timezone'=>'Asia/Manila','scope'=>'ranked','score'=>'60 × mean rating / 10 + 25 × Wilson lower win bound + 15 × min(games / 40, 1)','mvp'=>'Highest recorded rating, then result/contribution, then player UUID','manager_awards'=>app(ManagerLaurels::class)->rules(),'benefit'=>'Recognition only; no money, training or attribute changes'];
   DB::table('annual_award_editions')->insertOrIgnore(['year'=>$year,'name'=>'Hexatrick Laurels '.$year,'ceremony_at'=>$ceremony->utc(),'evidence_through'=>$end->utc(),'formula'=>'laurels-performance-v1','rules'=>json_encode($rules)]);
   $edition=DB::table('annual_award_editions')->where('year',$year)->lockForUpdate()->first();if($edition->awarded_at)return;
   DB::table('annual_award_editions')->where('year',$year)->update(['rules'=>json_encode($rules)]);
   $start=$end->subYear();$q=DB::table('player_career_records as r')->join('owned_player_cards as p','p.id','=','r.player_id')->where('r.scope','ranked')->whereNotNull('r.rating')->where('r.played_at','>=',$start->utc())->where('r.played_at','<',$end->utc());
   $aggregates='r.player_id, p.persona_name, COUNT(*) as games, SUM(CASE WHEN r.won THEN 1 ELSE 0 END) as wins, AVG(r.rating) as average_rating, SUM(CASE WHEN r.match_mvp THEN 1 ELSE 0 END) as mvps, SUM(r.assists) as assists';
   // SQL chooses bounded finalists; PHP never loads the world's entire player population.
   $groups=(clone $q)->selectRaw($aggregates)->groupBy('r.player_id','p.persona_name')->havingRaw('COUNT(*) >= 10');
   $win='(SUM(CASE WHEN r.won THEN 1.0 ELSE 0.0 END) / COUNT(*))';$lower="(($win + 3.8416/(2*COUNT(*)) - 1.96*SQRT(($win*(1-$win)+3.8416/(4*COUNT(*)))/COUNT(*)))/(1+3.8416/COUNT(*)))";
   $score="(60*AVG(r.rating)/10 + 25*$lower + 15*CASE WHEN COUNT(*)>=40 THEN 1.0 ELSE COUNT(*)/40.0 END)";
   DB::table('annual_award_entries')->where('year',$year)->delete();$entries=[];
   foreach(self::CATEGORIES as $category=>$label){
    $candidates=clone $groups;if($category==='rising_star')$candidates->where('p.world_profile->birth_date','>=',$end->subYears(22)->toDateString());
    $order=match($category){'match_mvp_leader'=>'SUM(CASE WHEN r.match_mvp THEN 1 ELSE 0 END)','assist_leader'=>'SUM(r.assists)/COUNT(*)',default=>$score};
    $rows=$candidates->selectRaw("$score as season_score, $order as award_score")->orderByDesc('award_score')->orderByDesc('season_score')->orderBy('r.player_id')->limit(5)->get();
    foreach($rows as $i=>$r)$entries[]=['year'=>$year,'category'=>$category,'position'=>$i+1,'player_id'=>$r->player_id,'player_name'=>$r->persona_name,'score'=>$r->award_score,'evidence'=>json_encode(['games'=>(int)$r->games,'wins'=>(int)$r->wins,'average_rating'=>round($r->average_rating,2),'mvps'=>(int)$r->mvps,'assists'=>(int)$r->assists,'season_score'=>round($r->season_score,2)])];
   }
   if($entries)DB::table('annual_award_entries')->insert($entries);
   $final=$ceremony->isPast();$managerEntries=app(ManagerLaurels::class)->refresh($year,$final);$hasEntries=(bool)$entries||$managerEntries>0;DB::table('annual_award_editions')->where('year',$year)->update(['status'=>$final?($hasEntries?'awarded':'no_eligible_players'):'nominations','calculated_at'=>now(),'awarded_at'=>$final?now():null]);
   if($final&&$entries){
    $winner=collect($entries)->first(fn($e)=>$e['category']==='player_of_the_year'&&$e['position']===1);$facts=json_decode($winner['evidence'],true);
    DB::table('world_news_posts')->insertOrIgnore(['event_key'=>'laurels:'.$year.':ceremony:v1','kind'=>'tournament','personality_id'=>DB::table('world_media_personalities')->where('role','host')->orderBy('id')->value('id'),
     'headline'=>$winner['player_name'].' receives the '.$year.' Player of the Year Laurel',
     'body'=>'The Hexatrick Laurels have closed the '.$year.' record. '.$winner['player_name'].' leads the year with '.$facts['games'].' eligible ranked appearances, a '.$facts['average_rating'].' average match rating and '.$facts['mvps'].' recorded match MVPs. The published ceremony record contains every category and its supporting evidence.',
     'facts'=>json_encode(['award_year'=>$year,'player_id'=>$winner['player_id'],'provenance'=>'verified_awards','formula'=>'laurels-performance-v1']),'published_at'=>now()]);
   }
  },3);
 }
 public function show(int $year):array {
  $edition=DB::table('annual_award_editions')->where('year',$year)->first();$rows=DB::table('annual_award_entries as e')->leftJoin('owned_player_cards as p','p.id','=','e.player_id')->where('e.year',$year)->orderBy('e.category')->orderBy('e.position')->get(['e.*','p.persona_name','p.presentation'])->map(function($e){$e->name=$e->persona_name??$e->player_name;$e->evidence=json_decode($e->evidence,true);$e->presentation=json_decode($e->presentation??'null',true);unset($e->persona_name);return $e;});
  if($edition)$edition->rules=json_decode($edition->rules,true);
  return ['edition'=>$edition??['year'=>$year,'name'=>'Hexatrick Laurels '.$year,'status'=>'nominations','ceremony_at'=>$this->ceremony($year)->utc()->toIso8601String(),'rules'=>['minimum_ranked_games'=>10]],'categories'=>self::CATEGORIES,'entries'=>$rows,'manager_categories'=>ManagerLaurels::CATEGORIES,'manager_entries'=>app(ManagerLaurels::class)->entries($year),'years'=>DB::table('annual_award_editions')->orderByDesc('year')->pluck('year')];
 }
}
