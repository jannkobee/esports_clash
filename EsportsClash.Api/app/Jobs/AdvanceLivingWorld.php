<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\{ShouldQueue, ShouldBeUnique};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class AdvanceLivingWorld implements ShouldQueue, ShouldBeUnique
{
    use Queueable;
    public int $timeout=25;
    public int $tries=1;
    public int $uniqueFor=300;
    public function __construct() { $this->onQueue('world'); }
    public static function enqueue(): void
    {
        if(!config('living_world.enabled',true)||!app(\App\Services\LivingWorldEngine::class)->ready())return;
        // Queue uniqueness has a TTL. The durable queue check also prevents accumulation
        // during a long core backlog, including after cache expiry or scheduler restart.
        DB::transaction(function(){
            DB::table('living_world_runtime')->where('id',1)->lockForUpdate()->first();
            if(DB::table('jobs')->where('queue','world')->exists())return;
            self::dispatch();
        });
    }
    public function uniqueId(): string { return 'living-world-v1'; }
    public function handle(\App\Services\LivingWorldEngine $engine): void { $engine->tick(); }
}
