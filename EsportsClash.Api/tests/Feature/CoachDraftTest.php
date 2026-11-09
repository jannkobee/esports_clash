<?php

namespace Tests\Feature;

use App\Models\{OnlineCatalog, OnlineClub, OnlineMatch, User};
use App\Services\OnlineService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CoachDraftTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->artisan('online:install-catalog')->assertSuccessful();
    }

    private function account(): User
    {
        return User::factory()->create();
    }

    public function test_club_staff_is_persistent_and_has_bounded_attributes(): void
    {
        $user = $this->account();
        $club = app(OnlineService::class)->provision($user);

        $this->assertCount(5, \App\Models\ClubStaff::where('club_id', $club->id)->get());
        foreach (app(\App\Services\ClubStaffService::class)->roster($club) as $member) {
            $this->assertNotEmpty($member['name']);
            $this->assertNotEmpty($member['attributes']);
            foreach ($member['attributes'] as $value) {
                $this->assertGreaterThanOrEqual(1, $value);
                $this->assertLessThanOrEqual(10, $value);
            }
        }
        $performanceCoach = \App\Models\ClubStaff::where('club_id', $club->id)->where('role', 'performance_coach')->firstOrFail();
        $performanceCoach->update(['ratings' => [
            'conditioning' => 10, 'recovery' => 10, 'development' => 10, 'load_management' => 10,
        ]]);
        $this->assertSame(13, app(\App\Services\ClubStaffService::class)->trainingBonusPercent($club));
        $this->assertSame(
            app(\App\Services\ClubStaffService::class)->roster($club),
            app(\App\Services\ClubStaffService::class)->roster($club->fresh()),
        );
    }

    public function test_manager_cannot_submit_avatar_picks_and_staff_draft_is_pinned_before_match(): void
    {
        $online = app(OnlineService::class);
        $blueUser = $this->account();
        $redUser = $this->account();
        $blue = $online->provision($blueUser);
        $red = $online->provision($redUser);
        $catalog = OnlineCatalog::where('active', true)->firstOrFail();
        $firstAvatar = $catalog->payload['avatars'][0]['id'];

        Sanctum::actingAs($blueUser);
        $this->putJson('/api/v1/online/club', [
            'revision' => $blue->revision,
            'lineup' => array_map(fn (array $slot): array => [
                'instance_id' => $slot['instance_id'],
                'avatar_id' => $firstAvatar,
            ], $blue->starters),
        ])->assertUnprocessable();

        $online->queue($blueUser);
        $match = $online->queue($redUser)['match'];
        $match = OnlineMatch::findOrFail($match->id);
        $this->assertArrayHasKey('staff', $match->plan);
        $this->assertArrayHasKey('coaches', $match->plan);
        $this->assertSame(5, count($match->plan['blue']));
        $this->assertSame(5, count($match->plan['red']));
        $this->assertCount(5, array_unique(array_column($match->plan['blue'], 'avatar_id')));
        $this->assertCount(5, array_unique(array_column($match->plan['red'], 'avatar_id')));
        foreach (['blue', 'red'] as $side) {
            $this->assertSame(
                array_column($side === 'blue' ? $blue->starters : $red->starters, 'instance_id'),
                array_column($match->plan[$side], 'instance_id'),
            );
            $this->assertNotEmpty($match->plan['coaches'][$side]['style']);
        }
    }

    public function test_staff_endpoint_explains_manager_and_coach_responsibilities(): void
    {
        Sanctum::actingAs($this->account());
        $this->getJson('/api/v1/online/staff')->assertOk()
            ->assertJsonPath('data.draft_policy.starter_selection', 'manager')
            ->assertJsonPath('data.draft_policy.avatar_selection', 'staff')
            ->assertJsonCount(5, 'data.staff');
    }
}
