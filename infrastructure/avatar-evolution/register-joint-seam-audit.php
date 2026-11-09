<?php
// Canonical, append-only retention for this unqualified Colab diagnostic.
if($argc!==3)throw new RuntimeException('Usage: php register-joint-seam-audit.php PREPARATION_UUID REPORT_JSON');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$run=App\Models\AvatarPreparation::findOrFail($argv[1]);$bytes=file_get_contents($argv[2]);$r=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);$p=$r['plan']??[];
if(!Illuminate\Support\Str::isUuid($r['id']??'')||($p['id']??null)!==$r['id']||($r['compute']??null)!=='google'
    ||($r['status']??null)!=='diagnostic_complete'||($r['method']??null)!=='quantized-geometric-seams-and-joint-weight-profile-v1'
    ||($r['publication_eligible']??true)!==false||($r['qualification_complete']??true)!==false)throw new RuntimeException('Invalid seam diagnostic');
$service=app(App\Services\AvatarRawRigReviewArtifactService::class);
$source=app(App\Services\TrellisGenerationService::class)->verifiedAsset(App\Models\TrellisGeneration::findOrFail($run->generation_id));
$expected=['source.glb'=>hash('sha256',$source),'raw.glb'=>$run->state['cloud_raw_rig']['artifact']['sha256']??null,
    'early.glb'=>hash('sha256',$service->candidate($run,'a3352d37-91cb-4757-b403-da09f5ac0017')),
    'corrected.glb'=>hash('sha256',$service->candidate($run,'140fe64c-6c59-41a5-9b8b-6bb7a35c8b97'))];
foreach($expected as $name=>$sha)if(($p['files'][$name]??null)!==$sha)throw new RuntimeException('Stage lineage mismatch: '.$name);
if(($run->plan['source_sha256']??null)!==$expected['source.glb'])throw new RuntimeException('Source mismatch');
$details=['report'=>$r,'report_sha256'=>hash('sha256',$bytes),'publication_eligible'=>false,'qualification_complete'=>false];
Illuminate\Support\Facades\DB::transaction(function()use($run,$r,$details){
    $locked=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$prior=$locked->state['joint_seam_audits'][$r['id']]??null;
    if($prior){if($prior!=$details)throw new RuntimeException('Immutable audit mismatch');return;}
    $state=$locked->state??[];$state['joint_seam_audits'][$r['id']]=$details;$locked->update(['state'=>$state]);
    app(App\Services\EvolutionService::class)->audit($r['id'],'avatar.joint-seam-audit-completed','owner:authorized-production-avatar-20261026',$details);
});
echo json_encode(['id'=>$r['id'],'report_sha256'=>hash('sha256',$bytes),'publication_eligible'=>false]);
