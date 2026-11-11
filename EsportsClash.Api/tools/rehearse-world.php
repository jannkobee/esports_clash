<?php
/** Isolated, seeded virtual-clock economic/career rehearsal. NEVER loads a persistent DB. */
declare(strict_types=1);

$options=getopt('',['seed:','days:','clubs:','human-percent:']);
$seed=(int)($options['seed']??41);$days=(int)($options['days']??90);$clubs=(int)($options['clubs']??12);$humanPercent=(int)($options['human-percent']??25);
if($days<1||$days>3653||$clubs<2||$clubs>1000||$humanPercent<0||$humanPercent>100){fwrite(STDERR,"Use 1–3653 days, 2–1000 clubs and 0–100 human percent.\n");exit(2);}
$root=dirname(__DIR__);
if(is_file($root.'/bootstrap/cache/config.php')){fwrite(STDERR,"Refusing a cached application configuration; use an isolated uncached checkout.\n");exit(2);}
foreach(['APP_ENV'=>'testing','APP_KEY'=>'base64:'.base64_encode(str_repeat('r',32)),'DB_CONNECTION'=>'sqlite','DB_DATABASE'=>':memory:','DB_URL'=>'','CACHE_STORE'=>'array','QUEUE_CONNECTION'=>'sync','SESSION_DRIVER'=>'array','BCRYPT_ROUNDS'=>'4'] as $key=>$value){putenv($key.'='.$value);$_ENV[$key]=$value;$_SERVER[$key]=$value;}
require $root.'/vendor/autoload.php';
$app=require $root.'/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function(Throwable $e):void{fwrite(STDERR,substr($e->getMessage(),0,1000).PHP_EOL);exit(1);});
if(config('database.default')!=='sqlite'||config('database.connections.sqlite.database')!==':memory:')throw new LogicException('Refusing a persistent database.');
use Illuminate\Support\Facades\{Artisan,DB,Http,Queue};
use App\Models\{ClubAuction,OnlineClub,OwnedPlayerCard,User};
use App\Services\{BotClubManager,ClubMarketService,CompetitionCalendar,LivingWorldEngine,OnlineService,StaffContracts,WorldAgents,WorldBusinessEngine,WorldCareerContracts,WorldCareers,WorldSponsorships};

