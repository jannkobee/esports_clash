<?php
// Register exact Colab review evidence without changing rig/appearance qualification.
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
[$script,$mode,$planPath]=array_slice($argv,0,3);
if(!in_array($mode,['started','completed'],true))throw new RuntimeException('Unsupported review event');
$plan=json_decode(file_get_contents($planPath),true,flags:JSON_THROW_ON_ERROR);
if(($plan['schema']??null)!=='generated-body-raw-rig-review-v1'||($plan['compute']??null)!=='google'
    ||($plan['publication_eligible']??true)!==false||!Illuminate\Support\Str::isUuid($plan['id']??''))throw new RuntimeException('Invalid frozen cloud review plan');
$run=App\Models\AvatarPreparation::findOrFail($plan['rig_attempt_id']);
if(($run->plan['provider']??null)!=='tokenrig'||$run->generation_id!==$plan['generation_id']
    ||$run->plan['source_sha256']!==$plan['source_sha256']||($run->state['cloud_raw_rig']['artifact']['sha256']??null)!==$plan['rig_sha256'])
    throw new RuntimeException('Backoffice source/rig lineage mismatch');
$details=['plan'=>$plan,'status'=>$mode,'publication_eligible'=>false];
if($mode==='completed'){
    $bytes=file_get_contents($argv[3]);$report=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);
    if(($report['id']??null)!==$plan['id']||($report['compute']??null)!=='google'||($report['source_sha256']??null)!==$plan['source_sha256']
        ||($report['rig_sha256']??null)!==$plan['rig_sha256']||($report['publication_eligible']??true)!==false)
        throw new RuntimeException('Colab report changed source identity or qualification');
    $details['report']=$report;$details['artifact']=['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)];
}
Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$mode,$details){
    $action='avatar.raw-rig-review-'.$mode;
    $prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
    if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Recorded review evidence is immutable');return;}
    $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);
    app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-production-avatar-20261026',$details);
    $current->update(['state'=>[...($current->state??[]),'raw_review'=>$details]]);
});
echo json_encode(['id'=>$plan['id'],'preparation_id'=>$run->id,'event'=>$mode,'publication_eligible'=>false]);
