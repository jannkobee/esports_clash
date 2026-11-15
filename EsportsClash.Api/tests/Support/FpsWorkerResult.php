<?php
namespace Tests\Support;

use App\Models\OnlineMatch;

/** A complete current-revision settlement fixture; production decisions come from the worker. */
class FpsWorkerResult
{
    public static function forMatch(OnlineMatch $match):array
    {
        $stats=[];$performance=[];
        foreach(['blue','red'] as $team)foreach($match->plan[$team] as $slot){
            $id=$slot['instance_id'];
            $stats[$id]=['playerId'=>$id,'name'=>$match->plan['player_identities'][$id]??'Alias','team'=>$team,'kills'=>1,'deaths'=>0,'assists'=>2,'damage'=>100,'adr'=>6.25,'headshotRate'=>30,'plants'=>0,'defuses'=>0,'firstBloods'=>0,'tradeKills'=>0,'clutchesWon'=>0,'setPiecesInvolved'=>0];
            $performance[]=['instance_id'=>$id,'team'=>$team,'kills'=>1,'deaths'=>0,'assists'=>2,'damage'=>100,'adr'=>6.25,'headshot_rate'=>30,'plants'=>0,'defuses'=>0,'first_bloods'=>0,'trade_kills'=>0,'clutches_won'=>0,'set_pieces_involved'=>0];
        }
        $rounds=[];for($round=1;$round<=16;$round++)$rounds[]=['roundNumber'=>$round,'winnerTeam'=>'blue','winnerSide'=>$round<=15?'attackers':'defenders','reason'=>$round<=15?'defenders_eliminated':'attackers_eliminated','roundDurationSeconds'=>75,'blueScoreAfter'=>$round,'redScoreAfter'=>0];
        return ['match_id'=>$match->id,'game_mode'=>'fps_mr15_v1','seed'=>$match->plan['seed'],'versions'=>$match->plan['versions'],'winner'=>'blue','player_performance'=>$performance,
            'report'=>['format'=>'MR15_TACTICAL_FPS','simulationVersion'=>$match->plan['fps']['simulation_version'],'winner'=>'blue','winnerTeam'=>'blue','mapId'=>$match->plan['fps']['map_id'],'seed'=>$match->plan['seed'],'totalRounds'=>16,'durationSeconds'=>1200,'finalScore'=>['blue'=>16,'red'=>0],'roundResults'=>$rounds,'playerStats'=>$stats,'events'=>[]]];
    }
}
