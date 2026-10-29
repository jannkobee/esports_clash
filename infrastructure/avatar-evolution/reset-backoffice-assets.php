<?php
// Explicit owner-authorized all-avatar asset reset. Keep definitions and audit identities.
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\{AvatarVisualRelease,AvatarPreparation,TrellisGeneration,AvatarEvolutionRun,GameContent};
use Illuminate\Support\Facades\DB;
if(App\Models\OnlineMatch::whereIn('status',['allocated','running'])->exists())throw new RuntimeException('Active matches must finish before an all-avatar asset reset.');
foreach([TrellisGeneration::class,AvatarPreparation::class,AvatarEvolutionRun::class] as $model){
    if($model::whereIn('status',['queued','running','preparing','rigging','animating','validating','waiting_worker','waiting_resources','pausing','cancelling'])->exists())throw new RuntimeException('An avatar job is active; stop it before resetting assets.');
}
DB::transaction(function(){
    // Clear only current release links. All release/job/audit history stays intact.
    AvatarVisualRelease::where('active',true)->update(['active'=>false]);
    foreach(GameContent::where('kind','avatar')->get() as $entry){
        $payload=$entry->payload;$payload['assets']=['epoch'=>'fresh-20261024','status'=>'missing','reset_at'=>now()->toIso8601String(),'reference'=>null,'model'=>null,'rig'=>null,'animations'=>[]];
        $entry->update(['payload'=>$payload,'version'=>$entry->version+1]);
        DB::table('game_content_revisions')->insert(['content_id'=>$entry->id,'version'=>$entry->version,'action'=>'asset-reset','payload'=>json_encode($payload,JSON_THROW_ON_ERROR),'created_by'=>null,'created_at'=>now()]);
        $dir=storage_path('app/avatars/references/'.$entry->id);Illuminate\Support\Facades\File::ensureDirectoryExists($dir);
        Illuminate\Support\Facades\File::replace($dir.'/current.json',json_encode(['removed'=>true,'reason'=>'owner-all-avatar-reset','updated_at'=>now()->toIso8601String()]));
    }
    App\Models\AvatarEvolutionSetting::current()->update(['enabled'=>false]);App\Models\AvatarPreparationSetting::current()->update(['enabled'=>false]);
    DB::table('evolution_audits')->insert(['subject_id'=>'all-45-avatar-assets','action'=>'avatar.asset-reset','actor'=>'owner-authorized','details'=>json_encode(['epoch'=>'fresh-20261024']),'created_at'=>now()]);
});
echo json_encode(['avatars'=>GameContent::where('kind','avatar')->count(),'active_visual_releases'=>AvatarVisualRelease::where('active',true)->count(),'status'=>'assets_reset']).PHP_EOL;
