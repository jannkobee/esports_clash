<?php
namespace Tests\Feature;

use App\Models\{AvatarEvolutionRun,AvatarEvolutionSetting,AvatarPreparation,AvatarVisualRelease,AvatarEquipmentGeneration,TrellisGeneration,User};
use App\Services\{AvatarEvolutionService,AvatarRetentionService,TrellisGenerationService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{File,Http};
use Illuminate\Support\Str;
use Tests\TestCase;

class AvatarRetentionTest extends TestCase
{
    use RefreshDatabase;

    private string $temporaryStorage;
    private string $originalStorage;

    public function test_clean_base_and_failed_deformation_evidence_is_never_an_orphan(): void
    {
        $id=(string)Str::uuid();
        \App\Models\AvatarBaseCandidate::create(['id'=>$id,'avatar_id'=>'c_invoker','asset_epoch'=>'test-reset',
            'status'=>'animated_base_unqualified','report'=>['qualification'=>'failed'],
            'artifacts'=>['mirelle-base-animated.glb'=>['sha256'=>str_repeat('a',64),'bytes'=>1024]]]);
        Http::fake(['*'=>Http::response(['deleted'=>[],'skipped'=>[],'reclaimed_bytes'=>0])]);
        $protected=app(AvatarRetentionService::class)->computeProtected();
        $this->assertContains($id,$protected['keep']);
        $this->assertContains('base_candidate_evidence',$protected['reasons'][$id]);
        app(AvatarRetentionService::class)->maintain(dryRun:true);
        Http::assertSent(fn($request)=>$request->url()===app(AvatarEvolutionService::class)->endpoint('/retention')
            &&in_array($id,$request['keep'],true)&&!in_array($id,$request['delete'],true));
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->originalStorage = storage_path();
        $this->temporaryStorage = sys_get_temp_dir() . '/retention-test-' . Str::uuid();
        File::ensureDirectoryExists($this->temporaryStorage . '/logs');
        $this->app->useStoragePath($this->temporaryStorage);
    }

    protected function tearDown(): void
    {
        $this->app->useStoragePath($this->originalStorage);
        File::deleteDirectory($this->temporaryStorage);
        parent::tearDown();
    }

    public function test_retention_strictly_protects_releases_latest_drafts_reused_rigs_and_dependencies(): void
    {
        $activeRunId = (string) Str::uuid();
        $rollbackRunId = (string) Str::uuid();
        $reusedRigId = (string) Str::uuid();
        $latestDraftId = (string) Str::uuid();
        $sourceId = (string) Str::uuid();

        // Evolution runs for the releases
        AvatarEvolutionRun::create([
            'id' => $activeRunId,
            'avatar_id' => 'c_solana',
            'status' => 'complete',
            'plan' => ['version' => 2],
        ]);
        AvatarEvolutionRun::create([
            'id' => $rollbackRunId,
            'avatar_id' => 'c_solana',
            'status' => 'complete',
            'plan' => ['version' => 2],
        ]);

        // Active release
        AvatarVisualRelease::create([
            'id' => 10,
            'avatar_id' => 'c_solana',
            'variant' => 'current',
            'version' => 1,
            'run_id' => $activeRunId,
            'candidate_id' => 'candidate-01',
            'file' => 'candidate-01.glb',
            'sha256' => str_repeat('a', 64),
            'active' => true,
            'approved_by' => 'user:test',
            'validation' => ['passed' => true],
        ]);

        // Rollback release
        AvatarVisualRelease::create([
            'id' => 11,
            'avatar_id' => 'c_solana',
            'variant' => 'current',
            'version' => 2,
            'run_id' => $rollbackRunId,
            'candidate_id' => 'candidate-01',
            'file' => 'candidate-01.glb',
            'sha256' => str_repeat('b', 64),
            'active' => false,
            'approved_by' => 'user:test',
            'previous_release_id' => 10,
            'validation' => ['passed' => true],
        ]);

        // Source generation
        TrellisGeneration::create([
            'id' => $sourceId,
            'avatar_id' => 'c_solana',
            'status' => 'generated_unqualified',
            'plan' => ['seed' => 1234, 'reference_sha256' => str_repeat('c', 64)],
        ]);

        // Reused rig preparation
        AvatarPreparation::create([
            'id' => $reusedRigId,
            'generation_id' => $sourceId,
            'avatar_id' => 'c_solana',
            'status' => 'published',
            'plan' => ['provider' => 'unirig'],
        ]);

        // Latest ready draft preparation reusing the rig
        AvatarPreparation::create([
            'id' => $latestDraftId,
            'generation_id' => $sourceId,
            'avatar_id' => 'c_solana',
            'status' => 'ready',
            'plan' => [
                'provider' => 'unirig',
                'rig_reuse' => ['id' => $reusedRigId, 'sha256' => str_repeat('d', 64), 'bytes' => 1000],
                'baseline' => ['run_id' => $activeRunId, 'file' => 'candidate-01.glb', 'sha256' => str_repeat('a', 64)],
            ],
        ]);

        $service = app(AvatarRetentionService::class);
        $protected = $service->computeProtected();

        $this->assertContains($activeRunId, $protected['keep']);
        $this->assertContains($rollbackRunId, $protected['keep']);
        $this->assertContains($latestDraftId, $protected['keep']);
        $this->assertContains($reusedRigId, $protected['keep']);
        $this->assertArrayHasKey($activeRunId, $protected['reasons']);
        $this->assertArrayHasKey($reusedRigId, $protected['reasons']);
    }

    public function test_dry_run_reports_candidates_without_deleting(): void
    {
        $oldSourceId = (string) Str::uuid();
        TrellisGeneration::create([
            'id' => $oldSourceId,
            'avatar_id' => 'c_solana',
            'status' => 'generated_unqualified',
            'plan' => ['seed' => 1],
        ]);

        $obsoleteId = (string) Str::uuid();
        AvatarPreparation::create([
            'id' => $obsoleteId,
            'generation_id' => $oldSourceId,
            'avatar_id' => 'c_solana',
            'status' => 'failed',
            'plan' => [],
            'created_at' => now()->subDays(2),
        ]);

        // Delete the source to make the preparation orphaned
        TrellisGeneration::where('id', $oldSourceId)->delete();

        Http::fake([
            '*/retention' => Http::response([
                'deleted' => [],
                'skipped' => [$obsoleteId],
                'reclaimed_bytes' => 1500000,
            ]),
        ]);

        $service = app(AvatarRetentionService::class);
        $result = $service->maintain(dryRun: true);

        $this->assertTrue($result['dry_run']);
        $this->assertContains($obsoleteId, $result['deletable']);
        $this->assertNull(AvatarPreparation::find($obsoleteId)->artifacts_deleted_at);
        Http::assertSent(fn($r) => $r['apply'] === false);
    }

    public function test_real_cleanup_invokes_worker_and_records_artifacts_deleted_at(): void
    {
        $oldSourceId = (string) Str::uuid();
        TrellisGeneration::create([
            'id' => $oldSourceId,
            'avatar_id' => 'c_solana',
            'status' => 'generated_unqualified',
            'plan' => ['seed' => 1],
        ]);

        $obsoleteId = (string) Str::uuid();
        $prep = AvatarPreparation::create([
            'id' => $obsoleteId,
            'generation_id' => $oldSourceId,
            'avatar_id' => 'c_solana',
            'status' => 'failed',
            'plan' => [],
            'created_at' => now()->subDays(3),
        ]);

        TrellisGeneration::where('id', $oldSourceId)->delete();

        Http::fake([
            '*/retention' => Http::response([
                'deleted' => [$obsoleteId],
                'skipped' => [],
                'reclaimed_bytes' => 5000000,
            ]),
        ]);

        $service = app(AvatarRetentionService::class);
        $result = $service->maintain(dryRun: false, actor: 'test:owner');

        $this->assertFalse($result['dry_run']);
        $this->assertEquals([$obsoleteId], $result['deleted']);
        $this->assertNotNull($prep->fresh()->artifacts_deleted_at);
        Http::assertSent(fn($r) => $r['apply'] === true && in_array($obsoleteId, $r['delete']));
    }

    public function test_oversize_logs_are_truncated(): void
    {
        $logFile = storage_path('logs/laravel.log');
        File::put($logFile, str_repeat('X', 12 * 1024 * 1024)); // 12 MB

        $service = app(AvatarRetentionService::class);
        $service->truncateLogs();

        $this->assertLessThanOrEqual(1024 * 1024 + 100, filesize($logFile));
    }

    public function test_console_cleanup_command_supports_dry_run_and_force(): void
    {
        $this->actingAs(User::factory()->create(['is_evolution_admin' => true]));

        Http::fake([
            '*/retention' => Http::response([
                'deleted' => [],
                'skipped' => [],
                'reclaimed_bytes' => 0,
            ]),
        ]);

        $this->artisan('avatars:cleanup', ['--dry-run' => true])
            ->expectsOutputToContain('Dry-run storage cleanup report')
            ->assertExitCode(0);

        $this->artisan('avatars:cleanup', ['--force' => true])
            ->expectsOutputToContain('Storage cleanup applied successfully')
            ->assertExitCode(0);
    }
}
