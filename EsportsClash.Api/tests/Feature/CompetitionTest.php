<?php
namespace Tests\Feature;

use App\Jobs\LockClubFixture;
use App\Models\{ClubFixture,ClubTournament,CompetitionDefinition,NationalTeam,OnlineCatalog,OnlineClub,OnlineMatch,OwnedPlayerCard,User};
use App\Services\{BotPopulationService,CompetitionAdministration,CompetitionCalendar,CompetitionEngine,CompetitionPairing,CompetitionQualification,CompetitionRankings,GlickoRating,NationalTeamService,OnlineService,WorldPlayerIdentity};
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB,Queue};
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CompetitionTest extends TestCase
{
    use RefreshDatabase;
    protected function setUp():void {parent::setUp();Queue::fake();$this->travelTo(CarbonImmutable::parse('2027-01-01T00:00:00Z'));$this->artisan('online:install-catalog')->assertSuccessful();app(CompetitionCalendar::class)->installDefaults();}
    private function owner():User {$u=User::factory()->create();$u->forceFill(['is_evolution_admin'=>true])->save();return $u;}
    private function club():OnlineClub {$u=User::factory()->create();$c=app(OnlineService::class)->provision($u);$c->update(['tag'=>'T'.$c->id]);return $c;}
    private function event(string $format='single_elimination',int $size=8,array $stages=[]):ClubTournament {
        $d=CompetitionDefinition::where('slug','vanguard-cup')->firstOrFail();
        $rules=['capacity'=>$size,'minimum'=>$size,'stages'=>$stages?:[['format'=>$format,'advance'=>1]],'qualification'=>[['key'=>'open','method'=>'open','slots'=>$size]]];
        return ClubTournament::create(['definition_id'=>$d->id,'scope'=>'test-'.uniqid(),'name'=>'Test Cup 2027','year'=>2027,'tier'=>null,'participant_type'=>'club','capacity'=>$size,'rules_version'=>1,'regulations'=>$rules,'qualification'=>$rules['qualification'],'sponsors'=>[],
            'registration_opens_at'=>now()->subDay(),'registration_closes_at'=>now()->addDay(),'starts_at'=>now()->addDays(2),'ends_at'=>now()->addMonths(2),'semifinals_at'=>now()->addDays(2),'final_at'=>now()->addMonths(2),'champion_prize'=>0,'runner_up_prize'=>0]);
    }
    private function enter(ClubTournament $e,int $count):array {$ids=[];for($i=0;$i<$count;$i++){$c=$this->club();app(CompetitionQualification::class)->enter($e->id,'club',$c->id,['method'=>'open']);$ids[]=$c->id;}return $ids;}
    private function fpsResult(OnlineMatch $match): array {
        $playerStats=[];$performance=[];
        foreach(['blue','red'] as $side)foreach($match->plan[$side] as $slot){$id=$slot['instance_id'];
            $playerStats[$id]=['playerId'=>$id,'name'=>$match->plan['player_identities'][$id]??'Alias','team'=>$side,
                'kills'=>1,'deaths'=>0,'assists'=>0,'damage'=>100,'adr'=>6.25,'headshotRate'=>30,'plants'=>0,'defuses'=>0,
                'firstBloods'=>0,'tradeKills'=>0,'clutchesWon'=>0,'setPiecesInvolved'=>0];
            $performance[]=['instance_id'=>$id,'team'=>$side,'kills'=>1,'deaths'=>0,'assists'=>0,'damage'=>100,'adr'=>6.25,
                'headshot_rate'=>30,'plants'=>0,'defuses'=>0,'first_bloods'=>0,'trade_kills'=>0,'clutches_won'=>0,'set_pieces_involved'=>0];
        }
        $rounds=[];for($round=1;$round<=16;$round++)$rounds[]=['roundNumber'=>$round,'winnerTeam'=>'blue','winnerSide'=>'attackers',
            'reason'=>'attackers_eliminated','roundDurationSeconds'=>75,'blueScoreAfter'=>$round,'redScoreAfter'=>0];
        return ['match_id'=>$match->id,'game_mode'=>'fps_mr15_v1','seed'=>$match->plan['seed'],'versions'=>$match->plan['versions'],'winner'=>'blue',
            'report'=>['format'=>'MR15_TACTICAL_FPS','simulationVersion'=>2,'winner'=>'blue','winnerTeam'=>'blue','seed'=>$match->plan['seed'],
                'mapId'=>$match->plan['fps']['map_id'],'totalRounds'=>16,'durationSeconds'=>1200,'finalScore'=>['blue'=>16,'red'=>0],
                'roundResults'=>$rounds,'playerStats'=>$playerStats,'events'=>[]],
            'player_performance'=>$performance];
    }
    private function settleFixture(ClubFixture $f):void {
        $this->travelTo($f->kickoff_at);(new LockClubFixture($f->id))->handle(app(OnlineService::class));$f->refresh();$this->assertNull($f->hold_reason);$match=$f->match;$this->assertNotNull($match);
        $result=$this->fpsResult($match);
        app(OnlineService::class)->settle($match->id,$result,2400);
        app(OnlineService::class)->settle($match->id,$result,2400);
    }
    public function test_real_year_rollover_leap_dates_and_midyear_launch():void {
        $c=app(CompetitionCalendar::class);$this->assertSame(2027,$c->year());$this->assertCount(22,$c->initialize(2027));$this->assertCount(22,$c->initialize(2027));$this->assertDatabaseCount('club_tournaments',22);
        $this->assertSame('2028-02-29',$c->date(2028,'02-29 18:00')->format('Y-m-d'));
        $this->travelTo(CarbonImmutable::parse('2027-12-31T23:59:59Z'));$this->assertSame(2027,$c->year());
        $this->travelTo(CarbonImmutable::parse('2028-01-01T00:00:00Z'));$this->assertSame(2028,$c->year());$this->assertCount(22,$c->initialize(2028));
        $this->assertDatabaseCount('club_tournaments',44);
        $this->travelTo(CarbonImmutable::parse('2029-08-01T00:00:00Z'));$this->assertCount(0,$c->initialize(2029));$this->assertCount(2,$c->initialize(2029,true));
        $this->assertSame(2,ClubTournament::where('year',2029)->count());
    }
    public function test_future_year_cannot_be_advanced_early():void {$this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);app(CompetitionCalendar::class)->initialize(2028);}
    public function test_glicko_matches_the_published_reference_example():void {
        $r=app(GlickoRating::class)->update(['rating'=>1500,'deviation'=>200,'volatility'=>0.06],[['rating'=>1400,'deviation'=>30,'result'=>1],['rating'=>1550,'deviation'=>100,'result'=>0],['rating'=>1700,'deviation'=>300,'result'=>0]]);
        $this->assertEqualsWithDelta(1464.06,$r['rating'],0.02);$this->assertEqualsWithDelta(151.52,$r['deviation'],0.02);$this->assertEqualsWithDelta(0.059996,$r['volatility'],0.00001);
    }
    public function test_round_robin_and_swiss_have_no_duplicate_pairings():void {
        $p=app(CompetitionPairing::class);$seen=[];for($round=1;$round<=7;$round++)foreach($p->roundRobin(range(1,8),$round) as [$a,$b]){$key=min($a,$b).':'.max($a,$b);$this->assertArrayNotHasKey($key,$seen);$seen[$key]=true;}$this->assertCount(28,$seen);
        $played=[];for($r=0;$r<5;$r++){$draw=$p->swiss(range(1,16),$played);$this->assertCount(8,$draw['pairs']);foreach($draw['pairs'] as [$a,$b]){$key=min($a,$b).':'.max($a,$b);$this->assertArrayNotHasKey($key,$played);$played[$key]=true;}}
    }
    public function test_48_nation_format_advances_24_top_two_and_eight_third_places():void {
        $tables=[];for($g=0;$g<12;$g++)for($i=0;$i<4;$i++)$tables[$g][]=['id'=>$g*4+$i+1,'wins'=>3-$i,'losses'=>$i,'seed'=>$g*4+$i+1];
        $ids=app(CompetitionPairing::class)->groupAdvancers($tables,32);$this->assertCount(32,$ids);$this->assertCount(32,array_unique($ids));
        for($g=0;$g<12;$g++){$this->assertContains($g*4+1,$ids);$this->assertContains($g*4+2,$ids);}
        for($i=0;$i<32;$i+=2)$this->assertNotSame(intdiv($ids[$i]-1,4),intdiv($ids[$i+1]-1,4));
    }
    public function test_single_elimination_runs_shared_fixture_pipeline_and_rewards_once():void {
        $e=$this->event();$this->enter($e,8);$rules=$e->regulations;$rules['circuit_points']=['champion'=>1000,'finalist'=>600];$e->update(['regulations'=>$rules,'ranked'=>true,'accreditation'=>'official']);
        $this->travelTo($e->registration_closes_at);$engine=app(CompetitionEngine::class);
        for($tick=0;$tick<15 && $e->fresh()->status!=='completed';$tick++){$engine->advance($e->id);foreach($e->fixtures()->whereNull('match_id')->orderBy('kickoff_at')->get() as $f)$this->settleFixture($f);}
        $this->assertSame('completed',$e->fresh()->status);$this->assertDatabaseCount('competition_results',7);$this->assertDatabaseCount('competition_rating_events',14);
        $engine->advance($e->id);$this->assertDatabaseCount('competition_results',7);$this->assertDatabaseCount('competition_circuit_points',2);$this->assertDatabaseCount('club_training_sessions',70);
        $snapshot=app(CompetitionRankings::class)->snapshot('HGR','test-invitations');$before=DB::table('competition_ranking_snapshot_rows')->where('snapshot_id',$snapshot)->get()->toJson();
        DB::table('competition_ratings')->update(['score'=>1]);$this->assertSame($snapshot,app(CompetitionRankings::class)->snapshot('HGR','test-invitations'));$this->assertSame($before,DB::table('competition_ranking_snapshot_rows')->where('snapshot_id',$snapshot)->get()->toJson());
    }
    public function test_double_elimination_gives_every_nonchampion_two_losses():void {
        $e=$this->event('double_elimination',4);$this->enter($e,4);$this->travelTo($e->registration_closes_at);
        for($tick=0;$tick<20 && $e->fresh()->status!=='completed';$tick++){app(CompetitionEngine::class)->advance($e->id);foreach($e->fixtures()->whereNull('match_id')->orderBy('kickoff_at')->get() as $f)$this->settleFixture($f);}
        $this->assertSame('completed',$e->fresh()->status);$losses=DB::table('competition_results')->where('tournament_id',$e->id)->selectRaw('loser_entry_id, count(*) as losses')->groupBy('loser_entry_id')->get();
        $this->assertSame(3,$losses->filter(fn($r)=>(int)$r->losses===2)->count());
    }
    public function test_group_stage_and_knockout_progress_automatically():void {
        $e=$this->event('groups',8,[['format'=>'groups','groups'=>2,'advance'=>4],['format'=>'single_elimination','advance'=>1]]);$this->enter($e,8);$this->travelTo($e->registration_closes_at);
        for($tick=0;$tick<20 && $e->fresh()->status!=='completed';$tick++){app(CompetitionEngine::class)->advance($e->id);foreach($e->fixtures()->whereNull('match_id')->orderBy('kickoff_at')->get() as $f)$this->settleFixture($f);}
        $this->assertSame('completed',$e->fresh()->status);$this->assertDatabaseCount('competition_stages',2);$this->assertSame(15,DB::table('competition_results')->count());
    }
    public function test_bot_takeover_keeps_players_tournament_place_and_money():void {
        app(BotPopulationService::class)->populate(2);$bot=OnlineClub::where('is_bot',true)->orderBy('id')->first();$ids=OwnedPlayerCard::where('user_id',$bot->user_id)->pluck('id')->all();
        $e=$this->event();app(CompetitionQualification::class)->enter($e->id,'club',$bot->id,['method'=>'open','bot_fill'=>true]);
        $u=User::factory()->create();$club=app(OnlineService::class)->provision($u);$this->assertSame($bot->id,$club->id);$this->assertFalse($club->is_bot);
        $this->assertSame($ids,OwnedPlayerCard::where('user_id',$u->id)->pluck('id')->all());$this->assertDatabaseHas('club_tournament_entries',['club_id'=>$club->id,'tournament_id'=>$e->id]);$this->assertDatabaseCount('owned_player_cards',10);
        $this->assertSame(10,OwnedPlayerCard::distinct()->count('persona_name'));
    }
    public function test_human_registration_replaces_only_an_open_bot_filler():void {
        $human=$this->club();$e=$this->event('single_elimination',4);app(BotPopulationService::class)->populate(4);$this->assertSame(4,app(BotPopulationService::class)->fill($e->id));
        app(CompetitionQualification::class)->enter($e->id,'club',$human->id,['method'=>'open']);$this->assertDatabaseCount('club_tournament_entries',4);$this->assertDatabaseHas('club_tournament_entries',['club_id'=>$human->id,'tournament_id'=>$e->id]);
    }
    public function test_nationality_is_separate_from_club_and_squad_locks():void {
        $owner=$this->owner();$admin=app(CompetitionAdministration::class);
        $ph=\App\Models\CompetitionGeography::where('code','PH')->firstOrFail();
        $team=NationalTeam::where('geography_id',$ph->id)->first();$club=$this->club();$e=$this->event();$rules=$e->regulations;$rules['squad_size']=10;$e->update(['participant_type'=>'national','regulations'=>$rules]);
        $cards=OwnedPlayerCard::where('user_id',$club->user_id)->pluck('id')->all();foreach($cards as $id)DB::table('player_national_eligibilities')->insert(['player_id'=>$id,'geography_id'=>$ph->id,'evidence'=>'Verified test origin','verified_by'=>$owner->id,'verified_at'=>now()]);
        app(CompetitionQualification::class)->enter($e->id,'national',$team->id,['method'=>'open']);app(NationalTeamService::class)->saveSquad($team->id,$e->id,$cards,$club->lineup,$cards[0]);
        $this->assertSame(5,app(NationalTeamService::class)->eligiblePool($team->id)->total());$this->assertNull($club->geography_id);
        $this->travelTo($e->registration_closes_at);$this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);app(NationalTeamService::class)->saveSquad($team->id,$e->id,$cards,$club->lineup);
    }
    public function test_ranked_and_admin_mutations_require_authorization():void {
        Sanctum::actingAs(User::factory()->create());$this->getJson('/api/v1/competitions/admin')->assertForbidden();$this->postJson('/api/v1/competitions/admin/moderation',['kind'=>'definition','id'=>1,'decision'=>'approve','ranked'=>true])->assertForbidden();
        $this->getJson('/api/v1/competitions')->assertOk();$this->getJson('/api/v1/competitions/rankings?system=HGR')->assertOk();
    }
    public function test_ranking_invitation_rejection_rolls_down_a_frozen_snapshot():void {
        $e=$this->event('single_elimination',2);$clubs=[$this->club(),$this->club(),$this->club()];
        foreach($clubs as $i=>$club)DB::table('competition_ratings')->insert(['system'=>'HGR','participant_id'=>$club->id,'score'=>300-$i,'geography_path'=>'[]']);
        $paths=[['key'=>'ranked','method'=>'ranking','slots'=>2]];$rules=$e->regulations;$rules['qualification']=$paths;
        $e->update(['qualification'=>$paths,'regulations'=>$rules]);$q=app(CompetitionQualification::class);$q->generate($e->id);
        (new \App\Jobs\BuildCompetitionRankingSnapshot('HGR','edition:'.$e->id.':ranking'))->handle(app(CompetitionRankings::class));$q->generate($e->id);
        $this->assertDatabaseCount('competition_invitations',2);$invite=DB::table('competition_invitations')->where('participant_id',$clubs[0]->id)->first();
        $q->respond($invite->id,false,$clubs[0]->user_id);$q->generate($e->id);
        $this->assertDatabaseHas('competition_invitations',['participant_id'=>$clubs[2]->id,'slot_key'=>$invite->slot_key,'status'=>'pending']);
        $this->assertSame(2,DB::table('competition_invitations')->where('status','pending')->count());
        $replacement=DB::table('competition_invitations')->where('participant_id',$clubs[2]->id)->first();$q->respond($replacement->id,true,$clubs[2]->user_id);$q->respond($replacement->id,true,$clubs[2]->user_id);
        $this->assertDatabaseCount('club_tournament_entries',1);
    }
    public function test_unranked_matches_do_not_create_rankings():void {
        $e=$this->event('single_elimination',2);$this->enter($e,2);$this->travelTo($e->registration_closes_at);app(CompetitionEngine::class)->advance($e->id);
        foreach($e->fixtures()->get() as $f)$this->settleFixture($f);app(CompetitionEngine::class)->advance($e->id);
        $this->assertDatabaseCount('competition_ratings',0);$this->assertDatabaseCount('competition_rating_events',0);
    }
    public function test_national_fixtures_reuse_arena_and_never_change_club_rankings():void {
        $owner=$this->owner();app(BotPopulationService::class)->populate(18);
        $teams=NationalTeam::whereIn('geography_id',DB::table('player_national_eligibilities')->select('geography_id'))->orderBy('id')->limit(2)->get();$this->assertCount(2,$teams);
        $e=$this->event('single_elimination',2);$e->update(['participant_type'=>'national','ranked'=>true,'accreditation'=>'official','starts_at'=>CarbonImmutable::parse('2027-03-10T01:00:00Z'),'ends_at'=>CarbonImmutable::parse('2027-03-15T23:59:00Z')]);
        DB::table('competition_windows')->insert(['name'=>'Test international','year'=>2027,'starts_at'=>'2027-03-10 00:00:00','ends_at'=>'2027-03-15 23:59:00']);
        foreach($teams as $team)app(CompetitionQualification::class)->enter($e->id,'national',$team->id,['method'=>'open']);
        $this->travelTo($e->registration_closes_at);app(CompetitionEngine::class)->advance($e->id);
        foreach($e->fixtures()->get() as $f)$this->settleFixture($f);app(CompetitionEngine::class)->advance($e->id);
        $this->assertSame('completed',$e->fresh()->status);$this->assertDatabaseCount('international_appearances',10);$this->assertDatabaseCount('player_international_commitments',10);
        $this->assertSame(0,DB::table('competition_ratings')->where('system','HGR')->count());$this->assertSame(2,DB::table('competition_ratings')->where('system','HNR')->count());
    }
    public function test_shared_player_cannot_be_reserved_for_overlapping_matches():void {
        $clubs=[$this->club(),$this->club()];$ids=$clubs[0]->lineup;
        $a=ClubFixture::create(['home_club_id'=>$clubs[0]->id,'away_club_id'=>$clubs[1]->id,'competition'=>'Test','kickoff_at'=>now()->addDay(),'orders_close_at'=>now()->addHours(23)]);
        $b=ClubFixture::create(['home_club_id'=>$clubs[0]->id,'away_club_id'=>$clubs[1]->id,'competition'=>'Test','kickoff_at'=>now()->addDay()->addHour(),'orders_close_at'=>now()->addHours(24)]);
        app(NationalTeamService::class)->reserve($a,$ids);$this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);app(NationalTeamService::class)->reserve($b,$ids);
    }
    public function test_unique_identity_migration_preserves_contract_and_training():void {
        $club=$this->club();$first=OwnedPlayerCard::where('user_id',$club->user_id)->first();$copy=OwnedPlayerCard::create(['id'=>(string)\Illuminate\Support\Str::uuid(),'catalog_id'=>$first->catalog_id,'definition_id'=>$first->definition_id,'user_id'=>$club->user_id,'grant_key'=>'test-copy','training_xp'=>91]);
        $name=$first->persona_name;$report=app(WorldPlayerIdentity::class)->migrate();$this->assertSame(1,$report['new_identities']);$this->assertSame($name,$first->fresh()->persona_name);$this->assertNotSame($name,$copy->fresh()->persona_name);$this->assertSame(91,$copy->fresh()->training_xp);$this->assertSame($club->user_id,$copy->fresh()->user_id);
        $this->assertSame(0,app(WorldPlayerIdentity::class)->migrate()['assigned']);
    }
    public function test_million_club_qualifier_partition_is_bounded_and_exact():void {
        $before=memory_get_usage(true);$sizes=app(\App\Services\CompetitionQualifiers::class)->partition(1_000_000,128);
        $this->assertSame(1_000_000,array_sum($sizes));$this->assertLessThanOrEqual(128,max($sizes));$this->assertGreaterThanOrEqual(2,min($sizes));$this->assertLessThan(8*1024*1024,memory_get_usage(true)-$before);
        $this->assertSame(5_000_000,array_sum(app(\App\Services\CompetitionQualifiers::class)->partition(5_000_000,256)));
    }
    public function test_cancelled_funded_event_refunds_once():void {
        $e=$this->event('single_elimination',2);$club=$this->club();DB::table('club_money_entries')->insert(['club_id'=>$club->id,'amount'=>-100000,'kind'=>'Tournament prize escrow','reference'=>'competition:'.$e->id.':funding','created_at'=>now()]);$e->update(['status'=>'cancelled']);
        $a=app(CompetitionAdministration::class);$a->refundCancelled($e->id);$a->refundCancelled($e->id);$this->assertSame(0,(int)DB::table('club_money_entries')->sum('amount'));$this->assertDatabaseCount('club_money_entries',2);
    }
    public function test_year_finalization_reads_history_and_does_not_reset_ratings():void {
        $e=$this->event('single_elimination',2);$e->update(['ranked'=>true,'accreditation'=>'official']);$this->enter($e,2);$this->travelTo($e->registration_closes_at);app(CompetitionEngine::class)->advance($e->id);
        foreach($e->fixtures()->get() as $f)$this->settleFixture($f);app(CompetitionEngine::class)->advance($e->id);
        DB::table('competition_ratings')->update(['score'=>999]);$this->travelTo(CarbonImmutable::parse('2028-01-01T00:01:00Z'));
        $job=new \App\Jobs\FinalizeCompetitionYear(2027);$job->handle(app(CompetitionCalendar::class),app(CompetitionRankings::class));$job->handle(app(CompetitionCalendar::class),app(CompetitionRankings::class));
        $year=DB::table('competition_year_records')->where('year',2027)->first();$this->assertSame('finalized',$year->status);$this->assertSame(1,DB::table('competition_year_records')->count());
        $this->assertSame(0,DB::table('competition_ranking_snapshot_rows')->where('snapshot_id',$year->club_snapshot_id)->where('score',999)->count());$this->assertSame(2,DB::table('competition_ratings')->where('score',999)->count());
    }
    public function test_geographic_draw_limits_are_enforced():void {
        $paths=[];for($id=1;$id<=16;$id++)$paths[$id]=[$id%4];
        $groups=app(CompetitionPairing::class)->drawGroups(range(1,16),4,$paths,[0=>1,1=>1,2=>1,3=>1]);
        foreach($groups as $group){$this->assertCount(4,$group);$this->assertCount(4,array_unique(array_map(fn($id)=>$id%4,$group)));}
    }
    public function test_manager_application_appointment_and_resignation_keep_history():void {
        $owner=$this->owner();$applicant=User::factory()->create(['created_at'=>now()->subDays(8)]);$team=NationalTeam::firstOrFail();
        Sanctum::actingAs($applicant);$this->postJson('/api/v1/competitions/nations/'.$team->id.'/applications',['statement'=>'I will select eligible players and prepare legal Arena lineups.'])->assertNoContent();
        $term=DB::table('national_manager_terms')->first();Sanctum::actingAs($owner);$this->postJson('/api/v1/competitions/admin/moderation',['kind'=>'manager','id'=>$term->id,'decision'=>'approve'])->assertNoContent();
        app(NationalTeamService::class)->authorizeManager($team->id,$applicant->id);Sanctum::actingAs($applicant);$this->postJson('/api/v1/competitions/nations/'.$team->id.'/resign')->assertNoContent();
        $this->assertDatabaseHas('national_manager_terms',['id'=>$term->id,'status'=>'resigned']);$this->assertSame(1,DB::table('national_manager_terms')->count());
    }
    public function test_revised_definition_never_changes_published_edition_rules():void {
        $event=$this->event();$definition=CompetitionDefinition::findOrFail($event->definition_id);$version=$definition->version;
        Sanctum::actingAs($this->owner());$this->putJson('/api/v1/competitions/definitions/'.$definition->id,['name'=>$definition->name,'rules'=>$definition->rules,'schedule'=>$definition->schedule])->assertNoContent();
        $this->assertSame($version+1,$definition->fresh()->version);$this->assertSame('draft',$definition->fresh()->status);$this->assertSame(8,$event->fresh()->regulations['capacity']);$this->assertSame(1,$event->fresh()->rules_version);
    }
}
