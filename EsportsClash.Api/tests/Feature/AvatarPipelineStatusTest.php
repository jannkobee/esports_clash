<?php
namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Cache,DB,Http};
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AvatarPipelineStatusTest extends TestCase {
    use RefreshDatabase;
    private function fakeStages(bool $production=false):void {
        Cache::flush();
        $cloud=['compute'=>['selected'=>'google','ready'=>true,'automatic_fallback'=>false],
            'engine_sha256'=>str_repeat('a',64),'runtime_ready'=>true,'models_ready'=>true];
        Http::fake([
            rtrim(config('avatars.trellis_url'),'/').'/operations'=>Http::response([...$cloud,'provider'=>'google-colab','models'=>['ready'=>true],'gpu_validated'=>true]),
            rtrim(config('avatars.trellis_url'),'/').'/rigging/operations'=>Http::response([...$cloud,'provider'=>'tokenrig','stages'=>['rigging']]),
            rtrim(config('avatars.unirig_url'),'/').'/operations'=>Http::response($production?[...$cloud,'provider'=>'unirig','stages'=>['rigging']]:['provider'=>'local-unirig','runtime_ready'=>true]),
            rtrim(config('avatars.worker_url'),'/').'/preparations/operations'=>Http::response($production?[...$cloud,'provider'=>'cloud-preparation','stages'=>['animation','qualification']]:['engine_sha256'=>str_repeat('b',64)]),
        ]);
    }
    public function test_owner_backoffice_and_api_return_the_same_readiness_contract():void {
        $this->fakeStages();
        $owner=User::factory()->create(['is_evolution_admin'=>true]);
        $this->actingAs($owner);
        $backoffice=$this->getJson('/evolution/avatars/preparation/readiness')->assertOk()->json('data');
        Sanctum::actingAs($owner);
        $api=$this->getJson('/api/v1/evolution/avatar-pipeline')->assertOk()->json('data');
        $this->assertSame($backoffice,$api);
        $this->assertFalse($api['ready_for_preparation']);
        $stages=collect($api['stages'])->keyBy('id');
        $this->assertTrue($stages['generation']['ready']);
        $this->assertTrue($stages['raw_rig_candidate']['connected']);
        $this->assertFalse($stages['raw_rig_candidate']['ready']);
        $this->assertFalse($stages['rigging']['ready']);
        Http::assertNotSent(fn($request)=>$request->method()!=='GET');
    }
    public function test_all_required_production_stages_are_needed_for_readiness():void {
        $this->fakeStages(true);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->getJson('/evolution/avatars/preparation/readiness')->assertOk()
            ->assertJsonPath('data.ready_for_preparation',true)
            ->assertJsonPath('data.automatic_fallback',false)
            ->assertJsonPath('data.owner_started_only',true);
        $this->assertDatabaseCount('avatar_preparations',0);
    }
    public function test_status_requires_the_owner_on_both_surfaces():void {
        Http::fake();
        $this->getJson('/api/v1/evolution/avatar-pipeline')->assertUnauthorized();
        $user=User::factory()->create(['is_evolution_admin'=>false]);
        $this->actingAs($user);
        $this->getJson('/evolution/avatars/preparation/readiness')->assertForbidden();
        Sanctum::actingAs($user);
        $this->getJson('/api/v1/evolution/avatar-pipeline')->assertForbidden();
        Http::assertNothingSent();
    }
    public function test_disconnected_stages_remain_blocked_without_queueing_jobs():void {
        Cache::flush();
        Http::fake(fn()=>Http::failedConnection());
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $snapshot=$this->getJson('/evolution/avatars/preparation/readiness')->assertOk()->json('data');
        $this->assertFalse($snapshot['ready_for_preparation']);
        foreach($snapshot['stages'] as $stage)$this->assertFalse($stage['ready']);
        $this->assertDatabaseCount('avatar_preparations',0);
    }
    public function test_unavailable_compute_or_models_cannot_be_reported_ready():void {
        Cache::flush();
        $cloud=['compute'=>['selected'=>'google','ready'=>false,'automatic_fallback'=>false],
            'engine_sha256'=>str_repeat('a',64),'runtime_ready'=>true,'models_ready'=>false,
            'models'=>['ready'=>true],'gpu_validated'=>true,'stages'=>['rigging','animation','qualification']];
        Http::fake(fn()=>Http::response($cloud));
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $snapshot=$this->getJson('/evolution/avatars/preparation/readiness')->assertOk()->json('data');
        foreach($snapshot['stages'] as $stage)$this->assertFalse($stage['ready']);
        $this->assertFalse($snapshot['ready_for_preparation']);
        foreach([
            [...$cloud,'compute'=>[...$cloud['compute'],'ready'=>true]],
            [...$cloud,'models_ready'=>true],
        ] as $unready) {
            try {
                \App\Services\AvatarPreparationService::requireCloudStage($unready,'rigging');
                $this->fail('Missing models or unavailable compute must reject admission as well as readiness.');
            } catch (\Illuminate\Validation\ValidationException $error) {
                $this->assertArrayHasKey('worker',$error->errors());
            }
        }
        $this->assertDatabaseCount('avatar_preparations',0);
    }
    public function test_candidate_inspector_displays_only_its_recorded_cloud_diagnostics():void {
        $id=(string)\Illuminate\Support\Str::uuid();
        $other=(string)\Illuminate\Support\Str::uuid();
        \App\Models\AvatarBaseCandidate::create(['id'=>$id,'avatar_id'=>'c_invoker','asset_epoch'=>'test-reset',
            'status'=>'animated_base_unqualified','report'=>[],
            'artifacts'=>['diagnostic-animated.glb'=>['sha256'=>str_repeat('a',64),'bytes'=>20]]]);
        foreach([[$id,'Recorded comparison for this exact source'],[$other,'Unrelated comparison must stay separate']] as [$candidateId,$summary]){
            DB::table('evolution_audits')->insert(['subject_id'=>(string)\Illuminate\Support\Str::uuid(),
                'action'=>'avatar.pipeline-diagnostic-completed','actor'=>'owner:test','created_at'=>now(),
                'details'=>json_encode(['plan'=>['source_candidate_id'=>$candidateId,'source_sha256'=>str_repeat('a',64)],
                    'summary'=>$summary,'comparisons'=>['Idle@0'=>['original'=>59,'right_chain_coherent_halfturn'=>0]]])]);
        }
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->get('/evolution/registry/avatars/c_invoker/base/'.$id)->assertOk()
            ->assertSee('Recorded comparison for this exact source')->assertDontSee('Unrelated comparison must stay separate')
            ->assertSee('right chain coherent halfturn')->assertSee('diagnostic-animated.glb')->assertSee('Time (seconds)');
    }
}
