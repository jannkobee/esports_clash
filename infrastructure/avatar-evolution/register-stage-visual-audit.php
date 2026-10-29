<?php
// Retain a hash-verified diagnostic comparison and screenshots in the backoffice.
if($argc!==3)throw new RuntimeException('Usage: php register-stage-visual-audit.php PREPARATION_UUID REVIEW_DIRECTORY');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$run=App\Models\AvatarPreparation::findOrFail($argv[1]);$dir=rtrim($argv[2],'/');$bytes=file_get_contents($dir.'/visual-report.json');$r=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);$p=$r['plan']??[];
$fit=($p['stages']??null)===['raw','fitted'];$stages=$fit?['raw','fitted']:['raw','early','corrected'];$fitProof=null;
if(!Illuminate\Support\Str::isUuid($r['id']??'')||($p['id']??null)!==$r['id']||($p['preparation_id']??null)!==$run->id
    ||($r['compute']??null)!=='google'||($r['status']??null)!=='rendered_for_review'||($r['errors']??null)!==[]
    ||($r['publication_eligible']??true)!==false||($r['qualification_complete']??true)!==false||count($r['views']??[])!==24*count($stages))
    throw new RuntimeException('Invalid visual comparison');
$service=app(App\Services\AvatarRawRigReviewArtifactService::class);
$stress=$fit?[]:['raw'=>$service->file($run),'early'=>$service->candidateBends($run,'3184f35b-889c-4697-9371-046ea3c89dd1','a3352d37-91cb-4757-b403-da09f5ac0017'),
    'corrected'=>$service->candidateBends($run,'8c276c78-78b2-4e66-8d67-89a9261fc29c','140fe64c-6c59-41a5-9b8b-6bb7a35c8b97')];
if(($p['source_sha256']??null)!==($run->plan['source_sha256']??null)||($p['raw_rig_sha256']??null)!==($run->state['cloud_raw_rig']['artifact']['sha256']??null))throw new RuntimeException('Source lineage mismatch');
foreach($stress as $stage=>$data)if(($p['files']['site/'.$stage.'.glb']??null)!==hash('sha256',$data))throw new RuntimeException('Stress artifact mismatch: '.$stage);
if($fit){
    $candidateId=$p['fit_candidate_id']??'';$candidate=$service->candidate($run,$candidateId);$candidateSha=hash('sha256',$candidate);
    if(($p['fit_candidate_sha256']??null)!==$candidateSha||($p['files']['site/current.glb']??null)!==$candidateSha
        ||($p['files']['site/parent.glb']??null)!==$p['raw_rig_sha256'])throw new RuntimeException('Fitted comparison source mismatch');
    $export=$r['bend_export']??[];
    if(($export['id']??null)!==$r['id']||($export['status']??null)!=='diagnostic_clips_exported'||count($export['assets']??[])!==2)throw new RuntimeException('Missing verified clip export');
    foreach(['parent','current'] as $label){
        $asset=collect($export['assets'])->firstWhere('label',$label)??[];
        $source=$label==='parent'?$p['raw_rig_sha256']:$candidateSha;
        $baseline=$label==='parent'?$run->state['raw_review']['report']['poses']:$run->state['skinning_reviews'][$candidateId]['report']['reloaded_poses'];
        if(($asset['source_sha256']??null)!==$source||($asset['baseline_reproduced']??false)!==true||count($asset['poses']??[])!==16)throw new RuntimeException('Unverified fitted clip source');
        foreach($asset['poses'] as $pose){$expected=collect($baseline)->first(fn($v)=>$v['joint']===$pose['joint']&&$v['degrees']===$pose['degrees']);
            if(!$expected||$pose['intersections']!==$expected['self_intersections'])throw new RuntimeException('Fitted clip pose mismatch');
        }
        $clip=file_get_contents($dir.'/site/'.$label.'-stress.glb');
        if(hash('sha256',$clip)!==$asset['stress_sha256']||strlen($clip)!==$asset['stress_bytes'])throw new RuntimeException('Fitted clip bytes mismatch');
        $disk=Illuminate\Support\Facades\Storage::disk('local');$path='avatar-preparations/'.$run->id.'/diagnostics/'.$asset['stress_sha256'].'.glb';
        if($disk->exists($path)&&hash('sha256',$disk->get($path))!==$asset['stress_sha256'])throw new RuntimeException('Stored fitted clip mismatch');
        if(!$disk->exists($path)&&!$disk->put($path,$clip))throw new RuntimeException('Fitted clip retention failed');
        if($label==='current')$fitProof=['candidate_id'=>$candidateId,'candidate_sha256'=>$candidateSha,'sha256'=>$asset['stress_sha256'],'bytes'=>$asset['stress_bytes']];
    }
}
$seen=[];$disk=Illuminate\Support\Facades\Storage::disk('local');
foreach($r['views'] as $v){
    $stage=$v['stage']??'';$joint=$v['joint']??'';$degrees=$v['degrees']??0;$orbit=$v['orbit']??-1;$sha=$v['sha256']??'';
    if(!in_array($stage,$stages,true)||!in_array($joint,['UpperArmL','UpperArmR','ThighL','ThighR'],true)
       ||!in_array($degrees,[45,90],true)||!in_array($orbit,[0,1,3],true)||!preg_match('/^[a-f0-9]{64}$/D',$sha)
       ||($v['file']??null)!=='screenshots/'.$stage.'-'.$joint.'-'.$degrees.'-orbit'.$orbit.'.png')throw new RuntimeException('Invalid screenshot identity');
    $key=implode(':',[$stage,$joint,$degrees,$orbit]);if(isset($seen[$key]))throw new RuntimeException('Duplicate screenshot');$seen[$key]=true;
    $img=file_get_contents($dir.'/'.$v['file']);if(!str_starts_with($img,"\x89PNG\r\n\x1a\n")||hash('sha256',$img)!==$sha)throw new RuntimeException('Screenshot bytes mismatch');
    $path='avatar-preparations/'.$run->id.'/stage-visual/'.$r['id'].'/'.$sha.'.png';
    if($disk->exists($path)&&hash('sha256',$disk->get($path))!==$sha)throw new RuntimeException('Stored screenshot mismatch');
    if(!$disk->exists($path)&&!$disk->put($path,$img))throw new RuntimeException('Screenshot retention failed');
}
$details=['report'=>$r,'report_sha256'=>hash('sha256',$bytes),'publication_eligible'=>false,'qualification_complete'=>false];
if($fitProof)$details['fit_bends']=$fitProof;
Illuminate\Support\Facades\DB::transaction(function()use($run,$r,$details){
    $locked=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$prior=$locked->state['stage_visual_audits'][$r['id']]??null;
    if($prior){if($prior!=$details)throw new RuntimeException('Visual audit is immutable');return;}
    $state=$locked->state??[];$state['stage_visual_audits'][$r['id']]=$details;$locked->update(['state'=>$state]);
    app(App\Services\EvolutionService::class)->audit($r['id'],'avatar.stage-visual-audit-completed','owner:authorized-production-avatar-20261026',$details);
});
echo json_encode(['id'=>$r['id'],'report_sha256'=>hash('sha256',$bytes),'screenshots'=>count($seen),'publication_eligible'=>false]);
