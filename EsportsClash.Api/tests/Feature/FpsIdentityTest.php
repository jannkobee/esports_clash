<?php

namespace Tests\Feature;

use App\Models\{OnlineMatch,OwnedPlayerCard,User};
use App\Services\{FpsIdentityEngine,FpsIdentityProfiles,OnlineService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB,Queue};
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FpsIdentityTest extends TestCase
{
    use RefreshDatabase;
    protected function setUp():void {parent::setUp();Queue::fake();$this->artisan('online:install-catalog')->assertSuccessful();}
    private function allocate():OnlineMatch {
        DB::table('fps_identity_settings')->where('id',1)->update(['enabled'=>true]);
        $service=app(OnlineService::class);$service->queue(User::factory()->create());return $service->queue(User::factory()->create())['match'];
    }
    public function test_new_allocations_pin_real_identities_and_private_state_is_not_serialized():void {
        $match=$this->allocate();$this->assertSame(3,$match->plan['fps']['simulation_version']);
        $pin=$match->plan['fps_identity'];$this->assertCount(10,$pin['players']);
        foreach($pin['players'] as $id=>$identity){$this->assertSame($id,$identity['id']);$this->assertNotEmpty($identity['personality']['id']);$this->assertCount(12,$identity['dna']);}
        $this->assertNotEmpty($pin['teams']['blue']['coachName']);
        $this->assertArrayNotHasKey('fps_identity',$match->toArray()['plan']);
        $this->assertSame($match->fresh()->plan['fps_identity'],$pin);
    }
    public function test_verified_development_is_idempotent_and_relationships_require_recorded_trades():void {
        $match=$this->allocate();$blue=array_column($match->plan['blue'],'instance_id');$red=array_column($match->plan['red'],'instance_id');
        $events=[['type'=>'kill','actorId'=>$red[0],'targetId'=>$blue[0],'second'=>20,'text'=>'Opening contact.'],['type'=>'trade_kill','actorId'=>$blue[1],'targetId'=>$red[0],'second'=>21,'text'=>'A recorded trade.']];
        $match->update(['status'=>'completed','result'=>['report'=>['events'=>$events,'totalRounds'=>16,'roundSnapshots'=>[['playerId'=>$blue[1],'tactics'=>['role'=>'trade']]]]]]);
        $engine=app(FpsIdentityEngine::class);$engine->apply($match);$before=DB::table('fps_player_identities')->orderBy('player_id')->get()->toJson();$engine->apply($match);
        $this->assertSame($before,DB::table('fps_player_identities')->orderBy('player_id')->get()->toJson());
        $this->assertDatabaseCount('fps_identity_applications',1);$this->assertDatabaseCount('fps_player_relationships',2);
        $row=DB::table('fps_player_identities')->where('player_id',$blue[1])->first();$dev=json_decode($row->development,true);
        $this->assertSame(1,$dev['appearances']);$this->assertGreaterThan(0,$dev['role_familiarity']['trade']);
        $this->assertNotEmpty($dev['systems']);
        $this->assertArrayNotHasKey('dna',app(FpsIdentityProfiles::class)->scouting($row));
    }
    public function test_manager_controls_validate_ownership_and_revisions_and_hide_dna():void {
        $user=User::factory()->create();Sanctum::actingAs($user);app(OnlineService::class)->provision($user);
        $response=$this->getJson('/api/v1/online/fps-system')->assertOk()->json('data');
        $id=OwnedPlayerCard::where('user_id',$user->id)->first()->id;
        $orders=['revision'=>0,'gameplan'=>$response['gameplan'],'instructions'=>[$id=>['role'=>'lurker','instruction'=>'hold','training'=>'sniper']]];
        $this->putJson('/api/v1/online/fps-system',$orders)->assertOk()->assertJsonPath('data.instructions.'.$id.'.role','lurker');
        $this->putJson('/api/v1/online/fps-system',$orders)->assertStatus(409);
        $orders['revision']=1;$orders['instructions']=['00000000-0000-4000-8000-000000000000'=>['role'=>'sniper','instruction'=>'balanced']];
        $this->putJson('/api/v1/online/fps-system',$orders)->assertStatus(422);
        $profiles=$this->postJson('/api/v1/online/fps-identities/prepare')->assertOk()->json('data');
        $this->assertNotEmpty($profiles);foreach($profiles as $profile){$this->assertArrayNotHasKey('dna',$profile);$this->assertArrayHasKey('coach_fit',$profile);}
        $this->postJson('/api/v1/online/fps-identities/prepare')->assertOk();
        $this->assertSame(count($profiles),DB::table('fps_player_identities')->count());
    }
    public function test_dna_matches_shared_typescript_vectors_and_identity_preparation_does_not_reroll():void {
        $vectors=json_decode(file_get_contents(__DIR__.'/../Fixtures/fps-identity-dna.json'),true,512,JSON_THROW_ON_ERROR);
        foreach($vectors as $id=>$expected)$this->assertSame($expected,app(FpsIdentityProfiles::class)->dna($id));
        $match=$this->allocate();$id=$match->plan['blue'][0]['instance_id'];$player=OwnedPlayerCard::findOrFail($id);
        $before=DB::table('fps_player_identities')->where('player_id',$id)->first();
        app(FpsIdentityProfiles::class)->initialize($player,['primaryPersonality'=>'survivalist','stats'=>array_fill_keys(['lan','tf','iq','ldr','clu','sta','flx'],99)]);
        $after=DB::table('fps_player_identities')->where('player_id',$id)->first();
        $this->assertSame($before->dna,$after->dna);$this->assertSame($before->personality_id,$after->personality_id);$this->assertSame($before->specialty_id,$after->specialty_id);
    }
    public function test_v3_settlement_rejects_private_dna_and_applies_development_once():void {
        $match=$this->allocate();$stats=[];$performance=[];
        foreach(['blue','red'] as $side)foreach($match->plan[$side] as $slot){
            $id=$slot['instance_id'];$base=array_fill_keys(['kills','deaths','assists','damage','adr','plants','defuses'],0);
            $stats[$id]=array_merge($base,['playerId'=>$id,'team'=>$side,'name'=>'Test','headshotRate'=>0,'firstBloods'=>0,'tradeKills'=>0,'clutchesWon'=>0,'setPiecesInvolved'=>0]);
            $performance[]=array_merge($base,['instance_id'=>$id,'team'=>$side,'headshot_rate'=>0,'first_bloods'=>0,'trade_kills'=>0,'clutches_won'=>0,'set_pieces_involved'=>0]);
        }
        $rounds=[];for($i=1;$i<=16;$i++)$rounds[]=['roundNumber'=>$i,'winnerTeam'=>'blue','winnerSide'=>'attackers','reason'=>'defenders_eliminated','roundDurationSeconds'=>60,'blueScoreAfter'=>$i,'redScoreAfter'=>0];
        $result=['match_id'=>$match->id,'game_mode'=>'fps_mr15_v1','versions'=>$match->plan['versions'],'seed'=>$match->plan['seed'],'winner'=>'blue','player_performance'=>$performance,'report'=>['format'=>'MR15_TACTICAL_FPS','simulationVersion'=>3,'winner'=>'blue','winnerTeam'=>'blue','mapId'=>$match->plan['fps']['map_id'],'seed'=>$match->plan['seed'],'totalRounds'=>16,'durationSeconds'=>960,'finalScore'=>['blue'=>16,'red'=>0],'roundResults'=>$rounds,'playerStats'=>$stats,'events'=>[]]];
        $bad=$result;$bad['report']['dna']=['riskTolerance'=>50];
        try{app(OnlineService::class)->settle($match->id,$bad,1);$this->fail('Private DNA was accepted.');}catch(\Illuminate\Validation\ValidationException $e){$this->assertNotEmpty($e->errors());}
        $completed=app(OnlineService::class)->settle($match->id,$result,2);$this->assertSame('completed',$completed->status);
        app(OnlineService::class)->settle($match->id,$result,2);$this->assertDatabaseCount('fps_identity_applications',1);
        foreach(DB::table('fps_player_identities')->get() as $row)$this->assertSame(1,json_decode($row->development,true)['appearances']);
    }
    public function test_transfer_directory_filters_persistent_personalities_without_exposing_dna():void {
        $service=app(OnlineService::class);$seller=$service->provision(User::factory()->create());
        app(\App\Services\ClubMarketService::class)->scout($seller);
        $reserve=OwnedPlayerCard::where('user_id',$seller->user_id)->whereNotIn('id',array_column($seller->lineup,'instance_id'))->firstOrFail();
        $template=collect($service->activeCatalog()->payload['cards'])->firstWhere('id',$reserve->definition_id);
        app(FpsIdentityProfiles::class)->initialize($reserve,$template);
        app(\App\Services\ClubMarketService::class)->list($seller,$reserve->id,5000);
        $identity=DB::table('fps_player_identities')->where('player_id',$reserve->id)->first();
        $buyer=$service->provision(User::factory()->create());
        $directory=app(\App\Services\AuctionDirectory::class);
        $page=$directory->page($buyer,$service->activeCatalog(),['personality'=>$identity->personality_id]);
        $this->assertSame(1,$page['meta']['total']);$row=collect($page['items'])->first();
        $this->assertSame($reserve->id,$row['player_id']);$this->assertSame($identity->personality_id,$row['fpsIdentity']['personality_id']);
        $this->assertArrayNotHasKey('dna',$row['fpsIdentity']);
        $other=collect(FpsIdentityProfiles::PERSONALITIES)->first(fn($id)=>$id!==$identity->personality_id);
        $this->assertSame(0,$directory->page($buyer,$service->activeCatalog(),['personality'=>$other])['meta']['total']);
    }
}
