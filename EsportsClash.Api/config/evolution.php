<?php

return [
    'runner_url' => env('EVOLUTION_RUNNER_URL', 'http://runner:8090'),
    'worker_token' => env('EVOLUTION_WORKER_TOKEN', ''),
    'review_hours' => 48,
    'training_interval_minutes' => 360,
    'max_run_minutes' => 90,
    'minimum_evaluation_cases' => 18,
    // No production policy/patch promotion until the full-match release gate exists.
    'production_release_enabled' => false,
];
