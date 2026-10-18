<?php

namespace App\Jobs;

use App\Models\EvolutionRun;
use App\Services\EvolutionService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

class PollEvolutionRun implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Queueable;

    public int $tries = 10;
    public int $timeout = 25;
    public int $uniqueFor = 90;
    public function __construct(public string $runId) {}
    public function uniqueId(): string { return $this->runId; }
    public function backoff(): array { return [10, 30, 60, 120]; }
    public function middleware(): array { return [(new WithoutOverlapping('evolution:'.$this->runId))->releaseAfter(30)->expireAfter(40)]; }

    public function handle(EvolutionService $service): void
    {
        $run = EvolutionRun::findOrFail($this->runId);
        if (! in_array($run->status, ['queued', 'running', 'stopping', 'paused_resource'], true)) return;
        $http = Http::withToken(config('evolution.worker_token'))->connectTimeout(3)->timeout(15);
        $base = rtrim(config('evolution.runner_url'), '/').'/runs/'.$run->id;
        if ($run->status === 'stopping') {
            $http->delete($base)->throw();
        } else {
            // Idempotent start: runner persists its immutable plan before spawning work.
            $http->post($base, $run->plan)->throw();
        }
        $state = $http->get($base)->throw()->json();
        $run = DB::transaction(function () use ($state) {
            $locked = EvolutionRun::lockForUpdate()->findOrFail($this->runId);
            if (in_array($locked->status, ['completed', 'failed', 'cancelled'], true)) return $locked;
            $terminal = in_array($state['status'], ['completed', 'failed', 'cancelled'], true);
            // Serialize against owner cancellation as well as duplicate poll jobs.
            if ($locked->status === 'stopping' && ! $terminal) return $locked;
            $locked->update(['status' => $state['status'], 'started_at' => $locked->started_at ?? now(),
                'finished_at' => $terminal ? now() : null, 'progress' => $state['progress'] ?? [],
                'result' => $state['result'] ?? null, 'error' => $state['error'] ?? null]);
            return $locked;
        });
        $terminal = in_array($run->status, ['completed', 'failed', 'cancelled'], true);
        if ($run->status === 'completed') {
            $service->createReview($run);
        } elseif (! $terminal) {
            self::dispatch($run->id)->delay(now()->addSeconds(20));
        }
    }
}
