<?php
require __DIR__.'/../vendor/autoload.php';
$app=require __DIR__.'/../bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
echo json_encode([
    'active_matches'=>\App\Models\OnlineMatch::whereIn('status',['allocated','running'])->count(),
    'reserved_jobs'=>\Illuminate\Support\Facades\DB::table('jobs')->whereIn('queue',['default','world'])->whereNotNull('reserved_at')->count(),
    'identity_storage'=>app(\App\Services\FpsIdentityEngine::class)->ready(),
    'identity_enabled'=>app(\App\Services\FpsIdentityEngine::class)->enabled(),
    'mode'=>app(\App\Services\GameModes::class)->state(),
],JSON_THROW_ON_ERROR).PHP_EOL;
