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
    app(\App\Services\IntelligenceService::class)->monitor();
    foreach (\App\Models\BalanceReview::where('status', 'open')->where('deadline_at', '<=', now())->pluck('id') as $id) {
        try { $service->decide($id, 'select', null, 'substitute'); }
        catch (\Illuminate\Validation\ValidationException) { /* Another owner/worker already decided. */ }
    }
    foreach (\App\Models\EvolutionRun::whereIn('status', ['queued', 'running', 'stopping', 'paused_resource'])
        ->where('updated_at', '<', now()->subMinutes(2))->pluck('id') as $id) {
        \App\Jobs\PollEvolutionRun::dispatch($id);
    }
    if(array_key_exists('intelligence',\App\Models\EvolutionSetting::current()->preferences??[]))
        app(\App\Services\IntelligenceService::class)->tick();
    else $service->startRun('scheduler', scheduled: true);
})->purpose('Recover training jobs, resolve expired reviews, and schedule the next training cycle');

Artisan::command('intelligence:status',function(){
    $this->line(json_encode(['active'=>\App\Models\EvolutionRun::whereIn('status',['queued','running','stopping','paused_resource','paused_budget'])->get(['id','status','plan'])->map(fn($r)=>['id'=>$r->id,'status'=>$r->status,'version'=>$r->plan['version']??null])->all(),
        'policy'=>app(\App\Services\IntelligenceService::class)->manifest()['id'],'next_seed'=>\App\Models\EvolutionSetting::current()->next_seed],JSON_THROW_ON_ERROR));
})->purpose('Show non-secret intelligence job and policy status');

Artisan::command('intelligence:stop {id}',function(\App\Services\EvolutionService $service){
    $run=$service->stopRun($this->argument('id'),'local-cli');$this->line($run->status);
})->purpose('Request normal cancellation while preserving all study artifacts');

Artisan::command('intelligence:automation {domain=parameter} {--pause} {--all}',function(\App\Services\IntelligenceService $service){
    $domain=$this->argument('domain');if(!in_array($domain,$service::SCOPES,true))throw new \InvalidArgumentException('Unknown domain');
    $service->configure(['enabled'=>!$this->option('pause'),'domain'=>$domain,'cycle_domains'=>(bool)$this->option('all'),'max_minutes'=>30,'total_minutes'=>1440,'generations'=>2,'training_matches'=>4],'local-cli');
    $this->line($this->option('pause')?'Intelligence automation paused.':'Bounded intelligence automation enabled.');
})->purpose('Configure local continuous experiments; game activation remains separate');

Artisan::command('intelligence:queue {domain=parameter} {--minutes=30} {--total=1440}',function(\App\Services\IntelligenceService $service){
    $domain=$this->argument('domain');$minutes=(int)$this->option('minutes');$total=(int)$this->option('total');
    if(!in_array($domain,$service::SCOPES,true)||$minutes<16||$minutes>90||$total<$minutes||$total>10080)throw new \InvalidArgumentException('Choose parameter/marl/source, invocation16–90minutes and total<=10080minutes.');
    $run=$service->start(['request_id'=>(string)\Illuminate\Support\Str::uuid(),'domain'=>$domain,'max_minutes'=>$minutes,'total_minutes'=>$total],'local-cli');
    $this->line($run->id);
})->purpose('Queue an offline intelligence experiment with atomic seed reservation');

