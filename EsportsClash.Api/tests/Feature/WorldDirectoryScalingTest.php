<?php

namespace Tests\Feature;

use App\Models\OnlineClub;
use App\Models\OwnedPlayerCard;
use App\Models\User;
use App\Services\AvatarpediaService;
use App\Services\CompetitionCalendar;
use App\Services\OnlineService;
use App\Services\WorldPlayerProfiles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/** Hexapedia directories must stay bounded as the world grows to thousands of players. */
class WorldDirectoryScalingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->artisan('online:install-catalog')->assertSuccessful();
        app(CompetitionCalendar::class)->installDefaults();
        DB::table('world_player_settings')->where('id', 1)->update(['profile_version' => 1]);
        DB::table('fps_identity_settings')->where('id', 1)->update(['enabled' => true]);
        app(WorldPlayerProfiles::class)->invalidate();
    }

    private function club(): OnlineClub
    {
        $club = app(OnlineService::class)->provision(User::factory()->create());
        $club->update(['tag' => 'S'.$club->id]);

        return $club;
    }

    public function test_primed_profiles_match_unprimed_profiles(): void
    {
        $club = $this->club();
        $templates = collect(app(OnlineService::class)->activeCatalog()->payload['cards'])->keyBy('id');
        $players = OwnedPlayerCard::where('user_id', $club->user_id)->get();
        $plain = $players->mapWithKeys(fn ($p) => [$p->id => app(WorldPlayerProfiles::class)->definition($p, $templates[$p->definition_id])])->all();
        $profiles = app(WorldPlayerProfiles::class);
        $profiles->prime($players);
        foreach ($players as $player) {
            $this->assertEquals($plain[$player->id], $profiles->definition($player, $templates[$player->definition_id]));
        }
    }

    public function test_player_directory_queries_do_not_grow_with_the_page(): void
    {
        $this->club();
        $count = function (int $perPage): int {
            app()->forgetScopedInstances();
            DB::flushQueryLog();
            DB::enableQueryLog();
            $page = app(AvatarpediaService::class)->directory('players', '', 1, $perPage);
            DB::disableQueryLog();
            $this->assertNotEmpty($page['items']);

            return count(DB::getQueryLog());
        };
        $small = $count(1);
        foreach (range(1, 5) as $_) {
            $this->club();
        }
        $large = $count(30);
        $this->assertGreaterThan(20, OwnedPlayerCard::count());
        // Before batching every row added four queries (identity, club, orders, nationality).
        $this->assertLessThanOrEqual($small + 2, $large, "directory used {$large} queries for 30 rows vs {$small} for one");
    }

    public function test_tournament_directory_queries_do_not_grow_with_the_page(): void
    {
        $definition = \App\Models\CompetitionDefinition::where('slug', 'vanguard-cup')->firstOrFail();
        $rules = ['capacity' => 8, 'minimum' => 8, 'stages' => [['format' => 'single_elimination', 'advance' => 1]], 'qualification' => [['key' => 'open', 'method' => 'open', 'slots' => 8]]];
        foreach (range(1, 6) as $i) {
            \App\Models\ClubTournament::create(['definition_id' => $definition->id, 'scope' => 'scale-'.$i, 'name' => 'Scale Cup '.$i, 'year' => (int) now()->year, 'tier' => null, 'participant_type' => 'club', 'capacity' => 8, 'rules_version' => 1, 'regulations' => $rules, 'qualification' => $rules['qualification'], 'sponsors' => [],
                'registration_opens_at' => now()->subDay(), 'registration_closes_at' => now()->addDay(), 'starts_at' => now()->addDays(2), 'ends_at' => now()->addMonths(2), 'semifinals_at' => now()->addDays(2), 'final_at' => now()->addMonths(2), 'champion_prize' => 0, 'runner_up_prize' => 0]);
        }
        $count = function (int $perPage): array {
            app()->forgetScopedInstances();
            DB::flushQueryLog();
            DB::enableQueryLog();
            $page = app(AvatarpediaService::class)->directory('tournaments', '', 1, $perPage);
            DB::disableQueryLog();

            return [count(DB::getQueryLog()), count($page['items'])];
        };
        [$small] = $count(1);
        [$large, $rows] = $count(30);
        $this->assertGreaterThan(3, $rows, 'the default calendar installs several editions');
        $this->assertLessThanOrEqual($small + 4, $large, "tournament directory used {$large} queries for {$rows} rows vs {$small} for one");
    }
}
