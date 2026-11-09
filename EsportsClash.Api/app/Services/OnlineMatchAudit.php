<?php
namespace App\Services;

use App\Models\{ClubFixture,ClubTournament,OnlineMatch};
use Illuminate\Support\Facades\DB;

/** Read-only deployment evidence. Never starts, repairs or settles a match. */
class OnlineMatchAudit
{
    public function inspect(string $id):array
    {
        $match=OnlineMatch::findOrFail($id);$plan=$match->plan;$community=($plan['fixture']['progression']['kind']??null)==='community_fun';$completed=$match->status==='completed';
        $ids=[];$expectedXp=[];
        foreach(['blue','red'] as $side){
            $bonus=app(ClubStaffService::class)->trainingBonusFromSnapshot($plan['staff'][$side]??null);
            $minutes=(int)ceil(($match->result['report']['durationSeconds']??0)/60);
            foreach($plan[$side]??[] as $slot){$ids[]=$slot['instance_id'];$expectedXp[$slot['instance_id']]=$minutes+(int)round($minutes*$bonus/100);}
        }
        $ratings=DB::table('club_player_match_ratings')->where('match_id',$id)->get();
        $training=DB::table('club_training_sessions')->where('match_id',$id)->get();
        $same=function(array $actual)use($ids):bool{$expected=$ids;sort($actual);sort($expected);return $actual===$expected;};
        $fixture=ClubFixture::where('match_id',$id)->first();
        $exhibition=$fixture?->tournament_id&&ClubTournament::find($fixture->tournament_id)?->provenance==='launch_simulation';
        $nexus=$match->result['terminal_nexus']??[];
        $winner=($nexus['red']??null)===false?'blue':((($nexus['blue']??null)===false)?'red':null);
        $checks=[
            'ten_unique_allocated_people'=>count($ids)===10&&count(array_unique($ids))===10,
            'both_staff_snapshots'=>count($plan['staff']['blue']??[])===5&&count($plan['staff']['red']??[])===5,
            'public_recording'=>$match->canSpectate(),
            'real_time_execution'=>$completed?($match->result['execution']['mode']??null)!=='owner_requested_fast_forward':null,
            'verified_nexus_finish'=>$completed?is_bool($nexus['blue']??null)&&is_bool($nexus['red']??null)&&$winner!==null&&$winner===($match->result['winner']??null)&&$match->result_hash!==null:null,
            'ten_exact_performance_people'=>$completed?$same(array_column($match->result['player_performance']??[],'instance_id')):null,
            'ten_exact_rating_people'=>$completed?($community?$ratings->isEmpty():$same($ratings->pluck('card_id')->all())):null,
            'ratings_in_range'=>$completed?($community?$ratings->isEmpty():$ratings->count()===10&&$ratings->every(fn($r)=>$r->rating>=1&&$r->rating<=10)):null,
            'scheduled_training_people'=>$completed&&$fixture?($community?$training->isEmpty():$same($training->pluck('card_id')->all())):null,
            'pinned_staff_training_xp'=>$completed&&$fixture?($community?$training->isEmpty():$training->count()===10&&$training->every(fn($r)=>isset($expectedXp[$r->card_id])&&$r->xp===$expectedXp[$r->card_id])):null,
            'exhibition_excluded_from_ranked_results'=>$exhibition?!DB::table('competition_results')->where('match_id',$id)->exists():null,
        ];
        return ['match_id'=>$id,'status'=>$match->status,'sequence'=>$match->sequence,'started_at'=>$match->started_at,'completed_at'=>$match->completed_at,
            'community_fun'=>$community,'fixture_id'=>$fixture?->id,'exhibition'=>(bool)$exhibition,'checks'=>$checks,'rating_count'=>$ratings->count(),'training_count'=>$training->count(),
            'training_posted'=>$training->whereNotNull('processed_at')->count(),
            'settlement_integrity_passed'=>$completed&&!in_array(false,array_diff_key($checks,['real_time_execution'=>true]),true)&&$fixture!==null,
            'live_gate_passed'=>$completed&&!in_array(false,$checks,true)&&$fixture!==null,
            'error'=>$match->error,'notice'=>'Read-only evidence. Future-week training posting and full-year/capacity qualification are separate gates.'];
    }
}
