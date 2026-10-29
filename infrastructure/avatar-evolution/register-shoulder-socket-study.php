<?php
// Retain an immutable Colab socket study and its diagnostic candidates. Never select/release.
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$plan=json_decode(file_get_contents($argv[1]),true,flags:JSON_THROW_ON_ERROR);
$bytes=file_get_contents($argv[2]);$report=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);
$runtime=json_decode(file_get_contents($argv[3]),true,flags:JSON_THROW_ON_ERROR);$directory=$argv[4];
$run=App\Models\AvatarPreparation::findOrFail($plan['rig_attempt_id']);
$artifacts=app(App\Services\AvatarRawRigReviewArtifactService::class);
$parent=$run->state['skinning_reviews'][$plan['parent_candidate_id']]??[];
$reference=$run->state['skinning_reviews'][$plan['reference_candidate_id']]??[];
$variantSets=['weight-fixed-shoulder-socket-placement-v1'=>['lateral_0p5pct','medial_0p5pct','anterior_0p5pct','posterior_0p5pct','superior_0p5pct','inferior_0p5pct','section_bounds_center'],
    'weight-fixed-shoulder-socket-combined-v2'=>['outward_forward_0p5pct'],
    'weight-fixed-hip-socket-placement-v1'=>['lateral_0p5pct','medial_0p5pct','anterior_0p5pct','posterior_0p5pct','superior_0p5pct','inferior_0p5pct','section_bounds_center'],
    'weight-fixed-hip-forward-extent-v2'=>['anterior_0p99pct']];
if(!isset($variantSets[$plan['method']??''])||$plan['variants']!==$variantSets[$plan['method']])throw new RuntimeException('Unknown frozen socket variant set');
if(($report['status']??null)==='failed'){
    if(!Illuminate\Support\Str::isUuid($plan['id'])||$report['id']!==$plan['id']||$runtime['id']!==$plan['id']
        ||$report['method']!==$plan['method']
        ||$plan['compute']!=='google'||$report['compute']!=='google'||$runtime['compute']!=='google'
        ||$runtime['status']!=='failed'||$run->plan['source_sha256']!==$report['source_sha256']
        ||($runtime['environment_sha256']??null)!=='73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105'
        ||$report['rig_sha256']!==$plan['parent_candidate_sha256']
        ||($parent['report']['artifact']['sha256']??null)!==$plan['parent_candidate_sha256']
        ||$plan['files']['candidate.glb']!==$plan['parent_candidate_sha256']
        ||($report['publication_eligible']??true)!==false||($report['qualification_complete']??true)!==false
        ||($plan['publication_eligible']??true)!==false||($plan['qualification_complete']??true)!==false
        ||($runtime['publication_eligible']??true)!==false||($runtime['qualification_complete']??true)!==false
        ||(!str_starts_with($plan['method'],'weight-fixed-hip-')&&collect($report['variants']??[])->contains(fn($variant)=>isset($variant['artifact']))))
        throw new RuntimeException('Failed socket study identity mismatch');
    $details=['plan'=>$plan,'report'=>$report,'runtime'=>$runtime,'artifact'=>['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)],'publication_eligible'=>false];
    Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details){
        $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$action='avatar.shoulder-socket-study-failed';
        $prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
        if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Immutable failure evidence mismatch');return;}
        $state=$current->state;$state['skinning_diagnostics'][$plan['id']]=$details;$current->update(['state'=>$state]);
        app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-socket-study-20261027',$details);
    });
    echo json_encode(['id'=>$plan['id'],'status'=>'failed','candidates'=>[],'publication_eligible'=>false]);exit;
}
if(!Illuminate\Support\Str::isUuid($plan['id'])||$report['id']!==$plan['id']||$runtime['id']!==$plan['id']
    ||$report['method']!==$plan['method']
    ||$plan['compute']!=='google'||$report['compute']!=='google'||$runtime['compute']!=='google'
    ||$report['status']!=='diagnostic_complete'||$runtime['status']!=='completed'
    ||($runtime['environment_sha256']??null)!=='73928306c86dae9ce21c8fe672abffcebdbb4ee2a654fa3a194a6f466ee8d105'
    ||($runtime['report_sha256']??null)!==hash('sha256',$bytes)
    ||$run->plan['source_sha256']!==$report['source_sha256']
    ||($parent['report']['artifact']['sha256']??null)!==$plan['parent_candidate_sha256']
    ||($reference['report']['artifact']['sha256']??null)!==$plan['reference_candidate_sha256']
    ||$plan['files']['candidate.glb']!==$report['rig_sha256']||$report['rig_sha256']!==$plan['parent_candidate_sha256']
    ||hash('sha256',$artifacts->candidate($run,$plan['parent_candidate_id']))!==$plan['parent_candidate_sha256']
    ||hash('sha256',$artifacts->candidate($run,$plan['reference_candidate_id']))!==$plan['reference_candidate_sha256']
    ||count($report['baseline_reproduction']??[])!==2
    ||count($report['variants']??[])!==count($variantSets[$plan['method']])||array_column($report['variants'],'variant')!==$plan['variants'])
    throw new RuntimeException('Socket study lineage, runtime or complete coverage mismatch');
foreach([$plan,$report,$runtime] as $entry)
    if(($entry['publication_eligible']??true)!==false||($entry['qualification_complete']??true)!==false)
        throw new RuntimeException('Unqualified study flags required');
$poseKeys=[];foreach(['UpperArmL','UpperArmR','ForearmL','ForearmR','ThighL','ThighR','CalfL','CalfR'] as $joint)
    foreach([45,90] as $angle)$poseKeys[]=$joint.':'.$angle;sort($poseKeys);
