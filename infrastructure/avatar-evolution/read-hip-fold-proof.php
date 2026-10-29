<?php
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$run=App\Models\AvatarPreparation::findOrFail('24e7f704-3abe-42d4-9c47-204627ee9e88');$id='4d516962-da1e-41cf-88e7-1120a7d17663';$e=$run->state['skinning_diagnostics'][$id]??[];$r=$e['report']??[];
if(($r['method']??null)!=='corrected-hip-fold-profile-v1'||($r['status']??null)!=='diagnostic_complete'||($r['publication_eligible']??true)!==false)throw new RuntimeException('Unqualified hip fold report required');
echo json_encode(['id'=>$id,'parent_candidate_id'=>$r['parent_candidate_id'],'candidate_sha256'=>$r['rig_sha256'],'report_sha256'=>$e['artifact']['sha256'],'qualification_complete'=>false,'publication_eligible'=>false]);
