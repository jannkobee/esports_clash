<?php
namespace Tests\Feature;
use App\Models\User;
use App\Services\AvatarComponentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{DB,Http,Queue,Storage};
use Tests\TestCase;
class AvatarComponentTest extends TestCase {
    use RefreshDatabase;
    protected function setUp():void{parent::setUp();Storage::fake('local');Http::fake();Queue::fake();}
    private function input(int $version=0):array{return ['version'=>$version,'component_id'=>'outfit','label'=>'Pattern cape','category'=>'outfit','binding'=>'skinned','attachment'=>'torso','prompt'=>'Separate cape reference.'];}
    private function png():UploadedFile{return UploadedFile::fake()->createWithContent('cape.png',base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='));}
    public function test_owner_upload_is_versioned_and_shared_without_queue_or_publication():void{
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->post(route('avatar-components.save','c_invoker'),[...$this->input(),'asset'=>$this->png()])->assertSessionHasNoErrors();
        $inventory=app(AvatarComponentService::class)->inventory('c_invoker');$item=$inventory['components'][0];
        $this->assertSame('reference_uploaded',$item['status']);$this->assertNull($item['model']);
        $this->assertDatabaseCount('avatar_component_revisions',1);
        $this->getJson('/api/v1/avatars/c_invoker/components')->assertOk()->assertJsonFragment(['id'=>'outfit','reference_sha256'=>$item['reference']['sha256']])->assertJsonMissingPath('components.1.prompt');
        $this->get(route('avatar-components.file',['c_invoker',$item['reference']['sha256'],'png']))->assertOk();
        $this->get(route('avatar-components.file',['c_astra',$item['reference']['sha256'],'png']))->assertNotFound();
        $this->post(route('avatar-components.save','c_invoker'),$this->input())->assertSessionHasErrors('version');
        $this->assertDatabaseCount('avatar_component_revisions',1);Queue::assertNothingPushed();Http::assertNothingSent();
    }
    public function test_model_keeps_reference_and_all_prior_revisions():void{
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->post(route('avatar-components.save','c_invoker'),[...$this->input(),'asset'=>$this->png()])->assertSessionHasNoErrors();
        $reference=app(AvatarComponentService::class)->inventory('c_invoker')['components'][0]['reference'];
        $json=json_encode(['asset'=>['version'=>'2.0']]);$json=str_pad($json,(int)(ceil(strlen($json)/4)*4),' ');
        $glb='glTF'.pack('VVVV',2,20+strlen($json),strlen($json),0x4e4f534a).$json;
        $this->post(route('avatar-components.save','c_invoker'),[...$this->input(1),'asset'=>UploadedFile::fake()->createWithContent('cape.glb',$glb)])->assertSessionHasNoErrors();
        $item=app(AvatarComponentService::class)->inventory('c_invoker')['components'][0];
        $this->assertSame($reference,$item['reference']);$this->assertSame('model_unqualified',$item['status']);
        $this->assertDatabaseCount('avatar_component_revisions',2);
        $old=json_decode(DB::table('avatar_component_revisions')->where('version',1)->value('components'),true);
        $this->assertNull($old[0]['model']);Queue::assertNothingPushed();
    }
    public function test_rejects_non_owner_unknown_avatar_bad_files_and_companion_hand_binding():void{
        $this->post(route('avatar-components.save','c_invoker'),$this->input())->assertRedirect('/login');
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>false]));
        $this->post(route('avatar-components.save','c_invoker'),$this->input())->assertForbidden();
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->post(route('avatar-components.save','unknown'),$this->input())->assertNotFound();
        $this->post(route('avatar-components.save','c_invoker'),[...$this->input(),'asset'=>UploadedFile::fake()->createWithContent('bad.glb','glTFbad')])->assertSessionHasErrors('asset');
        $this->post(route('avatar-components.save','c_invoker'),[...$this->input(),'category'=>'companion','binding'=>'rigid'])->assertSessionHasErrors('binding');
        $this->post(route('avatar-components.save','c_invoker'),[...$this->input(),'component_id'=>'primary'])->assertSessionHasErrors('component_id');
        $this->assertDatabaseCount('avatar_component_revisions',0);Queue::assertNothingPushed();
    }
}
