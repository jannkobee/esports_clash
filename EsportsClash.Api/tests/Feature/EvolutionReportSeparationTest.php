<?php

namespace Tests\Feature;

use App\Models\{AvatarEvolutionRun, EvolutionRun, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class EvolutionReportSeparationTest extends TestCase
{
    use RefreshDatabase;

    public function test_live_reload_client_renders_only_in_local_development(): void
    {
        config(['app.dev_vite_url' => 'http://localhost:8088']);
        $this->get('/login')->assertOk()->assertDontSee('http://localhost:8088/@vite/client', false);
        $this->app->instance('env', 'local');
        $this->get('/login')->assertOk()->assertSee('src="http://localhost:8088/@vite/client"', false);
    }

    public function test_report_archives_and_downloads_require_owner_access(): void
    {
        $model = AvatarEvolutionRun::create(['id' => (string) Str::uuid(), 'avatar_id' => 'c_invoker', 'plan' => []]);
        $paths = ['/evolution/ml/reports', '/evolution/avatars/reports', '/evolution/avatars/'.$model->id.'/download'];
        foreach ($paths as $path) $this->get($path)->assertRedirect('/login');
        $this->actingAs(User::factory()->create());
        foreach ($paths as $path) $this->get($path)->assertForbidden();
    }

    public function test_ml_and_model_archives_never_mix_evidence_and_paginate_history(): void
    {
        $this->actingAs(User::factory()->create(['is_evolution_admin' => true]));
        $ml = EvolutionRun::create(['id' => (string) Str::uuid(), 'status' => 'completed', 'plan' => [],
            'progress' => ['stage' => 'ML-only-evidence'], 'result' => []]);
        for ($i = 0; $i < 21; $i++) {
            AvatarEvolutionRun::create(['id' => (string) Str::uuid(), 'avatar_id' => 'c_invoker', 'status' => 'review',
                'plan' => ['avatar' => ['name' => '<script>model-only-evidence</script>']],
                'report' => ['stage' => 'Model-only-geometry', 'candidates' => []], 'decisions' => []]);
        }
        $model = AvatarEvolutionRun::firstOrFail();
        $this->get('/evolution/ml/reports')->assertOk()->assertSee('ML-only-evidence')->assertDontSee('Model-only-geometry')
            ->assertHeader('Cache-Control', 'no-store, private')->assertDontSee('Start learning cycle');
        $this->get('/evolution/avatars/reports')->assertOk()->assertSee('Model-only-geometry')->assertDontSee('ML-only-evidence')
            ->assertSee('&lt;script&gt;model-only-evidence&lt;/script&gt;', false)->assertDontSee('<script>model-only-evidence</script>', false)
            ->assertSee('Page 1 of 2')->assertHeader('Cache-Control', 'no-store, private');
        $this->get('/evolution/avatars/reports?page=2')->assertOk()->assertSee('Page 2 of 2');
        $this->get('/evolution/avatars/'.$model->id.'/download')->assertOk()->assertJsonPath('type', 'avatar-model')
            ->assertJsonPath('report.stage', 'Model-only-geometry')
            ->assertHeader('Content-Disposition', 'attachment; filename="model-report-'.$model->id.'.json"');
        $this->get('/evolution/runs/'.$model->id)->assertNotFound();
        $this->get('/evolution/avatars/'.$ml->id)->assertNotFound();
        $this->assertDatabaseCount('avatar_visual_releases', 0);
    }
}
