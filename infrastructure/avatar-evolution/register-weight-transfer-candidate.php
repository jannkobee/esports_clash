<?php
// Append one measured Google Colab weight candidate to its exact preparation lineage.
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$plan=json_decode(file_get_contents($argv[1]),true,flags:JSON_THROW_ON_ERROR);
$bytes=file_get_contents($argv[2]);$report=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);
$glb=file_get_contents($argv[3]);$run=App\Models\AvatarPreparation::findOrFail($plan['rig_attempt_id']);
$parent=$run->state['skinning_reviews'][$plan['parent_candidate_id']]??null;
if(!Illuminate\Support\Str::isUuid($plan['id'])||$plan['id']!==$report['id']
    ||($plan['compute']??null)!=='google'||($report['compute']??null)!=='google'
    ||($report['status']??null)!=='review_required'
    ||($report['publication_eligible']??true)!==false||($report['qualification_complete']??true)!==false
    ||$run->plan['source_sha256']!==($report['source_sha256']??null)
    ||($run->state['cloud_raw_rig']['artifact']['sha256']??null)!==($report['rig_sha256']??null)
    ||($parent['report']['artifact']['sha256']??null)!==($plan['parent_candidate_sha256']??null)
    ||($plan['files']['candidate.glb']??null)!==($plan['parent_candidate_sha256']??null)
    ||($report['parent_candidate_id']??null)!==($plan['parent_candidate_id']??null)
    ||($report['artifact']['sha256']??null)!==hash('sha256',$glb)
    ||($report['artifact']['bytes']??null)!==strlen($glb)
    ||strlen($glb)<20||substr($glb,0,4)!=='glTF')
    throw new RuntimeException('Weight candidate lineage or artifact mismatch');
if(isset($plan['reference_candidate_id'])){
    $reference=$run->state['skinning_reviews'][$plan['reference_candidate_id']]??null;
    if(($reference['report']['artifact']['sha256']??null)!==($plan['reference_candidate_sha256']??null)
        ||($plan['files']['reference.glb']??null)!==($plan['reference_candidate_sha256']??null)
        ||($report['reference_candidate_id']??null)!==$plan['reference_candidate_id']
        ||count($report['baseline_reproduction']??[])!==2
        ||collect($report['baseline_reproduction'])->contains(fn($entry)=>($entry['reproduced']??false)!==true))
        throw new RuntimeException('Weight candidate reference or reproduced baseline mismatch');
}
if(isset($plan['contact_map_id'])){
    $contact=$run->state['skinning_diagnostics'][$plan['contact_map_id']]??null;
    $verified=$report['contact_verification']??[];
    $map=$run->state['raw_review']['report']['bone_map']??[];
    $allowed=['bone_2',$map['UpperArmL']??null,$map['UpperArmR']??null];
    if(($contact['artifact']['sha256']??null)!==($plan['registered_contact_report_sha256']??null)
        ||($contact['report']['rig_sha256']??null)!==($plan['parent_candidate_sha256']??null)
        ||($contact['report']['parent_candidate_id']??null)!==$plan['parent_candidate_id']
        ||($verified['id']??null)!==$plan['contact_map_id']
        ||($verified['input_report_sha256']??null)!==($plan['files']['contact-map.json']??null)
        ||($verified['source_sha256']??null)!==$plan['parent_candidate_sha256']
        ||($verified['source_correspondence_verified']??false)!==true
        ||($verified['verified_vertices']??0)!==count($contact['report']['contact_vertex_records']??[])
        ||($report['repair_config']??null)!=($plan['repair_config']??null)
        ||array_diff($report['changed_joint_groups']??[],$allowed))
        throw new RuntimeException('Shoulder contact-map correspondence mismatch');
}
$details=['plan'=>$plan,'report'=>$report,'artifact'=>['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)],'publication_eligible'=>false];
Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details,$glb){
    $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);
    $action='avatar.skinning-weight-candidate-recorded';
    $prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
    if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Recorded evidence is immutable');return;}
    app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-production-avatar-20261026',$details);
    $state=$current->state;$state['skinning_reviews'][$plan['id']]=$details;$current->update(['state'=>$state]);
    app(App\Services\AvatarRawRigReviewArtifactService::class)->retainCandidate($current,$plan['id'],$glb);
});
echo json_encode(['id'=>$plan['id'],'preparation_id'=>$run->id,'parent_candidate_id'=>$plan['parent_candidate_id'],'publication_eligible'=>false]);
