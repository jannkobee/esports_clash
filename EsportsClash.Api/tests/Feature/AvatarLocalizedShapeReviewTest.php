<?php
namespace Tests\Feature;
use App\Models\{AvatarPreparation,TrellisGeneration,User};
use App\Services\{AvatarCloudRawRigService,AvatarLocalizedShapeReviewService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http,Storage};
use Illuminate\Support\Str;
use Tests\TestCase;

class AvatarLocalizedShapeReviewTest extends TestCase
{
    use RefreshDatabase;
    private function fixture():array {
        Http::preventStrayRequests();Storage::fake('local');$field=(string)Str::uuid();$pose=(string)Str::uuid();$id=(string)Str::uuid();
        $source=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'generated_unqualified','plan'=>[],'state'=>[]]);
        $run=AvatarPreparation::create(['id'=>(string)Str::uuid(),'generation_id'=>$source->id,'avatar_id'=>'c_invoker','status'=>'needs_review',
            'plan'=>['profile'=>AvatarCloudRawRigService::PROFILE,'source_compute'=>'local','source_sha256'=>str_repeat('a',64)],
            'state'=>['preparation'=>['sha256'=>str_repeat('b',64)],'cloud_raw_rig'=>['artifact'=>['sha256'=>str_repeat('b',64)]],
                'weight_field_comparisons'=>[$field=>['report_sha256'=>str_repeat('c',64),'assessment'=>['scope'=>'Fixture'],
                    'report'=>['id'=>$field,'plan'=>['poses'=>[]],'views'=>[],'assets'=>[],'weight_artifact'=>['sha256'=>str_repeat('d',64)]]]],
                'pose_contract_reviews'=>[$pose=>['report_sha256'=>str_repeat('e',64),'assessment'=>['scope'=>'Fixture'],
                    'report'=>['id'=>$pose,'plan'=>['contract'=>['poses'=>[]]],'views'=>[],'assets'=>[]]]]]]);
        $dir=Storage::disk('local')->path('fixture');mkdir($dir.'/site/snapshots',0777,true);mkdir($dir.'/screenshots');
        $json=json_encode(['asset'=>['version'=>'2.0'],'meshes'=>[['primitives'=>[]]],'nodes'=>[['mesh'=>0]]]);$json=str_pad($json,(int)(ceil(strlen($json)/4)*4),' ');
        $glb='glTF'.pack('VVVV',2,20+strlen($json),strlen($json),0x4E4F534A).$json;$png="\x89PNG\r\n\x1a\n".'shape';$npz='PK-shape';
        $r=['id'=>$id,'method'=>'localized-hip-sculpt-pilot-v1','compute'=>'google','status'=>'rendered_for_review','errors'=>[],
            'candidate_available'=>false,'publication_eligible'=>false,'qualification_complete'=>false,'body_height'=>1,'weight_sha256'=>str_repeat('d',64),
            'sculpt'=>['max_rest_delta'=>.02,'outside_patch_delta'=>0,'seam_delta_spread'=>0,'active_vertices'=>380],
            'plan'=>['id'=>$id,'preparation_id'=>$run->id,'source_sha256'=>str_repeat('a',64),'raw_rig_sha256'=>str_repeat('b',64),
                'weight_field_review_id'=>$field,'weight_field_report_sha256'=>str_repeat('c',64),'parent_pose_review_id'=>$pose,'parent_pose_report_sha256'=>str_repeat('e',64),
                'files'=>['raw.glb'=>str_repeat('b',64),'bounded-weights.npz'=>str_repeat('d',64)],'orbits'=>[1,3,5],
                'policy'=>['version'=>'left-hip-front-crease-handle-v1','joint'=>'ThighL','check_degrees'=>[22.5,45,67.5,90],
                    'amplitude_height'=>.025,'max_rest_delta_height'=>.04,'max_posed_delta_height'=>.03]],'poses'=>[],'views'=>[],'assets'=>[]];
        foreach([0,22.5,45,67.5,90] as $d)$r['poses'][]=['degrees'=>$d,'max_delta'=>$d===0?0:.02,'outside_patch_max_delta'=>0,'seam_spread'=>0,'target_error_degrees'=>0];
        foreach([22.5,45,67.5,90] as $d)foreach(['baseline','sculpt'] as $mode){
            $key="$mode-ThighL-$d";$file='site/snapshots/'.$key.'.glb';file_put_contents($dir.'/'.$file,$glb);
            $r['assets'][]=['mode'=>$mode,'joint'=>'ThighL','degrees'=>$d,'file'=>$file,'sha256'=>hash('sha256',$glb),'static_only'=>true,'reimport_max_surface_distance'=>0,'camera_target_gltf'=>[0,0,0]];
            foreach([1,3,5] as $orbit){$file='screenshots/'.$key.'-orbit'.$orbit.'.png';file_put_contents($dir.'/'.$file,$png);
                $r['views'][]=['mode'=>$mode,'joint'=>'ThighL','degrees'=>$d,'orbit'=>$orbit,'file'=>$file,'sha256'=>hash('sha256',$png),
                    'snapshot_sha256'=>hash('sha256',$glb),'right_handed'=>true,'camera'=>['radius'=>.42,'alpha'=>$orbit*M_PI/4,'beta'=>1.35,'target'=>[0,0,0]]];}
        }
        file_put_contents($dir.'/hip-sculpt.npz',$npz);$r['sculpt_artifact']=['file'=>'hip-sculpt.npz','sha256'=>hash('sha256',$npz)];
        file_put_contents($dir.'/visual-report.json',json_encode($r));file_put_contents($dir.'/visual-assessment.json',json_encode([
            'review_id'=>$id,'publication_eligible'=>false,'qualification_complete'=>false,'scope'=>'Shape trial, no animation qualification',
            'inspected_screenshots'=>[['file'=>$r['views'][0]['file'],'sha256'=>$r['views'][0]['sha256']]]]));
        return [$run,$dir,$r,$png];
    }
    public function test_local_shape_evidence_matches_api_and_preview_without_promoting_avatar():void {
        [$run,$dir,$r,$png]=$this->fixture();$service=app(AvatarLocalizedShapeReviewService::class);
        $receipt=$service->retain($run,$dir);$this->assertSame(24,$receipt['screenshots']);$this->assertSame(8,$receipt['snapshots']);
        $this->assertSame($receipt,$service->retain($run->fresh(),$dir));$this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));
        $base='/evolution/avatars/preparation/'.$run->id;$this->get($base.'/preview')->assertOk()->assertSee('Left hip shape correction');
        $this->getJson($base.'/report?format=json')->assertOk()->assertJsonPath('preparation.state.localized_shape_reviews.'.$r['id'].'.report_sha256',$receipt['report_sha256']);
        $sha=$r['views'][0]['sha256'];$url=$base.'/files/local-shape-'.$r['id'].'-'.$sha.'.png';$this->get($url)->assertOk()->assertContent($png);
        Storage::disk('local')->put('avatar-preparations/'.$run->id.'/localized-shapes/'.$r['id'].'/'.$sha.'.png','tampered');$this->get($url)->assertStatus(409);
        $state=$run->fresh()->state;$state['pose_contract_reviews'][$r['plan']['parent_pose_review_id']]['report_sha256']=str_repeat('f',64);$run->update(['state'=>$state]);$this->get($url)->assertNotFound();
        $this->postJson($base.'/publish',['identity_review'=>true])->assertUnprocessable();$this->assertSame('needs_review',$run->fresh()->status);$this->assertDatabaseCount('avatar_visual_releases',0);Http::assertNothingSent();
    }
    public function test_local_shape_requires_rest_and_outside_patch_preservation():void {
        [$run,$dir,$r]=$this->fixture();$service=app(AvatarLocalizedShapeReviewService::class);
        foreach([['max_delta',0],['outside_patch_max_delta',2]] as [$field,$index]){
            $bad=$r;$bad['poses'][$index][$field]=.001;file_put_contents($dir.'/visual-report.json',json_encode($bad));
            try{$service->retain($run,$dir);$this->fail('Accepted preservation failure');}catch(\RuntimeException $e){$this->assertSame('Shape preservation gate failed',$e->getMessage());}
        }
        $this->assertArrayNotHasKey('localized_shape_reviews',$run->fresh()->state);
    }
    public function test_local_shape_rejects_camera_mismatch_and_missing_intermediate_pose():void {
        [$run,$dir,$r]=$this->fixture();$service=app(AvatarLocalizedShapeReviewService::class);
        $bad=$r;$bad['views'][3]['camera']['target']=[0,1,0];file_put_contents($dir.'/visual-report.json',json_encode($bad));
        try{$service->retain($run,$dir);$this->fail('Accepted moved camera');}catch(\RuntimeException $e){$this->assertSame('Shape camera mismatch',$e->getMessage());}
        $bad=$r;array_splice($bad['poses'],2,1);file_put_contents($dir.'/visual-report.json',json_encode($bad));
        try{$service->retain($run,$dir);$this->fail('Accepted missing sample');}catch(\RuntimeException $e){$this->assertSame('Missing intermediate shape samples',$e->getMessage());}
    }
    public function test_contour_revision_requires_its_original_body_and_protected_pelvis():void {
        [$run,$dir,$r]=$this->fixture();$service=app(AvatarLocalizedShapeReviewService::class);$service->retain($run,$dir);$prior=$r['id'];$run->refresh();
        $r['id']=(string)Str::uuid();$r['plan']['id']=$r['id'];$r['plan']['revision_of']=(string)Str::uuid();$r['method']='localized-hip-contour-pilot-v3';
        $r['plan']['policy']=['version'=>'left-hip-landmark-contour-v3','joint'=>'ThighL','check_degrees'=>[22.5,45,67.5,90],
            'max_rest_delta_height'=>.04,'max_posed_delta_height'=>.03,'handle_offset_height'=>[0,-.05,-.01],'radii_height'=>[.075,.07,.12],
            'midline_guard_height'=>-.005,'boundary_fade_start'=>.65,'screen_strength'=>.00005,'authored_degrees'=>[45,90],'max_inverse_condition'=>10,
            'activation'=>'smoothstep interpolation of rest,45,90 targets','protected_above_joint_height'=>.03,'upper_fade_height'=>.02,'tangent_fraction'=>.15];
        $r['sculpt']['policy']=$r['plan']['policy'];$r['sculpt']['target_proofs']=array_map(fn($a)=>['degrees'=>$a,'max_target_delta'=>.01,'protected_upper_max_delta'=>0],[45,90]);
        $assessment=json_decode(file_get_contents($dir.'/visual-assessment.json'),true);$assessment['review_id']=$r['id'];file_put_contents($dir.'/visual-assessment.json',json_encode($assessment));
        file_put_contents($dir.'/visual-report.json',json_encode($r));
        try{$service->retain($run,$dir);$this->fail('Accepted unknown parent');}catch(\RuntimeException $e){$this->assertSame('Invalid shape review or lineage',$e->getMessage());}
        $r['plan']['revision_of']=$prior;$r['sculpt']['target_proofs'][0]['protected_upper_max_delta']=.001;file_put_contents($dir.'/visual-report.json',json_encode($r));
        try{$service->retain($run,$dir);$this->fail('Accepted changed pelvis');}catch(\RuntimeException $e){$this->assertSame('Protected pelvis moved',$e->getMessage());}
        $r['sculpt']['target_proofs'][0]['protected_upper_max_delta']=0;file_put_contents($dir.'/visual-report.json',json_encode($r));
        $receipt=$service->retain($run,$dir);$this->assertSame(24,$receipt['screenshots']);$this->assertFalse($receipt['publication_eligible']);
        $run->refresh();$parent=$r['id'];$r['id']=(string)Str::uuid();$r['plan']['id']=$r['id'];$r['plan']['revision_of']=$parent;$r['method']='localized-hip-contour-pilot-v5';
        $r['plan']['policy']['version']='left-hip-collision-bounded-contour-v5';$r['plan']['policy']['tangent_fraction']=1.0;
        $r['plan']['policy']['collision_backtracking_scales']=[1,.5,.25,.125,.0625];$r['plan']['policy']['collision_check_degrees']=[11.25,22.5,33.75,45,56.25,67.5,78.75,90];$r['sculpt']['policy']=$r['plan']['policy'];
        $r['collision_line_search']=['selected_scale'=>.25,'attempts'=>[['scale'=>.25,'checks'=>array_map(fn($d)=>['degrees'=>$d,'self_intersections'=>0],$r['plan']['policy']['collision_check_degrees'])]]];
        $r['collision_line_search']['attempts'][0]['checks'][6]['self_intersections']=1;file_put_contents($dir.'/visual-report.json',json_encode($r,JSON_PRESERVE_ZERO_FRACTION));
        try{$service->retain($run,$dir);$this->fail('Accepted intersecting target');}catch(\RuntimeException $e){$this->assertSame('Bounded target intersects',$e->getMessage());}
        $r['collision_line_search']['attempts'][0]['checks'][6]['self_intersections']=0;file_put_contents($dir.'/visual-report.json',json_encode($r,JSON_PRESERVE_ZERO_FRACTION));
        $assessment['review_id']=$r['id'];file_put_contents($dir.'/visual-assessment.json',json_encode($assessment));
        $receipt=$service->retain($run,$dir);$this->assertSame(24,$receipt['screenshots']);$this->assertFalse($receipt['publication_eligible']);
    }
}
