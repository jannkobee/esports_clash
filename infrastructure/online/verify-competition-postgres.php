<?php
/** Disposable PostgreSQL schema/load check. Never accepts the live database name. */
$database=$argv[1]??'';
if(!preg_match('/^hexatrick_competition_test_[0-9]{8}$/D',$database))throw new RuntimeException('Provide an explicitly disposable competition test database.');
foreach(['APP_ENV'=>'testing','DB_CONNECTION'=>'pgsql','DB_DATABASE'=>$database,'DB_URL'=>'','CACHE_STORE'=>'array','QUEUE_CONNECTION'=>'sync','SESSION_DRIVER'=>'array'] as $key=>$value){putenv($key.'='.$value);$_ENV[$key]=$value;$_SERVER[$key]=$value;}
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\{Artisan,DB};
if(config('database.default')!=='pgsql' || config('database.connections.pgsql.database')!==$database || DB::selectOne('SELECT current_database() AS name')->name!==$database)throw new RuntimeException('Disposable database guard failed.');
Artisan::call('migrate',['--force'=>true]);
$proof=['database'=>$database,'migrations'=>DB::table('migrations')->count(),'samples'=>[]];
foreach([100000,1000000] as $size){
    $existing=(int)DB::table('competition_ratings')->count();$start=microtime(true);
    DB::statement("INSERT INTO competition_ratings (system,participant_id,rating,deviation,volatility,achievement,score,games,geography_path) SELECT 'HGR', n, 1500, 100, 0.06, n%1000, n%1000, 10, '[]'::json FROM generate_series(CAST(? AS BIGINT),CAST(? AS BIGINT)) AS n",[$existing+1,$size]);
    $insert=microtime(true)-$start;$memory=memory_get_usage(true);$start=microtime(true);
    $id=app(App\Services\CompetitionRankings::class)->snapshot('HGR','load:'.$size);
    $rows=(int)DB::table('competition_ranking_snapshot_rows')->where('snapshot_id',$id)->count();
    if($rows!==$size)throw new RuntimeException('Snapshot lost ranking records.');
    $proof['samples'][]=['ratings'=>$size,'insert_seconds'=>round($insert,3),'snapshot_seconds'=>round(microtime(true)-$start,3),'snapshot_rows'=>$rows,'php_memory_delta'=>memory_get_usage(true)-$memory];
}
// Compile and execute the historical PostgreSQL JSON/window path independently of SQLite.
$historical=app(App\Services\CompetitionRankings::class)->snapshot('HGR','historical-empty',Carbon\CarbonImmutable::parse('2025-12-31T23:59:59Z'));
$proof['historical_empty_rows']=DB::table('competition_ranking_snapshot_rows')->where('snapshot_id',$historical)->count();
$proof['peak_php_bytes']=memory_get_peak_usage(true);
echo json_encode($proof,JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT).PHP_EOL;
