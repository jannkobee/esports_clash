<?php
// Immutable Google-only corrective evidence. Failed attempts never become candidates.
if(!in_array($argc,[4,7],true))throw new RuntimeException('Usage: plan report state [primary.glb stress.glb validation.json]');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$plan=json_decode(file_get_contents($argv[1]),true,flags:JSON_THROW_ON_ERROR);$reportBytes=file_get_contents($argv[2]);$report=json_decode($reportBytes,true,flags:JSON_THROW_ON_ERROR);
$runtime=json_decode(file_get_contents($argv[3]),true,flags:JSON_THROW_ON_ERROR);$run=App\Models\AvatarPreparation::findOrFail($plan['rig_attempt_id']);
$methods=['contact-bound-portable-pose-correctives-v1','contact-bound-portable-pose-correctives-v2','contact-bound-portable-pose-correctives-v3'];
$parent=$run->state['skinning_reviews'][$plan['parent_candidate_id']]??[];
if(!Illuminate\Support\Str::isUuid($plan['id'])||$report['id']!==$plan['id']||$runtime['id']!==$plan['id']
    ||!in_array($plan['method'],$methods,true)||$report['method']!==$plan['method']
    ||$report['source_sha256']!==$run->plan['source_sha256']||$report['rig_sha256']!==$run->state['cloud_raw_rig']['artifact']['sha256']
    ||($parent['report']['artifact']['sha256']??null)!==$plan['parent_candidate_sha256']
    ||$plan['files']['candidate.glb']!==$plan['parent_candidate_sha256']||$report['parent_candidate_id']!==$plan['parent_candidate_id']
    ||($runtime['environment_sha256']??null)!==($plan['environment_sha256']??'73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105')
    ||(isset($plan['runtime_id'])&&($runtime['runtime_id']??null)!==$plan['runtime_id']))
    throw new RuntimeException('Corrective source/runtime lineage mismatch');
foreach([$plan,$report,$runtime] as $value)
    if(($value['compute']??null)!=='google'||($value['qualification_complete']??true)!==false||($value['publication_eligible']??true)!==false)
        throw new RuntimeException('Unqualified Google-only corrective evidence required');
$details=['plan'=>$plan,'report'=>$report,'runtime'=>$runtime,'artifact'=>['sha256'=>hash('sha256',$reportBytes),'bytes'=>strlen($reportBytes)],'publication_eligible'=>false];
if($runtime['status']==='failed'&&$report['status']==='failed'){
    Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details){
        $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$action='avatar.portable-corrective-bake-failed';
        $prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
        if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Immutable corrective failure mismatch');return;}
        $state=$current->state;$state['skinning_diagnostics'][$plan['id']]=$details;$current->update(['state'=>$state]);
        app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-avatar-repair-20261027',$details);
    });
    echo json_encode(['id'=>$plan['id'],'status'=>'failed','candidate_registered'=>false,'publication_eligible'=>false]);exit;
}
if($argc!==7||$runtime['status']!=='completed'||$report['status']!=='review_required'||$runtime['report_sha256']!==hash('sha256',$reportBytes))
    throw new RuntimeException('Completed corrective receipt required');
$base=file_get_contents($argv[4]);$stress=file_get_contents($argv[5]);$validationBytes=file_get_contents($argv[6]);$validation=json_decode($validationBytes,true,flags:JSON_THROW_ON_ERROR);
if(substr($base,0,4)!=='glTF'||substr($stress,0,4)!=='glTF'||$report['artifact']['sha256']!==hash('sha256',$base)||$report['artifact']['bytes']!==strlen($base)
    ||$report['corrective_stress_artifact']['sha256']!==hash('sha256',$stress)||$report['corrective_stress_artifact']['bytes']!==strlen($stress)
    ||$report['corrective_stress_artifact']['source_candidate_sha256']!==hash('sha256',$base)
    ||($validation['compute']??null)!=='google'||count($validation['checks']??[])!==2)
    throw new RuntimeException('Corrective output/validation bytes mismatch');
foreach([hash('sha256',$base),hash('sha256',$stress)] as $sha){
    $check=collect($validation['checks'])->firstWhere('sha256',$sha);
    if(!$check||$check['issues']['numErrors']!==0||($plan['method']==='contact-bound-portable-pose-correctives-v3'&&$check['issues']['numWarnings']!==0))
        throw new RuntimeException('Corrective glTF validation gate failed');
}
$probe=$run->state['skinning_diagnostics'][$plan['target_probe_id']]??[];
if(($probe['artifact']['sha256']??null)!==$plan['files']['target-report.json']
    ||($probe['report']['rig_sha256']??null)!==$plan['parent_candidate_sha256']
    ||($probe['report']['target_surface_artifact']['sha256']??null)!==$plan['files']['corrective-targets.npz'])
    throw new RuntimeException('Corrective target lineage mismatch');
