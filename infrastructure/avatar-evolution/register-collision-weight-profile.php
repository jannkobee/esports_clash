<?php
// Append exact Colab-only collision influence evidence to its parent candidate lineage.
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$plan=json_decode(file_get_contents($argv[1]),true,flags:JSON_THROW_ON_ERROR);
$bytes=file_get_contents($argv[2]);$report=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);
$run=App\Models\AvatarPreparation::findOrFail($plan['rig_attempt_id']);
$parent=$run->state['skinning_reviews'][$plan['parent_candidate_id']]??null;
if(!Illuminate\Support\Str::isUuid($plan['id'])||$plan['id']!==$report['id']
    ||($plan['compute']??null)!=='google'||($report['compute']??null)!=='google'
    ||($report['status']??null)!=='diagnostic_complete'
    ||($report['publication_eligible']??true)!==false||($report['qualification_complete']??true)!==false
    ||$run->plan['source_sha256']!==$report['source_sha256']
    ||($parent['report']['artifact']['sha256']??null)!==($plan['parent_candidate_sha256']??null)
    ||($plan['files']['candidate.glb']??null)!==($report['rig_sha256']??null)
    ||($report['rig_sha256']??null)!==($plan['parent_candidate_sha256']??null))
    throw new RuntimeException('Collision profile lineage mismatch');
$evaluationVariants=['linear-versus-preserve-volume-v1'=>['linear_baseline','preserve_volume_diagnostic'],
    'contact-bound-corrective-smooth-probe-v1'=>['linear_baseline','smooth_pinned_boundary','smooth_free_boundary'],
    'contact-bound-hybrid-corrective-probe-v1'=>['linear_baseline','hybrid_pinned_boundary']];
