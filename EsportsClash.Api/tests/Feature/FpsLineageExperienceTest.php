<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FpsLineageExperienceTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'test-writer-token-0123456789abcdef0123';

    private function club(User $user): int
    {
        return DB::table('online_clubs')->insertGetId(['user_id' => $user->id, 'name' => 'Test Club '.$user->id, 'lineup' => '[]', 'created_at' => now(), 'updated_at' => now()]);
    }

    private function body(string $ref = 'match-0001', array $observed = ['opponentAttacked' => true, 'plantSite' => 'B', 'earlyRush' => false]): array
    {
        return ['match_ref' => $ref, 'map' => 'fontessa', 'rounds' => [
            ['round' => 1, 'side' => 'defense', 'play_id' => 'seed:stack_b', 'won' => true, 'opponent' => 'club:99', 'observed' => $observed],
            ['round' => 2, 'side' => 'defense', 'play_id' => 'v:abc123', 'won' => false],
        ]];
    }

    public function test_managers_submit_only_for_their_own_club_and_matches_are_deduplicated(): void
    {
        $owner = User::factory()->create(); $other = User::factory()->create();
        $club = $this->club($owner); $this->club($other);
        $uri = "/api/v1/fps/lineages/club:{$club}/experience";
        $this->postJson($uri, $this->body())->assertUnauthorized();
        Sanctum::actingAs($other);
        $this->postJson($uri, $this->body())->assertForbidden();
        Sanctum::actingAs($owner);
        $this->postJson('/api/v1/fps/lineages/worker:main/experience', $this->body())->assertForbidden();
        $this->postJson($uri, $this->body())->assertCreated()->assertJsonPath('accepted', true);
        $this->postJson($uri, $this->body())->assertOk()->assertJsonPath('accepted', false);
        $this->assertSame(1, DB::table('fps_lineage_experience')->count());
        $this->assertThrows(fn () => DB::table('fps_lineage_experience')->delete(), \Throwable::class);
    }

    public function test_unlawful_or_malformed_experience_is_refused(): void
    {
        $owner = User::factory()->create(); $club = $this->club($owner);
        Sanctum::actingAs($owner);
        $uri = "/api/v1/fps/lineages/club:{$club}/experience";
        $this->postJson($uri, $this->body('match-0002', ['opponentPlayId' => 'seed:rush_b']))->assertStatus(422);
        $bad = $this->body('match-0003'); $bad['rounds'][0]['play_id'] = 'rush_b';
        $this->postJson($uri, $bad)->assertStatus(422);
        $big = $this->body('match-0004'); $big['utility'] = [['pad' => str_repeat('x', 300000)]];
        $this->postJson($uri, $big)->assertStatus(413);
        $this->assertSame(0, DB::table('fps_lineage_experience')->count());
    }

    public function test_the_worker_pulls_pending_experience_in_order_with_its_token(): void
    {
        config(['automatic_learning.writer_token' => self::TOKEN]);
        $owner = User::factory()->create(); $club = $this->club($owner);
        Sanctum::actingAs($owner);
        $this->postJson("/api/v1/fps/lineages/club:{$club}/experience", $this->body('match-1001'))->assertCreated();
        $this->postJson("/api/v1/fps/lineages/club:{$club}/experience", $this->body('match-1002'))->assertCreated();
        $this->getJson('/api/v1/fps/lineage-experience')->assertUnauthorized();
        $rows = $this->withHeaders(['Authorization' => 'Bearer '.self::TOKEN])->getJson('/api/v1/fps/lineage-experience?after=0')->assertOk()->json('experience');
        $this->assertSame(['match-1001', 'match-1002'], array_column($rows, 'match_ref'));
        $this->assertSame("club:{$club}", $rows[0]['lineage']);
        $this->assertSame('seed:stack_b', $rows[0]['payload']['rounds'][0]['play_id']);
        $later = $this->withHeaders(['Authorization' => 'Bearer '.self::TOKEN])->getJson('/api/v1/fps/lineage-experience?after='.$rows[0]['id'])->json('experience');
        $this->assertSame(['match-1002'], array_column($later, 'match_ref'));
    }
}
