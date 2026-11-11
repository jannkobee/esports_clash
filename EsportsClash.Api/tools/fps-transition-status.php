<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (in_array('--disable-moba', $argv, true)) app(App\Services\GameModes::class)->configure(false);
echo json_encode([
    'active_matches' => App\Models\OnlineMatch::whereIn('status', ['allocated', 'running'])->count(),
    'reserved_default_jobs' => Illuminate\Support\Facades\DB::table('jobs')->whereIn('queue', ['default', 'world'])->whereNotNull('reserved_at')->count(),
    'modes' => app(App\Services\GameModes::class)->state(),
], JSON_PRETTY_PRINT).PHP_EOL;
