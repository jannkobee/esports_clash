<?php
namespace Tests\Feature;
use App\Models\{User,TrellisGeneration,AvatarPreparationSetting,EvolutionSetting};
use App\Services\{AvatarPreparationService,AvatarEvolutionService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Queue,Http};
use Illuminate\Support\Str;
use Tests\TestCase;
class ReportDeletionTest extends TestCase {
    use RefreshDatabase;
    private function fixtureRun(string $status):TrellisGeneration{return TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_solana','status'=>$status,'plan'=>[],'state'=>['private_report'=>'discard-me'],'error'=>'old diagnostic']);}
    public function test_owner_can_delete_report_details_without_removing_the_asset_identity():void {
        $run=$this->fixtureRun('failed');$this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->delete('/evolution/reports/generation/'.$run->id)->assertRedirect(route('trellis.index'));
        $this->assertNull(TrellisGeneration::find($run->id));$record=TrellisGeneration::withTrashed()->findOrFail($run->id);
        $this->assertNull($record->state);$this->assertNull($record->error);$this->assertNotNull($record->deleted_at);
        $this->assertSame(['report_deleted'=>true],$record->plan);
        $this->get('/evolution/avatars/trellis/'.$run->id.'/report')->assertNotFound();
    }
    public function test_active_report_cannot_be_deleted_and_nonowners_are_rejected():void {
        $run=$this->fixtureRun('running');$this->actingAs(User::factory()->create());$this->delete('/evolution/reports/generation/'.$run->id)->assertForbidden();
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));$this->delete('/evolution/reports/generation/'.$run->id)->assertSessionHasErrors('report');
        $this->assertNotNull($run->fresh()->state);
    }
    public function test_visual_automatic_admission_is_a_noop_and_ml_remains_enabled():void {
        Queue::fake();Http::fake();EvolutionSetting::current()->update(['enabled'=>true]);
        app(AvatarPreparationService::class)->tick();$this->assertNull(app(AvatarEvolutionService::class)->start('avatar-scheduler',scheduled:true));
        $this->assertFalse(AvatarPreparationSetting::current()->enabled);$this->assertTrue(EvolutionSetting::current()->enabled);Queue::assertNothingPushed();Http::assertNothingSent();
    }
}
