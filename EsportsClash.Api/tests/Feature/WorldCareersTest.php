<?php
namespace Tests\Feature;

use App\Models\{ClubFixture,OnlineClub,OwnedPlayerCard,User,WorldAgent};
use App\Services\{ClubMarketService,LivingWorldEngine,OnlineService,StaffContracts,WorldAgents,WorldBusinessEngine,WorldCareers,WorldCareerContracts,WorldDelegation,WorldSponsorships};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB,Http,Queue};
use Tests\TestCase;

class WorldCareersTest extends TestCase {
    use RefreshDatabase;
    protected function setUp():void {
        parent::setUp();Queue::fake();Http::preventStrayRequests();
        $this->travelTo(now()->setDate(2026,11,9)->setTime(8,0));
        DB::table('living_world_runtime')->update(['careers_activated_at'=>now()->subDay()]);
        $this->artisan('online:install-catalog')->assertSuccessful();
    }
    private function club(bool $bot=false):OnlineClub {
        $club=app(OnlineService::class)->provision(User::factory()->create(),$bot,false);$club->update(['tag'=>'T'.$club->id,'created_at'=>now()->subWeeks(2)]);return $club;
    }
    private function fund(OnlineClub $club,int $amount=20000000):void {DB::table('club_money_entries')->insert(['club_id'=>$club->id,'amount'=>$amount,'kind'=>'Isolated fixture capital','reference'=>'test:'.$club->id,'created_at'=>now()]);}
    private function player(OnlineClub $club):OwnedPlayerCard {return OwnedPlayerCard::where('user_id',$club->user_id)->firstOrFail();}
    private function exposure(OnlineClub $club,OnlineClub $opponent):void {
        foreach([7,14,21] as $days)ClubFixture::create(['home_club_id'=>$club->id,'away_club_id'=>$opponent->id,'competition'=>'Isolated fixture','kickoff_at'=>now()->addDays($days),'orders_close_at'=>now()->addDays($days)->subMinutes(15)]);
    }
    public function test_player_terms_require_consent_then_feed_the_real_wage_service():void {
        $club=$this->club();$p=$this->player($club);$terms=app(WorldCareerContracts::class);$base=$terms->baseWage($p);$before=app(ClubMarketService::class)->weeklyWages($club);
        $id=$terms->offerPlayer($club,$p,$base*3,26,'rotation','first-offer');
        $this->assertDatabaseHas('world_negotiations',['id'=>$id,'status'=>'pending']);$this->assertDatabaseCount('world_player_terms',0);
        $terms->evaluate($id);$this->assertDatabaseHas('world_negotiations',['id'=>$id,'status'=>'accepted']);
        $this->assertSame($before+$base*2,app(ClubMarketService::class)->weeklyWages($club));
        $terms->evaluate($id);$this->assertDatabaseCount('world_player_terms',1);$this->assertDatabaseCount('world_representation',1);
        $this->assertDatabaseHas('world_representation',['player_agent_id'=>WorldAgent::where('source_key','player:'.$p->id)->value('id')]);
        Http::assertNothingSent();
    }
    public function test_contextual_counteroffer_can_be_accepted_or_withdrawn():void {
        $club=$this->club();$p=$this->player($club);$service=app(WorldCareerContracts::class);$a=app(WorldAgents::class)->player($p);
        $traits=$a->traits;$traits['ambition']=.95;$traits['thrift']=.95;$traits['loyalty']=.05;$a->update(['traits'=>$traits]);
        $id=$service->offerPlayer($club,$p,$service->baseWage($p),4,'development','counter-scenario');$service->evaluate($id);
        $this->assertDatabaseHas('world_negotiations',['id'=>$id,'status'=>'countered']);
        $service->respond($club,$id,'accept_counter');$this->assertDatabaseHas('world_negotiations',['id'=>$id,'status'=>'accepted']);
        $id2=$service->offerPlayer($club,$p,$service->baseWage($p),4,'development','withdraw-scenario');$service->respond($club,$id2,'withdraw');
        $this->assertDatabaseHas('world_negotiations',['id'=>$id2,'status'=>'withdrawn']);
    }
    public function test_private_offers_are_idempotent_and_never_become_public_news():void {
        $club=$this->club();$p=$this->player($club);$c=app(WorldCareerContracts::class);$w=$c->baseWage($p);
        $id=$c->offerPlayer($club,$p,$w,8,'rotation','same-request');$this->assertSame($id,$c->offerPlayer($club,$p,$w,8,'rotation','same-request'));
        $this->assertDatabaseCount('world_negotiations',1);$this->assertDatabaseCount('club_world_events',0);$this->assertDatabaseCount('world_news_posts',0);
        $this->actingAs(User::findOrFail($club->user_id))->getJson('/api/v1/online/careers')->assertOk()->assertJsonPath('data.negotiations.0.id',$id);
        $other=$this->club();$this->actingAs(User::findOrFail($other->user_id))->postJson('/api/v1/online/careers/agreements/'.$id,['action'=>'withdraw'])->assertNotFound();
        $this->getJson('/api/v1/world/accounts/'.WorldAgent::where('source_key','player:'.$p->id)->value('wire_account_id'))->assertOk()->assertJsonMissingPath('data.career.traits')->assertJsonMissingPath('data.career.policy');
    }
    public function test_terms_continue_on_rolling_wages_when_optional_autonomy_is_paused():void {
        $club=$this->club();$p=$this->player($club);$s=app(WorldCareerContracts::class);$id=$s->offerPlayer($club,$p,$s->baseWage($p)*3,4,'rotation','rolling-case');$s->evaluate($id);
        $this->travel(29)->days();config(['living_world.enabled'=>false]);app(WorldBusinessEngine::class)->obligations();
        $this->assertDatabaseHas('world_player_terms',['negotiation_id'=>$id,'status'=>'rolling','active_player_id'=>$p->id]);
        $this->assertSame($s->baseWage($p)*3,$s->salary($p));$this->assertSame($club->user_id,$p->fresh()->user_id);
    }
    public function test_payroll_only_accrues_negotiated_increment_for_actual_elapsed_time():void {
        $this->travelTo(now()->setDate(2026,11,5)->setTime(0,0));$club=$this->club();$p=$this->player($club);$s=app(WorldCareerContracts::class);$base=$s->baseWage($p);
        $id=$s->offerPlayer($club,$p,$base*3,26,'rotation','dated-payroll');$s->evaluate($id);
        $from=now()->startOfWeek();$to=$from->copy()->addWeek();
        $this->assertSame((int)round($base*2*4/7),$s->salaryDelta($club,[],$from,$to));
        $this->travelTo($to);app(ClubMarketService::class)->payroll($club);$count=DB::table('club_money_entries')->where('club_id',$club->id)->where('kind','Weekly payroll')->count();app(ClubMarketService::class)->payroll($club);
        $this->assertSame($count,DB::table('club_money_entries')->where('club_id',$club->id)->where('kind','Weekly payroll')->count());
    }
    public function test_staff_acceptance_uses_canonical_fees_and_prevents_duplicate_employment():void {
        $club=$this->club();$this->fund($club);app(WorldCareers::class)->seedProfessionals();$agent=WorldAgent::where('source_key','like','professional:v1:analyst:%')->firstOrFail();
        $salary=app(WorldCareers::class)->askingSalary($agent)*2;$v=app(WorldCareers::class)->vacancy($club,'analyst',$salary,8,4);
        $n=app(WorldCareerContracts::class)->offerStaff($club,$agent,$v,'staff-hire');app(WorldCareerContracts::class)->evaluate($n);
        $this->assertDatabaseHas('world_negotiations',['id'=>$n,'status'=>'accepted']);$this->assertDatabaseHas('club_staff',['club_id'=>$club->id,'role'=>'analyst','name'=>$agent->name]);
        $this->assertDatabaseHas('club_money_entries',['club_id'=>$club->id,'kind'=>'Staff signing fee','amount'=>-$salary*2]);
        $this->assertSame(1,DB::table('world_employments')->where('active_agent_id',$agent->id)->count());
        $other=$this->club();$this->fund($other);$v2=app(WorldCareers::class)->vacancy($other,'analyst',$salary,8,4);
        try{app(WorldCareerContracts::class)->offerStaff($other,$agent->fresh(),$v2,'double-hire');$this->fail('Double employment allowed');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame(409,$e->getStatusCode());}
        app(StaffContracts::class)->release($club,'analyst');$this->assertSame('available',$agent->fresh()->status);
        $n2=app(WorldCareerContracts::class)->offerStaff($other,$agent->fresh(),$v2,'new-career');app(WorldCareerContracts::class)->evaluate($n2);
        $this->assertSame($other->id,$agent->fresh()->club_id);$this->assertSame(1,DB::table('world_employments')->where('active_agent_id',$agent->id)->count());
    }
    public function test_sponsor_money_is_reserved_paid_once_and_unused_escrow_refunded():void {
        $club=$this->club();$other=$this->club();$this->exposure($club,$other);$s=app(WorldSponsorships::class);$s->install();$s->install();$this->assertDatabaseCount('world_sponsors',3);
        $before=app(ClubMarketService::class)->balance($club->id);$id=$s->offer($club,'funded-offer');$d=DB::table('world_sponsor_deals')->find($id);
        $this->assertSame(24000000-$d->reserved_amount,(int)DB::table('world_sponsor_entries')->sum('amount'));$this->assertSame($before,app(ClubMarketService::class)->balance($club->id));
        $s->respond($club,$id,'accept');$this->travel(8)->days();$s->settle();$s->settle();
        $this->assertSame($before+$d->weekly_amount,app(ClubMarketService::class)->balance($club->id));
        $s->respond($club,$id,'terminate');$s->respond($club,$id,'terminate');
        $this->assertSame(24000000-$d->weekly_amount,(int)DB::table('world_sponsor_entries')->sum('amount'));
        $this->assertDatabaseHas('world_sponsor_deals',['id'=>$id,'status'=>'terminated','paid_amount'=>$d->weekly_amount]);
    }
    public function test_sponsors_do_not_invent_exposure_or_unlimited_money():void {
        $club=$this->club();$s=app(WorldSponsorships::class);
        try{$s->offer($club,'no-exposure');$this->fail('Fake exposure funded');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame(409,$e->getStatusCode());}
        $this->assertDatabaseCount('world_sponsor_deals',0);
        $s->install();$this->travel(800)->days();$s->install();$this->assertSame(24000000,(int)DB::table('world_sponsor_entries')->sum('amount'));
    }
    public function test_binding_sponsorship_pays_after_final_manager_takeover_and_pause():void {
        $bot=$this->club(true);$other=$this->club();$this->exposure($bot,$other);$s=app(WorldSponsorships::class);$id=$s->offer($bot,'binding',true,(int)$bot->management_epoch);$s->respond($bot,$id,'accept',true,(int)$bot->management_epoch);
        $p=$this->player($bot);$c=app(WorldCareerContracts::class);$n=$c->offerPlayer($bot,$p,$c->baseWage($p),8,'rotation','bot-pending',true,(int)$bot->management_epoch);
        $human=User::factory()->create();$adopted=app(OnlineService::class)->provision($human);$this->assertSame($bot->id,$adopted->id);
        $this->assertDatabaseHas('world_negotiations',['id'=>$n,'status'=>'authority_changed']);$this->assertFalse(app(LivingWorldEngine::class)->managementAllowed());
        config(['living_world.enabled'=>false]);$before=app(ClubMarketService::class)->balance($adopted->id);$this->travel(8)->days();app(WorldBusinessEngine::class)->obligations();
        $this->assertGreaterThan($before,app(ClubMarketService::class)->balance($adopted->id));$this->assertDatabaseHas('world_sponsor_deals',['id'=>$id,'status'=>'active']);
    }
    public function test_delegation_limits_revocation_and_explicit_human_approval():void {
        $club=$this->club();$d=app(WorldDelegation::class);$before=OwnedPlayerCard::where('user_id',$club->user_id)->count();
        $d->configure($club,'scouting',true,true,50000,0);$id=DB::table('world_delegations')->value('id');$d->review($id);
        $r=DB::table('world_recommendations')->first();$this->assertSame('pending',$r->status);$this->assertSame($before,OwnedPlayerCard::where('user_id',$club->user_id)->count());
        $d->configure($club,'scouting',false,false,0,0);$d->execute($club,$r->id,true);$this->assertSame($before,OwnedPlayerCard::where('user_id',$club->user_id)->count());
        $d->configure($club,'scouting',true,false,0,0);$this->travel(7)->days();$d->review($id);$r=DB::table('world_recommendations')->orderByDesc('id')->first();$d->execute($club,$r->id);$d->execute($club,$r->id);
        $this->assertSame($before+1,OwnedPlayerCard::where('user_id',$club->user_id)->count());$this->assertDatabaseCount('world_delegated_spending',1);
    }
    public function test_caretaker_never_changes_ownership_or_acts_before_inactivity_threshold():void {
        $club=$this->club();$club->update(['manager_seen_at'=>now()]);$d=app(WorldDelegation::class);$d->configure($club,'scouting',true,true,100000,7);$id=DB::table('world_delegations')->value('id');$d->review($id);$this->assertDatabaseCount('world_recommendations',0);
        $this->travel(8)->days();$d->review($id);$this->assertDatabaseCount('world_recommendations',1);$this->assertSame($club->user_id,$club->fresh()->user_id);$this->assertFalse($club->fresh()->is_bot);
    }
    public function test_memory_is_evidence_counted_and_adaptation_stays_near_the_baseline():void {
        $club=$this->club();$a=app(WorldAgents::class)->player($this->player($club));$service=app(WorldAgents::class);$baseline=$a->traits['confidence'];
        for($i=0;$i<90;$i++)$service->remember($a,'evidence:'.$i,'employment','accepted',['observed'=>true],.8,.6,'club:'.$club->id,.01);
        $service->remember($a,'evidence:0','employment','accepted',['observed'=>true],.8,.6,'club:'.$club->id,.01);
        $this->assertSame(90,$a->fresh()->experience);$this->assertLessThanOrEqual($baseline+.12001,$a->fresh()->traits['confidence']);$this->assertCount(12,$service->context($a)['memories']);
        $this->assertSame(90,DB::table('world_agent_relationships')->where('agent_id',$a->id)->value('interactions'));
    }
    public function test_transfer_terms_stay_conditional_then_survive_a_delayed_binding_auction():void {
        $seller=$this->club();$buyer=$this->club();app(ClubMarketService::class)->scout($seller);$ids=array_column($seller->starters,'instance_id');$p=OwnedPlayerCard::where('user_id',$seller->user_id)->whereNotIn('id',$ids)->firstOrFail();
        $c=app(WorldCareerContracts::class);$salary=$c->baseWage($p)*3;$n=$c->offerPlayer($buyer,$p,$salary,26,'rotation','transfer-consent');$c->evaluate($n);
        $this->assertSame($seller->user_id,$p->fresh()->user_id);$this->assertDatabaseCount('world_player_terms',0);
        app(ClubMarketService::class)->list($seller,$p->id,5000);$auction=\App\Models\ClubAuction::firstOrFail();app(ClubMarketService::class)->bid($buyer,$auction->id,5000);
        $this->assertSame($n,$auction->fresh()->career_negotiation_id);$this->travel(4)->days();app(ClubMarketService::class)->close($auction->id);app(ClubMarketService::class)->close($auction->id);
        $this->assertSame($buyer->user_id,$p->fresh()->user_id);$this->assertDatabaseHas('world_player_terms',['negotiation_id'=>$n,'weekly_salary'=>$salary,'club_id'=>$buyer->id]);
    }

