<?php
// Append immutable Colab visual evidence and retain its exact diagnostic playback.
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$plan=json_decode(file_get_contents($argv[1]),true,flags:JSON_THROW_ON_ERROR);
$export=json_decode(file_get_contents($argv[2]),true,flags:JSON_THROW_ON_ERROR);
$renderBytes=file_get_contents($argv[3]);$render=json_decode($renderBytes,true,flags:JSON_THROW_ON_ERROR);
$runtime=json_decode(file_get_contents($argv[4]),true,flags:JSON_THROW_ON_ERROR);
$assessment=json_decode(file_get_contents($argv[5]),true,flags:JSON_THROW_ON_ERROR);
$run=App\Models\AvatarPreparation::findOrFail($plan['preparation_id']);
if(!Illuminate\Support\Str::isUuid($plan['id'])||$plan['compute']!=='google'
    ||($plan['publication_eligible']??true)!==false||($plan['qualification_complete']??true)!==false
    ||($export['id']??null)!==$plan['id']||($render['id']??null)!==$plan['id']||($runtime['id']??null)!==$plan['id']
    ||($export['compute']??null)!=='google'||($render['compute']??null)!=='google'||($runtime['compute']??null)!=='google'
    ||($export['status']??null)!=='diagnostic_clips_exported'||($render['status']??null)!=='rendered_for_review'
    ||($runtime['status']??null)!=='completed'||($runtime['report_sha256']??null)!==hash('sha256',$renderBytes)
    ||($render['errors']??['missing'])!==[]||($render['plan']??null)!=$plan
    ||($assessment['publication_eligible']??true)!==false||($assessment['qualification_complete']??true)!==false)
    throw new RuntimeException('Visual review contract mismatch');
$bends=[];$artifacts=app(App\Services\AvatarRawRigReviewArtifactService::class);
foreach(['parent','current'] as $index=>$label){
    $candidate=$plan['candidates'][$label];$entry=collect($export['assets'])->firstWhere('label',$label);
    $source=$artifacts->candidate($run,$candidate['id']);$bytes=file_get_contents($argv[6+$index]);
    $expectedKeys=[];foreach(['UpperArmL','UpperArmR','ForearmL','ForearmR','ThighL','ThighR','CalfL','CalfR'] as $joint)
        foreach([45,90] as $angle)$expectedKeys[]=$joint.':'.$angle;
    $actualKeys=array_map(fn($pose)=>$pose['joint'].':'.$pose['degrees'],$entry['poses']??[]);sort($actualKeys);sort($expectedKeys);
    if(!$entry||($entry['baseline_reproduced']??false)!==true
        ||($entry['source_sha256']??null)!==hash('sha256',$source)
        ||($candidate['artifact_sha256']??null)!==hash('sha256',$source)
        ||($plan['files']['site/'.$label.'.glb']??null)!==hash('sha256',$source)
        ||($entry['stress_sha256']??null)!==hash('sha256',$bytes)||($entry['stress_bytes']??null)!==strlen($bytes)
        ||$actualKeys!==$expectedKeys||collect($entry['poses'])->contains(fn($pose)=>$pose['intersections']!==$pose['expected']))
        throw new RuntimeException('Candidate bend reproduction or artifact mismatch');
    $bends[$candidate['id']]=$bytes;
    $candidateReport=$run->state['skinning_reviews'][$candidate['id']]['report'];
    if(isset($candidateReport['corrective_recipe'])){
        $baked=$candidateReport['corrective_stress_artifact'];
        if($baked['sha256']!==hash('sha256',$bytes)||$baked['source_candidate_sha256']!==hash('sha256',$source))
            throw new RuntimeException('Exact retained corrective bake required');
        $expectedPoses=collect($candidateReport['poses'])->keyBy(fn($p)=>$p['joint'].':'.$p['degrees']);
        $matches=function($actual,$expected){
            if(!is_array($actual)||!is_array($expected)||array_diff_key($actual,$expected)||array_diff_key($expected,$actual))return false;
            foreach($expected as $name=>$value)if(!is_numeric($actual[$name])||!is_finite((float)$actual[$name])||abs($actual[$name]-$value)>1e-5)return false;
            return true;
        };
        foreach($entry['poses'] as $pose)if(!$matches($pose['morph_weights']??null,$expectedPoses[$pose['joint'].':'.$pose['degrees']]['morph_weights']??null))
            throw new RuntimeException('Corrective export morph weights mismatch');
        $views=array_values(array_filter($render['views']??[],fn($view)=>$view['asset']===$label));
        if(!$views)throw new RuntimeException('Corrective Babylon views missing');
        foreach($views as $view){
            $expected=$view['kind']==='exact-bind'?array_fill_keys(array_keys($candidateReport['primary_morph_weights']??$candidateReport['poses'][0]['morph_weights']),0):($expectedPoses[$view['joint'].':'.$view['degrees']]['morph_weights']??null);
            if(!$matches($view['morph_weights']??null,$expected))throw new RuntimeException('Corrective Babylon morph playback mismatch');
        }
    }
}
$details=['plan'=>$plan,'bend_export'=>$export,'render'=>$render,'runtime'=>$runtime,'visual_assessment'=>$assessment,
    'report_sha256'=>hash('sha256',$renderBytes),'publication_eligible'=>false,'qualification_complete'=>false];
Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details,$bends,$artifacts){
    $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$action='avatar.candidate-visual-review-recorded';
    $prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
    if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Recorded visual evidence is immutable');return;}
    $state=$current->state;$state['candidate_visual_reviews'][$plan['id']]=$details;$current->update(['state'=>$state]);
    foreach($bends as $candidateId=>$bytes)$artifacts->retainCandidateBends($current,$plan['id'],$candidateId,$bytes);
    app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-production-avatar-20261026',$details);
});
echo json_encode(['id'=>$plan['id'],'preparation_id'=>$run->id,'candidates'=>array_keys($bends),'publication_eligible'=>false]);
