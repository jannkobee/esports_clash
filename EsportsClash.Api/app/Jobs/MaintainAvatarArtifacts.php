<?php
namespace App\Jobs;

use App\Services\AvatarRetentionService;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUnique};
use Illuminate\Foundation\Queue\Queueable;

class MaintainAvatarArtifacts implements ShouldQueue,ShouldBeUnique
{
    use Queueable;
    public int $tries = 3;
    public int $timeout = 60;
    public int $uniqueFor = 3600;

    public function __construct()
    {
        $this->onConnection(config('avatars.queue_connection'))->onQueue(config('avatars.queue'));
    }

    public function handle(AvatarRetentionService $retention): void
    {
        $retention->maintain(dryRun: false);
    }
}
