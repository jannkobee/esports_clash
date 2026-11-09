<?php
namespace App\Services;
use App\Models\{ClubFixture,ClubTournament,OnlineMatch,User};
use Illuminate\Support\Facades\DB;

class ManagerRecordBook {
 public function capture(int $resultId):int {
  return DB::transaction(function()use($resultId){
   $receipt=DB::table('competition_results')->where('id',$resultId)->lockForUpdate()->first();if(!$receipt)return 0;
   $match=OnlineMatch::find($receipt->match_id);$event=ClubTournament::find($receipt->tournament_id);$fixture=ClubFixture::find($receipt->fixture_id);
   if(!$match||!$event||!$fixture||$match->status!=='completed'||$event->participant_type!=='club'||$event->provenance!=='verified'||CommunityCups::isFun($event)||!hash_equals($receipt->result_hash,$match->result_hash??''))return 0;
   $winner=$match->result['winner']??null;if(!in_array($winner,['blue','red'],true)||($match->result['terminal_nexus'][$winner==='blue'?'red':'blue']??false)!==true)return 0;
   $events=DB::table('competition_rating_events')->where('result_id',$resultId)->where('system','HGR')->get()->keyBy('participant_id');$count=0;
   foreach(['blue','red'] as $side){
    $clubId=$side==='blue'?$fixture->home_club_id:$fixture->away_club_id;$managerId=$side==='blue'?$match->blue_user_id:$match->red_user_id;$rating=$events[$clubId]??null;
    // Allocation-time ownership is authoritative. Never award an inherited club's past results to today's owner.
    if(!$managerId||!$clubId||!$rating||!($manager=User::find($managerId)))continue;
    $before=json_decode($rating->before,true);$after=json_decode($rating->after,true);
    $count+=DB::table('manager_match_records')->insertOrIgnore(['result_id'=>$resultId,'match_id'=>$match->id,'manager_user_id'=>$managerId,'club_id'=>$clubId,'opponent_id'=>$rating->opponent_id,'tournament_id'=>$event->id,'fixture_id'=>$fixture->id,
     'manager_name'=>$manager->name,'club_name'=>$match->plan['clubs'][$side]??'Club '.$clubId,'won'=>$winner===$side,'counted'=>($after['games']??0)>($before['games']??0),'rating_before'=>$before['rating'],'rating_after'=>$after['rating'],'score_before'=>$before['score'],'score_after'=>$after['score'],'result_hash'=>$receipt->result_hash,'played_at'=>$match->completed_at]);
   }return $count;
  },3);
 }
 public function backfill():int {
  $ids=DB::table('competition_results')->whereIn('id',DB::table('competition_rating_events')->where('system','HGR')->select('result_id'))->whereNotIn('id',DB::table('manager_match_records')->select('result_id'))->orderBy('id')->limit(200)->pluck('id');$count=0;foreach($ids as $id)$count+=$this->capture($id);return $count;
 }
 private function managers(){return DB::table('users as u')->where(fn($q)=>$q->whereExists(fn($q)=>$q->selectRaw('1')->from('online_clubs')->whereColumn('online_clubs.user_id','u.id'))->orWhereExists(fn($q)=>$q->selectRaw('1')->from('manager_match_records')->whereColumn('manager_match_records.manager_user_id','u.id')));}
 public function directory(string $search,int $page,int $perPage):array {
  $q=$this->managers();if($search!=='')$q->whereRaw('LOWER(u.name) LIKE ?',['%'.mb_strtolower($search).'%']);$total=(clone $q)->count();
  return ['items'=>$q->orderBy('u.name')->orderBy('u.id')->offset(($page-1)*$perPage)->limit($perPage)->get(['u.id','u.name'])->map(fn($r)=>['id'=>$r->id,'name'=>$r->name,'role'=>'Manager','type'=>'Club manager']),'meta'=>['total'=>$total,'page'=>$page,'per_page'=>$perPage,'last_page'=>max(1,(int)ceil($total/$perPage))]];
 }
 public function article(string $id):array {
  $manager=$this->managers()->where('u.id',ctype_digit($id)?(int)$id:0)->first(['u.id','u.name']);abort_unless($manager,404);
  $q=DB::table('manager_match_records')->where('manager_user_id',$manager->id)->where('counted',true);
  $record=(clone $q)->selectRaw('COUNT(*) as games, COALESCE(SUM(CASE WHEN won THEN 1 ELSE 0 END),0) as wins, COALESCE(SUM(rating_after-rating_before),0) as rating_gain')->first();
  return ['id'=>$manager->id,'name'=>$manager->name,'role'=>'Manager','type'=>'Club manager',
   'manager_record'=>['games'=>(int)$record->games,'wins'=>(int)$record->wins,'losses'=>(int)$record->games-(int)$record->wins,'rating_gain'=>round($record->rating_gain,2)],
   'manager_clubs'=>DB::table('online_clubs')->where('user_id',$manager->id)->whereNotNull('tag')->get(['id','name','tier','tag']),
   'manager_history'=>(clone $q)->groupBy('club_id','club_name')->selectRaw('club_id,club_name,COUNT(*) as games,MIN(played_at) as first_match,MAX(played_at) as last_match')->orderByDesc('last_match')->get(),
   'manager_awards'=>DB::table('manager_award_entries as e')->join('annual_award_editions as a','a.year','=','e.year')->where('e.manager_user_id',$manager->id)->where('a.status','awarded')->orderByDesc('e.year')->get(['e.year','e.category','e.position','e.score'])];
 }
}