Artisan::command('evolution:recover', function (\App\Services\EvolutionService $service) {
    $records = \Illuminate\Support\Facades\Http::withToken(config('evolution.worker_token'))->timeout(15)
        ->get(rtrim(config('evolution.runner_url'), '/').'/runs')->throw()->json('runs');
    \App\Models\EvolutionSetting::current();
    \Illuminate\Support\Facades\DB::transaction(function () use ($records, $service) {
        $settings = \App\Models\EvolutionSetting::lockForUpdate()->findOrFail(1);
        foreach ($records as $record) {
            if (! \Illuminate\Support\Str::isUuid($record['id'])) throw new \RuntimeException('Invalid recovery run ID');
            if(\App\Models\EvolutionRun::withTrashed()->where('id',$record['id'])->whereNotNull('deleted_at')->exists())continue;
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

Artisan::command('online:install-catalog {--original-roster}', function () {
    $bytes = file_get_contents(resource_path('game/catalog.json'));
    $manifest = json_decode(file_get_contents(resource_path('game/manifest.json')), true, flags: JSON_THROW_ON_ERROR);
    if (! hash_equals($manifest['catalog_version'], hash('sha256', $bytes))) throw new \RuntimeException('Catalog hash mismatch');
    $payload = json_decode($bytes, true, flags: JSON_THROW_ON_ERROR);
    $originalRoster=(bool)$this->option('original-roster');
    \Illuminate\Support\Facades\DB::transaction(function () use ($manifest, $payload, $originalRoster) {
        $active = \App\Models\OnlineCatalog::where('active', true)->lockForUpdate()->first();
        if ($active && ($active->id !== $manifest['catalog_version'] || $active->manifest !== $manifest)
            && \App\Models\OnlineMatch::whereIn('status', ['allocated', 'running'])->exists()) {
            throw new \RuntimeException('Finish active matches before switching the single-worker catalog/rules version.');
        }
        if ($active && $active->id !== $manifest['catalog_version'] && \App\Models\OwnedPlayerCard::exists()) {
            if(!$originalRoster)throw new \RuntimeException('A reviewed owned-card migration is required before replacing catalog definitions.');
            \App\Services\OriginalRosterUpgrade::validate($active->payload,$payload);
        }
        $catalog = \App\Models\OnlineCatalog::firstOrCreate(['id' => $manifest['catalog_version']], ['manifest' => $manifest, 'payload' => $payload]);
        if ($catalog->manifest !== $manifest) {
            if (\App\Models\OnlineMatch::whereIn('status', ['allocated', 'running'])->exists()) throw new \RuntimeException('Finish active matches before switching the single-worker rules version.');
            $catalog->update(['manifest' => $manifest]);
        }
        if($originalRoster&&$active&&$active->id!==$catalog->id){
            \App\Services\OriginalRosterUpgrade::validate($active->payload,$payload);
            \App\Models\OwnedPlayerCard::where('catalog_id',$active->id)->update(['catalog_id'=>$catalog->id]);
            \App\Models\NormalQueueTicket::where('catalog_id',$active->id)->where('status','queued')->update(['catalog_id'=>$catalog->id]);
        }
        \App\Models\OnlineCatalog::where('id', '<>', $catalog->id)->update(['active' => false]);
        $catalog->update(['active' => true]);
    });
    $this->info('Versioned online starter catalog installed. Existing cards and saves preserved.');
})->purpose('Install the server-authored card/avatar catalog for Normal matches');

Artisan::command('online:recover', function () {
    foreach (\App\Models\OnlineMatch::whereIn('status', ['allocated', 'running'])->cursor() as $match) {
        if (! $match->isBeforeKickoff()) \App\Jobs\PollOnlineMatch::dispatch($match->id);
    }
    \Illuminate\Support\Facades\DB::table('online_stream_grants')->where('expires_at', '<', now()->subDay())->delete();
})->purpose('Recover interrupted match polls and expire old stream grants');

\Illuminate\Support\Facades\Schedule::command('online:recover')->everyMinute()->withoutOverlapping(2);

Artisan::command('fixtures:schedule {home} {away} {kickoff : ISO 8601 date with UTC offset} {--competition=Philippine Pilot League}', function () {
    $data = validator([
        'home' => $this->argument('home'), 'away' => $this->argument('away'),
        'kickoff' => $this->argument('kickoff'), 'competition' => $this->option('competition'),
    ], [
        'home' => ['required', 'integer', 'exists:online_clubs,id'],
        'away' => ['required', 'integer', 'different:home', 'exists:online_clubs,id'],
        'kickoff' => ['required', 'date_format:Y-m-d\TH:i:sP'],
        'competition' => ['required', 'string', 'max:100'],
    ])->validate();
    $kickoff = \Illuminate\Support\Carbon::parse($data['kickoff'])->utc();
    $deadline = $kickoff->copy()->subMinutes(15);
    if ($deadline->lte(now())) {
        $this->error('The order deadline must be in the future.');
        return 1;
    }
    $ids = [(int) $data['home'], (int) $data['away']];
    $fixture = \Illuminate\Support\Facades\DB::transaction(function () use ($ids, $data, $kickoff, $deadline) {
        \App\Models\OnlineClub::whereKey($ids)->orderBy('id')->lockForUpdate()->get();
        if (\App\Models\ClubFixture::conflicts($ids, $kickoff)) return null;
        return \App\Models\ClubFixture::create(['home_club_id' => $ids[0], 'away_club_id' => $ids[1],
            'competition' => $data['competition'], 'kickoff_at' => $kickoff, 'orders_close_at' => $deadline]);
    }, 3);
    if (! $fixture) {
        $this->error('A participating club already has a fixture within one hour of this kickoff.');
        return 1;
    }
    $this->info('Published fixture '.$fixture->id.' for '.$kickoff->toIso8601String());
})->purpose('Publish a server-owned fixture for two existing clubs');

Artisan::command('fixtures:lock-due', function () {
    if (! \Illuminate\Support\Facades\Schema::hasTable('club_fixtures')) return;
    \App\Models\ClubFixture::whereNull('match_id')->whereNull('hold_reason')->where('orders_close_at', '<=', now())
        ->chunkById(100, function ($fixtures) {
            foreach ($fixtures as $fixture) \App\Jobs\LockClubFixture::dispatch($fixture->id);
        });
})->purpose('Freeze due fixture orders and schedule the Arena worker');
\Illuminate\Support\Facades\Schedule::command('fixtures:lock-due')->everyMinute()->withoutOverlapping(2);

Artisan::command('market:close-due', function (\App\Services\ClubMarketService $market) {
    if (! \Illuminate\Support\Facades\Schema::hasTable('club_auctions')) return;
    \App\Models\ClubAuction::where('status', 'open')->where('closes_at', '<=', now())->chunkById(100, function ($auctions) use ($market) {
        foreach ($auctions as $auction) $market->close($auction->id);
    });
})->purpose('Settle expired auctions and transfer player ownership');
\Illuminate\Support\Facades\Schedule::command('market:close-due')->everyMinute()->withoutOverlapping(2);

Artisan::command('market:expire-trades', function (\App\Services\ClubMarketService $market) {
    if (! \Illuminate\Support\Facades\Schema::hasTable('club_trade_proposals')) return;
    $market->expireTrades();
})->purpose('Expire pending player trades and return reserved cash');
\Illuminate\Support\Facades\Schedule::command('market:expire-trades')->everyMinute()->withoutOverlapping(2);

Artisan::command('events:publish-manila {tier} {semifinals : ISO 8601 date with UTC offset}', function () {
    $input = validator(['tier' => $this->argument('tier'), 'semifinals' => $this->argument('semifinals')], [
        'tier' => ['required', 'integer', 'between:1,5'], 'semifinals' => ['required', 'date_format:Y-m-d\TH:i:sP'],
    ])->validate();
    $semifinals = \Illuminate\Support\Carbon::parse($input['semifinals'])->utc();
    $deadline = $semifinals->copy()->subDay();
    $final = $semifinals->copy()->addWeek();
    $year = $semifinals->copy()->tz('Asia/Manila')->year;
    if ($deadline->lte(now()) || $final->copy()->tz('Asia/Manila')->year !== $year) {
        $this->error('Allow at least one day for registration and schedule both rounds in the same Manila calendar year.');
        return 1;
    }
    $event = \App\Models\ClubTournament::firstOrCreate(['year' => $year, 'tier' => $input['tier']], [
        'registration_closes_at' => $deadline, 'semifinals_at' => $semifinals, 'final_at' => $final,
        'champion_prize' => 1_000_000, 'runner_up_prize' => 400_000,
    ]);
    $this->info($event->title().' · event '.$event->id.($event->wasRecentlyCreated ? ' published' : ' already published'));
})->purpose('Publish a fictional organizer’s Manila Signal Open for one tier and calendar year');

Artisan::command('events:advance', function (\App\Services\ClubTournamentService $events) {
    if (! \Illuminate\Support\Facades\Schema::hasTable('club_tournaments')) return;
    \App\Models\ClubTournament::whereNull('definition_id')->whereIn('status', ['registration', 'semifinals', 'final'])
        ->chunkById(100, function ($batch) use ($events) {
            foreach ($batch as $event) $events->advance($event->id);
        });
})->purpose('Publish due rounds and advance brackets from verified Arena results');
\Illuminate\Support\Facades\Schedule::command('events:advance')->everyMinute()->withoutOverlapping(2);

Artisan::command('competitions:install', function (\App\Services\CompetitionCalendar $calendar) {
    $calendar->installDefaults();
    $this->info('Official competition definitions installed. No past editions or results were created.');
})->purpose('Install configurable original championship identities without creating past matches');

Artisan::command('world:players {--compact}',function(\App\Services\WorldPlayerIdentity $identities){
    $this->line(json_encode($identities->migrate((bool)$this->option('compact')),JSON_THROW_ON_ERROR));
})->purpose('Assign unique identities, preserving the earliest human original and all existing contracts/history');

Artisan::command('world:rookies {--activate}',function(\App\Services\WorldRosterReset $reset){
    $result=$this->option('activate')?$reset->activate():$reset->report();
    $this->line(json_encode($result,JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT));
})->purpose('Review the weak-player reset; --activate verifies the worker, archives legacy players and preserves match history');

Artisan::command('world:populate {--target=32}',function(\App\Services\BotPopulationService $population){
    $target=(int)$this->option('target');abort_if($target<0||$target>10000,422,'Use a target between zero and 10,000 per request.');
    \App\Jobs\PopulateBotClubs::dispatch($target);$this->info('Queued bounded bot population reviews for target '.$target.'.');
})->purpose('Create a bounded population of unique-player bot clubs and fill open tournament places');

Artisan::command('competitions:year {--partial}',function(\App\Services\CompetitionCalendar $calendar){
    $ids=$calendar->initialize($calendar->year(),(bool)$this->option('partial'));
    $this->info('Current calendar-year editions: '.implode(', ',$ids));
})->purpose('Initialize only future dates in the actual current year; partial launch years require an explicit flag');

Artisan::command('competitions:tick',function(\App\Services\CompetitionCalendar $calendar){
    if(!\Illuminate\Support\Facades\Schema::hasTable('competition_settings') || !$calendar->settings()['enabled'])return;
    if(now('UTC')->year >= $calendar->settings()['inaugural_year'])$calendar->initialize($calendar->year());
    if(now('UTC')->month===1)\App\Jobs\FinalizeCompetitionYear::dispatch(now('UTC')->year-1);
    app(\App\Services\CompetitionInvitations::class)->expire();
    \Illuminate\Support\Facades\DB::table('national_manager_terms')->where('status','appointed')->where(fn($q)=>$q->where('ends_at','<=',now())->orWhere('last_active_at','<',now()->subDays(config('competitions.manager_inactive_days'))))->update(['status'=>'inactive','updated_at'=>now()]);
    \App\Models\ClubTournament::whereNotNull('definition_id')->whereIn('status',['registration','active'])->chunkById(100,function($events){
        foreach($events as $e)\App\Jobs\ProcessCompetitionEdition::dispatch($e->id);
    });
    \App\Models\ClubTournament::whereNotNull('definition_id')->where('status','cancelled')->chunkById(100,function($events){foreach($events as $e)app(\App\Services\CompetitionAdministration::class)->refundCancelled($e->id);});
});
\Illuminate\Support\Facades\Schedule::command('competitions:tick')->everyMinute()->withoutOverlapping(2);
\Illuminate\Support\Facades\Schedule::job(new \App\Jobs\RefreshCompetitionRatings)->dailyAt('00:05')->timezone('UTC')->withoutOverlapping(30);

Artisan::command('clubs:create-bot {tag} {name} {--tier=5}', function (\App\Services\OnlineService $online) {
    $data = validator(['tag' => $this->argument('tag'), 'name' => $this->argument('name'), 'tier' => $this->option('tier')], [
        'tag' => ['required', 'regex:/^[A-Z0-9]{2,12}$/', 'unique:online_clubs,tag'],
        'name' => ['required', 'string', 'max:80'], 'tier' => ['required', 'integer', 'between:1,5'],
    ])->validate();
    $club = \Illuminate\Support\Facades\DB::transaction(function () use ($data, $online) {
        $user = \App\Models\User::create(['name' => $data['name'], 'email' => strtolower($data['tag']).'@bots.invalid',
            'password' => \Illuminate\Support\Str::random(64)]);
        $club = $online->provision($user, true);
        $club->update(['tag' => $data['tag'], 'tier' => $data['tier'], 'identity' => [
            'country' => 'PH', 'crest' => ['shape' => 'shield', 'mark' => 'bolt'],
            'colors' => ['primary' => '#25394a', 'secondary' => '#f5efe1', 'accent' => '#f1a450'],
            'home_jersey' => ['pattern' => 'diagonal'], 'away_jersey' => ['pattern' => 'stripes'],
        ]]);
        return $club;
    });
    $this->info('Created bot club '.$club->tag.' with a scout roster.');
})->purpose('Create a fictional bot club with a legal scout roster');

Artisan::command('clubs:weekly', function (\App\Services\ClubDevelopmentService $development,
    \App\Services\ClubMarketService $market, \App\Services\OnlineService $online) {
    if (! \Illuminate\Support\Facades\Schema::hasTable('club_training_sessions')) return;
    $development->postTraining();
    \App\Models\OnlineClub::chunkById(100, function ($clubs) use ($development, $market, $online) {
        foreach ($clubs as $club) {
            app(\App\Services\StaffContracts::class)->expire($club);
            $market->payroll($club);
            $development->manageBot($club, $market, $online);
        }
    });
})->purpose('Post training and payroll and run bot recruitment and lineup selection');
\Illuminate\Support\Facades\Schedule::command('clubs:weekly')->hourly()->withoutOverlapping(30);

Artisan::command('world:tick', function () {
    if (! \Illuminate\Support\Facades\Schema::hasTable('club_world_turns')) return;
    $window = now()->startOfMinute()->subMinutes(now()->minute % 15)->utc()->toIso8601String();
    \App\Models\OnlineClub::where('is_bot', true)->chunkById(100, function ($clubs) use ($window) {
        foreach ($clubs as $club) \App\Jobs\ManageBotClub::dispatch($club->id, $window);
    });
    $this->info('Queued the current Hexatrick bot management window.');
})->purpose('Review bot recruitment, legal lineups, surplus auctions, needed bids and tournament entries');
\Illuminate\Support\Facades\Schedule::command('world:tick')->everyFifteenMinutes()->withoutOverlapping(10);

Artisan::command('avatars:tick',function(\App\Services\AvatarEvolutionService $service){
    $settings=\App\Models\AvatarEvolutionSetting::current();$settings->update(['heartbeat_at'=>now()]);
    if(!config('avatars.engine_ready'))return;
    foreach(\App\Models\AvatarEvolutionRun::whereIn('status',[...$service::ACTIVE,'complete'])->where('updated_at','<',now()->subMinute())->pluck('id') as $id)\App\Jobs\PollAvatarEvolution::dispatch($id);
    foreach(\App\Models\AvatarVisualRelease::where('active',true)->whereNotNull('source_sha256')->where(function($query){$query->whereNull('last_checked_at')->orWhere('last_checked_at','<',now()->subMinutes(5));})->pluck('id')as $id)\App\Jobs\CheckAvatarVisualHealth::dispatch($id);
    if(!$settings->maintenance_at||$settings->maintenance_at->isBefore(now()->subHour())){\App\Jobs\MaintainAvatarArtifacts::dispatch();$settings->update(['maintenance_at'=>now()]);}
    // Visual work is owner-started only. Recover existing requested jobs and
    // monitor published releases, but never admit a scheduled enhancement.
})->purpose('Recover requested enhancement jobs and monitor existing visual releases');
\Illuminate\Support\Facades\Schedule::command('avatars:tick')->everyMinute()->withoutOverlapping(2);

Artisan::command('trellis:recover',function(){
    if(!\Illuminate\Support\Facades\Schema::hasTable('trellis_generations'))return;
    foreach(\App\Models\TrellisGeneration::whereIn('status',\App\Services\TrellisGenerationService::ACTIVE)->where('updated_at','<',now()->subMinute())->pluck('id')as $id)\App\Jobs\PollTrellisGeneration::dispatch($id);
})->purpose('Recover durable TRELLIS.2 generation polling without restarting completed inference');
\Illuminate\Support\Facades\Schedule::command('trellis:recover')->everyMinute()->withoutOverlapping(2);

Artisan::command('avatars:recover-cancellations',function(){
    foreach(\App\Services\AvatarJobCancellationService::TYPES as $type=>$model){
        if(!\Illuminate\Support\Facades\Schema::hasTable((new $model)->getTable()))continue;
        foreach($model::whereIn('status',$type==='preparation'?['cancelling','pausing']:['cancelling'])->pluck('id')as $id)\App\Jobs\CancelAvatarJob::dispatch($type,$id);
    }
})->purpose('Retry cancellation until the owning worker acknowledges the stop');
\Illuminate\Support\Facades\Schedule::command('avatars:recover-cancellations')->everyMinute()->withoutOverlapping(2);

Artisan::command('avatars:recover-preparations',function(){
    if(!\Illuminate\Support\Facades\Schema::hasTable('avatar_preparations'))return;
    foreach(\App\Models\AvatarPreparation::whereIn('status',\App\Services\AvatarPreparationService::ACTIVE)->where('updated_at','<',now()->subMinute())->pluck('id')as $id)\App\Jobs\PollAvatarPreparation::dispatch($id);
    foreach(\App\Models\AvatarPreparation::whereIn('status',['paused','cancelled'])->whereIn('control->intent',['resume','retry'])->whereNull('control->replacement_id')->pluck('id')as $id)\App\Jobs\RestartAvatarPreparation::dispatch($id);
    // No automatic source admission: the owner queues preparations explicitly.
})->purpose('Recover durable preparation polls without publishing unqualified assets');
\Illuminate\Support\Facades\Schedule::command('avatars:recover-preparations')->everyMinute()->withoutOverlapping(2);

Artisan::command('avatars:manual-only',function(){
    \App\Models\AvatarEvolutionSetting::current()->update(['enabled'=>false]);
    \App\Models\AvatarPreparationSetting::current()->update(['enabled'=>false]);
    $ids=\Illuminate\Support\Facades\DB::table('evolution_audits')->whereIn('actor',['preparation-scheduler','avatar-scheduler'])->pluck('subject_id');
    $service=app(\App\Services\AvatarJobCancellationService::class);$count=0;
    foreach(['preparation','enhancement']as $type){$model=$service::TYPES[$type];foreach($model::whereIn('id',$ids)->whereIn('status',$service::CANCELLABLE)->pluck('id')as $id){$service->request($type,$id,'owner-manual-only');$count++;}}
    $this->info('Visual admission disabled; automatic visual jobs requested to stop: '.$count.'. ML automation unchanged.');
})->purpose('Disable visual automation and stop its outstanding jobs without touching ML');


Artisan::command('content:import', function (\App\Services\ContentManagementService $service) {
    $owner=\App\Models\User::where('is_evolution_admin',true)->orderBy('id')->first();
    if (!$owner) { $this->error('Create an owner account first.'); return 1; }
    foreach (['avatar','item'] as $kind) {
        $count=$service->import($kind,$owner->id);
        $this->info("Imported $count $kind drafts; existing drafts preserved.");
    }
})->purpose('Copy current avatars and item snapshot into owner-managed drafts; never publishes or starts jobs');


Artisan::command('avatars:preparation-control {id} {operation}',function(\App\Services\AvatarPreparationControlService $controls,\App\Services\AvatarPreparationService $service){
    if(!\Illuminate\Support\Str::isUuid($this->argument('id'))||!in_array($this->argument('operation'),['pause','resume','retry','qualify'],true)){$this->error('Use a preparation UUID and pause, resume, retry or qualify.');return 1;}
    $run=\App\Models\AvatarPreparation::findOrFail($this->argument('id'));
    if($this->argument('operation')==='qualify')$service->validate($run,'owner:server-cli');
    else $controls->request($run,$this->argument('operation'),'owner:server-cli');
    $this->info('Explicit owner control requested: '.$this->argument('operation').' for '.$run->id);
})->purpose('Explicit manual preparation control; no automatic avatar admission');

Artisan::command('avatars:recover-equipment',function(){
    if(!\Illuminate\Support\Facades\Schema::hasTable('avatar_equipment_generations'))return;
    foreach(\App\Models\AvatarEquipmentGeneration::whereIn('status',[...\App\Services\TrellisGenerationService::ACTIVE,'installing'])->where('updated_at','<',now()->subMinute())->pluck('id')as $id)\App\Jobs\PollAvatarEquipment::dispatch($id);
})->purpose('Recover requested weapon generations without admitting new designs');
\Illuminate\Support\Facades\Schedule::command('avatars:recover-equipment')->everyMinute()->withoutOverlapping(2);

Artisan::command('avatars:cleanup {--dry-run : Report protected and deletable items without deleting} {--force : Apply deletion without confirmation}', function (\App\Services\AvatarRetentionService $retention) {
    $dryRun = $this->option('dry-run') || !$this->option('force');
    $result = $retention->maintain(dryRun: $dryRun, actor: 'owner:console-cleanup');
    if ($dryRun) {
        $this->info("Dry-run storage cleanup report:");
        $this->info("Protected assets: " . $result['protected_count']);
        $this->info("Deletable preparation artifacts: " . count($result['deletable_preparations']));
        $this->info("Deletable enhancement artifacts: " . count($result['deletable_enhancements']));
        $this->line("To execute real cleanup, run with --force.");
    } else {
        $this->info("Storage cleanup applied successfully:");
        $this->info("Protected assets: " . $result['protected_count']);
        $this->info("Deleted artifact runs: " . count($result['deleted']));
        $this->info("Reclaimed bytes: " . number_format($result['reclaimed_bytes'] ?? 0) . " bytes");
    }
})->purpose('Dependency-aware cleanup of obsolete visual preparations and enhancement artifacts');

Artisan::command('world:launch-championship',function(\App\Services\LaunchChampionship $archive){
    $event=$archive->install();$archive->tick();$this->info('Labeled launch exhibition: '.$event->id);
})->purpose('Create the owner-approved 2026 simulated launch archive; future rounds use scheduled Arena fixtures');
Artisan::command('world:media-tick',function(\App\Services\LaunchChampionship $archive){
    if(!\Illuminate\Support\Facades\Schema::hasTable('launch_history_games'))return;
    $archive->tick();\App\Jobs\PublishWorldCoverage::dispatch();
});
\Illuminate\Support\Facades\Schedule::command('world:media-tick')->everyMinute()->withoutOverlapping(2);

Artisan::command('world:organizers',function(\App\Services\IndependentOrganizers $organizers){
    if(!\Illuminate\Support\Facades\Schema::hasTable('world_organizer_cycles'))return;
    $organizers->tick();$this->info('Reviewed the current weekly fictional organizer cycle.');
})->purpose('Announce bounded, funded independent events when enough eligible clubs and legal dates exist');
\Illuminate\Support\Facades\Schedule::command('world:organizers')->dailyAt('00:10')->timezone('UTC')->withoutOverlapping(5);

Artisan::command('world:office',function(){
    if(!\Illuminate\Support\Facades\Schema::hasTable('club_weekly_reports'))return;
    \App\Models\OnlineClub::chunkById(100,function($clubs){foreach($clubs as $club)\App\Jobs\BuildClubOfficeReport::dispatch($club->id);});
    $this->info('Queued club correspondence, weekly reports and observed player development.');
});
\Illuminate\Support\Facades\Schedule::command('world:office')->dailyAt('01:15')->timezone('UTC')->withoutOverlapping(5);

Artisan::command('competitions:preview {year}',function(\App\Services\AnnualQualificationGraph $graph){
    $year=(int)$this->argument('year');abort_if($year<2020||$year>2200,422);
    $program=$graph->compile(\App\Models\CompetitionDefinition::where('official',true)->where('status','approved')->orderBy('id')->get()->toArray(),$year);
    $this->line(json_encode(['year'=>$year,'preview_only'=>true,'definitions'=>array_map(fn($d)=>['name'=>$d['name'],'capacity'=>$d['rules']['capacity'],'qualification'=>$d['rules']['qualification']],$program['definitions'])],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
})->purpose('Preview qualification allocations without creating editions, results or future-year records');

Artisan::command('online:match-audit {id}',function(\App\Services\OnlineMatchAudit $audit){
    $report=$audit->inspect($this->argument('id'));
    $this->line(json_encode($report,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
    return $report['status']==='completed'&&!$report['settlement_integrity_passed']?1:0;
})->purpose('Inspect exact player ratings, pinned staff training and Nexus settlement without changing a match');

Artisan::command('launch:resolve-exhibition {match} {input} {--owner-approved}',function(\App\Services\LaunchExhibitionResolution $resolution){
    $input=json_decode(file_get_contents($this->argument('input')),true,512,JSON_THROW_ON_ERROR);
    $report=$resolution->resolve($this->argument('match'),$input,(bool)$this->option('owner-approved'));
    $this->line(json_encode($report,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
})->purpose('Apply an explicitly owner-approved unranked statistical launch-exhibition result, without settling the interrupted Arena');

Artisan::command('world:community-cups',function(\App\Services\CommunityCups $cups){
    if(!\Illuminate\Support\Facades\Schema::hasTable('community_cup_weeks'))return;
    $cups->tick();$this->info('Reviewed future weekly community invitations and bounded cup jobs.');
})->purpose('Open weekly tier-based cosmetic-only cups without training or ranked rewards');
\Illuminate\Support\Facades\Schedule::command('world:community-cups')->everyFiveMinutes()->withoutOverlapping(5);

Artisan::command('world:pyramid {--populate : Seed missing founding rosters at all five tiers}',function(\App\Services\WorldPyramid $pyramid){
    if(!\Illuminate\Support\Facades\Schema::hasTable('club_tier_movements'))return;
    if($this->option('populate'))$this->line(json_encode($pyramid->populate()));
    $ids=$pyramid->openWeek();foreach($ids as $id)\App\Jobs\ProcessCompetitionEdition::dispatch($id);
    $this->info('Published '.count($ids).' future division trials; no results invented.');
});
\Illuminate\Support\Facades\Schedule::command('world:pyramid')->hourly()->withoutOverlapping(10);
Artisan::command('world:talent',function(\App\Services\WorldTalent $talent){$this->info('Added '.$talent->populate().' circuit talent profiles.');});
