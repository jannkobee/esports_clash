<?php
// Append exact controlled comparison evidence; never change any qualification gate.
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$plan=json_decode(file_get_contents($argv[1]),true,flags:JSON_THROW_ON_ERROR);
$bytes=file_get_contents($argv[2]);$report=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);
$run=App\Models\AvatarPreparation::findOrFail($plan['rig_attempt_id']);
if(!Illuminate\Support\Str::isUuid($plan['id'])||$plan['id']!==$report['id']
    ||($plan['compute']??null)!=='google'||($report['compute']??null)!=='google'
    ||($report['publication_eligible']??true)!==false||($report['qualification_complete']??true)!==false
    ||$run->plan['source_sha256']!==$report['source_sha256']
    ||$run->state['cloud_raw_rig']['artifact']['sha256']!==$report['rig_sha256']
    ||$plan['files']['raw-rig.glb']!==$report['rig_sha256'])throw new RuntimeException('Comparison lineage mismatch');
$details=['plan'=>$plan,'report'=>$report,'artifact'=>['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)],'publication_eligible'=>false];
Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details){
    $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);
    $action='avatar.skinning-comparison-recorded';
    $prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
    if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Recorded evidence is immutable');return;}
    app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-production-avatar-20261026',$details);
    $state=$current->state;$state['skinning_reviews'][$plan['id']]=$details;$current->update(['state'=>$state]);
});
echo json_encode(['id'=>$plan['id'],'preparation_id'=>$run->id,'publication_eligible'=>false]);
