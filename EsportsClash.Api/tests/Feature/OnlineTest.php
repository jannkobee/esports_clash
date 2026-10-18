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

    private function workerResult(OnlineMatch $match): array
    {
        $draft = [];
        foreach (['blue', 'red'] as $side) $draft[$side] = array_map(fn ($slot) => ['player' => ['id' => $slot['card_id']], 'champion' => ['id' => $slot['avatar_id']]], $match->plan[$side]);
        return ['schema' => 1, 'match_id' => $match->id, 'seed' => $match->plan['seed'], 'versions' => $match->plan['versions'],
            'winner' => 'blue', 'terminal_nexus' => ['blue' => true, 'red' => false],
            'report' => ['seed' => $match->plan['seed'], 'winner' => 'blue', 'durationSeconds' => 600, 'draft' => $draft]];
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

    public function test_real_terminal_allocation_settles_once_and_cannot_be_rewritten(): void
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

    public function test_seed_version_draft_and_nexus_mismatches_cannot_settle(): void
    {
        $match = $this->allocated();
        $base = $this->workerResult($match);
        $invalid = [array_replace_recursive($base, ['seed' => $base['seed'] + 1]),
            array_replace_recursive($base, ['versions' => ['policy_version' => 'forged']]),
            array_replace_recursive($base, ['terminal_nexus' => ['red' => true]]),
            array_replace_recursive($base, ['report' => ['draft' => ['blue' => [['player' => ['id' => 'forged']]]]]])];
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
