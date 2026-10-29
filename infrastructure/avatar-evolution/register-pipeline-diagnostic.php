<?php
/** Append diagnostic evidence to the backoffice audit without changing candidates. */
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$receipt=json_decode(file_get_contents($argv[1]),true,flags:JSON_THROW_ON_ERROR);
$plan=$receipt['plan']??$receipt;
if(($plan['schema']??null)!=='failed-rig-roll-isolation-v1'||!Illuminate\Support\Str::isUuid($plan['id']??'')
    ||($plan['compute']??null)!=='google'||($plan['publication_eligible']??null)!==false
    ||($plan['source_role']??null)!=='failed_candidate_diagnostic_only')throw new RuntimeException('Unsupported diagnostic receipt');
$candidate=App\Models\AvatarBaseCandidate::findOrFail($plan['source_candidate_id']);
$artifact=$candidate->artifacts[$plan['source_file']]??null;
if($candidate->avatar_id!==$plan['avatar_id']||!hash_equals($artifact['sha256']??'',$plan['source_sha256']))
    throw new RuntimeException('Diagnostic source disagrees with the backoffice candidate');
$status=$receipt['status']??$plan['status'];
if(!in_array($status,['started','completed','failed'],true))throw new RuntimeException('Invalid diagnostic state');
if($status==='completed'&&(($receipt['report']['source_sha256']??null)!==$plan['source_sha256']
    ||($receipt['report']['publication_eligible']??null)!==false))throw new RuntimeException('Diagnostic result identity mismatch');
$action='avatar.pipeline-diagnostic-'.$status;
$details=json_encode($receipt,JSON_THROW_ON_ERROR);
$previous=Illuminate\Support\Facades\DB::table('evolution_audits')->where('subject_id',$plan['id'])->where('action',$action)->first();
if($previous){
    if(json_decode($previous->details,true)!==$receipt)throw new RuntimeException('Immutable diagnostic receipt mismatch');
}else{
    app(App\Services\EvolutionService::class)->audit($plan['id'],$action,'owner-request:codex',$receipt);
}
echo json_encode(['diagnostic_id'=>$plan['id'],'status'=>$status,'source_candidate_id'=>$candidate->id,
    'source_status'=>$candidate->status,'publication_eligible'=>false]).PHP_EOL;
