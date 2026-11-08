<?php
namespace App\Services;
use App\Models\{ClubTournament,CompetitionDefinition,CompetitionGeography,OnlineCatalog,OnlineClub,OwnedPlayerCard,User};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
class WorldPyramid {
 public function populate(int $perTier=4):array {
  abort_if($perTier<2||$perTier>8,422,'Use 2 to 8 founding clubs per region and tier.');$created=[];
  $countries=CompetitionGeography::where('kind','country')->where('eligible',true)->get();
  foreach(CompetitionGeography::where('kind','region')->orderBy('id')->get() as $region){
   $origins=$countries->filter(fn($c)=>in_array($region->id,$c->path(),true))->values();if($origins->isEmpty())continue;
   foreach(range(1,5) as $tier){
    $present=OnlineClub::where('is_bot',true)->where('tier',$tier)->whereIn('geography_id',$origins->pluck('id'))->count();
    for($n=$present;$n<$perTier;$n++)$created[]=DB::transaction(function()use($origins,$tier,$region,$n){
     $catalog=OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$key='pyramid:'.$region->id.':'.$tier.':'.$n;
     $brand=app(WorldClubIdentity::class)->make($key);$attempt=0;while(OnlineClub::where('name',$brand['name'])->exists())$brand=app(WorldClubIdentity::class)->make($key.':'.++$attempt);
     $user=User::create(['name'=>$brand['manager'],'email'=>Str::lower(Str::random(24)).'@world.hexatrick.invalid','password'=>Str::random(64)]);
     $club=app(OnlineService::class)->provision($user,true);$origin=$origins[($n+$tier)%$origins->count()];
     $identity=$brand['identity']+['country'=>$origin->code,'bio'=>$brand['name'].' competes from '.$origin->name.' in the Hexatrick club pyramid.'];
     $tag=strtoupper(substr(preg_replace('/[^A-Za-z]/','',$brand['name']),0,6).base_convert((string)$club->id,10,36));
     $club->update(['name'=>$brand['name'],'tag'=>substr($tag,0,12),'tier'=>$tier,'geography_id'=>$origin->id,'identity'=>$identity]);
     if($tier<5)foreach(OwnedPlayerCard::where('user_id',$user->id)->get() as $p){
      $profile=$p->world_profile;$ranges=[1=>[74,88],2=>[57,73],3=>[40,56],4=>[28,39]];[$min,$max]=$ranges[$tier];$hash=hash('sha256',$p->id.':established-tier:'.$tier);$stats=[];
      foreach(WorldPlayerProfiles::ATTRIBUTES as $i=>$attr)$stats[$attr]=$min+hexdec(substr($hash,$i*2,2))%($max-$min+1);
      $profile['stats']=$stats;$profile['source']='founding-tier-'.$tier;$profile['training_baseline']=$p->training_xp;$profile['potential']=max($max+3,$profile['potential']);$profile['wage']=(int)round(50*pow(array_sum($stats)/count($stats)/25,3));
      $p->update(['world_profile'=>$profile]);
     }
     $market=app(ClubMarketService::class);$balance=$market->balance($club->id);$capital=max(ClubMarketService::OPENING_BALANCE,$market->weeklyWages($club,$catalog)*20);
     if($capital>$balance)DB::table('club_money_entries')->insert(['club_id'=>$club->id,'amount'=>$capital-$balance,'kind'=>'Opening balance','reference'=>'world-foundation:'.$club->id,'created_at'=>now()]);
     DB::table('club_manager_history')->insert(['club_id'=>$club->id,'user_id'=>$user->id,'kind'=>'bot','starts_at'=>now()]);
     DB::table('world_media_personalities')->insertOrIgnore(['slug'=>'manager-'.$club->id,'name'=>$user->name,'role'=>'manager','style'=>'Club management','bio'=>$user->name.' manages '.$club->name.'.','profile'=>json_encode(['club_id'=>$club->id,'nationality'=>$origin->code])]);
     DB::table('competition_audits')->insert(['action'=>'world.founding-roster','subject'=>(string)$club->id,'details'=>json_encode(['tier'=>$tier,'profile_source'=>'founding-tier','no_earned_results'=>true]),'created_at'=>now()]);
     return ['id'=>$club->id,'tier'=>$tier];
    },3);
   }
  }
  return ['created'=>count($created),'by_tier'=>collect($created)->countBy('tier')->all()];
 }
 public function openWeek():array {
  $week=CarbonImmutable::now('Asia/Manila')->startOfWeek();if(now()->gte($week->addDays(2)->setTime(18,0)))$week=$week->addWeek();$events=[];
  $organizer=DB::table('competition_organizers')->where('slug','hexatrick')->value('id');if(!$organizer){app(CompetitionCalendar::class)->installDefaults();$organizer=DB::table('competition_organizers')->where('slug','hexatrick')->value('id');}
  foreach(CompetitionGeography::where('kind','region')->orderBy('id')->get() as $ri=>$region)foreach(range(1,5) as $tier){
   $definition=CompetitionDefinition::firstOrCreate(['slug'=>'ladder-'.strtolower($region->code).'-'.$tier],['organizer_id'=>$organizer,'name'=>$region->name.' Division '.$tier.' Trials','category'=>'tier_feeder','participant_type'=>'club','official'=>false,'ranked'=>true,'status'=>'approved','version'=>1,'rules'=>['tiers'=>[$tier],'geographies'=>[$region->id],'promotion_tier'=>max(1,$tier-1)],'schedule'=>['cadence'=>'weekly'],'sponsors'=>[]]);
   $event=DB::transaction(function()use($definition,$week,$tier,$region,$ri){
    $scope='ladder:'.$week->toDateString();$existing=ClubTournament::where('definition_id',$definition->id)->where('year',$week->year)->where('scope',$scope)->first();if($existing)return $existing;
    $start=$week->addDays(4)->setTime(18,0)->addHours(($ri*5+$tier-1)*2)->utc();
    $rules=['capacity'=>8,'minimum'=>2,'tiers'=>[$tier],'geographies'=>[$region->id],'stages'=>[['format'=>'single_elimination','advance'=>1]],'round_interval_hours'=>24,'fixture_interval_hours'=>1,
      'ladder'=>true,'promotion_tier'=>max(1,$tier-1),'circuit_points'=>[],'terms'=>'Free entry. Tier and geography eligibility apply. Verified champion earns promotion by one tier; Tier 1 champions retain Tier 1 and build a verified ranking record for regional entry. Real Nexus finishes and normal recovery rules apply. No invented qualification results.'];
    return ClubTournament::create(['definition_id'=>$definition->id,'year'=>$week->year,'scope'=>$scope,'name'=>$definition->name.' - '.$week->toDateString(),'tier'=>$tier,'participant_type'=>'club','capacity'=>8,'rules_version'=>1,'regulations'=>$rules,'qualification'=>[['key'=>'division-open','method'=>'open','slots'=>8]],'ranked'=>true,'accreditation'=>'verified_ranked','registration_opens_at'=>now(),'registration_closes_at'=>$week->addDays(2)->setTime(18,0)->utc(),'starts_at'=>$start,'ends_at'=>$week->addDays(13)->setTime(23,59)->utc(),'semifinals_at'=>$start,'final_at'=>$start->addDays(2),'champion_prize'=>0,'runner_up_prize'=>0,'status'=>'registration','sponsors'=>[]]);
   },3);
   $events[]=$event->id;
   $countries=CompetitionGeography::where('kind','country')->get()->filter(fn($c)=>in_array($region->id,$c->path(),true))->pluck('id');
   foreach(OnlineClub::where('is_bot',true)->where('tier',$tier)->whereIn('geography_id',$countries)->orderBy('id')->limit(4)->get() as $club){
    if(DB::table('club_tournament_entries')->where('tournament_id',$event->id)->where('club_id',$club->id)->exists())continue;
    try{app(CompetitionQualification::class)->enter($event->id,'club',$club->id,['method'=>'open','bot_fill'=>true]);}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){if(!in_array($e->getStatusCode(),[403,409,422]))throw $e;}
   }
  }
  return $events;
 }
 public function promote(ClubTournament $event,?int $clubId):void {
  if(!($event->regulations['ladder']??false)||!$clubId||$event->tier<=1)return;
  $club=OnlineClub::whereKey($clubId)->lockForUpdate()->firstOrFail();if($club->tier!==$event->tier)return;
  $inserted=DB::table('club_tier_movements')->insertOrIgnore(['club_id'=>$club->id,'tournament_id'=>$event->id,'from_tier'=>$club->tier,'to_tier'=>$club->tier-1,'earned_at'=>now()]);
  if($inserted){$club->update(['tier'=>$club->tier-1]);app(ClubOffice::class)->notify($club->id,'promotion:'.$event->id,'competition','Promotion earned','Your verified cup victory earned promotion to Tier '.$club->tier.'. The next division is now open to your club.',['type'=>'route','route'=>'play?competitions=circuit']);}
 }
}
