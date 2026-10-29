<?php
// Append the exact Colab result; solver admission never qualifies an avatar.
if(!in_array($argc,[3,4],true))throw new RuntimeException('Usage: php register-bbw-review.php PREPARATION_UUID REPORT_JSON [PROXY_NPZ]');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$run=App\Models\AvatarPreparation::findOrFail($argv[1]);$bytes=file_get_contents($argv[2]);$r=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);$p=$r['plan']??[];
$solve=($r['method']??null)==='libigl-core-bone-volume-weights-v1';
$regional=($r['method']??null)==='regional-volume-bbw-candidate-v1';$fit=($r['method']??null)==='pose-fitted-four-influence-bbw-v1';$derived=$solve||$regional||$fit;
$candidateReady=$fit&&($r['status']??null)==='review_required'&&($r['candidate_available']??false)===true;$glb=null;
if(!Illuminate\Support\Str::isUuid($r['id']??'')||($p['id']??null)!==$r['id']||($p['rig_attempt_id']??null)!==$run->id
    ||(($p['generation_id']??null)!==$run->generation_id&&!$derived)||($r['compute']??null)!=='google'
    ||!in_array($r['method']??null,['libigl-volume-bbw-admission-v1','libigl-voxel-volume-correspondence-v1','libigl-core-bone-volume-weights-v1','regional-volume-bbw-candidate-v1','pose-fitted-four-influence-bbw-v1'],true)||($p['method']??null)!==$r['method']
    ||!in_array($r['status']??null,['blocked_geometry','volume_validation_required','blocked_proxy','proxy_ready_for_constraint_review','weights_ready_for_export_review','blocked_influence_budget','blocked_deformation_error','review_required','failed'],true)
    ||($r['publication_eligible']??true)!==false||($r['qualification_complete']??true)!==false
    ||(!$candidateReady&&($r['candidate_available']??true)!==false))throw new RuntimeException('Invalid BBW diagnostic');
