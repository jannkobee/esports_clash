<?php
return ['worker_url'=>env('AVATAR_WORKER_URL','http://avatar-worker:8094'),
    'trellis_url'=>env('TRELLIS_WORKER_URL','http://trellis-worker:8096'),
    'unirig_url'=>env('UNIRIG_WORKER_URL','http://unirig-worker:8098'),
    'worker_token'=>env('EVOLUTION_WORKER_TOKEN',''), 'max_asset_bytes'=>16*1024*1024,
    'queue_connection'=>env('AVATAR_QUEUE_CONNECTION','database'), 'queue'=>'avatars',
    'engine_ready'=>env('ART_ENGINE_READY',false),
    'profiles_path'=>resource_path('avatars/art-profiles.json'),
    'external_budget_usd'=>0, 'health_failure_limit'=>2];
