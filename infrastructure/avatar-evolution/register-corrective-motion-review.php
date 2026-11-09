<?php
// Canonical retention of exact Google-only interpolation evidence, including failures.
if($argc!==4)throw new RuntimeException('Usage: plan.json report.json state.json');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$plan=json_decode(file_get_contents($argv[1]),true,flags:JSON_THROW_ON_ERROR);$bytes=file_get_contents($argv[2]);$report=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);
$runtime=json_decode(file_get_contents($argv[3]),true,flags:JSON_THROW_ON_ERROR);$run=App\Models\AvatarPreparation::findOrFail($plan['rig_attempt_id']);
$candidate=$run->state['skinning_reviews'][$plan['candidate_id']]??[];$native=$run->state['skinning_reviews'][$plan['native_control_candidate_id']]??[];
$review=$run->state['candidate_visual_reviews'][$plan['visual_review_id']]??[];$service=app(App\Services\AvatarRawRigReviewArtifactService::class);
if(!Illuminate\Support\Str::isUuid($plan['id']??'')||($report['id']??null)!==$plan['id']||($runtime['id']??null)!==$plan['id']
    ||($plan['method']??null)!=='retained-corrective-cycle-interpolation-v1'||($report['method']??null)!==$plan['method']
    ||($plan['source_sha256']??null)!==($run->plan['source_sha256']??null)||($report['source_sha256']??null)!==$plan['source_sha256']
    ||($report['rig_sha256']??null)!==($run->state['cloud_raw_rig']['artifact']['sha256']??null)
    ||($candidate['report']['artifact']['sha256']??null)!==$plan['candidate_sha256']||($report['candidate_sha256']??null)!==$plan['candidate_sha256']
    ||($report['parent_candidate_id']??null)!==$plan['candidate_id']||($report['native_control_candidate_id']??null)!==$plan['native_control_candidate_id']
    ||($review['runtime']['status']??null)!=='completed'||($runtime['runtime_id']??null)!==$plan['runtime_id']
    ||($runtime['environment_sha256']??null)!==$plan['environment_sha256'])throw new RuntimeException('Motion diagnostic lineage/runtime mismatch');
foreach([$plan,$report,$runtime] as $entry)
    if(($entry['compute']??null)!=='google'||($entry['qualification_complete']??true)!==false||($entry['publication_eligible']??true)!==false)
        throw new RuntimeException('Unqualified Google-only diagnostic required');
foreach(['parent'=>$plan['native_control_candidate_id'],'current'=>$plan['candidate_id']] as $label=>$id){
    $stress=$service->candidateBends($run,$plan['visual_review_id'],$id);
    if(hash('sha256',$stress)!==($plan['files'][$label.'-stress.glb']??null))throw new RuntimeException('Motion diagnostic playback lineage mismatch');
}
$completed=($runtime['status']??null)==='completed'&&($report['status']??null)==='diagnostic_complete';
$failed=($runtime['status']??null)==='failed'&&($report['status']??null)==='failed';
if(!$completed&&!$failed)throw new RuntimeException('Terminal motion diagnostic receipt required');
if($completed){
    if(($runtime['report_sha256']??null)!==hash('sha256',$bytes)||array_column($report['assets']??[],'label')!==['parent','current'])
        throw new RuntimeException('Motion diagnostic result mismatch');
    $joints=['UpperArmL','UpperArmR','ThighL','ThighR'];$expectedKeys=[];foreach($joints as $joint)foreach(range(0,12) as $tick)$expectedKeys[]=$joint.':'.$tick;sort($expectedKeys);
    foreach($report['assets'] as $asset){
        $keys=array_map(fn($p)=>$p['joint'].':'.$p['tick'],$asset['poses']??[]);sort($keys);
        if($keys!==$expectedKeys||($asset['stress_sha256']??null)!==$plan['files'][$asset['label'].'-stress.glb']
            ||count($asset['cycles']??[])!==4||collect($asset['poses'])->contains(fn($p)=>$p['seam_spread_m']>1e-6||$p['edge_deformation']['severely_stretched_edges']!==0)
            ||collect($asset['cycles'])->contains(fn($c)=>$c['end_rest_max_m']>1e-6||$c['return_path_max_m']>1e-6))
            throw new RuntimeException('Motion cycle coverage/preservation mismatch');
        if($asset['label']==='current'&&collect($asset['poses'])->contains(fn($p)=>$p['native_control_skeleton_error']>1e-6||$p['morph_curve_max_error']>1e-5))
            throw new RuntimeException('Motion corrective interpolation mismatch');
        $source=$asset['label']==='current'?$candidate['report']:$native['report'];
        $original=collect($source['reloaded_poses']??$source['poses'])->keyBy(fn($p)=>$p['joint'].':'.$p['degrees']);
        foreach($asset['poses'] as $pose)if(in_array($pose['tick'],[3,6,9],true)){
            $key=$pose['joint'].':'.($pose['tick']===6?90:45);
            if(($original[$key]['self_intersections']??null)!==$pose['self_intersections'])throw new RuntimeException('Motion canonical pose mismatch');
        }
    }
}
$details=['plan'=>$plan,'report'=>$report,'runtime'=>$runtime,'artifact'=>['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)],'publication_eligible'=>false];
Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details,$completed){
    $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$action=$completed?'avatar.corrective-motion-review-recorded':'avatar.corrective-motion-review-failed';
    $prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
    if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Immutable motion diagnostic mismatch');return;}
    $state=$current->state;if(isset($state['skinning_diagnostics'][$plan['id']]))throw new RuntimeException('Motion diagnostic ID already exists');
    $state['skinning_diagnostics'][$plan['id']]=$details;$current->update(['state'=>$state]);
    app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-avatar-repair-20261027',$details);
});
echo json_encode(['id'=>$plan['id'],'status'=>$report['status'],'publication_eligible'=>false,'qualification_complete'=>false]);
