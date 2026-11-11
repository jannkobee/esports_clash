<?php

namespace App\Services;

use App\Models\OnlineClub;

/** Persistent preferences choose between legal actions; needs and payroll take precedence. */
class WorldManagerPolicy
{
    public function profile(int $clubId): array
    {
        $seed = hash('sha256', 'manager-policy-v1:'.$clubId);
        $traits = [];
        foreach (['development', 'ambition', 'patience', 'thrift'] as $i => $trait) {
            $traits[$trait] = hexdec(substr($seed, $i * 2, 2)) / 255;
        }
        if(app(WorldAgents::class)->ready()){
            $contract=\Illuminate\Support\Facades\DB::table('club_staff_contracts')->where('club_id',$clubId)->where('role','general_manager')->where('status','active')->where('ends_at','>',now())->latest('id')->first();
            if($contract&&str_starts_with($contract->candidate_key,'agent:')&&($executive=\App\Models\WorldAgent::find(substr($contract->candidate_key,6)))){
                $t=$executive->traits;$traits=['development'=>$t['adaptability'],'ambition'=>$t['ambition'],'patience'=>$t['patience'],'thrift'=>$t['thrift']];
            }
            $policy=\App\Models\WorldAgent::where('kind','manager')->where('club_id',$clubId)->where('status','employed')->value('policy');
            $policy=is_array($policy)?$policy:json_decode($policy??'{}',true);
            foreach($traits as $k=>$v)$traits[$k]=max(0,min(1,$v+max(-.1,min(.1,$policy['manager_adjustments'][$k]??0))));
        }
        $styles = ['development' => 'Talent builder', 'ambition' => 'Circuit challenger', 'patience' => 'Patient planner', 'thrift' => 'Careful investor'];
        arsort($traits);
        return ['version' => 1, 'style' => $styles[array_key_first($traits)], 'traits' => $traits];
    }

    public function assess(OnlineClub $club, int $rosterCount, int $balance, int $wages): array
    {
        $profile = $this->profile($club->id);
        $traits = $profile['traits'];
        $reserve = (int) config('world_players.bot_wage_reserve_weeks');
        $pressure = $balance < $wages * $reserve;
        $target = $pressure ? 5 : 7 + (int) round($traits['development'] * 2);
        $priority = $pressure ? 'Protect payroll' : ($rosterCount < 5 ? 'Restore a legal starting five' : ($rosterCount < $target ? 'Build squad depth' : 'Seek selective upgrades'));
        return $profile + ['priority' => $priority, 'target_roster' => $target, 'reserve_weeks' => $reserve,
            'bid_fraction' => (float) config('world_players.bot_bid_fraction') * (1 - 0.4 * $traits['thrift']),
            'minimum_improvement' => 2 + (int) round(2 * $traits['patience']),
            'academy_cover_weeks' => 12 + (int) round(4 * (1 - $traits['development'])),
            'reason' => $pressure ? 'Available funds are below the existing payroll reserve.' : 'Roster depth is '.$rosterCount.' against a preferred '.$target.'; bids still require a compatible improvement and protected payroll.',
            'reviewed_at' => now()->toIso8601String()];
    }
}
