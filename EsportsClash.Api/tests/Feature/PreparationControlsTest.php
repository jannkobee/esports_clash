<?php
namespace Tests\Feature;
use App\Models\{AvatarPreparation,TrellisGeneration,User};
use App\Services\{AvatarPreparationControlService,AvatarPreparationService,AvatarJobCancellationService};
use App\Jobs\{CancelAvatarJob,RestartAvatarPreparation,PollAvatarPreparation};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http,Queue};
use Illuminate\Support\Str;
use Tests\TestCase;
class PreparationControlsTest extends TestCase {
    use RefreshDatabase;
    private function fixture(string $status='waiting_resources'):AvatarPreparation {
        $source=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_solana','status'=>'generated_unqualified','plan'=>['seed'=>123],'state'=>['artifact'=>['sha256'=>str_repeat('a',64)]]]);
        return AvatarPreparation::create(['id'=>(string)Str::uuid(),'generation_id'=>$source->id,'avatar_id'=>$source->avatar_id,'status'=>$status,'plan'=>['provider'=>'unirig','profile'=>'unirig-v1','yaw'=>10,'attachments'=>[],'bone_map'=>['Hips'=>'mixamorig:Hips'],'seed'=>123,'source_sha256'=>str_repeat('a',64),'unirig_engine_sha256'=>str_repeat('b',64)],'state'=>['stage'=>'resource_admission']]);
    }
    private function fakes():void {Queue::fake();Http::fake(['*/cancel'=>Http::response(['status'=>'cancelled']),'*/operations'=>Http::response(['engine_sha256'=>str_repeat('b',64),'runtime_ready'=>true,'models_ready'=>true])]);}
    private function owner():void {$this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));}
    public function test_pause_waits_for_both_workers_and_resume_creates_one_linked_attempt():void {
        $this->fakes();$old=$this->fixture();$controls=app(AvatarPreparationControlService::class);
        $controls->request($old,'pause','owner:test');$this->assertSame('pausing',$old->fresh()->status);Queue::assertPushed(CancelAvatarJob::class);Queue::assertNotPushed(RestartAvatarPreparation::class);
        (new PollAvatarPreparation($old->id))->handle(app(AvatarPreparationService::class));Http::assertNothingSent();
        app(AvatarJobCancellationService::class)->synchronize('preparation',$old->id);$old->refresh();$this->assertSame('paused',$old->status);$this->assertNull($old->control['intent']);Queue::assertNotPushed(RestartAvatarPreparation::class);
        $controls->request($old,'resume','owner:test');$controls->request($old,'resume','owner:test');Queue::assertPushed(RestartAvatarPreparation::class,1);
        $new=$controls->restart($old->id);$again=$controls->restart($old->id);
        $this->assertSame($new->id,$again->id);$this->assertSame($old->id,$new->previous_preparation_id);$this->assertSame($old->generation_id,$new->generation_id);$this->assertSame($old->plan['bone_map'],$new->plan['bone_map']);$this->assertSame(10.0,(float)$new->plan['yaw']);$this->assertSame(2,AvatarPreparation::count());$this->assertSame('paused',$old->fresh()->status);$this->assertSame($new->id,$old->fresh()->control['replacement_id']);$this->assertDatabaseCount('avatar_visual_releases',0);
    }
    public function test_retry_cannot_admit_a_replacement_until_stop_acknowledgement():void {
        Queue::fake();$old=$this->fixture('rigging');$controls=app(AvatarPreparationControlService::class);
        Http::fake(['*/jobs/'.$old->id.'/cancel'=>Http::sequence()->push([],503)->push(['status'=>'cancelled']),'*/preparations/'.$old->id.'/cancel'=>Http::response(['status'=>'cancelled']),'*/operations'=>Http::response(['engine_sha256'=>str_repeat('b',64),'runtime_ready'=>true,'models_ready'=>true])]);
        $controls->request($old,'retry','owner:test');$this->assertSame('cancelling',$old->fresh()->status);$this->assertNull($controls->restart($old->id));$this->assertSame(1,AvatarPreparation::count());
        try{app(AvatarJobCancellationService::class)->synchronize('preparation',$old->id);$this->fail('Stop cannot be acknowledged while GPU is unavailable');}catch(\Illuminate\Http\Client\RequestException){}
        $this->assertSame('cancelling',$old->fresh()->status);Queue::assertNotPushed(RestartAvatarPreparation::class);
        app(AvatarJobCancellationService::class)->synchronize('preparation',$old->id);Queue::assertPushed(RestartAvatarPreparation::class);$new=$controls->restart($old->id);$this->assertNotNull($new);$this->assertSame('cancelled',$old->fresh()->status);
    }
    public function test_cancel_overrides_pending_retry_and_invalid_states_never_restart():void {
        $this->fakes();$old=$this->fixture();$controls=app(AvatarPreparationControlService::class);$cancel=app(AvatarJobCancellationService::class);
        $controls->request($old,'retry','owner:test');$cancel->request('preparation',$old->id,'owner:test');$cancel->synchronize('preparation',$old->id);
        $this->assertNull($old->fresh()->control['intent']);$this->assertNull($controls->restart($old->id));Queue::assertNotPushed(RestartAvatarPreparation::class);
        $this->owner();$path='/evolution/avatars/preparation/'.$old->id.'/control';$old->update(['status'=>'published']);
        $this->post($path,['operation'=>'retry'])->assertSessionHasErrors('preparation');$this->post($path,['operation'=>'resume'])->assertSessionHasErrors('preparation');$this->assertSame(1,AvatarPreparation::count());
    }
    public function test_owner_controls_render_and_pending_restart_prevents_report_deletion():void {
        $this->fakes();$old=$this->fixture();$path='/evolution/avatars/preparation/'.$old->id.'/control';
        $this->post($path,['operation'=>'pause'])->assertRedirect('/login');$this->actingAs(User::factory()->create());$this->post($path,['operation'=>'pause'])->assertForbidden();
        $this->owner();$this->get('/evolution/avatars/preparation/live')->assertOk()->assertSee('Pause preparation')->assertSee('Retry preparation');
        $this->post($path,['operation'=>'pause'])->assertSessionHasNoErrors();$this->assertSame('pausing',$old->fresh()->status);
        $this->delete('/evolution/reports/preparation/'.$old->id)->assertSessionHasErrors('report');
        app(AvatarJobCancellationService::class)->synchronize('preparation',$old->id);
        $this->get('/evolution/avatars/preparation/live')->assertOk()->assertSee('Resume preparation');
        $this->post($path,['operation'=>'resume'])->assertSessionHasNoErrors();
        $this->delete('/evolution/reports/preparation/bulk',['ids'=>[$old->id],'confirm'=>'1'])->assertSessionHasErrors('report');
        $this->post($path,['operation'=>'execute-shell'])->assertSessionHasErrors('operation');
    }
    public function test_missing_source_and_exhausted_restart_do_not_loop_forever():void {
        $this->fakes();$old=$this->fixture('paused');$controls=app(AvatarPreparationControlService::class);$controls->request($old,'resume','owner:test');TrellisGeneration::findOrFail($old->generation_id)->delete();
        try{$controls->restart($old->id);$this->fail('Missing source must block admission');}catch(\Illuminate\Validation\ValidationException){}
        $controls->failedRestart($old->id);$old->refresh();$this->assertNull($old->control['intent']);$this->assertNotEmpty($old->control['restart_error']);$this->assertSame(1,AvatarPreparation::count());
        $this->artisan('avatars:recover-preparations')->assertSuccessful();Queue::assertPushed(RestartAvatarPreparation::class,1);
    }
    public function test_pending_continuation_can_be_cancelled_before_admission():void {
        $this->fakes();$old=$this->fixture('paused');$controls=app(AvatarPreparationControlService::class);
        $controls->request($old,'resume','owner:test');$controls->request($old,'cancel_pending','owner:test');
        $this->assertNull($controls->restart($old->id));$this->assertNull($old->fresh()->control['intent']);$this->assertSame('paused',$old->fresh()->status);$this->assertSame(1,AvatarPreparation::count());Http::assertNothingSent();
    }

}
