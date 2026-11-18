<?php

return [
    'worker_url' => env('ONLINE_WORKER_URL', 'http://match-worker:8092'),
    // Several match workers (comma-separated): each match is routed to one by its id, replays follow it.
    'worker_urls' => env('ONLINE_WORKER_URLS', ''),
    'history_worker_url' => env('ONLINE_HISTORY_WORKER_URL', 'http://history-worker:8102'),
    'worker_token' => env('ONLINE_WORKER_TOKEN', ''),
    'stream_path' => '/live',
    // 5 = live 3D engine (headless on the worker, watched as a recorded replay); 4 = recorded 2D engine.
    'fps_simulation_version' => (int) env('FPS_SIMULATION_VERSION', 5),
    // Simulate this many minutes before kickoff, so thousands of simultaneous kickoffs become steady work.
    'precompute_minutes' => (int) env('FPS_PRECOMPUTE_MINUTES', 90),
];
