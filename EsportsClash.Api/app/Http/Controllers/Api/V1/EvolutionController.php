<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BalanceReview;
use App\Models\EvolutionRun;
use App\Models\EvolutionSetting;
use App\Services\EvolutionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EvolutionController extends Controller
{
    private function authorizeOwner(Request $request): string
    {
        abort_unless($request->user()?->is_evolution_admin, 403, 'Evolution controls require the designated owner account.');
        return 'user:'.$request->user()->id;
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);
        return response()->json(['data' => ['settings' => EvolutionSetting::current(),
            'runs' => EvolutionRun::latest()->limit(20)->get(),
            'reviews' => BalanceReview::with('proposals')->latest()->limit(20)->get(),
            'audit' => DB::table('evolution_audits')->latest('id')->limit(50)->get(),
            'capabilities' => ['live_macro_training' => true, 'production_promotion' => false,
                'intelligence_domains' => ['parameter','marl','source'], 'qualified_policy_activation' => true,
                'mechanical_patch_release' => false, 'avatar_evolution' => false]]]);
    }

    public function settings(Request $request, EvolutionService $service): JsonResponse
    {
        $actor = $this->authorizeOwner($request);
        $data = $request->validate(['enabled' => ['sometimes', 'boolean'],
            'review_hours' => ['sometimes', 'integer', 'min:1', 'max:336'],
            'training_interval_minutes' => ['sometimes', 'integer', 'min:30', 'max:10080']]);
        return response()->json(['data' => $service->updateSettings($data, $actor)]);
    }

    public function start(Request $request, EvolutionService $service): JsonResponse
    {
        $run = $service->startRun($this->authorizeOwner($request));
        return response()->json(['data' => $run], 202);
    }

    public function stop(Request $request, string $id, EvolutionService $service): JsonResponse
    {
        $actor = $this->authorizeOwner($request);
        $run = $service->stopRun($id, $actor);
        return response()->json(['data' => $run], 202);
    }

    public function decide(Request $request, string $id, EvolutionService $service): JsonResponse
    {
        $actor = $this->authorizeOwner($request);
        $data = $request->validate(['action' => ['required', 'in:select,reject,decline,defer'],
            'proposal_id' => ['nullable', 'integer'], 'hours' => ['nullable', 'integer', 'min:1', 'max:336']]);
        return response()->json(['data' => $service->decide($id, $data['action'], $data['proposal_id'] ?? null, $actor, $data['hours'] ?? null)]);
    }
}
