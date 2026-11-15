<?php
namespace Tests\Feature;

use App\Models\{User,OwnedPlayerCard};
use App\Services\{FpsPlayerArchitecture,FpsIdentityProfiles,OnlineService,WorldPlayerProfiles};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB,Schema,Queue};
use Tests\TestCase;

class FpsPlayerArchitectureTest extends TestCase
{
    use RefreshDatabase;
    protected function setUp():void {parent::setUp();Queue::fake();$this->artisan('online:install-catalog')->assertSuccessful();}

    public function test_all_personalities_can_be_persisted_loaded_and_pinned_without_reading_attributes():void
    {
        $architecture=app(FpsPlayerArchitecture::class);$personalities=$architecture->personalities();
        $this->assertCount(54,$personalities);$this->assertCount(18,$architecture->catalog()['profiles']);
        $this->assertCount(54,array_unique(array_column($personalities,'id')));
        $club=app(OnlineService::class)->provision(User::factory()->create());
        $id=$club->lineup[0]['instance_id'];$row=DB::table('fps_player_identities')->where('player_id',$id)->first();
        foreach($personalities as $personality){
            DB::table('fps_player_identities')->where('player_id',$id)->update(['personality'=>json_encode($personality)]);
            $loaded=DB::table('fps_player_identities')->where('player_id',$id)->first();
            $report=app(FpsIdentityProfiles::class)->scouting($loaded);
            $this->assertSame($personality,$report['personality']);$this->assertArrayNotHasKey('dna',$report);$this->assertArrayNotHasKey('specialty_id',$report);
        }
        $this->assertSame($row->dna,DB::table('fps_player_identities')->where('player_id',$id)->value('dna'));
        $generated=[];for($i=0;$i<4000;$i++)$generated[]=$architecture->generate('generated-'.$i)['id'];$this->assertCount(54,array_unique($generated));
    }

    public function test_side_assignments_are_complete_unique_and_not_a_weapon_requirement():void
    {
        $architecture=app(FpsPlayerArchitecture::class);$ids=['a','b','c','d','e'];
        $orders=[];foreach($ids as $i=>$id)$orders[$id]=['t'=>$architecture->catalog()['tPositions'][$i],'ct'=>['CT_ANCHOR_B','CT_ROTATOR','CT_ANCHOR_A','CT_IGL','CT_FLEX'][$i]];
        $assignments=$architecture->assignments($ids,$orders);
        $this->assertSame('T_IGL',$assignments['a']['t']);$this->assertSame('CT_ANCHOR_B',$assignments['a']['ct']);
        $this->assertCount(5,array_unique(array_column($assignments,'t')));$this->assertCount(5,array_unique(array_column($assignments,'ct')));
        $this->assertSame(['a'=>['t'=>'T_IGL']],$architecture->assignments($ids,['a'=>['t'=>'T_IGL']],false));
        $this->expectException(\Illuminate\Validation\ValidationException::class);$architecture->assignments($ids,['a'=>['t'=>'T_IGL'],'b'=>['t'=>'T_IGL']]);
    }

    public function test_six_attributes_generate_and_train_without_reassigning_personality():void
    {
        config(['world_players.enabled'=>true]);$service=app(OnlineService::class);$club=$service->provision(User::factory()->create());
        $card=OwnedPlayerCard::findOrFail($club->lineup[0]['instance_id']);$template=collect($service->activeCatalog()->payload['cards'])->firstWhere('id',$card->definition_id);
        $before=app(WorldPlayerProfiles::class)->definition($card,$template);$identity=DB::table('fps_player_identities')->where('player_id',$card->id)->value('personality');
        $card->increment('training_xp',640);$after=app(WorldPlayerProfiles::class)->definition($card->fresh(),$template);
        $this->assertCount(6,$after['stats']);foreach(FpsPlayerArchitecture::ATTRIBUTES as $key)$this->assertGreaterThanOrEqual($before['stats'][$key],$after['stats'][$key]);
        $this->assertSame($identity,DB::table('fps_player_identities')->where('player_id',$card->id)->value('personality'));
    }

    public function test_migration_archives_legacy_records_and_is_idempotent_without_changing_players_or_history():void
    {
        $club=app(OnlineService::class)->provision(User::factory()->create());$id=$club->lineup[0]['instance_id'];
        Schema::table('fps_player_identities',function(Blueprint $t){$t->string('personality_id')->nullable();$t->string('specialty_id')->nullable();$t->string('legacy_primary')->nullable();$t->string('legacy_secondary')->nullable();});
        DB::table('fps_player_identities')->where('player_id',$id)->update(['schema_version'=>2,'personality'=>null,'personality_id'=>'icebound','specialty_id'=>'instant_refragger']);
        $before=DB::table('fps_player_identities')->where('player_id',$id)->first();$count=OwnedPlayerCard::count();
        $migration=require database_path('migrations/2026_11_14_000001_replace_fps_player_architecture.php');$migration->up();
        $after=DB::table('fps_player_identities')->where('player_id',$id)->first();
        $this->assertSame($before->dna,$after->dna);$this->assertSame(4,(int)$after->schema_version);$this->assertSame($count,OwnedPlayerCard::count());
        $this->assertFalse(Schema::hasColumn('fps_player_identities','specialty_id'));
        $archive=DB::table('fps_architecture_archives')->where('kind','identity')->where('record_id',$id)->first();$this->assertSame('instant_refragger',json_decode($archive->original,true)['specialty_id']);
        $migration->up();$this->assertSame($after->personality,DB::table('fps_player_identities')->where('player_id',$id)->value('personality'));$this->assertSame(1,DB::table('fps_architecture_archives')->where('kind','identity')->where('record_id',$id)->count());
    }

    public function test_recruitment_considers_behavioral_fit_without_automatic_pairing_bonuses():void
    {
        $architecture=app(FpsPlayerArchitecture::class);$base=['temperament'=>'STEADY','playstyle'=>'AGGRESSIVE','mindset'=>'INDIVIDUALIST','decisionStyle'=>'INSTINCTIVE'];
        $aggressive=['fpsIdentity'=>['personality'=>$architecture->personality($base)]];$passive=['fpsIdentity'=>['personality'=>$architecture->personality(array_replace($base,['playstyle'=>'PASSIVE','decisionStyle'=>'METHODICAL']))]];
        $this->assertGreaterThan($architecture->recruitmentFit($passive,['aggression'=>.9,'preparation'=>.15]),$architecture->recruitmentFit($aggressive,['aggression'=>.9,'preparation'=>.15]));
        $this->assertGreaterThan($architecture->recruitmentFit($aggressive,['aggression'=>.1,'preparation'=>.85]),$architecture->recruitmentFit($passive,['aggression'=>.1,'preparation'=>.85]));
    }
}
