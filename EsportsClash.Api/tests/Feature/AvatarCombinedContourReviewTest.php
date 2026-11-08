<?php
namespace Tests\Feature;
use Tests\TestCase;
use App\Models\{AvatarPreparation,TrellisGeneration};
use App\Services\AvatarCombinedContourReviewService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
class AvatarCombinedContourReviewTest extends TestCase
{
 use RefreshDatabase;
 private function fixture(string $method='combined-fixed-boundary-contour-v1'):array {
  Storage::fake('local');$source=str_repeat('a',64);$parent=str_repeat('b',64);$id=(string)Str::uuid();
  $g=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>'c_invoker','status'=>'generated_unqualified','plan'=>[],'state'=>[]]);
  $run=AvatarPreparation::create(['id'=>(string)Str::uuid(),'generation_id'=>$g->id,'avatar_id'=>'c_invoker','status'=>'needs_review','plan'=>[],'state'=>[]]);
  $combined=[];foreach([['ThighL',60,60],['ThighL',90,90],['ThighR',60,60],['UpperArmL',60,60],['UpperArmR',60,60]] as [$role,$angle,$child])foreach([-20,0,20] as $twist)$combined[]=['role'=>$role,'bend'=>$angle,'child_local_x_degrees'=>$child,'twist'=>$twist,'collision'=>['self_intersections'=>1]];
  foreach(['UpperArmL','UpperArmR'] as $role)$combined[]=['role'=>$role,'bend'=>90,'child_local_x_degrees'=>90,'twist'=>0,'collision'=>['self_intersections'=>1]];
  $weight='e42afed24f19eefef5e715f5378b10b805e4994523e6d63a4c931bd12eac7438';$hip=(string)Str::uuid();$hipHash=str_repeat('c',64);
  $run->state=['localized_shape_reviews'=>[$hip=>['report_sha256'=>$hipHash,'report'=>['weight_sha256'=>$weight]]],
    'animation_playback_reviews'=>[$source=>['parent_review_id'=>$hip,'parent_report_sha256'=>$hipHash,'export'=>['sha256'=>$source,'weight_sha256'=>$weight]]],
    'combined_motion_reviews'=>[$parent=>['source_sha256'=>$source,'motion'=>['poses'=>$combined,'body_height'=>1]]]];$run->save();
  $dir=Storage::disk('local')->path('contour-fixture');mkdir($dir.'/repair-screenshots',0777,true);
  $base=['compute'=>'google','publication_eligible'=>false,'qualification_complete'=>false];
  $r=$base+['id'=>$id,'source_sha256'=>$source,'method'=>$method,'status'=>'requires_visual_review','bones'=>52,'max_influences'=>7,'baseline_reproduced'=>['combined'=>17,'isolation'=>21],'body_height'=>1,'poses'=>[],
    'policy'=>['version'=>$method,'shoulder_max_posed_delta_height'=>.02,'shoulder_max_rest_delta_height'=>.02,'hip_total_max_posed_delta_height'=>.03,'hip_total_max_rest_delta_height'=>.04,'inverse_condition_max'=>10],
    'plan'=>['id'=>$id,'preparation_id'=>$run->id,'source_sha256'=>$source,'parent_review_sha256'=>$parent,'files'=>['current-hip-animation.glb'=>$source,'bounded-weights.npz'=>'e42afed24f19eefef5e715f5378b10b805e4994523e6d63a4c931bd12eac7438']]];
  $v=$base+['source_sha256'=>$source,'status'=>'rendered_for_review','errors'=>[],'views'=>[]];
  $cases=[['Rest',0,0,0],['UpperArmL',60,0,0],['UpperArmL',90,0,0],['UpperArmR',60,0,0],['UpperArmR',90,0,0]];
  foreach($combined as $p)$cases[]=[$p['role'],$p['bend'],$p['child_local_x_degrees'],$p['twist']];array_push($cases,['ThighL',90,90,10],['ThighL',90,0,20],['ThighL',75,60,20]);
  $manifest=[];$write=function($file,$body)use($dir,&$manifest){file_put_contents($dir.'/'.$file,$body);$manifest[$file]=['sha256'=>hash('sha256',$body),'bytes'=>strlen($body)];};
  foreach($cases as $i=>[$role,$bend,$child,$twist]){
   $case=sprintf('%02d-%s-%d-child%d-twist%d',$i,$role,$bend,$child,$twist);$p=compact('case','role','bend','child','twist')+['max_posed_delta'=>0];
   foreach(['baseline','candidate'] as $mode){$p[$mode]=['collision'=>['finite'=>true,'self_intersections'=>$i===0?0:($i===1&&$mode==='candidate'?2:1)],'seam_spread'=>0];
    foreach(['front','side','oblique'] as $view){$file='repair-screenshots/'.$case.'-'.$mode.'-'.$view.'.png';$write($file,"\x89PNG\r\n\x1a\n".$file);$v['views'][]=compact('case','mode','view','file')+['sha256'=>$manifest[$file]['sha256']];}}
   $r['poses'][]=$p;
  }
  $r['contact_regressions']=[$r['poses'][1]['case']];
  foreach(['repair-report.json'=>$r,'repair-visual-report.json'=>$v,'repair-assessment.json'=>['status'=>'rejected_regression','summary'=>'Rejected test fixture','publication_eligible'=>false,'qualification_complete'=>false],'export-report.json'=>$base+['status'=>'failed','error'=>'Retained failed export'],'execution-receipt.json'=>['compute'=>'google']] as $file=>$body)$write($file,json_encode($body));
  $write('contour-targets.npz','PKfixture');file_put_contents($dir.'/retention-manifest.json',json_encode($manifest));return [$run,$dir];
 }
 public function test_rejected_attempt_is_immutable_and_never_admits_avatar():void {
  [$run,$dir]=$this->fixture();$service=app(AvatarCombinedContourReviewService::class);$entry=$service->retain($run,$dir);$again=$service->retain($run->fresh(),$dir);
  $this->assertSame($entry['report_sha256'],$again['report_sha256']);$this->assertFalse($entry['production_admitted']);$this->assertSame('needs_review',$run->fresh()->status);
  $view=$entry['visual']['views'][0];$this->assertSame($view['sha256'],hash('sha256',$service->file($run->fresh(),$entry['report_sha256'],$view['sha256'],'png')));
 }
 public function test_changed_parent_is_rejected_before_retention():void {
  [$run,$dir]=$this->fixture();$run->state=[];$this->expectException(RuntimeException::class);$this->expectExceptionMessage('Contour parent lineage mismatch');app(AvatarCombinedContourReviewService::class)->retain($run,$dir);
 }
 public static function handleMethods():array {
  return [['combined-left-shoulder-handles-v5'],['combined-left-section-handles-v6'],['combined-bilateral-section-handles-v7'],['combined-dual-plane-hip-v8'],['combined-axillary-relief-v9'],['combined-axillary-relief-v10'],['combined-axillary-relief-v11'],['combined-axillary-relief-v12'],['combined-axillary-relief-v13'],['combined-axillary-relief-v14']];
 }
 #[\PHPUnit\Framework\Attributes\DataProvider('handleMethods')]
 public function test_left_shoulder_handles_are_retained_without_admission(string $method):void {
  [$run,$dir]=$this->fixture($method);$before=$run->state;$service=app(AvatarCombinedContourReviewService::class);
  $entry=$service->retain($run,$dir);$again=$service->retain($run->fresh(),$dir);
  $this->assertSame($entry['report_sha256'],$again['report_sha256']);$this->assertSame($method,$entry['report']['method']);
  foreach(['production_admitted','qualification_complete','publication_eligible'] as $flag)$this->assertFalse($entry[$flag]);
  $fresh=$run->fresh();$this->assertSame('needs_review',$fresh->status);
  foreach(['localized_shape_reviews','animation_playback_reviews','combined_motion_reviews'] as $key)$this->assertSame($before[$key],$fresh->state[$key]);
 }
 #[\PHPUnit\Framework\Attributes\DataProvider('handleMethods')]
 public function test_left_shoulder_handle_report_cannot_claim_qualification(string $method):void {
  [$run,$dir]=$this->fixture($method);$p=$dir.'/repair-report.json';$r=json_decode(file_get_contents($p),true);$r['qualification_complete']=true;file_put_contents($p,json_encode($r));
  $this->expectException(RuntimeException::class);$this->expectExceptionMessage('Contour evidence cannot qualify');app(AvatarCombinedContourReviewService::class)->retain($run,$dir);
 }
 public function test_tampered_image_is_rejected():void {
  [$run,$dir]=$this->fixture();$v=json_decode(file_get_contents($dir.'/repair-visual-report.json'),true);file_put_contents($dir.'/'.$v['views'][0]['file'],'changed');
  $this->expectException(RuntimeException::class);$this->expectExceptionMessage('Contour artifact mismatch');app(AvatarCombinedContourReviewService::class)->retain($run,$dir);
 }
 public function test_missing_view_is_rejected():void {
  [$run,$dir]=$this->fixture();$v=json_decode(file_get_contents($dir.'/repair-visual-report.json'),true);array_pop($v['views']);file_put_contents($dir.'/repair-visual-report.json',json_encode($v));
  $this->expectException(RuntimeException::class);$this->expectExceptionMessage('Incomplete contour evidence');app(AvatarCombinedContourReviewService::class)->retain($run,$dir);
 }
 public function test_regression_cannot_be_described_as_pass():void {
  [$run,$dir]=$this->fixture();$p=$dir.'/repair-assessment.json';$a=json_decode(file_get_contents($p),true);$a['status']='pass';file_put_contents($p,json_encode($a));
  $this->expectException(RuntimeException::class);$this->expectExceptionMessage('Contour regression cannot pass');app(AvatarCombinedContourReviewService::class)->retain($run,$dir);
 }
 public function test_body_scale_cannot_rebase_frozen_displacement_caps():void {
  [$run,$dir]=$this->fixture();$p=$dir.'/repair-report.json';$r=json_decode(file_get_contents($p),true);$r['body_height']=2;file_put_contents($p,json_encode($r));
  $this->expectException(RuntimeException::class);$this->expectExceptionMessage('Contour body scale changed');app(AvatarCombinedContourReviewService::class)->retain($run,$dir);
 }
 public function test_report_cannot_relax_frozen_limits():void {
  [$run,$dir]=$this->fixture();$p=$dir.'/repair-report.json';$r=json_decode(file_get_contents($p),true);$r['policy']['shoulder_max_posed_delta_height']=.03;file_put_contents($p,json_encode($r));
  $this->expectException(RuntimeException::class);$this->expectExceptionMessage('Frozen contour limits changed');app(AvatarCombinedContourReviewService::class)->retain($run,$dir);
 }
 public function test_changed_approved_ancestor_is_rejected():void {
  [$run,$dir]=$this->fixture();$s=$run->state;$hip=array_key_first($s['localized_shape_reviews']);$s['localized_shape_reviews'][$hip]['report_sha256']=str_repeat('d',64);$run->state=$s;
  $this->expectException(RuntimeException::class);$this->expectExceptionMessage('Contour parent lineage mismatch');app(AvatarCombinedContourReviewService::class)->retain($run,$dir);
 }
}
