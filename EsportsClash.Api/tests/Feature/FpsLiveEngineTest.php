<?php

namespace Tests\Feature;

use App\Jobs\PollOnlineMatch;
use App\Models\{ClubFixture, OnlineClub, OnlineMatch, User};
use App\Services\{FpsLineageStore, FpsOfficialLearning, MatchDebrief, OnlineService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB, Http, Queue};
use Laravel\Sanctum\Sanctum;
use Tests\Support\{AssignsManagerRoles, FpsWorkerResult};
use Tests\TestCase;

/** Official matches on the live 3D engine (simulation v5): pinning, settlement, precompute timing, spoiler-safe replay. */
class FpsLiveEngineTest extends TestCase
{
    use RefreshDatabase, AssignsManagerRoles;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->assignManagerRolesOnSave();
        $this->artisan('online:install-catalog')->assertSuccessful();
        DB::table('fps_identity_settings')->where('id', 1)->update(['enabled' => true]);
        config(['online.fps_simulation_version' => 5, 'online.worker_token' => str_repeat('test-worker-', 4), 'online.worker_url' => 'http://worker.test', 'online.precompute_minutes' => 90]);
    }

    /** A queued (non-fixture) match, or a fixture match with a kickoff when given. */
    private function allocate(?string $kickoff = null): array
    {
        $service = app(OnlineService::class);
        $users = [User::factory()->create(), User::factory()->create()];
        foreach ($users as $user) $service->provision($user);
        $service->queue($users[0]);
        $match = $service->queue($users[1])['match'];
        if ($kickoff !== null) {
            $plan = $match->plan; $plan['fixture'] = ['id' => 1, 'competition' => 'Test Cup', 'kickoff_at' => $kickoff, 'clubs' => ['blue' => ['name' => 'A'], 'red' => ['name' => 'B']]];
            $match->update(['plan' => $plan, 'plan_hash' => hash('sha256', json_encode($plan))]);
        }
        return [$match->fresh(), $users];
    }

    public function test_new_allocations_pin_the_live_engine_on_a_live_map(): void
    {
        [$match] = $this->allocate();
        $this->assertSame(5, $match->plan['fps']['simulation_version']);
        $this->assertContains($match->plan['fps']['map_id'], OnlineService::FPS_LIVE_MAPS);
        $this->assertSame(OnlineService::FPS_LIVE_MAPS[$match->plan['seed'] % 2], $match->plan['fps']['map_id']);
        $this->assertTrue($match->usesLiveEngine());
    }

    public function test_verified_experience_is_recorded_once_and_new_allocations_pin_the_promoted_map_book(): void
    {
        [$first, $users] = $this->allocate();
        $service = app(OnlineService::class);
        $result = FpsWorkerResult::forMatch($first);
        $result['report']['orderObservations'] = [
            ['round' => 1, 'team' => 'red', 'firstContactSeconds' => 12.3, 'entrySupported' => false],
            ['round' => 16, 'team' => 'blue', 'firstContactSeconds' => 8.4, 'entrySupported' => true],
        ];
        foreach (['blue', 'red'] as $side) {
            foreach (range(1, 16) as $round) {
                $attack = $round <= 15 ? 'red' : 'blue';
                $role = $side === $attack ? 'attack' : 'defense';
                $result['report']['playbookExperience'][$side]['rounds'][] = ['side' => $role, 'playId' => $role === 'attack' ? 'seed:default_pick' : 'seed:standard', 'won' => $side === 'blue'];
                $result['report']['playbookExperience'][$side]['observed'][] = ['seen' => ['earlyRush' => $side !== $attack, 'unknownField' => 1]];
            }
        }
        $service->settle($first->id, $result, 1);
        $service->settle($first->id, $result, 1);
        $this->assertSame(2, DB::table('fps_lineage_experience')->where('match_ref', $first->id)->whereNull('user_id')->count());

        $store = app(FpsLineageStore::class);
        $key = $first->plan['fps_learning']['team_playbooks']['blue']['lineage'];
        $lineage = $store->find($key);
        $payload = json_decode(DB::table('fps_lineage_experience')->where('lineage_id', $lineage->id)->value('payload'), true);
        $this->assertArrayNotHasKey('unknownField', $payload['rounds'][0]['observed']);
        $this->assertSame('defense', $payload['rounds'][0]['side']);
        $this->assertSame('attack', $payload['rounds'][15]['side']);
        $books = [];
        foreach (OnlineService::FPS_LIVE_MAPS as $map) {
            $books[$map] = ['map' => $map, 'rounds' => 16, 'attack' => (object) [], 'defense' => (object) []];
        }
        $version = $store->append($lineage, 'bundle', json_encode(['playbooks' => $books], JSON_THROW_ON_ERROR), 'real-match');
        $store->event($lineage, 'bundle', 'promote', $version->id, 'Worker published settled experience', 'test');
        $second = $service->allocate($service->activeCatalog(), $users[0]->id, $users[1]->id,
            $first->plan['blue'], $first->plan['red'], $first->plan['clubs'])->fresh();
        $pinned = $second->plan['fps_learning']['team_playbooks']['blue'];
        $this->assertSame($second->plan['fps']['map_id'], json_decode($pinned['playbook_json'], true)['map']);
        $this->assertSame($version->sha256, $pinned['sha256']);
        $this->assertArrayNotHasKey('playbook_json', $first->fresh()->plan['fps_learning']['team_playbooks']['blue']);
        $this->assertSame($first->plan_hash, $first->fresh()->plan_hash);
        $this->assertArrayNotHasKey('fps_learning', $second->toArray()['plan']);
        $this->assertArrayNotHasKey('playbookExperience', $first->fresh()->toArray()['result']['report']);
        $clubIds = OnlineClub::whereIn('user_id', [$users[0]->id, $users[1]->id])->pluck('id', 'user_id');
        $fixture = new ClubFixture(['home_club_id' => $clubIds[$users[0]->id], 'away_club_id' => $clubIds[$users[1]->id]]);
        $debrief = app(MatchDebrief::class)->private($fixture, $first->fresh(), $clubIds[$users[0]->id]);
        $this->assertSame([['round' => 16, 'firstContactSeconds' => 8.4, 'entrySupported' => true]], $debrief['order_observations']);
        $this->getJson('/api/v1/fps/lineages/'.FpsOfficialLearning::LINEAGE_PREFIX.$clubIds[$users[0]->id].'/current')->assertUnauthorized();
    }

    public function test_live_report_settles_once_and_applies_aggregated_behaviour(): void
    {
        [$match] = $this->allocate();
        $result = FpsWorkerResult::forMatch($match);
        $missing = $result; unset($missing['report']['behaviorSummary']);
        try { app(OnlineService::class)->settle($match->id, $missing, 1); $this->fail('A live report without its summary settled.'); }
        catch (\Illuminate\Validation\ValidationException) {}
        $foreign = $result; $foreign['report']['behaviorSummary']['not-a-player'] = ['risk' => ['opportunities' => 1, 'attempts' => 1]];
        try { app(OnlineService::class)->settle($match->id, $foreign, 1); $this->fail('A summary for an unallocated player settled.'); }
        catch (\Illuminate\Validation\ValidationException) {}
        $this->assertSame('completed', app(OnlineService::class)->settle($match->id, $result, 1)->status);
        $player = array_key_first($result['report']['behaviorSummary']);
        $behavior = json_decode(DB::table('fps_player_identities')->where('player_id', $player)->value('behavior'), true);
        $this->assertSame(['opportunities' => 2, 'attempts' => 1], $behavior['metrics']['engagement']);
        app(OnlineService::class)->settle($match->id, $result, 1);
        $this->assertDatabaseCount('fps_identity_applications', 1);
    }

    public function test_fixture_is_simulated_ahead_and_settles_only_when_the_broadcast_ends(): void
    {
        $this->travelTo(now()->startOfMinute());
        [$match] = $this->allocate(now()->addMinutes(60)->toISOString());
        $result = FpsWorkerResult::forMatch($match); // broadcastSeconds 1200
        Http::fake(["worker.test/matches/{$match->id}" => Http::sequence()
            ->push(['status' => 'allocated'], 202)->push(['status' => 'completed', 'started_at' => now()->toISOString(), 'sequence' => 1, 'public_replay' => true, 'result' => $result])
            ->push(['status' => 'allocated'], 202)->push(['status' => 'completed', 'started_at' => now()->toISOString(), 'sequence' => 1, 'public_replay' => true, 'result' => $result])
            ->push(['status' => 'allocated'], 202)->push(['status' => 'completed', 'started_at' => now()->toISOString(), 'sequence' => 1, 'public_replay' => true, 'result' => $result])]);
        // Inside the precompute window, before kickoff: the worker simulates, nothing is revealed.
        (new PollOnlineMatch($match->id))->handle(app(OnlineService::class));
        $match->refresh();
        $this->assertSame('allocated', $match->status);
        $this->assertNull($match->started_at);
        $this->assertFalse($match->spectator_ready);
        // Kickoff passed, broadcast still playing: running and watchable, not settled.
        $this->travel(61)->minutes();
        (new PollOnlineMatch($match->id))->handle(app(OnlineService::class));
        $match->refresh();
        $this->assertSame('running', $match->status);
        $this->assertTrue($match->spectator_ready);
        $this->assertNull($match->result);
        // The broadcast reached its end: settled.
        $this->travel(20)->minutes();
        (new PollOnlineMatch($match->id))->handle(app(OnlineService::class));
        $this->assertSame('completed', $match->fresh()->status);
    }

    public function test_viewers_only_receive_whole_chunks_that_have_been_broadcast(): void
    {
        $this->travelTo(now()->startOfMinute());
        [$match, $users] = $this->allocate(now()->subSeconds(25)->toISOString());
        $match->update(['status' => 'running', 'spectator_ready' => true]);
        $starts = [4, 12, 22, ...array_map(fn ($round) => $round * 29, range(4, 33))];
        $header = ['version' => 1, 'mapId' => $match->plan['fps']['map_id'], 'seed' => $match->plan['seed'], 'frameSeconds' => 0.1, 'framesPerChunk' => 100,
            'frames' => 12000, 'chunks' => 120, 'final' => true, 'broadcastSeconds' => 1200, 'roundStartSeconds' => $starts, 'players' => []];
        Http::fake([
            "worker.test/matches/{$match->id}/replay3d/header" => Http::response($header),
            "worker.test/matches/{$match->id}/replay3d/*" => Http::response(['version' => 1, 'index' => 0]),
        ]);
        Sanctum::actingAs($users[0]);
        $visible = $this->getJson("/api/v1/online/matches/{$match->id}/live-replay")->assertOk()->json('data');
        $this->assertSame(2, $visible['chunks']);           // 25 s broadcast: two whole 10 s chunks
        $this->assertFalse($visible['complete']);
        $this->assertNull($visible['broadcastSeconds']);    // the match length is not revealed
        $this->assertFalse($visible['final']);
        $this->assertSame([4, 12], $visible['roundStartSeconds']);
        $this->getJson("/api/v1/online/matches/{$match->id}/live-replay/1")->assertOk();
        $this->getJson("/api/v1/online/matches/{$match->id}/live-replay/2")->assertNotFound();
        $this->getJson("/api/v1/online/matches/{$match->id}/live-replay/119")->assertNotFound();
        Sanctum::actingAs(User::factory()->create());
        $this->getJson("/api/v1/online/matches/{$match->id}/live-replay")->assertOk(); // public fixture spectating
        $this->travel(885)->seconds();
        $mid = $this->getJson("/api/v1/online/matches/{$match->id}/live-replay")->assertOk()->json('data');
        $this->assertSame(array_slice($starts, 0, 31), $mid['roundStartSeconds']);
        $this->travel(300)->seconds();
        $this->getJson("/api/v1/online/matches/{$match->id}/live-replay")->assertOk()
            ->assertJsonPath('data.final', true)->assertJsonPath('data.roundStartSeconds', $starts);
    }

    public function test_an_expired_replay_answers_410_and_keeps_the_result(): void
    {
        [$match, $users] = $this->allocate();
        $result = FpsWorkerResult::forMatch($match);
        app(OnlineService::class)->settle($match->id, $result, 1);
        $header = ['version' => 1, 'mapId' => $match->plan['fps']['map_id'], 'seed' => $match->plan['seed'], 'frameSeconds' => 0.1, 'framesPerChunk' => 100,
            'frames' => 12000, 'chunks' => 120, 'final' => true, 'broadcastSeconds' => 1200, 'players' => []];
        // The final header was cached while the replay still existed; the worker then removed the replay.
        $expired = false;
        Http::fake(function () use (&$expired, $header) {
            return $expired ? Http::response(['error' => 'Replay expired', 'expired' => true], 410) : Http::response($header);
        });
        Sanctum::actingAs($users[0]);
        $this->getJson("/api/v1/online/matches/{$match->id}/live-replay")->assertOk();
        $expired = true;
        $this->getJson("/api/v1/online/matches/{$match->id}/live-replay/3")->assertStatus(410)->assertJsonPath('reason', 'replay_expired');
        // The cached header is dropped, so the header now reports the expiry too.
        $this->getJson("/api/v1/online/matches/{$match->id}/live-replay")->assertStatus(410)->assertJsonPath('reason', 'replay_expired');
        $settled = $match->fresh();
        $this->assertSame('completed', $settled->status);
        $this->assertSame($result['winner'], $settled->result['winner']);
        $this->getJson("/api/v1/online/matches/{$match->id}")->assertOk();
    }

    public function test_a_settled_match_without_its_replay_answers_410_and_a_running_one_is_still_preparing(): void
    {
        [$match, $users] = $this->allocate();
        Http::fake(fn () => Http::response(['error' => 'Replay part not available'], 404));
        Sanctum::actingAs($users[0]);
        $match->update(['status' => 'running', 'started_at' => now()]);
        $this->getJson("/api/v1/online/matches/{$match->id}/live-replay")->assertNotFound();
        app(OnlineService::class)->settle($match->id, FpsWorkerResult::forMatch($match), 1);
        $this->getJson("/api/v1/online/matches/{$match->id}/live-replay")->assertStatus(410)->assertJsonPath('reason', 'replay_missing');
    }
}
