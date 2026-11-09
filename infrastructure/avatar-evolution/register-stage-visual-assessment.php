<?php
// Record manual review only against previously retained, hash-verified views.
if($argc!==3)throw new RuntimeException('Usage: php register-stage-visual-assessment.php PREPARATION_UUID ASSESSMENT_JSON');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$run=App\Models\AvatarPreparation::findOrFail($argv[1]);$bytes=file_get_contents($argv[2]);$a=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);$id=$a['review_id']??'';
$entry=$run->state['stage_visual_audits'][$id]??[];$r=$entry['report']??[];
if(!Illuminate\Support\Str::isUuid($id)||($r['status']??null)!=='rendered_for_review'||($a['status']??null)!=='visible_deformation_unresolved'
    ||($a['publication_eligible']??true)!==false||($a['qualification_complete']??true)!==false||count($a['inspected_screenshots']??[])<1)throw new RuntimeException('Invalid assessment');
foreach($a['inspected_screenshots'] as $view){
    if(!collect($r['views'])->contains(fn($v)=>($v['file']??null)===($view['file']??null)&&($v['sha256']??null)===($view['sha256']??null)))throw new RuntimeException('Assessment references an unknown screenshot');
}
Illuminate\Support\Facades\DB::transaction(function()use($run,$id,$a,$bytes){
    $locked=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$state=$locked->state;$existing=$state['stage_visual_audits'][$id]['assessment']??null;
    if($existing){if($existing!=$a)throw new RuntimeException('Assessment is immutable');return;}
    $state['stage_visual_audits'][$id]['assessment']=$a;$state['stage_visual_audits'][$id]['assessment_sha256']=hash('sha256',$bytes);$locked->update(['state'=>$state]);
    app(App\Services\EvolutionService::class)->audit($id,'avatar.stage-visual-assessment-completed','owner:authorized-production-avatar-20261026',['assessment'=>$a,'sha256'=>hash('sha256',$bytes)]);
});echo json_encode(['id'=>$id,'assessment_sha256'=>hash('sha256',$bytes),'publication_eligible'=>false]);
