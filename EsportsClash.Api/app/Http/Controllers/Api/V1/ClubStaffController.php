<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\{ClubStaffService, OnlineService};
use Illuminate\Http\Request;

class ClubStaffController extends Controller
{
    public function index(Request $request, OnlineService $online, ClubStaffService $staff)
    {
        $club = $online->provision($request->user());

        $engine = app(\App\Services\FpsIdentityEngine::class);
        $gameplan = json_decode(\Illuminate\Support\Facades\DB::table('fps_team_systems')->where('club_id', $club->id)->value('gameplan') ?? 'null', true) ?? \App\Services\FpsIdentityEngine::PLAN;
        $philosophy = $engine->ready() ? $engine->describePhilosophy($engine->coach($club)['profile'], $gameplan) : null;
        $candidates = array_map(fn (array $c) => $c['role'] === 'head_coach' && $engine->ready() ? $c + ['philosophy' => $engine->describePhilosophy($engine->philosophy($c['id']), $gameplan)] : $c,
            app(\App\Services\StaffContracts::class)->candidates($club));
        return response()->json(['data' => [
            'staff' => $staff->roster($club),
            'candidates'=>$candidates,
            'attribute_effects' => ClubStaffService::FPS_ATTRIBUTES,
            'fps_effects' => $staff->fpsEffects($club),
            'coach_philosophy' => $philosophy,
            'contracts'=>app(\App\Services\StaffContracts::class)->history($club->id),
            'training_bonus_percent' => $staff->trainingBonusPercent($club),
        ]]);
    }
    public function hire(Request $r,OnlineService $online,\App\Services\StaffContracts $contracts){
        $v=$r->validate(['candidate_id'=>'required|string|max:100']);$contracts->hire($online->provision($r->user()),$v['candidate_id']);return response()->noContent();
    }
    public function release(Request $r,OnlineService $online,\App\Services\StaffContracts $contracts){
        $v=$r->validate(['role'=>'required|string|max:32']);$contracts->release($online->provision($r->user()),$v['role']);return response()->noContent();
    }
}
