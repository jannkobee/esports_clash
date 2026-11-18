<?php

namespace Tests\Feature;

use App\Jobs\LockClubFixture;
use App\Models\{ClubFixture, ClubTournament, OnlineClub, OnlineMatch, OwnedPlayerCard, User};
use App\Services\{ClubEconomy, ClubMarketService, ClubStaffService, CompetitionAutoInvites, CompetitionCalendar, FpsIdentityEngine, ManagerMail, OnlineService, OpponentScouting, ScoutingAssignments, SupporterBilling, TierReview, WorldPlayerProfiles};
use App\Notifications\ManagerMessage;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB, Notification, Queue};
use Laravel\Sanctum\Sanctum;
use Tests\Support\FpsWorkerResult;
use Tests\TestCase;

/** The manager loops from docs/proposals-20261118.md: results, debrief, training, email, fixtures, competitions, staff, economy, scouting, tiers, billing. */
class ManagerLoopsTest extends TestCase
{
    use RefreshDatabase, \Tests\Support\AssignsManagerRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assignManagerRolesOnSave();
        Queue::fake();
        $this->artisan('online:install-catalog')->assertSuccessful();
    }

    private function club(?string $tag = null): array
    {
        $user = User::factory()->create();
        $club = app(OnlineService::class)->provision($user);
        if ($tag) $club->update(['tag' => $tag]);
        return [$user, $club->fresh()];
    }

    /** A scheduled fixture, locked, allocated and settled with a verified blue win (16–0). */
    private function settledFixture(OnlineClub $home, OnlineClub $away, string $competition = 'Club Friendly'): array
    {
        $kickoff = now()->addMinutes(20);
        $fixture = ClubFixture::create(['home_club_id' => $home->id, 'away_club_id' => $away->id, 'competition' => $competition,
            'kickoff_at' => $kickoff, 'orders_close_at' => ClubFixture::ordersCloseAt($kickoff)]);
        $this->travelTo($kickoff->copy()->subMinutes(10));
        (new LockClubFixture($fixture->id))->handle(app(OnlineService::class));
        $match = $fixture->fresh()->match;
        $this->assertNotNull($match, 'The fixture was allocated.');
        app(OnlineService::class)->settle($match->id, FpsWorkerResult::forMatch($match), 1200);
        return [$fixture->fresh(), $match->fresh()];
    }

    public function test_results_carry_the_verified_outcome_score_and_count_as_verified(): void
    {
        [$homeUser, $home] = $this->club();
        [$awayUser, $away] = $this->club();
        [$fixture, $match] = $this->settledFixture($home, $away);

        $this->assertSame('blue', $match->verifiedWinner());
        $this->assertSame('blue', $fixture->result_winner);
        $this->assertSame(16, $fixture->result_score['blue']);
        $this->assertSame('win', $fixture->outcomeFor($home->id));
        $this->assertSame('loss', $fixture->outcomeFor($away->id));

        Sanctum::actingAs($homeUser);
        $row = collect($this->getJson('/api/v1/online/fixtures')->assertOk()->json('data'))->firstWhere('id', $fixture->id);
        $this->assertSame('win', $row['outcome']);
        $this->assertSame(16, $row['score']['blue']);
        $this->assertSame('blue', $row['side']);

        $history = $this->getJson('/api/v1/online/history')->assertOk()->json('data');
        $this->assertSame(1, $history['summary']['verified_games']);
        $this->assertSame(1, $history['summary']['wins']);
        $this->assertTrue($history['page']['data'][0]['verified']);
        $this->assertSame('win', $history['page']['data'][0]['outcome']);
        $this->assertSame('rounds', $history['page']['data'][0]['score_kind']);
    }

    public function test_the_debrief_shows_rounds_players_and_only_your_own_plan(): void
    {
        [$homeUser, $home] = $this->club();
        [$awayUser, $away] = $this->club();
        [$fixture] = $this->settledFixture($home, $away);

        Sanctum::actingAs($homeUser);
        $data = $this->getJson('/api/v1/online/fixtures/'.$fixture->id.'/debrief')->assertOk()->json('data');
        $this->assertSame('fps', $data['format']);
        $this->assertSame(['blue' => 16, 'red' => 0], $data['score']);
        $this->assertCount(16, $data['rounds']);
        $this->assertTrue($data['rounds'][0]['pistol']);
        $this->assertCount(10, $data['players']);
        $this->assertArrayHasKey('stats', $data['players'][0]);
        $this->assertArrayNotHasKey('avatar', $data['players'][0]);
        $this->assertSame('blue', $data['club']['side']);
        $this->assertCount(5, $data['club']['players']);
        $this->assertNotEmpty($data['club']['gameplan']);
        $this->assertStringNotContainsString('dna', strtolower(json_encode($data)));

        Sanctum::actingAs($awayUser);
        $this->assertSame('red', $this->getJson('/api/v1/online/fixtures/'.$fixture->id.'/debrief')->json('data.club.side'));
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/online/fixtures/'.$fixture->id.'/debrief')->assertForbidden();
    }

    public function test_reserves_earn_practice_xp_from_scrimmages_but_not_from_other_fixtures(): void
    {
        [, $home] = $this->club();
        [, $away] = $this->club();
        $reserve = OwnedPlayerCard::create(['id' => (string) \Illuminate\Support\Str::uuid(), 'user_id' => $home->user_id, 'catalog_id' => app(OnlineService::class)->activeCatalog()->id,
            'definition_id' => OwnedPlayerCard::findOrFail($home->lineup[0]['instance_id'])->definition_id, 'grant_key' => 'reserve-test']);
        [, $match] = $this->settledFixture($home, $away, 'Scrimmage');
        $practice = DB::table('club_training_sessions')->where('match_id', $match->id)->where('card_id', $reserve->id)->first();
        $this->assertNotNull($practice);
        $this->assertSame('practice', $practice->kind);
        $this->assertSame(10, DB::table('club_training_sessions')->where('match_id', $match->id)->where('kind', 'match')->count());
        $this->assertLessThan(DB::table('club_training_sessions')->where('match_id', $match->id)->where('kind', 'match')->value('xp'), $practice->xp);
    }

    public function test_a_training_focus_shapes_growth_without_changing_existing_values_or_total_growth(): void
    {
        config(['world_players.enabled' => true]);
        app(WorldPlayerProfiles::class)->invalidate();
        [, $club] = $this->club();
        $profiles = app(WorldPlayerProfiles::class);
        $player = OwnedPlayerCard::findOrFail($club->lineup[0]['instance_id']);
        $player->world_profile = array_replace($player->world_profile, ['stats' => array_fill_keys(WorldPlayerProfiles::ATTRIBUTES, 20), 'potential' => 80, 'training_baseline' => 0]);
        $player->training_xp = 160; // two steps earned before focused training existed
        $player->save();
        $before = $profiles->stats($player->fresh());
        $this->assertSame(22, $before['rifling']);

        $profiles->ensureAllocation($player->fresh());
        $this->assertSame($before, $profiles->stats($player->fresh()), 'Existing values are kept exactly.');

        $player->refresh();
        $player->increment('training_xp', 840); // 1000 XP: five steps in total, three new
        $changes = $profiles->allocateSteps($player->refresh(), 'utility');
        $after = $profiles->stats($player->refresh());
        $this->assertSame(22 + 3 * 3, $after['utility'], 'Three of every new step go to the focus.');
        $this->assertSame(array_sum($before) + 3 * WorldPlayerProfiles::STEP_POINTS, array_sum($after), 'Total growth equals even growth.');
        $this->assertSame(['from' => 3, 'to' => 4], $changes['utility'], 'Whole-level changes are reported.');
        $this->assertArrayNotHasKey('training_progress', $this->actingAsOwner($club)->getJson('/api/v1/online')->json('data.cards.0'));
    }

    private function actingAsOwner(OnlineClub $club): static
    {
        Sanctum::actingAs(User::findOrFail($club->user_id));
        return $this;
    }

    public function test_staff_learning_rates_are_neutral_without_a_snapshot_and_follow_ratings(): void
    {
        $neutral = ClubStaffService::learningRates(null);
        $this->assertSame(1.0, $neutral['system']);
        $this->assertSame(.8, $neutral['retention']);
        $strong = ClubStaffService::learningRates(['head_coach' => ['attributes' => ['tactics' => 10, 'adaptation' => 10, 'leadership' => 10, 'drafting' => 10]],
            'assistant_coach' => ['attributes' => ['preparation' => 10, 'flexibility' => 10, 'teamwork' => 10, 'communication' => 10]]]);
        $this->assertGreaterThan(1.0, $strong['system']);
        $this->assertGreaterThan(.8, $strong['retention']);
        $this->assertSame(3, OpponentScouting::analystDetail(1));
        $this->assertSame(9, OpponentScouting::analystDetail(10));
    }

    public function test_observed_team_tendencies_stay_empty_until_thresholds_are_met(): void
    {
        $scouting = app(OpponentScouting::class);
        $few = $scouting->teamTendencies([['matches' => 2, 'metrics' => ['engagement' => ['opportunities' => 40, 'attempts' => 20]]]]);
        $this->assertNull($few['categories']['opening'], 'Fewer than five recorded appearances: nothing is shown.');
        $enough = $scouting->teamTendencies(array_fill(0, 5, ['matches' => 1, 'metrics' => ['engagement' => ['opportunities' => 10, 'attempts' => 8], 'firstContact' => ['opportunities' => 2, 'attempts' => 1]]]));
        $this->assertEqualsWithDelta(80.0, $enough['categories']['opening'], .001, 'Only metrics past their opportunity threshold count.');
        $this->assertNull($enough['categories']['defense']);
    }

    public function test_fixture_maps_are_announced_and_fixture_plans_are_pinned(): void
    {
        config(['online.fps_simulation_version' => 5]);
        [$user, $home] = $this->club();
        [, $away] = $this->club();
        $kickoff = now()->addHours(4);
        $fixture = ClubFixture::create(['home_club_id' => $home->id, 'away_club_id' => $away->id, 'competition' => 'Club Friendly', 'kickoff_at' => $kickoff, 'orders_close_at' => ClubFixture::ordersCloseAt($kickoff)]);
        $this->assertContains($fixture->map_id, OnlineService::FPS_LIVE_MAPS);

        Sanctum::actingAs($user);
        $gameplan = ['tempo' => .9, 'structure' => .2, 'aggression' => .8, 'preparation' => .3, 'freedom' => .7, 'economy' => .4];
        $starter = $home->starters[0]['instance_id'];
        $this->putJson('/api/v1/online/fixtures/'.$fixture->id.'/orders', ['lineup' => $home->starters, 'plan' => ['gameplan' => $gameplan, 'instructions' => [$starter => 'initiative']]])->assertNoContent();
        $this->assertSame('initiative', $fixture->fresh()->home_plan['instructions'][$starter]);
        $row = collect($this->getJson('/api/v1/online/fixtures')->json('data'))->firstWhere('id', $fixture->id);
        $this->assertSame($fixture->map_id, $row['map']['id']);

        $pin = app(FpsIdentityEngine::class)->pin($home->starters, $away->starters, $home->user_id, $away->user_id,
            collect(app(OnlineService::class)->activeCatalog()->payload['cards'])->keyBy('id')->all(), ['blue' => $fixture->fresh()->home_plan]);
        $this->assertEqualsWithDelta(.9, $pin['teams']['blue']['plan']['tempo'], .001);
        $this->assertSame('initiative', $pin['players'][$starter]['instruction']);
        $this->assertSame(FpsIdentityEngine::PLAN, $pin['teams']['red']['plan'], 'The other club keeps its own plan.');

        $this->deleteJson('/api/v1/online/fixtures/'.$fixture->id.'/orders')->assertNoContent();
        $this->assertNull($fixture->fresh()->home_plan);
        $this->putJson('/api/v1/online/fixtures/'.$fixture->id.'/orders', ['lineup' => $home->starters, 'plan' => ['gameplan' => ['tempo' => 2]]])->assertUnprocessable();
    }

    public function test_opponent_report_is_lawful_and_limited_by_the_analyst(): void
    {
        [$user, $home] = $this->club();
        [, $away] = $this->club();
        $kickoff = now()->addHours(4);
        $fixture = ClubFixture::create(['home_club_id' => $home->id, 'away_club_id' => $away->id, 'competition' => 'Club Friendly', 'kickoff_at' => $kickoff, 'orders_close_at' => ClubFixture::ordersCloseAt($kickoff)]);
        Sanctum::actingAs($user);
        $data = $this->getJson('/api/v1/online/fixtures/'.$fixture->id.'/opponent')->assertOk()->json('data');
        $this->assertSame($away->id, $data['club']['id']);
        $this->assertCount(9, $data['tendencies']);
        $this->assertTrue(collect($data['tendencies'])->every(fn ($t) => $t['level'] === null), 'No recorded matches: every category is empty.');
        $this->assertSame(0, $data['head_to_head']['games']);
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/online/fixtures/'.$fixture->id.'/opponent')->assertForbidden();
    }

    public function test_manager_email_respects_categories_skips_bots_and_sends_each_event_once(): void
    {
        Notification::fake();
        [$user, $club] = $this->club('MAIL1');
        $mail = app(ManagerMail::class);
        $this->assertTrue($mail->send($user, 'results', 'event-1', 'Won 16–11', ['Line']));
        $this->assertFalse($mail->send($user, 'results', 'event-1', 'Won 16–11', ['Line']), 'Each event is sent once.');
        Sanctum::actingAs($user);
        $this->putJson('/api/v1/online/notifications', ['preferences' => ['results' => false]])->assertOk()->assertJsonPath('data.preferences.results', false);
        $this->assertFalse($mail->send($user, 'results', 'event-2', 'Lost', ['Line']));
        $this->assertTrue($mail->send($user, ManagerMail::ACCOUNT, 'event-3', 'Account', ['Line']), 'Account email cannot be switched off.');
        Notification::assertSentToTimes($user, ManagerMessage::class, 2);

        $token = DB::table('manager_email_preferences')->where('user_id', $user->id)->value('unsubscribe_token');
        $this->get('/api/v1/notifications/unsubscribe/'.$token.'?category=orders')->assertRedirect();
        $this->assertFalse($mail->preferences($user)['categories']['orders']);

        [, $bot] = $this->club('BOT1');
        $bot->update(['is_bot' => true]);
        $this->assertFalse($mail->send(User::findOrFail($bot->user_id), ManagerMail::ACCOUNT, 'bot-1', 'Never', ['Line']));

        // An inbox event of an emailing kind also emails the club's manager.
        app(\App\Services\ClubOffice::class)->notify($club->id, 'trade:9:received', 'market', 'Player trade proposal received', 'Review it.');
        Notification::assertSentToTimes($user, ManagerMessage::class, 3);
    }

    public function test_password_reset_and_email_verification(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'manager@example.com']);
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'manager@example.com'])->assertOk();
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@example.com'])->assertOk()->assertJsonPath('message', 'If that address has an account, a reset link is on its way.');
        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $n) use (&$token) { $token = $n->token; return true; });
        $user->createToken('old');
        $this->postJson('/api/v1/auth/reset-password', ['token' => $token, 'email' => 'manager@example.com', 'password' => 'a-new-long-password', 'password_confirmation' => 'a-new-long-password'])->assertOk();
        $this->assertSame(0, $user->tokens()->count(), 'Every session is signed out.');
        $this->postJson('/api/v1/auth/login', ['email' => 'manager@example.com', 'password' => 'a-new-long-password'])->assertOk()->assertJsonPath('user.email_verified', true);
        $this->postJson('/api/v1/auth/reset-password', ['token' => 'wrong', 'email' => 'manager@example.com', 'password' => 'another-long-password', 'password_confirmation' => 'another-long-password'])->assertUnprocessable();

        $fresh = User::factory()->create(['email_verified_at' => null]);
        $url = \Illuminate\Support\Facades\URL::temporarySignedRoute('api.verification.verify', now()->addHour(), ['id' => $fresh->id, 'hash' => sha1($fresh->email)]);
        $this->get($url)->assertRedirect();
        $this->assertTrue($fresh->fresh()->hasVerifiedEmail());
    }

    public function test_open_competitions_invite_every_eligible_club_and_a_decline_sticks(): void
    {
        $this->travelTo(CarbonImmutable::parse('2027-01-04T00:00:00Z'));
        app(CompetitionCalendar::class)->installDefaults();
        [$user, $club] = $this->club('INV1');
        [, $untagged] = $this->club();
        $definition = \App\Models\CompetitionDefinition::where('slug', 'vanguard-cup')->firstOrFail();
        $rules = ['capacity' => 8, 'minimum' => 2, 'stages' => [['format' => 'single_elimination', 'advance' => 1]], 'qualification' => [['key' => 'open', 'method' => 'open', 'slots' => 8]]];
        $edition = ClubTournament::create(['definition_id' => $definition->id, 'scope' => 'auto-invite-test', 'name' => 'Invite Cup', 'year' => 2027, 'tier' => null, 'participant_type' => 'club', 'capacity' => 8,
            'rules_version' => 1, 'regulations' => $rules, 'qualification' => $rules['qualification'], 'sponsors' => [], 'registration_opens_at' => now()->subDay(), 'registration_closes_at' => now()->addDays(2),
            'starts_at' => now()->addDays(3), 'ends_at' => now()->addMonth(), 'semifinals_at' => now()->addDays(3), 'final_at' => now()->addMonth(), 'champion_prize' => 0, 'runner_up_prize' => 0]);
        $invites = app(CompetitionAutoInvites::class);
        $this->assertSame(1, $invites->tick());
        $this->assertSame(0, $invites->tick(), 'One invitation per club and edition.');
        $this->assertDatabaseHas('club_inbox', ['club_id' => $club->id, 'event_key' => 'entry:'.$edition->id, 'kind' => 'entry']);
        $this->assertDatabaseMissing('club_inbox', ['club_id' => $untagged->id, 'kind' => 'entry']);

        Sanctum::actingAs($user);
        $week = $this->getJson('/api/v1/online/week')->assertOk()->json('data');
        $this->assertSame($edition->id, $week['invitations'][0]['id']);
        $this->postJson('/api/v1/online/invitations/'.$edition->id.'/decline')->assertNoContent();
        $this->assertSame([], $this->getJson('/api/v1/online/week')->json('data.invitations'));
        $this->assertSame(0, $invites->tick());
    }

    public function test_debt_warns_then_dismisses_only_an_inactive_manager_after_the_grace_period(): void
    {
        Notification::fake();
        [$user, $club] = $this->club('DEBT1');
        [$activeUser, $active] = $this->club('DEBT2');
        $economy = app(ClubEconomy::class);
        foreach ([$club, $active] as $c) DB::table('club_money_entries')->insert(['club_id' => $c->id, 'amount' => -app(ClubMarketService::class)->balance($c->id) - 3_000_000, 'kind' => 'Test debt', 'reference' => 'debt:'.$c->id, 'created_at' => now()]);
        $club->update(['manager_seen_at' => now()->subDays(30)]);
        $active->update(['manager_seen_at' => now()]);

        $first = $economy->reviewDebt();
        $this->assertSame(2, $first['warned']);
        $this->assertSame(1, $first['final'], 'Only the inactive manager deep in debt gets the final warning.');
        $this->assertNotNull($club->fresh()->dismissal_warned_at);
        $this->assertNull($active->fresh()->dismissal_warned_at);

        $this->travel(ClubEconomy::GRACE_DAYS + 1)->days();
        $active->update(['manager_seen_at' => now()]);
        $second = $economy->reviewDebt();
        $this->assertSame(1, $second['dismissed']);
        $club->refresh();
        $this->assertTrue($club->is_bot);
        $this->assertNotSame($user->id, $club->user_id);
        $this->assertSame(0, OwnedPlayerCard::where('user_id', $user->id)->count(), 'The players stay with the club.');
        $this->assertDatabaseHas('manager_dismissals', ['club_id' => $club->id, 'user_id' => $user->id]);
        $this->assertFalse($active->fresh()->is_bot, 'An active manager is never dismissed for debt alone.');
        Notification::assertSentTo($user, ManagerMessage::class, fn (ManagerMessage $m) => str_contains($m->subject, 'dismissed'));

        // The dismissed manager starts again with a new club.
        $this->assertNotSame($club->id, app(OnlineService::class)->provision($user->fresh())->id);
    }

    public function test_sponsor_seasons_top_up_finite_capital_once(): void
    {
        $economy = app(ClubEconomy::class);
        app(\App\Services\WorldSponsorships::class)->install();
        $this->assertSame(0, $economy->refillSponsors(), 'Founding capital already meets the target with no active clubs.');
        $id = DB::table('world_sponsors')->value('id');
        DB::table('world_sponsor_entries')->insert(['sponsor_id' => $id, 'reference' => 'spent', 'kind' => 'Reserved sponsorship', 'amount' => -5_000_000, 'created_at' => now()]);
        $this->assertSame(5_000_000, $economy->refillSponsors());
        $this->assertSame(0, $economy->refillSponsors(), 'Once per season.');
        $this->assertSame(ClubEconomy::SPONSOR_BASE_CAPITAL, app(\App\Services\WorldSponsorships::class)->balance($id));
    }

    public function test_scouting_returns_three_estimated_prospects_and_signs_one(): void
    {
        config(['world_players.enabled' => true]);
        app(WorldPlayerProfiles::class)->invalidate();
        [$user, $club] = $this->club('SCO1');
        Sanctum::actingAs($user);
        $before = app(ClubMarketService::class)->balance($club->id);
        $this->postJson('/api/v1/online/scouting', ['need' => 'awper'])->assertNoContent();
        $this->postJson('/api/v1/online/scouting', ['need' => 'igl'])->assertConflict();
        $this->assertSame($before - ScoutingAssignments::COST, app(ClubMarketService::class)->balance($club->id));
        $this->travel(ScoutingAssignments::SEARCH_HOURS + 1)->hours();
        $desk = $this->getJson('/api/v1/online/scouting')->assertOk()->json('data');
        $assignment = $desk['assignments'][0];
        $this->assertSame('ready', $assignment['status']);
        $this->assertCount(3, $assignment['shortlist']);
        $this->assertArrayNotHasKey('stats', $assignment['shortlist'][0], 'Exact attributes stay private until signed.');
        $this->assertArrayHasKey('sniping', $assignment['shortlist'][0]['estimates']);
        $count = OwnedPlayerCard::where('user_id', $user->id)->count();
        $this->postJson('/api/v1/online/scouting/'.$assignment['id'].'/sign', ['index' => 1])->assertOk();
        $this->assertSame($count + 1, OwnedPlayerCard::where('user_id', $user->id)->count());
        $this->assertDatabaseHas('scouting_assignments', ['id' => $assignment['id'], 'status' => 'signed']);
    }

    public function test_tier_review_relegates_as_many_clubs_as_were_promoted_and_protects_new_managers(): void
    {
        $review = app(TierReview::class);
        $this->assertTrue($review->run()['skipped'], 'The first review is a baseline.');
        $this->travel(ClubEconomy::SEASON_WEEKS)->weeks();
        $clubs = [];
        foreach (range(1, 4) as $i) { [, $c] = $this->club('TR'.$i); $c->update(['tier' => 3, 'is_bot' => true]); $clubs[] = $c->fresh(); }
        [, $newHuman] = $this->club('TRH');
        $newHuman->update(['tier' => 3]);
        app(CompetitionCalendar::class)->installDefaults();
        $event = ClubTournament::create(['definition_id' => \App\Models\CompetitionDefinition::query()->value('id'), 'scope' => 'ladder-test', 'name' => 'Trials', 'year' => (int) now()->year, 'tier' => 4, 'participant_type' => 'club',
            'capacity' => 8, 'rules_version' => 1, 'regulations' => ['ladder' => true], 'qualification' => [], 'sponsors' => [], 'registration_closes_at' => now()->subWeeks(2), 'starts_at' => now()->subWeeks(2),
            'ends_at' => now()->subWeek(), 'semifinals_at' => now()->subWeeks(2), 'final_at' => now()->subWeek(), 'champion_prize' => 0, 'runner_up_prize' => 0]);
        DB::table('club_tier_movements')->insert(['club_id' => $clubs[0]->id, 'tournament_id' => $event->id, 'from_tier' => 4, 'to_tier' => 3, 'earned_at' => now()->subWeeks(2)]);
        $this->travel(ClubEconomy::SEASON_WEEKS)->weeks();
        $result = $review->run();
        $this->assertSame(1, $result['relegated'], 'One promoted in, one relegated out.');
        $this->assertSame(3, $clubs[0]->fresh()->tier, 'The promoted club is protected.');
        $this->assertSame(1, collect($clubs)->filter(fn ($c) => $c->fresh()->tier === 4)->count());
        $this->assertSame(0, $review->run()['relegated'], 'Once per season.');
    }

    public function test_mock_checkout_activates_renews_and_cancels_a_membership(): void
    {
        Notification::fake();
        $user = User::factory()->create(['supporter_trial_ends_at' => null]);
        Sanctum::actingAs($user);
        $checkout = $this->postJson('/api/v1/online/billing/checkout', ['plan' => 'beacon'])->assertOk()->json('data');
        $this->assertTrue($checkout['test_mode']);
        $this->postJson('/api/v1/online/billing/checkout/'.$checkout['checkout_id'].'/mock', ['result' => 'paid'])->assertOk()->assertJsonPath('data.status', 'paid');
        $this->postJson('/api/v1/online/billing/checkout/'.$checkout['checkout_id'].'/mock', ['result' => 'paid'])->assertOk()->assertJsonPath('data.status', 'paid');
        $status = app(\App\Services\SupporterMembership::class)->status($user->fresh());
        $this->assertTrue($status['active']);
        $this->assertSame('beacon', $status['level']);
        $this->assertSame(1, DB::table('supporter_payments')->where('user_id', $user->id)->count());

        $this->travel(32)->days();
        $this->assertSame(1, app(SupporterBilling::class)->tick()['renewed']);
        $this->assertTrue(app(\App\Services\SupporterMembership::class)->status($user->fresh())['active']);
        $this->postJson('/api/v1/online/billing/cancel', ['cancel' => true])->assertOk()->assertJsonPath('data.subscription.cancel_at_period_end', true);
        $this->travel(32)->days();
        $this->assertSame(1, app(SupporterBilling::class)->tick()['ended']);
        $this->assertFalse(app(\App\Services\SupporterMembership::class)->status($user->fresh())['active']);
    }
}
