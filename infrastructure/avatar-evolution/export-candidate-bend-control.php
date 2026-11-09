<?php
// Read-only exact API diagnostic playback export for a frozen corrective control.
if($argc!==5)throw new RuntimeException('Usage: php export-candidate-bend-control.php PREPARATION_UUID CANDIDATE_UUID VISUAL_REVIEW_UUID OUTPUT_DIR');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
foreach(array_slice($argv,1,3) as $id)if(!Illuminate\Support\Str::isUuid($id))throw new RuntimeException('Explicit UUIDs required');
$out=$argv[4];if(!str_starts_with($out,'/tmp/')||str_contains($out,'..')||file_exists($out))throw new RuntimeException('Use a fresh /tmp directory');
$run=App\Models\AvatarPreparation::findOrFail($argv[1]);$service=app(App\Services\AvatarRawRigReviewArtifactService::class);
$source=$service->candidate($run,$argv[2]);$bytes=$service->candidateBends($run,$argv[3],$argv[2]);mkdir($out,0700,true);
file_put_contents($out.'/native-control.glb',$bytes);
$proof=['preparation_id'=>$run->id,'candidate_id'=>$argv[2],'visual_review_id'=>$argv[3],
    'source_candidate_sha256'=>hash('sha256',$source),'control_sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes),
    'visual_report_sha256'=>$run->state['candidate_visual_reviews'][$argv[3]]['report_sha256'],'qualification_complete'=>false,'publication_eligible'=>false];
file_put_contents($out.'/control-proof.json',json_encode($proof,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));echo json_encode($proof);
