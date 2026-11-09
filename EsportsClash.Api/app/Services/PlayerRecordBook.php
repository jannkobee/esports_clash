<?php
namespace App\Services;
use App\Models\{ClubFixture,ClubTournament,OnlineMatch,OwnedPlayerCard};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/** Permanent receipts from accepted, Nexus-completed scheduled matches. */
class PlayerRecordBook {
 public function capture(string $id):int {
  return DB::transaction(function()use($id){
   $match=OnlineMatch::whereKey($id)->lockForUpdate()->firstOrFail();
   if($match->status!=='completed'||!$match->result_hash||!$match->completed_at)return 0;
   $receipt=DB::table('player_record_receipts')->where('match_id',$id)->first();
   if($receipt){abort_unless(hash_equals($receipt->result_hash,$match->result_hash),409,'Recorded performance hash differs from its immutable match.');return 0;}
   $winner=$match->result['winner']??null;$nexus=$match->result['terminal_nexus']??[];
   if(!in_array($winner,['blue','red'],true)||($nexus[$winner==='blue'?'red':'blue']??false)!==true)return 0;
   $fixture=ClubFixture::where('match_id',$id)->first();if(!$fixture)return 0;
   $event=$fixture->tournament_id?ClubTournament::find($fixture->tournament_id):null;
   $scope=$event?(CommunityCups::isFun($event)?'community':($event->ranked&&in_array($event->accreditation,['official','verified_ranked','premier'],true)&&$event->provenance==='verified'?'ranked':'exhibition')):'scrimmage';
   $raw=collect($match->result['player_performance']??[])->keyBy('instance_id');
   $ratings=DB::table('club_player_match_ratings')->where('match_id',$id)->get()->keyBy('card_id');
   $players=OwnedPlayerCard::withoutGlobalScopes()->whereIn('id',array_column([...($match->plan['blue']??[]),...($match->plan['red']??[])],'instance_id'))->get()->keyBy('id');
   $rows=[];$duration=(float)($match->result['report']['durationSeconds']??0);if($duration<=0)return 0;
   foreach(['blue','red'] as $side)foreach($match->plan[$side]??[] as $index=>$slot){
    $pid=$slot['instance_id'];if(!$players->has($pid))continue;
    $rating=$ratings[$pid]??null;$stats=$raw[$pid]??($rating?json_decode($rating->performance,true):null);if(!$stats)continue;
    foreach(['kills','deaths','assists','cs','gold','damage'] as $field)if(!isset($stats[$field])||!is_numeric($stats[$field])||$stats[$field]<0)return 0;
    $profile=$match->plan['player_profiles'][$pid]??[];$draft=$match->result['report']['draft'][$side][$index]['player']??[];
    $row=['player_id'=>$pid,'match_id'=>$id,'fixture_id'=>$fixture->id,'tournament_id'=>$fixture->tournament_id,'club_id'=>$side==='blue'?$fixture->home_club_id:$fixture->away_club_id,
     'player_name'=>$profile['name']??$match->plan['player_identities'][$pid]??$players[$pid]->persona_name,'club_name'=>$match->plan['clubs'][$side],
     'competition'=>$fixture->competition,'role'=>$profile['preferredRole']??$profile['role']??$draft['preferredRole']??$draft['role']??'Unlisted','scope'=>$scope,'won'=>$winner===$side,'match_mvp'=>false,'rating'=>$rating?->rating,'duration_seconds'=>$duration,'played_at'=>$match->completed_at,'result_hash'=>$match->result_hash];
    foreach(['kills','deaths','assists','cs','gold','damage'] as $field)$row[$field]=(float)$stats[$field];$rows[]=$row;
   }
   // Incomplete legacy evidence is left unindexed, rather than inventing missing players.
   if(count($rows)!==10){DB::table('player_record_receipts')->insert(['match_id'=>$id,'result_hash'=>$match->result_hash,'players'=>0,'captured_at'=>now()]);return 0;}
   // A transparent match accolade from the accepted rating, then contribution and UUID tie breaks.
   $mvp=collect($rows)->sort(function($a,$b){$rating=(float)($b['rating']??0)<=>(float)($a['rating']??0);$value=fn($r)=>($r['won']?10:0)+3*$r['kills']+1.5*$r['assists']-$r['deaths']+$r['cs']/100+$r['damage']/10000;return $rating?:($value($b)<=>$value($a))?:strcmp($a['player_id'],$b['player_id']);})->first()['player_id'];
   foreach($rows as &$row)$row['match_mvp']=$row['player_id']===$mvp;unset($row);
   DB::table('player_career_records')->insert($rows);DB::table('player_record_receipts')->insert(['match_id'=>$id,'result_hash'=>$match->result_hash,'players'=>count($rows),'captured_at'=>now()]);
   return count($rows);
  },3);
 }
 public function backfill(int $limit=200):int {
  $ids=OnlineMatch::where('status','completed')->whereNotNull('result->terminal_nexus')->whereNotIn('id',DB::table('player_record_receipts')->select('match_id'))->whereIn('id',DB::table('club_fixtures')->whereNotNull('match_id')->select('match_id'))->orderBy('completed_at')->limit($limit)->pluck('id');
  $count=0;foreach($ids as $id)$count+=$this->capture($id);return $count;
 }
 public function summary(string $id):array {
  $q=DB::table('player_career_records')->where('player_id',$id);
  $totals=(clone $q)->selectRaw('COUNT(*) as played, COALESCE(SUM(CASE WHEN won THEN 1 ELSE 0 END),0) as wins, COALESCE(SUM(CASE WHEN match_mvp THEN 1 ELSE 0 END),0) as mvps, AVG(rating) as rating, COALESCE(SUM(kills),0) as kills, COALESCE(SUM(deaths),0) as deaths, COALESCE(SUM(assists),0) as assists, COALESCE(SUM(damage),0) as damage, COALESCE(SUM(duration_seconds),0) as seconds')->first();
  $games=(int)$totals->played;$wins=(int)$totals->wins;$n=$games+4;$p=($wins+2)/$n;
  $history=(clone $q)->whereNotNull('club_id')->groupBy('club_id','club_name')->selectRaw('club_id, club_name, MIN(played_at) as first_appearance, MAX(played_at) as last_appearance, COUNT(*) as games')->orderBy('first_appearance')->get();
  $records=[];foreach(['kills','assists','cs','gold','damage'] as $stat){$best=(clone $q)->orderByDesc($stat)->orderBy('played_at')->first(['match_id','fixture_id','competition','played_at',$stat]);if($best)$records[]=['stat'=>$stat,'value'=>$best->$stat,'fixture_id'=>$best->fixture_id,'match_id'=>$best->match_id,'competition'=>$best->competition,'date'=>$best->played_at];}
  $awards=DB::table('annual_award_entries as e')->join('annual_award_editions as a','a.year','=','e.year')->where('e.player_id',$id)->where('a.status','awarded')->orderByDesc('e.year')->get(['e.year','e.category','e.position','e.score','a.name']);
  return ['played'=>$games,'wins'=>$wins,'losses'=>$games-$wins,'win_rate'=>$games?round(100*$wins/$games,1):null,'mvps'=>(int)$totals->mvps,'average_rating'=>$totals->rating!==null?round($totals->rating,2):null,
   'kills'=>(int)$totals->kills,'deaths'=>(int)$totals->deaths,'assists'=>(int)$totals->assists,'kda'=>$games?round(($totals->kills+$totals->assists)/max(1,$totals->deaths),2):null,
   'damage_per_minute'=>$totals->seconds>0?round($totals->damage/($totals->seconds/60),1):null,
   'win_estimate'=>$games>=5?['percent'=>round(100*$p,1),'low'=>round(100*max(0,$p-1.96*sqrt($p*(1-$p)/($n+1))),1),'high'=>round(100*min(1,$p+1.96*sqrt($p*(1-$p)/($n+1))),1),'samples'=>$games,'method'=>'Historical baseline with two wins and two losses of prior evidence; approximate 95% uncertainty. Opponent strength and future lineups are not modeled.']:null,
   'scopes'=>(clone $q)->select('scope',DB::raw('COUNT(*) as games'))->groupBy('scope')->get(),'team_history'=>$history,'personal_bests'=>$records,'awards'=>$awards,
   'note'=>'Accepted scheduled Arena results only. Launch simulations and interrupted recordings never count. Community appearances remain a separate scope and do not earn form, training or annual competitive awards.'];
 }
 public function page(string $id,array $filters):array {
  OwnedPlayerCard::withoutGlobalScopes()->whereKey($id)->firstOrFail();$q=DB::table('player_career_records')->where('player_id',$id);
  if($filters['scope']??null)$q->where('scope',$filters['scope']);
  if($year=$filters['year']??null){$start=CarbonImmutable::create($year,1,1,0,0,0,'Asia/Manila');$q->where('played_at','>=',$start->utc())->where('played_at','<',$start->addYear()->utc());}
  if($filters['q']??null)$q->whereRaw('LOWER(competition) LIKE ?',['%'.mb_strtolower($filters['q']).'%']);
  return $q->orderByDesc('played_at')->orderByDesc('id')->paginate($filters['per_page']??20,['*'],'page',$filters['page']??1)->toArray();
 }
}
