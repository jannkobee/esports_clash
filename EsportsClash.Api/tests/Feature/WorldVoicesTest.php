<?php
namespace Tests\Feature;

use App\Models\{OnlineClub,OwnedPlayerCard,User};
use App\Services\{OnlineService,WireAccounts,WorldNarration,WorldSocialMind,WorldVoiceSimulation,WorldManagerPolicy,WorldNewsPresentation};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Cache,DB,Http,Queue};
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorldVoicesTest extends TestCase
{
    use RefreshDatabase;
    protected function setUp(): void {
        parent::setUp();Queue::fake();Http::preventStrayRequests();
        config(['world_narration.enabled'=>true,'world_narration.daily_posts'=>144,'world_narration.hourly_posts'=>18,'world_narration.posts_per_tick'=>3]);
    }
    private function source(string $version='A1',array $facts=[]): object {
        $id=DB::table('world_news_posts')->insertGetId(['event_key'=>'patch:'.$version,'kind'=>'arena_update','headline'=>'Arena '.$version.' announcement',
            'body'=>'Mage skill cooldown changes are announced for Arena version '.$version.'.','facts'=>json_encode($facts+['version'=>$version,'release_status'=>'announced','provenance'=>'official_arena_announcement']),'published_at'=>now()]);
        return DB::table('world_news_posts')->find($id);
    }
    private function actor(string $name='Aster',array $profile=[],string $role='analyst'): object {
        $id=DB::table('world_wire_accounts')->insertGetId(['source_key'=>'talent:'.$name,'source_id'=>(string)(DB::table('world_wire_accounts')->count()+1),'kind'=>'talent','name'=>$name,'handle'=>strtolower($name),'role'=>$role,'profile'=>json_encode($profile),'autonomous'=>true,'created_at'=>now(),'updated_at'=>now()]);
        return DB::table('world_wire_accounts')->find($id);
    }
    public function test_disabled_engine_is_silent(): void {
        config(['world_narration.enabled'=>false]);$this->actor();$this->source();
        $this->assertFalse(app(WorldNarration::class)->ready());app(WorldNarration::class)->tick();
        $this->assertDatabaseCount('world_voice_memories',0);Http::assertNothingSent();
    }
    public function test_local_engine_needs_no_key_and_ignores_old_provider_backoff(): void {
        config(['world_narration.provider'=>'gemini','world_narration.api_key'=>'','world_narration.model'=>'unused']);
        Cache::forever('world-narration:backoff:gemini',true);$this->actor();$this->source();
        $this->assertTrue(app(WorldNarration::class)->ready());$result=app(WorldNarration::class)->tick();
        $this->assertSame(1,$result['published']);$this->assertDatabaseHas('world_news_posts',['kind'=>'reaction']);
        $this->assertDatabaseCount('world_voice_attempts',0);Http::assertNothingSent();
    }
    public function test_observation_persists_goals_evidence_and_idempotent_memory(): void {
        $a=$this->actor();$s=$this->source();$engine=app(WorldVoiceSimulation::class);
        $this->assertSame('published',$engine->observe($a->id,$s->id));$this->assertSame('unchanged',$engine->observe($a->id,$s->id));
        $this->assertDatabaseCount('world_voice_memories',1);$this->assertDatabaseHas('world_voice_states',['account_id'=>$a->id,'observations'=>1]);
        $post=DB::table('world_news_posts')->where('kind','reaction')->first();$facts=json_decode($post->facts,true);
        $this->assertSame($s->id,$post->source_post_id);$this->assertSame('simulated_opinion',$facts['provenance']);
        $this->assertStringContainsString($facts['source_quote'],$s->body);$this->assertNotEmpty($engine->publicState($a->id)['focus']);
        $this->assertStringContainsString('announced',$post->body);Http::assertNothingSent();
    }
    public function test_current_personalities_change_social_traits_and_attention(): void {
        $a=$this->actor('SameIdentity',['primary_personality'=>'showman']);$b=clone $a;$b->profile=json_encode(['primary_personality'=>'silent_operator']);
        $mind=app(WorldSocialMind::class);$this->assertGreaterThan($mind->traits($b)['expression'],$mind->traits($a)['expression']);
        $signal=app(WorldVoiceSimulation::class)->signal($this->source());$signal['self']=true;
        $first=$mind->decide($a,$signal,$mind->initial($a),[],.8,0);$quiet=$mind->decide($b,$signal,$mind->initial($b),[],.8,0);
        $this->assertGreaterThan($quiet['salience'],$first['salience']);$this->assertSame($mind->traits($a),$mind->traits($a));
    }
    public function test_goals_and_mood_respond_to_recorded_experience(): void {
        $a=$this->actor();$mind=app(WorldSocialMind::class);$signal=app(WorldVoiceSimulation::class)->signal($this->source());
        $state=$mind->initial($a);$first=$mind->decide($a,$signal,$state,[],.9,0);
        $recent=array_fill(0,3,['topic_key'=>'different','outcome'=>'published','goal'=>$first['goal'],'intent'=>$first['intents'][0]]);
        $next=$mind->decide($a,$signal,$state,$recent,.9,0);$evolved=$mind->evolve($state,$signal,$first);
        $this->assertNotSame($first['goal'],$next['goal']);$this->assertNotSame($state['mood'],$evolved['mood']);$this->assertSame(1,$evolved['observations']);
    }
    public function test_topic_fatigue_allows_silence_without_filler(): void {
        $a=$this->actor();$s=$this->source();$topic=app(WorldVoiceSimulation::class)->signal($s)['topic_key'];
        foreach(['earlier1','earlier2','earlier3'] as $v){$old=$this->source($v);DB::table('world_voice_memories')->insert(['account_id'=>$a->id,'source_post_id'=>$old->id,'topic_key'=>$topic,'event_type'=>'patch','intent'=>'analysis','goal'=>'understand','outcome'=>'published','reason'=>'test','salience'=>.8,'observed_at'=>now()->subHours(9)]);}
        $this->assertSame('observed',app(WorldVoiceSimulation::class)->observe($a->id,$s->id));
        $this->assertDatabaseHas('world_voice_memories',['source_post_id'=>$s->id,'intent'=>'silence','reason'=>'topic_fatigue']);
        $this->assertDatabaseMissing('world_news_posts',['kind'=>'reaction']);
    }
    public function test_author_cooldown_and_distinct_compositions_are_enforced(): void {
        $a=$this->actor();$one=$this->source();$two=$this->source('A2');$engine=app(WorldVoiceSimulation::class);
        $this->assertSame('published',$engine->observe($a->id,$one->id));$this->assertSame('unchanged',$engine->observe($a->id,$two->id));
        $this->travel(9)->hours();$this->assertSame('published',$engine->observe($a->id,$two->id));
        $bodies=DB::table('world_news_posts')->where('kind','reaction')->pluck('body');$this->assertSame(2,$bodies->unique()->count());
    }
    public function test_unrelated_manager_human_control_and_publisher_are_protected(): void {
        $u=User::factory()->create();$this->artisan('online:install-catalog')->assertSuccessful();$club=app(OnlineService::class)->provision($u);
        $a=$this->actor('Manager',['club_id'=>$club->id],'manager');$s=$this->source();
        $this->assertSame('unchanged',app(WorldVoiceSimulation::class)->observe($a->id,$s->id));
        $this->assertFalse((bool)DB::table('world_wire_accounts')->where('id',$a->id)->value('autonomous'));
        $game=app(WireAccounts::class)->game();$this->assertSame('unchanged',app(WorldVoiceSimulation::class)->observe($game,$s->id));
        $this->assertDatabaseMissing('world_news_posts',['kind'=>'reaction']);
    }
    public function test_new_player_identity_uses_actual_catalog_personality_and_real_events(): void {
        $this->artisan('online:install-catalog')->assertSuccessful();$u=User::factory()->create();$club=app(OnlineService::class)->provision($u);
        $p=OwnedPlayerCard::where('user_id',$u->id)->firstOrFail();$id=app(WireAccounts::class)->player($p);$a=DB::table('world_wire_accounts')->find($id);
        $this->assertSame($club->id,json_decode($a->profile,true)['club_id']);$this->assertNotEmpty(json_decode($a->profile,true)['primary_personality']);
        $s=$this->source('PlayerPatch',['player_id'=>$p->id]);$this->assertSame(1.0,app(WorldVoiceSimulation::class)->relevance($a,app(WorldVoiceSimulation::class)->signal($s)));
        $this->assertContains(app(WorldVoiceSimulation::class)->observe($id,$s->id),['published','observed']);
        $this->assertDatabaseHas('world_voice_states',['account_id'=>$id]);$this->assertDatabaseHas('world_voice_relationships',['account_id'=>$id,'subject_kind'=>'player','subject_id'=>$p->id]);
        $this->assertDatabaseCount('online_matches',0);Http::assertNothingSent();
    }
    public function test_hidden_sources_generated_feedback_and_launch_results_are_not_used(): void {
        $a=$this->actor();$s=$this->source();DB::table('world_news_posts')->where('id',$s->id)->update(['hidden_at'=>now()]);
        $engine=app(WorldVoiceSimulation::class);$this->assertSame('unchanged',$engine->observe($a->id,$s->id));
        $s->source_post_id=$s->id;$this->assertNull($engine->signal($s));$s->source_post_id=null;$s->facts=json_encode(['provenance'=>'launch_simulation']);
        $this->assertNull($engine->signal($s));$this->assertDatabaseCount('world_voice_memories',0);
    }
    public function test_empty_world_and_daily_budget_do_not_force_activity(): void {
        $this->actor();$this->assertSame(0,app(WorldNarration::class)->tick()['published']);
        $this->source();config(['world_narration.daily_posts'=>0]);$this->assertSame(0,app(WorldNarration::class)->tick()['published']);
        $this->assertDatabaseCount('world_voice_memories',0);Http::assertNothingSent();
    }
    public function test_published_source_and_hourly_limits_prevent_a_comment_pile_on(): void {
        $s=$this->source();$topic=app(WorldVoiceSimulation::class)->signal($s)['topic_key'];
        foreach(['One','Two','Three','Four'] as $name){$a=$this->actor($name);DB::table('world_voice_memories')->insert(['account_id'=>$a->id,'source_post_id'=>$s->id,'topic_key'=>$topic,'event_type'=>'patch','intent'=>'analysis','goal'=>'understand','outcome'=>'published','reason'=>'test','salience'=>.8,'observed_at'=>now()]);}
        $this->actor('Next');$this->assertSame(0,app(WorldNarration::class)->tick()['published']);
        $this->source('A2');config(['world_narration.hourly_posts'=>4]);$this->assertSame(0,app(WorldNarration::class)->tick()['published']);Http::assertNothingSent();
    }
    public function test_recent_profession_saturation_changes_who_gets_attention(): void {
        foreach(['AnalystOne','AnalystTwo','AnalystThree'] as $name){$a=$this->actor($name);$s=$this->source($name);DB::table('world_voice_memories')->insert(['account_id'=>$a->id,'source_post_id'=>$s->id,'topic_key'=>'old:'.$name,'event_type'=>'patch','intent'=>'analysis','goal'=>'understand','outcome'=>'published','reason'=>'test','salience'=>.8,'observed_at'=>now()]);}
        $streamer=$this->actor('FreshPerspective',[],'streamer');$this->source('FreshTopic');config(['world_narration.posts_per_tick'=>1]);
        $this->assertSame(1,app(WorldNarration::class)->tick()['published']);
        $this->assertDatabaseHas('world_news_posts',['kind'=>'reaction','wire_account_id'=>$streamer->id]);Http::assertNothingSent();
    }
    public function test_role_specific_notes_change_player_interest_and_unappointed_officials_stay_silent(): void {
        $signal=app(WorldVoiceSimulation::class)->signal($this->source());$mage=$this->actor('Mage',['preferred_role'=>'Mage']);$mage->kind='player';$mage->role='player';
        $tank=clone $mage;$tank->profile=json_encode(['preferred_role'=>'Tank']);$engine=app(WorldVoiceSimulation::class);
        $this->assertGreaterThan($engine->relevance($tank,$signal),$engine->relevance($mage,$signal));
        $observer=$this->actor('Observer',[],'observer');$ref=$this->actor('Referee',[],'referee');
        $this->assertSame(0.0,$engine->relevance($observer,$signal));$this->assertSame(0.0,$engine->relevance($ref,$signal));
    }
    public function test_actual_fixture_appointment_enables_an_observers_voice(): void {
        $this->artisan('online:install-catalog')->assertSuccessful();$one=app(OnlineService::class)->provision(User::factory()->create());$two=app(OnlineService::class)->provision(User::factory()->create());
        $fixture=\App\Models\ClubFixture::create(['home_club_id'=>$one->id,'away_club_id'=>$two->id,'competition'=>'Appointment test','kickoff_at'=>now()->addDay(),'orders_close_at'=>now()->addHours(23)]);
        $talent=DB::table('world_media_personalities')->insertGetId(['slug'=>'appointed-observer','name'=>'Appointed Observer','role'=>'observer','style'=>'Coverage','bio'=>'Circuit observer.']);
        DB::table('fixture_talent_assignments')->insert(['fixture_id'=>$fixture->id,'talent_id'=>$talent,'role'=>'observer','assigned_at'=>now()]);
        $actor=$this->actor('Appointed',[],'observer');DB::table('world_wire_accounts')->where('id',$actor->id)->update(['source_id'=>(string)$talent]);$actor->source_id=(string)$talent;
        $source=DB::table('world_news_posts')->insertGetId(['event_key'=>'appointment:test','kind'=>'tournament','headline'=>'Appointment test fixture','body'=>'The published fixture and assigned broadcast crew are available.','facts'=>json_encode(['fixture_id'=>$fixture->id,'provenance'=>'scheduled']),'published_at'=>now()]);
        $engine=app(WorldVoiceSimulation::class);$signal=$engine->signal(DB::table('world_news_posts')->find($source));
        $this->assertSame(.9,$engine->relevance($actor,$signal));$this->assertSame('published',$engine->observe($actor->id,$source));Http::assertNothingSent();
    }
    public function test_relationship_attention_is_evidence_counted_once_per_event(): void {
        $this->artisan('online:install-catalog')->assertSuccessful();$u=User::factory()->create();$club=app(OnlineService::class)->provision($u);
        $p=OwnedPlayerCard::where('user_id',$u->id)->firstOrFail();$id=app(WireAccounts::class)->player($p);$engine=app(WorldVoiceSimulation::class);
        $first=$this->source('R1',['player_id'=>$p->id,'team_id'=>$club->id]);$engine->observe($id,$first->id);$engine->observe($id,$first->id);
        $relationship=DB::table('world_voice_relationships')->where('account_id',$id)->where('subject_kind','club')->first();$this->assertSame(1,$relationship->observations);
        $this->travel(9)->hours();$second=$this->source('R2',['player_id'=>$p->id,'team_id'=>$club->id]);$engine->observe($id,$second->id);
        $next=DB::table('world_voice_relationships')->where('id',$relationship->id)->first();$this->assertSame(2,$next->observations);$this->assertGreaterThan($relationship->attention,$next->attention);
    }
    public function test_announcement_permissions_and_release_provenance(): void {
        $normal=User::factory()->create();Sanctum::actingAs($normal);
        $input=['version'=>'Arena A1','title'=>'Mage adjustments','category'=>'balance','status'=>'announced','body'=>'Actual reviewed notes for the next Arena update.'];
        $this->postJson('/api/v1/world/arena-updates',$input)->assertForbidden();
        $owner=User::factory()->create(['is_evolution_admin'=>true]);Sanctum::actingAs($owner);
        $this->postJson('/api/v1/world/arena-updates',[...$input,'status'=>'released'])->assertUnprocessable();
        $this->postJson('/api/v1/world/arena-updates',$input)->assertCreated();
        $this->assertDatabaseHas('world_news_posts',['kind'=>'arena_update']);$this->assertDatabaseCount('online_matches',0);
    }
    public function test_organizer_cannot_be_impersonated_and_game_account_is_protected(): void {
        $owner=User::factory()->create();$other=User::factory()->create();
        $organizer=DB::table('competition_organizers')->insertGetId(['slug'=>'open-circuit','name'=>'Open Circuit','user_id'=>$owner->id,'status'=>'verified','created_at'=>now(),'updated_at'=>now()]);
        $id=DB::table('world_wire_accounts')->insertGetId(['source_key'=>'organizer:'.$organizer,'source_id'=>(string)$organizer,'kind'=>'organizer','name'=>'Open Circuit','handle'=>'open-circuit','role'=>'organizer','profile'=>'{}','owner_id'=>$owner->id,'created_at'=>now(),'updated_at'=>now()]);
        Sanctum::actingAs($other);$this->postJson('/api/v1/world/news',['body'=>'A notice.','account_id'=>$id])->assertForbidden();
        $game=app(WireAccounts::class)->game();Sanctum::actingAs($owner);$this->postJson('/api/v1/world/news',['body'=>'A notice.','account_id'=>$game])->assertForbidden();
        $this->postJson('/api/v1/world/news',['body'=>'A real organizer notice.','account_id'=>$id])->assertCreated();
        $this->getJson('/api/v1/world/news?account='.$id)->assertOk()->assertJsonPath('data.0.personality','Open Circuit')->assertJsonPath('data.0.role','organizer');
        $this->assertSame('unchanged',app(WorldVoiceSimulation::class)->observe($id,$this->source()->id));
    }
    public function test_organizer_control_follows_current_source_ownership(): void {
        $before=User::factory()->create();$after=User::factory()->create();
        $org=DB::table('competition_organizers')->insertGetId(['slug'=>'handover','name'=>'Handover Circuit','user_id'=>$before->id,'status'=>'verified','created_at'=>now(),'updated_at'=>now()]);
        app(WireAccounts::class)->sync();$account=DB::table('world_wire_accounts')->where('source_key','organizer:'.$org)->firstOrFail();
        DB::table('competition_organizers')->where('id',$org)->update(['user_id'=>$after->id]);
        Sanctum::actingAs($after);$this->getJson('/api/v1/world/owned-accounts')->assertOk()->assertJsonPath('data.0.id',$account->id);
        $this->postJson('/api/v1/world/news',['body'=>'The current owner publishes this notice.','account_id'=>$account->id])->assertCreated();
        Sanctum::actingAs($before);$this->postJson('/api/v1/world/news',['body'=>'The previous owner tries to publish.','account_id'=>$account->id])->assertForbidden();Http::assertNothingSent();
    }
    public function test_manager_style_persists_and_needs_override_it(): void {
        $policy=app(WorldManagerPolicy::class);$club=new OnlineClub(['id'=>31]);$this->assertSame($policy->profile(31),$policy->profile(31));
        $poor=$policy->assess($club,9,100,1000);$funded=$policy->assess($club,5,100000,1000);
        $this->assertSame('Protect payroll',$poor['priority']);$this->assertSame(5,$poor['target_roster']);$this->assertSame('Build squad depth',$funded['priority']);
        $this->assertLessThanOrEqual(config('world_players.bot_bid_fraction'),$funded['bid_fraction']);
    }
    public function test_retained_system_dates_are_projected_without_modifying_source(): void {
        $original='Entries close 2026-11-11T10:00:00+00:00.';
        $this->assertSame('Entries close 11 Nov 2026, 6:00 PM Manila.',app(WorldNewsPresentation::class)->body($original));
        $this->assertSame('Entries close 2026-11-11T10:00:00+00:00.',$original);
    }
    public function test_reaction_evidence_keeps_exact_source_and_a_readable_date_projection(): void {
        $a=$this->actor();$s=$this->source();$body='Entries close 2026-11-11T10:00:00+00:00. Published registration notice.';
        DB::table('world_news_posts')->where('id',$s->id)->update(['body'=>$body]);app(WorldVoiceSimulation::class)->observe($a->id,$s->id);
        $this->getJson('/api/v1/world/news?kind=reaction')->assertOk()->assertJsonPath('data.0.facts.source_quote',$body)->assertJsonPath('data.0.facts.source_quote_display','Entries close 11 Nov 2026, 6:00 PM Manila. Published registration notice.');
        $this->assertDatabaseHas('world_news_posts',['id'=>$s->id,'body'=>$body]);
    }
    public function test_world_desk_and_social_focus_are_public_operations_owner_only(): void {
        $a=$this->actor();$s=$this->source();app(WorldVoiceSimulation::class)->observe($a->id,$s->id);
        $this->getJson('/api/v1/world/simulation')->assertOk()->assertJsonPath('data.narration.mode','simulation')->assertJsonPath('data.narration.status','enabled');
        $this->getJson('/api/v1/world/accounts/'.$a->id)->assertOk()->assertJsonStructure(['data'=>['world_state'=>['focus','disposition','observed_at']]]);
        $this->getJson('/api/v1/world/operations')->assertUnauthorized();
        $owner=User::factory()->create(['is_evolution_admin'=>true]);$this->actingAs($owner)->get('/evolution/world')->assertOk()->assertSee('no AI provider');
    }
}
