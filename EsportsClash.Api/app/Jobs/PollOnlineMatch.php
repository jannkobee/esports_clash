<?php

namespace App\Jobs;

use App\Models\OnlineMatch;
use App\Services\OnlineService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Carbon;

class PollOnlineMatch implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Queueable;
    public int $tries = 10;
    public int $timeout = 25;
    public int $uniqueFor = 60;
    public function __construct(public string $matchId) {}
    public function uniqueId(): string { return $this->matchId; }
    public function middleware(): array { return [(new WithoutOverlapping('online:'.$this->matchId))->releaseAfter(10)->expireAfter(40)]; }
    public function backoff(): array { return [5, 10, 20, 30]; }

    public function handle(OnlineService $service): void
    {
        $match = OnlineMatch::findOrFail($this->matchId);
        if (! in_array($match->status, ['allocated', 'running'], true)) return;
        if ($match->isBeforeComputeWindow()) return;
        $http = Http::withToken(config('online.worker_token'))->connectTimeout(3)->timeout(15);
        $url = $match->workerUrl().'/matches/'.$match->id;
        $started = $http->post($url, ['plan' => $match->plan, 'plan_hash' => $match->plan_hash]);
        if ($started->status() === 409) { self::dispatch($match->id)->delay(now()->addSeconds(10)); return; }
        // Queued on the worker (all slots busy): it starts the match itself; check back less often.
        if (($started->json('status') ?? null) === 'queued') { self::dispatch($match->id)->delay(now()->addSeconds(30)); return; }
        $started->throw();
        $state = $http->get($url)->throw()->json();
        $live = $match->usesLiveEngine();
        // One game at a time per tournament stream: record the on-air time, or wait while the previous game airs.
        if ($live && $match->on_air_at === null && $match->resolveOnAir() === null && $match->awaitsOnAir()) {
            self::dispatch($match->id)->delay(now()->addSeconds(30));
            return;
        }
        if (in_array($state['status'], ['running', 'completed'], true) && isset($state['started_at'])
            && (! $live || ! $match->isBeforeKickoff())) {
            // A live 3D broadcast starts when it goes on air, however early it was simulated.
            OnlineMatch::whereKey($match->id)->whereNull('started_at')
                ->update(['started_at' => $live && $match->broadcastStartsAt() ? $match->broadcastStartsAt()->utc() : Carbon::parse($state['started_at'])->utc()]);
        }
        if ($live && $state['status'] === 'completed') {
            // Simulated ahead: settle only when the broadcast reaches the final frame (no spoilers).
            $match->refresh();
            $start = $match->broadcastStartsAt();
            $ends = $start?->addMilliseconds((int) round(($state['result']['report']['broadcastSeconds'] ?? 0) * 1000));
            if ($start === null || $ends->isFuture()) {
                if ($start !== null && ! $start->isFuture()) {
                    OnlineMatch::whereKey($match->id)->whereIn('status', ['allocated', 'running'])->update(['status' => 'running']);
                    if (isset($match->plan['fixture'])) OnlineMatch::whereKey($match->id)->where('spectator_ready', false)->update(['spectator_ready' => true]);
                }
                self::dispatch($match->id)->delay($start === null || $start->isFuture() ? ($start ?? now()->addSeconds(5)) : $ends->min(now()->addMinutes(5)));
                return;
            }
        }
        if (($state['public_replay'] ?? false) === true && isset($match->plan['fixture']) && (! $live || ! $match->isBeforeKickoff())) {
            OnlineMatch::whereKey($match->id)->where('spectator_ready', false)->update(['spectator_ready' => true]);
        }
        if ($state['status'] === 'completed') {
            $service->settle($match->id, $state['result'], $state['sequence']);
        } elseif ($state['status'] === 'failed') {
            OnlineMatch::whereKey($match->id)->whereIn('status', ['allocated', 'running'])
                ->update(['status' => 'failed', 'error' => $state['error'] ?? 'Worker failed.']);
        } else {
            if ($state['status'] === 'running' && (! $live || ! $match->isBeforeKickoff())) {
                OnlineMatch::whereKey($match->id)->whereIn('status', ['allocated', 'running'])
                    ->update(['status' => 'running', 'sequence' => $state['sequence'] ?? 0]);
            }
            self::dispatch($match->id)->delay(now()->addSeconds(5));
        }
    }
}
