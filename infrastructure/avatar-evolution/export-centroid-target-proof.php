<?php
// Read exact canonical centroid diagnostic and retained target for a frozen Colab job.
if($argc!==4)throw new RuntimeException('Usage: preparation-id diagnostic-id output-dir');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$run=App\Models\AvatarPreparation::findOrFail($argv[1]);$id=$argv[2];$entry=$run->state['skinning_diagnostics'][$id]??[];$report=$entry['report']??[];
$target=$report['posed_target_artifact']??[];$sha=$target['sha256']??'';$disk=Illuminate\Support\Facades\Storage::disk('local');
if(!Illuminate\Support\Str::isUuid($id)||($report['method']??null)!=='contact-pair-centroid-probe-v1'||($report['status']??null)!=='diagnostic_complete'
    ||($report['qualification_complete']??true)!==false||($report['publication_eligible']??true)!==false||!preg_match('/^[a-f0-9]{64}$/',$sha))throw new RuntimeException('Unqualified centroid diagnostic required');
$bytes=$disk->get('avatar-preparations/'.$run->id.'/diagnostics/'.$sha.'.npz');
if(hash('sha256',$bytes)!==$sha||strlen($bytes)!==$target['bytes'])throw new RuntimeException('Stored centroid target mismatch');
$out=$argv[3];if(!str_starts_with($out,'/tmp/')||str_contains($out,'..')||file_exists($out))throw new RuntimeException('New /tmp directory required');mkdir($out,0700,true);
file_put_contents($out.'/centroid-target.npz',$bytes);$proof=['preparation_id'=>$run->id,'id'=>$id,'source_candidate_id'=>$report['parent_candidate_id'],
 'source_candidate_sha256'=>$report['rig_sha256'],'report_sha256'=>$entry['artifact']['sha256'],'target_sha256'=>$sha,'bytes'=>strlen($bytes),'qualification_complete'=>false,'publication_eligible'=>false];
file_put_contents($out.'/proof.json',json_encode($proof,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));echo json_encode($proof);
