<?php
require __DIR__.'/../EsportsClash.Api/vendor/autoload.php';
$app=require __DIR__.'/../EsportsClash.Api/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$db=Illuminate\Support\Facades\DB::connection();$schema=Illuminate\Support\Facades\Schema::getFacadeRoot();
$result=['driver'=>$db->getDriverName(),'database'=>config('database.connections.'.config('database.default').'.database')];
foreach(['owned_player_cards','fps_player_identities','online_matches','online_catalogs'] as $table){
    if(!$schema->hasTable($table)){$result[$table]=null;continue;}
    $result[$table]=['count'=>$db->table($table)->count()];
    $key=$table==='fps_player_identities'?'player_id':'id';
    $result[$table]['ids_sha256']=hash('sha256',json_encode($db->table($table)->orderBy($key)->pluck($key)->all()));
}
if($schema->hasTable('fps_player_identities'))$result['identity_columns']=$schema->getColumnListing('fps_player_identities');
if($schema->hasTable('online_matches'))$result['match_statuses']=$db->table('online_matches')->select('status')->selectRaw('COUNT(*) as n')->groupBy('status')->get()->all();
echo json_encode($result,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES);
