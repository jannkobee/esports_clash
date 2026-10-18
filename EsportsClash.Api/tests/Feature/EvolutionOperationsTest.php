<?php

namespace Tests\Feature;

use App\Jobs\{MaintainEvolutionArtifacts, PollEvolutionRun};
use App\Models\{EvolutionRun, EvolutionSetting, User};
use App\Services\EvolutionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http, Queue};
use Illuminate\Support\Str;
use Tests\TestCase;

class EvolutionOperationsTest extends TestCase
{
    use RefreshDatabase;
    protected function setUp(): void { parent::setUp(); Queue::fake(); EvolutionSetting::current(); }

    public function test_only_owner_can_configure_or_execute_cleanup(): void
    {
        Http::preventStrayRequests();
        $this->post('/evolution/operations', ['action' => 'cleanup'])->assertRedirect('/login');
        $this->actingAs(User::factory()->create());
        $this->post('/evolution/operations', ['action' => 'cleanup'])->assertForbidden();
    }

    public function test_unsafe_budgets_unqualified_speed_and_concurrency_are_rejected(): void
    {
        $this->actingAs(User::factory()->create(['is_evolution_admin' => true]));
        Http::preventStrayRequests();
        foreach ([['evaluation_cases'=>17],['calibration_cases'=>15],['fit_cases'=>15],['speed'=>'8'],['workers'=>2],
            ['fit_cases'=>512,'calibration_cases'=>512]] as $data) {
            $this->post('/evolution/operations', ['action'=>'configure', ...$data])->assertSessionHasErrors();
        }
        Http::assertNothingSent();
    }

    public function test_policy_is_stored_frozen_into_new_plan_and_resource_pause_prevents_overlap(): void
    {
        $this->actingAs(User::factory()->create(['is_evolution_admin' => true]));
        Http::fake(['*operations/configure'=>Http::response(['fit_cases'=>40,'calibration_cases'=>24,'evaluation_cases'=>24,'speed'=>'headless'])]);
        $this->post('/evolution/operations', ['action'=>'configure','fit_cases'=>40,'speed'=>'headless'])->assertRedirect('/evolution');
        $service = app(EvolutionService::class);
        $run = $service->startRun('unit-owner');
        $this->assertSame(40, $run->plan['fit_cases']);
        $this->assertSame(2, $run->plan['version']);
        $this->assertFalse($run->plan['automatic_promotion']);
        $run->update(['status'=>'paused_resource']);
        $this->assertNull($service->startRun('scheduler', true));
        $this->assertDatabaseCount('evolution_runs', 1);
        $service->stopRun($run->id, 'unit-owner');
        $this->assertSame('stopping', $run->fresh()->status);
    }

    public function test_stop_with_existing_database_queue_lock_acquires_lock_after_service_transaction(): void
    {
        config(['cache.default' => 'database']);
        $run = EvolutionRun::create(['id' => (string) Str::uuid(), 'status' => 'running', 'plan' => []]);
        $job = new PollEvolutionRun($run->id);
        $lock = \Illuminate\Support\Facades\Cache::lock(\Illuminate\Bus\UniqueLock::getKey($job), 90);
        $this->assertTrue($lock->get());
        $levels = [];
        \Illuminate\Support\Facades\DB::listen(function ($query) use (&$levels) {
            if (str_contains($query->sql, 'cache_locks')) $levels[] = $query->connection->transactionLevel();
        });
        app(EvolutionService::class)->stopRun($run->id, 'unit-owner');
        $this->assertSame('stopping', $run->fresh()->status);
        $this->assertNotEmpty($levels);
        // RefreshDatabase owns level one; the service transaction is level two.
        // Unique-lock conflict handling must happen after the latter commits.
        $this->assertLessThanOrEqual(1, max($levels));
        Queue::assertNotPushed(PollEvolutionRun::class);
        $lock->release();
    }

    public function test_maintenance_preserves_owner_configuration_and_records_real_snapshot(): void
    {
        $settings = EvolutionSetting::current();
        $settings->update(['preferences'=>['operations'=>['storage_gib'=>20]]]);
        Http::fake(['*operations/reconcile'=>Http::response(['actual_storage_bytes'=>12345,'resources'=>['ml_anon_mib'=>42]])]);
        (new MaintainEvolutionArtifacts)->handle();
        $preferences = $settings->fresh()->preferences;
        $this->assertSame(20, $preferences['operations']['storage_gib']);
        $this->assertSame(12345, $preferences['operations_snapshot']['actual_storage_bytes']);
        $this->assertNotEmpty($preferences['operations_checked_at']);
    }

    public function test_late_worker_state_cannot_rewrite_completed_learning_evidence(): void
    {
        $run = EvolutionRun::create(['id'=>(string)Str::uuid(),'status'=>'running','plan'=>[]]);
        Http::fake(function ($request) use ($run) {
            if ($request->method() === 'POST') $run->update(['status'=>'completed','result'=>['source_hash'=>'immutable','evaluation'=>[]]]);
            return Http::response(['status'=>'running','progress'=>['completed'=>1]]);
        });
        (new PollEvolutionRun($run->id))->handle(app(EvolutionService::class));
        $this->assertSame('completed', $run->fresh()->status);
        $this->assertSame('immutable', $run->fresh()->result['source_hash']);
    }
}
