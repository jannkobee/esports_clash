<?php
namespace Tests\Feature;
use App\Models\{AvatarBaseCandidate,GameContent,TrellisGeneration,User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;
class AvatarFreshStartTest extends TestCase {
    use RefreshDatabase;
    public function test_reset_retires_only_payload_eligibility_and_new_generations_use_the_current_epoch():void {
        $old=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'generated_unqualified','plan'=>['version'=>1]]);
        $entry=GameContent::findOrFail('c_invoker');$p=$entry->payload;$p['assets']=['epoch'=>'new-test-epoch','status'=>'missing'];$entry->update(['payload'=>$p]);
        $new=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'generated_unqualified','plan'=>['version'=>1]]);
        $this->assertSame('new-test-epoch',$new->asset_epoch);$this->assertSame(2,TrellisGeneration::count());
        $this->assertSame([$new->id],TrellisGeneration::currentAssets()->pluck('id')->all());
        $this->assertSame('generated_unqualified',$old->fresh()->status);$this->assertSame(['version'=>1],$old->fresh()->plan);
        $this->assertNull(collect(app(\App\Services\AvatarRegistryService::class)->catalog())->firstWhere('id','c_invoker')['file']);
    }
    public function test_base_candidates_are_owner_only_and_files_are_hash_verified():void {
        $bytes='independent-test-artifact';$id=(string)Str::uuid();
        $candidate=AvatarBaseCandidate::create(['id'=>$id,'avatar_id'=>'c_invoker','asset_epoch'=>'test','status'=>'animated_base_unqualified','report'=>['provider'=>'test','bones'=>48,'clips'=>[]],
            'artifacts'=>['mirelle-base-animated.glb'=>['bytes'=>strlen($bytes),'sha256'=>hash('sha256',$bytes)]]]);
        $url='/evolution/registry/avatars/c_invoker/base/'.$id;
        $this->get($url)->assertRedirect('/login');$this->actingAs(User::factory()->create());$this->get($url)->assertForbidden();
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));$this->get($url)->assertOk()->assertSee('undressed base candidate');
        $this->get(str_replace('c_invoker','c_solana',$url))->assertNotFound();
        Http::fake(['*/files/*'=>Http::sequence()->push($bytes,200,['Content-Type'=>'model/gltf-binary'])->push('tampered',200)]);
        $this->get($url.'/files/mirelle-base-animated.glb')->assertOk();
        $this->get($url.'/files/not-registered.glb')->assertNotFound();
        $this->get($url.'/files/mirelle-base-animated.glb')->assertStatus(409);
    }
}
