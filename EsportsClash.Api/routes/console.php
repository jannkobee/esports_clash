<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('evolution:owner {email}', function () {
    $user = \App\Models\User::where('email', $this->argument('email'))->firstOrFail();
    $user->forceFill(['is_evolution_admin' => true])->save();
    $this->info('Evolution owner granted to '.$user->email);
})->purpose('Grant evolution controls to an existing account (server access required)');

Artisan::command('evolution:bootstrap-owner', function () {
    $email = env('EVOLUTION_OWNER_EMAIL');
    $password = env('EVOLUTION_OWNER_PASSWORD');
    if (! $email || ! $password || strlen($password) < 20) throw new \RuntimeException('Initial owner credentials are missing.');
    $user = \App\Models\User::firstOrCreate(['email' => $email], ['name' => 'Evolution Owner', 'password' => $password]);
    $user->forceFill(['is_evolution_admin' => true])->save();
    \App\Models\EvolutionSetting::current();
    $this->info('Local evolution owner ready; credentials remain in .env.evolution.local.');
})->purpose('Initialize the local Docker owner without printing credentials');

Artisan::command('evolution:tick', function (\App\Services\EvolutionService $service) {
    \App\Models\EvolutionSetting::current();
    foreach (\App\Models\BalanceReview::where('status', 'open')->where('deadline_at', '<=', now())->pluck('id') as $id) {
        try { $service->decide($id, 'select', null, 'substitute'); }
        catch (\Illuminate\Validation\ValidationException) { /* Another owner/worker already decided. */ }
    }
    foreach (\App\Models\EvolutionRun::whereIn('status', ['queued', 'running', 'stopping', 'paused_resource'])
        ->where('updated_at', '<', now()->subMinutes(2))->pluck('id') as $id) {
        \App\Jobs\PollEvolutionRun::dispatch($id);
    }
    $service->startRun('scheduler', scheduled: true);
})->purpose('Recover training jobs, resolve expired reviews, and schedule the next training cycle');

Artisan::command('evolution:recover', function (\App\Services\EvolutionService $service) {
    $records = \Illuminate\Support\Facades\Http::withToken(config('evolution.worker_token'))->timeout(15)
        ->get(rtrim(config('evolution.runner_url'), '/').'/runs')->throw()->json('runs');
    \App\Models\EvolutionSetting::current();
    \Illuminate\Support\Facades\DB::transaction(function () use ($records, $service) {
        $settings = \App\Models\EvolutionSetting::lockForUpdate()->findOrFail(1);
        foreach ($records as $record) {
            if (! \Illuminate\Support\Str::isUuid($record['id'])) throw new \RuntimeException('Invalid recovery run ID');
            $state = $record['state'];
            $run = \App\Models\EvolutionRun::firstOrCreate(['id' => $record['id']], ['plan' => $record['plan'],
                'status' => $state['status'], 'progress' => $state['progress'] ?? [], 'result' => $state['result'] ?? null,
                'error' => $state['error'] ?? null, 'started_at' => isset($record['started_unix']) ? \Carbon\Carbon::createFromTimestampUTC($record['started_unix']) : null]);
            if ($run->wasRecentlyCreated) $service->audit($run->id, 'training.recovered-from-artifacts', 'server');
            $settings->next_seed = max($settings->next_seed, $record['plan']['seed_start'] + 1000);
        }
        $settings->save();
    });
    $this->info('Artifact-backed run recovery complete. Seed allocations preserved.');
})->purpose('Recover missing run records from trusted persistent worker artifacts');

\Illuminate\Support\Facades\Schedule::command('evolution:tick')->everyMinute()->withoutOverlapping(2);
\Illuminate\Support\Facades\Schedule::job(new \App\Jobs\MaintainEvolutionArtifacts)->everyMinute()->withoutOverlapping(2);

Artisan::command('online:install-catalog', function () {
    $bytes = file_get_contents(resource_path('game/catalog.json'));
    $manifest = json_decode(file_get_contents(resource_path('game/manifest.json')), true, flags: JSON_THROW_ON_ERROR);
    if (! hash_equals($manifest['catalog_version'], hash('sha256', $bytes))) throw new \RuntimeException('Catalog hash mismatch');
    $payload = json_decode($bytes, true, flags: JSON_THROW_ON_ERROR);
    \Illuminate\Support\Facades\DB::transaction(function () use ($manifest, $payload) {
        $active = \App\Models\OnlineCatalog::where('active', true)->lockForUpdate()->first();
        if ($active && ($active->id !== $manifest['catalog_version'] || $active->manifest !== $manifest)
            && \App\Models\OnlineMatch::whereIn('status', ['allocated', 'running'])->exists()) {
            throw new \RuntimeException('Finish active matches before switching the single-worker catalog/rules version.');
        }
        if ($active && $active->id !== $manifest['catalog_version'] && \App\Models\OwnedPlayerCard::exists()) {
            throw new \RuntimeException('A reviewed owned-card migration is required before replacing catalog definitions.');
        }
        $catalog = \App\Models\OnlineCatalog::firstOrCreate(['id' => $manifest['catalog_version']], ['manifest' => $manifest, 'payload' => $payload]);
        if ($catalog->manifest !== $manifest) {
            if (\App\Models\OnlineMatch::whereIn('status', ['allocated', 'running'])->exists()) throw new \RuntimeException('Finish active matches before switching the single-worker rules version.');
            $catalog->update(['manifest' => $manifest]);
        }
        \App\Models\OnlineCatalog::where('id', '<>', $catalog->id)->update(['active' => false]);
        $catalog->update(['active' => true]);
    });
    $this->info('Versioned online starter catalog installed. Existing cards and saves preserved.');
})->purpose('Install the server-authored card/avatar catalog for Normal matches');

Artisan::command('online:recover', function () {
    foreach (\App\Models\OnlineMatch::whereIn('status', ['allocated', 'running'])->pluck('id') as $id) \App\Jobs\PollOnlineMatch::dispatch($id);
    \Illuminate\Support\Facades\DB::table('online_stream_grants')->where('expires_at', '<', now()->subDay())->delete();
})->purpose('Recover interrupted match polls and expire old stream grants');

\Illuminate\Support\Facades\Schedule::command('online:recover')->everyMinute()->withoutOverlapping(2);

Artisan::command('avatars:tick',function(\App\Services\AvatarEvolutionService $service){
    $settings=\App\Models\AvatarEvolutionSetting::current();$settings->update(['heartbeat_at'=>now()]);
    foreach(\App\Models\AvatarEvolutionRun::whereIn('status',$service::ACTIVE)->where('updated_at','<',now()->subMinute())->pluck('id') as $id)\App\Jobs\PollAvatarEvolution::dispatch($id);
    $service->start('avatar-scheduler',scheduled:true);
})->purpose('Keep the independent avatar generator scheduled and recover its polls');
\Illuminate\Support\Facades\Schedule::command('avatars:tick')->everyMinute()->withoutOverlapping(2);
