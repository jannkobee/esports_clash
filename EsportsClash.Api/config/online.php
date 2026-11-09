<?php

return [
    'worker_url' => env('ONLINE_WORKER_URL', 'http://match-worker:8092'),
    'history_worker_url' => env('ONLINE_HISTORY_WORKER_URL', 'http://history-worker:8102'),
    'worker_token' => env('ONLINE_WORKER_TOKEN', ''),
    'stream_path' => '/live',
];
