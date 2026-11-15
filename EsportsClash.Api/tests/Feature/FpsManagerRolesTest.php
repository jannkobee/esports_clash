<?php
namespace Tests\Feature;

use App\Models\User;
use App\Services\{FpsPlayerArchitecture,OnlineService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB,Queue};
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FpsManagerRolesTest extends TestCase
{
    use RefreshDatabase;
    protected function setUp():void {parent::setUp();Queue::fake();$this->artisan('online:install-catalog')->assertSuccessful();}

    public function test_players_start_unassigned_and_suggestions_do_not_assign_them():void
    {
        $user=User::factory()->create();Sanctum::actingAs($user);$service=app(OnlineService::class);$service->provision($user);
        $system=$this->getJson('/api/v1/online/fps-system')->assertOk()->json('data');
        $this->assertCount(5,$system['recommendations']);$this->assertEmpty($system['instructions']);$this->assertDatabaseCount('fps_team_systems',0);
        foreach($this->getJson('/api/v1/online/fps-identities')->assertOk()->json('data') as $player)$this->assertNull($player['assignments']);
        try{$service->queue($user);$this->fail('An unassigned human lineup entered matchmaking.');}
        catch(ValidationException $error){$this->assertArrayHasKey('instructions.t',$error->errors());}
        $this->assertDatabaseCount('normal_queue_tickets',0);
    }

    public function test_manager_can_save_partial_roles_clear_them_and_choose_the_complete_lineup():void
    {
        $user=User::factory()->create();Sanctum::actingAs($user);$service=app(OnlineService::class);$club=$service->provision($user);
        $system=$this->getJson('/api/v1/online/fps-system')->assertOk()->json('data');$id=$system['starterIds'][0];
        $draft=[$id=>['t'=>'T_SUPPORT','instruction'=>'balanced','training'=>'system']];
        $this->putJson('/api/v1/online/fps-system',['revision'=>0,'gameplan'=>$system['gameplan'],'instructions'=>$draft])->assertOk();
        $profile=collect($this->getJson('/api/v1/online/fps-identities')->assertOk()->json('data'))->firstWhere('player_id',$id);
        $this->assertSame(['t'=>'T_SUPPORT'],$profile['assignments']);
        $draft[$id]=['instruction'=>'balanced','training'=>'system'];
        $this->putJson('/api/v1/online/fps-system',['revision'=>1,'gameplan'=>$system['gameplan'],'instructions'=>$draft])->assertOk();
        $profile=collect($this->getJson('/api/v1/online/fps-identities')->assertOk()->json('data'))->firstWhere('player_id',$id);$this->assertNull($profile['assignments']);
        $orders=[];foreach($system['recommendations'] as $playerId=>$roles)$orders[$playerId]=array_merge($roles,['instruction'=>'balanced','training'=>'system']);
        // A manager may override a recommendation without changing the player's attributes.
        $other=collect($orders)->keys()->first(fn($key)=>$key!==$id);
        [$orders[$id]['t'],$orders[$other]['t']]=[$orders[$other]['t'],$orders[$id]['t']];
        $this->putJson('/api/v1/online/fps-system',['revision'=>2,'gameplan'=>$system['gameplan'],'instructions'=>$orders])->assertOk();
        $saved=json_decode(DB::table('fps_team_systems')->where('club_id',$club->id)->value('instructions'),true);$this->assertSame($orders,$saved);
        $this->assertCount(5,app(FpsPlayerArchitecture::class)->assignments($system['starterIds'],$saved));
        $this->assertSame('queued',$service->queue($user)['ticket']->status);
    }

    public function test_suggested_roles_are_team_choices_that_change_with_player_strengths():void
    {
        $architecture=app(FpsPlayerArchitecture::class);$players=[];
        foreach(['a','b','c','d','e'] as $id)$players[$id]=['stats'=>array_fill_keys(FpsPlayerArchitecture::ATTRIBUTES,50)];
        $players['b']['stats']['shotcalling']=99;$players['c']['stats']['entry']=99;$players['c']['stats']['rifling']=99;
        $roles=$architecture->recommendedAssignments($players,[]);$this->assertSame('T_IGL',$roles['b']['t']);$this->assertSame('T_ENTRY',$roles['c']['t']);
        $this->assertArrayNotHasKey('assignments',$players['b']);
    }
}