    public function test_general_manager_appointment_is_paid_but_never_replaces_the_five_coach_slots():void {
        $club=$this->club(true);$this->fund($club);app(WorldCareers::class)->seedProfessionals();$a=WorldAgent::where('profession','general_manager')->where('kind','staff')->firstOrFail();
        $salary=app(WorldCareers::class)->askingSalary($a)*2;$v=app(WorldCareers::class)->vacancy($club,'general_manager',$salary,4,4);
        $n=app(WorldCareerContracts::class)->offerStaff($club,$a,$v,'general-manager');app(WorldCareerContracts::class)->evaluate($n);
        $this->assertDatabaseHas('world_negotiations',['id'=>$n,'status'=>'accepted']);$this->assertSame(5,\App\Models\ClubStaff::where('club_id',$club->id)->count());
        $this->assertSame($salary,app(StaffContracts::class)->weeklySalary($club->id));
        $policy=app(\App\Services\WorldManagerPolicy::class)->profile($club->id);$this->assertEqualsWithDelta($a->fresh()->traits['ambition'],$policy['traits']['ambition'],.00001);
        $owner=$club->user_id;$this->travel(29)->days();app(WorldBusinessEngine::class)->obligations();
        $this->assertSame('available',$a->fresh()->status);$this->assertSame($owner,$club->fresh()->user_id);$this->assertSame(0,app(StaffContracts::class)->weeklySalary($club->id));
    }

