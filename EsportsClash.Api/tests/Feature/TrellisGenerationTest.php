<?php
namespace Tests\Feature;
use App\Models\{User,TrellisGeneration,AvatarVisualRelease};
use App\Services\TrellisGenerationService;
use App\Jobs\PollTrellisGeneration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http,Queue};
use Illuminate\Support\Str;
use Tests\TestCase;

class TrellisGenerationTest extends TestCase
{
    use RefreshDatabase;
    private string $assetTestRoot;
    private string $originalStorage;
    protected function setUp(): void
    {
        parent::setUp();
        $this->originalStorage = storage_path();
        $this->assetTestRoot = sys_get_temp_dir().'/trellis-assets-'.Str::uuid();
        \Illuminate\Support\Facades\File::ensureDirectoryExists($this->assetTestRoot.'/framework/views');
        $this->app->useStoragePath($this->assetTestRoot);
    }
    protected function tearDown(): void
    {
        $this->app->useStoragePath($this->originalStorage);
        \Illuminate\Support\Facades\File::deleteDirectory($this->assetTestRoot);
        parent::tearDown();
    }
    private function pngUpload(): \Illuminate\Http\UploadedFile
    {
        return \Illuminate\Http\UploadedFile::fake()->createWithContent('equipment.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='));
    }
    private function weaponInput(string $slot='primary'): array
    {
        return ['avatar_id'=>'c_solana','weapon_slot'=>$slot,'weapon_type'=>$slot==='primary'?'one_handed_sword':'shield',
            'socket_name'=>$slot==='primary'?'right_hand_socket':'left_hand_socket','weapon_file'=>$this->pngUpload()];
    }
    public function test_roster_defaults_to_name_order_and_offers_one_studio_entry_point(): void
    {
        Http::fake(['*'=>Http::response([],503)]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $response=$this->get(route('trellis.index'))->assertOk()->assertSee('Name: A to Z')->assertSee('data-list-filter="role"',false)->assertSee('data-list-filter="equipment"',false)->assertDontSee('Inspect existing model');
        preg_match_all('/class="panel generation-card[^"]*" data-name="([^"]+)"/',$response->getContent(),$matches);
        $this->assertCount(45,$matches[1]);
        $sorted=$matches[1]; natcasesort($sorted);
        $this->assertSame(array_values($sorted),$matches[1]);
    }
    public function test_equipment_upload_uses_avatar_defaults_without_manual_type_or_socket(): void
    {
        Http::fake();
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $input=$this->weaponInput(); unset($input['weapon_type'],$input['socket_name']);
        $this->post(route('trellis.upload-weapon'),$input)->assertSessionHasNoErrors();
        $file=app(TrellisGenerationService::class)->weaponFile('c_solana');
        $this->assertSame('right_hand_socket',$file['meta']['socket_name']);
        $this->assertSame('one_handed_sword',$file['meta']['weapon_type']);
        $input=$this->weaponInput('secondary'); $input['avatar_id']='c_astra'; unset($input['weapon_type'],$input['socket_name']);
        $this->post(route('trellis.upload-weapon'),$input)->assertSessionHasNoErrors();
        $file=app(TrellisGenerationService::class)->weaponFile('c_astra','secondary');
        $this->assertSame('left_hand_socket',$file['meta']['socket_name']);
        $this->assertSame('generic',$file['meta']['weapon_type']);
        $this->get(route('trellis.avatar','c_solana'))->assertOk()->assertSee('Optional equipment settings');
    }
    public function test_asset_prompts_are_owner_only_validated_and_persist_per_avatar_without_queueing(): void
    {
        Http::fake(['*'=>Http::response([],503)]); Queue::fake();
        $url=route('trellis.prompts','c_solana');
        $this->patch($url)->assertRedirect('/login');
        $this->actingAs(User::factory()->create())->patch($url)->assertForbidden();
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->patch($url,['body'=>''])->assertSessionHasErrors(['body','primary','secondary']);
        $this->patch($url,['body'=>'Custom body brief','primary'=>'Custom sword brief','secondary'=>'Custom shield brief'])->assertSessionHasNoErrors();
        $this->get(route('trellis.avatar','c_solana'))->assertOk()->assertSee('Custom body brief')->assertSee('Custom sword brief')->assertSee('Custom shield brief');
        $this->get(route('trellis.avatar','c_astra'))->assertOk()->assertDontSee('Custom body brief');
        $this->patch(route('trellis.prompts','unknown'),['body'=>'a','primary'=>'b','secondary'=>'c'])->assertNotFound();
        $this->assertSame(0,TrellisGeneration::count()); Queue::assertNothingPushed();
    }
    public function test_saved_design_context_imports_once_and_requires_matching_avatar(): void
    {
        Http::fake(['*'=>Http::response([],503)]); Queue::fake();
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $design=\App\Models\ManagedContent::create(['kind'=>'avatar','source_id'=>'c_solana','name'=>'Dawnna draft','payload'=>['designBrief'=>['appearancePrompt'=>'Amber armor with a sun crest']]]);
        $url=route('trellis.avatar',['c_solana','design'=>$design->id]);
        $response=$this->get($url)->assertOk()->assertSee('Amber armor with a sun crest')->assertSee('data-imported-brief',false);
        preg_match_all('/<textarea[^>]*name="(body|primary|secondary)"[^>]*>(.*?)<\/textarea>/s',$response->getContent(),$matches,PREG_SET_ORDER);
        $prompts=[];
        foreach ($matches as $match) $prompts[$match[1]]=html_entity_decode($match[2],ENT_QUOTES|ENT_HTML5,'UTF-8');
        $this->assertCount(3,$prompts);
        $this->patch(route('trellis.prompts','c_solana'),$prompts)->assertSessionHasNoErrors();
        $this->get($url)->assertOk()->assertDontSee('data-imported-brief',false);
        $this->get(route('trellis.avatar',['c_astra','design'=>$design->id]))->assertNotFound();
        $this->assertSame(0,TrellisGeneration::count()); Queue::assertNothingPushed();
    }
    public function test_both_weapon_slots_support_upload_edit_replace_and_confirmed_removal(): void
    {
        Http::fake(['*'=>Http::response([],503)]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $service=app(TrellisGenerationService::class);
        $this->post(route('trellis.upload-weapon'),$this->weaponInput())->assertSessionHasNoErrors();
        $this->post(route('trellis.upload-weapon'),$this->weaponInput('secondary'))->assertSessionHasNoErrors();
        $hash=$service->weaponFile('c_solana')['sha256'];
        $this->post(route('trellis.upload-weapon'),['avatar_id'=>'c_solana','weapon_slot'=>'primary','weapon_type'=>'bow','socket_name'=>'right_hand_socket'])->assertSessionHasNoErrors();
        $this->assertSame($hash,$service->weaponFile('c_solana')['sha256']);
        $this->assertSame('bow',$service->weaponReferences()['c_solana']['primary']['weapon_type']);
        $this->get(route('trellis.weapon',['c_solana','primary']))->assertOk()->assertHeader('Content-Type','image/png');
        $gltf='{"asset":{"version":"2.0"},"buffers":[{"uri":"data:application/octet-stream;base64,AAAA"}]}';
        $input=$this->weaponInput(); $input['weapon_file']=\Illuminate\Http\UploadedFile::fake()->createWithContent('sword.gltf',$gltf);
        $this->post(route('trellis.upload-weapon'),$input)->assertSessionHasNoErrors();
        $this->assertFileDoesNotExist($service->weaponStoragePath('c_solana').'/primary.png');
        $this->get(route('trellis.weapon',['c_solana','primary']))->assertHeader('Content-Type','model/gltf+json');
        $this->get(route('trellis.avatar','c_solana'))->assertOk()->assertSee('3D file')->assertSee('PNG reference');
        $url=route('trellis.destroy-weapon',['c_solana','primary']);
        $this->delete($url)->assertSessionHasErrors('confirm_delete');
        $this->assertNotNull($service->weaponFile('c_solana'));
        $this->delete($url,['confirm_delete'=>1])->assertSessionHasNoErrors();
        $this->assertNull($service->weaponFile('c_solana'));
        $this->assertFalse($service->weaponReferences()['c_solana']['primary']['has_custom_asset']);
        $this->assertNotNull($service->weaponFile('c_solana','secondary'));
        $this->get(route('trellis.weapon',['c_solana','primary']))->assertNotFound();
        $this->delete($url,['confirm_delete'=>1])->assertSessionHasNoErrors();
    }
    public function test_weapon_upload_rejects_spoofed_formats_external_resources_and_mismatched_sockets(): void
    {
        Http::fake(); $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        foreach (['fake.png'=>'not an image','fake.glb'=>'not a model','external.gltf'=>'{"asset":{"version":"2.0"},"buffers":[{"uri":"../private.bin"}]}','malformed.gltf'=>'{"asset":{"version":"2.0"},"buffers":"invalid"}'] as $name=>$bytes) {
            $input=$this->weaponInput(); $input['weapon_file']=\Illuminate\Http\UploadedFile::fake()->createWithContent($name,$bytes);
            $this->post(route('trellis.upload-weapon'),$input)->assertSessionHasErrors('weapon_file');
        }
        $input=$this->weaponInput(); $input['socket_name']='left_hand_socket';
        $this->post(route('trellis.upload-weapon'),$input)->assertSessionHasErrors('socket_name');
        $input=$this->weaponInput(); $input['weapon_slot']='../../private';
        $this->post(route('trellis.upload-weapon'),$input)->assertSessionHasErrors('weapon_slot');
        $this->get('/evolution/avatars/trellis/weapon/c_solana/not-a-slot')->assertNotFound();
        $this->patch(route('trellis.update-weapon',['c_solana','primary']),['weapon_type'=>'staff'])->assertSessionHasErrors('weapon_file');
        $this->assertNull(app(TrellisGenerationService::class)->weaponFile('c_solana')); Http::assertNothingSent();
    }
    public function test_removing_active_body_preserves_frozen_input_and_blocks_stale_worker_generation(): void
    {
        Queue::fake();
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $service=app(TrellisGenerationService::class);
        $upload=$this->pngUpload(); $hash=hash_file('sha256',$upload->getRealPath());
        $ops=$this->operations(); $ops['references']['c_solana']['sha256']=$hash;
        Http::fake(['*/operations'=>Http::response($ops),'*/references/c_solana'=>Http::response(['sha256'=>$hash])]);
        $meta=$service->saveReferenceAsset('c_solana',$upload,'Body prompt','test');
        $url=route('trellis.destroy-reference','c_solana');
        $this->delete($url)->assertSessionHasErrors('confirm_delete');
        $this->delete($url,['confirm_delete'=>1])->assertSessionHasNoErrors();
        $this->assertNull($service->currentReference('c_solana'));
        $this->assertArrayNotHasKey('c_solana',$service->references($ops));
        $this->assertFileExists($service->localReference('c_solana',$meta['sha256']));
        $this->post(route('trellis.start'),['avatar_id'=>'c_solana','seed'=>1])->assertSessionHasErrors('avatar_id');
        $this->assertSame(0,TrellisGeneration::count());
        $this->post(route('trellis.upload'),['avatar_id'=>'c_solana','reference'=>$this->pngUpload()])->assertSessionHasNoErrors();
        $this->post(route('trellis.start'),['avatar_id'=>'c_solana','seed'=>1])->assertSessionHasNoErrors();
        $this->assertSame($meta['sha256'],TrellisGeneration::firstOrFail()->plan['reference_sha256']);
    }
    public function test_offline_body_is_synced_before_generation_instead_of_using_old_worker_reference(): void
    {
        Queue::fake();
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $service=app(TrellisGenerationService::class);
        $upload=$this->pngUpload(); $hash=hash_file('sha256',$upload->getRealPath()); $synced=false;
        Http::fake(function($request) use (&$synced,$hash) {
            if (str_ends_with($request->url(),'/operations')) return Http::response($this->operations());
            return $synced ? Http::response(['sha256'=>$hash]) : Http::response([],503);
        });
        $meta=$service->saveReferenceAsset('c_solana',$upload,null,'test');
        $this->post(route('trellis.start'),['avatar_id'=>'c_solana','seed'=>2])->assertSessionHasErrors('reference');
        $this->assertSame(0,TrellisGeneration::count());
        $synced=true;
        $this->post(route('trellis.start'),['avatar_id'=>'c_solana','seed'=>2])->assertSessionHasNoErrors();
        $this->assertSame($meta['sha256'],TrellisGeneration::firstOrFail()->plan['reference_sha256']);
    }
    public function test_inspection_keeps_original_input_after_body_replacement_and_report_deletion(): void
    {
        Http::fake(['*'=>Http::response([],503)]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        app(TrellisGenerationService::class)->saveReferenceAsset('c_solana',$this->pngUpload(),null,'test');
        $oldHash=str_repeat('d',64);
        $run=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_solana','status'=>'generated_unqualified','plan'=>['seed'=>7,'reference_sha256'=>$oldHash],'state'=>['artifact'=>['sha256'=>str_repeat('a',64)]]]);
        $run->delete();
        $this->get(route('trellis.preview',$run))->assertRedirect(route('trellis.avatar',[$run->avatar_id,'model'=>$run->id]).'#models');
        $this->get(route('trellis.avatar',[$run->avatar_id,'model'=>$run->id]))->assertOk()->assertSee(route('trellis.reference',['c_solana',$oldHash]),false)->assertSee('Original generation input')->assertSee('current body reference');
    }
    public function test_known_legacy_concepts_do_not_count_as_ready_body_references(): void
    {
        Queue::fake(); $ops=$this->operations();
        $ops['references']['c_solana']['prompt']='Clearly attached equipment, relaxed A stance, near-frontal view';
        Http::fake(['*/operations'=>Http::response($ops)]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $service=app(TrellisGenerationService::class);
        $this->assertArrayNotHasKey('c_solana',$service->references($ops));
        $this->assertTrue($service->currentReference('c_solana')['is_legacy']);
        $this->get(route('trellis.avatar','c_solana'))->assertOk()->assertSee('Legacy concept')->assertSee('Replace it with a clean T-pose body');
        $this->post(route('trellis.start'),['avatar_id'=>'c_solana','seed'=>1])->assertSessionHasErrors('avatar_id');
        Queue::assertNothingPushed();
    }
    public function test_live_history_recognizes_all_active_states_and_keeps_deleted_models_out_of_failed_filter(): void
    {
        Http::fake(); $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        foreach ([...TrellisGenerationService::ACTIVE,'cancelling','model_deleted','cancelled'] as $status) {
            TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_solana','status'=>$status,'plan'=>[],'state'=>[]]);
        }
        $this->get(route('trellis.live'))->assertOk()->assertSee('Waiting for worker')->assertSee('Generating')
            ->assertSee('Model deleted')->assertSee('data-category="active">In progress <span class="category-count">6</span>',false)
            ->assertSee('data-category="failed">Failed <span class="category-count">0</span>',false);
    }
    public function test_confirmed_model_deletion_releases_the_generation_guard_and_keeps_report():void
    {
        Queue::fake();Http::fake(['*/operations'=>Http::response($this->operations()),'*/artifact'=>Http::response(['status'=>'model_deleted'])]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $run=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'generated_unqualified','plan'=>[],'state'=>['artifact'=>['sha256'=>str_repeat('a',64)]]]);
        $url=route('trellis.destroy-model',$run);
        $this->delete($url)->assertSessionHasErrors('confirm_delete');
        Http::assertNothingSent();
        $this->delete($url,['confirm_delete'=>1])->assertRedirect(route('trellis.index'));
        $this->assertSame('model_deleted',$run->fresh()->status);
        $this->assertArrayNotHasKey('artifact',$run->fresh()->state);
        $this->get(route('trellis.asset',$run))->assertConflict();
        $this->post(route('trellis.start'),['seed'=>1,'avatar_id'=>'c_invoker'])->assertSessionHasNoErrors();
        $this->assertSame(2,TrellisGeneration::count());
    }
    public function test_model_deletion_protects_preparations_and_requires_worker_acknowledgement():void
    {
        Http::fake(['*'=>Http::response([],503)]);
        $run=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'generated_unqualified','plan'=>[]]);
        $url=route('trellis.destroy-model',$run);
        $this->delete($url,['confirm_delete'=>1])->assertRedirect('/login');
        $this->actingAs(User::factory()->create())->delete($url,['confirm_delete'=>1])->assertForbidden();
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->delete($url,['confirm_delete'=>1])->assertSessionHasErrors('model');
        $this->assertSame('generated_unqualified',$run->fresh()->status);
        \App\Models\AvatarPreparation::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','generation_id'=>$run->id,'status'=>'paused','plan'=>[]]);
        Http::fake();
        $this->delete($url,['confirm_delete'=>1])->assertSessionHasErrors('model');Http::assertNothingSent();
        $run->delete();
        $this->get(route('trellis.index'))->assertOk()->assertSee(route('trellis.avatar',$run->avatar_id),false);
    }
    public function test_deleted_inactive_preparation_reports_do_not_block_source_deletion():void
    {
        Http::fake(['*'=>Http::response(['status'=>'model_deleted'])]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $run=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'generated_unqualified','plan'=>[]]);
        foreach(['paused','needs_review','awaiting_validation','ready'] as $status){
            $prep=\App\Models\AvatarPreparation::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','generation_id'=>$run->id,'status'=>$status,'plan'=>[]]);$prep->delete();
        }
        $this->delete(route('trellis.destroy-model',$run),['confirm_delete'=>1])->assertSessionHasNoErrors();
        $this->assertSame('model_deleted',$run->fresh()->status);
    }
    public function test_deleted_running_preparation_and_retained_release_still_protect_source():void
    {
        Http::fake();$this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $run=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'generated_unqualified','plan'=>[]]);
        $prep=\App\Models\AvatarPreparation::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','generation_id'=>$run->id,'status'=>'rigging','plan'=>[]]);$prep->delete();
        $this->delete(route('trellis.destroy-model',$run),['confirm_delete'=>1])->assertSessionHasErrors('model');Http::assertNothingSent();
        $prep->update(['status'=>'needs_review']);
        \App\Models\AvatarEvolutionRun::create(['id'=>$prep->id,'avatar_id'=>'c_invoker','status'=>'complete','plan'=>[]]);
        AvatarVisualRelease::create(['avatar_id'=>'c_invoker','variant'=>'default','version'=>2,'run_id'=>$prep->id,'candidate_id'=>'candidate-01','file'=>'candidate-01.glb','sha256'=>str_repeat('a',64),'source_sha256'=>str_repeat('b',64),'approved_by'=>'test','active'=>false,'validation'=>[]]);
        $this->delete(route('trellis.destroy-model',$run),['confirm_delete'=>1])->assertSessionHasErrors('model');Http::assertNothingSent();
    }
    private function operations():array{return ['provider'=>'trellis2-gguf','active'=>null,'models'=>['ready'=>true],
        'hardware'=>['gpu'=>'Fixture GPU','gpu_free_mib'=>9000],'references'=>['c_invoker'=>['sha256'=>str_repeat('a',64),'provider'=>'imagegen'],'c_solana'=>['sha256'=>str_repeat('b',64),'provider'=>'imagegen']],...array_fill_keys(['reference_sha256','workflow_sha256','pins_sha256','limits_sha256','engine_sha256'],str_repeat('a',64))];}
    public function test_generation_routes_require_owner_access():void
    {
        $run=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'queued','plan'=>[]]);
        foreach(['/evolution/avatars/trellis','/evolution/avatars/trellis/live','/evolution/avatars/trellis/'.$run->id.'/report','/evolution/avatars/trellis/'.$run->id.'/asset','/evolution/avatars/trellis/'.$run->id.'/preview']as $path)$this->get($path)->assertRedirect('/login');
        $this->actingAs(User::factory()->create());
        $this->get('/evolution/avatars/trellis')->assertForbidden();$this->post('/evolution/avatars/trellis',['seed'=>1,'avatar_id'=>'c_invoker'])->assertForbidden();
    }
    public function test_owner_queue_freezes_real_worker_configuration_and_preserves_visual_versions():void
    {
        Queue::fake();Http::fake(['*/operations'=>Http::response($this->operations())]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->post('/evolution/avatars/trellis',['seed'=>47,'avatar_id'=>'c_invoker'])->assertRedirect(route('trellis.index'));
        $run=TrellisGeneration::firstOrFail();$this->assertSame(47,$run->plan['seed']);$this->assertSame(str_repeat('a',64),$run->plan['limits_sha256']);
        $this->assertSame('queued',$run->status);$this->assertSame(0,AvatarVisualRelease::count());Queue::assertPushed(PollTrellisGeneration::class);
        $this->post('/evolution/avatars/trellis',['seed'=>48,'avatar_id'=>'c_invoker'])->assertSessionHasErrors('provider');$this->assertSame(1,TrellisGeneration::count());
        $this->get('/evolution/avatars/trellis')->assertOk()->assertSee('3D Generation')->assertSee('Not submitted yet');
        $this->get('/evolution/ml/reports')->assertOk()->assertDontSee('generation-card');
    }
    public function test_idempotent_polls_store_actual_execution_and_do_not_reopen_terminal_runs():void
    {
        Queue::fake();$id=(string)Str::uuid();$run=TrellisGeneration::create(['id'=>$id,'avatar_id'=>'c_invoker','status'=>'queued','plan'=>['version'=>1]]);
        $state=['id'=>$id,'status'=>'generated_unqualified','prompt_id'=>$id,'stage'=>'awaiting_asset_qualification','artifact'=>['publication_eligible'=>false]];
        Http::fake(['*/jobs/'.$id=>Http::response($state)]);
        $job=new PollTrellisGeneration($id);$job->handle(app(TrellisGenerationService::class));
        $this->assertSame('generated_unqualified',$run->fresh()->status);$this->assertSame($id,$run->fresh()->state['prompt_id']);
        Http::assertSentCount(1);$job->handle(app(TrellisGenerationService::class));Http::assertSentCount(1);
        Http::assertNotSent(fn($request)=>$request->method()==='POST');
        $this->assertSame(0,AvatarVisualRelease::count());Queue::assertNothingPushed();
    }
    public function test_generated_download_requires_exact_recorded_content_hash():void
    {
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $id=(string)Str::uuid();$run=TrellisGeneration::create(['id'=>$id,'avatar_id'=>'c_invoker','status'=>'generated_unqualified','plan'=>[],
            'state'=>['artifact'=>['bytes'=>20,'sha256'=>str_repeat('a',64)]]]);
        Http::fake(['*/jobs/'.$id.'/artifact'=>Http::response('glTF'.str_repeat('x',16))]);
        $this->get('/evolution/avatars/trellis/'.$run->id.'/asset')->assertConflict();
        $this->get('/evolution/avatars/trellis/'.$run->id.'/report')->assertOk()->assertJsonPath('type','trellis2-generation');
    }
    public function test_preview_requires_a_completed_source_and_does_not_invent_an_asset():void
    {
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $run=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_solana','status'=>'queued','plan'=>[]]);
        $this->get('/evolution/avatars/trellis/'.$run->id.'/preview')->assertConflict();
        $this->assertSame(0,AvatarVisualRelease::count());
    }
    public function test_new_execution_is_admitted_only_after_worker_reports_it_missing():void
    {
        Queue::fake();$id=(string)Str::uuid();$plan=['version'=>1,'avatar_id'=>'c_solana','seed'=>47];
        $run=TrellisGeneration::create(['id'=>$id,'avatar_id'=>'c_solana','status'=>'queued','plan'=>$plan]);
        Http::fake(fn($request)=>$request->method()==='GET'?Http::response([],404):Http::response(['id'=>$id,'status'=>'queued','stage'=>'admission'],202));
        (new PollTrellisGeneration($id))->handle(app(TrellisGenerationService::class));
        Http::assertSentCount(2);Http::assertSent(fn($request)=>$request->method()==='POST'&&$request->data()===$plan);
        $this->assertSame('queued',$run->fresh()->status);$this->assertSame('admission',$run->fresh()->state['stage']);
        Queue::assertPushed(PollTrellisGeneration::class,fn($job)=>$job->runId===$id);
    }
    public function test_unavailable_worker_does_not_create_a_fabricated_run():void
    {
        Http::fake(['*'=>Http::response([],503)]);$this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->post('/evolution/avatars/trellis',['seed'=>1,'avatar_id'=>'c_invoker'])->assertSessionHasErrors('provider');$this->assertSame(0,TrellisGeneration::count());
    }
    public function test_builtin_concept_previews_remain_available_while_gpu_worker_is_offline():void
    {
        Http::fake(['*'=>Http::response([],503)]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->get('/evolution/avatars/trellis')->assertOk()->assertSee('Local worker offline');
        // User-managed concept files may be removed; this test owns its fixture.
        $path=tempnam(sys_get_temp_dir(),'trellis-test-');
        file_put_contents($path,base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='));
        $digest=hash_file('sha256',$path);
        $this->partialMock(TrellisGenerationService::class,fn($mock)=>$mock->shouldReceive('localReference')->with('c_solana',$digest)->andReturn($path));
        try{$this->get('/evolution/avatars/trellis/reference/c_solana/'.$digest)->assertOk()->assertHeader('Content-Type','image/png');}finally{unlink($path);}
        Http::assertSentCount(1);$this->assertSame(0,TrellisGeneration::count());
    }
    public function test_lost_polling_does_not_misreport_remote_generation_as_failed():void
    {
        $run=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'running','plan'=>['seed'=>47,'avatar_id'=>'c_invoker']]);
        (new PollTrellisGeneration($run->id))->failed(new \RuntimeException('Network unavailable'));
        $this->assertSame('waiting_worker',$run->fresh()->status);$this->assertSame(['seed'=>47,'avatar_id'=>'c_invoker'],$run->fresh()->plan);
    }
    public function test_roster_queue_freezes_each_identity_and_waits_for_first_execution():void
    {
        Queue::fake();Http::fake(['*/operations'=>Http::response($this->operations())]);
        $service=app(TrellisGenerationService::class);
        $first=$service->start('test',10,'c_invoker');$first->update(['created_at'=>now()->subMinute()]);
        $second=$service->start('test',11,'c_solana');
        $this->assertSame('c_solana',$second->plan['avatar_id']);
        $this->assertSame(str_repeat('b',64),$second->plan['reference_sha256']);
        Http::fake();(new PollTrellisGeneration($second->id))->handle($service);Http::assertNothingSent();
        $this->assertSame('queued',$second->fresh()->status);$this->assertSame(0,AvatarVisualRelease::count());
    }
    public function test_missing_or_unknown_avatar_reference_cannot_generate():void
    {
        Queue::fake();Http::preventStrayRequests();Http::fake(['*/operations'=>Http::response($this->operations())]);
        // This scenario must not depend on whether a shipped reference was added
        // for Kyumi. A removal tombstone in this test's private storage makes
        // reference absence explicit without changing bundled or owner assets.
        $directory=storage_path('app/avatars/references/c_kyumi');
        \Illuminate\Support\Facades\File::ensureDirectoryExists($directory);
        \Illuminate\Support\Facades\File::put($directory.'/current.json',json_encode(['removed'=>true]));
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->post('/evolution/avatars/trellis',['seed'=>1,'avatar_id'=>'c_kyumi'])->assertSessionHasErrors('avatar_id');
        $this->post('/evolution/avatars/trellis',['seed'=>1,'avatar_id'=>'../../private'])->assertSessionHasErrors('avatar_id');
        $this->assertSame(0,TrellisGeneration::count());
        $this->get('/evolution/avatars/trellis')->assertOk()->assertSee('Dawnna')->assertSee('Aiselle')->assertSee('Vixelle')->assertSee('3D Enhancements');
    }
    public function test_reference_upload_and_preview_require_owner_and_preserve_provenance():void
    {
        $this->post('/evolution/avatars/trellis/reference')->assertRedirect('/login');
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $png=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==');
        Http::fake(['*/references/c_solana'=>Http::response(['sha256'=>str_repeat('b',64)]),'*/references/c_solana/*'=>Http::response($png,200,['Content-Type'=>'image/png'])]);
        $this->post('/evolution/avatars/trellis/reference',['avatar_id'=>'c_solana','reference'=>\Illuminate\Http\UploadedFile::fake()->createWithContent('reference.png',$png),'prompt'=>'Solar shield'])->assertRedirect(route('trellis.index'));
        Http::assertSent(fn($request)=>$request->method()==='POST'&&$request['provider']==='owner-upload'&&$request['prompt']==='Solar shield'&&base64_decode($request['png_base64'])===$png);
        $this->get('/evolution/avatars/trellis/reference/c_solana/'.str_repeat('b',64))->assertOk()->assertHeader('Content-Type','image/png');
        $this->get('/evolution/avatars/trellis/reference/unknown/'.str_repeat('b',64))->assertNotFound();
        $this->assertSame(0,TrellisGeneration::count());
    }

    public function test_completed_model_blocks_duplicate_generation_including_deleted_reports():void
    {
        Queue::fake();Http::fake(['*/operations'=>Http::response($this->operations())]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $existing=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_solana','status'=>'generated_unqualified','plan'=>[]]);
        $this->post('/evolution/avatars/trellis',['seed'=>1,'avatar_id'=>'c_solana'])->assertSessionHasErrors('avatar_id');
        $this->get('/evolution/avatars/trellis')->assertOk()->assertSee('3D source available')->assertSee('Open avatar studio')->assertDontSee('Inspect existing model');
        $existing->delete();
        $this->post('/evolution/avatars/trellis',['seed'=>2,'avatar_id'=>'c_solana'])->assertSessionHasErrors('avatar_id');
        $this->assertSame(1,TrellisGeneration::withTrashed()->count());Queue::assertNothingPushed();
        $this->post('/evolution/avatars/trellis',['seed'=>3,'avatar_id'=>'c_invoker'])->assertSessionHasNoErrors();
        $this->assertSame(1,TrellisGeneration::where('avatar_id','c_invoker')->count());
    }

    public function test_avatar_status_is_owner_only_and_scopes_live_history():void
    {
        $path=route('trellis.avatar','c_solana',false);$this->get($path)->assertRedirect('/login');
        $this->actingAs(User::factory()->create());$this->get($path)->assertForbidden();
        Queue::fake();Http::fake(['*/operations'=>Http::response($this->operations())]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_solana','status'=>'running','plan'=>[],'state'=>['stage'=>'DAWNNA_ONLY_STAGE']]);
        TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'running','plan'=>[],'state'=>['stage'=>'OTHER_AVATAR_STAGE']]);
        $this->get($path)->assertOk()->assertSee('Dawnna')->assertSee('DAWNNA_ONLY_STAGE')->assertDontSee('OTHER_AVATAR_STAGE')->assertSee('avatar_id=c_solana');
        $this->get(route('trellis.live',['avatar_id'=>'c_solana'],false))->assertOk()->assertSee('DAWNNA_ONLY_STAGE')->assertDontSee('OTHER_AVATAR_STAGE');
        $this->get('/evolution/avatars/trellis')->assertOk()->assertSee('View Dawnna 3D status')->assertSee(route('trellis.avatar','c_solana'));
        $this->get(route('trellis.avatar','not-an-avatar',false))->assertNotFound();Queue::assertNothingPushed();
    }

}