if(isset($evaluationVariants[$report['method']??''])){
    $variants=$report['variants']??[];$source=$parent['report'];
    $expected=collect($source['reloaded_poses']??$source['poses'])->keyBy(fn($p)=>$p['joint'].':'.$p['degrees']);
    if(array_column($variants,'name')!==$evaluationVariants[$report['method']]||count($variants[0]['poses']??[])!==16
        ||collect($variants[0]['poses'])->contains(fn($p)=>($expected[$p['joint'].':'.$p['degrees']]['self_intersections']??null)!==$p['self_intersections']))
        throw new RuntimeException('Skin evaluation baseline comparison mismatch');
    foreach($variants as $variant){
        $keys=array_map(fn($p)=>$p['joint'].':'.$p['degrees'],$variant['poses']);sort($keys);$expectedKeys=$expected->keys()->sort()->values()->all();
        if($keys!==$expectedKeys||($variant['rest_surface_comparison']['max_nearest_distance_m']??1e99)>1e-6)
            throw new RuntimeException('Skin evaluation pose coverage or rest-surface mismatch');
    }
    if(str_starts_with($report['method'],'contact-bound-')){
        $contact=$run->state['skinning_diagnostics'][$plan['contact_map_id']??'']??[];
        if(($contact['artifact']['sha256']??null)!==($plan['registered_contact_report_sha256']??null)
            ||($contact['report']['rig_sha256']??null)!==$plan['parent_candidate_sha256']
            ||($contact['report']['parent_candidate_id']??null)!==$plan['parent_candidate_id']
            ||collect(array_slice($variants,1))->contains(fn($v)=>array_sum(array_column($v['contact_mask']??[],'seeds'))!==count($contact['report']['contact_vertex_records']??[])))
            throw new RuntimeException('Surface probe contact-source verification mismatch');
    }
}
$runtime=null;$posedTarget=null;
if(($report['method']??null)==='corrected-hip-fold-profile-v1'){
    if($argc!==4)throw new RuntimeException('Hip fold profile requires its runtime receipt');
    $runtime=json_decode(file_get_contents($argv[3]),true,flags:JSON_THROW_ON_ERROR);
    $contact=$run->state['skinning_diagnostics'][$plan['contact_map_id']??'']??[];
    $bends=app(App\Services\AvatarRawRigReviewArtifactService::class)->candidateBends($run,$plan['visual_review_id'],$plan['parent_candidate_id']);
    if(($plan['method']??null)!==$report['method']||($plan['config']??null)!==['joints'=>['ThighL','ThighR'],'degrees'=>[45,90],'contact_patch_rings'=>3]
        ||($runtime['id']??null)!==$plan['id']||($runtime['status']??null)!=='completed'||($runtime['compute']??null)!=='google'
        ||($runtime['qualification_complete']??true)!==false||($runtime['publication_eligible']??true)!==false
        ||($runtime['runtime_id']??null)!==($plan['runtime_id']??null)||($runtime['environment_sha256']??null)!==($plan['environment_sha256']??null)
        ||($runtime['report_sha256']??null)!==hash('sha256',$bytes)||($contact['artifact']['sha256']??null)!==($plan['registered_contact_report_sha256']??null)
        ||($contact['report']['rig_sha256']??null)!==$plan['parent_candidate_sha256']||($plan['files']['contact-map.json']??null)!==$contact['artifact']['sha256']
        ||($plan['files']['corrected-stress.glb']??null)!==hash('sha256',$bends))throw new RuntimeException('Hip fold profile lineage or runtime mismatch');
    $poses=$report['poses']??[];$keys=array_map(fn($p)=>$p['joint'].':'.$p['degrees'],$poses);sort($keys);
    if($keys!==['ThighL:45','ThighL:90','ThighR:45','ThighR:90'])throw new RuntimeException('Hip fold pose coverage mismatch');
    $expected=collect($parent['report']['reloaded_poses']??$parent['report']['poses'])->keyBy(fn($p)=>$p['joint'].':'.$p['degrees']);
    foreach($poses as $pose){
        $source=$expected[$pose['joint'].':'.$pose['degrees']]??null;$actual=$pose['morph_weights']??[];$wanted=$source['morph_weights']??[];
        if(!$source||($pose['intersections']??null)!==$source['self_intersections']||!$wanted||array_diff_key($actual,$wanted)||array_diff_key($wanted,$actual)
            ||($pose['seed_vertices']??0)<=0||($pose['patch_vertices']??0)<$pose['seed_vertices']||($pose['patch_edges']??0)<=0)
            throw new RuntimeException('Hip fold baseline or patch mismatch');
        foreach($wanted as $name=>$value)if(!is_numeric($actual[$name])||abs($actual[$name]-$value)>1e-5)throw new RuntimeException('Hip fold morph mismatch');
    }
}
if(($report['method']??null)==='corrected-contact-topology-v1'){
    if($argc!==4)throw new RuntimeException('Contact topology requires its runtime receipt');
    $runtime=json_decode(file_get_contents($argv[3]),true,flags:JSON_THROW_ON_ERROR);
    $contact=$run->state['skinning_diagnostics'][$plan['contact_map_id']??'']??[];
    $bends=app(App\Services\AvatarRawRigReviewArtifactService::class)->candidateBends($run,$plan['visual_review_id'],$plan['parent_candidate_id']);
    if(($plan['method']??null)!==$report['method']||($runtime['id']??null)!==$plan['id']||($runtime['status']??null)!=='completed'
        ||($runtime['compute']??null)!=='google'||($runtime['qualification_complete']??true)!==false||($runtime['publication_eligible']??true)!==false
        ||($runtime['runtime_id']??null)!==($plan['runtime_id']??null)||($runtime['environment_sha256']??null)!==($plan['environment_sha256']??null)
        ||($runtime['report_sha256']??null)!==hash('sha256',$bytes)||($contact['artifact']['sha256']??null)!==($plan['registered_contact_report_sha256']??null)
        ||($contact['report']['rig_sha256']??null)!==$plan['parent_candidate_sha256']||($plan['files']['contact-map.json']??null)!==$contact['artifact']['sha256']
        ||($plan['files']['corrected-stress.glb']??null)!==hash('sha256',$bends))throw new RuntimeException('Contact topology lineage or runtime mismatch');
    $poses=$report['poses']??[];$keys=array_column($poses,'joint');sort($keys);
    if($keys!==['ThighL','ThighR','UpperArmL','UpperArmR'])throw new RuntimeException('Contact topology pose coverage mismatch');
    $expected=collect($parent['report']['reloaded_poses']??$parent['report']['poses'])->keyBy(fn($p)=>$p['joint'].':'.$p['degrees']);
    foreach($poses as $pose){
        $source=$expected[$pose['joint'].':90']??null;$actual=$pose['morph_weights']??[];$wanted=$source['morph_weights']??[];
        if(!$source||($pose['degrees']??null)!==90||($pose['intersections']??null)!==$source['self_intersections']
            ||array_diff_key($actual,$wanted)||array_diff_key($wanted,$actual)||array_sum(array_column($pose['regions']??[],'count'))!==$pose['intersections'])
            throw new RuntimeException('Contact topology baseline mismatch');
        foreach($wanted as $name=>$value)if(!is_numeric($actual[$name])||abs($actual[$name]-$value)>1e-5)throw new RuntimeException('Contact topology morph mismatch');
        foreach($pose['regions'] as $region)if(array_sum($region['edge_hop_histogram']??[])!==$region['count'])throw new RuntimeException('Contact topology histogram mismatch');
    }
}
if(($report['method']??null)==='corrected-morph-contact-map-v1'){
    if($argc!==4)throw new RuntimeException('Corrected contact map requires a runtime receipt');
    $runtime=json_decode(file_get_contents($argv[3]),true,flags:JSON_THROW_ON_ERROR);
    $source=$parent['report'];$bends=app(App\Services\AvatarRawRigReviewArtifactService::class)->candidateBends($run,$plan['visual_review_id'],$plan['parent_candidate_id']);
    if(($plan['method']??null)!==$report['method']||($runtime['id']??null)!==$plan['id']||($runtime['status']??null)!=='completed'
        ||($runtime['compute']??null)!=='google'||($runtime['qualification_complete']??true)!==false||($runtime['publication_eligible']??true)!==false
        ||($runtime['runtime_id']??null)!==$plan['runtime_id']||($runtime['environment_sha256']??null)!==$plan['environment_sha256']
        ||($runtime['report_sha256']??null)!==hash('sha256',$bytes)||($report['visual_review_id']??null)!==$plan['visual_review_id']
        ||($report['stress_sha256']??null)!==hash('sha256',$bends)||($plan['files']['candidate-stress.glb']??null)!==hash('sha256',$bends)
        ||($report['clip_rest_max_distance_m']??1e99)>1e-6)throw new RuntimeException('Corrected contact playback/runtime mismatch');
    $expected=collect($source['poses'])->keyBy(fn($p)=>$p['joint'].':'.$p['degrees']);$keys=array_map(fn($p)=>$p['joint'],$report['pose_diagnostics']??[]);sort($keys);
    if($keys!==['ThighL','ThighR','UpperArmL','UpperArmR']||!count($report['contact_vertex_records']??[]))throw new RuntimeException('Corrected contact pose coverage mismatch');
    foreach($report['pose_diagnostics'] as $pose){
        $sourcePose=$expected[$pose['joint'].':90']??null;$actual=$pose['morph_weights']??[];$morph=$sourcePose['morph_weights']??[];
        if(!$sourcePose||$pose['degrees']!==90||$pose['self_intersections']!==$sourcePose['self_intersections']
            ||array_diff_key($actual,$morph)||array_diff_key($morph,$actual))throw new RuntimeException('Corrected contact baseline mismatch');
        foreach($morph as $name=>$value)if(!is_numeric($actual[$name])||abs($actual[$name]-$value)>1e-5)throw new RuntimeException('Corrected contact morph mismatch');
    }
}
if(in_array($report['method']??null,['rest-sign-shoulder-separation-v1','contact-bound-local-arap-v1','contact-pair-centroid-probe-v1'],true)){
    $isArap=$report['method']==='contact-bound-local-arap-v1';
    $isCentroid=$report['method']==='contact-pair-centroid-probe-v1';
    if(!in_array($argc,($isArap||$isCentroid)?[4,5]:[4],true))throw new RuntimeException('Shoulder surface diagnostic requires its runtime receipt and optional target');
    $runtime=json_decode(file_get_contents($argv[3]),true,flags:JSON_THROW_ON_ERROR);
    $contact=$run->state['skinning_diagnostics'][$plan['contact_map_id']]??[];$service=app(App\Services\AvatarRawRigReviewArtifactService::class);
    $nativeId=$parent['report']['parent_candidate_id']??'';$native=$run->state['skinning_reviews'][$nativeId]['report']??[];
    $nativeClip=$service->candidateBends($run,$plan['visual_review_id'],$nativeId);$correctedClip=$service->candidateBends($run,$plan['visual_review_id'],$plan['parent_candidate_id']);
    $config=$isArap?['joint'=>'UpperArmL','region_pair'=>['bone_2','bone_26'],'max_added_height_fraction'=>0.001,'falloff_rings'=>3,'anchor_strength'=>2.0]:($isCentroid?['joint'=>'UpperArmL','region_pair'=>['bone_2','bone_26'],'max_added_height_fraction'=>0.001,'falloff_rings'=>3,'minimum_centroid_height_fraction'=>0.00001]:['joint'=>'UpperArmL','region_pair'=>['bone_2','bone_26'],'max_added_height_fraction'=>0.003,'falloff_rings'=>3,'minimum_rest_side_height_fraction'=>0.00001]);
    if(($plan['method']??null)!==$report['method']||($plan['config']??null)!==$config||($report['config']??null)!==$config
        ||($runtime['id']??null)!==$plan['id']||($runtime['status']??null)!=='completed'||($runtime['compute']??null)!=='google'
        ||($runtime['qualification_complete']??true)!==false||($runtime['publication_eligible']??true)!==false
        ||($runtime['runtime_id']??null)!==$plan['runtime_id']||($runtime['environment_sha256']??null)!==$plan['environment_sha256']
        ||($runtime['report_sha256']??null)!==hash('sha256',$bytes)||($contact['artifact']['sha256']??null)!==$plan['registered_contact_report_sha256']
        ||($contact['report']['rig_sha256']??null)!==$plan['parent_candidate_sha256']
        ||($plan['files']['contact-map.json']??null)!==$contact['artifact']['sha256']
        ||($plan['files']['native-stress.glb']??null)!==hash('sha256',$nativeClip)||($plan['files']['corrected-stress.glb']??null)!==hash('sha256',$correctedClip))
        throw new RuntimeException('Shoulder separation lineage or runtime mismatch');
    $all=[];foreach(['UpperArmL','UpperArmR','ForearmL','ForearmR','ThighL','ThighR','CalfL','CalfR'] as $joint)foreach([45,90] as $angle)$all[]=$joint.':'.$angle;sort($all);
    if(array_column($report['baseline_reproduction']??[],'label')!==['native','corrected'])throw new RuntimeException('Shoulder separation baselines missing');
    foreach($report['baseline_reproduction'] as $entry){
        $source=$entry['label']==='native'?$native:$parent['report'];$expected=collect($source['reloaded_poses']??$source['poses'])->keyBy(fn($p)=>$p['joint'].':'.$p['degrees']);
        $keys=array_map(fn($p)=>$p['joint'].':'.$p['degrees'],$entry['poses']??[]);sort($keys);
        if($keys!==$all||($entry['reproduced']??false)!==true||collect($entry['poses'])->contains(fn($p)=>($expected[$p['joint'].':'.$p['degrees']]['self_intersections']??null)!==$p['self_intersections']))
            throw new RuntimeException('Shoulder separation baseline mismatch');
        if(($isArap||$isCentroid)&&$entry['label']==='corrected')foreach($entry['poses'] as $pose){
            $actual=$pose['morph_weights']??[];$wanted=$expected[$pose['joint'].':'.$pose['degrees']]['morph_weights']??[];
            if(!$wanted||array_diff_key($actual,$wanted)||array_diff_key($wanted,$actual))throw new RuntimeException('ARAP corrective morph baseline missing');
            foreach($wanted as $name=>$value)if(!is_numeric($actual[$name])||abs($actual[$name]-$value)>1e-5)throw new RuntimeException('ARAP corrective morph baseline mismatch');
        }
    }
    $s=$report[$isArap?'arap':($isCentroid?'centroid_probe':'separation')]??[];
    if(($s['joint']??null)!=='UpperArmL'||($s['degrees']??null)!==90||($s['before_intersections']??null)!==31
        ||($s['eligible_pairs']??null)!==31||($s['height_m']??0)<=0||($s['max_added_delta_m']??1)>$s['height_m']*$config['max_added_height_fraction']*1.0001
        ||($s['seam_spread_m']??1)>1e-6||($s['edge_deformation']['severely_stretched_edges']??1)!==0)
        throw new RuntimeException('Shoulder separation frozen bounds mismatch');
    if(($isArap||$isCentroid)&&isset($report['posed_target_artifact'])){
        if($argc!==5||($isArap&&($s['after_intersections']>$s['before_intersections']||$s['rigid_energy_after']>=$s['rigid_energy_before']))||($isCentroid&&$s['after_intersections']>=$s['before_intersections']))throw new RuntimeException('Unexpected surface target');
        $posedTarget=file_get_contents($argv[4]);$proof=$report['posed_target_artifact'];
        if(($proof['sha256']??null)!==hash('sha256',$posedTarget)||($proof['bytes']??null)!==strlen($posedTarget)
            ||($proof['vertex_count']??null)!==array_sum($contact['report']['mesh_vertex_counts']??[]))
            throw new RuntimeException('ARAP target bytes or topology mismatch');
    }elseif($argc===5)throw new RuntimeException('No posed target recorded');
}
$details=['plan'=>$plan,'report'=>$report,'artifact'=>['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)],'publication_eligible'=>false];
if($runtime!==null)$details['runtime']=$runtime;
Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details,$posedTarget){
    $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);
    $action='avatar.skinning-influence-profile-recorded';
    $prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
    if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Recorded evidence is immutable');return;}
    app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-production-avatar-20261026',$details);
    $state=$current->state;$state['skinning_diagnostics'][$plan['id']]=$details;$current->update(['state'=>$state]);
    if($posedTarget!==null){$sha=hash('sha256',$posedTarget);$path='avatar-preparations/'.$current->id.'/diagnostics/'.$sha.'.npz';$disk=Illuminate\Support\Facades\Storage::disk('local');
        if($disk->exists($path)){if(hash('sha256',$disk->get($path))!==$sha)throw new RuntimeException('Stored ARAP target is corrupt');}
        elseif(!$disk->put($path,$posedTarget))throw new RuntimeException('Could not retain ARAP target');}
});
echo json_encode(['id'=>$plan['id'],'preparation_id'=>$run->id,'parent_candidate_id'=>$plan['parent_candidate_id'],'publication_eligible'=>false]);