    public function test_retirement_respects_the_starting_five_and_preserves_identity_for_a_new_profession():void {
        $club=$this->club();app(ClubMarketService::class)->scout($club);
        config(['world_players.enabled'=>true]);app(\App\Services\WorldPlayerProfiles::class)->invalidate();
        $p=OwnedPlayerCard::where('user_id',$club->user_id)->whereNotIn('id',array_column($club->starters,'instance_id'))->firstOrFail();
        $p->update(['world_profile'=>['schema'=>1,'stats'=>array_fill_keys(['lan','tf','iq','ldr','clu','sta','flx'],85),'potential'=>95,'birth_date'=>'1987-01-01','wage'=>45,'training_baseline'=>0]]);
        $agent=app(WorldAgents::class)->player($p);$policy=$agent->policy;$policy['retirement_notice_at']=now()->subDays(15)->toIso8601String();$agent->update(['policy'=>$policy,'skills'=>['analysis'=>8.5,'coaching'=>8.5],'experience'=>12]);$wire=$agent->wire_account_id;
        foreach(range(1,10) as $i){$match=(string)\Illuminate\Support\Str::uuid();DB::table('online_matches')->insert(['id'=>$match,'blue_user_id'=>$club->user_id,'red_user_id'=>$club->user_id,'status'=>'completed','plan'=>'{}','plan_hash'=>str_repeat('b',64)]);DB::table('club_player_match_ratings')->insert(['match_id'=>$match,'card_id'=>$p->id,'club_id'=>$club->id,'club_name'=>$club->name,'competition'=>'Isolated verified-record fixture','won'=>true,'rating'=>8,'performance'=>'{}','created_at'=>now()->subDays($i)]);}
        app(WorldCareers::class)->retire($club,$p->id);$this->assertNotNull(OwnedPlayerCard::withoutGlobalScopes()->findOrFail($p->id)->retired_at);$this->assertSame(5,OwnedPlayerCard::where('user_id',$club->user_id)->count());
        app(WorldBusinessEngine::class)->tick(microtime(true)+5);$this->assertSame('analyst',$agent->fresh()->profession);$this->assertSame($wire,$agent->fresh()->wire_account_id);
        $this->assertDatabaseHas('world_wire_accounts',['id'=>$wire,'role'=>'analyst']);$this->assertSame(1,WorldAgent::where('source_key','player:'.$p->id)->count());
        $starter=OwnedPlayerCard::where('user_id',$club->user_id)->firstOrFail();$starter->update(['world_profile'=>$p->world_profile]);$a=app(WorldAgents::class)->player($starter);$policy=$a->policy;$policy['retirement_notice_at']=now()->subDays(15)->toIso8601String();$a->update(['policy'=>$policy]);
        try{app(WorldCareers::class)->retire($club,$starter->id);$this->fail('Starting-five retirement allowed');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertContains($e->getStatusCode(),[409,422]);}
    }

