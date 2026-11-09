<?php
// Read-only canonical artifact/controller verification. Not an authenticated browser E2E test.
if($argc!==5)throw new RuntimeException('Usage: php verify-candidate-review.php PREPARATION_UUID CANDIDATE_UUID VISUAL_REVIEW_UUID OUTPUT_JSON');
foreach(array_slice($argv,1,3) as $id)if(!preg_match('/^[a-f0-9-]{36}$/',$id))throw new RuntimeException('Explicit UUIDs required');
if(!str_starts_with($argv[4],'/tmp/')||str_contains($argv[4],'..'))throw new RuntimeException('Proof output must be under /tmp');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
[$script,$preparationId,$candidateId,$visualId,$output]=$argv;
$run=App\Models\AvatarPreparation::findOrFail($preparationId);$service=app(App\Services\AvatarRawRigReviewArtifactService::class);
$entry=$run->state['skinning_reviews'][$candidateId]??[];$report=$entry['report']??[];$visual=$run->state['candidate_visual_reviews'][$visualId]??[];
$bytes=$service->candidate($run,$candidateId);$bends=$service->candidateBends($run,$visualId,$candidateId);
$poses=$report['reloaded_poses']??$report['poses']??[];
if(($report['qualification_complete']??true)!==false||($report['publication_eligible']??true)!==false
    ||($visual['qualification_complete']??true)!==false||($visual['publication_eligible']??true)!==false||count($poses)!==16)
    throw new RuntimeException('Unqualified candidate/review contract mismatch');
$ancestors=[];$seen=[];$current=$candidateId;
while(isset($run->state['skinning_reviews'][$current])){
    if(isset($seen[$current])||count($seen)>=32)throw new RuntimeException('Invalid candidate lineage cycle');$seen[$current]=true;
    $ancestor=$run->state['skinning_reviews'][$current];
    if($service->candidateAvailable($run,$current))$ancestors[]=['id'=>$current,'sha256'=>hash('sha256',$service->candidate($run,$current))];
    $current=$ancestor['report']['parent_candidate_id']??'';
}
$diagnostics=[];
foreach(($run->state['skinning_diagnostics']??[]) as $id=>$diagnostic){
    $d=$diagnostic['report']??[];
    if(($d['parent_candidate_id']??null)!==$candidateId||($d['status']??null)!=='diagnostic_complete')continue;
    $diagnosticCandidateSha=($d['method']??null)==='retained-corrective-cycle-interpolation-v1'
        ? ($d['candidate_sha256']??null) : ($d['rig_sha256']??null);
    if($diagnosticCandidateSha!==hash('sha256',$bytes)||($d['source_sha256']??null)!==$run->plan['source_sha256']
        ||($d['qualification_complete']??true)!==false||($d['publication_eligible']??true)!==false)
        throw new RuntimeException('Candidate diagnostic lineage mismatch');
    $diagnostics[]=['id'=>$id,'method'=>$d['method']??null,'report_sha256'=>$diagnostic['artifact']['sha256'],
        'contact_vertices'=>count($d['contact_vertex_records']??[])];
}
view()->share('errors',new Illuminate\Support\ViewErrorBag());
$request=Illuminate\Http\Request::create('http://localhost:8089/evolution/avatars/preparation/'.$run->id.'/preview?'.http_build_query(['view'=>'candidate-bends','candidate'=>$candidateId,'visual_review'=>$visualId]));
$request->setLaravelSession(app('session')->driver('array'));$app->instance('request',$request);app('url')->setRequest($request);
$response=app(App\Http\Controllers\AvatarPreparationController::class)->preview($run,app(App\Services\AvatarEvolutionService::class));$html=$response->getContent();
$proof=['verification_method'=>'Canonical API artifact readback and shared Web controller render',
    'preparation_id'=>$run->id,'candidate_id'=>$candidateId,'candidate_sha256'=>hash('sha256',$bytes),
    'candidate_report_sha256'=>$entry['artifact']['sha256'],'candidate_source_sha256'=>$report['source_sha256'],
    'visual_review_id'=>$visualId,'visual_report_sha256'=>$visual['report_sha256'],
    'assessment_status'=>$visual['visual_assessment']['status']??null,'playback_sha256'=>hash('sha256',$bends),
    'ancestor_artifacts'=>$ancestors,'diagnostics'=>$diagnostics,'controller_status'=>$response->getStatusCode(),
    'preview_uses_exact_bend_file'=>str_contains($html,'candidate-bends-'.$visualId.'-'.$candidateId.'.glb'),
    'assessment_visible'=>str_contains($html,'Candidate visual review '.substr($visualId,0,8)),
    'candidate_label_visible'=>str_contains($html,substr($candidateId,0,8)),
    'hip_study_visible'=>str_contains($html,'Hip socket placement study'),
    'bound_rejections_visible'=>str_contains($html,'Rejected by unchanged source-section/displacement bounds'),
    'skinning_mode_diagnostic_visible'=>str_contains($html,'Skin volume diagnostic'),
    'contact_topology_visible'=>str_contains($html,'Contact surface connectivity'),
    'hip_fold_profile_visible'=>str_contains($html,'Hip crease measurements'),
    'hip_fold_arap_visible'=>str_contains($html,'Hip fold surface trial'),
    'counts_90'=>array_values(array_map(fn($p)=>['joint'=>$p['joint'],'intersections'=>$p['self_intersections']],array_filter($poses,fn($p)=>$p['degrees']===90))),
    'severe_stretch_edges'=>array_sum(array_map(fn($p)=>$p['edge_deformation']['severely_stretched_edges'],$poses)),
    'weight_correspondence'=>$report['weight_correspondence']??null,'rest_surface_roundtrip'=>$report['rest_surface_roundtrip']??null,
    'unaffected_bends_unchanged'=>$report['non_target_bends_unchanged']??$report['non_shoulder_bends_unchanged']??null,
    'preparation_status'=>$run->status,'qualification_complete'=>false,'publication_eligible'=>false,
    'inspector_sha256'=>hash_file('sha256','/app/public/base-inspector/base-inspector.js')];
if($proof['controller_status']!==200||!$proof['preview_uses_exact_bend_file']||!$proof['assessment_visible']||!$proof['candidate_label_visible'])
    throw new RuntimeException('Shared candidate preview verification failed');
if(collect($diagnostics)->contains(fn($d)=>$d['method']==='corrected-contact-topology-v1')&&!$proof['contact_topology_visible'])
    throw new RuntimeException('Contact topology diagnostic is not visible in the shared preview');
if(collect($diagnostics)->contains(fn($d)=>$d['method']==='corrected-hip-fold-profile-v1')&&!$proof['hip_fold_profile_visible'])
    throw new RuntimeException('Hip fold diagnostic is not visible in the shared preview');
if(collect($diagnostics)->contains(fn($d)=>$d['method']==='contact-bound-hip-fold-arap-v1')&&!$proof['hip_fold_arap_visible'])
    throw new RuntimeException('Hip surface trial is not visible in the shared preview');
file_put_contents($output,json_encode($proof,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));echo json_encode($proof);
