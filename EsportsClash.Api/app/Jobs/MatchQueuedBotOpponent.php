<?php

namespace App\Jobs;

use App\Services\OnlineService;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class MatchQueuedBotOpponent implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Queueable;

    public int $tries = 0;
    public int $timeout = 20;
    public int $uniqueFor = 300;

    public function __construct(public int $userId) {}

    public function uniqueId(): string
    {
        return (string) $this->userId;
    }

    public function middleware(): array
    {
        return [(new WithoutOverlapping('normal-queue:bot:'.$this->userId))->releaseAfter(10)->expireAfter(30)];
    }

    public function handle(OnlineService $online): void
    {
        if (! $online->matchQueuedBotOpponent($this->userId)) {
            $this->release(15);
        }
    }
}
