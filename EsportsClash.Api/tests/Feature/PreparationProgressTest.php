<?php
namespace Tests\Feature;
use App\Models\{AvatarPreparation,AvatarEvolutionRun,TrellisGeneration,User};
use App\Services\{PreparationProgressService,AvatarPreparationService};
use App\Jobs\PollAvatarPreparation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http,Queue};
use Illuminate\Support\Str;
use Tests\TestCase;
class PreparationProgressTest extends TestCase {
    use RefreshDatabase;
    private function fixtureRun(string $status='queued'):AvatarPreparation {
        $source=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_solana','status'=>'generated_unqualified','plan'=>[]]);
        return AvatarPreparation::create(['id'=>(string)Str::uuid(),'generation_id'=>$source->id,'avatar_id'=>'c_solana','status'=>$status,'plan'=>['provider'=>'unirig','profile'=>'unirig-v1','source_sha256'=>str_repeat('a',64),'unirig_engine_sha256'=>str_repeat('b',64),'seed'=>1],'state'=>[]]);
    }
    private function owner():void{$this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));}
    public function test_mapping_hold_shows_detection_reason_instead_of_claiming_all_bones_are_missing(): void {
        $this->owner(); Http::fake();
        $run=$this->fixtureRun('awaiting_retarget');
        $run->update(['state'=>['preparation'=>['mapping_review'=>['accepted'=>false,'reasons'=>['Root must have one unambiguous pelvis branch; extra roots need review.']],
            'problems'=>['Review native animation mapping for: Root, Hips, Spine, Chest']]]]);
        $this->get(route('preparations.live'))->assertOk()->assertSee('Native mapping needs review')
            ->assertSee('Root must have one unambiguous pelvis branch')
            ->assertSee('data-status-category="review"',false)
            ->assertDontSee('Review native animation mapping for: Root, Hips, Spine, Chest')
            ->assertSee('without a fresh UniRig prediction');
        $run->update(['status'=>'cancelled']);
        $this->get(route('preparations.live'))->assertOk()->assertSee('Previous attempt / mapping review')
            ->assertDontSee('Review native animation mapping for: Root, Hips, Spine, Chest');
    }
    public function test_job_history_and_activity_are_chronological_and_report_is_scoped(): void {
        $this->owner(); Http::fake(['*'=>Http::response([],503)]);
        $old=$this->fixtureRun('waiting_resources'); $new=$this->fixtureRun('rigging');
        $old->update(['created_at'=>now()->subHours(2),'progress'=>['step'=>0,'status'=>'waiting_resources','stage'=>'resource_admission','events'=>[
            ['step'=>0,'stage'=>'resource_admission','status'=>'waiting_resources','message'=>'LATER_OBSERVATION','observed_at'=>now()->subMinutes(2)->toIso8601String()],
            ['step'=>0,'stage'=>'manual_admission','status'=>'queued','message'=>'EARLIER_OBSERVATION','observed_at'=>now()->subMinutes(4)->toIso8601String()]
        ]]]);
        $new->update(['created_at'=>now()->subHour()]);
        $this->get(route('preparations.live'))->assertOk()->assertSeeInOrder(['id="preparation-'.$old->id.'"','id="preparation-'.$new->id.'"'],false)->assertSeeInOrder(['EARLIER_OBSERVATION','LATER_OBSERVATION']);
        $this->get(route('preparations.report',$old))->assertOk()->assertSee('Activity timeline')->assertSeeInOrder(['EARLIER_OBSERVATION','LATER_OBSERVATION'])->assertDontSee($new->id)->assertSee('preparation='.$old->id,false);
        $this->get(route('preparations.report',[$old,'format'=>'json']))->assertOk()->assertJsonPath('preparation.id',$old->id)->assertHeader('Content-Disposition','attachment; filename="preparation-'.$old->id.'.json"');
        $this->get(route('preparations.live',['preparation'=>$old->id]))->assertOk()->assertDontSee($new->id);
        $this->actingAs(User::factory()->create())->get(route('preparations.report',$old))->assertForbidden();
    }
    public function test_geometry_pass_does_not_present_unqualified_job_as_ready(): void {
        $this->owner(); Http::fake();
        $run=$this->fixtureRun('needs_review');
        $run->update(['state'=>['report'=>['geometry'=>['passed'=>true],'reasons'=>['ANIMATION_BLOCKER']]]]);
        $this->get(route('preparations.live'))->assertOk()->assertSee('data-status-category="failed"',false)->assertSee('ANIMATION_BLOCKER')->assertDontSee('Technical checks passed / visual sign-off required');
    }
    public function test_poll_records_real_stages_resources_and_deduplicated_messages():void {
        Queue::fake();$run=$this->fixtureRun();$phase='skeleton_prediction';
        Http::fake(function($request)use($run,&$phase){return Http::response(['id'=>$run->id,'status'=>'rigging','stage'=>$phase,'updated_unix'=>now()->timestamp,'resources'=>['gpu_free_mib'=>9000,'gpu_used_mib'=>3000,'vm_available_mib'=>8000]],200);});
        $job=new PollAvatarPreparation($run->id);$service=app(AvatarPreparationService::class);
        $job->handle($service);$job->handle($service);$run->refresh();
        $this->assertSame(2,$run->progress['step']);$this->assertCount(1,$run->progress['events']);$this->assertSame(9000.0,(float)$run->progress['resources']['sample']['gpu_free_mib']);
        $this->travel(20)->seconds();$phase='skin_weight_prediction';$job->handle($service);$run->refresh();
        $this->assertSame(3,$run->progress['step']);$this->assertCount(2,$run->progress['events']);$this->assertSame('rigging',$run->status);
        $this->owner();$this->get('/evolution/avatars/preparation/live')->assertOk()->assertSee('Workflow stage 4 of 10')->assertSee('predicting how mesh vertices deform')->assertSee('9,000 MiB')->assertSee('Activity timeline');
        $run->update(['status'=>'cancelling']);$sent=count(Http::recorded());$phase='merge_original_materials';$job->handle($service);
        $this->assertSame($sent,count(Http::recorded()));$this->assertSame('cancelling',$run->fresh()->status);
        $this->assertDatabaseCount('avatar_visual_releases',0);
    }
    public function test_failure_and_waiting_states_preserve_last_position_and_history_is_bounded():void {
        $run=$this->fixtureRun('animating');$progress=app(PreparationProgressService::class);
        $progress->record($run,['status'=>'animating','stage'=>'download_unirig_and_retarget_native_clips']);
        $progress->record($run,['status'=>'queued','stage'=>'preparing']);
        $this->assertSame(5,$run->progress['step']);
        $this->assertStringContainsString('animation worker has queued',$run->progress['message']);
        $progress->record($run,['status'=>'waiting_resources','stage'=>'resource_admission']);$this->assertSame(5,$run->progress['step']);
        $progress->record($run,['status'=>'failed','stage'=>'preparation_failed']);$this->assertSame(5,$run->progress['step']);
        for($i=0;$i<110;$i++)$progress->record($run,['status'=>'rigging','stage'=>$i%2?'skin_weight_prediction':'skeleton_prediction']);
        $this->assertCount(100,$run->progress['events']);
        $run->update(['status'=>'published']);$this->assertSame(9,$progress->view($run)['step']);
    }
    public function test_bulk_delete_is_owner_only_confirmed_atomic_and_clears_progress():void {
        Queue::fake();Http::fake();$a=$this->fixtureRun('failed');$b=$this->fixtureRun('cancelled');$active=$this->fixtureRun('rigging');
        $a->update(['progress'=>['events'=>[['message'=>'discard']]],'state'=>['private'=>'discard'],'error'=>'discard']);
        $path='/evolution/reports/preparation/bulk';$selection=['ids'=>[$a->id,$b->id],'confirm'=>'1'];
        $this->delete($path,$selection)->assertRedirect('/login');$this->actingAs(User::factory()->create());$this->delete($path,$selection)->assertForbidden();
        $this->owner();$this->delete($path,['ids'=>[$a->id]])->assertSessionHasErrors('confirm');
        $this->delete($path,['ids'=>[$a->id,$active->id],'confirm'=>'1'])->assertSessionHasErrors('report');
        $this->assertNotNull($a->fresh()->state);$this->assertNull($a->fresh()->deleted_at);
        $this->delete($path,['ids'=>[$a->id,$a->id],'confirm'=>'1'])->assertSessionHasErrors('ids.0');
        $this->delete($path,$selection)->assertRedirect(route('preparations.index'));
        $this->assertNull(AvatarPreparation::find($a->id));$this->assertNull(AvatarPreparation::find($b->id));$this->assertNotNull(AvatarPreparation::find($active->id));
        $deleted=AvatarPreparation::withTrashed()->findOrFail($a->id);$this->assertNull($deleted->progress);$this->assertNull($deleted->state);$this->assertNull($deleted->error);$this->assertSame(['report_deleted'=>true],$deleted->plan);
        $this->get('/evolution/avatars/preparation/'.$a->id.'/report')->assertNotFound();Http::assertNothingSent();Queue::assertNothingPushed();
    }
    public function test_bulk_delete_preserves_publication_identity_and_scrubs_mirrored_report():void {
        $this->owner();$run=$this->fixtureRun('published');
        AvatarEvolutionRun::create(['id'=>$run->id,'avatar_id'=>'c_solana','status'=>'deployed','plan'=>['version'=>3],'report'=>['private'=>'discard'],'decisions'=>['private'=>'discard']]);
        $this->delete('/evolution/reports/preparation/bulk',['ids'=>[$run->id],'confirm'=>'1'])->assertSessionHasNoErrors();
        $mirror=AvatarEvolutionRun::withTrashed()->findOrFail($run->id);$this->assertNotNull($mirror->deleted_at);$this->assertNull($mirror->report);$this->assertSame(3,$mirror->plan['version']);
        $this->assertDatabaseHas('avatar_preparations',['id'=>$run->id,'status'=>'published']);
        $remaining=$this->fixtureRun('failed');$this->delete('/evolution/reports/preparation/bulk',['ids'=>[$remaining->id,(string)Str::uuid()],'confirm'=>'1'])->assertSessionHasErrors('report');$this->assertNotNull(AvatarPreparation::find($remaining->id));
    }
    public function test_progress_screen_explains_manual_qualification_and_disables_busy_selection():void {
        $this->owner();$wait=$this->fixtureRun('awaiting_validation');$busy=$this->fixtureRun('rigging');
        $wait->update(['state'=>['stage'=>'rig_and_clips_exported_validation_deferred']]);
        Http::fake(['*'=>Http::response(['models_ready'=>true,'runtime_ready'=>true,'active'=>$busy->id])]);
        $this->get('/evolution/avatars/preparation')->assertOk()->assertSee('Workflow stage 7 of 10')->assertSee('Select Run runtime qualification')->assertSee('Delete selected preparation reports')->assertSee('No new worker observation');
    }
}
