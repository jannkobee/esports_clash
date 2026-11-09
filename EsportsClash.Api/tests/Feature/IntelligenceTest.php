<?php
namespace Tests\Feature;
use App\Models\{User,EvolutionRun,EvolutionSetting};
use App\Services\IntelligenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Queue,DB,Http};
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
class IntelligenceTest extends TestCase {
    use RefreshDatabase;
    protected function setUp():void{parent::setUp();Queue::fake();config(['evolution.worker_token'=>str_repeat('k',40)]);EvolutionSetting::current();}
    private function owner():void{$u=User::factory()->create();$u->forceFill(['is_evolution_admin'=>true])->save();Sanctum::actingAs($u);}
    public function test_owner_only_durable_allocation_is_idempotent_and_shared_with_legacy():void {
        $data=['request_id'=>(string)Str::uuid(),'domain'=>'marl'];
        $this->postJson('/api/v1/evolution/intelligence',$data)->assertUnauthorized();$this->owner();
        $first=$this->postJson('/api/v1/evolution/intelligence',$data)->assertAccepted()->json('data');
        $this->postJson('/api/v1/evolution/intelligence',$data)->assertAccepted()->assertJsonPath('data.id',$first['id']);
        $this->assertDatabaseCount('intelligence_seed_reservations',1);
        $receipt=$first['plan']['reservation'];$payload=base64_decode($receipt['payload']);
        $this->assertSame(hash_hmac('sha256',$payload,config('evolution.worker_token')),$receipt['signature']);
        $this->assertSame(56001,json_decode($payload,true)['first']);
        $this->postJson('/api/v1/evolution/runs')->assertUnprocessable();
        EvolutionRun::find($first['id'])->update(['status'=>'completed']);
        $this->postJson('/api/v1/evolution/runs')->assertAccepted()->assertJsonPath('data.plan.seed_start',57001);
    }
    public function test_pause_resume_preserves_plan_and_seed_reservation_and_cancellation():void {
        $this->owner();$run=app(IntelligenceService::class)->start(['request_id'=>(string)Str::uuid(),'domain'=>'parameter'],'test');
        $run->update(['status'=>'paused_budget']);$plan=$run->plan;
        $this->postJson('/api/v1/evolution/intelligence/'.$run->id.'/resume')->assertAccepted()->assertJsonPath('data.status','queued');
        $this->assertSame($plan,$run->fresh()->plan);$this->assertDatabaseCount('intelligence_seed_reservations',1);
        $run->update(['status'=>'paused_budget']);$this->deleteJson('/api/v1/evolution/runs/'.$run->id)->assertAccepted()->assertJsonPath('data.status','stopping');
    }
    public function test_unqualified_result_cannot_activate_or_corrupt_current_and_rollback_is_audited():void {
        $this->owner();$run=app(IntelligenceService::class)->start(['request_id'=>(string)Str::uuid(),'domain'=>'parameter'],'test');
        $run->update(['status'=>'completed']);Http::fake(['*'=>Http::response(['assessment'=>['status'=>'inconclusive']],200)]);
        $this->postJson('/api/v1/evolution/intelligence/'.$run->id.'/activate')->assertUnprocessable();
        $this->assertDatabaseCount('intelligence_releases',0);
        $this->getJson('/api/v1/intelligence-policy')->assertOk()->assertJsonPath('id',null);
        $this->postJson('/api/v1/evolution/intelligence/rollback',['policy_id'=>str_repeat('a',64)])->assertUnprocessable();
        $this->postJson('/api/v1/evolution/intelligence/rollback',[])->assertOk()->assertJsonPath('id',null);
        $this->assertDatabaseHas('evolution_audits',['action'=>'policy.rollback']);
    }
    public function test_qualified_version_is_immutable_and_activation_is_idempotent():void {
        $this->owner();$run=app(IntelligenceService::class)->start(['request_id'=>(string)Str::uuid(),'domain'=>'source'],'test');
        $run->update(['status'=>'completed']);$bytes=json_encode(['kind'=>'macro-program','version'=>1,'weights'=>array_fill(0,5,array_fill(0,20,0)),'bias'=>[0,0,0,0,0]],JSON_THROW_ON_ERROR);$id=hash('sha256',$bytes);
        Http::fake(['*'=>Http::response(['assessment'=>['status'=>'promote','independentSeeds'=>32,'extraTeamDeathCases'=>0,'winDelta'=>['lower'=>.1],'reasons'=>[]],
            'policy_bytes'=>base64_encode($bytes),'candidate'=>['hash'=>$id],'incumbent_id'=>null,'source_hash'=>str_repeat('b',64),'evidence_hash'=>'fixture'],200)]);
        app(IntelligenceService::class)->activate($run->id,'worker',internal:true);
        $this->assertSame($id,EvolutionSetting::current()->preferences['intelligence_champion']);
        $this->assertDatabaseCount('intelligence_releases',0);
        $this->postJson('/api/v1/evolution/intelligence/'.$run->id.'/activate')->assertOk()->assertJsonPath('id',$id);
        $this->postJson('/api/v1/evolution/intelligence/'.$run->id.'/activate')->assertOk();
        $this->assertDatabaseCount('intelligence_releases',1);$this->assertDatabaseCount('intelligence_policies',1);
        $this->getJson('/api/v1/intelligence-policy')->assertOk()->assertJsonPath('engine','safe-macro-v1')
            ->assertJsonPath('qualification','qualified')->assertJsonPath('id',$id);
        $this->postJson('/api/v1/evolution/intelligence/rollback',[])->assertOk();
        $this->postJson('/api/v1/evolution/intelligence/rollback',['policy_id'=>$id])->assertOk()->assertJsonPath('id',$id);
        DB::table('intelligence_policies')->where('id',$id)->update(['policy'=>'{}']);
        app(IntelligenceService::class)->monitor();
        $this->getJson('/api/v1/intelligence-policy')->assertJsonPath('id',null);
        $this->assertSame([$id],EvolutionSetting::current()->preferences['intelligence_quarantine']);
    }
    public function test_v3_reports_render_actual_scope_and_paused_jobs_cannot_be_deleted():void {
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $run=app(IntelligenceService::class)->start(['request_id'=>(string)Str::uuid(),'domain'=>'marl'],'test');
        $run->update(['status'=>'paused_budget']);
        $this->get('/evolution')->assertOk()->assertSee('Full-match learning');
        $this->get(route('evolution.report',$run))->assertOk()->assertSee('Full-match intelligence study');
        $this->assertFalse(app(\App\Services\ReportDeletionService::class)->canDelete('ml','paused_budget'));
    }
    public function test_arena_admission_checkpoint_preview_and_owner_rollback():void {
        $this->owner();$run=$this->postJson('/api/v1/evolution/intelligence',['request_id'=>(string)Str::uuid(),'domain'=>'arena'])
            ->assertAccepted()->assertJsonPath('data.plan.version',4)->assertJsonPath('data.plan.teaching.version',6)->json('data');
        $policy=['kind'=>'arena-actor','version'=>3,'input'=>224,'hidden'=>32,'w1'=>array_fill(0,32,array_fill(0,224,0)),
            'b1'=>array_fill(0,32,0),'w2'=>array_fill(0,32,0),'b2'=>0];
        $bytes=json_encode($policy,JSON_THROW_ON_ERROR);$id=hash('sha256',$bytes);
        Http::fake(['*'=>Http::response(['run_id'=>$run['id'],'hash'=>$id,'policy_bytes'=>base64_encode($bytes),
            'source_hash'=>str_repeat('d',64),'generation'=>1,'metrics'=>['updated'=>true,'transitions'=>20]],200)]);
        $this->getJson('/api/v1/intelligence-policy')->assertOk()->assertJsonPath('engine','arena-command-v1')
            ->assertJsonPath('qualification','learning')->assertJsonPath('id',$id)->assertJsonPath('policy.input',224);
        $this->assertDatabaseCount('intelligence_policies',0); // Preview is not qualification.
        $this->postJson('/api/v1/evolution/intelligence/rollback',[])->assertOk()->assertJsonPath('id',null);
        $this->getJson('/api/v1/intelligence-policy')->assertOk()->assertJsonPath('id',null);
        $model=EvolutionRun::findOrFail($run['id']);$model->update(['status'=>'paused_budget']);
        $this->postJson('/api/v1/evolution/intelligence/'.$run['id'].'/resume')->assertAccepted()->assertJsonPath('data.plan.version',4);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->get(route('evolution.report',$model))->assertOk()->assertSee('The detailed directions used for this study')
            ->assertSee('Discover strategy through actual matches')->assertSee('all three barracks')->assertSee('No independent improvement result')
            ->assertSee('Dawnna')->assertSee('Quakewell')->assertSee('Kegory')->assertSee('no avatar-specific reward weights')
            ->assertSee('terminal outcome of +5')->assertSee('0.9998')->assertSee('base clicking disappears immediately');
    }
    public function test_new_arena_study_keeps_compatible_experimental_progress_without_qualifying_it():void {
        $service=app(IntelligenceService::class);$old=$service->start(['request_id'=>(string)Str::uuid(),'domain'=>'arena'],'test');
        $old->update(['status'=>'completed']);
        $policy=['kind'=>'arena-actor','version'=>3,'input'=>224,'hidden'=>32,'w1'=>array_fill(0,32,array_fill(0,224,0.0)),
            'b1'=>array_fill(0,32,0.0),'w2'=>array_fill(0,32,0.0),'b2'=>0.0];
        $bytes=json_encode($policy,JSON_THROW_ON_ERROR|JSON_PRESERVE_ZERO_FRACTION);$id=hash('sha256',$bytes);
        $engine=json_decode(file_get_contents(resource_path('game/manifest.json')),true);
        Http::fake(['*'=>Http::response(['run_id'=>$old->id,'hash'=>$id,'policy_bytes'=>base64_encode($bytes),
            'source_hash'=>$engine['arena_source_hash'],'generation'=>1,'metrics'=>['updated'=>true,'transitions'=>20]],200)]);
        $next=$service->start(['request_id'=>(string)Str::uuid(),'domain'=>'arena'],'test');
        $this->assertSame(base64_encode($bytes),$next->plan['initialization']['policy_bytes']);
        $this->assertSame($id,$next->plan['initialization']['id']);$this->assertNull($next->plan['incumbent']);
        $this->assertDatabaseCount('intelligence_policies',0);
        $this->getJson('/api/v1/intelligence-policy')->assertOk()->assertJsonMissingPath('policy_bytes');
    }
    public function test_reward_breakdown_is_readable_and_does_not_claim_gameplay_improvement():void {
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $run=app(IntelligenceService::class)->start(['request_id'=>(string)Str::uuid(),'domain'=>'arena'],'test');
        $run->update(['status'=>'running','progress'=>['stage'=>'trained','generation'=>1,'metrics'=>[
            'updated'=>true,'transitions'=>250,'reward_version'=>'terminal-potential-outcomes-v2','reward_gamma_second'=>.9998,
            'reward_components'=>['outcome'=>0,'structures'=>.025,'health'=>-.01,'shaping'=>.015]]]]);
        $this->get(route('evolution.report',$run))->assertOk()->assertSee('Where this update')->assertSee('Actual terminal win or loss')
            ->assertSee('+0.02500')->assertSee('-0.01000')->assertSee('not win rates')->assertSee('No independent improvement result');
    }
    public function test_pausing_selected_intelligence_automation_does_not_start_a_legacy_study():void {
        EvolutionSetting::current()->update(['enabled'=>true,'next_training_at'=>now()->subMinute()]);
        $config=['enabled'=>false,'domain'=>'arena','max_minutes'=>30,'total_minutes'=>1440,'generations'=>2,'training_matches'=>4];
        app(IntelligenceService::class)->configure($config,'test');$this->artisan('evolution:tick')->assertSuccessful();
        $this->assertDatabaseCount('evolution_runs',0);
        app(IntelligenceService::class)->configure([...$config,'enabled'=>true],'test');$this->artisan('evolution:tick')->assertSuccessful();
        $this->assertSame(4,EvolutionRun::firstOrFail()->plan['version']);
    }
}