    public function test_successful_staff_request_is_idempotent_after_vacancy_has_filled():void {
        $club=$this->club();$this->fund($club);app(WorldCareers::class)->seedProfessionals();$a=WorldAgent::where('profession','scout')->firstOrFail();$salary=app(WorldCareers::class)->askingSalary($a)*2;
        $v=app(WorldCareers::class)->vacancy($club,'scout',$salary,8,4);$n=app(WorldCareerContracts::class)->offerStaff($club,$a,$v,'idempotent-hire');app(WorldCareerContracts::class)->evaluate($n);
        $this->assertSame($n,app(WorldCareerContracts::class)->offerStaff($club,$a,$v,'idempotent-hire'));$this->assertSame(1,DB::table('club_staff_contracts')->where('club_id',$club->id)->where('role','scout')->count());
    }
    public function test_paid_release_and_free_agent_signing_preserve_the_person_and_all_contract_rights():void {
        $club=$this->club();app(ClubMarketService::class)->scout($club);$p=OwnedPlayerCard::where('user_id',$club->user_id)->whereNotIn('id',array_column($club->starters,'instance_id'))->firstOrFail();
        $contracts=app(WorldCareerContracts::class);$salary=$contracts->baseWage($p)*3;$n=$contracts->offerPlayer($club,$p,$salary,26,'rotation','protected-release');$contracts->evaluate($n);
        $cost=app(\App\Services\WorldFreeAgency::class)->releaseCost($p);$this->assertSame($salary*30,$cost);$before=app(ClubMarketService::class)->balance($club->id);$identity=[$p->id,$p->persona_name,$p->training_xp,$p->nationality_id];
        app(ClubMarketService::class)->releaseReserve($club,$p->id);app(ClubMarketService::class)->releaseReserve($club,$p->id);
        $this->assertSame($before-$cost,app(ClubMarketService::class)->balance($club->id));$this->assertSame(5,OwnedPlayerCard::where('user_id',$club->user_id)->count());
        $this->assertDatabaseHas('world_player_terms',['negotiation_id'=>$n,'status'=>'released']);$this->assertDatabaseHas('world_free_agents',['player_id'=>$p->id,'status'=>'available','compensation'=>$cost]);
        $custodian=User::findOrFail($p->fresh()->user_id);$this->assertFalse(OnlineClub::where('user_id',$custodian->id)->exists());
        try{app(OnlineService::class)->provision($custodian);$this->fail('Registry account admitted as a club');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame(403,$e->getStatusCode());}
        $buyer=$this->club();$offered=$contracts->baseWage($p)*3;$id=$contracts->offerPlayer($buyer,$p->fresh(),$offered,26,'rotation','free-signing');$contracts->evaluate($id);$contracts->evaluate($id);
        $p->refresh();$this->assertSame($buyer->user_id,$p->user_id);$this->assertSame($identity,[$p->id,$p->persona_name,$p->training_xp,$p->nationality_id]);
        $this->assertDatabaseHas('world_player_terms',['negotiation_id'=>$id,'active_player_id'=>$p->id]);$this->assertDatabaseHas('club_money_entries',['club_id'=>$buyer->id,'reference'=>'free-agent-agreement:'.$id,'amount'=>-$offered]);
        $this->assertSame(1,DB::table('world_employments')->where('active_agent_id',WorldAgent::where('source_key','player:'.$p->id)->value('id'))->count());
    }
    public function test_release_cannot_remove_a_starter_or_a_committed_player():void {
        $club=$this->club();$p=$this->player($club);$before=app(ClubMarketService::class)->balance($club->id);
        try{app(ClubMarketService::class)->releaseReserve($club,$p->id);$this->fail('Released a starting-five member');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame(422,$e->getStatusCode());}
        $this->assertSame($before,app(ClubMarketService::class)->balance($club->id));$this->assertDatabaseCount('world_free_agents',0);
        app(ClubMarketService::class)->scout($club);$reserve=OwnedPlayerCard::where('user_id',$club->user_id)->whereNotIn('id',array_column($club->starters,'instance_id'))->firstOrFail();app(ClubMarketService::class)->list($club,$reserve->id,5000);
        try{app(ClubMarketService::class)->releaseReserve($club,$reserve->id);$this->fail('Released an auction commitment');}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){$this->assertSame(409,$e->getStatusCode());}
    }
    public function test_finance_permission_can_only_close_optional_spending_after_explicit_authorization():void {
        $club=$this->club();app(ClubMarketService::class)->setAcademy($club,true);$club->refresh();$market=app(ClubMarketService::class);$remaining=$market->balance($club->id);DB::table('club_money_entries')->insert(['club_id'=>$club->id,'amount'=>100000-$remaining,'kind'=>'Isolated stress expense','reference'=>'financial-stress','created_at'=>now()]);
        $d=app(WorldDelegation::class);$d->configure($club,'finance',true,false,0,0);$id=DB::table('world_delegations')->where('scope','finance')->value('id');$d->review($id);
        $r=DB::table('world_recommendations')->where('scope','finance')->first();$this->assertNotNull($club->fresh()->academy_opened_at);$d->execute($club,$r->id);$this->assertNull($club->fresh()->academy_opened_at);$this->assertFalse($club->fresh()->is_bot);
    }
}
