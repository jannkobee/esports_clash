<?php
// Register a source-bound Colab diagnostic; never change candidate qualification.
if($argc!==3)throw new RuntimeException('Usage: php register-stage-geometry-audit.php PREPARATION_UUID REPORT_JSON');
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$run=App\Models\AvatarPreparation::findOrFail($argv[1]);
$bytes=file_get_contents($argv[2]);$report=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);$plan=$report['plan']??[];
if(!Illuminate\Support\Str::isUuid($report['id']??'')||($plan['id']??null)!==$report['id']
    ||($report['compute']??null)!=='google'||($report['status']??null)!=='diagnostic_complete'
    ||($report['publication_eligible']??true)!==false||($report['qualification_complete']??true)!==false)
    throw new RuntimeException('Invalid unqualified Colab report');
$files=$plan['files']??[];$service=app(App\Services\AvatarRawRigReviewArtifactService::class);
$source=app(App\Services\TrellisGenerationService::class)->verifiedAsset(App\Models\TrellisGeneration::findOrFail($run->generation_id));
$expected=['source.glb'=>hash('sha256',$source),'raw.glb'=>$run->state['cloud_raw_rig']['artifact']['sha256']??null,
    'early.glb'=>hash('sha256',$service->candidate($run,'a3352d37-91cb-4757-b403-da09f5ac0017')),
    'corrected.glb'=>hash('sha256',$service->candidate($run,'140fe64c-6c59-41a5-9b8b-6bb7a35c8b97'))];
foreach($expected as $name=>$sha)if(($files[$name]??null)!==$sha)throw new RuntimeException('Backoffice lineage mismatch: '.$name);
if(($run->plan['source_sha256']??null)!==$expected['source.glb'])throw new RuntimeException('Preparation source mismatch');
$details=['report'=>$report,'report_sha256'=>hash('sha256',$bytes),'publication_eligible'=>false,'qualification_complete'=>false];
Illuminate\Support\Facades\DB::transaction(function()use($run,$report,$details){
    $locked=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);
    $prior=$locked->state['stage_geometry_audits'][$report['id']]??null;
    if($prior){if($prior!=$details)throw new RuntimeException('Stage audit evidence is immutable');return;}
    $state=$locked->state??[];$state['stage_geometry_audits'][$report['id']]=$details;$locked->update(['state'=>$state]);
    app(App\Services\EvolutionService::class)->audit($report['id'],'avatar.stage-geometry-audit-completed','owner:authorized-production-avatar-20261026',$details);
});
echo json_encode(['id'=>$report['id'],'preparation_id'=>$run->id,'report_sha256'=>hash('sha256',$bytes),'publication_eligible'=>false]);
