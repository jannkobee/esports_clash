<?php
namespace Tests\Feature;
use App\Models\{User,AvatarPreparation,TrellisGeneration,AvatarVisualRelease};
use App\Services\{AvatarJobCancellationService,AvatarPreparationService,TrellisGenerationService};
use App\Jobs\{CancelAvatarJob,PollTrellisGeneration};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http,Queue};
use Illuminate\Support\Str;
use Tests\TestCase;

class AvatarPreparationTest extends TestCase {
    use RefreshDatabase;
    private function source(string $status='generated_unqualified'):TrellisGeneration{return TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_solana','status'=>$status,'plan'=>[], 'state'=>['artifact'=>['sha256'=>str_repeat('a',64)]]]);}
    public function test_saved_rig_revision_freezes_artifact_and_never_admits_gpu_work():void {
        Queue::fake();$source=$this->source();$old=AvatarPreparation::create(['id'=>(string)Str::uuid(),'generation_id'=>$source->id,'avatar_id'=>'c_solana','status'=>'needs_review',
            'plan'=>['source_sha256'=>str_repeat('a',64),'unirig_engine_sha256'=>str_repeat('b',64)],
            'state'=>['preparation'=>['unirig'=>['plan'=>['source_sha256'=>str_repeat('a',64),'engine_sha256'=>str_repeat('b',64)],'artifact'=>['sha256'=>str_repeat('c',64),'bytes'=>64]]]]]);
        Http::fake(['*/preparations/operations'=>Http::response(['engine_sha256'=>str_repeat('d',64)])]);
        $run=app(AvatarPreparationService::class)->start($source,'unirig-v1',0,[],'test-owner',[],null,$old->id);
        $this->assertSame(['id'=>$old->id,'sha256'=>str_repeat('c',64),'bytes'=>64],$run->plan['rig_reuse']);
        Http::assertSentCount(1);
        Http::fake(['*/preparations/'.$run->id=>Http::response(['id'=>$run->id,'status'=>'awaiting_validation'])]);
        (new \App\Jobs\PollAvatarPreparation($run->id))->handle(app(AvatarPreparationService::class));
        Http::assertSentCount(1);Http::assertNotSent(fn($request)=>str_contains($request->url(),'/jobs/'));
        $this->assertSame('awaiting_validation',$run->fresh()->status);$this->assertSame('needs_review',$old->fresh()->status);
    }
    public function test_wrong_source_cannot_supply_a_frozen_rig():void {
        Queue::fake();Http::fake();$source=$this->source();
        $other=$this->source();$old=AvatarPreparation::create(['id'=>(string)Str::uuid(),'generation_id'=>$other->id,'avatar_id'=>'c_solana','status'=>'needs_review','plan'=>[]]);
        try{app(AvatarPreparationService::class)->start($source,'unirig-v1',0,[],'test-owner',[],null,$old->id);$this->fail('Wrong source rig accepted');}catch(\Illuminate\Validation\ValidationException $error){$this->assertArrayHasKey('rig_preparation_id',$error->errors());}
        Http::assertNothingSent();
    }
    public function test_reused_rig_cancellation_only_stops_animation_worker():void {
        Queue::fake();$source=$this->source();$id=(string)Str::uuid();
        $run=AvatarPreparation::create(['id'=>$id,'generation_id'=>$source->id,'avatar_id'=>'c_solana','status'=>'cancelling','plan'=>['provider'=>'unirig','rig_reuse'=>['id'=>(string)Str::uuid()]]]);
        Http::fake(['*/preparations/'.$id.'/cancel'=>Http::response(['status'=>'cancelled'])]);
        app(AvatarJobCancellationService::class)->synchronize('preparation',$id);Http::assertSentCount(1);$this->assertSame('cancelled',$run->fresh()->status);
    }
    public function test_preparation_controls_require_owner_access():void {
        $this->get('/evolution/avatars/preparation')->assertRedirect('/login');
        $this->actingAs(User::factory()->create());$this->get('/evolution/avatars/preparation')->assertForbidden();
        $this->post('/evolution/avatar-jobs/generation/'.$this->source('queued')->id.'/cancel')->assertForbidden();
    }
    public function test_owner_studio_renders_unirig_readiness_without_admitting_a_job():void {
        Queue::fake();Http::fake(['*/operations'=>Http::response(['models_ready'=>true,'runtime_ready'=>true,'commit'=>'pinned-fixture'])]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->get('/evolution/avatars/preparation')->assertOk()->assertSee('Local UniRig worker')->assertSee('Manual jobs only')->assertDontSee('Automatically prepare');
        $this->assertSame(0,AvatarPreparation::count());Queue::assertNothingPushed();
    }
    public function test_cancellation_requires_worker_acknowledgement_and_blocks_late_poll_completion():void {
        Queue::fake();$run=$this->source('queued');$service=app(AvatarJobCancellationService::class);
        $service->request('generation',$run->id,'test-owner');$this->assertSame('cancelling',$run->fresh()->status);Queue::assertPushed(CancelAvatarJob::class);
        Http::fake(['*/jobs/'.$run->id=>Http::response(['id'=>$run->id,'status'=>'generated_unqualified'])]);
        (new PollTrellisGeneration($run->id))->handle(app(TrellisGenerationService::class));Http::assertNothingSent();
        $this->assertSame('cancelling',$run->fresh()->status);
        Http::fake(['*/jobs/'.$run->id.'/cancel'=>Http::response(['status'=>'cancelled'])]);
        $service->synchronize('generation',$run->id);$this->assertSame('cancelled',$run->fresh()->status);$this->assertSame(0,AvatarVisualRelease::count());
    }
    public function test_cancellation_outage_retains_the_pending_stop_for_recovery():void {
        Queue::fake();$run=$this->source('queued');$service=app(AvatarJobCancellationService::class);$service->request('generation',$run->id,'test-owner');
        Http::fake(['*/cancel'=>Http::response([],404)]);
        try{$service->synchronize('generation',$run->id);$this->fail('Missing worker capability must not acknowledge a stop');}catch(\Illuminate\Http\Client\RequestException){}
        $this->assertSame('cancelling',$run->fresh()->status);
    }
    public function test_new_preparation_freezes_character_donor_and_defers_qualification():void {
        Queue::fake();Http::fake(['*/operations'=>Http::response(['engine_sha256'=>str_repeat('b',64),'runtime_ready'=>true,'models_ready'=>true])]);$source=$this->source();
        $run=app(AvatarPreparationService::class)->start($source,'unirig-v1',0,[],'test-owner');
        $this->assertSame($source->id,$run->generation_id);$this->assertSame('deferred',$run->plan['validation']);
        $this->assertSame(str_repeat('a',64),$run->plan['source_sha256']);$this->assertNotEmpty($run->plan['donor_sha256']);$this->assertSame(0,AvatarVisualRelease::count());
    }
    public function test_unqualified_or_cancelled_preparations_cannot_publish():void {
        Queue::fake();$source=$this->source();$id=(string)Str::uuid();
        $run=AvatarPreparation::create(['id'=>$id,'generation_id'=>$source->id,'avatar_id'=>$source->avatar_id,'status'=>'cancelled','plan'=>['engine_sha256'=>str_repeat('b',64),'source_sha256'=>str_repeat('a',64)]]);
        Http::fake(['*/preparations/'.$id=>Http::response(['status'=>'ready','report'=>[]])]);
        try{app(AvatarPreparationService::class)->publish($run,'test-owner');$this->fail('Cancelled preparation published');}catch(\Illuminate\Validation\ValidationException){}
        $this->assertSame(0,AvatarVisualRelease::count());$this->assertSame('cancelled',$run->fresh()->status);
    }
    public function test_unirig_cancellation_stops_cpu_work_even_if_gpu_control_is_unavailable():void {
        Queue::fake();$source=$this->source();$id=(string)Str::uuid();
        $run=AvatarPreparation::create(['id'=>$id,'generation_id'=>$source->id,'avatar_id'=>'c_solana','status'=>'cancelling','plan'=>['provider'=>'unirig']]);
        Http::fake(['*/jobs/'.$id.'/cancel'=>Http::sequence()->push([],503)->push(['status'=>'cancelled']),'*/preparations/'.$id.'/cancel'=>Http::response(['status'=>'cancelled'])]);
        try{app(AvatarJobCancellationService::class)->synchronize('preparation',$id);$this->fail('Both workers must acknowledge');}catch(\Illuminate\Http\Client\RequestException){}
        Http::assertSentCount(2);$this->assertSame('cancelling',$run->fresh()->status);
        app(AvatarJobCancellationService::class)->synchronize('preparation',$id);
        $this->assertSame('cancelled',$run->fresh()->status);
    }
    public function test_publishing_qualified_preparation_succeeds_even_when_worker_engine_evolves():void {
        Queue::fake();$source=$this->source();$id=(string)Str::uuid();
        $engine=str_repeat('b',64);$sourceHash=str_repeat('a',64);
        $artifactBytes=1234;$assetData=str_repeat('x',$artifactBytes);$assetSha=hash('sha256',$assetData);
        $meta=collect(app(\App\Services\AvatarEvolutionService::class)->catalog())->firstWhere('id','c_solana');
        $report=[
            'engine_sha256'=>$engine,'source_hash'=>$sourceHash,'reasons'=>[],
            'gltf'=>['errors'=>0],'geometry'=>['passed'=>true],
            'candidates'=>[[
                'id'=>'candidate-01','bytes'=>$artifactBytes,'sha256'=>$assetSha,
                'validation'=>['passed'=>true],'render'=>['passed'=>true,'gameplay'=>['passed'=>true]]
            ]],
            'baseline'=>['render'=>['renderer'=>'mock-webgl']]
        ];
        $run=AvatarPreparation::create([
            'id'=>$id,'generation_id'=>$source->id,'avatar_id'=>'c_solana','status'=>'ready',
            'plan'=>['provider'=>'unirig','engine_sha256'=>$engine,'source_sha256'=>$sourceHash,'donor_sha256'=>$meta['sha256']],
            'state'=>['report'=>$report]
        ]);
        Http::fake([
            '*/preparations/operations'=>Http::response(['engine_sha256'=>str_repeat('z',64)]),
            '*/preparations/'.$id=>Http::response(['status'=>'ready','report'=>$report]),
            '*/files/'.$id.'/candidate-01.glb'=>Http::response($assetData,200)
        ]);
        app(AvatarPreparationService::class)->publish($run,'test-owner');
        $this->assertSame('published',$run->fresh()->status);
        $this->assertSame(1,AvatarVisualRelease::where('avatar_id','c_solana')->where('sha256',$assetSha)->where('active',true)->count());
    }
}
