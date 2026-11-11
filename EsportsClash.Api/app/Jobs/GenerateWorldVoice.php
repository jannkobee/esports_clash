<?php
namespace App\Jobs;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUnique};
use Illuminate\Foundation\Queue\Queueable;

class GenerateWorldVoice implements ShouldQueue, ShouldBeUnique {
    use Queueable;
    public int $timeout=25; public int $tries=1; public int $uniqueFor=300;
    public function uniqueId(): string { return 'world-voice-simulation-v1'; }
    public function handle(\App\Services\WorldNarration $voices): void { AdvanceLivingWorld::enqueue(); }
}