$artifacts=app(App\Services\AvatarRawRigReviewArtifactService::class);$control=$report['native_skeletal_control']['proof'];
if(($report['native_skeletal_control']['baseline_reproduced']??false)!==true
    ||$control['candidate_id']!==$plan['parent_candidate_id']||$control['source_candidate_sha256']!==$plan['parent_candidate_sha256']
    ||$control['control_sha256']!==$plan['files']['native-control.glb']
    ||hash('sha256',$artifacts->candidateBends($run,$control['visual_review_id'],$plan['parent_candidate_id']))!==$control['control_sha256'])
    throw new RuntimeException('Corrective native skeletal control mismatch');
$keys=[];foreach(['UpperArmL','UpperArmR','ForearmL','ForearmR','ThighL','ThighR','CalfL','CalfR'] as $joint)foreach([45,90] as $angle)$keys[]=$joint.':'.$angle;sort($keys);
$poseKeys=array_map(fn($p)=>$p['joint'].':'.$p['degrees'],$report['poses']??[]);sort($poseKeys);
if($poseKeys!==$keys||count($report['primary_morph_defaults']??[])!==4||collect($report['primary_morph_defaults'])->contains(fn($w)=>abs($w)>1e-8)
    ||count($report['corrective_recipe']['joints']??[])!==4||count($report['morph_channel_bake']['morph_channels']??[])!==8
    ||($report['weight_correspondence']['verified']??false)!==true||$report['rest_surface_roundtrip']['max_nearest_distance_m']>1e-6
    ||collect($report['poses'])->contains(fn($p)=>$p['canonical_skeleton_max_matrix_error']>1e-6||$p['max_coincident_rest_vertex_spread_m']>1e-6||$p['edge_deformation']['severely_stretched_edges']!==0)
    ||collect($report['candidate_weights'])->contains(fn($w)=>!$w['finite_nonnegative']||$w['unweighted_vertices']!==0||$w['max_influences']>4||$w['max_normalization_error']>1e-5))
    throw new RuntimeException('Corrective morph/pose/preservation contract mismatch');
$reference=$run->state['skinning_reviews'][$plan['reference_candidate_id']]??[];
if(($reference['report']['artifact']['sha256']??null)!==$plan['reference_candidate_sha256']||count($report['baseline_reproduction']??[])!==2)
    throw new RuntimeException('Corrective reference mismatch');
foreach($report['baseline_reproduction'] as $sample){
    $source=$sample['label']==='parent'?$parent['report']:$reference['report'];$expected=collect($source['reloaded_poses']??$source['poses'])->keyBy(fn($p)=>$p['joint'].':'.$p['degrees']);
    $sampleKeys=array_map(fn($p)=>$p['joint'].':'.$p['degrees'],$sample['poses']);sort($sampleKeys);
    if(($sample['reproduced']??false)!==true||$sampleKeys!==$keys||collect($sample['poses'])->contains(fn($p)=>$p['self_intersections']!==$expected[$p['joint'].':'.$p['degrees']]['self_intersections']))
        throw new RuntimeException('Corrective canonical baseline mismatch');
}
if($plan['method']==='contact-bound-portable-pose-correctives-v3')foreach(['primary_layout_normalization','stress_layout_normalization'] as $key)
    if(($report[$key]['joint_hierarchy_unchanged']??false)!==true||($report[$key]['animation_tracks_unchanged']??false)!==true||($report[$key]['static_identity_wrappers_verified']??false)!==true)
        throw new RuntimeException('Corrective root-layout normalization proof mismatch');
$details['gltf_validation']=$validation;$details['gltf_validation_sha256']=hash('sha256',$validationBytes);
Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details,$base,$stress,$artifacts){
    $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$action='avatar.portable-corrective-candidate-recorded';
    $prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
    if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Immutable corrective candidate mismatch');return;}
    $state=$current->state;if(isset($state['skinning_reviews'][$plan['id']]))throw new RuntimeException('Corrective candidate ID already exists');
    $state['skinning_reviews'][$plan['id']]=$details;$current->update(['state'=>$state]);$artifacts->retainCandidate($current,$plan['id'],$base);
    $sha=hash('sha256',$stress);$path='avatar-preparations/'.$current->id.'/diagnostics/'.$sha.'.glb';$disk=Illuminate\Support\Facades\Storage::disk('local');
    if($disk->exists($path)){if(hash('sha256',$disk->get($path))!==$sha)throw new RuntimeException('Stored corrective clip is corrupt');}
    elseif(!$disk->put($path,$stress))throw new RuntimeException('Could not retain corrective clip');
    app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-avatar-repair-20261027',$details);
});
echo json_encode(['id'=>$plan['id'],'candidate_sha256'=>hash('sha256',$base),'corrective_stress_sha256'=>hash('sha256',$stress),'publication_eligible'=>false,'qualification_complete'=>false]);
