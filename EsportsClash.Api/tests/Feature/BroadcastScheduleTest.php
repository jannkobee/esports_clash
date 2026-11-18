<?php
namespace Tests\Feature;

use App\Jobs\LockClubFixture;
use App\Models\{ClubFixture, ClubTournament, CompetitionDefinition, OnlineClub, OnlineMatch, User};
use App\Services\{CompetitionCalendar, CompetitionEngine, CompetitionQualification, OnlineService};
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB, Queue};
use Tests\TestCase;

/** Broadcast pacing: one game at a time per tournament stream, a full slot apart, and a per-hour kickoff cap. */
class BroadcastScheduleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->travelTo(CarbonImmutable::parse('2027-01-01T00:00:00Z'));
        $this->artisan('online:install-catalog')->assertSuccessful();
        app(CompetitionCalendar::class)->installDefaults();
        config(['competitions.broadcast_slot_minutes' => 90, 'competitions.broadcast_break_minutes' => 15,
            'competitions.broadcast_max_hold_minutes' => 180, 'competitions.games_per_stream' => 8, 'competitions.kickoffs_per_hour' => 0]);
    }

    private function club(): OnlineClub
    {
        $club = app(OnlineService::class)->provision(User::factory()->create());
        $club->update(['tag' => 'T'.$club->id]);
        $templates = collect(app(OnlineService::class)->activeCatalog()->payload['cards'])->keyBy('id');
        $definitions = \App\Models\OwnedPlayerCard::whereIn('id', array_column($club->lineup, 'instance_id'))->get()
            ->mapWithKeys(fn ($p) => [$p->id => app(\App\Services\WorldPlayerProfiles::class)->definition($p, $templates[$p->definition_id])])->all();
        $orders = [];
        foreach (app(\App\Services\FpsPlayerArchitecture::class)->recommendedAssignments($definitions, \App\Services\FpsIdentityEngine::PLAN) as $id => $roles)
            $orders[$id] = array_merge($roles, ['instruction' => 'balanced', 'training' => 'system']);
        DB::table('fps_team_systems')->updateOrInsert(['club_id' => $club->id], ['revision' => 1, 'gameplan' => json_encode(\App\Services\FpsIdentityEngine::PLAN),
            'culture' => json_encode(\App\Services\FpsIdentityEngine::PLAN), 'instructions' => json_encode($orders), 'created_at' => now(), 'updated_at' => now()]);
        return $club;
    }

    /** An eight-club single-elimination event with its first round scheduled. */
    private function scheduledEvent(array $extraRules = []): ClubTournament
    {
        $definition = CompetitionDefinition::where('slug', 'vanguard-cup')->firstOrFail();
        $rules = ['capacity' => 8, 'minimum' => 8, 'stages' => [['format' => 'single_elimination', 'advance' => 1]],
            'qualification' => [['key' => 'open', 'method' => 'open', 'slots' => 8]]] + $extraRules;
        $event = ClubTournament::create(['definition_id' => $definition->id, 'scope' => 'test-'.uniqid(), 'name' => 'Stream Cup 2027', 'year' => 2027, 'tier' => null,
            'participant_type' => 'club', 'capacity' => 8, 'rules_version' => 1, 'regulations' => $rules, 'qualification' => $rules['qualification'], 'sponsors' => [],
            'registration_opens_at' => now()->subDay(), 'registration_closes_at' => now()->addDay(), 'starts_at' => now()->addDays(2), 'ends_at' => now()->addMonths(2),
            'semifinals_at' => now()->addDays(2), 'final_at' => now()->addMonths(2), 'champion_prize' => 0, 'runner_up_prize' => 0]);
        for ($i = 0; $i < 8; $i++) app(CompetitionQualification::class)->enter($event->id, 'club', $this->club()->id, ['method' => 'open']);
        $this->travelTo(now()->addDay()->addMinute());
        for ($tick = 0; $tick < 5 && ! $event->fixtures()->exists(); $tick++) app(CompetitionEngine::class)->advance($event->id);
        $this->assertSame(4, $event->fixtures()->count());
        return $event;
    }

    public function test_round_games_air_one_full_slot_apart_on_one_stream(): void
    {
        $fixtures = $this->scheduledEvent()->fixtures()->orderBy('kickoff_at')->get();
        $this->assertSame([0, 0, 0, 0], $fixtures->pluck('broadcast_stream')->all());
        foreach ($fixtures->slice(1)->values() as $i => $fixture)
            $this->assertSame(90, (int) $fixtures[$i]->kickoff_at->diffInMinutes($fixture->kickoff_at));
    }

    public function test_extra_streams_split_a_round_into_parallel_broadcasts(): void
    {
        $fixtures = $this->scheduledEvent(['broadcast_streams' => 2])->fixtures()->orderBy('bracket_slot')->get();
        $this->assertSame([0, 1, 0, 1], $fixtures->pluck('broadcast_stream')->all());
        $this->assertTrue($fixtures[0]->kickoff_at->eq($fixtures[1]->kickoff_at));
        $this->assertSame(90, (int) $fixtures[0]->kickoff_at->diffInMinutes($fixtures[2]->kickoff_at));
    }

    public function test_a_full_kickoff_hour_pushes_games_to_the_next_hour_with_room(): void
    {
        config(['competitions.kickoffs_per_hour' => 1]);
        [$a, $b] = [$this->club(), $this->club()];
        // The event's first kickoff hour (starts_at, 2027-01-03 00:00 UTC) already holds one game.
        ClubFixture::create(['home_club_id' => $a->id, 'away_club_id' => $b->id, 'competition' => 'Scrimmage',
            'kickoff_at' => CarbonImmutable::parse('2027-01-03T00:30:00Z'), 'orders_close_at' => CarbonImmutable::parse('2027-01-03T00:15:00Z')]);
        $this->assertTrue(ClubFixture::hourFull(CarbonImmutable::parse('2027-01-03T00:59:00Z')));
        $this->assertFalse(ClubFixture::hourFull(CarbonImmutable::parse('2027-01-03T01:00:00Z')));
        $this->assertSame('2027-01-03T01:10:00+00:00', ClubFixture::nextOpenKickoff(CarbonImmutable::parse('2027-01-03T00:10:00Z'))->toIso8601String());

        $fixtures = $this->scheduledEvent()->fixtures()->orderBy('kickoff_at')->get();
        $this->assertSame('2027-01-03T01:00:00+00:00', $fixtures[0]->kickoff_at->utc()->toIso8601String());
        $perHour = ClubFixture::all()->groupBy(fn ($f) => $f->kickoff_at->utc()->format('Y-m-d H'))->map->count();
        $this->assertSame(1, $perHour->max());
    }

    public function test_a_game_waits_off_air_until_the_previous_game_on_its_stream_ends(): void
    {
        [$first, $second] = $this->scheduledEvent()->fixtures()->orderBy('kickoff_at')->take(2)->get()->all();
        $matches = [];
        foreach ([$first, $second] as $fixture) {
            $this->travelTo($fixture->orders_close_at);
            (new LockClubFixture($fixture->id))->handle(app(OnlineService::class));
            $match = $fixture->fresh()->match;
            $plan = $match->plan; $plan['fps']['simulation_version'] = 5; // The live 3D engine (the suite pins version 4).
            $match->update(['plan' => $plan]);
            $matches[] = $match->fresh();
        }
        [$one, $two] = $matches;
        $one->update(['status' => 'running', 'on_air_at' => $first->kickoff_at]);

        // The second kickoff arrives while the first game is still on air: held, not watchable.
        $this->travelTo($second->kickoff_at->addMinute());
        $two->refresh();
        $this->assertTrue($two->isBeforeKickoff());
        $this->assertSame(0.0, $two->broadcastSecondsVisible());
        $this->assertNull($two->resolveOnAir());
        $this->assertNull($two->fresh()->on_air_at);

        // The first game ends 20 minutes after the second kickoff: on air after the 15-minute break.
        $this->travelTo($second->kickoff_at->addMinutes(20));
        $one->update(['status' => 'completed', 'completed_at' => now()]);
        $onAir = $two->fresh()->resolveOnAir();
        $this->assertSame($second->kickoff_at->addMinutes(35)->toIso8601String(), $onAir->toIso8601String());
        $this->assertTrue($two->fresh()->isBeforeKickoff());
        $this->travelTo($onAir->addSecond());
        $this->assertFalse($two->fresh()->isBeforeKickoff());
        $this->assertTrue($two->fresh()->broadcastStartsAt()->eq($onAir));
    }

    public function test_an_earlier_game_that_finished_in_time_does_not_delay_kickoff(): void
    {
        [$first, $second] = $this->scheduledEvent()->fixtures()->orderBy('kickoff_at')->take(2)->get()->all();
        foreach ([$first, $second] as $fixture) {
            $this->travelTo($fixture->orders_close_at);
            (new LockClubFixture($fixture->id))->handle(app(OnlineService::class));
            $match = $fixture->fresh()->match; $plan = $match->plan; $plan['fps']['simulation_version'] = 5; $match->update(['plan' => $plan]);
        }
        $first->fresh()->match->update(['status' => 'completed', 'completed_at' => $first->kickoff_at->addMinutes(45)]);
        $this->travelTo($second->kickoff_at);
        $two = $second->fresh()->match;
        $this->assertTrue($two->resolveOnAir()->eq($second->kickoff_at));
        $this->assertFalse($two->fresh()->isBeforeKickoff());
    }

    public function test_a_game_held_past_the_limit_goes_on_air_anyway(): void
    {
        [$first, $second] = $this->scheduledEvent()->fixtures()->orderBy('kickoff_at')->take(2)->get()->all();
        foreach ([$first, $second] as $fixture) {
            $this->travelTo($fixture->orders_close_at);
            (new LockClubFixture($fixture->id))->handle(app(OnlineService::class));
            $match = $fixture->fresh()->match; $plan = $match->plan; $plan['fps']['simulation_version'] = 5; $match->update(['plan' => $plan]);
        }
        $first->fresh()->match->update(['status' => 'running']);
        $this->travelTo($second->kickoff_at->addMinutes(181));
        $this->assertNotNull($second->fresh()->match->resolveOnAir());
    }
    public function test_live_fixtures_close_orders_fifteen_minutes_before_the_precompute_window(): void
    {
        config(['online.fps_simulation_version' => 4]);
        $this->assertSame(15, ClubFixture::ordersLeadMinutes());
        config(['online.fps_simulation_version' => 5, 'online.precompute_minutes' => 90]);
        $this->assertSame(105, ClubFixture::ordersLeadMinutes());
        foreach ($this->scheduledEvent()->fixtures()->get() as $fixture)
            $this->assertSame(105, (int) $fixture->orders_close_at->diffInMinutes($fixture->kickoff_at));
    }

    public function test_a_manager_can_override_the_default_lineup_and_switch_back(): void
    {
        $fixture = $this->scheduledEvent()->fixtures()->orderBy('kickoff_at')->firstOrFail();
        $club = OnlineClub::findOrFail($fixture->home_club_id);
        \Laravel\Sanctum\Sanctum::actingAs(User::findOrFail($club->user_id));
        $lineup = array_map(fn ($slot) => ['instance_id' => $slot['instance_id']], $club->starters ?? $club->lineup);
        $this->putJson("/api/v1/online/fixtures/{$fixture->id}/orders", ['lineup' => $lineup])->assertNoContent();
        $this->assertNotNull($fixture->fresh()->home_orders);
        $this->deleteJson("/api/v1/online/fixtures/{$fixture->id}/orders")->assertNoContent();
        $this->assertNull($fixture->fresh()->home_orders);
        $this->travelTo($fixture->orders_close_at->addMinute());
        $this->deleteJson("/api/v1/online/fixtures/{$fixture->id}/orders")->assertStatus(409);
    }
}
