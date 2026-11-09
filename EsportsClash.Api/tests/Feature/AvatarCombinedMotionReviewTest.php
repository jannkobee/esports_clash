<?php
namespace Tests\Feature;
use Tests\TestCase;
use App\Models\{AvatarPreparation,TrellisGeneration};
use App\Services\AvatarCombinedMotionReviewService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
class AvatarCombinedMotionReviewTest extends TestCase
{
 use RefreshDatabase;
 private function fixture():array {
  Storage::fake('local');$source=str_repeat('a',64);
  $generation=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'generated_unqualified','plan'=>[],'state'=>[]]);
  $run=AvatarPreparation::create(['id'=>(string)Str::uuid(),'generation_id'=>$generation->id,'avatar_id'=>'c_invoker','status'=>'needs_review','plan'=>[],'state'=>['animation_playback_reviews'=>[$source=>['export'=>['sha256'=>$source]]]]]);
  $dir=Storage::disk('local')->path('fixture');mkdir($dir.'/combined-screenshots',0777,true);
  $base=['compute'=>'google','source_sha256'=>$source,'publication_eligible'=>false,'qualification_complete'=>false];
  $motion=$base+['method'=>'exported-combined-motion-v1','status'=>'requires_visual_review','bones'=>52,'max_influences'=>7,'sampled_contact_pass'=>false,'poses'=>[]];$visual=$base+['status'=>'rendered_for_review','errors'=>[],'views'=>[]];
  $cases=[];foreach([['ThighL',60,60],['ThighL',90,90],['ThighR',60,60],['UpperArmL',60,60],['UpperArmR',60,60]] as [$role,$angle,$child])foreach([-20,0,20] as $twist)$cases[]=[$role,$angle,$child,$twist];$cases[]=['UpperArmL',90,90,0];$cases[]=['UpperArmR',90,90,0];
  foreach($cases as $i=>[$role,$angle,$child,$twist]){
   $case=sprintf('%02d-%s-%d-child%d-twist%d',$i,$role,$angle,$child,$twist);
   $motion['poses'][]=['case'=>$case,'role'=>$role,'bend'=>$angle,'child_local_x_degrees'=>$child,'twist'=>$twist,'collision'=>['finite'=>true,'self_intersections'=>$i===0?1:0]];
   foreach(['front','side'] as $view){$file='combined-screenshots/'.$case.'-'.$view.'.png';$body="\x89PNG\r\n\x1a\n".$file;file_put_contents($dir.'/'.$file,$body);$visual['views'][]=['case'=>$case,'view'=>$view,'file'=>$file,'sha256'=>hash('sha256',$body)];}
  }
  $controlCases=[];foreach([0,.25,.5,.75,1] as $strength)$controlCases[]=['ThighL',90,90,20,'world_target',$strength];
  foreach(['UpperArmL','UpperArmR'] as $role)foreach([60,90] as $angle)foreach([0,60] as $child)foreach(['world_target','coordinated'] as $mode)$controlCases[]=[$role,$angle,$child,0,$mode,0];
  $controls=array_map(fn($c)=>array_combine(['role','angle','child_local_x','twist','mode','corrective_strength'],$c)+['collision'=>['finite'=>true,'self_intersections'=>0]],$controlCases);
  foreach(['combined-motion-report.json'=>$motion,'combined-visual-report.json'=>$visual,'combined-control-report.json'=>$base+['status'=>'controls_complete','controls'=>$controls],'combined-assessment.json'=>['publication_eligible'=>false,'qualification_complete'=>false]] as $name=>$r)file_put_contents($dir.'/'.$name,json_encode($r));
  return [$run,$dir];
 }
 public function test_intersections_are_retained_without_admitting_production():void {
  [$run,$dir]=$this->fixture();$r=app(AvatarCombinedMotionReviewService::class)->retain($run,$dir);
  $this->assertSame(1,$r['failed_pose_count']);$this->assertFalse($r['motion_qualification_pass']);$this->assertFalse($r['skin_profile']['production_admitted']);$this->assertSame('needs_review',$run->fresh()->status);
 }
 public function test_same_evidence_can_be_retained_again_after_database_roundtrip():void {
  [$run,$dir]=$this->fixture();$p=$dir.'/combined-assessment.json';$r=json_decode(file_get_contents($p),true);$r['float_measurement']=1.0;file_put_contents($p,json_encode($r,JSON_PRESERVE_ZERO_FRACTION));
  $service=app(AvatarCombinedMotionReviewService::class);$first=$service->retain($run,$dir);$second=$service->retain($run->fresh(),$dir);$this->assertSame($first['report_sha256'],$second['report_sha256']);
 }
 public function test_false_contact_pass_is_rejected():void {
  [$run,$dir]=$this->fixture();$p=$dir.'/combined-motion-report.json';$r=json_decode(file_get_contents($p),true);$r['sampled_contact_pass']=true;file_put_contents($p,json_encode($r));
  $this->expectException(RuntimeException::class);$this->expectExceptionMessage('Contradictory motion pass');app(AvatarCombinedMotionReviewService::class)->retain($run,$dir);
 }
 public function test_missing_views_are_rejected():void {
  [$run,$dir]=$this->fixture();$p=$dir.'/combined-visual-report.json';$r=json_decode(file_get_contents($p),true);array_pop($r['views']);file_put_contents($p,json_encode($r));
  $this->expectException(RuntimeException::class);$this->expectExceptionMessage('Incomplete combined motion coverage');app(AvatarCombinedMotionReviewService::class)->retain($run,$dir);
 }
 public function test_changed_parent_is_rejected():void {
  [$run,$dir]=$this->fixture();$run->state=[];$this->expectException(RuntimeException::class);$this->expectExceptionMessage('Missing exact exported parent');app(AvatarCombinedMotionReviewService::class)->retain($run,$dir);
 }
}
