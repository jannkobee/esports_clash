<?php
// Read-only API export for a paired visual review. Run inside the API container.
if(!in_array($argc,[5,6],true))throw new RuntimeException('Usage: php export-candidate-visual-fixture.php OUTPUT_DIR PREPARATION_UUID REFERENCE_UUID CANDIDATE_UUID [CONTACT_MAP_UUID]');
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
foreach(array_slice($argv,2) as $id)if(!Illuminate\Support\Str::isUuid($id))throw new RuntimeException('Explicit UUIDs required');
$out=$argv[1];if(!str_starts_with($out,'/tmp/')||str_contains($out,'..')||file_exists($out))throw new RuntimeException('Use a new directory under /tmp');
$run=App\Models\AvatarPreparation::findOrFail($argv[2]);$ids=['parent'=>$argv[3],'current'=>$argv[4]];
if($ids['parent']===$ids['current'])throw new RuntimeException('Distinct comparison candidates required');
mkdir($out,0700,true);$artifacts=app(App\Services\AvatarRawRigReviewArtifactService::class);
$proof=['preparation_id'=>$run->id,'generation_id'=>$run->generation_id,'source_sha256'=>$run->plan['source_sha256'],
    'raw_rig_sha256'=>$run->state['cloud_raw_rig']['artifact']['sha256'],'publication_eligible'=>false,'candidates'=>[]];
foreach($ids as $label=>$id){
    $entry=$run->state['skinning_reviews'][$id]??null;
    if(!$entry||($entry['report']['id']??null)!==$id)throw new RuntimeException('Candidate report identity mismatch');
    $bytes=$artifacts->candidate($run,$id);$report=json_encode($entry['report'],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);
    file_put_contents($out.'/'.$label.'.glb',$bytes);file_put_contents($out.'/'.$label.'-report.json',$report);
    $proof['candidates'][$label]=['id'=>$id,'artifact_sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes),
        'report_sha256'=>$entry['artifact']['sha256'],'exported_report_sha256'=>hash('sha256',$report),'candidate_available'=>true];
}
if($argc===6){
    $diagnostic=$run->state['skinning_diagnostics'][$argv[5]]??null;$contact=$diagnostic['report']??[];
    if(($contact['id']??null)!==$argv[5]||($contact['status']??null)!=='diagnostic_complete'
        ||($contact['parent_candidate_id']??null)!==$ids['current']
        ||($contact['rig_sha256']??null)!==$proof['candidates']['current']['artifact_sha256']
        ||($contact['source_sha256']??null)!==$run->plan['source_sha256']
        ||($contact['publication_eligible']??true)!==false||($contact['qualification_complete']??true)!==false
        ||!count($contact['contact_vertex_records']??[]))throw new RuntimeException('Contact map source mismatch');
    $contactBytes=json_encode($contact,JSON_PRETTY_PRINT|JSON_PRESERVE_ZERO_FRACTION|JSON_THROW_ON_ERROR);
    file_put_contents($out.'/contact-map.json',$contactBytes);
    $proof['contact_map']=['id'=>$argv[5],'report_sha256'=>$diagnostic['artifact']['sha256'],
        'exported_report_sha256'=>hash('sha256',$contactBytes),'source_candidate_id'=>$ids['current'],
        'source_candidate_sha256'=>$contact['rig_sha256']];
}
file_put_contents($out.'/baseline-report.json',json_encode($run->state['raw_review']['report'],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
file_put_contents($out.'/backoffice-proof.json',json_encode($proof,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
echo json_encode($proof,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
