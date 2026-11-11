<?php

namespace App\Jobs;

use App\Services\BotClubManager;
use Illuminate\Contracts\Queue\{ShouldQueue, ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class ManageBotClub implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Queueable;
    public int $tries = 3;
    public int $timeout = 60;
    public int $uniqueFor = 900;
    public function __construct(public int $clubId, public string $window) {}
    public function uniqueId(): string { return $this->clubId.':'.$this->window; }
    public function middleware(): array { return [(new WithoutOverlapping('bot-club:'.$this->clubId))->releaseAfter(20)->expireAfter(90)]; }
    public function backoff(): array { return [10, 60, 120]; }
    // Drain pre-upgrade fan-out safely; all optional work now shares the coordinator budget.
    public function handle(BotClubManager $manager): void { AdvanceLivingWorld::enqueue(); }
}
