<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class GenerateTransferMarketBatchJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;
    public int $timeout = 60;

    /**
     * @param int $batchSeed Seed for deterministic batch generation
     * @param int $count Number of athletes to generate in this batch
     */
    public function __construct(
        public int $batchSeed = 0,
        public int $count = 24
    ) {
        if ($this->batchSeed === 0) {
            $this->batchSeed = random_int(100000, 999999);
        }
    }

    public function handle(): array
    {
        $batch = [
            'seed' => $this->batchSeed,
            'generated_at' => now()->toISOString(),
            'count' => $this->count,
            'status' => 'ready',
        ];

        Cache::put("market:batch:latest", $batch, now()->addDays(7));
        Cache::put("market:batch:{$this->batchSeed}", $batch, now()->addDays(7));

        return $batch;
    }
}
