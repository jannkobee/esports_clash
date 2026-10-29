<?php
// Record an incomplete Colab remap without admitting a target or candidate.
if($argc!==4)throw new RuntimeException('Usage: plan.json state.json diagnostic.log');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$plan=json_decode(file_get_contents($argv[1]),true,flags:JSON_THROW_ON_ERROR);$runtime=json_decode(file_get_contents($argv[2]),true,flags:JSON_THROW_ON_ERROR);$log=file_get_contents($argv[3]);
$run=App\Models\AvatarPreparation::findOrFail($plan['rig_attempt_id']);$native=$run->state['skinning_reviews'][$plan['parent_candidate_id']]['report']??[];$arap=$run->state['skinning_diagnostics'][$plan['arap_probe_id']]??[];
if(!Illuminate\Support\Str::isUuid($plan['id']??'')||($runtime['id']??null)!==$plan['id']||($plan['method']??null)!=='corrective-arap-remapped-target-v1'
 ||($runtime['status']??null)!=='failed'||!is_string($runtime['error']??null)||($runtime['runtime_id']??null)!==$plan['runtime_id']
 ||($runtime['environment_sha256']??null)!==$plan['environment_sha256']||($native['artifact']['sha256']??null)!==$plan['parent_candidate_sha256']
 ||($plan['files']['native.glb']??null)!==$plan['parent_candidate_sha256']||($arap['artifact']['sha256']??null)!==$plan['files']['arap-report.json'])throw new RuntimeException('Failed remap lineage mismatch');
foreach([$plan,$runtime] as $entry)if(($entry['compute']??null)!=='google'||($entry['qualification_complete']??true)!==false||($entry['publication_eligible']??true)!==false)throw new RuntimeException('Unqualified Google evidence required');
$report=['id'=>$plan['id'],'method'=>'failed-arap-remap-v1','compute'=>'google','status'=>'failed','parent_candidate_id'=>$plan['parent_candidate_id'],
 'source_sha256'=>$run->plan['source_sha256'],'rig_sha256'=>$plan['parent_candidate_sha256'],'error'=>$runtime['error'],'log_tail'=>substr($log,-2000),'qualification_complete'=>false,'publication_eligible'=>false];
$details=['plan'=>$plan,'runtime'=>$runtime,'report'=>$report,'log_sha256'=>hash('sha256',$log),'publication_eligible'=>false];
Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details){
 $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$action='avatar.arap-remap-failed';$prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
 if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Immutable failure mismatch');return;}
 $state=$current->state;if(isset($state['skinning_diagnostics'][$plan['id']]))throw new RuntimeException('Diagnostic ID already exists');$state['skinning_diagnostics'][$plan['id']]=$details;$current->update(['state'=>$state]);
 app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-avatar-repair-20261027',$details);
});
echo json_encode(['id'=>$plan['id'],'status'=>'failed','target_registered'=>false,'publication_eligible'=>false]);
