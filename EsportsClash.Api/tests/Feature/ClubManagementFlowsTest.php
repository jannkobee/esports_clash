<?php

namespace Tests\Feature;

use App\Models\{ClubFixture, OnlineClub, OnlineMatch, OwnedPlayerCard, ScrimmageQueueTicket, User};
use App\Services\{ClubMarketService, OnlineService, ScrimmageQueueService, WorldPlayerIdentity};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClubManagementFlowsTest extends TestCase
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
    }

    private function club(): array
    {
        $user = User::factory()->create();
        $club = app(OnlineService::class)->provision($user);

        return [$user, $club];
    }

    private function queueTicket(User $user, OnlineClub $club, int $tier, float $rating): ScrimmageQueueTicket
    {
        return ScrimmageQueueTicket::create([
            'user_id' => $user->id,
            'club_id' => $club->id,
            'tier' => $tier,
            'rating' => $rating,
            'lineup' => $club->lineup,
            'club_name' => $club->name,
            'status' => 'queued',
        ]);
    }

    private function reserve(OnlineClub $club): OwnedPlayerCard
    {
        $online = app(OnlineService::class);
        $starter = OwnedPlayerCard::findOrFail($club->lineup[0]['instance_id']);
        $reserve = OwnedPlayerCard::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'user_id' => $club->user_id,
            'catalog_id' => $starter->catalog_id,
            'definition_id' => $starter->definition_id,
            'grant_key' => 'club-management-test:'.$club->id,
        ]);

        return app(WorldPlayerIdentity::class)->assign($reserve, $online->activeCatalog(), false, 'scouting');
    }

    private function workerResult(OnlineMatch $match): array
    {
        $draft = [];
        $performance = [];
        foreach (['blue', 'red'] as $side) {
            $draft[$side] = array_map(fn (array $slot) => [
                'player' => ['id' => $slot['card_id']],
                'champion' => ['id' => $slot['avatar_id']],
            ], $match->plan[$side]);
            foreach ($match->plan[$side] as $slot) {
                $performance[] = [
                    'instance_id' => $slot['instance_id'],
                    'team' => $side,
                    'kills' => 1,
                    'deaths' => 0,
                    'assists' => 2,
                    'cs' => 100,
                    'gold' => 10000,
                    'damage' => 10000,
                ];
            }
        }

        return [
            'schema' => 1,
            'match_id' => $match->id,
            'seed' => $match->plan['seed'],
            'versions' => $match->plan['versions'],
            'winner' => 'blue',
            'terminal_nexus' => ['blue' => true, 'red' => false],
            'report' => [
                'seed' => $match->plan['seed'],
                'winner' => 'blue',
                'durationSeconds' => 600,
                'draft' => $draft,
            ],
            'player_performance' => $performance,
        ];
    }

    private function allocatedMatch(): OnlineMatch
    {
        $online = app(OnlineService::class);
        $online->queue(User::factory()->create());

        return $online->queue(User::factory()->create())['match'];
    }

    public function test_new_players_have_no_invented_recent_form(): void
    {
        [$user] = $this->club();
        Sanctum::actingAs($user);

        $players = $this->getJson('/api/v1/online')->assertOk()->json('data.cards');

        $this->assertCount(5, $players);
        foreach ($players as $player) {
            $this->assertNull($player['recent_form_rating']); // No invented match evidence before the first verified game.
            $this->assertSame([], $player['recent_form']);
        }
    }

    public function test_scrimmage_pairs_the_closest_rating_only_inside_the_same_tier(): void
    {
        [$olderUser, $olderClub] = $this->club();
        [$closerUser, $closerClub] = $this->club();
        [$joiningUser, $joiningClub] = $this->club();

        $older = $this->queueTicket($olderUser, $olderClub, 4, 40);
        $closer = $this->queueTicket($closerUser, $closerClub, 4, 48);
        $joining = $this->queueTicket($joiningUser, $joiningClub, 4, 45);

        $result = app(ScrimmageQueueService::class)->join($joiningUser, app(OnlineService::class));

        $this->assertSame('matched', $result['ticket']->status);
        $this->assertSame($closerClub->id, $result['fixture']->home_club_id);
        $this->assertSame($joiningClub->id, $result['fixture']->away_club_id);
        $this->assertSame('queued', $older->fresh()->status);
        $this->assertSame('matched', $closer->fresh()->status);
        $this->assertSame('Scrimmage', $result['fixture']->competition);
        $this->assertSame(2, \Illuminate\Support\Facades\DB::table('club_inbox')
            ->where('event_key', 'like', "scrimmage-queue:{$result['fixture']->id}:%")->count());
    }

    public function test_scrimmage_does_not_widen_rating_tiers(): void
    {
        [$candidateUser, $candidateClub] = $this->club();
        [$joiningUser, $joiningClub] = $this->club();

        $candidate = $this->queueTicket($candidateUser, $candidateClub, 5, 50);
        $joining = $this->queueTicket($joiningUser, $joiningClub, 4, 49);
        $result = app(ScrimmageQueueService::class)->join($joiningUser, app(OnlineService::class));

        $this->assertNull($result['fixture']);
        $this->assertSame('queued', $candidate->fresh()->status);
        $this->assertSame('queued', $joining->fresh()->status);
        $this->assertDatabaseCount('club_fixtures', 0);
    }

    public function test_scrimmage_leaves_same_tier_teams_queued_when_a_fixture_conflicts(): void
    {
        [$candidateUser, $candidateClub] = $this->club();
        [, $otherClub] = $this->club();
        [$joiningUser, $joiningClub] = $this->club();

        ClubFixture::create([
            'home_club_id' => $candidateClub->id,
            'away_club_id' => $otherClub->id,
            'competition' => 'Existing fixture',
            'kickoff_at' => now()->addMinutes(30),
            'orders_close_at' => now()->addMinutes(15),
        ]);

        $candidate = $this->queueTicket($candidateUser, $candidateClub, 4, 45);
        $joining = $this->queueTicket($joiningUser, $joiningClub, 4, 45);
        $result = app(ScrimmageQueueService::class)->join($joiningUser, app(OnlineService::class));

        $this->assertNull($result['fixture']);
        $this->assertSame('queued', $candidate->fresh()->status);
        $this->assertSame('queued', $joining->fresh()->status);
        $this->assertDatabaseCount('club_fixtures', 1);
    }

    public function test_trade_acceptance_escrows_cash_and_transfers_only_the_agreed_reserves(): void
    {
        [, $proposer] = $this->club();
        [, $recipient] = $this->club();
        $offeredPlayer = $this->reserve($proposer);
        $requestedPlayer = $this->reserve($recipient);
        $market = app(ClubMarketService::class);
        $proposerBalance = $market->balance($proposer->id);
        $recipientBalance = $market->balance($recipient->id);

        $this->agreeTransfer($recipient, $offeredPlayer);
        $this->agreeTransfer($proposer, $requestedPlayer);
        $proposal = $market->proposeTrade($proposer, $recipient, [$offeredPlayer->id], [$requestedPlayer->id], 100_000, 50_000);

        $this->assertSame(4_900_000, $market->balance($proposer->id));
        $this->assertFalse($proposal->comparison['binding']);
        $accepted = $market->respondToTrade($recipient, $proposal->id, 'accept');

        $this->assertSame('accepted', $accepted->status);
        $this->assertSame($recipient->user_id, $offeredPlayer->fresh()->user_id);
        $this->assertSame($proposer->user_id, $requestedPlayer->fresh()->user_id);
        $this->assertSame($proposerBalance - 50_000, $market->balance($proposer->id));
        $this->assertSame($recipientBalance + 50_000, $market->balance($recipient->id));
        $this->assertDatabaseHas('club_money_entries', [
            'club_id' => $proposer->id,
            'reference' => "trade:{$proposal->id}:offer",
            'amount' => -100_000,
        ]);
    }

    public function test_trade_ownership_is_rechecked_and_decline_or_expiry_refunds_escrow_once(): void
    {
        [$proposerUser, $proposer] = $this->club();
        [, $recipient] = $this->club();
        $offeredPlayer = $this->reserve($proposer);
        $requestedPlayer = $this->reserve($recipient);
        $market = app(ClubMarketService::class);

        Sanctum::actingAs($proposerUser);
        $this->postJson('/api/v1/online/market/trades', [
            'tag' => $recipient->tag,
            'offered_player_ids' => [$requestedPlayer->id],
            'requested_player_ids' => [$offeredPlayer->id],
            'offered_cash' => 10_000,
        ])->assertUnprocessable();
        $this->assertDatabaseCount('club_trade_proposals', 0);

        $this->agreeTransfer($recipient, $offeredPlayer);
        $this->agreeTransfer($proposer, $requestedPlayer);
        $rechecked = $market->proposeTrade($proposer, $recipient, [$offeredPlayer->id], [$requestedPlayer->id], 15_000, 0);
        $offeredPlayer->update(['user_id' => $recipient->user_id]);
        try {
            $market->respondToTrade($recipient, $rechecked->id, 'accept');
            $this->fail('A player whose ownership changed was transferred.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $exception) {
            $this->assertSame(422, $exception->getStatusCode());
        }
        $this->assertSame('pending', $rechecked->fresh()->status);
        $this->assertSame($recipient->user_id, $offeredPlayer->fresh()->user_id);
        $offeredPlayer->update(['user_id' => $proposer->user_id]);
        $market->respondToTrade($recipient, $rechecked->id, 'decline');

        $declined = $market->proposeTrade($proposer, $recipient, [$offeredPlayer->id], [$requestedPlayer->id], 20_000, 0);
        $this->assertSame(4_980_000, $market->balance($proposer->id));
        $this->assertSame('declined', $market->respondToTrade($recipient, $declined->id, 'decline')->status);
        $this->assertSame(5_000_000, $market->balance($proposer->id));

        $expired = $market->proposeTrade($proposer, $recipient, [$offeredPlayer->id], [$requestedPlayer->id], 30_000, 0);
        $expired->update(['expires_at' => now()->subSecond()]);
        $market->expireTrades();
        $market->expireTrades();

        $this->assertSame('expired', $expired->fresh()->status);
        $this->assertSame(5_000_000, $market->balance($proposer->id));
        $this->assertSame(3, \Illuminate\Support\Facades\DB::table('club_money_entries')
            ->where('kind', 'Trade offer refunded')->count());
        $this->assertSame(1, \Illuminate\Support\Facades\DB::table('club_money_entries')
            ->where('reference', "trade:{$expired->id}:refund")->count());
    }

    public function test_ratings_require_exact_allocated_player_coverage_and_persist_verified_results(): void
    {
        $online = app(OnlineService::class);
        $match = $this->allocatedMatch();
        $result = $this->workerResult($match);
        $result['player_performance'][0]['instance_id'] = (string) \Illuminate\Support\Str::uuid();

        try {
            $online->settle($match->id, $result, 1000);
            $this->fail('A performance record for an unallocated player was accepted.');
        } catch (ValidationException) {
            $this->assertDatabaseCount('club_player_match_ratings', 0);
        }

        $result = $this->workerResult($match);
        $online->settle($match->id, $result, 1000);

        $this->assertDatabaseCount('club_player_match_ratings', 10);
        $this->assertDatabaseHas('club_player_match_ratings', [
            'match_id' => $match->id,
            'card_id' => $match->plan['blue'][0]['instance_id'],
            'won' => true,
        ]);
        $ratings = \Illuminate\Support\Facades\DB::table('club_player_match_ratings')
            ->where('match_id', $match->id)->pluck('rating');
        $this->assertCount(10, $ratings);
        $this->assertGreaterThanOrEqual(1, (float) $ratings->min());
        $this->assertLessThanOrEqual(10, (float) $ratings->max());
        $this->assertSame('completed', $match->fresh()->status);
    }
}
