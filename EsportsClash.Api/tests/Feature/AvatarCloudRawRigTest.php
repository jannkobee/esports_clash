<?php
namespace Tests\Feature;

use App\Jobs\PollAvatarPreparation;
use App\Models\{AvatarPreparation,TrellisGeneration,User};
use App\Services\{AvatarCloudRawRigService,AvatarJobCancellationService,AvatarPreparationService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http,Queue};
use Illuminate\Support\Str;
use Tests\TestCase;

class AvatarCloudRawRigTest extends TestCase {
    use RefreshDatabase;
    protected function setUp():void {parent::setUp();Http::preventStrayRequests();}
    private function source():TrellisGeneration {
        return TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'generated_unqualified',
            'plan'=>['seed'=>7],'state'=>['artifact'=>['sha256'=>str_repeat('a',64),'bytes'=>120],'compute'=>['selected'=>'local']]]);
    }
    private function operations():array {return ['provider'=>'tokenrig','profile'=>AvatarCloudRawRigService::PROFILE,
        'compute'=>['selected'=>'google','automatic_fallback'=>false],'runtime_ready'=>true,'models_ready'=>true,
        'stages'=>['rigging'],'engine_sha256'=>str_repeat('b',64)];}
    private function admit():AvatarPreparation {
        Queue::fake();Http::fake(['*/rigging/operations'=>Http::response($this->operations())]);
        return app(AvatarCloudRawRigService::class)->start($this->source(),'owner:test');
    }
    public function test_admission_retains_real_source_and_historical_compute_without_animation_dispatch():void {
        $run=$this->admit();
        $this->assertSame('local',$run->plan['source_compute']);
        $this->assertSame('google',$run->plan['compute']);
        $this->assertSame(str_repeat('a',64),$run->plan['source_sha256']);
        $this->assertFalse($run->plan['publication_eligible']);
        $this->assertArrayNotHasKey('donor_sha256',$run->plan);
        Http::assertNotSent(fn($r)=>$r->method()!=='GET');
        Queue::assertPushed(PollAvatarPreparation::class,fn($job)=>$job->runId===$run->id);
    }
    public function test_unready_models_and_scheduler_cannot_admit_raw_rigs():void {
        Queue::fake();Http::fake(['*'=>Http::response([...$this->operations(),'models_ready'=>false])]);
        $source=$this->source();
        foreach(['owner:test','preparation-scheduler'] as $actor){
            try{app(AvatarCloudRawRigService::class)->start($source,$actor);$this->fail('Invalid admission');}
            catch(\Illuminate\Validation\ValidationException){}
        }
        $this->assertDatabaseCount('avatar_preparations',0);Queue::assertNothingPushed();
    }
    public function test_completed_raw_rig_is_reviewable_but_cannot_qualify_or_publish():void {
        $run=$this->admit();$body='glTF'.str_repeat('x',80);$sha=hash('sha256',$body);
        $state=['id'=>$run->id,'plan'=>$run->plan,'status'=>'rigged_unqualified','publication_eligible'=>false,
            'execution'=>['compute'=>'google','engine_sha256'=>str_repeat('b',64)],
            'artifact'=>['sha256'=>$sha,'bytes'=>strlen($body),'joints'=>['Hips','Head']],
            'report'=>['status'=>'rigged_unqualified','source_sha256'=>str_repeat('a',64),'artifact_sha256'=>$sha,'artifact_bytes'=>strlen($body)]];
        Http::fake(['*/rigging/jobs/'.$run->id=>Http::response($state),'*/artifact'=>Http::response($body)]);
        (new PollAvatarPreparation($run->id))->handle(app(AvatarPreparationService::class));
        $run->refresh();$this->assertSame('needs_review',$run->status);
        $this->assertFalse($run->state['report']['qualification_complete']);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->get('/evolution/avatars/preparation/'.$run->id.'/preview')->assertOk()->assertSee($run->generation_id)->assertSee('source compute local');
        $this->get('/evolution/avatars/preparation/'.$run->id.'/files/raw-rig.glb')->assertOk()->assertContent($body);
        $this->postJson('/evolution/avatars/preparation/'.$run->id.'/validate')->assertUnprocessable();
        $this->postJson('/evolution/avatars/preparation/'.$run->id.'/publish',['identity_review'=>true])->assertUnprocessable();
        $this->assertDatabaseCount('avatar_visual_releases',0);
    }
    public function test_disconnect_never_contacts_local_preparation_or_rig_worker():void {
        $run=$this->admit();Http::fake(fn()=>Http::failedConnection());
        (new PollAvatarPreparation($run->id))->handle(app(AvatarPreparationService::class));
        $this->assertSame('waiting_worker',$run->fresh()->status);
        Http::assertNotSent(fn($r)=>!str_contains($r->url(),'/rigging/'));
    }
    public function test_blocked_weight_solver_is_visible_without_creating_a_qualified_candidate():void {
        $run=$this->admit();$id=(string)Str::uuid();
        $report=['id'=>$id,'status'=>'blocked_geometry','libigl_version'=>'2.6.3',
            'candidate_available'=>false,'publication_eligible'=>false,'qualification_complete'=>false,
            'solver_check'=>['status'=>'passed','avatar_weighting_complete'=>false],
            'geometry'=>['source'=>['boundary_edges'=>4,'overincident_edges'=>37,'blockers'=>['open_surface','nonmanifold_surface']]],
            'next_requirement'=>'A validated closed volume domain is required.'];
        $run->update(['status'=>'needs_review','state'=>['preparation'=>['sha256'=>str_repeat('c',64)],
            'weight_solver_reviews'=>[$id=>['report'=>$report]]]]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->get('/evolution/avatars/preparation/'.$run->id.'/preview')->assertOk()
            ->assertSee('Skin-weight solver trial')->assertSee('blocked geometry')
            ->assertSee('No avatar candidate produced')->assertSee('validated closed volume');
        $this->postJson('/evolution/avatars/preparation/'.$run->id.'/validate')->assertUnprocessable();
        $this->postJson('/evolution/avatars/preparation/'.$run->id.'/publish',['identity_review'=>true])->assertUnprocessable();
        $this->assertDatabaseCount('avatar_visual_releases',0);
    }
    public function test_proxy_domain_download_requires_recorded_lineage_and_exact_bytes():void {
        \Illuminate\Support\Facades\Storage::fake('local');$run=$this->admit();$id=(string)Str::uuid();$bytes='PK-proxy-domain';
        $report=['id'=>$id,'compute'=>'google','method'=>'libigl-voxel-volume-correspondence-v1',
            'source_sha256'=>$run->plan['source_sha256'],'rig_sha256'=>str_repeat('c',64),
            'candidate_available'=>false,'publication_eligible'=>false,
            'proxy_artifact'=>['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)]];
        $run->update(['state'=>['cloud_raw_rig'=>['artifact'=>['sha256'=>str_repeat('c',64)]],
            'weight_solver_reviews'=>[$id=>['report'=>$report]]]]);
        $path='avatar-preparations/'.$run->id.'/weight-domains/'.$id.'.npz';
        \Illuminate\Support\Facades\Storage::disk('local')->put($path,$bytes);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $url='/evolution/avatars/preparation/'.$run->id.'/files/weight-domain-'.$id.'.npz';
        $this->get($url)->assertOk()->assertContent($bytes);
        \Illuminate\Support\Facades\Storage::disk('local')->put($path,'tampered');$this->get($url)->assertStatus(409);
        $state=$run->state;$state['cloud_raw_rig']['artifact']['sha256']=str_repeat('d',64);$run->update(['state'=>$state]);
        $this->get($url)->assertNotFound();
    }
    public function test_fitted_bend_playback_uses_retained_clip_and_rejects_tampering():void {
        \Illuminate\Support\Facades\Storage::fake('local');$run=$this->admit();$candidate=(string)Str::uuid();$visual=(string)Str::uuid();
        $base='glTF'.str_repeat('b',80);$clip='glTF'.str_repeat('s',100);$baseSha=hash('sha256',$base);$clipSha=hash('sha256',$clip);$rigSha=str_repeat('c',64);
        $report=['id'=>$candidate,'status'=>'review_required','compute'=>'google','source_sha256'=>$run->plan['source_sha256'],
            'rig_sha256'=>$rigSha,'qualification_complete'=>false,'publication_eligible'=>false,'artifact'=>['sha256'=>$baseSha,'bytes'=>strlen($base)]];
        $run->update(['state'=>['preparation'=>['sha256'=>$rigSha],'cloud_raw_rig'=>['artifact'=>['sha256'=>$rigSha]],
            'skinning_reviews'=>[$candidate=>['plan'=>['id'=>$candidate,'compute'=>'google'],'report'=>$report]],
            'stage_visual_audits'=>[$visual=>['publication_eligible'=>false,'report'=>['id'=>$visual,'status'=>'rendered_for_review','plan'=>['stages'=>['raw','fitted']],'views'=>[]],
                'fit_bends'=>['candidate_id'=>$candidate,'candidate_sha256'=>$baseSha,'sha256'=>$clipSha,'bytes'=>strlen($clip)]]]]]);
        $disk=\Illuminate\Support\Facades\Storage::disk('local');$path='avatar-preparations/'.$run->id.'/diagnostics/';$disk->put($path.$baseSha.'.glb',$base);$disk->put($path.$clipSha.'.glb',$clip);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));$name='weight-fit-bends-'.$visual.'-'.$candidate.'.glb';
        $this->get('/evolution/avatars/preparation/'.$run->id.'/preview?view=weight-fit-bends&candidate='.$candidate.'&visual_review='.$visual)->assertOk()->assertSee($name);
        $url='/evolution/avatars/preparation/'.$run->id.'/files/'.$name;$this->get($url)->assertOk()->assertContent($clip);
        $disk->put($path.$clipSha.'.glb','tampered');$this->get($url)->assertStatus(409);
        $this->postJson('/evolution/avatars/preparation/'.$run->id.'/publish',['identity_review'=>true])->assertUnprocessable();
    }
    private function fieldComparisonFixture(bool $bounded=false):array {
        \Illuminate\Support\Facades\Storage::fake('local');$run=$this->admit();$id=(string)Str::uuid();$solve=(string)Str::uuid();
        $source=$run->plan['source_sha256'];$raw=str_repeat('c',64);$weightReport=str_repeat('d',64);$weights=str_repeat('e',64);
        $run->update(['state'=>['preparation'=>['sha256'=>$raw],'cloud_raw_rig'=>['artifact'=>['sha256'=>$raw]],
            'weight_solver_reviews'=>[$solve=>['report_sha256'=>$weightReport,'report'=>['id'=>$solve,'status'=>'weights_ready_for_export_review','weight_artifact'=>['sha256'=>$weights]]]]]]);
        $dir=\Illuminate\Support\Facades\Storage::disk('local')->path('field-input');mkdir($dir.'/site/snapshots',0777,true);mkdir($dir.'/screenshots');
        $poses=[['UpperArmL',90],['ThighL',45],['ThighL',90],['ThighR',90]];
        $r=['id'=>$id,'method'=>'fixed-rig-weight-field-comparison-v1','compute'=>'google','status'=>'rendered_for_review','errors'=>[],
            'candidate_available'=>false,'publication_eligible'=>false,'qualification_complete'=>false,'body_height'=>1,
            'plan'=>['id'=>$id,'preparation_id'=>$run->id,'source_sha256'=>$source,'raw_rig_sha256'=>$raw,'weight_solve_id'=>$solve,
                'files'=>['raw.glb'=>$raw,'weight-report.json'=>$weightReport,'body-weights.npz'=>$weights],
                'poses'=>$poses,'fields'=>['raw','regional','full'],'orbits'=>[0,1,3]],'poses'=>[],'assets'=>[],'views'=>[]];
        if($bounded){
            $parent=(string)Str::uuid();$state=$run->state;$parentReport=$r;$parentReport['id']=$parent;$parentReport['plan']['id']=$parent;
            $parentHash=hash('sha256',json_encode($parentReport));$state['weight_field_comparisons'][$parent]=['report'=>$parentReport,'report_sha256'=>$parentHash,'publication_eligible'=>false,'assessment'=>['scope'=>'Prior diagnostic comparison.']];$run->update(['state'=>$state]);
            $r['method']='fixed-rig-bounded-weight-field-comparison-v1';$r['plan']['fields'][]='bounded';$r['plan']['parent_review_id']=$parent;$r['plan']['parent_report_sha256']=$parentHash;
            $r['plan']['correction']='influence-bounded-bbw-v1';$r['plan']['correction_policy']=['method'=>'influence-bounded-bbw-v1'];
            $r['correction']=['policy'=>$r['plan']['correction_policy'],'modified_vertices'=>10,'protected_hand_vertices'=>3,'protected_torso_vertices'=>2,
                'protected_hand_max_weight_delta'=>0,'protected_torso_max_weight_delta'=>0,'max_normalization_error'=>0,'minimum_weight'=>0];
            $weightsBytes='PK-bounded-weights';file_put_contents($dir.'/bounded-weights.npz',$weightsBytes);
            $r['weight_artifact']=['file'=>'bounded-weights.npz','bytes'=>strlen($weightsBytes),'sha256'=>hash('sha256',$weightsBytes)];
        }
        $json=json_encode(['asset'=>['version'=>'2.0'],'meshes'=>[['primitives'=>[]]]]);$json=str_pad($json,(int)(ceil(strlen($json)/4)*4),' ');
        $glb='glTF'.pack('VVVV',2,20+strlen($json),strlen($json),0x4E4F534A).$json;
        foreach($poses as [$joint,$degrees]){
            $r['poses'][]=['joint'=>$joint,'degrees'=>$degrees,'raw_blender_max_error'=>0.0,...($bounded?['hand_max_position_delta_vs_raw'=>0,'torso_max_position_delta_vs_raw'=>0]:[])];
            foreach($r['plan']['fields'] as $field){
                $key="$field-$joint-$degrees";$file="site/snapshots/$key.glb";file_put_contents($dir.'/'.$file,$glb);
                $r['assets'][]=['field'=>$field,'joint'=>$joint,'degrees'=>$degrees,'file'=>$file,'sha256'=>hash('sha256',$glb),'bytes'=>strlen($glb),
                    'static_only'=>true,'reimport_max_surface_distance'=>0.0,'camera_target_gltf'=>[0,1,0]];
                foreach([0,1,3] as $orbit){
                    $file="screenshots/$key-orbit$orbit.png";$png="\x89PNG\r\n\x1a\n".$file;file_put_contents($dir.'/'.$file,$png);
                    $r['views'][]=['field'=>$field,'joint'=>$joint,'degrees'=>$degrees,'orbit'=>$orbit,'file'=>$file,'sha256'=>hash('sha256',$png),
                        'snapshot_sha256'=>hash('sha256',$glb),'right_handed'=>true,'camera'=>['alpha'=>$orbit*M_PI/4,'beta'=>1.35,'radius'=>.42,'target'=>[0,1,0]]];
                }
            }
        }
        file_put_contents($dir.'/visual-report.json',json_encode($r));
        file_put_contents($dir.'/visual-assessment.json',json_encode(['review_id'=>$id,'publication_eligible'=>false,'qualification_complete'=>false,
            'scope'=>'Diagnostic comparison; shape remains unqualified.','inspected_screenshots'=>[array_intersect_key($r['views'][0],array_flip(['file','sha256']))]]));
        return [$run,$dir,$r];
    }
    public function test_weight_field_evidence_is_shared_by_api_and_preview_and_cannot_publish():void {
        [$run,$dir,$r]=$this->fieldComparisonFixture();$service=app(\App\Services\AvatarWeightFieldComparisonService::class);
        $service->retain($run,$dir);$service->retain($run->fresh(),$dir);$run->refresh();
        $this->assertSame($r['id'],$run->state['weight_field_comparisons'][$r['id']]['report']['id']);
        $this->assertArrayNotHasKey('skinning_reviews',$run->state);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->get('/evolution/avatars/preparation/'.$run->id.'/preview')->assertOk()->assertSee('Weight field comparison')->assertSee('not playable avatars');
        $this->getJson('/evolution/avatars/preparation/'.$run->id.'/report?format=json')->assertOk()
            ->assertJsonPath('preparation.state.weight_field_comparisons.'.$r['id'].'.report.id',$r['id']);
        $sha=$r['views'][0]['sha256'];$url='/evolution/avatars/preparation/'.$run->id.'/files/weight-field-'.$r['id'].'-'.$sha.'.png';
        $this->get($url)->assertOk()->assertContent(file_get_contents($dir.'/'.$r['views'][0]['file']));
        $path='avatar-preparations/'.$run->id.'/weight-fields/'.$r['id'].'/'.$sha.'.png';
        \Illuminate\Support\Facades\Storage::disk('local')->put($path,'tampered');$this->get($url)->assertStatus(409);
        $state=$run->state;$state['cloud_raw_rig']['artifact']['sha256']=str_repeat('f',64);$run->update(['state'=>$state]);$this->get($url)->assertNotFound();
        $this->postJson('/evolution/avatars/preparation/'.$run->id.'/publish',['identity_review'=>true])->assertUnprocessable();
        $this->assertDatabaseCount('avatar_visual_releases',0);
    }
    public function test_field_comparison_rejects_unmatched_cameras_before_registration():void {
        [$run,$dir,$r]=$this->fieldComparisonFixture();$r['views'][3]['camera']['target']=[0,2,0];file_put_contents($dir.'/visual-report.json',json_encode($r));
        try{app(\App\Services\AvatarWeightFieldComparisonService::class)->retain($run,$dir);$this->fail('Accepted unmatched cameras');}
        catch(\RuntimeException $e){$this->assertSame('Camera mismatch',$e->getMessage());}
        $this->assertArrayNotHasKey('weight_field_comparisons',$run->fresh()->state);
    }
    public function test_bounded_field_retains_weights_and_protection_evidence_without_promoting_candidate():void {
        [$run,$dir,$r]=$this->fieldComparisonFixture(true);$service=app(\App\Services\AvatarWeightFieldComparisonService::class);
        $receipt=$service->retain($run,$dir);$this->assertSame(48,$receipt['screenshots']);$this->assertSame(16,$receipt['snapshots']);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->get('/evolution/avatars/preparation/'.$run->id.'/preview')->assertOk()->assertSee('Influence-based BBW')->assertSee('Download experimental dense weights');
        $sha=$r['weight_artifact']['sha256'];$url='/evolution/avatars/preparation/'.$run->id.'/files/weight-field-'.$r['id'].'-'.$sha.'.npz';
        $this->get($url)->assertOk()->assertContent('PK-bounded-weights');
        \Illuminate\Support\Facades\Storage::disk('local')->put('avatar-preparations/'.$run->id.'/weight-fields/'.$r['id'].'/'.$sha.'.npz','changed');
        $this->get($url)->assertStatus(409);$this->assertArrayNotHasKey('skinning_reviews',$run->fresh()->state);
        $this->postJson('/evolution/avatars/preparation/'.$run->id.'/publish',['identity_review'=>true])->assertUnprocessable();
    }
    public function test_bounded_field_rejects_changed_protected_weights():void {
        [$run,$dir,$r]=$this->fieldComparisonFixture(true);$r['correction']['protected_hand_max_weight_delta']=.01;file_put_contents($dir.'/visual-report.json',json_encode($r));
        try{app(\App\Services\AvatarWeightFieldComparisonService::class)->retain($run,$dir);$this->fail('Accepted changed protected weights');}
        catch(\RuntimeException $e){$this->assertSame('Protected field weights changed',$e->getMessage());}
        $this->assertArrayNotHasKey($r['id'],$run->fresh()->state['weight_field_comparisons']);
    }
    public function test_continuous_support_revision_requires_the_retained_first_correction():void {
        [$run,$dir,$r]=$this->fieldComparisonFixture(true);$service=app(\App\Services\AvatarWeightFieldComparisonService::class);$service->retain($run,$dir);$run->refresh();
        $prior=$r['id'];$r['id']=(string)Str::uuid();$r['plan']['id']=$r['id'];$r['method']='fixed-rig-bounded-weight-field-comparison-v2';
        $r['plan']['correction']='influence-bounded-bbw-v2';$r['plan']['correction_policy']['method']='influence-bounded-bbw-v2';$r['correction']['policy']=$r['plan']['correction_policy'];
        $r['plan']['fields'][]='bounded_soft';$r['plan']['revision_of']=(string)Str::uuid();
        foreach(['assets','views'] as $collection)foreach($r[$collection] as $proof){
            if($proof['field']!=='bounded')continue;
            $new=$proof;$new['field']='bounded_soft';$new['file']=str_replace('/bounded-','/bounded_soft-',$proof['file']);copy($dir.'/'.$proof['file'],$dir.'/'.$new['file']);$r[$collection][]=$new;
        }
        $a=json_decode(file_get_contents($dir.'/visual-assessment.json'),true);$a['review_id']=$r['id'];file_put_contents($dir.'/visual-assessment.json',json_encode($a));
        file_put_contents($dir.'/visual-report.json',json_encode($r));
        try{$service->retain($run,$dir);$this->fail('Accepted unknown prior correction');}
        catch(\RuntimeException $e){$this->assertSame('Missing matching prior bounded field',$e->getMessage());}
        $r['plan']['revision_of']=$prior;file_put_contents($dir.'/visual-report.json',json_encode($r));$receipt=$service->retain($run,$dir);
        $this->assertSame(60,$receipt['screenshots']);$this->assertSame(20,$receipt['snapshots']);
    }
    public function test_stage_audit_preview_shows_seam_limits_without_qualifying_model():void {
        \Illuminate\Support\Facades\Storage::fake('local');
        $run=$this->admit();$joint=['geometric_boundary_edges'=>0,'duplicate_weight_l1_over_0_01'=>0];
        $stage=['meshes'=>[['vertices'=>42,'boundary_edges'=>10,'nonmanifold_edges'=>10]],'local'=>['ThighL'=>$joint]];
        $visualId=(string)Str::uuid();$image="\x89PNG\r\n\x1a\n".'diagnostic';$hash=hash('sha256',$image);
        $imagePath='avatar-preparations/'.$run->id.'/stage-visual/'.$visualId.'/'.$hash.'.png';
        \Illuminate\Support\Facades\Storage::disk('local')->put($imagePath,$image);
        $state=['preparation'=>['sha256'=>str_repeat('c',64)],
            'stage_geometry_audits'=>['geometry'=>['report'=>['id'=>'geometry-1','stages'=>['raw'=>$stage]]]],
            'joint_seam_audits'=>['seams'=>['report'=>['id'=>'seams-1','stages'=>['raw'=>$stage]]]],
            'stage_visual_audits'=>[$visualId=>['publication_eligible'=>false,'report'=>['id'=>$visualId,'status'=>'rendered_for_review',
                'views'=>[['stage'=>'raw','joint'=>'ThighL','degrees'=>90,'orbit'=>1,'sha256'=>$hash]]]]]];
        $run->update(['status'=>'needs_review','state'=>$state]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $this->get('/evolution/avatars/preparation/'.$run->id.'/preview')->assertOk()
            ->assertSee('Source and rig stage geometry')->assertSee('Joint seam and skin-weight audit')
            ->assertSee('not proof of visual or animation quality')->assertSee('ThighL')->assertSee('Matched joint views');
        $url='/evolution/avatars/preparation/'.$run->id.'/files/stage-visual-'.$visualId.'-'.$hash.'.png';
        $this->get($url)->assertOk()->assertContent($image);
        \Illuminate\Support\Facades\Storage::disk('local')->put($imagePath,'tampered');
        $this->get($url)->assertStatus(409);
        $this->assertSame('needs_review',$run->fresh()->status);$this->assertDatabaseCount('avatar_visual_releases',0);
    }
    public function test_retained_stress_playback_checks_lineage_and_bytes_without_cloud():void {
        \Illuminate\Support\Facades\Storage::fake('local');
        $run=$this->admit();$bytes='glTF'.str_repeat('s',80);$hash=hash('sha256',$bytes);
        $report=['compute'=>'google','source_sha256'=>$run->plan['source_sha256'],
            'rig_sha256'=>str_repeat('c',64),'publication_eligible'=>false,
            'stress_artifact'=>['sha256'=>$hash,'bytes'=>strlen($bytes)],'poses'=>[]];
        $run->update(['status'=>'needs_review','state'=>['preparation'=>['sha256'=>str_repeat('c',64)],
            'cloud_raw_rig'=>['artifact'=>['sha256'=>str_repeat('c',64)]],
            'raw_review'=>['status'=>'completed','report'=>$report],
            'skinning_reviews'=>['test'=>['report'=>['status'=>'review_required','variants'=>[
                ['name'=>'linear_baseline','poses'=>[['joint'=>'UpperArmL','degrees'=>90,'self_intersections'=>384]]],
                ['name'=>'rejected_helper','poses'=>[['joint'=>'UpperArmL','degrees'=>90,'self_intersections'=>480]]],
            ]]]]]]);
        $service=app(\App\Services\AvatarRawRigReviewArtifactService::class);
        $service->retain($run,$bytes);$service->retain($run,$bytes);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $url='/evolution/avatars/preparation/'.$run->id;
        $this->get($url.'/preview?view=stress')->assertOk()->assertSee('Deep bends contain known intersections')->assertSee('/files/stress.glb')->assertSee('+96')->assertSee('worse');
        $this->get($url.'/files/stress.glb')->assertOk()->assertContent($bytes);
        $this->assertSame('needs_review',$run->fresh()->status);
        $this->assertDatabaseCount('avatar_visual_releases',0);
        \Illuminate\Support\Facades\Storage::disk('local')->put('avatar-preparations/'.$run->id.'/diagnostics/'.$hash.'.glb','corrupted');
        $this->get($url.'/files/stress.glb')->assertStatus(409);
        $state=$run->state;$state['raw_review']['report']['rig_sha256']=str_repeat('d',64);$run->update(['state'=>$state]);
        $this->get($url.'/files/stress.glb')->assertStatus(409);
        Http::assertNotSent(fn($r)=>!str_ends_with($r->url(),'/operations'));
    }
    public function test_cancel_uses_the_same_cloud_attempt_and_needs_acknowledgement():void {
        $run=$this->admit();$run->update(['status'=>'cancelling']);
        Http::fake(['*/rigging/jobs/'.$run->id.'/cancel'=>Http::response(['id'=>$run->id,'status'=>'cancelled'])]);
        app(AvatarJobCancellationService::class)->synchronize('preparation',$run->id);
        $this->assertSame('cancelled',$run->fresh()->status);
        Http::assertNotSent(fn($r)=>!str_contains($r->url(),'/rigging/'));
    }
    public function test_candidate_bends_require_the_exact_registered_candidate_and_verified_clip_review():void {
        \Illuminate\Support\Facades\Storage::fake('local');
        $run=$this->admit();$candidateId=(string)Str::uuid();$reviewId=(string)Str::uuid();
        $bind='glTF'.str_repeat('c',80);$bindHash=hash('sha256',$bind);
        $bends='glTF'.str_repeat('m',80);$bendHash=hash('sha256',$bends);$rawHash=str_repeat('c',64);
        $candidateReport=['compute'=>'google','source_sha256'=>$run->plan['source_sha256'],'rig_sha256'=>$rawHash,
            'qualification_complete'=>false,'publication_eligible'=>false,'status'=>'review_required',
            'poses'=>[['joint'=>'UpperArmL','degrees'=>90,'self_intersections'=>144,'delta_vs_parent'=>-71,
                'edge_deformation'=>['severely_stretched_edges'=>0]]],
            'artifact'=>['sha256'=>$bindHash,'bytes'=>strlen($bind)]];
        $visual=['plan'=>['id'=>$reviewId,'preparation_id'=>$run->id,'compute'=>'google','publication_eligible'=>false,'qualification_complete'=>false,
                'candidates'=>['current'=>['id'=>$candidateId,'artifact_sha256'=>$bindHash]]],
            'bend_export'=>['id'=>$reviewId,'compute'=>'google','status'=>'diagnostic_clips_exported',
                'publication_eligible'=>false,'qualification_complete'=>false,'assets'=>[['label'=>'current',
                    'source_sha256'=>$bindHash,'stress_sha256'=>$bendHash,'stress_bytes'=>strlen($bends),'baseline_reproduced'=>true]]],
            'render'=>['id'=>$reviewId,'compute'=>'google','status'=>'rendered_for_review','publication_eligible'=>false,'qualification_complete'=>false]];
        $run->update(['status'=>'needs_review','state'=>['preparation'=>['sha256'=>$rawHash],
            'cloud_raw_rig'=>['artifact'=>['sha256'=>$rawHash]],
            'skinning_reviews'=>[$candidateId=>['plan'=>['id'=>$candidateId,'compute'=>'google'],'report'=>$candidateReport]],
            'candidate_visual_reviews'=>[$reviewId=>$visual]]]);
        $service=app(\App\Services\AvatarRawRigReviewArtifactService::class);
        $service->retainCandidate($run,$candidateId,$bind);$service->retainCandidateBends($run,$reviewId,$candidateId,$bends);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $base='/evolution/avatars/preparation/'.$run->id;
        $file=$base.'/files/candidate-bends-'.$reviewId.'-'.$candidateId.'.glb';
        $this->get($base.'/preview?view=candidate-bends&candidate='.$candidateId.'&visual_review='.$reviewId)
            ->assertOk()->assertSee('Play measured candidate bends')->assertSee('recorded 45/90-degree poses')->assertSee($file)
            ->assertSee('localized weight transfer')->assertSee('-71 fewer');
        $this->get($file)->assertOk()->assertContent($bends);
        $state=$run->state;$state['skinning_reviews'][$candidateId]['report']['corrective_recipe']=['joints'=>['UpperArmL']];
        $state['skinning_reviews'][$candidateId]['report']['corrective_stress_artifact']=[
            'source_candidate_sha256'=>$bindHash,'sha256'=>$bendHash,'bytes'=>strlen($bends)];
        $run->update(['state'=>$state]);$this->get($file)->assertOk()->assertContent($bends);
        $this->get($base.'/preview?view=candidate-bends&candidate='.$candidateId.'&visual_review='.$reviewId)
            ->assertOk()->assertSee('Baked pose correctives')->assertSee('Baked pose corrective');
        $state['skinning_reviews'][$candidateId]['report']['corrective_stress_artifact']['sha256']=str_repeat('f',64);
        $run->update(['state'=>$state]);$this->get($file)->assertStatus(409);
        $state['skinning_reviews'][$candidateId]['report']['corrective_stress_artifact']['sha256']=$bendHash;
        $run->update(['state'=>$state]);
        $this->get($base.'/preview?view=candidate-bends&candidate='.$candidateId.'&visual_review='.Str::uuid())->assertNotFound();
        $state=$run->state;$state['candidate_visual_reviews'][$reviewId]['plan']['candidates']['current']['artifact_sha256']=str_repeat('e',64);
        $run->update(['state'=>$state]);$this->get($file)->assertStatus(409);
        $state['candidate_visual_reviews'][$reviewId]=$visual;$run->update(['state'=>$state]);
        \Illuminate\Support\Facades\Storage::disk('local')->put('avatar-preparations/'.$run->id.'/diagnostics/'.$bendHash.'.glb','corrupted');
        $this->get($file)->assertStatus(409);
        $this->assertSame('needs_review',$run->fresh()->status);$this->assertDatabaseCount('avatar_visual_releases',0);
        Http::assertNotSent(fn($r)=>!str_ends_with($r->url(),'/operations'));
    }
}
