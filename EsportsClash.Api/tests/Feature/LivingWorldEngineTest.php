<?php

namespace Tests\Feature;

use App\Jobs\{AdvanceLivingWorld, PopulateBotClubs};
use App\Models\{OnlineClub, User};
use App\Services\{BotClubManager, BotPopulationService, LivingWorldEngine, OnlineService, WireAccounts, WorldMedia, WorldVoiceSimulation};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Cache, DB, Http, Queue};
use Tests\TestCase;

class LivingWorldEngineTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->setDate(2026,11,9)->setTime(8,0));
        Queue::fake();Http::preventStrayRequests();
        config(['living_world.enabled'=>true,'living_world.clubs_per_tick'=>8,'living_world.seconds_per_tick'=>8]);
    }

    private function clubs(int $count): array
    {
        $users=[];$clubs=[];
        for($i=1;$i<=$count;$i++) {
            $users[]=['id'=>10000+$i,'name'=>'Manager '.$i,'email'=>'test'.$i.'@world.invalid','password'=>'unused'];
            $clubs[]=['id'=>$i,'user_id'=>10000+$i,'name'=>'Club '.$i,'tag'=>'T'.$i,'is_bot'=>true,'lineup'=>'[]','tier'=>5];
        }
        foreach(array_chunk($users,100) as $chunk)DB::table('users')->insert($chunk);
        foreach(array_chunk($clubs,100) as $chunk)DB::table('online_clubs')->insert($chunk);
        DB::table('living_world_runtime')->where('id',1)->update(['management_state'=>'active']);
        return range(1,$count);
    }

    private function noSocial(): void {
        $this->mock(WireAccounts::class)->shouldReceive('ready')->andReturn(false);
        $this->mock(\App\Services\WorldBusinessEngine::class)->shouldReceive('tick')->andReturn([]);
    }

    public function test_bounded_batches_rotate_over_one_thousand_clubs_without_job_fanout(): void
    {
        $this->clubs(1000);$this->noSocial();$seen=[];
        $this->mock(BotClubManager::class)->shouldReceive('run')->andReturnUsing(function($id,$window,$epoch)use(&$seen){$seen[]=$id;$this->assertSame(1,$epoch);});
        $engine=app(LivingWorldEngine::class);
        for($i=0;$i<125;$i++) {
            $result=$engine->tick();$this->assertSame(8,$result['reviewed']);$this->travel(5)->minutes();
        }
        $this->assertCount(1000,array_unique($seen));$this->assertCount(1000,$seen);
        Queue::assertNothingPushed();Http::assertNothingSent();
    }

    public function test_duplicate_tick_and_restart_do_not_repeat_a_batch(): void
    {
        $this->clubs(10);$this->noSocial();
        $this->mock(BotClubManager::class)->shouldReceive('run')->times(10);
        $this->assertSame(8,app(LivingWorldEngine::class)->tick()['reviewed']);
        $this->assertSame('already_ran',(new LivingWorldEngine)->tick()['status']);
        $this->travel(5)->minutes();$this->assertSame(2,(new LivingWorldEngine)->tick()['reviewed']);
    }

    public function test_core_backlog_defers_autonomy_without_consuming_work(): void
    {
        $this->clubs(2);$this->mock(BotClubManager::class)->shouldNotReceive('run');
        for($i=0;$i<20;$i++)DB::table('jobs')->insert(['queue'=>'default','payload'=>'{}','attempts'=>0,'available_at'=>now()->timestamp,'created_at'=>now()->timestamp]);
        $this->assertSame('core_backlog',app(LivingWorldEngine::class)->tick()['deferred']);
        $this->assertNull(DB::table('living_world_runtime')->value('last_tick_at'));
        $this->assertSame(2,DB::table('online_clubs')->whereNull('world_review_at')->count());
        $this->assertDatabaseCount('jobs',20);
    }

    public function test_delayed_reserved_and_optional_jobs_do_not_count_as_core_pressure(): void
    {
        foreach(range(1,30) as $i)foreach(['world','delayed','reserved'] as $type)
            DB::table('jobs')->insert(['queue'=>$type==='world'?'world':'default','payload'=>'{}','attempts'=>0,
                'reserved_at'=>$type==='reserved'?now()->timestamp:null,'available_at'=>$type==='delayed'?now()->addHour()->timestamp:now()->timestamp,'created_at'=>now()->timestamp]);
        $this->assertNull(app(LivingWorldEngine::class)->pressure());
    }

    public function test_old_core_job_defers_even_with_a_small_queue(): void
    {
        DB::table('jobs')->insert(['queue'=>'default','payload'=>'{}','attempts'=>0,'available_at'=>now()->subMinutes(3)->timestamp,'created_at'=>now()->subMinutes(3)->timestamp]);
        $this->assertSame('core_waiting',app(LivingWorldEngine::class)->pressure());
    }

    public function test_retired_management_keeps_wire_people_alive_and_coalesces_idle_work(): void
    {
        DB::table('living_world_runtime')->where('id',1)->update(['management_state'=>'retired','retired_at'=>now()]);
        $this->mock(BotClubManager::class)->shouldNotReceive('run');
        $this->mock(WireAccounts::class)->shouldReceive('ready')->andReturn(true)->getMock()->shouldReceive('sync')->once();
        $this->mock(WorldMedia::class)->shouldReceive('tick')->once();
        $this->mock(WorldVoiceSimulation::class)->shouldReceive('tick')->once()->andReturn(['observed'=>2,'published'=>1]);
        $engine=app(LivingWorldEngine::class);
        $this->assertSame(1,$engine->tick()['published']);
        $this->travel(5)->minutes();$this->assertSame(0,$engine->tick()['published']);
        $this->assertSame('retired',DB::table('living_world_runtime')->value('management_state'));
        Http::assertNothingSent();
    }

    public function test_existing_manager_job_and_old_population_job_cannot_bypass_coordinator(): void
    {
        $this->mock(BotClubManager::class)->shouldNotReceive('run');
        (new \App\Jobs\ManageBotClub(123,now()->toIso8601String()))->handle(app(BotClubManager::class));
        Queue::assertPushed(AdvanceLivingWorld::class,1);
        $population=$this->mock(BotPopulationService::class);$population->shouldNotReceive('populate');
        (new PopulateBotClubs(32))->handle($population);
    }

    public function test_human_takeover_retires_final_manager_without_replacing_the_club(): void
    {
        $this->artisan('online:install-catalog')->assertSuccessful();
        $bot=app(OnlineService::class)->provision(User::factory()->create(),true);
        $bot->update(['tag'=>'LAST','name'=>'Last Club']);
        DB::table('living_world_runtime')->where('id',1)->update(['management_state'=>'active']);
        $oldUser=$bot->user_id;$human=User::factory()->create();
        DB::table('club_money_entries')->insert(['club_id'=>$bot->id,'amount'=>123456,'kind'=>'Test funds','reference'=>'retained','created_at'=>now()]);
        $playerIds=DB::table('owned_player_cards')->where('user_id',$oldUser)->pluck('id')->all();
        $adopted=app(OnlineService::class)->provision($human);
        $this->assertSame($bot->id,$adopted->id);$this->assertFalse($adopted->is_bot);
        $this->assertSame('Last Club',$adopted->name);$this->assertSame(2,(int)$adopted->fresh()->management_epoch);
        $this->assertSame('retired',DB::table('living_world_runtime')->value('management_state'));
        $this->assertSame($playerIds,DB::table('owned_player_cards')->where('user_id',$human->id)->pluck('id')->all());
        $this->assertDatabaseHas('club_money_entries',['club_id'=>$bot->id,'reference'=>'retained','amount'=>123456]);
        $this->assertDatabaseCount('online_clubs',1);Queue::assertNotPushed(PopulateBotClubs::class);
        // Retrying registration reuses the human club; restart never resurrects management.
        $this->assertSame($adopted->id,app(OnlineService::class)->provision($human)->id);
        $this->assertFalse((new LivingWorldEngine)->managementAllowed());
    }

    public function test_stale_epoch_cannot_make_financial_or_roster_decisions(): void
    {
        $this->artisan('online:install-catalog')->assertSuccessful();
        $bot=app(OnlineService::class)->provision(User::factory()->create(),true);
        $bot->update(['management_epoch'=>2]);
        app(BotClubManager::class)->run($bot->id,now()->toIso8601String(),1);
        $this->assertDatabaseCount('club_world_turns',0);$this->assertDatabaseCount('club_auctions',0);
    }

    public function test_disabled_coordinator_does_not_mutate_the_world(): void
    {
        config(['living_world.enabled'=>false]);$this->clubs(2);
        $this->assertSame('disabled',app(LivingWorldEngine::class)->tick()['status']);
        $this->assertNull(DB::table('living_world_runtime')->value('last_tick_at'));
    }

    public function test_real_events_wake_a_review_once_but_own_completed_actions_do_not(): void
    {
        $this->clubs(2);$this->noSocial();$this->mock(BotClubManager::class)->shouldNotReceive('run');
        DB::table('online_clubs')->update(['world_review_at'=>now()->addHours(2)]);
        foreach([1,2] as $id)DB::table('club_world_events')->insert(['event_key'=>'real:'.$id,'actor_club_id'=>$id,'kind'=>'transfer','message'=>'Recorded transfer','payload'=>'{}','occurred_at'=>now()]);
        DB::table('club_world_turns')->insert(['club_id'=>2,'window_at'=>now(),'completed_at'=>now(),'summary'=>'[]']);
        $engine=app(LivingWorldEngine::class);$this->assertSame(1,$engine->tick()['event_wakes']);
        $first=DB::table('online_clubs')->where('id',1)->value('world_review_at');
        $this->assertSame(now()->addMinutes(15)->timestamp,\Carbon\Carbon::parse($first)->timestamp);
        $this->travel(5)->minutes();$this->assertSame(0,$engine->tick()['event_wakes']);
        $this->assertSame($first,DB::table('online_clubs')->where('id',1)->value('world_review_at'));
    }

    public function test_failed_review_does_not_starve_other_clubs_and_has_a_retry_delay(): void
    {
        $this->clubs(2);$this->noSocial();
        $this->mock(BotClubManager::class)->shouldReceive('run')->andReturnUsing(function($id){if($id===1)throw new \RuntimeException('isolated failure');});
        $result=app(LivingWorldEngine::class)->tick();
        $this->assertSame(1,$result['failed_reviews']);$this->assertSame(1,$result['reviewed']);
        $this->assertSame(now()->addMinutes(30)->timestamp,\Carbon\Carbon::parse(DB::table('online_clubs')->where('id',1)->value('world_review_at'))->timestamp);
    }

    public function test_a_durable_pending_batch_prevents_more_jobs_even_after_cache_loss(): void
    {
        DB::table('jobs')->insert(['queue'=>'world','payload'=>'{}','attempts'=>0,'available_at'=>now()->timestamp,'created_at'=>now()->timestamp]);
        Cache::flush();AdvanceLivingWorld::enqueue();
        Queue::assertNothingPushed();$this->assertDatabaseCount('jobs',1);
    }

    public function test_dispatched_batch_uses_the_shared_workers_low_priority_queue(): void
    {
        AdvanceLivingWorld::enqueue();
        Queue::assertPushed(AdvanceLivingWorld::class,fn($job)=>$job->queue==='world' && $job->timeout===25);
    }

    public function test_arena_play_takes_priority_without_altering_or_settling_the_match(): void
    {
        $this->clubs(2);$this->mock(BotClubManager::class)->shouldNotReceive('run');
        $id=(string)\Illuminate\Support\Str::uuid();
        DB::table('online_matches')->insert(['id'=>$id,'blue_user_id'=>10001,'red_user_id'=>10002,'status'=>'allocated','plan'=>'{}','plan_hash'=>str_repeat('a',64)]);
        $engine=app(LivingWorldEngine::class);
        $this->assertSame('match_priority',$engine->tick()['deferred']);
        DB::table('online_matches')->where('id',$id)->update(['status'=>'running']);
        $this->assertSame('match_priority',$engine->pressure());
        $this->assertDatabaseHas('online_matches',['id'=>$id,'status'=>'running','sequence'=>0,'result'=>null]);
        DB::table('online_matches')->where('id',$id)->update(['status'=>'interrupted']);
        $this->assertNull($engine->pressure());
        $this->assertDatabaseHas('online_matches',['id'=>$id,'status'=>'interrupted','result'=>null]);
    }
}
