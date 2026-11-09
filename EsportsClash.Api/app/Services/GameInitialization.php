<?php
namespace App\Services;
use App\Models\{OnlineCatalog,OnlineClub,OwnedPlayerCard,User};
use Illuminate\Support\Facades\{Artisan,Cache,DB,Hash,Http};

/** Resumable first admission. Never truncates a world or fabricates played results. */
class GameInitialization {
 public function run(string $email,string $password):array {
  abort_unless(filter_var($email,FILTER_VALIDATE_EMAIL)&&strlen($password)>0,422,'Provide the owner email and password through the private initializer input.');
  return Cache::lock('hexatrick:first-deployment:v1',900)->block(5,function()use($email,$password){
   $marker=DB::table('game_initializations')->where('key','world-v1')->first();
   if($marker){$owner=User::findOrFail($marker->owner_user_id);abort_unless(strcasecmp($owner->email,$email)===0,409,'This world already belongs to a different owner. Initialization never replaces an owner.');return ['already_initialized'=>true,...json_decode($marker->report,true)];}
   if(!OnlineCatalog::where('active',true)->exists())Artisan::call('online:install-catalog');
   $health=Http::connectTimeout(3)->timeout(10)->get(rtrim(config('online.worker_url'),'/').'/health')->throw()->json();
   abort_unless(($health['player_profile_schema']??0)===WorldPlayerProfiles::VERSION,409,'The match worker must support pinned world-player profiles before first admission.');
   $profile=DB::table('world_player_settings')->where('id',1)->value('profile_version');
   if((int)$profile!==WorldPlayerProfiles::VERSION){abort_if(OwnedPlayerCard::withoutGlobalScopes()->exists(),409,'Existing legacy players need a separately reviewed migration; the initializer will not reset them.');app(WorldRosterReset::class)->activate();}
   app(CompetitionCalendar::class)->installDefaults();app(WorldMedia::class)->install();
   $owner=DB::transaction(function()use($email,$password){
    $owner=User::where('email',$email)->lockForUpdate()->first();
    if(!$owner)$owner=User::create(['email'=>$email,'name'=>'Kobe','password'=>$password]);
    elseif(!Hash::check($password,$owner->password))$owner->forceFill(['password'=>$password]);
    $owner->forceFill(['is_game_owner'=>true,'is_evolution_admin'=>true,'supporter_level'=>'beacon','supporter_until'=>null,'supporter_trial_ends_at'=>null])->save();return $owner;
   },3);
   // The owner gets an additional normal starter club, without consuming a founding opponent.
   $hadClub=OnlineClub::where('user_id',$owner->id)->exists();$club=app(OnlineService::class)->provision($owner,false,false);
   if(!$hadClub){$identity=app(WorldClubIdentity::class)->make('owner:'.$owner->id)['identity']+['country'=>'PH','city'=>'Manila','motto'=>'Our club. Our climb.'];$club->update(['name'=>'Kobe Collective','tag'=>'KOBE'.strtoupper(base_convert((string)$club->id,10,36)),'identity'=>$identity,'tier'=>5,'geography_id'=>\App\Models\CompetitionGeography::where('code','PH')->value('id')]);}
   app(ClubMarketService::class)->balance($club->id);
   $population=app(WorldPyramid::class)->populate(4);$events=app(WorldPyramid::class)->openWeek();$talent=app(WorldTalent::class)->populate();app(CommunityCups::class)->tick();app(AnnualLaurels::class)->refresh(now('Asia/Manila')->year);
   $settings=app(CompetitionCalendar::class)->settings();$settings['enabled']=true;DB::table('competition_settings')->updateOrInsert(['id'=>1],['settings'=>json_encode($settings),'updated_at'=>now()]);
   $year=now('UTC')->year;if($year>=$settings['inaugural_year']&&!DB::table('competition_year_records')->where('year',$year)->exists())app(CompetitionCalendar::class)->initialize($year,true);
   $report=['owner_user_id'=>$owner->id,'owner_club_id'=>$club->id,'owner_level'=>'beacon','owner_unlimited'=>true,'founding_clubs_created'=>$population['created'],'division_trials'=>count($events),'talent_added'=>$talent,'catalog_id'=>app(OnlineService::class)->activeCatalog()->id,'starting_tier'=>5,'historical_results_created'=>0];
   DB::table('game_initializations')->insert(['key'=>'world-v1','owner_user_id'=>$owner->id,'report'=>json_encode($report),'completed_at'=>now()]);
   foreach($events as $id)\App\Jobs\ProcessCompetitionEdition::dispatch($id);
   return ['already_initialized'=>false,...$report];
  });
 }
}
