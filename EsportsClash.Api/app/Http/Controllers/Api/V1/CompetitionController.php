<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\{ClubFixture, ClubTournament, CompetitionDefinition, CompetitionGeography, NationalTeam, OnlineClub, OwnedPlayerCard};
use App\Services\{CompetitionAdministration,CompetitionCalendar,CompetitionQualification,CompetitionRankings,NationalTeamService,OnlineService};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CompetitionController extends Controller
{
    public function directory(Request $r,\App\Services\TournamentDirectory $directory,CompetitionCalendar $calendar){
        $v=$r->validate(['year'=>'nullable|integer|min:2020|max:2200','all_years'=>'nullable|boolean','type'=>'nullable|in:club,national','q'=>'nullable|string|max:100','tier'=>'nullable|integer|between:1,5','phase'=>'nullable|in:upcoming,ongoing,finished,review,cancelled','sort'=>'nullable|in:lifecycle,starts_asc,starts_desc,ends_desc,name,prize','page'=>'nullable|integer|min:1|max:1000000','per_page'=>'nullable|integer|in:20,30,50']);
        if(!($v['all_years']??false))$v['year']=$v['year']??$calendar->year();else unset($v['year']);$page=$directory->page($v,$v['per_page']??30);
        return ['data'=>['items'=>$page->items(),'meta'=>['page'=>$page->currentPage(),'last_page'=>$page->lastPage(),'per_page'=>$page->perPage(),'total'=>$page->total()],'counts'=>$directory->counts($v),'years'=>ClubTournament::distinct()->orderByDesc('year')->pluck('year')]];
    }
    public function index(Request $r,CompetitionCalendar $calendar)
    {
        $v=$r->validate(['year'=>'nullable|integer|min:2020|max:2200','all_years'=>'nullable|boolean','type'=>'nullable|in:club,national','page'=>'nullable|integer|min:1|max:1000000','q'=>'nullable|string|max:100','tier'=>'nullable|integer|between:1,5','phase'=>'nullable|in:upcoming,ongoing,finished,review,cancelled','sort'=>'nullable|in:lifecycle,starts_asc,starts_desc,ends_desc,name,prize','per_page'=>'nullable|integer|in:20,30,50']);
        $filters=$v;if(!($v['all_years']??false))$filters['year']=$v['year']??$calendar->year();else unset($filters['year']);$directory=app(\App\Services\TournamentDirectory::class);
        return ['data'=>['year'=>$calendar->year(),'timezone'=>'UTC','inaugural_year'=>$calendar->settings()['inaugural_year'],'play_opens_at'=>$calendar->playOpens($v['year']??$calendar->year()),'annual_program'=>DB::table('competition_year_records')->where('year',$v['year']??$calendar->year())->first(['year','calendar_hash','published_at','play_opens_at']),
            'editions'=>$directory->page($filters,$v['per_page']??30),'lifecycle_counts'=>$directory->counts($filters),'available_years'=>ClubTournament::distinct()->orderByDesc('year')->pluck('year'),
            'definitions'=>CompetitionDefinition::where('status','approved')->orderBy('name')->limit(100)->get(),
            'windows'=>DB::table('competition_windows')->where('year',$v['year']??$calendar->year())->orderBy('starts_at')->get(),
            'nations'=>NationalTeam::with('geography')->orderBy('name')->paginate(50,['*'],'nation_page'),
        ]];
    }
    public function show(int $id)
    {
        $e=ClubTournament::findOrFail($id);
        $stages=DB::table('competition_stages')->where('tournament_id',$id)->orderBy('position')->get()->map(function($s){$s->rules=json_decode($s->rules,true);$s->state=json_decode($s->state,true);return $s;});
        $entries=DB::table('club_tournament_entries as e')->leftJoin('online_clubs as c','c.id','=','e.club_id')->leftJoin('national_teams as n','n.id','=','e.national_team_id')
            ->where('e.tournament_id',$id)->select('e.*','c.name as club_name','n.name as national_name')->orderBy('e.seed')->limit(256)->get();
        $fixtures=ClubFixture::where('tournament_id',$id)->with(['homeClub:id,name','awayClub:id,name','homeNation:id,name','awayNation:id,name','match:id,status,result,spectator_ready,plan'])->orderBy('kickoff_at')->limit(200)->get()->map(fn($f)=>[
            'id'=>$f->id,'stage_id'=>$f->stage_id,'round'=>$f->round,'group'=>$f->group_key,'home'=>$f->homeClub?->name??$f->homeNation?->name,'away'=>$f->awayClub?->name??$f->awayNation?->name,
            'kickoff_at'=>$f->kickoff_at,'status'=>$f->hold_reason?'review':($f->match?->status??'scheduled'),
            'winner'=>$f->match?->result['winner']??null,'watch_id'=>$f->match?->canSpectate()?$f->match->id:null]);
        $results=DB::table('competition_results as r')->join('club_fixtures as f','f.id','=','r.fixture_id')->where('r.tournament_id',$id)->limit(10000)->get(['winner_entry_id','loser_entry_id','fixture_id','f.stage_id']);
        $tables=[];
        foreach($stages as $s){$ids=$s->state['entrants'];$rs=$results->filter(fn($x)=>$x->stage_id===$s->id)->map(fn($x)=>['winner'=>$x->winner_entry_id,'loser'=>$x->loser_entry_id])->all();
            $seeds=$entries->pluck('seed','id')->all();
            if($s->format==='groups')foreach($s->state['groups'] as $g=>$members)$tables[$s->id.':'.$g]=app(\App\Services\CompetitionPairing::class)->standings($members,$rs,$seeds);
            else $tables[$s->id]=app(\App\Services\CompetitionPairing::class)->standings($ids,$rs,$seeds,$s->state['byes']??[]);
        }
        return ['data'=>['talent'=>DB::table('fixture_talent_assignments as a')->join('world_media_personalities as t','t.id','=','a.talent_id')->whereIn('a.fixture_id',ClubFixture::where('tournament_id',$id)->select('id'))->distinct()->get(['t.id','t.name','t.role']),'edition'=>$e,'stages'=>$stages,'entries'=>$entries,'fixtures'=>$fixtures,'standings'=>$tables,
            'organizer'=>$e->definition_id?DB::table('competition_organizers')->find(CompetitionDefinition::find($e->definition_id)->organizer_id):null]];
    }
    public function rankings(Request $r,CompetitionRankings $ratings)
    {
        $d=$r->validate(['q'=>'nullable|string|max:100','tier'=>'nullable|integer|between:1,5','minimum_games'=>'nullable|integer|min:0|max:100000','system'=>'required|in:HGR,HNR','geography'=>'nullable|integer|exists:competition_geographies,id','page'=>'nullable|integer|min:1|max:1000000']);
        return ['data'=>$ratings->leaderboard($d['system'],$d['geography']??null,$d['page']??1,$d)];
    }
    public function geography() { return ['data'=>CompetitionGeography::orderBy('name')->orderBy('id')->get()]; }
    public function mine(Request $r,OnlineService $online)
    {
        $club=$online->provision($r->user());$year=now('UTC')->year;
        $terms=DB::table('national_manager_terms')->where('user_id',$r->user()->id)->orderByDesc('id')->limit(30)->get();
        return ['data'=>['club_id'=>$club->id,'admin'=>(bool)$r->user()->is_evolution_admin,
            'tier'=>$club->tier,'ranking_context'=>app(CompetitionRankings::class)->context($club->id),'rating'=>DB::table('competition_ratings')->where('system','HGR')->where('participant_id',$club->id)->first(),
            'circuit_points'=>(int)DB::table('competition_circuit_points')->where('club_id',$club->id)->where('year',$year)->sum('points'),
            'invitations'=>DB::table('competition_invitations')->where(fn($q)=>$q->where(fn($q)=>$q->where('participant_type','club')->where('participant_id',$club->id))
                ->orWhere(fn($q)=>$q->where('participant_type','national')->whereIn('participant_id',$terms->where('status','appointed')->pluck('national_team_id'))))->orderByDesc('id')->limit(50)->get(),
            'entries'=>DB::table('club_tournament_entries')->where('club_id',$club->id)->orderByDesc('id')->limit(50)->get(),
            'titles'=>ClubTournament::where('champion_id',$club->id)->where('status','completed')->where('ranked',true)->where('provenance','verified')->whereIn('accreditation',['official','verified_ranked','premier'])->orderByDesc('year')->limit(50)->get(['id','year','name']),
            'organizers'=>DB::table('competition_organizers')->where('user_id',$r->user()->id)->get(),
            'terms'=>$terms,'definitions'=>CompetitionDefinition::whereIn('organizer_id',DB::table('competition_organizers')->where('user_id',$r->user()->id)->select('id'))->get(),
        ]];
    }
    public function enter(Request $r,int $id,OnlineService $online,CompetitionQualification $q)
    {
        $e=ClubTournament::findOrFail($id);
        if($e->participant_type==='club')$participant=$online->provision($r->user())->id;
        else{$d=$r->validate(['national_team_id'=>'required|integer|exists:national_teams,id']);app(NationalTeamService::class)->authorizeManager($d['national_team_id'],$r->user()->id);$participant=$d['national_team_id'];}
        $q->enter($id,$e->participant_type,$participant,['method'=>'open']);return response()->noContent();
    }
    public function invitation(Request $r,int $id,CompetitionQualification $q)
    {
        $d=$r->validate(['accept'=>'required|boolean','attempt'=>'nullable|integer|min:1','slot_key'=>'nullable|string|max:100']);$q->respond($id,$d['accept'],$r->user()->id,$d['attempt']??null,$d['slot_key']??null);return response()->noContent();
    }
    public function nation(Request $r,int $id,NationalTeamService $service)
    {
        $team=NationalTeam::with('geography')->findOrFail($id);
        $manager=DB::table('national_manager_terms')->join('users','users.id','=','national_manager_terms.user_id')->where('national_team_id',$id)->where('national_manager_terms.status','appointed')->where('ends_at','>',now())->first(['national_manager_terms.id','users.name','starts_at','ends_at']);
        $page=(int)($r->validate(['page'=>'nullable|integer|min:1|max:1000000'])['page']??1);
        return ['data'=>['team'=>$team,'manager'=>$manager,'rating'=>DB::table('competition_ratings')->where('system','HNR')->where('participant_id',$id)->first(),
            'pool'=>$service->eligiblePool($id,$page),'squads'=>DB::table('national_squads')->where('national_team_id',$id)->orderByDesc('id')->limit(30)->get(['id','tournament_id','locked_at']),
            'fixtures'=>ClubFixture::where(fn($q)=>$q->where('home_national_team_id',$id)->orWhere('away_national_team_id',$id))->orderByDesc('kickoff_at')->limit(50)->get(),
            'titles'=>ClubTournament::where('national_champion_id',$id)->where('status','completed')->orderByDesc('year')->get(['id','name','year']),
        ]];
    }
    public function applyManager(Request $r,int $id)
    {
        NationalTeam::findOrFail($id);$d=$r->validate(['statement'=>'required|string|min:20|max:2000']);
        $rules=app(CompetitionCalendar::class)->settings()['manager_applications'];$date=now('UTC')->format('m-d');
        abort_if($date<$rules['opens']||$date>$rules['closes'],409,'National-manager applications are outside the published application period.');
        abort_if($r->user()->created_at->gt(now()->subDays($rules['minimum_account_days'])),422,'This account has not reached the published manager eligibility age.');
        abort_if(!$rules['allow_club_management']&&OnlineClub::where('user_id',$r->user()->id)->exists(),422,'This appointment policy does not permit simultaneous club management.');
        DB::transaction(function()use($r,$id,$d){NationalTeam::whereKey($id)->lockForUpdate()->firstOrFail();
            abort_if(DB::table('national_manager_terms')->where('national_team_id',$id)->where('user_id',$r->user()->id)->whereIn('status',['applied','appointed'])->exists(),409,'An application or term is already active.');
            DB::table('national_manager_terms')->insert(['national_team_id'=>$id,'user_id'=>$r->user()->id,'statement'=>$d['statement'],'status'=>'applied','created_at'=>now(),'updated_at'=>now()]);});
        return response()->noContent();
    }
    public function squad(Request $r,int $id,NationalTeamService $service)
    {
        $service->authorizeManager($id,$r->user()->id);
        $d=$r->validate(['edition_id'=>'required|integer|exists:club_tournaments,id','players'=>'required|array|min:5|max:26','players.*'=>'required|uuid|distinct',
            'lineup'=>'required|array|size:5','lineup.*.instance_id'=>'required|uuid|distinct','lineup.*.avatar_id'=>'required|string|distinct','captain_id'=>'nullable|uuid']);
        $service->saveSquad($id,$d['edition_id'],$d['players'],$d['lineup'],$d['captain_id']??null);
        DB::table('national_manager_terms')->where('national_team_id',$id)->where('user_id',$r->user()->id)->where('status','appointed')->update(['last_active_at'=>now()]);
        return response()->noContent();
    }
    public function resign(Request $r,int $id,NationalTeamService $service)
    {
        $service->authorizeManager($id,$r->user()->id);DB::table('national_manager_terms')->where('national_team_id',$id)->where('user_id',$r->user()->id)->where('status','appointed')->update(['status'=>'resigned','ends_at'=>now(),'updated_at'=>now()]);return response()->noContent();
    }
    public function organizerEditions(Request $r){
        $ids=DB::table('competition_organizers')->where('user_id',$r->user()->id)->pluck('id');
        $definitions=CompetitionDefinition::whereIn('organizer_id',$ids)->where('official',false)->pluck('id');
        return ['data'=>ClubTournament::whereIn('definition_id',$definitions)->orderByDesc('year')->orderByDesc('id')->limit(100)->get()];
    }
    public function organizer(Request $r)
    {
        $d=$r->validate(['name'=>'required|string|max:100','slug'=>'required|alpha_dash|max:100|unique:competition_organizers,slug']);
        $id=DB::table('competition_organizers')->insertGetId($d+['user_id'=>$r->user()->id,'created_at'=>now(),'updated_at'=>now()]);
        return response()->json(['data'=>['id'=>$id]],201);
    }
    public function definition(Request $r,CompetitionAdministration $admin)
    {
        $d=$r->validate(['organizer_id'=>'required|integer|exists:competition_organizers,id','slug'=>'required|alpha_dash|max:100|unique:competition_definitions,slug',
            'name'=>'required|string|max:100','category'=>'required|in:domestic_league,national_cup,regional,continental,international_club,independent,community,national_qualifier,national_continental,nations_cup',
            'participant_type'=>'required|in:club,national','rules'=>'required|array','schedule'=>'required|array','sponsors'=>'nullable|array|max:20','sponsors.*.name'=>'required|string|max:100']);
        $o=$admin->organizer($r->user(),$d['organizer_id']);abort_unless($o->status==='verified',403,'Organizer verification is required before submitting a definition.');
        $admin->validateRules($d['rules']);$definition=CompetitionDefinition::create($d);$admin->audit($r->user(),'definition.submitted',(string)$definition->id);
        return response()->json(['data'=>$definition],201);
    }
    public function reviseDefinition(Request $r,int $id,CompetitionAdministration $admin)
    {
        $d=$r->validate(['name'=>'required|string|max:100','rules'=>'required|array','schedule'=>'required|array','sponsors'=>'nullable|array|max:20','sponsors.*.name'=>'required|string|max:100']);
        DB::transaction(function()use($r,$id,$d,$admin){
            $definition=CompetitionDefinition::whereKey($id)->lockForUpdate()->firstOrFail();$admin->organizer($r->user(),$definition->organizer_id);
            if($definition->official)$admin->admin($r->user());$admin->validateRules($d['rules']);
            if($definition->official)foreach(['open','close','start','end'] as $date)abort_unless(isset($d['schedule'][$date])&&preg_match('/^\d{2}-\d{2}$/D',$d['schedule'][$date]),422,'Annual schedules require month-day open/close/start/end dates.');
            $definition->update($d+['version'=>$definition->version+1,'status'=>'draft','ranked'=>false]);
            $admin->audit($r->user(),'definition.revised',(string)$id,['version'=>$definition->version]);
        },3);return response()->noContent();
    }
    public function edition(Request $r,int $id,CompetitionAdministration $admin)
    {
        $d=$r->validate(['scope'=>'required|alpha_dash|max:80','opens_at'=>'required|date','closes_at'=>'required|date','starts_at'=>'required|date','ends_at'=>'required|date']);
        return response()->json(['data'=>$admin->createEdition($r->user(),CompetitionDefinition::findOrFail($id),$d)],201);
    }
    public function adminIndex(Request $r,CompetitionAdministration $admin,CompetitionCalendar $calendar)
    {
        $admin->admin($r->user());return ['data'=>['settings'=>$calendar->settings(),'organizers'=>DB::table('competition_organizers')->orderByDesc('id')->limit(100)->get(),
            'definitions'=>CompetitionDefinition::orderByDesc('id')->limit(100)->get(),'applications'=>DB::table('national_manager_terms')->where('status','applied')->orderBy('id')->limit(100)->get(),
            'review'=>ClubTournament::where('status','review')->limit(100)->get(),'audits'=>DB::table('competition_audits')->orderByDesc('id')->limit(50)->get(),
            'pending_jobs'=>DB::table('jobs')->where('queue','competitions')->count(),'failed_jobs'=>DB::table('failed_jobs')->where('queue','competitions')->count()]];
    }
    public function configure(Request $r,CompetitionAdministration $admin)
    {
        $admin->admin($r->user());$d=$r->validate(['inaugural_year'=>'required|integer|min:2026|max:2200','enabled'=>'required|boolean',
            'skill_weight'=>'required|numeric|min:0|max:1','achievement_weight'=>'required|numeric|min:0|max:1','recovery_hours'=>'required|integer|min:1|max:168',
            'international_windows'=>'sometimes|array|max:20','international_windows.*'=>'array|size:2']);
        abort_if(abs($d['skill_weight']+$d['achievement_weight']-1)>0.000001,422,'Ranking weights must sum to one.');
        DB::table('competition_settings')->updateOrInsert(['id'=>1],['settings'=>json_encode($d),'created_at'=>now(),'updated_at'=>now()]);$admin->audit($r->user(),'calendar.configured','settings',$d);return response()->noContent();
    }
    public function moderation(Request $r,CompetitionAdministration $admin)
    {
        $admin->admin($r->user());$d=$r->validate(['kind'=>'required|in:organizer,definition,manager,edition','id'=>'required|integer','decision'=>'required|in:approve,reject,resume','ranked'=>'sometimes|boolean','days'=>'sometimes|integer|min:1|max:730']);
        DB::transaction(function()use($r,$admin,$d){
            if($d['kind']==='organizer')DB::table('competition_organizers')->where('id',$d['id'])->update(['status'=>$d['decision']==='approve'?'verified':'rejected','category'=>$d['decision']==='approve'?'verified_ranked':'community','updated_at'=>now()]);
            elseif($d['kind']==='definition'){$def=CompetitionDefinition::whereKey($d['id'])->lockForUpdate()->firstOrFail();$admin->validateRules($def->rules);$def->update(['status'=>$d['decision']==='approve'?'approved':'rejected','ranked'=>$d['decision']==='approve'&&($d['ranked']??false)]);}
            elseif($d['kind']==='manager'){
                $term=DB::table('national_manager_terms')->find($d['id']);abort_unless($term,404);NationalTeam::whereKey($term->national_team_id)->lockForUpdate()->firstOrFail();
                abort_unless($term->status==='applied'&&in_array($d['decision'],['approve','reject'],true),409,'Only a pending application can be appointed or rejected.');
                if($d['decision']==='approve'){
                    DB::table('national_manager_terms')->where('national_team_id',$term->national_team_id)->where('status','appointed')->update(['status'=>'replaced','ends_at'=>now(),'updated_at'=>now()]);
                    DB::table('national_manager_terms')->where('id',$term->id)->update(['status'=>'appointed','starts_at'=>now(),'ends_at'=>now()->addDays($d['days']??app(CompetitionCalendar::class)->settings()['manager_applications']['tenure_days']),'last_active_at'=>now(),'updated_at'=>now()]);
                }else DB::table('national_manager_terms')->where('id',$term->id)->update(['status'=>'rejected','updated_at'=>now()]);
            }else{abort_unless($d['decision']==='resume',422);$e=ClubTournament::whereKey($d['id'])->lockForUpdate()->firstOrFail();abort_unless($e->definition_id && $e->status==='review',409);abort_if($e->fixtures()->whereNotNull('hold_reason')->exists()||$e->fixtures()->whereHas('match',fn($q)=>$q->where('status','failed'))->exists(),409,'Resolve held/failed fixture causes before resuming.');$e->update(['status'=>$e->frozen_at?'active':'registration']);}
            $admin->audit($r->user(),'moderation.'.$d['decision'],$d['kind'].':'.$d['id'],$d);
        },3);return response()->noContent();
    }
    public function createGeography(Request $r,CompetitionAdministration $admin)
    {
        $d=$r->validate(['code'=>['required','alpha_dash','max:20',\Illuminate\Validation\Rule::unique('competition_geographies','code')->where('kind',$r->input('kind'))],'name'=>'required|string|max:100','kind'=>'required|in:continent,region,country,subregion','parent_id'=>'nullable|integer|exists:competition_geographies,id','timezone'=>'required|timezone']);
        return ['data'=>$admin->geography($r->user(),$d)];
    }
    public function verifyNationality(Request $r,CompetitionAdministration $admin)
    {
        $admin->admin($r->user());$d=$r->validate(['player_id'=>'required|uuid|exists:owned_player_cards,id','geography_id'=>'required|integer|exists:competition_geographies,id','evidence'=>'required|string|min:5|max:255']);
        abort_unless(CompetitionGeography::findOrFail($d['geography_id'])->kind==='country',422,'Nationality must refer to a country.');
        DB::table('player_national_eligibilities')->insertOrIgnore($d+['verified_by'=>$r->user()->id,'verified_at'=>now()]);$admin->audit($r->user(),'nationality.verified',$d['player_id'],$d);return response()->noContent();
    }
    public function initialize(Request $r,CompetitionAdministration $admin,CompetitionCalendar $calendar)
    {
        $admin->admin($r->user());$d=$r->validate(['partial'=>'required|boolean']);$ids=$calendar->initialize($calendar->year(),$d['partial']);$admin->audit($r->user(),'calendar.initialized',(string)$calendar->year(),['editions'=>$ids]);return ['data'=>$ids];
    }
    public function qualifiers(Request $r,int $id,CompetitionAdministration $admin)
    {
        $admin->admin($r->user());$d=$r->validate(['geography_id'=>'required|integer|exists:competition_geographies,id','group_size'=>'required|integer|min:4|max:256']);
        $ids=app(\App\Services\CompetitionQualifiers::class)->build($id,$d['geography_id'],$d['group_size']);$admin->audit($r->user(),'qualifiers.published',(string)$id,['editions'=>$ids]);return ['data'=>$ids];
    }
    public function funding(Request $r,int $id,CompetitionAdministration $admin,OnlineService $online)
    {
        $d=$r->validate(['champion_prize'=>'required|integer|min:0|max:100000000','runner_up_prize'=>'required|integer|min:0|max:100000000']);
        DB::transaction(function()use($r,$id,$d,$admin,$online){
            \App\Models\OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();
            $event=ClubTournament::whereKey($id)->lockForUpdate()->firstOrFail();abort_unless($event->definition_id&&$event->participant_type==='club'&&$event->status==='registration',409,'Only new club events can receive a funded prize pool.');
            $admin->organizer($r->user(),CompetitionDefinition::findOrFail($event->definition_id)->organizer_id);
            abort_if($event->champion_prize+$event->runner_up_prize>0,409,'A funded prize pool is immutable.');
            $club=$online->provision($r->user());$total=$d['champion_prize']+$d['runner_up_prize'];
            abort_if(app(\App\Services\ClubMarketService::class)->balance($club->id)<$total,422,'Insufficient funds to escrow the published prizes.');
            DB::table('club_money_entries')->insert(['club_id'=>$club->id,'amount'=>-$total,'kind'=>'Tournament prize escrow','reference'=>'competition:'.$id.':funding','created_at'=>now()]);
            $event->update($d);$admin->audit($r->user(),'prizes.funded',(string)$id,$d+['club_id'=>$club->id]);
        },3);return response()->noContent();
    }
    public function populate(Request $r,CompetitionAdministration $admin)
    {
        $admin->admin($r->user());$d=$r->validate(['target'=>'required|integer|min:0|max:10000']);
        abort_unless(app(\App\Services\LivingWorldEngine::class)->managementAllowed(),409,'Bot management has retired.');
        \App\Jobs\PopulateBotClubs::dispatch($d['target'],true);$admin->audit($r->user(),'bots.population-requested','world',$d);return response()->json(['data'=>['queued'=>true,'target'=>$d['target']]],202);
    }
    public function wildcard(Request $r,int $id,CompetitionAdministration $admin,CompetitionQualification $qualification)
    {
        $d=$r->validate(['participant_id'=>'required|integer|min:1','path_key'=>'required|string|max:80','slot'=>'required|integer|min:1|max:256']);
        DB::transaction(function()use($r,$id,$d,$admin,$qualification){
            $event=ClubTournament::whereKey($id)->lockForUpdate()->firstOrFail();abort_unless($event->definition_id&&$event->status==='registration'&&$event->registration_closes_at->isFuture(),409);
            $admin->organizer($r->user(),CompetitionDefinition::findOrFail($event->definition_id)->organizer_id);
            $path=collect($event->qualification)->firstWhere('key',$d['path_key']);abort_unless($path && $path['method']==='wildcard' && $d['slot']<=$path['slots'],422,'Only a published wildcard slot can be used.');
            $qualification->eligible($event,$event->participant_type,$d['participant_id']);
            app(\App\Services\CompetitionInvitations::class)->issue($event,$path['key'].':'.$d['slot'],$d['participant_id'],['method'=>'wildcard','path'=>$path,'slot'=>$d['slot']]);
            $admin->audit($r->user(),'wildcard.invited',(string)$id,$d);
        },3);return response()->noContent();
    }
    public function invitationSlots(Request $r,int $id,CompetitionAdministration $admin)
    {
        $event=ClubTournament::findOrFail($id);abort_unless($event->definition_id,404);
        $admin->organizer($r->user(),CompetitionDefinition::findOrFail($event->definition_id)->organizer_id);
        $current=DB::table('competition_invitations')->where('tournament_id',$id)->orderByRaw("CASE WHEN status='accepted' OR (status='pending' AND expires_at>?) THEN 1 ELSE 0 END",[now()])->orderBy('updated_at')->orderBy('id')->get()->keyBy('slot_key');
        $history=DB::table('competition_invitation_history')->where('tournament_id',$id)->orderByDesc('id')->limit(1000)->get();
        $clubs=\App\Models\OnlineClub::whereIn('id',$history->where('participant_type','club')->pluck('participant_id')->merge($current->where('participant_type','club')->pluck('participant_id')))->pluck('name','id');
        $nations=\App\Models\NationalTeam::whereIn('id',$history->where('participant_type','national')->pluck('participant_id'))->pluck('name','id');
        $slots=[];
        foreach($event->qualification??[] as $path){if($path['method']!=='wildcard')continue;
            for($n=1;$n<=$path['slots'];$n++){$key=$path['key'].':'.$n;$i=$current[$key]??null;
                $status=$i?->status??'available';if($status==='pending'&&\Carbon\CarbonImmutable::parse($i->expires_at)->lte(now()))$status='expired';
                $slots[]=['key'=>$key,'path'=>$path['key'],'number'=>$n,'status'=>$status,'available'=>$event->status==='registration'&&$event->registration_closes_at->isFuture()&&!in_array($status,['pending','accepted'],true),
                    'team'=>$i?($i->participant_type==='club'?($clubs[$i->participant_id]??'Archived club'):($nations[$i->participant_id]??'National team')):null];
            }
        }
        return ['data'=>['slots'=>$slots,'history'=>$history->take(100)->map(fn($i)=>['slot'=>$i->slot_key,'attempt'=>$i->attempt,'status'=>$i->status,
            'team'=>$i->participant_type==='club'?($clubs[$i->participant_id]??'Archived club'):($nations[$i->participant_id]??'National team'),'date'=>\Carbon\CarbonImmutable::parse($i->recorded_at)->toIso8601String()])]];
    }
    public function withdraw(Request $r,int $id,OnlineService $online)
    {
        $club=$online->provision($r->user());
        DB::transaction(function()use($id,$club){$event=ClubTournament::whereKey($id)->lockForUpdate()->firstOrFail();abort_if($event->status!=='registration'||$event->registration_closes_at->lte(now()),409,'Roster lock prevents withdrawal.');
            DB::table('club_tournament_entries')->where('tournament_id',$id)->where('club_id',$club->id)->update(['status'=>'withdrawn']);
            foreach(DB::table('competition_invitations')->where('tournament_id',$id)->where('participant_type','club')->where('participant_id',$club->id)->where('status','accepted')->get() as $invite)app(\App\Services\CompetitionInvitations::class)->transition($invite->id,'withdrawn');});
        return response()->noContent();
    }
}
