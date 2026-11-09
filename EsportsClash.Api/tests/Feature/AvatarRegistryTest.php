<?php
namespace Tests\Feature;
use App\Models\{GameContent,ManagedContent,User};
use App\Services\{AvatarEvolutionService,GameContentService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AvatarRegistryTest extends TestCase {
    use RefreshDatabase;
    private function input(GameContent $entry):array {
        return ['version'=>$entry->version,'data'=>array_intersect_key($entry->payload,array_flip(['displayName','title','archetype','lore','primaryColor','accentColor','hp','ad','armor','mr','aspd','range']))];
    }
    public function test_registry_seeds_all_current_avatars_and_keeps_artifact_identity():void {
        $this->assertSame(45,GameContent::where('kind','avatar')->count());
        $source=collect(json_decode(file_get_contents(resource_path('avatars/catalog.json')),true)['avatars'])->keyBy('id');
        $catalog=app(AvatarEvolutionService::class)->catalog();
        $this->assertCount(45,$catalog);
        foreach($catalog as $meta){
            $this->assertSame($source[$meta['id']]['sha256'],$meta['sha256']);
            $this->assertSame($source[$meta['id']]['file'],$meta['file']);
            $this->assertSame(GameContent::findOrFail($meta['id'])->payload['displayName'],$meta['name']);
            $this->assertSame(GameContent::findOrFail($meta['id'].':skill1')->payload['name'],$meta['abilities'][0]['name']);
        }
    }
    public function test_owner_publication_reaches_api_and_art_tools_without_changing_frozen_snapshots_or_drafts():void {
        $entry=GameContent::where('kind','avatar')->firstOrFail();$before=app(GameContentService::class)->snapshot();
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $draft=ManagedContent::create(['kind'=>'avatar','source_id'=>$entry->id,'name'=>'Retained draft','payload'=>['displayName'=>'Retained draft','designBrief'=>['appearancePrompt'=>'Saved appearance']]]);
        $this->get('/evolution/registry/avatars')->assertOk()->assertSee('Solenne Vaelor');
        $this->get('/evolution/registry/avatars/'.$entry->id)->assertOk()->assertSee('Retained draft')->assertSee('Connected skills');
        $input=$this->input($entry);$input['data']['displayName']='Published identity';$input['data']['hp']=1500;
        $url='/evolution/registry/avatars/'.$entry->id;
        $this->put($url,$input)->assertSessionHasNoErrors();
        $snapshot=$this->getJson('/api/v1/game-content')->assertOk()->json();
        $saved=collect($snapshot['records'])->firstWhere('id',$entry->id);
        $this->assertSame('Published identity',$saved['data']['displayName']);$this->assertSame(1500,$saved['data']['hp']);
        $this->assertNotSame($before['hash'],$snapshot['hash']);
        $this->assertNotSame(collect($before['records'])->firstWhere('id',$entry->id)['data']['displayName'],$saved['data']['displayName']);
        $meta=collect(app(AvatarEvolutionService::class)->catalog())->firstWhere('id',$entry->id);
        $this->assertSame('Published identity',$meta['name']);$this->assertSame('Retained draft',$draft->fresh()->name);
        $this->assertDatabaseHas('game_content_revisions',['content_id'=>$entry->id,'version'=>2,'action'=>'publish']);
        $this->put($url,$input)->assertSessionHasErrors('version');
        $input=$this->input($entry->fresh());$input['data']['canonicalId']='rebind';
        $this->put($url,$input)->assertSessionHasErrors('data');
        $input=$this->input($entry->fresh());$input['data']['hp']=-1;
        $this->put($url,$input)->assertSessionHasErrors('data.hp');
    }
    public function test_registry_mutations_require_owner_and_unknown_avatars_are_rejected():void {
        $entry=GameContent::where('kind','avatar')->firstOrFail();$url='/evolution/registry/avatars/'.$entry->id;
        $this->get('/evolution/registry/avatars')->assertRedirect('/login');
        $this->put($url,$this->input($entry))->assertRedirect('/login');
        $this->actingAs(User::factory()->create());$this->put($url,$this->input($entry))->assertForbidden();
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->get('/evolution/registry/avatars/c_unknown')->assertNotFound();
    }
}