if(!$derived&&($r['libigl_version']??null)!=='2.6.3')throw new RuntimeException('Invalid libigl version');
$expected=['source.glb'=>$run->plan['source_sha256']??null,'raw.glb'=>$run->state['cloud_raw_rig']['artifact']['sha256']??null];
foreach($expected as $name=>$sha)if(!$sha||(!$derived||$name==='raw.glb')&&($p['files'][$name]??null)!==$sha)throw new RuntimeException('BBW source lineage mismatch');
if(($r['source_sha256']??null)!==$expected['source.glb']||($r['rig_sha256']??null)!==$expected['raw.glb'])throw new RuntimeException('BBW report lineage mismatch');
if($r['status']!=='failed'&&$r['method']==='libigl-volume-bbw-admission-v1'){
    if(($r['solver_check']['status']??null)!=='passed'||($r['solver_check']['avatar_weighting_complete']??true)!==false
        ||array_keys($r['geometry']??[])!==['source','raw'])throw new RuntimeException('Incomplete solver diagnostic');
    $blocked=count($r['geometry']['source']['blockers']??[])+count($r['geometry']['raw']['blockers']??[])>0;
    if(($r['status']==='blocked_geometry')!==$blocked)throw new RuntimeException('BBW status contradicts geometry');
}
if($r['method']==='libigl-voxel-volume-correspondence-v1'&&$r['status']!=='failed'){
    if($argc!==4||!in_array($r['status'],['blocked_proxy','proxy_ready_for_constraint_review'],true)
        ||!is_array($r['blockers']??null)||(($r['status']==='blocked_proxy')!==(count($r['blockers'])>0)))throw new RuntimeException('Invalid proxy status');
    $proxy=file_get_contents($argv[3]);$proof=$r['proxy_artifact']??[];
    if(strlen($proxy)!==($proof['bytes']??null)||strlen($proxy)>64*1024**2||hash('sha256',$proxy)!==($proof['sha256']??null)||substr($proxy,0,2)!=='PK')throw new RuntimeException('Invalid proxy artifact');
    $disk=Illuminate\Support\Facades\Storage::disk('local');$path='avatar-preparations/'.$run->id.'/weight-domains/'.$r['id'].'.npz';
    if($disk->exists($path)&&hash('sha256',$disk->get($path))!==$proof['sha256'])throw new RuntimeException('Stored proxy mismatch');
    if(!$disk->exists($path)&&!$disk->put($path,$proxy))throw new RuntimeException('Could not retain proxy volume');
}
if($solve){
    $proxy=$run->state['weight_solver_reviews'][$r['proxy_id']??'']??[];
    if(($proxy['report']['plan']['generation_id']??null)!==$run->generation_id||($proxy['report']['status']??null)!=='proxy_ready_for_constraint_review'
        ||($p['files']['proxy-domain.npz']??null)!==($proxy['report']['proxy_artifact']['sha256']??null)
        ||($p['files']['proxy-report.json']??null)!==($proxy['report_sha256']??null))throw new RuntimeException('Unregistered solve volume');
    if($r['status']==='weights_ready_for_export_review'){
        if($argc!==4||($r['max_normalization_error']??1)>1e-6||($r['minimum_weight']??-1)<-1e-7||count($r['constraints']??[])!==22)throw new RuntimeException('Invalid solved weights');
        $weights=file_get_contents($argv[3]);$proof=$r['weight_artifact'];
        if(strlen($weights)!==$proof['bytes']||hash('sha256',$weights)!==$proof['sha256']||strlen($weights)>64*1024**2)throw new RuntimeException('Weight artifact mismatch');
        $disk=Illuminate\Support\Facades\Storage::disk('local');$path='avatar-preparations/'.$run->id.'/weight-solves/'.$r['id'].'.npz';
        if($disk->exists($path)&&hash('sha256',$disk->get($path))!==$proof['sha256'])throw new RuntimeException('Stored weight artifact mismatch');
        if(!$disk->exists($path)&&!$disk->put($path,$weights))throw new RuntimeException('Could not retain volume weights');
    }elseif($r['status']!=='failed')throw new RuntimeException('Invalid solve outcome');
}
if($regional||$fit){
    $weights=$run->state['weight_solver_reviews'][$r['weight_solve_id']??'']??[];
    if(($weights['report']['status']??null)!=='weights_ready_for_export_review'
        ||($p['files']['weight-report.json']??null)!==($weights['report_sha256']??null)
        ||($p['files']['body-weights.npz']??null)!==($weights['report']['weight_artifact']['sha256']??null)
        ||!in_array($r['status'],$fit?['failed','blocked_deformation_error','review_required']:['failed','blocked_influence_budget'],true))throw new RuntimeException('Invalid regional weighting lineage');
    if($r['status']==='blocked_influence_budget'&&($r['weight_changes']['max_discarded_mass_to_four_influences']??0)<=.05)throw new RuntimeException('Invalid influence-budget failure');
}
if($candidateReady){
    $bounds=$run->state['raw_review']['report']['source']['bounds'];$height=$bounds[1][2]-$bounds[0][2];
    if($argc!==4||($r['fit']['max_influences']??99)>4||($r['fit']['max_normalization_error']??1)>1e-6
        ||count($r['reloaded_poses']??[])!==16||($r['rest_surface_roundtrip']['max_nearest_distance']??1)>1e-6)
        throw new RuntimeException('Invalid fitted candidate');
    foreach(['training_error','heldout_error'] as $key){$e=$r[$key]??[];
        foreach(['max_error','rms_error','max_relative_error'] as $field)if(!is_numeric($e[$field]??null)||!is_finite((float)$e[$field]))throw new RuntimeException('Missing finite fit error');
        if($e['max_error']>$height*.002||$e['rms_error']>$height*.0005||$e['max_relative_error']>.05)throw new RuntimeException('Fit error exceeds budget');
    }
    $glb=file_get_contents($argv[3]);$proof=$r['artifact']??[];
    if(strlen($glb)!==($proof['bytes']??null)||hash('sha256',$glb)!==($proof['sha256']??null)||substr($glb,0,4)!=='glTF')throw new RuntimeException('Fitted GLB mismatch');
}
$details=['report'=>$r,'report_sha256'=>hash('sha256',$bytes),'publication_eligible'=>false,'qualification_complete'=>false];
Illuminate\Support\Facades\DB::transaction(function()use($run,$r,$details,$candidateReady,$glb,$p,$bytes){
    $locked=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$state=$locked->state;$prior=$state['weight_solver_reviews'][$r['id']]??null;
    if($prior){if($prior!=$details)throw new RuntimeException('BBW evidence is immutable');return;}
    $state['weight_solver_reviews'][$r['id']]=$details;
    if($candidateReady)$state['skinning_reviews'][$r['id']]=['plan'=>$p,'report'=>$r,'artifact'=>['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)],'publication_eligible'=>false];
    $locked->update(['state'=>$state]);
    if($candidateReady)app(App\Services\AvatarRawRigReviewArtifactService::class)->retainCandidate($locked,$r['id'],$glb);
    app(App\Services\EvolutionService::class)->audit($r['id'],'avatar.bbw-review-recorded','owner:authorized-production-avatar-20261026',$details);
});echo json_encode(['id'=>$r['id'],'status'=>$r['status'],'report_sha256'=>hash('sha256',$bytes),'candidate_available'=>$candidateReady,'publication_eligible'=>false]);
