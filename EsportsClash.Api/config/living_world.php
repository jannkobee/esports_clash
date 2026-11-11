<?php

return [
    // Ordinary PHP decisions, never model inference. One shared worker, no agent processes.
    'enabled' => env('LIVING_WORLD_ENABLED', true),
    'clubs_per_tick' => 8,
    'auction_candidates' => 12,
    'seconds_per_tick' => 8,
    'review_minutes' => 120,
    'event_review_minutes' => 15,
    'core_queue_limit' => 20,
    'core_oldest_seconds' => 120,
    'sync_minutes' => 60,
    'quiet_voice_minutes' => 30,
];