Http::preventStrayRequests();Queue::fake();$serial=0;
Illuminate\Support\Str::createUuidsUsing(function()use($seed,&$serial){return Ramsey\Uuid\Uuid::uuid5(Ramsey\Uuid\Uuid::NAMESPACE_URL,'rehearsal:'.$seed.':'.++$serial);});
$start=Carbon\CarbonImmutable::create(max(2027,(int)config('competitions.inaugural_year')),1,1,8,0,0,'UTC');
Carbon\Carbon::setTestNow($start);Carbon\CarbonImmutable::setTestNow($start);$began=microtime(true);
Artisan::call('migrate',['--force'=>true]);Artisan::call('online:install-catalog');
app(CompetitionCalendar::class)->installDefaults();config(['world_players.enabled'=>true,'living_world.seconds_per_tick'=>15,'living_world.deterministic_rehearsal'=>true]);
app(App\Services\WorldPlayerProfiles::class)->invalidate();$humanCount=(int)floor($clubs*$humanPercent/100);$ids=[];
for($i=0;$i<$clubs;$i++){
    $u=User::create(['name'=>'Rehearsal manager '.$i,'email'=>'rehearsal-'.$i.'@isolated.invalid','password'=>'rehearsal-only-no-login']);
    $c=app(OnlineService::class)->provision($u,$i>=$humanCount,false);$c->update(['tag'=>'R'.$i,'geography_id'=>DB::table('competition_geographies')->where('code','PH')->value('id')]);$ids[]=$c->id;
}
app(WorldSponsorships::class)->install();$years=[];$takeovers=0;$maxDue=0;
for($day=0;$day<$days;$day++){
    $time=$start->addDays($day);Carbon\Carbon::setTestNow($time);Carbon\CarbonImmutable::setTestNow($time);
    if(!isset($years[$time->year])){$years[$time->year]=app(CompetitionCalendar::class)->initialize($time->year,true);}
    // Core financial obligations continue independently. No Arena result or future live record
    // is fabricated: fixture execution belongs to the separately tested trusted Arena worker.
    foreach($ids as $id){$c=OnlineClub::findOrFail($id);app(StaffContracts::class)->expire($c);app(ClubMarketService::class)->payroll($c);}
    foreach(ClubAuction::where('status','open')->where('closes_at','<=',now())->limit(100)->pluck('id') as $id)app(ClubMarketService::class)->close($id);
    app(ClubMarketService::class)->expireTrades();app(WorldBusinessEngine::class)->obligations();
    if($day>0&&$day%30===0)foreach(OnlineClub::where('is_bot',false)->get() as $humanClub){
        // An explicit conservative human scenario policy, not unapproved live caretaker behavior.
        $market=app(ClubMarketService::class);
        if($market->balance($humanClub->id)<52*$market->weeklyWages($humanClub)){
            foreach(OwnedPlayerCard::where('user_id',$humanClub->user_id)->whereNotIn('id',array_column($humanClub->starters??[],'instance_id'))->limit(8)->get() as $reserve){
                try{$market->releaseReserve($humanClub,$reserve->id);}catch(Symfony\Component\HttpKernel\Exception\HttpException $e){if(!in_array($e->getStatusCode(),[409,422]))throw $e;}
            }
        }
    }
    $waves=max(1,(int)ceil(OnlineClub::where('is_bot',true)->count()/8));
    for($wave=0;$wave<$waves;$wave++){
        $slot=$time->addMinutes($wave*5);Carbon\Carbon::setTestNow($slot);Carbon\CarbonImmutable::setTestNow($slot);app(LivingWorldEngine::class)->tick();
    }
    // Reproducible human integration, using the real weak Tier-5 admission policy.
    if($day>0&&$day%30===0&&OnlineClub::where('is_bot',true)->exists()){
        $u=User::create(['name'=>'Joining manager '.$day,'email'=>'joining-'.$day.'@isolated.invalid','password'=>'rehearsal-only-no-login']);
        $before=OnlineClub::where('is_bot',true)->count();$adopted=app(OnlineService::class)->provision($u);$takeovers+=$before-OnlineClub::where('is_bot',true)->count();
        // This scenario's explicit human choice: stop optional inherited academy spending.
        // The live engine never makes that human decision without a granted permission.
        if($adopted->academy_opened_at)app(ClubMarketService::class)->setAcademy($adopted,false);
    }
    $maxDue=max($maxDue,OnlineClub::where('is_bot',true)->where(fn($q)=>$q->whereNull('world_review_at')->orWhere('world_review_at','<=',now()))->count());
}
$group=fn(string $table,string $field)=>DB::table($table)->select($field)->selectRaw('COUNT(*) AS total')->groupBy($field)->orderBy($field)->get()->toArray();
$metrics=['seed'=>$seed,'days'=>$days,'founding_clubs'=>$clubs,'clubs'=>OnlineClub::count(),'human_clubs'=>OnlineClub::where('is_bot',false)->count(),'bot_clubs'=>OnlineClub::where('is_bot',true)->count(),'takeovers'=>$takeovers,
    'calendar_years'=>array_keys($years),'annual_editions'=>DB::table('club_tournaments')->whereNotNull('definition_id')->count(),'nations_editions'=>DB::table('club_tournaments')->where('participant_type','national')->count(),
    'management_reviews'=>DB::table('club_world_turns')->count(),'meaningful_events'=>DB::table('club_world_events')->count(),'events_by_kind'=>$group('club_world_events','kind'),'negotiation_outcomes'=>$group('world_negotiations','status'),
    'professions'=>$group('world_agents','profession'),'employment_changes'=>DB::table('world_employments')->whereNotNull('ends_at')->count(),'career_memories'=>DB::table('world_agent_memories')->count(),
    'club_cash_minor_units'=>(int)DB::table('club_money_entries')->sum('amount'),'sponsor_available_minor_units'=>(int)DB::table('world_sponsor_entries')->sum('amount'),'maximum_due_clubs'=>$maxDue,
    'invalid_duplicate_employments'=>DB::table('world_employments')->whereNotNull('active_agent_id')->select('active_agent_id')->groupBy('active_agent_id')->havingRaw('COUNT(*) > 1')->get()->count(),
    'arena_results_created'=>DB::table('online_matches')->whereNotNull('result')->count(),'database'=>'isolated SQLite memory','provider_requests'=>0];
$metrics['reproducibility_hash']=hash('sha256',json_encode($metrics,JSON_THROW_ON_ERROR));$metrics['elapsed_seconds']=round(microtime(true)-$began,3);
echo json_encode($metrics,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES).PHP_EOL;
