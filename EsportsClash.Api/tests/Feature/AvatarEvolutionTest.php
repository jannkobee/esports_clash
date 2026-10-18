<?php
namespace Tests\Feature;
use App\Models\{AvatarEvolutionRun,AvatarEvolutionSetting,AvatarVisualRelease,User};
use App\Services\AvatarEvolutionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http,Queue};
use Illuminate\Support\Str;
use Tests\TestCase;

class AvatarEvolutionTest extends TestCase
{
    use RefreshDatabase;
    protected function setUp():void { parent::setUp();Queue::fake();AvatarEvolutionSetting::current(); }
    private function owner():User { $user=User::factory()->create(['is_evolution_admin'=>true]);$this->actingAs($user);return $user; }
    private function review(bool $passed=true):AvatarEvolutionRun
    {
        $meta=collect(app(AvatarEvolutionService::class)->catalog())->firstWhere('id','c_invoker');
        $candidate=['id'=>'candidate-01','file'=>'candidate-01.glb','sha256'=>str_repeat('a',64),
            'validation'=>['passed'=>$passed],'render'=>['passed'=>$passed]];
        $report=['candidates'=>[$candidate]];
        $run=AvatarEvolutionRun::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'review',
            'plan'=>['avatar'=>$meta,'original_sha256'=>$meta['sha256'],'parent'=>null],
            'report'=>$report,'manifest_hash'=>'frozen-test-manifest']);
        Http::fake(['*runs/*'=>Http::response(['status'=>'review','report'=>$report,'manifest_hash'=>'frozen-test-manifest'])]);
        return $run;
    }
    public function test_avatar_controls_are_owner_only_and_unapproved_assets_are_private():void
    {
        Http::preventStrayRequests();
        $this->get('/evolution/avatars')->assertRedirect('/login');
        $this->actingAs(User::factory()->create());
        $this->get('/evolution/avatars')->assertForbidden();
        $this->post('/evolution/avatars/start',['avatar_id'=>'c_invoker','focus'=>'motion'])->assertForbidden();
        $this->get('/api/v1/avatar-visuals')->assertOk()->assertJsonPath('releases',[]);
        $this->get('/api/v1/avatar-visuals/assets/999/'.str_repeat('a',64).'.glb')->assertNotFound();
        Http::assertNothingSent();
    }
    public function test_default_automation_targets_arsenaldo_and_freezes_five_real_candidates_without_auto_publish():void
    {
        $service=app(AvatarEvolutionService::class);$run=$service->start('test-owner');
        $this->assertSame('c_invoker',$run->avatar_id);$this->assertSame(5,$run->plan['candidates']);
        $this->assertSame('claude',$run->plan['avatar']['variant']);
        $this->assertFalse($run->plan['automatic_publish']);$this->assertTrue($run->plan['owner_approval_required']);
        $this->assertNull($service->start('scheduler',scheduled:true));
        $this->assertDatabaseCount('avatar_evolution_runs',1);$this->assertDatabaseCount('avatar_visual_releases',0);
    }
    public function test_failed_technical_candidate_cannot_be_approved():void
    {
        $this->owner();$run=$this->review(false);
        $this->post(route('avatars.decide',$run),['candidate'=>'candidate-01','action'=>'approve'])->assertSessionHasErrors('candidate');
        $this->assertDatabaseCount('avatar_visual_releases',0);
        $this->post(route('avatars.decide',$run),['candidate'=>'candidate-01','action'=>'reject','feedback'=>'Shoulder clipping'])->assertRedirect();
        $this->assertSame('reject',$run->fresh()->decisions['candidate-01']['action']);
        $this->assertSame('reviewed',$run->fresh()->status);
    }
    public function test_owner_approval_publishes_v2_then_rollback_keeps_versioned_assets_and_original():void
    {
        $this->owner();$run=$this->review();
        $this->post(route('avatars.decide',$run),['candidate'=>'candidate-01','action'=>'approve'])->assertSessionHasNoErrors()->assertRedirect();
        $release=AvatarVisualRelease::firstOrFail();$this->assertSame(2,$release->version);$this->assertTrue($release->active);
        $this->get('/api/v1/avatar-visuals')->assertJsonPath('releases.0.sha256',str_repeat('a',64));
        $this->post(route('avatars.decide',$run),['candidate'=>'candidate-01','action'=>'approve'])->assertSessionHasErrors('candidate');
        $this->post(route('avatars.rollback'),['avatar_id'=>'c_invoker'])->assertRedirect();
        $this->assertFalse($release->fresh()->active);$this->assertDatabaseCount('avatar_visual_releases',1);
        $this->get('/api/v1/avatar-visuals')->assertJsonPath('releases',[]);
        $this->post(route('avatars.rollback'),['avatar_id'=>'c_invoker','release_id'=>$release->id])->assertRedirect();
        $this->assertTrue($release->fresh()->active);
    }
    public function test_reviewed_manifest_and_parent_version_are_verified_before_publishing():void
    {
        $this->owner();$run=$this->review();$original=$run->report;
        $run->update(['report'=>['candidates'=>[['id'=>'candidate-01','validation'=>['passed'=>true],'render'=>['passed'=>true],'file'=>'tampered.glb']]]]);
        $this->post(route('avatars.decide',$run),['candidate'=>'candidate-01','action'=>'approve'])->assertSessionHasErrors('candidate');
        $run->update(['report'=>$original]);
        AvatarVisualRelease::create(['avatar_id'=>'c_invoker','variant'=>'claude','version'=>2,'run_id'=>$run->id,'candidate_id'=>'other','file'=>'other.glb','sha256'=>str_repeat('b',64),'validation'=>[],'approved_by'=>'fixture']);
        $this->post(route('avatars.decide',$run),['candidate'=>'candidate-01','action'=>'approve'])->assertSessionHasErrors('candidate');
        $this->assertDatabaseCount('avatar_visual_releases',1);
    }
    public function test_resource_settings_are_validated_and_scheduled_generation_waits_for_review():void
    {
        $this->owner();$run=$this->review();
        $settings=AvatarEvolutionSetting::current();$settings->update(['next_cycle_at'=>now()->subMinute()]);
        $this->assertNull(app(AvatarEvolutionService::class)->start('scheduler',scheduled:true));
        foreach([['candidates_per_cycle'=>20],['generations'=>4],['storage_gib'=>0],['avatar_ids'=>['unknown']]]as $data)
            $this->post(route('avatars.settings'),$data)->assertSessionHasErrors();
        $this->post(route('avatars.settings'),['enabled'=>false,'interval_minutes'=>1440])->assertRedirect();
        $this->assertFalse($settings->fresh()->enabled);$this->assertSame(1440,$settings->fresh()->interval_minutes);
    }
    public function test_published_asset_urls_survive_rollback_and_reject_changed_bytes():void
    {
        $this->owner();$run=$this->review();
        $this->post(route('avatars.decide',$run),['candidate'=>'candidate-01','action'=>'approve'])->assertRedirect();
        // Inert HTTP fixture only; never used as generated or validated art.
        $bytes='unit-only-immutable-asset';$hash=hash('sha256',$bytes);
        $release=AvatarVisualRelease::firstOrFail();$release->update(['sha256'=>$hash]);
        Http::fake(['*files/*'=>Http::sequence()->push($bytes,200,['Content-Type'=>'model/gltf-binary'])
            ->push($bytes,200,['Content-Type'=>'model/gltf-binary'])->push('changed-bytes')]);
        $url='/api/v1/avatar-visuals/assets/'.$release->id.'/'.$hash.'.glb';
        $this->get($url)->assertOk()->assertContent($bytes)->assertHeader('Content-Type','model/gltf-binary');
        $this->post(route('avatars.rollback'),['avatar_id'=>'c_invoker'])->assertRedirect();
        $this->get($url)->assertOk()->assertContent($bytes);
        $this->get($url)->assertStatus(409);
        $this->get(str_replace($hash,str_repeat('b',64),$url))->assertNotFound();
    }
}
