<?php
namespace App\Services;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
class ManagerLaurels {
 public const CATEGORIES=['manager_of_the_year'=>'Manager of the Year','most_improved_manager'=>'Most Improved Manager'];
 public function rules():array {return ['formula'=>'manager-performance-v1','minimum_ranked_games'=>10,'manager_of_the_year'=>'65 x Wilson lower win bound + 20 x min(games / 40, 1) + 15 x min(max(net skill-rating gain, 0) / 400, 1)','most_improved_manager'=>'Positive net HGR skill-rating gain during matches managed; minimum ten counted results.','ownership'=>'Allocation-time manager account; inherited history and repeat-opponent no-op ratings excluded.'];}
 public function refresh(int $year,bool $final):int {
  $start=CarbonImmutable::create($year,1,1,0,0,0,'Asia/Manila');$end=$start->addYear();
  $q=DB::table('manager_match_records as r')->join('users as u','u.id','=','r.manager_user_id')->where('r.counted',true)->where('r.played_at','>=',$start->utc())->where('r.played_at','<',$end->utc());
  $groups=$q->selectRaw('r.manager_user_id,u.name,COUNT(*) as games,SUM(CASE WHEN r.won THEN 1 ELSE 0 END) as wins,SUM(r.rating_after-r.rating_before) as rating_gain,SUM(r.score_after-r.score_before) as score_gain,COUNT(DISTINCT r.club_id) as clubs')->groupBy('r.manager_user_id','u.name')->havingRaw('COUNT(*) >= 10');
  $p='(SUM(CASE WHEN r.won THEN 1.0 ELSE 0.0 END)/COUNT(*))';$lower="(($p+3.8416/(2*COUNT(*))-1.96*SQRT(($p*(1-$p)+3.8416/(4*COUNT(*)))/COUNT(*)))/(1+3.8416/COUNT(*)))";
  $gain='SUM(r.rating_after-r.rating_before)';$score="(65*$lower+20*CASE WHEN COUNT(*)>=40 THEN 1.0 ELSE COUNT(*)/40.0 END+15*CASE WHEN $gain<=0 THEN 0 WHEN $gain>=400 THEN 1 ELSE $gain/400.0 END)";
  DB::table('manager_award_entries')->where('year',$year)->delete();$entries=[];
  foreach(self::CATEGORIES as $category=>$label){$candidate=clone $groups;$order=$category==='most_improved_manager'?$gain:$score;if($category==='most_improved_manager')$candidate->havingRaw("$gain > 0");
   $rows=$candidate->selectRaw("$order as award_score")->orderByDesc('award_score')->orderByDesc('wins')->orderBy('r.manager_user_id')->limit(5)->get();
   foreach($rows as $i=>$row)$entries[]=['year'=>$year,'category'=>$category,'position'=>$i+1,'manager_user_id'=>$row->manager_user_id,'manager_name'=>$row->name,'score'=>$row->award_score,'evidence'=>json_encode(['games'=>(int)$row->games,'wins'=>(int)$row->wins,'rating_gain'=>round($row->rating_gain,2),'score_gain'=>round($row->score_gain,2),'clubs'=>(int)$row->clubs])];
  }if($entries)DB::table('manager_award_entries')->insert($entries);
  if($final&&$entries){$winner=collect($entries)->firstWhere('category','manager_of_the_year');if($winner)DB::table('world_news_posts')->insertOrIgnore(['event_key'=>'laurels:'.$year.':managers:v1','kind'=>'tournament','personality_id'=>DB::table('world_media_personalities')->where('role','host')->orderBy('id')->value('id'),'headline'=>$winner['manager_name'].' earns the '.$year.' Manager of the Year Laurel','body'=>'The annual manager honors recognize verified ranked results and HGR progress earned while in charge. See the ceremony record for the finalists and their evidence.','facts'=>json_encode(['award_year'=>$year,'manager_id'=>$winner['manager_user_id'],'provenance'=>'verified_awards']),'published_at'=>now()]);}
  return count($entries);
 }
 public function entries(int $year){return DB::table('manager_award_entries as e')->join('users as u','u.id','=','e.manager_user_id')->where('e.year',$year)->orderBy('e.category')->orderBy('e.position')->get(['e.*','u.name'])->map(function($r){$r->evidence=json_decode($r->evidence,true);return $r;});}
}
