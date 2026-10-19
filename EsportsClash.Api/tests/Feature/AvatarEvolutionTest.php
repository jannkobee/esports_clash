<?php
namespace Tests\Feature;
use App\Models\{AvatarEvolutionRun,AvatarEvolutionSetting,AvatarVisualRelease,User};
use App\Services\AvatarEvolutionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http,Queue};
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class AvatarEvolutionTest extends TestCase
{
    use RefreshDatabase;
    protected function setUp():void { parent::setUp();Queue::fake();config(['avatars.engine_ready'=>true]);AvatarEvolutionSetting::current(); }
    private function owner():User { $user=User::factory()->create(['is_evolution_admin'=>true]);$this->actingAs($user);return $user; }
    private function completed(?callable $change=null,string $hash='a'):AvatarEvolutionRun
    {
        // Arithmetic/security fixture only. Real generated assets and renderer
        // measurements are independently verified in the Docker pilot.
        $service=app(AvatarEvolutionService::class);$meta=collect($service->catalog())->firstWhere('id','c_invoker');
        $profile=$service->profiles()['c_invoker'];$ph=hash('sha256',json_encode($profile,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE));
        $parent=AvatarVisualRelease::where('active',true)->first();
        $render=['passed'=>true,'worker_memory'=>['anonymous_mib'=>300],'previews'=>[],'gameplay'=>['passed'=>true],'shader_errors'=>[],
            'textures'=>['detailed_materials'=>1,'missing_detail_maps'=>0],'renderer'=>['draw_calls'=>21,'mean_frame_ms'=>10],
            'planted_foot_step_drift'=>1,'blend_hand_step_jump'=>1,'views'=>array_fill(0,3,['silhouette'=>['occupied_pixels'=>1000,'clipped'=>false]])];
        $analysis=['performance'=>['triangles'=>40000,'materials'=>21]];
        $candidate=['id'=>'candidate-01','file'=>'candidate-01.glb','sha256'=>str_repeat($hash,64),'bytes'=>1024,
            'recipe'=>'surface-finishing','generation'=>1,'status'=>'eligible-for-automatic-publication','changes'=>[],
            'gltf'=>['errors'=>0],'analysis'=>$analysis,'art_analysis'=>['issues'=>[]],'render'=>$render,
            'blender'=>['bind_pose_intersection_pairs'=>100],'added_texture_mib'=>4,'issues_addressed'=>['brocade:surface-detail'],
            'improvement'=>['qualifies'=>true,'reasons'=>[]],'validation'=>['passed'=>true,'issues'=>[],
                'checks'=>array_fill_keys(['rig_and_bind_matrices_preserved','topology_and_skin_weights_preserved',
                    'key_times_and_root_motion_preserved','original_licensed_images_preserved','gameplay_stats_and_hitboxes_untouched'],true)]];
        if($change)$change($candidate);
        $source=$parent?->sha256??$meta['sha256'];
        $report=['engine'=>'problem-driven-art-v2','source_hash'=>$source,'art_analysis'=>['profile_hash'=>$ph,
            'issues'=>[['id'=>'brocade:surface-detail','generatable'=>true]]],
            'baseline'=>['analysis'=>$analysis,'render'=>$render,'blender'=>['bind_pose_intersection_pairs'=>100]],
            'candidates'=>[$candidate],'selection'=>'candidate-01'];
        $run=AvatarEvolutionRun::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'complete',
            'plan'=>['version'=>2,'avatar'=>$meta,'original_sha256'=>$meta['sha256'],'parent'=>$parent?['sha256'=>$parent->sha256,'run_id'=>$parent->run_id,'file'=>$parent->file]:null,
                'automatic_publish'=>true,'owner_approval_required'=>false,'profile_hash'=>$ph,'profile'=>$profile],
            'report'=>$report,'manifest_hash'=>'frozen-test-manifest']);
        Http::fake([$service->endpoint('/runs/'.$run->id)=>Http::response(['status'=>'complete','report'=>$report,'manifest_hash'=>'frozen-test-manifest'])]);
        return $run;
    }
    public function test_avatar_controls_are_owner_only_and_unapproved_assets_are_private():void
    {
        Http::preventStrayRequests();$this->get('/evolution/avatars')->assertRedirect('/login');
        $this->actingAs(User::factory()->create());$this->get('/evolution/avatars')->assertForbidden();
        $this->post('/evolution/avatars/start',['avatar_id'=>'c_invoker','focus'=>'balanced'])->assertForbidden();
        $this->get('/api/v1/avatar-visuals')->assertOk()->assertJsonPath('releases',[]);
        $this->get('/api/v1/avatar-visuals/assets/999/'.str_repeat('a',64).'.glb')->assertNotFound();Http::assertNothingSent();
    }
    public function test_automation_freezes_problem_driven_pilot_and_never_waits_on_legacy_owner_reviews():void
    {
        AvatarEvolutionRun::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'review','plan'=>['version'=>1]]);
        $service=app(AvatarEvolutionService::class);$run=$service->start('test-owner');
        $this->assertSame(2,$run->plan['version']);$this->assertSame(5,$run->plan['candidates']);$this->assertSame('claude',$run->plan['avatar']['variant']);
        $this->assertTrue($run->plan['automatic_publish']);$this->assertFalse($run->plan['owner_approval_required']);$this->assertTrue($run->plan['problem_driven']);
        $this->assertSame(0,$run->plan['external_budget_usd']);$this->assertNull($service->start('scheduler',scheduled:true));
        $this->assertDatabaseCount('avatar_visual_releases',0);$this->assertDatabaseHas('avatar_evolution_runs',['status'=>'review']);
    }
    public function test_failed_or_regressing_candidates_never_publish_and_manual_decision_endpoint_is_retired():void
    {
        $this->owner();$service=app(AvatarEvolutionService::class);
        foreach([fn(&$c)=>$c['validation']['passed']=false,fn(&$c)=>$c['render']['renderer']['mean_frame_ms']=20,
            fn(&$c)=>$c['blender']['bind_pose_intersection_pairs']=101,fn(&$c)=>$c['issues_addressed']=[],
            fn(&$c)=>$c['validation']['checks']['key_times_and_root_motion_preserved']=false]as $change){
            $run=$this->completed($change);$service->finalize($run->id);$this->assertSame('unchanged',$run->fresh()->status);
        }
        $this->assertDatabaseCount('avatar_visual_releases',0);
        $this->post('/evolution/avatars/'.$run->id.'/decide',['candidate'=>'candidate-01','action'=>'approve'])->assertNotFound();
    }
    public function test_qualified_repair_publishes_automatically_once_then_admin_rollback_preserves_history():void
    {
        $this->owner();$run=$this->completed();$service=app(AvatarEvolutionService::class);$service->finalize($run->id);
        $release=AvatarVisualRelease::firstOrFail();$this->assertSame(2,$release->version);$this->assertTrue($release->active);
        $this->assertSame('automatic-validation',$release->approved_by);$this->assertSame('deployed',$run->fresh()->status);
        $service->finalize($run->id);$this->assertDatabaseCount('avatar_visual_releases',1);
        $this->get('/api/v1/avatar-visuals')->assertJsonPath('releases.0.sha256',str_repeat('a',64));
        $this->post(route('avatars.rollback'),['avatar_id'=>'c_invoker'])->assertRedirect();$this->assertFalse($release->fresh()->active);
        $this->get('/api/v1/avatar-visuals')->assertJsonPath('releases',[]);
        $this->post(route('avatars.rollback'),['avatar_id'=>'c_invoker','release_id'=>$release->id])->assertRedirect();$this->assertTrue($release->fresh()->active);
    }
    public function test_immutable_worker_manifest_must_match_before_any_publication():void
    {
        $run=$this->completed();$run->update(['manifest_hash'=>'changed']);
        $this->expectException(ValidationException::class);app(AvatarEvolutionService::class)->finalize($run->id);
    }
    public function test_stale_parent_version_cannot_replace_a_newer_release():void
    {
        $service=app(AvatarEvolutionService::class);$a=$this->completed();$b=$this->completed(hash:'b');
        $service->finalize($a->id);$service->finalize($b->id);$this->assertSame('unchanged',$b->fresh()->status);$this->assertDatabaseCount('avatar_visual_releases',1);
    }
    public function test_resource_settings_and_qualified_roster_are_validated():void
    {
        $this->owner();foreach([['candidates_per_cycle'=>20],['generations'=>4],['storage_gib'=>0],['avatar_ids'=>['unknown']],['avatar_ids'=>['c_astra']]]as $data)
            $this->post(route('avatars.settings'),$data)->assertSessionHasErrors();
        $this->post(route('avatars.settings'),['enabled'=>false,'interval_minutes'=>1440])->assertRedirect();
        $settings=AvatarEvolutionSetting::current();$this->assertFalse($settings->enabled);$this->assertSame(1440,$settings->interval_minutes);
    }
    public function test_runtime_reports_cannot_roll_back_without_reproduced_private_canary_failures():void
    {
        $service=app(AvatarEvolutionService::class);$run=$this->completed();$service->finalize($run->id);$release=AvatarVisualRelease::firstOrFail();
        $signal=['release_id'=>$release->id,'sha256'=>$release->sha256,'kind'=>'shader'];
        $this->postJson('/api/v1/avatar-visuals/health',$signal)->assertAccepted()->assertJsonPath('rollback_authorized',false);
        $this->postJson('/api/v1/avatar-visuals/health',$signal)->assertAccepted();
        $this->assertDatabaseHas('avatar_visual_health_signals',['release_id'=>$release->id,'kind'=>'shader','count'=>2]);$this->assertTrue($release->fresh()->active);
        $base=['release_id'=>$release->id,'sha256'=>$release->sha256];
        $service->recordHealth($release->id,$base+['status'=>'inconclusive']);$this->assertSame(0,$release->fresh()->health_failures);
        $service->recordHealth($release->id,$base+['status'=>'failed','reason'=>'Runtime GLB failure']);$this->assertTrue($release->fresh()->active);
        $service->recordHealth($release->id,$base+['status'=>'failed','reason'=>'Runtime GLB failure']);$this->assertFalse($release->fresh()->active);
        $this->assertNotNull($release->fresh()->quarantined_at);$this->get('/api/v1/avatar-visuals')->assertJsonPath('releases',[]);
        $repeat=$this->completed();$service->finalize($repeat->id);$this->assertSame('unchanged',$repeat->fresh()->status);
        $this->owner();$this->post(route('avatars.rollback'),['avatar_id'=>'c_invoker','release_id'=>$release->id])->assertSessionHasErrors('avatar');
    }
    public function test_repeated_canary_failure_restores_a_known_healthy_previous_release():void
    {
        $s=app(AvatarEvolutionService::class);$first=$this->completed();$s->finalize($first->id);$a=AvatarVisualRelease::firstOrFail();
        $s->recordHealth($a->id,['status'=>'healthy','release_id'=>$a->id,'sha256'=>$a->sha256]);
        $second=$this->completed(hash:'b');$s->finalize($second->id);$b=AvatarVisualRelease::latest('id')->first();
        $this->assertSame($a->id,$b->previous_release_id);
        for($i=0;$i<2;$i++)$s->recordHealth($b->id,['status'=>'failed','release_id'=>$b->id,'sha256'=>$b->sha256,'reason'=>'Confirmed render failure']);
        $this->assertTrue($a->fresh()->active);$this->assertFalse($b->fresh()->active);$this->assertNotNull($b->fresh()->quarantined_at);
    }
    public function test_published_asset_urls_survive_rollback_and_reject_changed_bytes():void
    {
        $this->owner();$run=$this->completed();app(AvatarEvolutionService::class)->finalize($run->id);
        $bytes='unit-only-immutable-asset';$hash=hash('sha256',$bytes);$release=AvatarVisualRelease::firstOrFail();$release->update(['sha256'=>$hash]);
        Http::fake(['*files/*'=>Http::sequence()->push($bytes,200,['Content-Type'=>'model/gltf-binary'])->push($bytes,200,['Content-Type'=>'model/gltf-binary'])->push('changed-bytes')]);
        $url='/api/v1/avatar-visuals/assets/'.$release->id.'/'.$hash.'.glb';$this->get($url)->assertOk()->assertContent($bytes);
        $this->post(route('avatars.rollback'),['avatar_id'=>'c_invoker'])->assertRedirect();$this->get($url)->assertOk()->assertContent($bytes);
        $this->get($url)->assertStatus(409);$this->get(str_replace($hash,str_repeat('b',64),$url))->assertNotFound();
    }
}
