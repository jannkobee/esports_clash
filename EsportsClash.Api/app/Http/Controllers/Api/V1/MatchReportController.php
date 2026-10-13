<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MatchReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MatchReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(50, max(1, (int) $request->integer('per_page', 20)));
        $reports = $request->user()->matchReports()->latest()->paginate($perPage);

        return response()->json([
            'data' => $reports->getCollection()->map(fn (MatchReport $report) => $this->summary($report)),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'last_page' => $reports->lastPage(),
                'per_page' => $reports->perPage(),
                'total' => $reports->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'report' => ['required', 'array'],
            'report.version' => ['required', 'integer', 'in:1'],
            'report.seed' => ['required', 'integer', 'min:0'],
            'report.winner' => ['required', 'in:blue,red'],
            'report.durationSeconds' => ['required', 'integer', 'min:0', 'max:21600'],
            'report.blueKills' => ['required', 'integer', 'min:0', 'max:999'],
            'report.redKills' => ['required', 'integer', 'min:0', 'max:999'],
            'report.draft' => ['required', 'array'],
            'report.events' => ['required', 'array', 'max:5000'],
        ]);
        $report = $data['report'];

        $stored = $request->user()->matchReports()->create([
            'match_version' => $report['version'],
            'match_seed' => $report['seed'],
            'winner' => $report['winner'],
            'duration_seconds' => $report['durationSeconds'],
            'blue_kills' => $report['blueKills'],
            'red_kills' => $report['redKills'],
            'report' => $report,
        ]);

        return response()->json(['data' => $this->detail($stored)], 201);
    }

    public function show(Request $request, MatchReport $matchReport): JsonResponse
    {
        abort_unless($matchReport->user_id === $request->user()->id, 404);

        return response()->json(['data' => $this->detail($matchReport)]);
    }

    private function summary(MatchReport $report): array
    {
        return [
            'id' => $report->id,
            'version' => $report->match_version,
            'seed' => $report->match_seed,
            'winner' => $report->winner,
            'duration_seconds' => $report->duration_seconds,
            'blue_kills' => $report->blue_kills,
            'red_kills' => $report->red_kills,
            'created_at' => $report->created_at?->toISOString(),
        ];
    }

    private function detail(MatchReport $report): array
    {
        return [...$this->summary($report), 'report' => $report->report];
    }
}
