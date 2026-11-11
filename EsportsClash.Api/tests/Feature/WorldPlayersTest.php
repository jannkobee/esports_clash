<?php

namespace Tests\Feature;

use App\Models\ClubAuction;
use App\Models\OnlineCatalog;
use App\Models\OnlineClub;
use App\Models\OwnedPlayerCard;
use App\Models\User;
use App\Services\BotClubManager;
use App\Services\ClubMarketService;
use App\Services\CompetitionCalendar;
use App\Services\OnlineService;
use App\Services\PlayerIgnGenerator;
use App\Services\WorldPlayerIdentity;
use App\Services\WorldPlayerProfiles;
use App\Services\WorldRosterReset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class WorldPlayersTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_managers_are_not_given_an_already_elite_bot_roster(): void
    {
        $this->enable();
        $bot = $this->club(true);
        OwnedPlayerCard::where('user_id', $bot->user_id)->increment('training_xp', 40000);
        $human = $this->club();
        $this->assertNotSame($bot->id, $human->id);
        $this->assertTrue($bot->fresh()->is_bot);
        $templates = collect(app(OnlineService::class)->activeCatalog()->payload['cards'])->keyBy('id');
        foreach (OwnedPlayerCard::where('user_id', $human->user_id)->get() as $player) {
            $this->assertLessThanOrEqual(36, app(WorldPlayerProfiles::class)->definition($player, $templates[$player->definition_id])['ovr']);
        }
    }

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->artisan('online:install-catalog')->assertSuccessful();
        app(CompetitionCalendar::class)->installDefaults();
    }

    private function enable(): void
    {
        DB::table('world_player_settings')->where('id', 1)->update(['profile_version' => 1]);
        app(WorldPlayerProfiles::class)->invalidate();
    }

    private function club(bool $bot = false): OnlineClub
    {
        $u = User::factory()->create();
        $c = app(OnlineService::class)->provision($u, $bot);
        $c->update(['tag' => 'C'.$c->id]);

        return $c;
    }

    public function test_ign_generator_has_bounded_original_gamer_names(): void
    {
        $g = app(PlayerIgnGenerator::class);
        $names = [];
        for ($i = 0; $i < 5000; $i++) {
            $n = $g->generate('identity-'.$i);
            $this->assertMatchesRegularExpression('/^[A-Za-z0-9]{3,16}$/D', $n);
            $this->assertLessThanOrEqual(16, strlen($n));
            $names[$n] = true;
        }
        // Admission, rather than this deterministic candidate generator, owns collision limits.
        $this->assertGreaterThan(2000, count(array_unique(array_map('strtolower',array_keys($names)))));
        $this->assertSame($g->generate('stable'), $g->generate('stable'));
    }

    public function test_new_starters_are_weak_original_and_have_birth_nationality(): void
    {
        $this->enable();
        $club = $this->club();
        $catalog = OnlineCatalog::where('active', true)->firstOrFail();
        $defs = collect($catalog->payload['cards'])->keyBy('id');
        foreach (OwnedPlayerCard::where('user_id', $club->user_id)->get() as $p) {
            $d = app(WorldPlayerProfiles::class)->definition($p, $defs[$p->definition_id]);
            $this->assertNull($p->original_identity);
            $this->assertNotContains($p->persona_name, $defs->pluck('name')->all());
            $this->assertNotNull($p->nationality_id);
            $this->assertGreaterThanOrEqual(18, min($d['stats']));
            $this->assertLessThanOrEqual(36, max($d['stats']));
            $this->assertLessThanOrEqual(36, $d['ovr']);
            $this->assertSame('Bronze', $d['tier']);
            $this->assertDatabaseHas('player_national_eligibilities', ['player_id' => $p->id, 'geography_id' => $p->nationality_id]);
            $this->assertNotEmpty($d['nationality']['name']);
        }
        $this->assertSame(5, OwnedPlayerCard::distinct()->count('persona_name'));
    }

    public function test_earned_training_changes_the_same_players_effective_skills(): void
    {
        $this->enable();
        $club = $this->club();
        $p = OwnedPlayerCard::where('user_id', $club->user_id)->firstOrFail();
        $template = collect(app(OnlineService::class)->activeCatalog()->payload['cards'])->firstWhere('id', $p->definition_id);
        $profiles = app(WorldPlayerProfiles::class);
        $before = $profiles->definition($p, $template);
        $p->increment('training_xp', 160);
        $after = $profiles->definition($p->fresh(), $template);
        $this->assertSame($before['stats']['lan'] + 2, $after['stats']['lan']);
        $this->assertSame($before['name'], $after['name']);
        $this->assertSame($before['nationality'], $after['nationality']);
    }

    public function test_profiles_are_pinned_in_allocation_and_do_not_rewrite_old_plans(): void
    {
        $this->enable();
        $a = $this->club();
        $b = $this->club();
        $online = app(OnlineService::class);
        $c = $online->activeCatalog();
        $m = $online->allocate($c, $a->user_id, $b->user_id, $online->validatedLineup($a->user_id, $a->lineup, $c), $online->validatedLineup($b->user_id, $b->lineup, $c), ['blue' => $a->name, 'red' => $b->name]);
        $this->assertSame(1, $m->plan['player_profile_schema']);
        $this->assertNull($m->plan['coach_id']);
        $this->assertCount(10, $m->plan['player_profiles']);
        $snapshot = $m->plan['player_profiles'];
        OwnedPlayerCard::query()->increment('training_xp', 1000);
        $this->assertSame($snapshot, $m->fresh()->plan['player_profiles']);
    }

    public function test_reset_archives_legacy_people_and_preserves_contract_history(): void
    {
        $club = $this->club();
        $old = OwnedPlayerCard::where('user_id', $club->user_id)->get();
        $oldNames = $old->pluck('persona_name', 'id')->all();
        $result = app(WorldRosterReset::class)->activate(false);
        $this->assertSame(5, $result['retired_legacy_players']);
        $this->assertSame(5, OwnedPlayerCard::where('user_id', $club->user_id)->count());
        foreach ($old as $p) {
            $retired = OwnedPlayerCard::withoutGlobalScopes()->findOrFail($p->id);
            $this->assertNotNull($retired->retired_at);
            $this->assertSame($oldNames[$p->id], $retired->persona_name);
        }
        $lineup = $club->fresh()->lineup;
        $this->assertEmpty(array_intersect(array_column($lineup, 'instance_id'), array_keys($oldNames)));
        $this->assertTrue(app(WorldRosterReset::class)->activate(false)['already_active']);
    }

    public function test_activation_refuses_worker_without_profile_capability(): void
    {
        Http::fake(['*' => Http::response(['status' => 'ok'], 200)]);
        $this->expectException(HttpException::class);
        app(WorldRosterReset::class)->activate();
    }

    public function test_manual_signing_is_gone_but_paid_youth_development_remains(): void
    {
        $this->enable();
        $club = $this->club();
        Sanctum::actingAs($club->user);
        $this->postJson('/api/v1/online/market/scout')->assertStatus(410);
        $this->putJson('/api/v1/online/market/academy', ['open' => true])->assertNoContent();
        $this->postJson('/api/v1/online/market/scout', ['academy' => true])->assertConflict();
        $this->travel(8)->days();
        $this->postJson('/api/v1/online/market/scout', ['academy' => true])->assertNoContent();
        $new = OwnedPlayerCard::where('user_id', $club->user_id)->where('grant_key', 'like', 'academy:%')->firstOrFail();
        $this->assertSame('academy', $new->world_profile['source']);
        $this->assertLessThanOrEqual(32, max($new->world_profile['stats']));
    }

    public function test_bot_review_is_idempotent_and_protects_payroll(): void
    {
        $this->enable();
        $bot = $this->club(true);
        $window = now()->startOfMinute()->subMinutes(now()->minute % 15)->toIso8601String();
        $manager = app(BotClubManager::class);
        $manager->run($bot->id, $window);
        $count = OwnedPlayerCard::where('user_id', $bot->user_id)->count();
        $balance = app(ClubMarketService::class)->balance($bot->id);
        $manager->run($bot->id, $window);
        $this->assertSame($count, OwnedPlayerCard::where('user_id', $bot->user_id)->count());
        $this->assertSame($balance, app(ClubMarketService::class)->balance($bot->id));
        $this->assertDatabaseCount('bot_club_plans', 1);
        $this->assertDatabaseCount('club_world_turns', 1);
        $this->assertGreaterThanOrEqual(app(ClubMarketService::class)->weeklyWages($bot->fresh()) * 4, $balance);
    }

    public function test_bots_bid_on_trained_people_even_when_their_role_archetype_is_owned(): void
    {
        $this->enable();
        $seller = $this->club();
        $bot = $this->club(true);
        $starter = OwnedPlayerCard::findOrFail($bot->lineup[0]['instance_id']);
        $reserve = OwnedPlayerCard::create(['id' => (string) Str::uuid(), 'user_id' => $seller->user_id, 'catalog_id' => $starter->catalog_id, 'definition_id' => $starter->definition_id, 'grant_key' => 'trained-transfer']);
        app(WorldPlayerIdentity::class)->assign($reserve, app(OnlineService::class)->activeCatalog(), false, 'scouting');
        $reserve->increment('training_xp', 40000);
        app(ClubMarketService::class)->list($seller, $reserve->id, 5000);
        $auction = ClubAuction::firstOrFail();
        app(BotClubManager::class)->run($bot->id, now()->startOfMinute()->subMinutes(now()->minute % 15)->toIso8601String());
        if($auction->fresh()->bidder_id===null && ($negotiation=DB::table('world_negotiations')->where('club_id',$bot->id)->where('player_id',$reserve->id)->where('kind','transfer_terms')->first())){
            // The living-world consent rule can require an employment discussion before a bid.
            app(\App\Services\WorldCareerContracts::class)->evaluate($negotiation->id);
            $this->travel(15)->minutes();
            app(BotClubManager::class)->run($bot->id,now()->startOfMinute()->subMinutes(now()->minute%15)->toIso8601String());
        }
        $this->assertSame($bot->id, $auction->fresh()->bidder_id);
        $this->assertSame(5000, $auction->fresh()->bid);
        $this->assertSame($seller->user_id, $reserve->fresh()->user_id);
    }

    public function test_reset_refunds_open_bids_and_keeps_the_auction_history(): void
    {
        $seller = $this->club();
        app(ClubMarketService::class)->scout($seller);
        $reserve = OwnedPlayerCard::where('user_id', $seller->user_id)->whereNotIn('id', array_column($seller->lineup, 'instance_id'))->firstOrFail();
        app(ClubMarketService::class)->list($seller, $reserve->id, 5000);
        $a = ClubAuction::firstOrFail();
        $buyer = $this->club();
        $terms=app(\App\Services\WorldCareerContracts::class);
        $offer=$terms->offerPlayer($buyer,$reserve,$terms->baseWage($reserve)*3,26,'rotation','test-reset-transfer-'.$reserve->id);
        $terms->evaluate($offer);
        app(ClubMarketService::class)->bid($buyer, $a->id, 5000);
        $held = app(ClubMarketService::class)->balance($buyer->id);
        app(WorldRosterReset::class)->activate(false);
        $this->assertSame($held + 5000, app(ClubMarketService::class)->balance($buyer->id));
        $this->assertSame('closed', $a->fresh()->status);
        $this->assertSame($reserve->id, $a->fresh()->card_id);
        $this->assertDatabaseCount('club_auctions', 1);
    }
}
