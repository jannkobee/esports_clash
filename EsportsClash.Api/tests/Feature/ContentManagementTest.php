<?php
namespace Tests\Feature;
use App\Models\{ManagedContent,User};
use App\Services\ContentManagementService as Content;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http,Queue};
use Tests\TestCase;
class ContentManagementTest extends TestCase {
    use RefreshDatabase;
    private function owner(): void { $this->actingAs(User::factory()->create(['is_evolution_admin'=>true])); }
    private function input(string $kind, ?array $payload=null): array {
        $p=$payload??app(Content::class)->defaults($kind);
        if($kind==='avatar') {
            $p['displayName']=$p['displayName']?:'Test mage';$p['title']=$p['title']?:'Storm keeper';$p['archetype']=$p['archetype']?:'Elemental mage';$p['passiveDesc']=$p['passiveDesc']?:'Builds charge.';
            $keys=['displayName','title','primaryRole','secondaryRole','archetype','passiveDesc','primaryColor','accentColor',...array_keys(Content::AVATAR_STATS),...array_keys(Content::SLOTS)];
            foreach(Content::SLOTS as $slot=>$label) {
                $p[$slot]=array_intersect_key($p[$slot],array_flip(['name','desc','damage','cooldown','damageType','castType']));
                $p[$slot]['name']=$p[$slot]['name']?:$label;$p[$slot]['desc']=$p[$slot]['desc']?:'Launch an arcane bolt.';
                $p[$slot]['castType']=$p[$slot]['castType']??'unit';
                $b['skills'][$slot]=['gameplayPrompt'=>'Target an enemy.','appearancePrompt'=>'Amber trail and flash.','animationPrompt'=>'Wind up, strike, recover.'];
            }
            $b['passivePrompt']='Charge glows around the hands.';
        } else {
            $keys=['name','cost','tier','icon','stats','passiveName','passiveDesc','suitableRoles'];
            $p['name']=$p['name']?:'Test blade';$p['passiveName']=$p['passiveName']?:'Spark';$p['passiveDesc']=$p['passiveDesc']?:'Proposed on-hit effect.';$p['stats']=$p['stats']?:['ad'=>10];$p['suitableRoles']=$p['suitableRoles']?:['Fighter'];
            $b['effectPrompt']='Brief amber flash on a successful hit.';
        }
        $b['appearancePrompt']='A clear amber silhouette, brass and obsidian.';
        return ['data'=>array_intersect_key($p,array_flip($keys)),'brief'=>$b];
    }
    public function test_owner_screens_and_all_mutations_are_protected(): void {
        $this->get('/evolution/management/avatar')->assertRedirect('/login');
        $this->actingAs(User::factory()->create());
        foreach(['avatar','item'] as $kind) {
            $this->get('/evolution/management/'.$kind)->assertForbidden();
            $this->get('/evolution/management/'.$kind.'/create')->assertForbidden();
            $this->post('/evolution/management/'.$kind,$this->input($kind))->assertForbidden();
            $this->post('/evolution/management/'.$kind.'/import')->assertForbidden();
        }
        $this->owner();
        foreach(['avatar','item'] as $kind) {
            $this->get('/evolution/management/'.$kind)->assertOk()->assertSee(ucfirst($kind).' management');
            $this->get('/evolution/management/'.$kind.'/create')->assertOk()->assertSee('Save draft');
        }
        $this->get('/evolution/management/unknown')->assertNotFound();
    }
    public function test_create_review_update_archive_restore_and_export_are_versioned_without_jobs(): void {
        $this->owner();Http::fake();Queue::fake();$catalogHash=hash_file('sha256',resource_path('game/catalog.json'));
        $this->post('/evolution/management/avatar',$this->input('avatar'))->assertSessionHasNoErrors()->assertRedirect();
        $entry=ManagedContent::firstOrFail();$base='/evolution/management/avatar/'.$entry->id;
        $this->assertSame(1,$entry->version);$this->assertSame('draft',$entry->status);$original=$entry->payload;
        $this->get($base.'/edit')->assertOk()->assertSee('Test mage')->assertSee('Skill animation prompt');
        $this->post($base.'/action',['version'=>1,'action'=>'review'])->assertSessionHasNoErrors();
        $this->assertSame('review',$entry->fresh()->status);
        $input=$this->input('avatar',$entry->fresh()->payload);$input['version']=2;$input['data']['displayName']='Updated mage';
        $this->put($base,$input)->assertSessionHasNoErrors();$entry->refresh();
        $this->assertSame('draft',$entry->status);$this->assertSame(3,$entry->version);
        $this->put($base,$input)->assertSessionHasErrors('version');$this->assertSame(3,$entry->fresh()->version);
        $this->post($base.'/action',['version'=>3,'action'=>'archive'])->assertSessionHasNoErrors();
        $this->put($base,array_replace($input,['version'=>4]))->assertSessionHasErrors('content');
        $this->post($base.'/action',['version'=>4,'action'=>'restore'])->assertSessionHasNoErrors();
        $this->post($base.'/action',['version'=>5,'action'=>'restore_revision','revision'=>1])->assertSessionHasNoErrors();
        $this->assertSame($original,$entry->fresh()->payload);$this->assertSame(6,$entry->fresh()->version);$this->assertSame(6,$entry->revisions()->count());
        $this->get($base.'/download')->assertOk()->assertDownload();
        $this->get($base.'/download?format=prompt')->assertOk()->assertSee('Skill 1')->assertSee('Not published');
        $this->get(str_replace('/avatar/','/item/',$base).'/edit')->assertNotFound();
        $this->assertSame($catalogHash,hash_file('sha256',resource_path('game/catalog.json')));Http::assertNothingSent();Queue::assertNothingPushed();
        $this->actingAs(User::factory()->create());
        $this->put($base,$input)->assertForbidden();$this->post($base.'/action',['version'=>6,'action'=>'archive'])->assertForbidden();$this->get($base.'/download')->assertForbidden();
    }
    public function test_invalid_stats_targeting_and_unexpected_keys_are_rejected_and_input_retained(): void {
        $this->owner();$input=$this->input('avatar');$input['data']['hp']=-1;$input['data']['skill1']['castType']='execute-code';$input['data']['skill2']['damage']=-50;$input['data']['secondaryRole']='Mage';
        $this->from('/evolution/management/avatar/create')->post('/evolution/management/avatar',$input)->assertSessionHasErrors(['data.hp','data.skill1.castType','data.skill2.damage','data.secondaryRole'])->assertSessionHasInput('data.displayName','Test mage');
        $this->assertDatabaseCount('managed_contents',0);
        $item=$this->input('item');$item['data']['stats']['crit']=101;$item['data']['stats']['php']='exec';$item['data']['suitableRoles']=[];
        $this->post('/evolution/management/item',$item)->assertSessionHasErrors(['data.stats','data.stats.crit','data.suitableRoles']);
        $item=$this->input('item');$item['data']['cost']='not money';$item['data']['tier']='OP';
        $this->post('/evolution/management/item',$item)->assertSessionHasErrors(['data.cost','data.tier']);
    }
    public function test_drafts_allow_missing_prompts_but_review_requires_complete_prompts(): void {
        $this->owner();$input=$this->input('item');$input['brief']=['appearancePrompt'=>''];
        $this->post('/evolution/management/item',$input)->assertSessionHasNoErrors();$entry=ManagedContent::firstOrFail();
        $this->post('/evolution/management/item/'.$entry->id.'/action',['version'=>1,'action'=>'review'])->assertSessionHasErrors('content');
        $this->assertSame('draft',$entry->fresh()->status);
        $this->get('/evolution/management/item/'.$entry->id.'/edit')->assertOk()->assertSee('Item effect prompt');
    }
    public function test_catalog_import_is_idempotent_and_existing_drafts_survive_refresh(): void {
        $this->owner();
        foreach(['avatar'=>45,'item'=>49] as $kind=>$count) {
            $this->post('/evolution/management/'.$kind.'/import')->assertSessionHasNoErrors();
            $this->assertSame($count,ManagedContent::where('kind',$kind)->count());
            $entry=ManagedContent::where('kind',$kind)->firstOrFail();$entry->update(['name'=>'Edited draft']);
            $this->post('/evolution/management/'.$kind.'/import')->assertSessionHasNoErrors();
            $this->assertSame($count,ManagedContent::where('kind',$kind)->count());$this->assertSame('Edited draft',$entry->fresh()->name);
        }
        $this->assertDatabaseCount('managed_content_revisions',94);
    }
    public function test_every_imported_definition_can_roundtrip_and_extra_engine_skill_fields_survive(): void {
        $this->owner();$service=app(Content::class);
        foreach(['avatar','item'] as $kind) {
            $service->import($kind,auth()->id());
            foreach(ManagedContent::where('kind',$kind)->get() as $entry) {
                $original=$entry->payload;
                $input=$this->input($kind,$original);$input['version']=$entry->version;
                $this->put('/evolution/management/'.$kind.'/'.$entry->id,$input)->assertSessionHasNoErrors();
                $saved=$entry->fresh()->payload;
                $this->assertSame($original['id'],$saved['id']);
                if($kind==='avatar') foreach(Content::SLOTS as $slot=>$label) foreach($original[$slot] as $key=>$value) {
                    if(!array_key_exists($key,$input['data'][$slot])) $this->assertSame($value,$saved[$slot][$key]);
                }
            }
        }
    }
    public function test_saved_appearance_brief_connects_to_manual_generation_only(): void {
        $this->owner();Queue::fake();Http::fake(['*'=>Http::response([],200)]);
        $service=app(Content::class);$service->import('avatar',auth()->id());
        $entry=ManagedContent::where('source_id','c_solana')->firstOrFail();
        $input=$this->input('avatar',$entry->payload);$input['version']=1;
        $input['brief']['appearancePrompt']='Unique amber armor with brass sun shield.';
        $this->put('/evolution/management/avatar/'.$entry->id,$input)->assertSessionHasNoErrors();
        $this->get('/evolution/avatars/trellis?design='.$entry->id)->assertOk()->assertSee('Unique amber armor with brass sun shield.')->assertSee('This only prepares the prompt');
        $this->assertDatabaseCount('trellis_generations',0);Queue::assertNothingPushed();
        $this->post('/evolution/management/avatar/'.$entry->id.'/action',['version'=>2,'action'=>'archive'])->assertSessionHasNoErrors();
        $this->get('/evolution/avatars/trellis?design='.$entry->id)->assertNotFound();
    }

}
