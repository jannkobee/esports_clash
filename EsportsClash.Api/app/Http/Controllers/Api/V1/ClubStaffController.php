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

        return response()->json(['data' => [
            'staff' => $staff->roster($club),
            'candidates'=>app(\App\Services\StaffContracts::class)->candidates($club),
            'contracts'=>app(\App\Services\StaffContracts::class)->history($club->id),
            'coach_effects' => $staff->coachCard($club),
            'training_bonus_percent' => $staff->trainingBonusPercent($club),
            'draft_policy' => [
                'starter_selection' => 'manager',
                'avatar_selection' => 'staff',
                'meta_source' => 'verified completed Arena drafts with per-player performance records',
                'meta_minimum_samples' => 3,
            ],
        ]]);
    }
    public function hire(Request $r,OnlineService $online,\App\Services\StaffContracts $contracts){
        $v=$r->validate(['candidate_id'=>'required|string|max:100']);$contracts->hire($online->provision($r->user()),$v['candidate_id']);return response()->noContent();
    }
    public function release(Request $r,OnlineService $online,\App\Services\StaffContracts $contracts){
        $v=$r->validate(['role'=>'required|string|max:32']);$contracts->release($online->provision($r->user()),$v['role']);return response()->noContent();
    }
}
