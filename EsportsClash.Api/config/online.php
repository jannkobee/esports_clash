<?php

return [
    'worker_url' => env('ONLINE_WORKER_URL', 'http://match-worker:8092'),
    'worker_token' => env('ONLINE_WORKER_TOKEN', ''),
    'stream_path' => '/live',
];
