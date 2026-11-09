<?php
// Append immutable Colab remapping evidence; retain the derived targets privately.
if($argc!==5)throw new RuntimeException('Usage: plan.json report.json state.json target.npz');
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$plan=json_decode(file_get_contents($argv[1]),true,flags:JSON_THROW_ON_ERROR);$bytes=file_get_contents($argv[2]);$report=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);
$runtime=json_decode(file_get_contents($argv[3]),true,flags:JSON_THROW_ON_ERROR);$target=file_get_contents($argv[4]);$run=App\Models\AvatarPreparation::findOrFail($plan['rig_attempt_id']);
$native=$run->state['skinning_reviews'][$plan['parent_candidate_id']]['report']??[];$hip=$run->state['skinning_diagnostics'][$plan['hip_probe_id']]??[];$hybrid=$run->state['skinning_diagnostics'][$plan['hybrid_probe_id']]??[];$mapping=$report['mapping']??[];
if(!Illuminate\Support\Str::isUuid($plan['id']??'')||($report['id']??null)!==$plan['id']||($runtime['id']??null)!==$plan['id']
 ||($plan['method']??null)!=='corrective-hip-contact-remapped-target-v1'||($report['method']??null)!==$plan['method']||($runtime['status']??null)!=='completed'
 ||($runtime['runtime_id']??null)!==$plan['runtime_id']||($runtime['environment_sha256']??null)!==$plan['environment_sha256']||($runtime['report_sha256']??null)!==hash('sha256',$bytes)
 ||($report['status']??null)!=='diagnostic_complete'||($native['artifact']['sha256']??null)!==$plan['parent_candidate_sha256']||($report['rig_sha256']??null)!==$plan['parent_candidate_sha256']
 ||($report['source_sha256']??null)!==$run->plan['source_sha256']||($report['parent_candidate_id']??null)!==$plan['parent_candidate_id']
 ||($hip['artifact']['sha256']??null)!==$plan['files']['hip-report.json']||($hip['report']['posed_target_artifact']['sha256']??null)!==$plan['files']['hip-target.npz']
 ||($hybrid['artifact']['sha256']??null)!==$plan['files']['hybrid-report.json']||($hybrid['report']['target_surface_artifact']['sha256']??null)!==$plan['files']['hybrid-targets.npz']
 ||($report['target_surface_artifact']['sha256']??null)!==hash('sha256',$target)||($report['target_surface_artifact']['bytes']??null)!==strlen($target)
 ||($mapping['unmatched_native']??1)!==0||($mapping['max_rest_position_error_m']??1)>1e-6||($mapping['max_weight_error']??1)>2e-6||($mapping['max_seam_target_ambiguity_m']??1)>1e-6)
 throw new RuntimeException('hip remap source, target, bounds or runtime mismatch');
$trials=$hip['report']['hip_trials']??[];$mapped=$mapping['hip_targets']??[];
if(array_column($trials,'joint')!==['ThighL','ThighR']||array_column($mapped,'joint')!==['ThighL','ThighR'])throw new RuntimeException('Both hip target mappings required');
foreach($mapped as $m){$trial=collect($trials)->firstWhere('joint',$m['joint']);if(!$trial||($m['intersections']??null)!==$trial['after_intersections']||($m['edge_deformation']['severely_stretched_edges']??1)!==0||($m['max_change_from_hybrid_m']??1)>($trial['height_m']??0)*.001+1e-6)throw new RuntimeException('Hip target mapping or frozen bounds mismatch');}
foreach([$plan,$report,$runtime] as $entry)if(($entry['compute']??null)!=='google'||($entry['qualification_complete']??true)!==false||($entry['publication_eligible']??true)!==false)throw new RuntimeException('Unqualified Colab evidence required');
$details=['plan'=>$plan,'report'=>$report,'runtime'=>$runtime,'artifact'=>['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)],'publication_eligible'=>false];
Illuminate\Support\Facades\DB::transaction(function()use($run,$plan,$details,$target){
 $current=App\Models\AvatarPreparation::lockForUpdate()->findOrFail($run->id);$action='avatar.hip-remapped-target-recorded';$prior=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
 if($prior){if(json_decode($prior->details,true)!=$details)throw new RuntimeException('Immutable hip remap mismatch');return;}
 $state=$current->state;if(isset($state['skinning_diagnostics'][$plan['id']]))throw new RuntimeException('Target ID already exists');$state['skinning_diagnostics'][$plan['id']]=$details;$current->update(['state'=>$state]);
 $sha=hash('sha256',$target);$path='avatar-preparations/'.$current->id.'/diagnostics/'.$sha.'.npz';$disk=Illuminate\Support\Facades\Storage::disk('local');
 if($disk->exists($path)){if(hash('sha256',$disk->get($path))!==$sha)throw new RuntimeException('Stored target is corrupt');}elseif(!$disk->put($path,$target))throw new RuntimeException('Could not retain target');
 app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner:authorized-avatar-repair-20261027',$details);
});
echo json_encode(['id'=>$plan['id'],'target_sha256'=>hash('sha256',$target),'qualification_complete'=>false,'publication_eligible'=>false]);
