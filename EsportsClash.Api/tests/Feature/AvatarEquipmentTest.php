<?php
namespace Tests\Feature;

use App\Jobs\PollAvatarEquipment;
use App\Models\{AvatarEquipmentGeneration,User};
use App\Services\{AvatarEquipmentService,TrellisGenerationService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{File,Http,Queue};
use Illuminate\Support\Str;
use Tests\TestCase;

class AvatarEquipmentTest extends TestCase {
    use RefreshDatabase;
    private string $temporaryStorage;
    private string $originalStorage;
    protected function setUp():void {
        parent::setUp();$this->originalStorage=storage_path();$this->temporaryStorage=sys_get_temp_dir().'/equipment-test-'.Str::uuid();
        File::ensureDirectoryExists($this->temporaryStorage);$this->app->useStoragePath($this->temporaryStorage);
    }
    protected function tearDown():void {
        $this->app->useStoragePath($this->originalStorage);File::deleteDirectory($this->temporaryStorage);parent::tearDown();
    }
    private function image():array {
        $png=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==');
        return app(TrellisGenerationService::class)->saveWeaponAsset('c_solana',UploadedFile::fake()->createWithContent('primary.png',$png),'primary','one_handed_sword','right_hand_socket','owner:test');
    }
    private function mesh():string {
        $json=json_encode(['asset'=>['version'=>'2.0'],'meshes'=>[['primitives'=>[]]]]);$json=str_pad($json,(int)(ceil(strlen($json)/4)*4),' ');
        return 'glTF'.pack('VV',2,20+strlen($json)).pack('VV',strlen($json),0x4E4F534A).$json;
    }
    private function operations():array {
        return [
            'provider'=>'google-colab',
            'generation_model'=>'TRELLIS.2-4B',
            'equipment'=>['supported'=>true],
            'active'=>null,
            'models'=>['ready'=>true],
            'engine_sha256'=>str_repeat('e',64),
            'limits_sha256'=>str_repeat('l',64),
        ];
    }
    public function test_png_stays_a_reference_and_real_mesh_is_frozen_by_exact_hash():void {
        $png=$this->image();Http::fake(fn($request)=>Http::response(['sha256'=>hash('sha256',$request->body()),'bytes'=>strlen($request->body())]));
        $frozen=app(AvatarEquipmentService::class)->freeze('c_solana');
        $this->assertSame([],$frozen['equipment']);$this->assertSame($png['sha256'],$frozen['equipment_references'][0]['sha256']);Http::assertNothingSent();
        $mesh=$this->mesh();$hash=hash('sha256',$mesh);
        app(TrellisGenerationService::class)->saveGeneratedWeapon('c_solana',UploadedFile::fake()->createWithContent('primary.glb',$mesh),'primary',$png['sha256'],(string)Str::uuid(),'owner:test');
        $frozen=app(AvatarEquipmentService::class)->freeze('c_solana');
        $this->assertSame($hash,$frozen['equipment'][0]['sha256']);$this->assertSame('primary',$frozen['equipment'][0]['slot']);
        $this->assertFileExists(app(TrellisGenerationService::class)->weaponStoragePath('c_solana').'/primary-reference-'.$png['sha256'].'.png');
        Http::assertSent(fn($request)=>$request->method()==='PUT'&&$request->body()===$mesh);
    }
    public function test_generated_install_verifies_source_slot_output_hash_and_retains_png():void {
        $png=$this->image();$id=(string)Str::uuid();$mesh=$this->mesh();$hash=hash('sha256',$mesh);
        $state=['status'=>'generated_unqualified','purpose'=>'modular-equipment','avatar_id'=>'c_solana','equipment_slot'=>'primary','reference_sha256'=>$png['sha256'],'artifact'=>['sha256'=>$hash,'bytes'=>strlen($mesh)]];
        Http::fake(['*/jobs/'.$id=>Http::response($state),'*/jobs/'.$id.'/artifact'=>Http::response($mesh)]);
        $result=app(AvatarEquipmentService::class)->installGenerated('c_solana','primary',$id,'owner:test');
        $this->assertSame($png['sha256'],$result['reference_sha256']);$this->assertSame($hash,$result['sha256']);$this->assertSame($id,$result['generation_id']);
        $this->assertFileExists(app(TrellisGenerationService::class)->weaponStoragePath('c_solana').'/'.$result['reference_filename']);
        $this->assertDatabaseCount('avatar_visual_releases',0);
    }
    public function test_wrong_hand_or_changed_reference_cannot_replace_current_equipment():void {
        $png=$this->image();$id=(string)Str::uuid();
        Http::fake(['*/jobs/*'=>Http::response(['status'=>'generated_unqualified','purpose'=>'modular-equipment','avatar_id'=>'c_solana','equipment_slot'=>'secondary','reference_sha256'=>$png['sha256']])]);
        try{app(AvatarEquipmentService::class)->installGenerated('c_solana','primary',$id,'owner:test');$this->fail('Wrong hand must be rejected');}catch(\Illuminate\Validation\ValidationException){}
        $this->assertSame('image/png',app(TrellisGenerationService::class)->weaponFile('c_solana')['mime']);
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(TrellisGenerationService::class)->saveGeneratedWeapon('c_solana',UploadedFile::fake()->createWithContent('primary.glb',$this->mesh()),'primary',str_repeat('a',64),$id,'owner:test');
    }
    public function test_studio_prefers_the_selected_sources_animated_preparation():void {
        Http::fake(['*'=>Http::response([],503)]);$this->actingAs(\App\Models\User::factory()->create(['is_evolution_admin'=>true]));
        $source=\App\Models\TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_solana','status'=>'generated_unqualified',
            'plan'=>['reference_sha256'=>str_repeat('a',64),'seed'=>1],'state'=>['artifact'=>['sha256'=>str_repeat('b',64)]]]);
        $prepared=\App\Models\AvatarPreparation::create(['id'=>(string)Str::uuid(),'generation_id'=>$source->id,'avatar_id'=>'c_solana','status'=>'ready',
            'plan'=>[],'state'=>['preparation'=>['runtime_compatible'=>true,'sha256'=>str_repeat('c',64)]]]);
        $this->get(route('trellis.avatar',['c_solana','model'=>$source->id]))->assertOk()->assertSee('Animated model')
            ->assertSee('data-asset="'.route('preparations.file',[$prepared,'candidate-01.glb']).'"',false)->assertSee('generation-animation')->assertSee('Download unrigged source');
        $other=\App\Models\TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_solana','status'=>'generated_unqualified',
            'plan'=>$source->plan,'state'=>$source->state]);
        $this->get(route('trellis.avatar',['c_solana','model'=>$other->id]))->assertOk()->assertSee('Source body / unrigged')
            ->assertDontSee('data-asset="'.route('preparations.file',[$prepared,'candidate-01.glb']).'"',false);
    }
    public function test_equipment_settings_validate_physical_height_cm_range():void {
        $this->image();
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $base=['avatar_id'=>'c_solana','weapon_slot'=>'primary','weapon_type'=>'one_handed_sword','socket_name'=>'right_hand_socket'];
        // Reject below minimum 5 cm
        $this->post(route('trellis.upload-weapon'),array_merge($base,['height_cm'=>4]))->assertSessionHasErrors('height_cm');
        // Reject above maximum 300 cm
        $this->post(route('trellis.upload-weapon'),array_merge($base,['height_cm'=>305]))->assertSessionHasErrors('height_cm');
        // Accept valid height
        $this->post(route('trellis.upload-weapon'),array_merge($base,['height_cm'=>115]))->assertSessionHasNoErrors();
        $file=app(TrellisGenerationService::class)->weaponFile('c_solana','primary');
        $png=$file;
        $this->assertEquals(115,$file['meta']['height_cm']);
        $mesh=$this->mesh();
        Http::fake(['*/equipment/*'=>Http::response(['sha256'=>hash('sha256',$mesh),'bytes'=>strlen($mesh)])]);
        app(TrellisGenerationService::class)->saveGeneratedWeapon('c_solana',UploadedFile::fake()->createWithContent('primary.glb',$mesh),'primary',$png['sha256'],(string)Str::uuid(),'owner:test');
        $frozen=app(AvatarEquipmentService::class)->freeze('c_solana');
        $this->assertEquals(115,$frozen['equipment'][0]['height_cm']);
        $this->assertEquals(180,$frozen['equipment'][0]['avatar_height_cm']);
    }
    public function test_generate_weapon_is_owner_only_and_queues_generation_with_automatic_server_seed():void {
        Queue::fake();
        $url=route('trellis.generate-weapon',['c_solana','primary']);
        // Unauthenticated redirected
        $this->post($url)->assertRedirect('/login');
        // Non-admin forbidden
        $this->actingAs(User::factory()->create())->post($url)->assertForbidden();
        // Admin with no uploaded PNG reference fails validation
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->post($url)->assertSessionHasErrors('equipment');
        Queue::assertNothingPushed();
        // Upload PNG reference
        $this->image();
        $ops=$this->operations();
        foreach(['workflow_sha256','pins_sha256','limits_sha256','engine_sha256']as $k)$ops[$k]=str_repeat('a',64);
        Http::fake([
            '*/operations'=>Http::sequence()
                ->push([],503)
                ->push($ops),
        ]);
        // Admin with offline worker fails validation
        $this->post($url)->assertSessionHasErrors('equipment');
        Queue::assertNothingPushed();
        // Admin with ready worker queues run
        $this->post($url)->assertSessionHasNoErrors()->assertRedirect();
        Queue::assertPushed(PollAvatarEquipment::class);
        $run=AvatarEquipmentGeneration::where('avatar_id','c_solana')->where('slot','primary')->first();
        $this->assertNotNull($run);
        $this->assertSame('queued',$run->status);
        $this->assertIsInt($run->plan['seed']);
        $this->assertGreaterThanOrEqual(0,$run->plan['seed']);
    }
    public function test_poll_avatar_equipment_handles_worker_404_recovery_and_installation():void {
        $png=$this->image();
        $runId=(string)Str::uuid();
        $mesh=$this->mesh();
        $meshHash=hash('sha256',$mesh);
        $run=AvatarEquipmentGeneration::create([
            'id'=>$runId,
            'avatar_id'=>'c_solana',
            'slot'=>'primary',
            'status'=>'queued',
            'plan'=>[
                'version'=>1,
                'avatar_id'=>'c_solana',
                'equipment_slot'=>'primary',
                'weapon_type'=>'one_handed_sword',
                'height_cm'=>120.0,
                'avatar_height_cm'=>180.0,
                'seed'=>12345,
                'reference_sha256'=>$png['sha256'],
                'purpose'=>'modular-equipment',
            ],
            'state'=>['stage'=>'queued'],
        ]);
        $jobReceipt=[
            'id'=>$runId,
            'status'=>'generated_unqualified',
            'purpose'=>'modular-equipment',
            'avatar_id'=>'c_solana',
            'equipment_slot'=>'primary',
            'reference_sha256'=>$png['sha256'],
            'artifact'=>['sha256'=>$meshHash,'bytes'=>strlen($mesh)],
        ];
        // Simulate worker 404: job posts reference and submits job
        Http::fake([
            '*/jobs/'.$runId=>Http::sequence()
                ->push([],404)
                ->push($jobReceipt)
                ->whenEmpty(Http::response($jobReceipt)),
            '*/equipment-references/c_solana/primary'=>Http::response(['sha256'=>$png['sha256']]),
            '*/equipment-jobs/'.$runId=>Http::response([
                'id'=>$runId,
                'status'=>'running',
                'avatar_id'=>'c_solana',
                'equipment_slot'=>'primary',
                'purpose'=>'modular-equipment',
                'reference_sha256'=>$png['sha256'],
            ]),
            '*/jobs/'.$runId.'/artifact'=>Http::response($mesh),
            '*/equipment/*' => Http::response(['sha256'=>$meshHash,'bytes'=>strlen($mesh)]),
        ]);
        // First poll: 404 handled, uploaded reference and submitted job
        app(PollAvatarEquipment::class,['runId'=>$runId])->handle(app(TrellisGenerationService::class),app(AvatarEquipmentService::class));
        Http::assertSent(fn($r)=>$r->url()===app(TrellisGenerationService::class)->endpoint('/equipment-references/c_solana/primary'));
        Http::assertSent(fn($r)=>$r->url()===app(TrellisGenerationService::class)->endpoint('/equipment-jobs/'.$runId));
        // Second poll: worker returns generated_unqualified, job installs GLB
        app(PollAvatarEquipment::class,['runId'=>$runId])->handle(app(TrellisGenerationService::class),app(AvatarEquipmentService::class));
        $run->refresh();
        $this->assertSame('ready',$run->status);
        $this->assertNotNull($run->installed_at);
        $this->assertNull($run->error);
        $currentWeapon=app(TrellisGenerationService::class)->weaponFile('c_solana','primary');
        $this->assertSame('model/gltf-binary',$currentWeapon['mime']);
        $this->assertSame($meshHash,$currentWeapon['sha256']);
    }
    public function test_poll_avatar_equipment_failure_and_outage_handling():void {
        $png=$this->image();
        $runId=(string)Str::uuid();
        $run=AvatarEquipmentGeneration::create([
            'id'=>$runId,
            'avatar_id'=>'c_solana',
            'slot'=>'primary',
            'status'=>'queued',
            'plan'=>[
                'version'=>1,
                'avatar_id'=>'c_solana',
                'equipment_slot'=>'primary',
                'seed'=>99999,
                'reference_sha256'=>$png['sha256'],
                'purpose'=>'modular-equipment',
            ],
            'state'=>['stage'=>'queued'],
        ]);
        // Worker returns failure
        Http::fake([
            '*/jobs/'.$runId=>Http::response([
                'id'=>$runId,
                'status'=>'failed',
                'purpose'=>'modular-equipment',
                'avatar_id'=>'c_solana',
                'equipment_slot'=>'primary',
                'reference_sha256'=>$png['sha256'],
                'error'=>'VRAM limit exceeded during remesh',
            ]),
        ]);
        app(PollAvatarEquipment::class,['runId'=>$runId])->handle(app(TrellisGenerationService::class),app(AvatarEquipmentService::class));
        $run->refresh();
        $this->assertSame('failed',$run->status);
        $this->assertSame('VRAM limit exceeded during remesh',$run->error);
        // Recovery test: if job times out or fails unexpectedly, marks waiting_worker
        $run->update(['status'=>'running']);
        $job=new PollAvatarEquipment($runId);
        $job->failed(new \RuntimeException('Connection timed out'));
        $run->refresh();
        $this->assertSame('waiting_worker',$run->status);
        $this->assertStringContainsString('Worker unavailable',$run->error);
    }
}
