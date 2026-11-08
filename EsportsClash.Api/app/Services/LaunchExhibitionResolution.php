<?php
namespace App\Services;

use App\Models\{ClubFixture,ClubTournament,OnlineMatch};
use Illuminate\Support\Facades\DB;

/** Explicit owner-only exception for the unranked launch exhibition, never Arena settlement. */
class LaunchExhibitionResolution
{
    public function resolve(string $id,array $observed,bool $ownerApproved=false):array
    {
        abort_unless($ownerApproved,403,'Owner approval is required for a statistical exhibition result.');
        $report=DB::transaction(function()use($id,$observed){
            $fixture=ClubFixture::where('match_id',$id)->firstOrFail();
            $event=ClubTournament::whereKey($fixture->tournament_id)->lockForUpdate()->firstOrFail();
            abort_unless($event->scope==='launch-archive'&&$event->provenance==='launch_simulation',409,'Only the unranked launch exhibition can use this exception.');
            $game=DB::table('launch_history_games')->where('fixture_id',$fixture->id)->lockForUpdate()->first();abort_unless($game,404);
            if($game->report_hash){$prior=json_decode($game->report,true);abort_unless(($prior['kind']??null)==='statistical_exhibition'&&($prior['source_match_id']??null)===$id,409,'Existing results are immutable.');return $prior;}
            $match=OnlineMatch::whereKey($id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($match->status,['allocated','running','interrupted'],true)&&!$match->result_hash&&!$game->winner_id,409,'A settled Arena result cannot be replaced.');
            abort_unless(($observed['match_id']??null)===$id&&($observed['plan_hash']??null)===$match->plan_hash&&($observed['sequence']??0)>=$match->sequence,422,'The observation must belong to the preserved match.');
            abort_if(DB::table('club_player_match_ratings')->where('match_id',$id)->exists()||DB::table('club_training_sessions')->where('match_id',$id)->exists()||DB::table('competition_results')->where('match_id',$id)->exists(),409,'An awarded match cannot be statistically replaced.');
            $inputs=[];
            foreach(['blue','red'] as $side){
                $profiles=array_map(fn($slot)=>$match->plan['player_profiles'][$slot['instance_id']]['ovr']??null,$match->plan[$side]);
                abort_unless(count($profiles)===5&&!in_array(null,$profiles,true),422,'Pinned player skills are required.');
                $fact=$observed['sides'][$side]??[];
                abort_unless(isset($fact['kills'],$fact['enemy_structures_destroyed'])&&is_int($fact['kills'])&&$fact['kills']>=0&&$fact['kills']<1000&&is_int($fact['enemy_structures_destroyed'])&&$fact['enemy_structures_destroyed']>=0&&$fact['enemy_structures_destroyed']<=10,422,'Invalid observed exhibition facts.');
                $skill=array_sum($profiles)/5;$tactics=(float)($match->plan['staff'][$side]['head_coach']['attributes']['tactics']??5);
                $inputs[$side]=['mean_pinned_overall'=>$skill,'coach_tactics'=>$tactics,...$fact,
                    'model_score'=>$skill+.5*$tactics+2*$fact['enemy_structures_destroyed']+.25*$fact['kills']];
            }
            $probability=max(.05,min(.95,1/(1+exp(-($inputs['blue']['model_score']-$inputs['red']['model_score'])/10))));
            $commitment=hash('sha256',$match->plan_hash.':exhibition-strength-draw-v1:'.($observed['fingerprint']??''));
            $draw=hexdec(substr($commitment,0,8))/4294967296;$winner=$draw<$probability?'blue':'red';
            $report=['kind'=>'statistical_exhibition','provenance'=>'statistical_exhibition','method'=>'exhibition-strength-draw-v1',
                'source_match_id'=>$id,'source_sequence'=>$observed['sequence'],'interrupted_second'=>$observed['second'],
                'winner'=>$winner,'winning_club_id'=>$winner==='blue'?$fixture->home_club_id:$fixture->away_club_id,
                'clubs'=>$match->plan['clubs'],'inputs'=>$inputs,'blue_win_probability'=>$probability,'draw'=>$draw,'seed_commitment'=>$commitment,
                'formula'=>'Score = mean pinned overall + 0.5 coach tactics + 2 enemy structures destroyed + 0.25 observed kills. Blue probability is logistic(score difference / 10), bounded 5%-95%. A committed deterministic draw chooses the exhibition winner.',
                'notice'=>'Owner-approved statistical exhibition result. The Arena was interrupted without a Nexus finish. No fictional final KDA, duration or combat events are generated. No official ranking points, player ratings, training or money rewards.',
                'generated_at'=>now()->toIso8601String()];
            $json=json_encode($report,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES);
            DB::table('launch_history_games')->where('id',$game->id)->update(['status'=>'statistical_exhibition','report'=>$json,'report_hash'=>hash('sha256',$json),'winner_id'=>$report['winning_club_id'],'generated_at'=>now(),'error'=>null]);
            $match->update(['status'=>'interrupted','sequence'=>$observed['sequence'],'error'=>'Owner interrupted the Arena; a separate statistical launch-exhibition result was approved.']);
            DB::table('competition_audits')->insert(['action'=>'launch.statistical-exhibition','subject'=>$id,'details'=>json_encode(['game_id'=>$game->id,'method'=>$report['method'],'winning_club_id'=>$report['winning_club_id'],'source_sequence'=>$observed['sequence'],'authorization'=>'Explicit owner confirmation; exhibition only; zero official/player rewards']),'created_at'=>now()]);
            return $report;
        },3);
        app(WorldMedia::class)->statisticalExhibition($id,$report);
        return $report;
    }
}
