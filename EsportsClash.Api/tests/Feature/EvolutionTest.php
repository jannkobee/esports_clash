<?php

namespace Tests\Feature;

use App\Models\BalanceProposal;
use App\Models\BalanceReview;
use App\Models\EvolutionRun;
use App\Models\EvolutionSetting;
use App\Models\User;
use App\Services\EvolutionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EvolutionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'), 'Tests must never inherit the deployment database');
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Queue::fake();
        EvolutionSetting::current();
    }

    private function owner(): User
    {
        $user = User::factory()->create();
        $user->forceFill(['is_evolution_admin' => true])->save();
        Sanctum::actingAs($user);
        return $user;
    }

    private function review(): BalanceReview
    {
        $run = EvolutionRun::create(['id' => (string) Str::uuid(), 'status' => 'completed', 'plan' => [],
            'result' => ['source_hash' => 'test-source', 'evaluation' => ['passes_exploratory_gate' => false]]]);
        return app(EvolutionService::class)->createReview($run);
    }

    private function option(BalanceReview $review, array $changes = []): BalanceProposal
    {
        $option = new BalanceProposal(['review_id' => $review->id, 'title' => 'Alternative test option',
            'changes' => $changes, 'evidence' => ['baseline_version' => $review->baseline_version],
            'evaluation' => ['passed' => true, 'kind' => $changes ? 'mechanical' : 'no-change']]);
        $option->manifest_hash = hash('sha256', json_encode($option->immutableManifest(), JSON_THROW_ON_ERROR));
        $option->save();
        return $option;
    }

    public function test_evolution_requires_authentication_and_designated_owner(): void
    {
        $this->getJson('/api/v1/evolution')->assertUnauthorized();
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/evolution')->assertForbidden();
        $this->postJson('/api/v1/evolution/runs')->assertForbidden();
        $this->putJson('/api/v1/evolution/settings', ['enabled' => false])->assertForbidden();
        $this->owner();
        $this->getJson('/api/v1/evolution')->assertOk()->assertJsonPath('data.capabilities.production_promotion', false);
    }

    public function test_training_allocates_disjoint_seeds_and_prevents_overlapping_runs(): void
    {
        $this->owner();
        $this->postJson('/api/v1/evolution/runs')->assertAccepted()->assertJsonPath('data.plan.seed_start', 20001);
        $this->postJson('/api/v1/evolution/runs')->assertUnprocessable();
        EvolutionRun::query()->update(['status' => 'completed']);
        $this->postJson('/api/v1/evolution/runs')->assertAccepted()->assertJsonPath('data.plan.seed_start', 21001);
        $this->assertDatabaseCount('evolution_runs', 2);
    }

    public function test_pausing_schedule_preserves_manual_training_and_existing_review_deadlines(): void
    {
        $this->owner();
        $review = $this->review();
        $deadline = $review->deadline_at->toIso8601String();
        $this->putJson('/api/v1/evolution/settings', ['enabled' => false, 'review_hours' => 24])->assertOk();
        $this->assertNull(app(EvolutionService::class)->startRun('scheduler', true));
        $this->assertSame($deadline, $review->fresh()->deadline_at->toIso8601String());
        $this->postJson('/api/v1/evolution/runs')->assertAccepted();
    }

    public function test_deadline_substitute_waits_then_records_its_selection_once(): void
    {
        $review = $this->review();
        $service = app(EvolutionService::class);
        $service->decide($review->id, 'select', null, 'substitute');
        $this->assertSame('open', $review->fresh()->status);
        $this->travel(49)->hours();
        $selected = $service->decide($review->id, 'select', null, 'substitute');
        $this->assertSame('selected', $selected->status);
        $this->assertSame('substitute', $selected->decided_by);
        $this->assertDatabaseHas('evolution_audits', ['subject_id' => $review->id, 'action' => 'review.select', 'actor' => 'substitute']);
        $this->expectException(ValidationException::class);
        $service->decide($review->id, 'select', null, 'substitute');
    }

    public function test_rejected_proposals_cannot_be_selected_by_substitute(): void
    {
        $this->owner();
        $review = $this->review();
        $id = $review->proposals->first()->id;
        $this->postJson('/api/v1/evolution/reviews/'.$review->id.'/decision', ['action' => 'reject', 'proposal_id' => $id])->assertOk();
        $this->travel(49)->hours();
        $result = app(EvolutionService::class)->decide($review->id, 'select', null, 'substitute');
        $this->assertSame('declined', $result->status);
        $this->assertNull($result->selected_proposal_id);
        $this->assertSame('rejected', $result->proposals->first()->status);
    }

    public function test_declining_batch_cannot_be_overridden_at_deadline(): void
    {
        $this->owner();
        $review = $this->review();
        $this->postJson('/api/v1/evolution/reviews/'.$review->id.'/decision', ['action' => 'decline'])->assertOk();
        $this->travel(49)->hours();
        $this->artisan('evolution:tick')->assertSuccessful();
        $this->assertSame('declined', $review->fresh()->status);
        $this->assertNotSame('substitute', $review->fresh()->decided_by);
    }

    public function test_multiple_options_allow_only_one_selection_and_close_alternatives(): void
    {
        $this->owner();
        $review = $this->review();
        $option = $this->option($review);
        $path = '/api/v1/evolution/reviews/'.$review->id.'/decision';
        $this->postJson($path, ['action' => 'select', 'proposal_id' => $option->id])->assertOk()->assertJsonPath('data.selected_proposal_id', $option->id);
        $this->assertSame('closed', $review->proposals->first()->fresh()->status);
        $this->postJson($path, ['action' => 'decline'])->assertUnprocessable();
        $this->assertSame('selected', $review->fresh()->status);
    }

    public function test_other_review_option_and_tampered_manifests_are_rejected(): void
    {
        $this->owner();
        $review = $this->review();
        $other = $this->review();
        $path = '/api/v1/evolution/reviews/'.$review->id.'/decision';
        $this->postJson($path, ['action' => 'select', 'proposal_id' => $other->proposals->first()->id])->assertUnprocessable();
        $proposal = $review->proposals->first();
        $proposal->update(['title' => 'Tampered']);
        $this->postJson($path, ['action' => 'select', 'proposal_id' => $proposal->id])->assertUnprocessable();
    }

    public function test_mechanical_patches_cannot_bypass_missing_release_validation(): void
    {
        $this->owner();
        $review = $this->review();
        $option = $this->option($review, [['target' => 'c_invoker', 'field' => 'hp', 'current' => 600, 'proposed' => 620]]);
        $this->postJson('/api/v1/evolution/reviews/'.$review->id.'/decision', ['action' => 'select', 'proposal_id' => $option->id])->assertUnprocessable();
    }

    public function test_deferral_and_duplicate_completion_are_persistent_and_idempotent(): void
    {
        $this->travelTo(now()->startOfSecond());
        $this->owner();
        $review = $this->review();
        $this->postJson('/api/v1/evolution/reviews/'.$review->id.'/decision', ['action' => 'defer', 'hours' => 72])->assertOk();
        $this->assertTrue($review->fresh()->deadline_at->equalTo(now()->addHours(72)));
        app(EvolutionService::class)->createReview(EvolutionRun::findOrFail($review->run_id));
        $this->assertDatabaseCount('balance_reviews', 1);
        $this->assertDatabaseCount('balance_proposals', 1);
    }
}
