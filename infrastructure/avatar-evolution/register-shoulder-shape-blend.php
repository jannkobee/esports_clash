<?php
// Append immutable target-surface experiment; no generated model is admitted here.
if($argc!==5)throw new RuntimeException('Usage: plan.json report.json state.json corrective-targets.npz');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$plan=json_decode(file_get_contents($argv[1]),true,flags:JSON_THROW_ON_ERROR);$bytes=file_get_contents($argv[2]);$report=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);
$runtime=json_decode(file_get_contents($argv[3]),true,flags:JSON_THROW_ON_ERROR);$targets=file_get_contents($argv[4]);$run=App\Models\AvatarPreparation::findOrFail($plan['rig_attempt_id']);
$parent=$run->state['skinning_reviews'][$plan['parent_candidate_id']]??[];$probe=$run->state['skinning_diagnostics'][$plan['target_probe_id']]??[];
if(!Illuminate\Support\Str::isUuid($plan['id']??'')||($report['id']??null)!==$plan['id']||($runtime['id']??null)!==$plan['id']
    ||($plan['method']??null)!=='half-strength-shoulder-target-v1'||($report['method']??null)!==$plan['method']
    ||($report['source_sha256']??null)!==$run->plan['source_sha256']||($report['rig_sha256']??null)!==$plan['parent_candidate_sha256']
    ||($parent['report']['artifact']['sha256']??null)!==$plan['parent_candidate_sha256']||($report['parent_candidate_id']??null)!==$plan['parent_candidate_id']
    ||($report['target_probe_id']??null)!==$plan['target_probe_id']||($probe['artifact']['sha256']??null)!==$plan['registered_target_report_sha256']
    ||($probe['report']['target_surface_artifact']['sha256']??null)!==$plan['files']['corrective-targets.npz']
    ||($probe['report']['rig_sha256']??null)!==$plan['parent_candidate_sha256']||($runtime['runtime_id']??null)!==$plan['runtime_id']
    ||($runtime['environment_sha256']??null)!==$plan['environment_sha256']||($runtime['status']??null)!=='completed'
    ||($runtime['report_sha256']??null)!==hash('sha256',$bytes)||($report['status']??null)!=='diagnostic_complete'
    ||($report['target_surface_artifact']['sha256']??null)!==hash('sha256',$targets)||($report['target_surface_artifact']['bytes']??null)!==strlen($targets))
    throw new RuntimeException('Shoulder-shape experiment lineage/runtime mismatch');
foreach([$plan,$report,$runtime] as $entry)
    if(($entry['compute']??null)!=='google'||($entry['qualification_complete']??true)!==false||($entry['publication_eligible']??true)!==false)
        throw new RuntimeException('Unqualified Google-only diagnostic required');
if(($plan['blend_policy']??null)!==['UpperArmL'=>0.5,'UpperArmR'=>0.5,'ThighL'=>1.0,'ThighR'=>1.0]
    ||($report['blend_policy']??null)!==$plan['blend_policy']||array_column($report['variants'],'name')!==['native_baseline','original_hybrid_targets','half_shoulder_full_hip'])
    throw new RuntimeException('Frozen shape hypothesis mismatch');
$source=collect($parent['report']['reloaded_poses']??$parent['report']['poses'])->keyBy(fn($p)=>$p['joint'].':'.$p['degrees']);
$hybrid=collect($probe['report']['variants'][1]['poses'])->keyBy(fn($p)=>$p['joint'].':'.$p['degrees']);
$all=[];foreach(['UpperArmL','UpperArmR','ForearmL','ForearmR','ThighL','ThighR','CalfL','CalfR'] as $joint)foreach([45,90] as $angle)$all[]=$joint.':'.$angle;sort($all);
$shaped=[];foreach(['UpperArmL','UpperArmR','ThighL','ThighR'] as $joint)foreach([45,90] as $angle)$shaped[]=$joint.':'.$angle;sort($shaped);
foreach($report['variants'] as $index=>$variant){
    $keys=array_map(fn($p)=>$p['joint'].':'.$p['degrees'],$variant['poses']??[]);sort($keys);
    if($keys!==($index===0?$all:$shaped))throw new RuntimeException('Shape study pose coverage mismatch');
    foreach($variant['poses'] as $pose){
        $key=$pose['joint'].':'.$pose['degrees'];
        if(($index===0&&($source[$key]['self_intersections']??null)!==$pose['self_intersections'])
            ||($index===1&&($hybrid[$key]['self_intersections']??null)!==$pose['self_intersections'])
            ||($index>0&&($pose['seam_spread_m']>1e-6||$pose['max_delta_from_native_m']>0.02||$pose['edge_deformation']['severely_stretched_edges']!==0)))
            throw new RuntimeException('Shape study frozen baseline or bounds mismatch');
    }
}
$details=['plan'=>$plan,'report'=>$report,'runtime'=>$runtime,'artifact'=>['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)],'publication_eligible'=>false];
Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details,$targets){
    $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$action='avatar.shoulder-shape-target-recorded';
    $prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
    if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Immutable shape target mismatch');return;}
    $state=$current->state;if(isset($state['skinning_diagnostics'][$plan['id']]))throw new RuntimeException('Target ID already exists');
    $state['skinning_diagnostics'][$plan['id']]=$details;$current->update(['state'=>$state]);
    $sha=hash('sha256',$targets);$path='avatar-preparations/'.$current->id.'/diagnostics/'.$sha.'.npz';$disk=Illuminate\Support\Facades\Storage::disk('local');
    if($disk->exists($path)){if(hash('sha256',$disk->get($path))!==$sha)throw new RuntimeException('Stored target surface is corrupt');}
    elseif(!$disk->put($path,$targets))throw new RuntimeException('Could not retain target surface');
    app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-avatar-repair-20261027',$details);
});
echo json_encode(['id'=>$plan['id'],'target_sha256'=>hash('sha256',$targets),'publication_eligible'=>false,'qualification_complete'=>false]);
