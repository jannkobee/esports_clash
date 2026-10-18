<?php
return ['worker_url'=>env('AVATAR_WORKER_URL','http://avatar-worker:8094'),
    'worker_token'=>env('EVOLUTION_WORKER_TOKEN',''), 'max_asset_bytes'=>16*1024*1024];
