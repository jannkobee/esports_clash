<?php
namespace Tests\Feature;

use App\Models\{AvatarPreparation,TrellisGeneration,User};
use App\Services\{AvatarCloudRawRigService,AvatarPoseContractReviewService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http,Storage};
use Illuminate\Support\Str;
use Tests\TestCase;

class AvatarPoseContractReviewTest extends TestCase
{
    use RefreshDatabase;

    private function fixture():array {
        Http::preventStrayRequests();Storage::fake('local');
        $source=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'generated_unqualified','plan'=>[],'state'=>[]]);
        $id=(string)Str::uuid();$field=(string)Str::uuid();
        $run=AvatarPreparation::create(['id'=>(string)Str::uuid(),'generation_id'=>$source->id,'avatar_id'=>'c_invoker','status'=>'needs_review',
            'plan'=>['profile'=>AvatarCloudRawRigService::PROFILE,'source_sha256'=>str_repeat('a',64),'source_compute'=>'local','compute'=>'google'],
            'state'=>['preparation'=>['sha256'=>str_repeat('b',64)],'cloud_raw_rig'=>['artifact'=>['sha256'=>str_repeat('b',64)]],
                'weight_field_comparisons'=>[$field=>['report_sha256'=>str_repeat('c',64),'report'=>['weight_artifact'=>['sha256'=>str_repeat('d',64)]]]]]]);
        $dir=Storage::disk('local')->path('fixture');mkdir($dir.'/site/snapshots',0777,true);mkdir($dir.'/screenshots');
        $json=json_encode(['asset'=>['version'=>'2.0'],'meshes'=>[['primitives'=>[]]],'nodes'=>[['mesh'=>0]]]);$json=str_pad($json,(int)(ceil(strlen($json)/4)*4),' ');
        $glb='glTF'.pack('VVVV',2,20+strlen($json),strlen($json),0x4E4F534A).$json;$png="\x89PNG\r\n\x1a\n".'test';
        $poses=[['UpperArmL',45],['UpperArmL',90],['ThighL',90],['ThighR',90]];$modes=['legacy','world_target','coordinated'];
        $r=['id'=>$id,'method'=>'fixed-weight-joint-pose-contract-v1','compute'=>'google','status'=>'rendered_for_review','errors'=>[],
            'candidate_available'=>false,'publication_eligible'=>false,'qualification_complete'=>false,'body_height'=>1,'weight_sha256'=>str_repeat('d',64),
            'plan'=>['id'=>$id,'preparation_id'=>$run->id,'source_sha256'=>str_repeat('a',64),'raw_rig_sha256'=>str_repeat('b',64),
                'weight_field_review_id'=>$field,'weight_field_report_sha256'=>str_repeat('c',64),'orbits'=>[0,1,3],
                'files'=>['raw.glb'=>str_repeat('b',64),'weight-field-report.json'=>str_repeat('c',64),'bounded-weights.npz'=>str_repeat('d',64)],
                'contract'=>['version'=>'world-direction-joint-contract-v1','modes'=>$modes,'poses'=>$poses,
                    'shoulder_parent_forward_rotation_degrees'=>15,'hip_child_knee_flexion_degrees'=>60,'max_target_error_degrees'=>.01]],
            'poses'=>[],'assets'=>[],'views'=>[]];
        foreach($poses as [$joint,$degrees])foreach($modes as $mode){
            $key="$mode-$joint-$degrees";
            $r['poses'][]=['mode'=>$mode,'joint'=>$joint,'degrees'=>$degrees,'target_error_degrees'=>0,'center_delta_from_rest'=>0,
                'parent_rotation_degrees'=>$mode==='coordinated'&&str_starts_with($joint,'UpperArm')?15:0,
                'child_rotation_degrees'=>$mode==='coordinated'&&str_starts_with($joint,'Thigh')?60:0];
            $file='site/snapshots/'.$key.'.glb';file_put_contents($dir.'/'.$file,$glb);
            $r['assets'][]=['mode'=>$mode,'joint'=>$joint,'degrees'=>$degrees,'file'=>$file,'sha256'=>hash('sha256',$glb),'bytes'=>strlen($glb),
                'static_only'=>true,'reimport_max_surface_distance'=>0,'camera_target_gltf'=>[0,0,0]];
            foreach([0,1,3] as $orbit){
                $file='screenshots/'.$key.'-orbit'.$orbit.'.png';file_put_contents($dir.'/'.$file,$png);
                $r['views'][]=['mode'=>$mode,'joint'=>$joint,'degrees'=>$degrees,'orbit'=>$orbit,'file'=>$file,'sha256'=>hash('sha256',$png),
                    'snapshot_sha256'=>hash('sha256',$glb),'right_handed'=>true,'camera'=>['radius'=>.42,'alpha'=>$orbit*M_PI/4,'beta'=>1.35,'target'=>[0,0,0]]];
            }
        }
        file_put_contents($dir.'/visual-report.json',json_encode($r));
        file_put_contents($dir.'/visual-assessment.json',json_encode(['review_id'=>$id,'publication_eligible'=>false,'qualification_complete'=>false,
            'scope'=>'Static diagnostic, unresolved deformation','inspected_screenshots'=>[['file'=>$r['views'][0]['file'],'sha256'=>$r['views'][0]['sha256']]]]));
        file_put_contents($dir.'/pose-audit.json',json_encode(['compute'=>'google','raw_rig_sha256'=>str_repeat('b',64),'source_sha256'=>str_repeat('a',64)]));
        return [$run,$dir,$r,$png];
    }

    public function test_pose_evidence_is_shared_immutable_and_cannot_publish():void {
        [$run,$dir,$r,$png]=$this->fixture();$service=app(AvatarPoseContractReviewService::class);
        $receipt=$service->retain($run,$dir);$this->assertSame(36,$receipt['screenshots']);$this->assertSame(12,$receipt['snapshots']);
        $this->assertSame($receipt,$service->retain($run->fresh(),$dir));
        // The weight fixture is intentionally minimal; only pose evidence is rendered in this request.
        $state=$run->fresh()->state;$field=$r['plan']['weight_field_review_id'];
        $state['weight_field_comparisons'][$field]['report']+=['id'=>$field,'method'=>'fixture','plan'=>['poses'=>[]],'views'=>[],'assets'=>[]];
        $state['weight_field_comparisons'][$field]['assessment']=['scope'=>'Fixture weights'];
        $run->update(['state'=>$state]);
        $this->actingAs(User::factory()->create(['is_evolution_admin'=>true]));$base='/evolution/avatars/preparation/'.$run->id;
        $this->get($base.'/preview')->assertOk()->assertSee('Joint pose contract')->assertSee('Explicit world target');
        $this->getJson($base.'/report?format=json')->assertOk()->assertJsonPath('preparation.state.pose_contract_reviews.'.$r['id'].'.report_sha256',$receipt['report_sha256']);
        $sha=$r['views'][0]['sha256'];$url=$base.'/files/pose-contract-'.$r['id'].'-'.$sha.'.png';
        $this->get($url)->assertOk()->assertContent($png);
        Storage::disk('local')->put('avatar-preparations/'.$run->id.'/pose-contracts/'.$r['id'].'/'.$sha.'.png','tampered');$this->get($url)->assertStatus(409);
        $state=$run->fresh()->state;$state['weight_field_comparisons'][$field]['report']['weight_artifact']['sha256']=str_repeat('e',64);$run->update(['state'=>$state]);
        $this->get($url)->assertNotFound();
        $this->postJson($base.'/publish',['identity_review'=>true])->assertUnprocessable();$this->assertDatabaseCount('avatar_visual_releases',0);
        $this->assertSame('needs_review',$run->fresh()->status);Http::assertNothingSent();
    }

    public function test_pose_review_rejects_missed_direction_and_changed_camera():void {
        [$run,$dir,$r]=$this->fixture();$service=app(AvatarPoseContractReviewService::class);
        $bad=$r;$bad['poses'][1]['target_error_degrees']=2;file_put_contents($dir.'/visual-report.json',json_encode($bad));
        try{$service->retain($run,$dir);$this->fail('Accepted missed target');}catch(\RuntimeException $e){$this->assertSame('World target was missed',$e->getMessage());}
        $bad=$r;$bad['views'][3]['camera']['target']=[0,1,0];file_put_contents($dir.'/visual-report.json',json_encode($bad));
        try{$service->retain($run,$dir);$this->fail('Accepted changed camera');}catch(\RuntimeException $e){$this->assertSame('Pose camera mismatch',$e->getMessage());}
        $this->assertArrayNotHasKey('pose_contract_reviews',$run->fresh()->state);
    }

    public function test_pose_review_rejects_weight_replacement_and_evidence_rewrite():void {
        [$run,$dir,$r]=$this->fixture();$service=app(AvatarPoseContractReviewService::class);
        $bad=$r;$bad['weight_sha256']=str_repeat('e',64);file_put_contents($dir.'/visual-report.json',json_encode($bad));
        try{$service->retain($run,$dir);$this->fail('Accepted different weights');}catch(\RuntimeException $e){$this->assertSame('Invalid pose contract or lineage',$e->getMessage());}
        file_put_contents($dir.'/visual-report.json',json_encode($r));$service->retain($run,$dir);
        $a=json_decode(file_get_contents($dir.'/visual-assessment.json'),true);$a['scope']='rewritten';file_put_contents($dir.'/visual-assessment.json',json_encode($a));
        try{$service->retain($run->fresh(),$dir);$this->fail('Overwrote immutable evidence');}catch(\RuntimeException $e){$this->assertSame('Pose evidence is immutable',$e->getMessage());}
    }
}
