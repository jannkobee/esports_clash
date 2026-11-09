<?php
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$probeRun='24e7f704-3abe-42d4-9c47-204627ee9e88';
function probeRegistrar(array $argv,string $script):string{
    try{require $script;return 'unexpectedly accepted';}catch(RuntimeException $error){return $error->getMessage();}
}
$probeStateBefore=hash('sha256',json_encode(App\Models\AvatarPreparation::findOrFail($probeRun)->state));
$probeHipId='d2d8cc83-a767-4e77-baa6-47d409888d0a';$probeSkinId='b89a083d-6ed1-497c-be5b-c9130b7e7674';
$probeBefore=[];foreach([$probeHipId,$probeSkinId] as $probeId)$probeBefore[$probeId]=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$probeId)->count();
$probeBase='/tmp/hip-socket-d2d8cc83';$probeReport=json_decode(file_get_contents($probeBase.'/output/report.json'),true);
$probeReport['variants'][4]['rejection_details']['inside_section_bounds']=true;
$probeBytes=json_encode($probeReport,JSON_PRETTY_PRINT|JSON_PRESERVE_ZERO_FRACTION);file_put_contents('/tmp/invalid-bound-report.json',$probeBytes);
$probeState=json_decode(file_get_contents($probeBase.'/state.json'),true);$probeState['report_sha256']=hash('sha256',$probeBytes);file_put_contents('/tmp/invalid-bound-state.json',json_encode($probeState));
$probeBoundMessage=probeRegistrar(['registrar',$probeBase.'/plan.json','/tmp/invalid-bound-report.json','/tmp/invalid-bound-state.json',$probeBase.'/output'],'/tmp/register-shoulder-socket-study.php');
$probeSkinBase='/tmp/integrated-skin-b89a083d';$probeReport=json_decode(file_get_contents($probeSkinBase.'/output/report.json'),true);
$probeReport['variants'][0]['poses'][0]['self_intersections']+=1;file_put_contents('/tmp/invalid-skin-report.json',json_encode($probeReport));
$probeSkinMessage=probeRegistrar(['registrar',$probeSkinBase.'/plan.json','/tmp/invalid-skin-report.json'],'/tmp/register-collision-weight-profile.php');
$probeAfter=[];foreach([$probeHipId,$probeSkinId] as $probeId)$probeAfter[$probeId]=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$probeId)->count();
$proof=['false_bound_rejection_rejected'=>$probeBoundMessage==='Rejected proposal must actually fail the unchanged bounds',
    'changed_skin_baseline_rejected'=>$probeSkinMessage==='Skin evaluation baseline comparison mismatch',
    'state_unchanged'=>$probeStateBefore===hash('sha256',json_encode(App\Models\AvatarPreparation::findOrFail($probeRun)->state)),
    'audit_counts_before'=>$probeBefore,'audit_counts_after'=>$probeAfter];
if(!$proof['false_bound_rejection_rejected']||!$proof['changed_skin_baseline_rejected']||!$proof['state_unchanged']||$probeBefore!==$probeAfter)
    throw new RuntimeException(json_encode($proof));
file_put_contents('/tmp/integrated-rejection-checks.json',json_encode($proof,JSON_PRETTY_PRINT));echo json_encode($proof);
