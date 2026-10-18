<?php

namespace Tests\Feature;

use App\Models\{EvolutionRun, EvolutionSetting, User};
use App\Services\EvolutionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class EvolutionDashboardTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create(['is_evolution_admin' => true]);
    }

    public function test_dashboard_redirects_guests_and_native_owner_login_logs_out(): void
    {
        $owner = $this->owner();
        $owner->update(['password' => 'local-test-owner-password']);
        $this->get('/')->assertRedirect('/evolution');
        $this->get('/evolution')->assertRedirect('/login');
        $this->get('/evolution/live')->assertRedirect('/login');
        $this->get('/login')->assertOk()->assertSee('Owner email')->assertSee('name="_token"', false);
        $this->post('/login', ['email' => $owner->email, 'password' => 'wrong'])->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->post('/login', ['email' => $owner->email, 'password' => 'local-test-owner-password'])->assertRedirect('/evolution');
        $this->assertAuthenticatedAs($owner);
        $this->get('/evolution')->assertOk()->assertSee('Machine learning reports')->assertSee('Schedule &amp; review window', false);
        $this->post('/logout')->assertRedirect('/login');
        $this->assertGuest();
        $this->get('/evolution')->assertRedirect('/login');
    }

    public function test_regular_accounts_cannot_login_as_owner_or_read_or_change_the_dashboard(): void
    {
        $user = User::factory()->create(['password' => 'regular-test-password']);
        $this->post('/login', ['email' => $user->email, 'password' => 'regular-test-password'])->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->actingAs($user);
        $this->get('/evolution')->assertForbidden();
        $this->get('/evolution/live')->assertForbidden();
        $this->post('/evolution/settings', ['enabled' => false])->assertForbidden();
        $this->post('/evolution/runs')->assertForbidden();
        $run = EvolutionRun::create(['id' => (string) Str::uuid(), 'plan' => []]);
        $this->get('/evolution/runs/'.$run->id)->assertForbidden();
        $this->get('/evolution/runs/'.$run->id.'/download')->assertForbidden();
        $this->post('/evolution/reviews/'.Str::uuid().'/decision', ['action' => 'decline'])->assertForbidden();
    }

    public function test_reports_show_real_metrics_escape_data_and_download_stored_evidence(): void
    {
        $run = EvolutionRun::create(['id' => (string) Str::uuid(), 'status' => 'completed', 'plan' => ['seed_start' => 21001],
            'progress' => ['stage' => 'complete', 'completed' => 80, 'planned' => 80],
            'result' => ['candidate_hash' => 'test-candidate', 'evaluation' => ['valid' => 21, 'changed' => 5,
                'prediction_loss' => 0.0123, 'zero_prediction_loss' => 0.02, 'passes_exploratory_gate' => false,
                'reason' => '<script>bad()</script>']]]);
        $this->get('/evolution/runs/'.$run->id)->assertRedirect('/login');
        $this->actingAs($this->owner());
        $this->get('/evolution')->assertOk()->assertSee('80 / 80 planned worlds')->assertDontSee('<script>bad()</script>', false);
        $this->get('/evolution/live')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->get('/evolution/runs/'.$run->id)->assertOk()->assertSee('0.01230')->assertSee('Not passed')
            ->assertSee('&lt;script&gt;bad()&lt;/script&gt;', false)->assertDontSee('<script>bad()</script>', false);
        $this->get('/evolution/runs/'.$run->id.'/download')->assertOk()
            ->assertJsonPath('plan.seed_start', 21001)->assertJsonPath('result.evaluation.valid', 21)
            ->assertHeader('Content-Disposition', 'attachment; filename="learning-report-'.$run->id.'.json"');
    }

    public function test_owner_forms_reuse_persistent_schedule_and_review_locks(): void
    {
        Queue::fake();
        $this->actingAs($this->owner());
        $this->post('/evolution/settings', ['review_hours' => 0])->assertSessionHasErrors('review_hours');
        $this->post('/evolution/settings', ['review_hours' => 72, 'training_interval_minutes' => 360])->assertRedirect('/evolution');
        $this->assertSame(72, EvolutionSetting::current()->review_hours);
        $this->post('/evolution/runs')->assertRedirect('/evolution');
        $run = EvolutionRun::firstOrFail();
        $this->post('/evolution/runs')->assertSessionHasErrors('run');
        $this->assertDatabaseCount('evolution_runs', 1);
        $this->post('/evolution/runs/'.$run->id.'/stop')->assertRedirect('/evolution');
        $this->assertSame('stopping', $run->fresh()->status);
        $run->update(['status' => 'completed', 'result' => []]);
        $review = app(EvolutionService::class)->createReview($run);
        $this->post('/evolution/reviews/'.$review->id.'/decision', ['action' => 'decline'])->assertRedirect('/evolution');
        $this->post('/evolution/reviews/'.$review->id.'/decision', ['action' => 'select', 'proposal_id' => $review->proposals->first()->id])->assertSessionHasErrors('review');
        $this->assertSame('declined', $review->fresh()->status);
        $this->assertDatabaseHas('evolution_audits', ['action' => 'settings.updated']);
    }
}
