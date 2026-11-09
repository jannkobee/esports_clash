<?php
// Retain a failed Google visual diagnostic without exposing a candidate or bend file.
if($argc!==3)throw new RuntimeException('Usage: plan.json state.json');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$planBytes=file_get_contents($argv[1]);$stateBytes=file_get_contents($argv[2]);
$plan=json_decode($planBytes,true,flags:JSON_THROW_ON_ERROR);$runtime=json_decode($stateBytes,true,flags:JSON_THROW_ON_ERROR);
$run=App\Models\AvatarPreparation::findOrFail($plan['preparation_id']);
if(!Illuminate\Support\Str::isUuid($plan['id']??'')||($runtime['id']??null)!==$plan['id']
    ||($plan['method']??null)!=='exact-api-candidates-babylon-visual-comparison-v1'
    ||($runtime['status']??null)!=='failed'||!is_string($runtime['error']??null)
    ||($runtime['environment_sha256']??null)!=='73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105')
    throw new RuntimeException('Invalid failed visual attempt.');
foreach([$plan,$runtime] as $entry)
    if(($entry['compute']??null)!=='google'||($entry['qualification_complete']??true)!==false||($entry['publication_eligible']??true)!==false)
        throw new RuntimeException('Unqualified Google-only evidence required.');
foreach(['parent','current'] as $label){
    $source=$plan['candidates'][$label]??[];$candidate=$run->state['skinning_reviews'][$source['id']??'']['report']??[];
    if(($candidate['artifact']['sha256']??null)!==($source['artifact_sha256']??null)
        ||($plan['files']['site/'.$label.'.glb']??null)!==($source['artifact_sha256']??null))
        throw new RuntimeException('Failed visual candidate lineage mismatch.');
}
$report=['id'=>$plan['id'],'method'=>'failed-babylon-candidate-review-v1','compute'=>'google','status'=>'failed',
    'source_sha256'=>$run->plan['source_sha256'],'parent_candidate_id'=>$plan['candidates']['current']['id'],
    'rig_sha256'=>$plan['candidates']['current']['artifact_sha256'],'stage'=>$runtime['stage']??null,'error'=>$runtime['error'],
    'qualification_complete'=>false,'publication_eligible'=>false];
$details=['plan'=>$plan,'runtime'=>$runtime,'report'=>$report,'plan_sha256'=>hash('sha256',$planBytes),
    'runtime_sha256'=>hash('sha256',$stateBytes),'publication_eligible'=>false];
Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details){
    $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$action='avatar.candidate-visual-review-failed';
    $prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
    if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Immutable visual failure mismatch');return;}
    $state=$current->state;if(isset($state['skinning_diagnostics'][$plan['id']]))throw new RuntimeException('Visual diagnostic ID already exists');
    $state['skinning_diagnostics'][$plan['id']]=$details;$current->update(['state'=>$state]);
    app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-avatar-repair-20261027',$details);
});
echo json_encode(['id'=>$plan['id'],'status'=>'failed','candidate_registered'=>false,'publication_eligible'=>false]);
