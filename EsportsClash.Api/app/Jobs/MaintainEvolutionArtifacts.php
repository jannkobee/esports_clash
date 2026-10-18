<?php

namespace App\Jobs;

use App\Models\EvolutionSetting;
use Illuminate\Contracts\Queue\{ShouldQueue, ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\{DB, Http};

class MaintainEvolutionArtifacts implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Queueable;
    public int $tries = 3;
    public int $timeout = 25;
    public int $uniqueFor = 90;
    public function backoff(): array { return [30, 60]; }
    public function handle(): void
    {
        $snapshot = Http::withToken(config('evolution.worker_token'))->connectTimeout(3)->timeout(20)
            ->post(rtrim(config('evolution.runner_url'), '/').'/operations/reconcile', [])->throw()->json();
        DB::transaction(function () use ($snapshot) {
            $settings = EvolutionSetting::lockForUpdate()->findOrFail(1);
            $preferences = $settings->preferences ?? [];
            $preferences['operations_snapshot'] = $snapshot;
            $preferences['operations_checked_at'] = now()->toIso8601String();
            $settings->update(['preferences' => $preferences]);
        });
    }
}