foreach($report['baseline_reproduction'] as $baseline){
    $source=$baseline['label']==='parent'?$parent['report']:$reference['report'];
    $expected=collect($source['reloaded_poses']??$source['poses'])->keyBy(fn($p)=>$p['joint'].':'.$p['degrees']);
    $keys=array_map(fn($p)=>$p['joint'].':'.$p['degrees'],$baseline['poses']);sort($keys);
    if(($baseline['reproduced']??false)!==true||$keys!==$poseKeys
        ||collect($baseline['poses'])->contains(fn($p)=>$p['self_intersections']!==$expected[$p['joint'].':'.$p['degrees']]['self_intersections']))
        throw new RuntimeException('Canonical baseline reproduction mismatch');
}
$candidates=[];
foreach($report['variants'] as $variant){
    if(($variant['status']??null)==='rejected_by_frozen_bounds'){
        $rejection=$variant['rejection_details']??[];
        if(isset($variant['artifact'])||($rejection['maximum_displacement_to_height']??null)!==.01
            ||(($rejection['inside_section_bounds']??true)!==false&&($rejection['displacement_to_height']??0)<=.01))
            throw new RuntimeException('Rejected proposal must actually fail the unchanged bounds');
        continue;
    }
    $id=$variant['candidate_id'];$file=$variant['artifact']['file'];
    if(!Illuminate\Support\Str::isUuid($id)||$id!==$plan['candidate_ids'][$variant['variant']]
        ||basename($file)!==$file||$file!==$variant['variant'].'.glb')throw new RuntimeException('Socket variant identity mismatch');
    $glb=file_get_contents($directory.'/'.$file);$keys=array_map(fn($p)=>$p['joint'].':'.$p['degrees'],$variant['poses']);sort($keys);
    if($keys!==$poseKeys||$variant['artifact']['sha256']!==hash('sha256',$glb)||$variant['artifact']['bytes']!==strlen($glb)
        ||substr($glb,0,4)!=='glTF'||($variant['weights_unchanged_before_export']??false)!==true
        ||($variant['weight_correspondence']['verified']??false)!==true
        ||$variant['weight_correspondence']['before_to_after']['unmatched_vertices']!==0
        ||$variant['weight_correspondence']['after_to_before']['unmatched_vertices']!==0
        ||$variant['weight_correspondence']['before_to_after']['max_matching_weight_error']>2e-6
        ||$variant['weight_correspondence']['after_to_before']['max_matching_weight_error']>2e-6
        ||$variant['rest_surface_roundtrip']['max_nearest_distance_m']>1e-6
        ||$variant['pivot_edits']['unrelated_joint_max_matrix_error']>1e-12
        ||$variant['pivot_edits']['target_axis_max_matrix_error']>1e-12
        ||($variant['pivot_edits']['binary_edits_only_target_inverse_binds']??false)!==true
        ||($variant['pivot_edits']['mesh_weight_accessor_bytes_unchanged']??false)!==true
        ||($variant['pivot_edits']['child_world_transforms_compensated']??false)!==true
        ||($variant['pivot_edits']['inverse_bind_matrices_updated']??0)!==2
        ||(str_starts_with($plan['method'],'weight-fixed-hip-')
            ? ($variant['non_target_bends_unchanged']??false)!==true : ($variant['non_shoulder_bends_unchanged']??false)!==true)
        ||collect($variant['pivot_edits']['joints'])->contains(fn($p)=>!$p['inside_section_bounds']||$p['displacement_to_height']>.01))
        throw new RuntimeException('Fixed-weight socket artifact contract mismatch');
    $candidateReport=array_merge($variant,['id'=>$id,'compute'=>'google','method'=>$plan['method'],
        'source_sha256'=>$run->plan['source_sha256'],'rig_sha256'=>$run->state['cloud_raw_rig']['artifact']['sha256'],
        'parent_candidate_id'=>$plan['parent_candidate_id'],'reference_candidate_id'=>$plan['reference_candidate_id'],
        'baseline_reproduction'=>$report['baseline_reproduction'],'socket_study_id'=>$plan['id'],
        'socket_study_report_sha256'=>hash('sha256',$bytes),'publication_eligible'=>false,'qualification_complete'=>false,
        'status'=>'review_required','scope'=>$report['scope']]);
    $candidateBytes=json_encode($candidateReport,JSON_PRETTY_PRINT|JSON_PRESERVE_ZERO_FRACTION|JSON_THROW_ON_ERROR);
    $candidatePlan=array_merge($plan,['id'=>$id,'socket_study_id'=>$plan['id'],'variant'=>$variant['variant']]);
    $candidates[$id]=['glb'=>$glb,'details'=>['plan'=>$candidatePlan,'report'=>$candidateReport,
        'artifact'=>['sha256'=>hash('sha256',$candidateBytes),'bytes'=>strlen($candidateBytes)],'publication_eligible'=>false]];
}
$details=['plan'=>$plan,'report'=>$report,'runtime'=>$runtime,'artifact'=>['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)],'publication_eligible'=>false];
Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details,$candidates,$artifacts){
    $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$action='avatar.shoulder-socket-study-recorded';
    $prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
    if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Immutable socket study mismatch');return;}
    $state=$current->state;$state['skinning_diagnostics'][$plan['id']]=$details;
    foreach($candidates as $id=>$candidate){
        if(isset($state['skinning_reviews'][$id]))throw new RuntimeException('Candidate ID already exists');
        $state['skinning_reviews'][$id]=$candidate['details'];
    }
    $current->update(['state'=>$state]);
    foreach($candidates as $id=>$candidate)$artifacts->retainCandidate($current,$id,$candidate['glb']);
    app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-socket-study-20261027',$details);
});
echo json_encode(['id'=>$plan['id'],'preparation_id'=>$run->id,'candidates'=>array_keys($candidates),'publication_eligible'=>false]);
