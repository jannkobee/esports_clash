<?php

namespace Tests\Feature;

use App\Models\{OnlineCatalog, OnlineMatch, OwnedPlayerCard, User};
use App\Services\OnlineService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http, Queue};
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OnlineTest extends TestCase
{
    use RefreshDatabase;

    private function agreeTransfer(\App\Models\OnlineClub $club, OwnedPlayerCard $player): void
    {
        $service = app(\App\Services\WorldCareerContracts::class);
        $id = $service->offerPlayer($club, $player, $service->baseWage($player) * 3, 26, 'rotation', 'test-transfer-' . $player->id);
        $service->evaluate($id);
        $this->assertDatabaseHas('world_negotiations', ['id' => $id, 'status' => 'accepted']);
    }


    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->artisan('online:install-catalog')->assertSuccessful();
        config(['online.worker_token' => str_repeat('test-worker-', 4)]);
    }

    private function account(): User
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        return $user;
    }

    private function allocated(): OnlineMatch
    {
        $service = app(OnlineService::class);
        $service->queue($this->account());
        return $service->queue($this->account())['match'];
    }

    private function fpsWorkerResult(OnlineMatch $match): array
    {
        $playerStats = [];
        $performances = [];
        foreach (['blue', 'red'] as $side) {
            foreach ($match->plan[$side] as $slot) {
                $id = $slot['instance_id'];
                $playerStats[$id] = [
                    'playerId' => $id, 'name' => $match->plan['player_identities'][$id] ?? 'Alias',
                    'team' => $side, 'kills' => 1, 'deaths' => 0, 'assists' => 0,
                    'damage' => 100, 'adr' => 6.25, 'headshotRate' => 30,
                    'plants' => 0, 'defuses' => 0, 'firstBloods' => 0, 'tradeKills' => 0,
                    'clutchesWon' => 0, 'setPiecesInvolved' => 0,
                ];
                $performances[] = [
                    'instance_id' => $id, 'team' => $side, 'kills' => 1, 'deaths' => 0,
                    'assists' => 0, 'damage' => 100, 'adr' => 6.25, 'headshot_rate' => 30,
                    'plants' => 0, 'defuses' => 0, 'first_bloods' => 0, 'trade_kills' => 0,
                    'clutches_won' => 0, 'set_pieces_involved' => 0,
                ];
            }
        }
        $rounds = [];
        for ($round = 1; $round <= 16; $round++) {
            $rounds[] = [
                'roundNumber' => $round, 'winnerTeam' => 'blue', 'winnerSide' => 'attackers',
                'reason' => 'attackers_eliminated', 'roundDurationSeconds' => 60,
                'blueScoreAfter' => $round, 'redScoreAfter' => 0,
            ];
        }
        return [
            'match_id' => $match->id, 'game_mode' => 'fps_mr15_v1',
            'versions' => $match->plan['versions'], 'seed' => $match->plan['seed'], 'winner' => 'blue',
            'report' => [
                'format' => 'MR15_TACTICAL_FPS', 'simulationVersion' => 2, 'winner' => 'blue', 'winnerTeam' => 'blue',
                'mapId' => $match->plan['fps']['map_id'], 'seed' => $match->plan['seed'],
                'totalRounds' => 16, 'durationSeconds' => 960,
                'finalScore' => ['blue' => 16, 'red' => 0],
                'roundResults' => $rounds, 'playerStats' => $playerStats, 'events' => [],
            ],
            'player_performance' => $performances,
        ];
    }

    public function test_hybrid_allocation_pins_baseline_and_does_not_load_an_unqualified_command_model():void {
        $catalog=OnlineCatalog::firstOrFail();$manifest=$catalog->manifest;
        $manifest['policy_version']='baseline-hybrid-v1';$catalog->update(['manifest'=>$manifest]);
        $match=$this->allocated();
        $this->assertSame('baseline-hybrid-v1',$match->plan['versions']['policy_version']);
        $this->assertSame(['controller'=>'hybrid','release'=>null],$match->plan['intelligence']);
    }

    public function test_original_roster_allocation_uses_hybrid_with_a_pinned_compatible_release_only():void {
        $match=$this->allocated();
        $this->assertSame('original-v3-hybrid-v2',$match->plan['versions']['policy_version']);
        $this->assertSame(['controller'=>'hybrid','release'=>null],$match->plan['intelligence']);
    }

    public function test_reviewed_roster_upgrade_preserves_owned_instances_lineup_and_queue():void {
        $current=OnlineCatalog::firstOrFail();$previous=$current->payload;
        foreach($previous['avatars'] as &$kit){unset($kit['abilityRuleset']);$kit['skill1']['name']='Historical skill';}unset($kit);
        $oldId=hash('sha256',json_encode($previous));$manifest=$current->manifest;$manifest['catalog_version']=$oldId;
        $current->update(['active'=>false]);
        OnlineCatalog::create(['id'=>$oldId,'active'=>true,'manifest'=>$manifest,'payload'=>$previous]);
        $user=$this->account();$service=app(OnlineService::class);$service->queue($user);
        $club=\App\Models\OnlineClub::where('user_id',$user->id)->firstOrFail();$lineup=$club->lineup;
        $owned=OwnedPlayerCard::orderBy('id')->get(['id','user_id','definition_id','grant_key'])->toArray();
        $this->artisan('online:install-catalog',['--original-roster'=>true])->assertSuccessful();
        $this->assertSame($owned,OwnedPlayerCard::orderBy('id')->get(['id','user_id','definition_id','grant_key'])->toArray());
        $this->assertSame($lineup,$club->fresh()->lineup);
        $this->assertCount(5,$service->validatedLineup($user->id,$lineup,$service->activeCatalog()));
        $this->assertSame($current->id,\App\Models\NormalQueueTicket::where('user_id',$user->id)->value('catalog_id'));
        $this->assertFalse(OnlineCatalog::findOrFail($oldId)->active);
    }

    public function test_allocation_freezes_content_catalog_even_after_backoffice_edits():void {
        $match=$this->allocated();$snapshot=$match->plan['content_catalog'];
        $this->assertCount(284,$snapshot['records']);
        $entry=\App\Models\GameContent::where('kind','item')->firstOrFail();
        $payload=$entry->payload;$payload['cost']=123;
        app(\App\Services\GameContentService::class)->mutate($entry,1,$match->blue_user_id,'save',$payload);
        $this->assertSame($snapshot,$match->fresh()->plan['content_catalog']);
        $this->assertNotSame($snapshot['hash'],app(\App\Services\GameContentService::class)->snapshot()['hash']);
    }
    private function workerResult(OnlineMatch $match): array
    {
        return $this->fpsWorkerResult($match);
    }

    public function test_match_allocation_pins_visual_versions_for_reconnect_and_replay(): void
    {
        $run=\App\Models\AvatarEvolutionRun::create(['id'=>(string)\Illuminate\Support\Str::uuid(),'avatar_id'=>'c_invoker','plan'=>[]]);
        $release=\App\Models\AvatarVisualRelease::create(['avatar_id'=>'c_invoker','variant'=>'claude','version'=>2,'run_id'=>$run->id,
            'candidate_id'=>'candidate-01','file'=>'candidate-01.glb','sha256'=>str_repeat('a',64),'validation'=>[],'approved_by'=>'fixture']);
        $match=$this->allocated();$this->assertSame($release->id,$match->plan['visual_releases'][0]['id']);
        $pinned=$match->plan['visual_releases'];$planHash=$match->plan_hash;
        $release->update(['active'=>false]);
        \App\Models\AvatarVisualRelease::create(['avatar_id'=>'c_invoker','variant'=>'claude','version'=>3,'run_id'=>$run->id,
            'candidate_id'=>'candidate-02','file'=>'candidate-02.glb','sha256'=>str_repeat('b',64),'validation'=>[],'approved_by'=>'fixture']);
        $this->getJson('/api/v1/online/matches/'.$match->id)->assertOk()->assertJsonPath('data.plan.visual_releases.0.sha256',str_repeat('a',64));
        $this->assertSame($pinned,$match->fresh()->plan['visual_releases']);$this->assertSame($planHash,$match->fresh()->plan_hash);
        $next=$this->allocated();$this->assertSame(str_repeat('b',64),$next->plan['visual_releases'][0]['sha256']);
    }

    public function test_authentication_and_idempotent_starter_ownership(): void
    {
        $this->getJson('/api/v1/online')->assertUnauthorized();
        $user = $this->account();
        $this->getJson('/api/v1/online')->assertOk()->assertJsonCount(5, 'data.cards');
        $this->getJson('/api/v1/online')->assertOk()->assertJsonCount(5, 'data.cards');
        $this->assertSame(5, OwnedPlayerCard::where('user_id', $user->id)->count());
        $this->assertDatabaseCount('online_clubs', 1);
    }

    public function test_club_identity_requires_unique_tag_and_current_revision(): void
    {
        $first = $this->account();
        $club = app(OnlineService::class)->provision($first);
        $first->forceFill(['supporter_until' => now()->addMonth()])->save();
        $payload = ['revision' => $club->fresh()->revision, 'name' => 'Manila Five', 'tag' => 'MNL', 'identity' => [
            'country' => 'PH', 'crest' => ['shape' => 'shield', 'mark' => 'star'],
            'colors' => ['primary' => '#112233', 'secondary' => '#ffffff', 'accent' => '#ffcc00'],
            'home_jersey' => ['pattern' => 'solid', 'crest_position' => 'center', 'lettering' => 'italic', 'number_style' => 'outline'],
            'away_jersey' => ['pattern' => 'stripes'],
        ]];
        $bad = $payload;
        $bad['identity']['home_jersey']['number_style'] = 'custom';
        $this->putJson('/api/v1/online/club/identity', $bad)->assertUnprocessable()->assertJsonValidationErrors('identity.home_jersey.number_style');
        $this->putJson('/api/v1/online/club/identity', $payload)->assertOk()->assertJsonPath('data.tag', 'MNL')
            ->assertJsonPath('data.identity.home_jersey.number_style', 'outline');
        $this->putJson('/api/v1/online/club/identity', $payload)->assertUnprocessable();
        $second = $this->account();
        app(OnlineService::class)->provision($second);
        $second->forceFill(['supporter_until' => now()->addMonth()])->save();
        $this->putJson('/api/v1/online/club/identity', $payload)->assertUnprocessable()->assertJsonValidationErrors('tag');
        $this->assertSame('Manila Five', $club->fresh()->name);
    }

    public function test_fixture_locks_owned_orders_and_kicks_off_once_without_a_browser(): void
    {
        $this->freezeTime();
        $service = app(OnlineService::class);
        $homeUser = $this->account();
        $home = $service->provision($homeUser);
        $away = $service->provision($this->account());
        $kickoff = now()->addMinutes(20);
        $this->artisan('fixtures:schedule', ['home' => $home->id, 'away' => $away->id,
            'kickoff' => $kickoff->toIso8601String()])->assertSuccessful();
        $fixture = \App\Models\ClubFixture::firstOrFail();
        $ordersPath = '/api/v1/online/fixtures/'.$fixture->id.'/orders';
        $this->putJson($ordersPath, ['lineup' => $home->lineup])->assertUnprocessable();
        $orders = $home->starters;
        Sanctum::actingAs($homeUser);
        $this->putJson($ordersPath, ['lineup' => $orders])->assertNoContent();
        $lock = new \App\Jobs\LockClubFixture($fixture->id);
        $lock->handle($service);
        $this->assertNull($fixture->fresh()->match_id);

        $this->travelTo($kickoff->copy()->subMinutes(15));
        $this->putJson($ordersPath, ['lineup' => $orders])->assertConflict();
        $lock->handle($service);
        $lock->handle($service);
        $match = $fixture->fresh()->match;
        $this->assertDatabaseCount('online_matches', 1);
        $home->update(['name' => 'New identity']);
        $this->assertSame($match->plan['clubs']['blue'], $match->fresh()->plan['fixture']['clubs']['blue']['name']);
        $this->getJson('/api/v1/online/matches/'.$match->id)->assertNotFound();

        $poll = new \App\Jobs\PollOnlineMatch($match->id);
        $result = $this->workerResult($match);
        Http::fake(['*' => Http::response(['status' => 'completed', 'sequence' => 1200, 'result' => $result,
            'public_replay' => true, 'started_at' => $kickoff->toISOString()])]);
        $poll->handle($service);
        Http::assertNothingSent();
        $this->travelTo($kickoff);
        $poll->handle($service);
        $poll->handle($service);
        Http::assertSentCount(2);
        $this->assertSame('completed', $match->fresh()->status);
        $this->getJson('/api/v1/online/fixtures')->assertOk()->assertJsonPath('data.0.status', 'Completed');
        $this->getJson('/api/v1/clashbook')->assertOk()
            ->assertJsonPath('data.fixtures.0.winner', $match->plan['clubs']['blue'])
            ->assertJsonPath('data.fixtures.0.watch_match_id', $match->id)
            ->assertJsonMissingPath('data.fixtures.0.home_orders');
        $this->assertSame(10, app(\App\Services\PlayerRecordBook::class)->capture($match->id));
        $career = \Illuminate\Support\Facades\DB::table('player_career_records')->where('match_id', $match->id)->first();
        $this->assertSame(6.25, (float) $career->adr);
        $this->assertSame(30.0, (float) $career->headshot_rate);
        $this->assertSame(1.0, (float) json_decode($career->fps_stats, true)['kills']);
        $this->account();
        $this->getJson('/api/v1/online/matches/'.$match->id)->assertOk()
            ->assertJsonMissingPath('data.plan.blue')->assertJsonMissingPath('data.plan.seed');
        $this->assertDatabaseCount('club_training_sessions', 10);
        $this->travel(8)->days();
        $this->artisan('clubs:weekly')->assertSuccessful();
        $this->artisan('clubs:weekly')->assertSuccessful();
        $this->assertSame(17, OwnedPlayerCard::findOrFail($home->lineup[0]['instance_id'])->training_xp);
        $this->assertDatabaseCount('club_money_entries', 4);
    }

    public function test_accepted_friendly_creates_one_fixture_for_the_two_clubs(): void
    {
        $online = app(OnlineService::class);
        $home = $this->account();
        $online->provision($home);
        $away = $this->account();
        $online->provision($away)->update(['tag' => 'AWAY']);
        Sanctum::actingAs($home);
        $this->postJson('/api/v1/online/fixtures/invites', ['tag' => 'AWAY', 'kickoff_at' => now()->addDay()->toIso8601String()])->assertNoContent();
        $invite = \App\Models\ClubFriendlyInvite::firstOrFail();
        $url = '/api/v1/online/fixtures/invites/'.$invite->id.'/accept';
        $this->postJson($url)->assertForbidden();
        Sanctum::actingAs($away);
        $this->getJson('/api/v1/online/fixtures')->assertOk()->assertJsonCount(1, 'invites');
        $this->postJson($url)->assertNoContent();
        $this->postJson($url)->assertNoContent();
        $this->assertDatabaseCount('club_fixtures', 1);
    }

    public function test_bot_club_uses_scouts_and_bids_in_the_shared_market(): void
    {
        $this->freezeTime();
        $seller = $this->account();
        app(OnlineService::class)->provision($seller);
        $this->artisan('clubs:create-bot', ['tag' => 'BOTMNL', 'name' => 'Manila Relay'])->assertSuccessful();
        $club = \App\Models\OnlineClub::where('tag', 'BOTMNL')->firstOrFail();
        $this->assertTrue($club->is_bot);
        $this->assertSame(5, OwnedPlayerCard::where('user_id', $club->user_id)->where('grant_key', 'like', 'bot-scout:%')->count());
        Sanctum::actingAs($seller);
        $this->postJson('/api/v1/online/market/scout')->assertStatus(410);
        app(\App\Services\ClubMarketService::class)->scout(\App\Models\OnlineClub::where('user_id',$seller->id)->firstOrFail());
        $reserve = $this->getJson('/api/v1/online/market')->json('data.reserves.0.id');
        $this->postJson('/api/v1/online/market/auctions', ['card_id' => $reserve, 'opening_bid' => 10_000])->assertNoContent();
        $auction = \App\Models\ClubAuction::firstOrFail();
        Sanctum::actingAs($club->user);
        $this->agreeTransfer($club, $auction->card);
        $this->postJson('/api/v1/online/market/auctions/'.$auction->id.'/bid', ['amount' => 10_000])->assertNoContent();
        $this->assertSame($club->id, $auction->fresh()->bidder_id);
        $this->assertSame(\App\Services\ClubMarketService::OPENING_BALANCE - 10_000, app(\App\Services\ClubMarketService::class)->balance($club->id));
        $this->postJson('/api/v1/online/market/auctions', ['card_id' => $club->lineup[0]['instance_id'], 'opening_bid' => 10_000])->assertUnprocessable();
        $this->artisan('clubs:weekly')->assertSuccessful();
        $this->artisan('clubs:weekly')->assertSuccessful();
        $this->travel(25)->hours();
        $this->artisan('market:close-due')->assertSuccessful();
        $this->assertSame(6, OwnedPlayerCard::where('user_id', $club->user_id)->count());
    }

    public function test_market_reserves_and_releases_money_then_transfers_a_player_once(): void
    {
        $this->freezeTime();
        $service = app(OnlineService::class);
        $seller = $this->account();
        $club = $service->provision($seller);
        $this->postJson('/api/v1/online/market/scout')->assertStatus(410);
        app(\App\Services\ClubMarketService::class)->scout($club);
        $card = $this->getJson('/api/v1/online/market')->assertOk()->json('data.reserves.0.id');
        $this->postJson('/api/v1/online/market/auctions', ['card_id' => $card, 'opening_bid' => 10_000])->assertNoContent();
        $auction = \App\Models\ClubAuction::firstOrFail();
        $bid = '/api/v1/online/market/auctions/'.$auction->id.'/bid';
        $this->postJson($bid, ['amount' => 10_000])->assertUnprocessable();
        $firstBidder = $this->account();
        $firstClub = $service->provision($firstBidder);
        $this->agreeTransfer($firstClub, $auction->card);
        $this->postJson($bid, ['amount' => 10_000])->assertNoContent();
        $winner = $this->account();
        $winnerClub = $service->provision($winner);
        $this->agreeTransfer($winnerClub, $auction->card);
        $this->postJson($bid, ['amount' => 10_001])->assertUnprocessable();
        $this->postJson($bid, ['amount' => 15_000])->assertNoContent();
        $market = app(\App\Services\ClubMarketService::class);
        $this->assertSame(5_000_000, $market->balance($firstClub->id));
        $this->assertSame(4_985_000, $market->balance($winnerClub->id));
        $this->travel(24)->hours();
        $this->artisan('market:close-due')->assertSuccessful();
        $this->artisan('market:close-due')->assertSuccessful();
        $this->assertSame($winner->id, OwnedPlayerCard::findOrFail($card)->user_id);
        $this->assertSame('sold', $auction->fresh()->status);
        $this->assertSame(4_915_000, $market->balance($club->id));
    }

    public function test_manila_event_advances_only_from_verified_matches_and_awards_placement_once(): void
    {
        $this->travelTo(\Illuminate\Support\Carbon::parse('2027-02-01T10:00:00+08:00'));
        $semifinals = now()->addDays(3);
        $this->artisan('events:publish-manila', ['tier' => 5, 'semifinals' => $semifinals->toIso8601String()])->assertSuccessful();
        $event = \App\Models\ClubTournament::firstOrFail();
        $online = app(OnlineService::class);
        $clubs = [];
        for ($slot = 1; $slot <= 4; $slot++) {
            $club = $online->provision($this->account());
            $club->update(['tag' => 'MNL'.$slot]);
            $this->postJson('/api/v1/clashbook/events/'.$event->id.'/register')->assertNoContent();
            $clubs[] = $club;
        }

        $this->travelTo($event->registration_closes_at);
        $this->artisan('events:advance')->assertSuccessful();
        $this->assertSame(2, $event->fixtures()->count());
        $this->artisan('events:advance')->assertSuccessful();
        $this->assertSame(2, $event->fixtures()->count());

        foreach ($event->fixtures()->get() as $fixture) {
            $this->travelTo($fixture->kickoff_at);
            (new \App\Jobs\LockClubFixture($fixture->id))->handle($online);
            $match = $fixture->fresh()->match;
            $online->settle($match->id, $this->workerResult($match), 1200);
        }
        $this->artisan('events:advance')->assertSuccessful();
        $final = $event->fixtures()->where('bracket_slot', 3)->firstOrFail();
        $this->assertSame($clubs[0]->id, $final->home_club_id);
        $this->assertSame($clubs[1]->id, $final->away_club_id);
        $this->travelTo($event->final_at);
        (new \App\Jobs\LockClubFixture($final->id))->handle($online);
        $match = $final->fresh()->match;
        $online->settle($match->id, $this->workerResult($match), 1200);
        $this->artisan('events:advance')->assertSuccessful();
        $this->artisan('events:advance')->assertSuccessful();
        $this->assertSame('completed', $event->fresh()->status);
        $this->assertSame(4, $clubs[0]->fresh()->tier);
        $this->assertDatabaseCount('club_money_entries', 2);
    }

    public function test_foreign_ownership_forged_attributes_and_stale_updates_are_rejected(): void
    {
        $first = $this->account();
        $club = app(OnlineService::class)->provision($first);
        $second = $this->account();
        app(OnlineService::class)->provision($second);
        $foreign = OwnedPlayerCard::where('user_id', $second->id)->first();
        Sanctum::actingAs($first);
        $lineup = $club->lineup;
        $lineup[0]['instance_id'] = $foreign->id;
        $this->putJson('/api/v1/online/club', ['revision' => 1, 'lineup' => $lineup])->assertUnprocessable();
        $lineup = $club->lineup;
        $lineup[0]['stats'] = ['iq' => 9999];
        $this->putJson('/api/v1/online/club', ['revision' => 1, 'lineup' => $lineup])->assertUnprocessable();
        $this->putJson('/api/v1/online/club', ['revision' => 1, 'name' => 'Updated club'])->assertOk();
        $this->putJson('/api/v1/online/club', ['revision' => 1, 'name' => 'Stale write'])->assertUnprocessable();
    }

    public function test_queue_waits_for_a_distinct_account_and_allocates_only_once(): void
    {
        $first = $this->account();
        $this->postJson('/api/v1/online/queue')->assertAccepted()->assertJsonPath('data.match', null);
        $this->postJson('/api/v1/online/queue')->assertAccepted()->assertJsonPath('data.match', null);
        $this->assertDatabaseCount('online_matches', 0);
        $this->account();
        $response = $this->postJson('/api/v1/online/queue')->assertAccepted();
        $id = $response->json('data.match.id');
        $this->postJson('/api/v1/online/queue')->assertAccepted()->assertJsonPath('data.match.id', $id);
        Sanctum::actingAs($first);
        $this->postJson('/api/v1/online/queue')->assertAccepted()->assertJsonPath('data.match.id', $id);
        $this->assertDatabaseCount('online_matches', 1);
        $this->assertSame('normal', OnlineMatch::find($id)->plan['mode']);
    }

    public function test_normal_queue_prefers_a_waiting_manager_before_bot_fallback(): void
    {
        $online = app(OnlineService::class);
        $bot = $online->provision(User::factory()->create(), true);
        $first = $this->account();
        $this->postJson('/api/v1/online/queue')->assertAccepted()->assertJsonPath('data.match', null);

        $second = $this->account();
        $match = $this->postJson('/api/v1/online/queue')->assertAccepted()->json('data.match');

        $this->assertSame([$first->id, $second->id], [
            min($match['blue_user_id'], $match['red_user_id']),
            max($match['blue_user_id'], $match['red_user_id']),
        ]);
        $this->assertSame([], OnlineMatch::findOrFail($match['id'])->plan['bot_sides']);
        $this->assertTrue($bot->fresh()->is_bot);
    }

    public function test_queued_manager_is_matched_with_available_bot_after_human_wait(): void
    {
        $online = app(OnlineService::class);
        $botUser = User::factory()->create();
        $bot = $online->provision($botUser, true);
        $human = $this->account();
        $this->postJson('/api/v1/online/queue')->assertAccepted()->assertJsonPath('data.match', null);
        Queue::assertPushed(\App\Jobs\MatchQueuedBotOpponent::class, fn ($job) => $job->userId === $human->id);
        $this->assertDatabaseHas('normal_queue_tickets', ['user_id' => $human->id, 'status' => 'queued']);

        $this->assertTrue($online->matchQueuedBotOpponent($human->id));
        $ticket = \App\Models\NormalQueueTicket::where('user_id', $human->id)->firstOrFail();
        $match = OnlineMatch::findOrFail($ticket->match_id);

        $this->assertSame('matched', $ticket->status);
        $this->assertSame('matched', \App\Models\NormalQueueTicket::where('user_id', $botUser->id)->value('status'));
        $this->assertSame([$bot->user_id], array_map(
            fn (string $side) => $side === 'blue' ? $match->blue_user_id : $match->red_user_id,
            $match->plan['bot_sides'],
        ));
        $botSide = $match->plan['bot_sides'][0];
        $this->assertSame(
            array_column($bot->starters, 'instance_id'),
            array_column($match->plan[$botSide], 'instance_id'),
        );
        $this->assertArrayHasKey('staff', $match->plan);
        $this->assertArrayHasKey('coaches', $match->plan);
        $this->assertArrayNotHasKey('fixture', $match->plan);
        \Illuminate\Support\Facades\Queue::assertPushed(\App\Jobs\PollOnlineMatch::class);
    }

    public function test_queued_manager_stays_cancellable_when_no_eligible_bot_exists(): void
    {
        $online = app(OnlineService::class);
        $bot = $online->provision(User::factory()->create(), true);
        $bot->update(['starters' => []]);
        $human = $this->account();
        $this->postJson('/api/v1/online/queue')->assertAccepted()->assertJsonPath('data.match', null);

        $this->assertFalse($online->matchQueuedBotOpponent($human->id));
        $this->assertDatabaseHas('normal_queue_tickets', ['user_id' => $human->id, 'status' => 'queued']);

        $this->deleteJson('/api/v1/online/queue')->assertNoContent();
        $this->assertDatabaseHas('normal_queue_tickets', ['user_id' => $human->id, 'status' => 'cancelled']);
    }

    public function test_queue_rejects_supplied_rating_seed_result_and_edits_while_waiting(): void
    {
        $user = $this->account();
        $this->postJson('/api/v1/online/queue', ['winner' => 'blue', 'rating' => 9999, 'seed' => 1])->assertUnprocessable();
        $this->postJson('/api/v1/online/queue')->assertAccepted();
        $this->putJson('/api/v1/online/club', ['revision' => 1, 'name' => 'Changed'])->assertUnprocessable();
        $this->deleteJson('/api/v1/online/queue')->assertNoContent();
        $this->putJson('/api/v1/online/club', ['revision' => 1, 'name' => 'Changed'])->assertOk();
    }

    public function test_private_match_grants_are_one_time_and_unrelated_users_are_denied(): void
    {
        $match = $this->allocated();
        $response = $this->postJson('/api/v1/online/matches/'.$match->id.'/stream')->assertOk();
        $grant = $response->json('data.grant');
        $this->postJson('/api/internal/online/authorize-stream', ['grant' => $grant])->assertUnauthorized();
        $this->withHeader('Authorization', 'Bearer '.config('online.worker_token'))
            ->postJson('/api/internal/online/authorize-stream', ['grant' => $grant])->assertOk()->assertJsonPath('match_id', $match->id);
        $this->postJson('/api/internal/online/authorize-stream', ['grant' => $grant])->assertForbidden();
        $this->flushHeaders();
        $this->account();
        $this->getJson('/api/v1/online/matches/'.$match->id)->assertForbidden();
        $this->postJson('/api/v1/online/matches/'.$match->id.'/stream')->assertForbidden();
        $this->getJson('/api/v1/online/matches/'.$match->id.'/replay')->assertForbidden();
    }

    public function test_expired_grants_and_browser_completion_are_rejected(): void
    {
        $match = $this->allocated();
        $grant = $this->postJson('/api/v1/online/matches/'.$match->id.'/stream')->json('data.grant');
        $this->travel(2)->minutes();
        $this->withHeader('Authorization', 'Bearer '.config('online.worker_token'))
            ->postJson('/api/internal/online/authorize-stream', ['grant' => $grant])->assertForbidden();
        $this->flushHeaders();
        $this->postJson('/api/v1/online/matches/'.$match->id, $this->workerResult($match))->assertMethodNotAllowed();
        $this->assertNull($match->fresh()->result);
    }

    public function test_verified_fps_allocation_settles_once_and_cannot_be_rewritten(): void
    {
        $match = $this->allocated();
        $service = app(OnlineService::class);
        $result = $this->workerResult($match);
        $service->settle($match->id, $result, 1000);
        $hash = $match->fresh()->result_hash;
        $service->settle($match->id, $result, 1000);
        $this->assertSame($hash, $match->fresh()->result_hash);
        $this->assertDatabaseCount('online_matches', 1);
        $this->assertDatabaseCount('owned_player_cards', 10);
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $service->settle($match->id, [...$result, 'winner' => 'red'], 1001);
    }

    public function test_fps_allocation_settles_verified_mr15_report_and_rejects_a_wrong_map(): void
    {
        $match = $this->allocated();
        $this->assertSame('fps_mr15_v1', $match->plan['game_mode']);
        $this->assertContains($match->plan['fps']['map_id'], ['breakwater', 'foundry', 'old-quarter', 'red-mesa', 'northpoint']);
        $result = $this->fpsWorkerResult($match);
        $invalid = $result;
        $invalid['report']['mapId'] = $match->plan['fps']['map_id'] === 'breakwater' ? 'foundry' : 'breakwater';
        try {
            app(OnlineService::class)->settle($match->id, $invalid, 100);
            $this->fail('A report for a different map must not settle.');
        } catch (\Illuminate\Validation\ValidationException) {
            $this->assertNull($match->fresh()->result);
        }
        app(OnlineService::class)->settle($match->id, $result, 100);
        $this->assertSame('completed', $match->fresh()->status);
        $this->assertSame(10, \Illuminate\Support\Facades\DB::table('club_player_match_ratings')->where('match_id', $match->id)->count());
        $match->update([
            'spectator_ready' => true,
            'plan' => [...$match->plan, 'fixture' => ['kickoff_at' => now()->subMinute()->toIso8601String()]],
        ]);
        $this->flushHeaders();
        $this->account();
        $this->getJson('/api/v1/online/matches/'.$match->id)
            ->assertOk()
            ->assertJsonPath('data.plan.game_mode', 'fps_mr15_v1')
            ->assertJsonPath('data.plan.fps.map_id', $match->plan['fps']['map_id'])
            ->assertJsonPath('data.result.report.format', 'MR15_TACTICAL_FPS');
    }

    public function test_seed_version_map_and_score_mismatches_cannot_settle(): void
    {
        $match = $this->allocated();
        $base = $this->workerResult($match);
        $invalid = [array_replace_recursive($base, ['seed' => $base['seed'] + 1]),
            array_replace_recursive($base, ['versions' => ['policy_version' => 'forged']]),
            array_replace_recursive($base, ['report' => ['mapId' => 'forged-map']]),
            array_replace_recursive($base, ['report' => ['roundResults' => [['blueScoreAfter' => 99]]]])];
        foreach ($invalid as $result) {
            try { app(OnlineService::class)->settle($match->id, $result, 100); $this->fail('Invalid worker result accepted'); }
            catch (\Illuminate\Validation\ValidationException) { $this->assertNull($match->fresh()->result); }
        }
    }

    public function test_a_late_running_poll_cannot_reopen_a_completed_match(): void
    {
        $match = $this->allocated();
        $service = app(OnlineService::class);
        Http::fake(function ($request) use ($match, $service) {
            if ($request->method() === 'POST') {
                // Another trusted poll completes while this poll's HTTP request is in flight.
                $service->settle($match->id, $this->workerResult($match), 1000);
                return Http::response(['status' => 'running', 'sequence' => 999], 202);
            }
            return Http::response(['status' => 'running', 'sequence' => 999]);
        });
        (new \App\Jobs\PollOnlineMatch($match->id))->handle($service);
        $this->assertSame('completed', $match->fresh()->status);
        $this->assertSame(1000, $match->fresh()->sequence);
        $this->assertNotNull($match->fresh()->result_hash);
    }
}
