<?php
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$bundle=json_decode(file_get_contents($argv[1]),true,flags:JSON_THROW_ON_ERROR);
if(!Illuminate\Support\Str::isUuid($bundle['id'])||$bundle['avatar_id']!=='c_invoker')throw new RuntimeException('Unexpected candidate identity');
Illuminate\Support\Facades\DB::transaction(function()use($bundle){
    $entry=App\Models\GameContent::where('kind','avatar')->lockForUpdate()->findOrFail('c_invoker');
    $candidate=App\Models\AvatarBaseCandidate::updateOrCreate(['id'=>$bundle['id']],['avatar_id'=>'c_invoker','asset_epoch'=>$entry->payload['assets']['epoch'],
        'status'=>$bundle['status'],'report'=>$bundle['report'],'artifacts'=>$bundle['artifacts']]);
    $payload=$entry->payload;$payload['assets']['status']='base_review';$payload['assets']['candidate_id']=$candidate->id;
    $payload['assets']['model']=$bundle['artifacts']['mirelle-base-animated.glb'];$payload['assets']['rig']=$bundle['artifacts']['mirelle-raw-rig.glb'];
    $payload['assets']['animations']=array_keys($bundle['report']['clips']);
    $entry->update(['payload'=>$payload,'version'=>$entry->version+1]);
    app(App\Services\GameContentService::class)->revision($entry,'base-candidate',App\Models\User::where('is_evolution_admin',true)->value('id'));
});
echo json_encode(['candidate_id'=>$bundle['id'],'status'=>$bundle['status'],'live_publication'=>false]).PHP_EOL;
