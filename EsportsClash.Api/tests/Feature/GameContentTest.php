<?php
namespace Tests\Feature;
use App\Models\{GameContent, User};
use App\Services\GameContentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{DB, Storage};
use Tests\TestCase;

class GameContentTest extends TestCase {
    use RefreshDatabase;
    private function owner():void { $this->actingAs(User::factory()->create(['is_evolution_admin'=>true])); }
    private function item():array { return ['data'=>['name'=>'Test relic','cost'=>700,'tier'=>'Component','icon'=>'R','stats'=>['ad'=>40],'passiveName'=>'Power','passiveDesc'=>'Adds attack damage.','suitableRoles'=>['Fighter']]]; }
    public function test_seed_and_public_catalog_are_complete_and_owner_writes_are_protected():void {
        $this->assertDatabaseCount('game_contents',284);
        $this->getJson('/api/v1/game-content')->assertOk()->assertJsonCount(284,'records');
        $this->get('/evolution/catalog/item')->assertRedirect('/login');
        $this->post('/evolution/catalog/item',$this->item())->assertRedirect('/login');
        $this->actingAs(User::factory()->create());
        foreach(['item','skill'] as $kind) {
            $this->get('/evolution/catalog/'.$kind)->assertForbidden();
            $this->post('/evolution/catalog/'.$kind,$this->item())->assertForbidden();
        }
        $this->owner();
        foreach(['item','skill'] as $kind) {
            $this->get('/evolution/catalog/'.$kind)->assertOk()->assertSee('SHARED GAME CATALOG');
            $this->get('/evolution/catalog/'.$kind.'/create')->assertOk()->assertSee('image');
        }
    }
    public function test_item_crud_stale_version_and_snapshots_retain_original_values():void {
        $this->owner();$old=app(GameContentService::class)->snapshot();
        $this->post('/evolution/catalog/item',$this->item())->assertSessionHasNoErrors()->assertRedirect();
        $entry=GameContent::where('builtin',false)->firstOrFail();$url='/evolution/catalog/item/'.$entry->id;
        $this->get($url.'/edit')->assertOk()->assertSee('Test relic');
        $input=$this->item();$input['version']=1;$input['data']['cost']=900;$input['data']['stats']['ad']=55;
        $this->put($url,$input)->assertSessionHasNoErrors();
        $this->assertSame(55,$entry->fresh()->payload['stats']['ad']);
        $this->put($url,$input)->assertSessionHasErrors('version');
        $this->delete($url,['version'=>2])->assertSessionHasNoErrors();
        $this->assertSoftDeleted('game_contents',['id'=>$entry->id]);
        $this->assertTrue(collect(app(GameContentService::class)->snapshot()['records'])->firstWhere('id',$entry->id)['deleted']);
        $this->post($url.'/restore',['version'=>3])->assertSessionHasNoErrors();
        $this->assertFalse($entry->fresh()->trashed());
        $this->assertSame(4,$entry->fresh()->version);
        $this->assertSame(284,count($old['records']));
        $this->assertNotEquals($old['hash'],app(GameContentService::class)->snapshot()['hash']);
        $this->assertDatabaseCount('game_content_revisions',4);
    }
    public function test_bound_skill_values_can_change_but_binding_and_executor_cannot():void {
        $this->owner();$entry=GameContent::where('id','like','%:skill1')->firstOrFail();$url='/evolution/catalog/skill/'.$entry->id;
        $input=['version'=>1,'data'=>['name'=>'New name','desc'=>'Updated description','damage'=>321,'cooldown'=>2.5]];
        $this->put($url,$input)->assertSessionHasErrors('data.damage');
        $input['data']['damage']=$entry->payload['damage'];
        $this->put($url,$input)->assertSessionHasNoErrors();
        $saved=$entry->fresh()->payload;
        $this->assertSame($entry->payload['avatarId'],$saved['avatarId']);
        $this->assertSame($entry->payload['abilityRuleset'],$saved['abilityRuleset']);
        $this->assertSame($entry->payload['damage'],$saved['damage']);
        $this->get($url.'/edit')->assertOk()->assertSee('Updated description');
        $input['version']=2;$input['data']['avatarId']='c_other';
        $this->put($url,$input)->assertSessionHasErrors('data');
        $this->put('/evolution/catalog/item/'.$entry->id,$this->item())->assertNotFound();
    }
    public function test_library_skill_can_be_created_and_applied_to_an_existing_slot():void {
        $this->owner();
        $this->post('/evolution/catalog/skill',['data'=>['name'=>'Nova','desc'=>'A new name for the target effect.','damage'=>230,'cooldown'=>3]])->assertSessionHasNoErrors();
        $entry=GameContent::where('builtin',false)->firstOrFail();
        $target=GameContent::where('id','like','%:skill1')->firstOrFail();
        $original=$target->payload;
        $this->get('/evolution/catalog/skill/'.$entry->id.'/edit')->assertOk()->assertSee('Apply saved skill');
        $this->post('/evolution/catalog/skill/'.$entry->id.'/assign',['version'=>1,'binding'=>$target->id.'|1'])->assertSessionHasNoErrors();
        $saved=$target->fresh()->payload;
        $this->assertSame('Nova',$saved['name']);$this->assertSame($original['damage'],$saved['damage']);
        $this->assertSame($original['abilityRuleset'],$saved['abilityRuleset']);$this->assertSame($original['avatarId'],$saved['avatarId']);
        $this->post('/evolution/catalog/skill/'.$entry->id.'/assign',['version'=>1,'binding'=>$target->id.'|1'])->assertSessionHasErrors('version');
    }
    public function test_images_are_content_addressed_public_and_old_files_survive_replacement():void {
        Storage::fake('local');$this->owner();
        // Real PNG bytes avoid relying on an optional GD extension in the test runner.
        $bytes=base64_decode('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABPSURBVFhHxcihAQAwCMAwTufzcUB8J2Iys/u+ImpEjagRNaJG1IgaUSNqRI2oETWiRtSIGlEjakSNqBE1okbUiBpRI2pEjagRNaJG1IjYAZuT/GoDbWjGAAAAAElFTkSuQmCC');
        $file=UploadedFile::fake()->createWithContent('icon.png',$bytes);
        $input=$this->item();$input['image']=$file;
        $this->post('/evolution/catalog/item',$input)->assertSessionHasNoErrors();
        $entry=GameContent::where('builtin',false)->firstOrFail();$image=$entry->payload['image'];
        $this->assertSame(hash('sha256',$bytes).'.png',$image);
        $this->get('/api/v1/game-content/images/'.$image)->assertOk()->assertHeader('X-Content-Type-Options','nosniff');
        $input=$this->item();$input['version']=1;$input['remove_image']=1;
        $this->put('/evolution/catalog/item/'.$entry->id,$input)->assertSessionHasNoErrors();
        $this->assertArrayNotHasKey('image',$entry->fresh()->payload);
        Storage::disk('local')->assertExists('catalog-images/'.$image);
        $this->get('/api/v1/game-content/images/not-a-hash.png')->assertNotFound();
    }
    public function test_invalid_values_and_executable_uploads_are_rejected():void {
        Storage::fake('local');$this->owner();$input=$this->item();
        $input['data']['cost']=-1;$input['data']['stats']['ad']=100000;
        $input['image']=UploadedFile::fake()->createWithContent('icon.svg','<svg xmlns="http://www.w3.org/2000/svg"/>');
        $this->post('/evolution/catalog/item',$input)->assertSessionHasErrors(['data.cost','data.stats.ad','image']);
        $this->post('/evolution/catalog/skill',['data'=>['name'=>'Invalid','desc'=>'Test','damage'=>-1,'cooldown'=>601]])->assertSessionHasErrors(['data.damage','data.cooldown']);
        $this->assertDatabaseCount('game_contents',284);
        $this->assertSame([],Storage::disk('local')->allFiles());
    }
}
