<?php
/** Explicitly isolated PostgreSQL lock/commit probe. Refuses the live database before bootstrap. */
declare(strict_types=1);
$database=getenv('DB_DATABASE')?:'';
if(!preg_match('/^hexatrick_career_acceptance_[a-z0-9_]+$/D',$database)||getenv('APP_ENV')!=='testing')throw new LogicException('This probe requires a separately created acceptance database and testing environment.');
foreach(['DB_URL'=>'','CACHE_STORE'=>'array','QUEUE_CONNECTION'=>'sync','SESSION_DRIVER'=>'array','BCRYPT_ROUNDS'=>'4'] as $k=>$v){putenv($k.'='.$v);$_ENV[$k]=$v;$_SERVER[$k]=$v;}
$root=dirname(__DIR__);if(!is_file($root.'/vendor/autoload.php')&&is_file(getcwd().'/vendor/autoload.php'))$root=getcwd();
require $root.'/vendor/autoload.php';$app=require $root.'/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function(Throwable $e):void{fwrite(STDERR,substr($e->getMessage(),0,1000).PHP_EOL);exit(1);});
if(config('database.default')!=='pgsql'||Illuminate\Support\Facades\DB::connection()->getDatabaseName()!==$database)throw new LogicException('Acceptance database identity check failed.');
use Illuminate\Support\Facades\{Artisan,DB,Schema,Http,Queue};
use App\Models\{ClubFixture,OnlineClub,OwnedPlayerCard,User};
use App\Services\{OnlineService,WorldAgents,WorldCareers,WorldCareerContracts,WorldSponsorships,WorldBusinessEngine,ClubMarketService};
Http::preventStrayRequests();Queue::fake();$mode=$argv[1]??'';
$check=function(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);};
if($mode==='prepare'){
    Artisan::call('migrate',['--force'=>true]);$check(OnlineClub::count()===0,'Acceptance database was not empty.');Artisan::call('online:install-catalog');app(App\Services\CompetitionCalendar::class)->installDefaults();config(['world_players.enabled'=>true]);app(App\Services\WorldPlayerProfiles::class)->invalidate();
    $owner=User::create(['name'=>'Probe bot owner','email'=>'probe-bot@isolated.invalid','password'=>'isolated-no-login-password']);$bot=app(OnlineService::class)->provision($owner,true,false);$bot->update(['tag'=>'LAST','geography_id'=>DB::table('competition_geographies')->where('code','PH')->value('id')]);
    foreach(['left','right'] as $name)User::create(['name'=>'Probe '.$name,'email'=>'probe-'.$name.'@isolated.invalid','password'=>'isolated-no-login-password']);
    $witness=app(OnlineService::class)->provision(User::create(['name'=>'Probe witness','email'=>'probe-witness@isolated.invalid','password'=>'isolated-no-login-password']),false,false);$witness->update(['tag'=>'WITNESS']);
    foreach([7,14,21] as $days)ClubFixture::create(['home_club_id'=>$bot->id,'away_club_id'=>$witness->id,'competition'=>'Isolated acceptance commitment','kickoff_at'=>now()->addDays($days),'orders_close_at'=>now()->addDays($days)->subMinutes(15)]);
    app(WorldCareers::class)->syncClub($bot);$players=OwnedPlayerCard::where('user_id',$bot->user_id)->orderBy('id')->get();$c=app(WorldCareerContracts::class);
    $signed=$c->offerPlayer($bot,$players[0],$c->baseWage($players[0])*3,26,'rotation','binding-player',true,(int)$bot->management_epoch);$c->evaluate($signed);
    $pending=$c->offerPlayer($bot,$players[1],$c->baseWage($players[1]),8,'rotation','pending-player',true,(int)$bot->management_epoch);
    $deal=app(WorldSponsorships::class)->offer($bot,'binding-sponsor',true,(int)$bot->management_epoch);app(WorldSponsorships::class)->respond($bot,$deal,'accept',true,(int)$bot->management_epoch);
    Schema::create('world_acceptance_probe',function($t){$t->integer('id')->primary();$t->json('state');});
    DB::table('world_acceptance_probe')->insert(['id'=>1,'state'=>json_encode(['club'=>$bot->id,'players'=>$players->pluck('id')->all(),'signed'=>$signed,'pending'=>$pending,'deal'=>$deal,'balance'=>app(ClubMarketService::class)->balance($bot->id),'fixtures'=>ClubFixture::count()])]);
    echo "Prepared isolated PostgreSQL career commitments.\n";
}elseif(in_array($mode,['left','right'],true)){
    config(['world_players.enabled'=>true]);app(App\Services\WorldPlayerProfiles::class)->invalidate();$u=User::where('email','probe-'.$mode.'@isolated.invalid')->firstOrFail();
    DB::transaction(function()use($u){DB::table('online_catalogs')->where('active',true)->lockForUpdate()->first();DB::select('SELECT pg_sleep(1)');app(OnlineService::class)->provision($u);},3);
    $check(Queue::pushed(App\Jobs\PopulateBotClubs::class)->count()===0,'A takeover spawned replacement bots.');echo "Completed competing admission.\n";
}elseif($mode==='assert'){
    $s=json_decode(DB::table('world_acceptance_probe')->where('id',1)->value('state'),true);$club=OnlineClub::findOrFail($s['club']);
    $ids=User::whereIn('email',['probe-left@isolated.invalid','probe-right@isolated.invalid'])->pluck('id');$clubs=OnlineClub::whereIn('user_id',$ids)->get();
    $check($clubs->count()===2,'Competing users did not receive exactly one club each.');$check($clubs->where('id',$club->id)->count()===1,'The last bot was not taken over exactly once.');
    $check(!$club->is_bot&&$club->management_epoch===2,'Management authority was not transferred once.');$check(OnlineClub::where('is_bot',true)->count()===0,'Replacement bot or unreconciled management remains.');
    $check(DB::table('living_world_runtime')->value('management_state')==='retired','Manager retirement was not durable.');
    $check(OwnedPlayerCard::where('user_id',$club->user_id)->orderBy('id')->pluck('id')->all()===$s['players'],'Roster identities changed.');
    $check(DB::table('world_negotiations')->where('id',$s['pending'])->value('status')==='authority_changed','Uncommitted bot intent survived takeover.');
    $check(DB::table('world_player_terms')->where('negotiation_id',$s['signed'])->whereNotNull('active_player_id')->exists(),'Binding employment was discarded.');
    $posted=(int)DB::table('club_money_entries')->where('club_id',$club->id)->where('reference','like','sponsor-deal:'.$s['deal'].':%')->sum('amount');
    $check(ClubFixture::count()===$s['fixtures'],'Fixture commitments changed.');$check(app(ClubMarketService::class)->balance($club->id)===$s['balance']+$posted,'Takeover changed club funds.');
    $future=now()->addDays(8);Carbon\Carbon::setTestNow($future);Carbon\CarbonImmutable::setTestNow($future);config(['living_world.enabled'=>false]);app(WorldBusinessEngine::class)->obligations();
    $check(app(ClubMarketService::class)->balance($club->id)>$s['balance'],'A binding sponsor payment stopped with manager retirement.');
    $check(DB::table('online_matches')->count()===0,'Acceptance created Arena results or matches.');
    echo json_encode(['concurrent_takeovers'=>'passed','preserved_roster'=>count($s['players']),'preserved_fixtures'=>$s['fixtures'],'binding_terms'=>'retained','old_bot_intent'=>'revoked','manager_retirement'=>'durable','payments_after_pause'=>'passed','arena_matches'=>0],JSON_PRETTY_PRINT).PHP_EOL;
}else throw new InvalidArgumentException('Use prepare, left, right or assert.');
