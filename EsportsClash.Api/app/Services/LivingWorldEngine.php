<?php

namespace App\Services;

use App\Models\OnlineClub;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\{Cache, DB, Schema};

/** Bounded coordinator for optional autonomy. Core gameplay never depends on this service. */
class LivingWorldEngine
{
    public function ready(): bool { return Schema::hasTable('living_world_runtime'); }

    public function pressure(): ?string
    {
        // Measure ready core work, excluding delayed/reserved jobs and this low-priority queue.
        $core = DB::table('jobs')->where('queue', '<>', 'world')->whereNull('reserved_at')->where('available_at', '<=', now()->timestamp);
        if ((clone $core)->limit((int)config('living_world.core_queue_limit',20))->get(['id'])->count() >= (int)config('living_world.core_queue_limit',20)) return 'core_backlog';
        $oldest = (clone $core)->min('available_at');
        if ($oldest !== null && $oldest < now()->timestamp - (int)config('living_world.core_oldest_seconds',120)) return 'core_waiting';
        if (DB::table('online_matches')->whereIn('status',['allocated','running'])->exists()) return 'match_priority';
        return null;
    }

    /** Called while the canonical catalog/club locks are held by the takeover transaction. */
    public function takenOver(OnlineClub $club): void
    {
        if (!$this->ready()) return;
        // The epoch invalidates any pre-takeover candidate/job. Binding bids and entries remain.
        DB::table('online_clubs')->where('id',$club->id)->increment('management_epoch');
        DB::table('online_clubs')->where('id',$club->id)->update(['world_review_at'=>null]);
        if(app(WorldCareers::class)->ready())app(WorldCareerContracts::class)->reconcileTakeover($club->id);
        if (!OnlineClub::where('is_bot',true)->exists()) {
            DB::table('living_world_runtime')->where('id',1)->update([
                'management_state'=>'retired', 'retired_at'=>now(), 'updated_at'=>now()]);
        }
    }

    public function managementAllowed(): bool
    {
        return !$this->ready() || DB::table('living_world_runtime')->where('id',1)->value('management_state') !== 'retired';
    }

    public function tick(): array
    {
        $metrics=['reviewed'=>0,'failed_reviews'=>0,'observed'=>0,'published'=>0,'event_wakes'=>0,'deferred'=>null];
        if (!$this->ready() || !config('living_world.enabled',true)) return $metrics+['status'=>'disabled'];
        $lock=Cache::lock('living-world:v1',120);
        if (!$lock->get()) return $metrics+['status'=>'busy'];
        $start=microtime(true);
        try {
            $runtime=DB::table('living_world_runtime')->find(1);
            // A scheduler/retry cannot perform the same five-minute batch twice.
            $slot=now()->utc()->startOfMinute()->subMinutes(now()->utc()->minute%5);
            if ($runtime->last_tick_at && Carbon::parse($runtime->last_tick_at)->gte($slot)) return $metrics+['status'=>'already_ran'];
            $reason=$this->pressure();
            if ($reason) {
                $metrics['deferred']=$reason;
                return $this->record($metrics,$start);
            }
            DB::table('living_world_runtime')->where('id',1)->update(['last_tick_at'=>now(),'updated_at'=>now()]);
            // Careers share the same budget. No new process, queue, or per-agent fan-out.
            if(app(WorldCareers::class)->ready()){
                try{$metrics+=app(WorldBusinessEngine::class)->tick($start+($this->rehearsal()?3600:2));}
                catch(\Throwable $e){report($e);$metrics['career_errors']=1;}
            }
            if ($runtime->management_state !== 'retired') {
                $this->consumeEvents($runtime,$metrics);
                $clubs=OnlineClub::where('is_bot',true)->where(fn($q)=>$q->whereNull('world_review_at')->orWhere('world_review_at','<=',now()))
                    ->orderByRaw('CASE WHEN world_review_at IS NULL THEN 0 ELSE 1 END')->orderBy('world_review_at')->orderBy('id')
                    ->limit(max(1,min(32,(int)config('living_world.clubs_per_tick',8))))->get(['id','management_epoch']);
                $window=now()->utc()->startOfMinute()->subMinutes(now()->utc()->minute%15)->toIso8601String();
                foreach ($clubs as $club) {
                    // Reserve half the soft budget for social life; an individual atomic action
                    // may finish after that deadline and is never interrupted mid-transaction.
                    if (microtime(true)-$start >= ($this->rehearsal()?3600:(int)config('living_world.seconds_per_tick',8)/2) || $this->pressure()) break;
                    // The manager revalidates authority inside the transaction before any action.
                    try { app(BotClubManager::class)->run($club->id,$window,(int)$club->management_epoch); }
                    catch(\Throwable $error) {
                        report($error);$metrics['failed_reviews']++;
                        DB::table('online_clubs')->where('id',$club->id)->where('is_bot',true)->where('management_epoch',$club->management_epoch)
                            ->update(['world_review_at'=>now()->addMinutes(30)]);
                        continue;
                    }
                    DB::table('online_clubs')->where('id',$club->id)->where('is_bot',true)->where('management_epoch',$club->management_epoch)
                        ->update(['world_review_at'=>now()->addMinutes((int)config('living_world.review_minutes',120)+($club->id%17))]);
                    $metrics['reviewed']++;

                }
                if ($runtime->management_state==='awaiting_population' && OnlineClub::where('is_bot',true)->exists())
                    DB::table('living_world_runtime')->where('id',1)->update(['management_state'=>'active','updated_at'=>now()]);
            }
            // Social life is independent of the management lifecycle and coalesces source changes.
            if (!$this->expired($start) && !$this->pressure() && app(WireAccounts::class)->ready()) {
                if (!$runtime->last_sync_at || Carbon::parse($runtime->last_sync_at)->lte(now()->subMinutes((int)config('living_world.sync_minutes',60)))) {
                    app(WireAccounts::class)->sync($start+($this->rehearsal()?3600:(int)config('living_world.seconds_per_tick',8)));
                    DB::table('living_world_runtime')->where('id',1)->update(['last_sync_at'=>now()]);
                }
                if (!$this->expired($start)) {
                    $event=(int)DB::table('club_world_events')->max('id');
                    if ($event>$runtime->media_event_cursor || !$runtime->last_media_at || Carbon::parse($runtime->last_media_at)->lte(now()->subMinutes(15))) {
                        app(WorldMedia::class)->tick($start+($this->rehearsal()?3600:(int)config('living_world.seconds_per_tick',8)));
                        DB::table('living_world_runtime')->where('id',1)->update(['last_media_at'=>now(),'media_event_cursor'=>$event]);
                    }
                    $news=(int)DB::table('world_news_posts')->whereNull('source_post_id')->max('id');
                    if (!$this->expired($start) && ($news>$runtime->news_cursor || !$runtime->last_voice_at || Carbon::parse($runtime->last_voice_at)->lte(now()->subMinutes((int)config('living_world.quiet_voice_minutes',30))))) {
                        $voices=app(WorldVoiceSimulation::class)->tick($start+($this->rehearsal()?3600:(int)config('living_world.seconds_per_tick',8)));
                        $metrics['observed']=$voices['observed'];$metrics['published']=$voices['published'];
                        DB::table('living_world_runtime')->where('id',1)->update(['news_cursor'=>$news,'last_voice_at'=>now()]);
                    }
                }
            }
            return $this->record($metrics,$start);
        } finally { $lock->release(); }
    }

    private function rehearsal():bool {return config('living_world.deterministic_rehearsal',false)&&app()->environment('testing')&&config('database.default')==='sqlite'&&DB::connection()->getDatabaseName()===':memory:';}
    private function expired(float $start): bool { return microtime(true)-$start >= ($this->rehearsal()?3600:max(1,min(15,(int)config('living_world.seconds_per_tick',8)))); }

    private function consumeEvents(object $runtime, array &$metrics): void
    {
        // Durable cursor, finite catch-up; no per-character job or full-history scan.
        $events=DB::table('club_world_events')->where('id','>',$runtime->event_cursor)->orderBy('id')->limit(64)->get(['id','actor_club_id','kind','occurred_at','payload']);
        $ids=[];
        foreach($events as $event) {
            if (Carbon::parse($event->occurred_at)->lt(now()->subHours(2)) || !in_array($event->kind,['transfer','recruitment','competition','club'])) continue;
            $payload=json_decode($event->payload,true)??[];
            foreach ([$event->actor_club_id,$payload['buyer_id']??null,$payload['seller_id']??null] as $id) if($id)$ids[(int)$id]=max($ids[(int)$id]??'', $event->occurred_at);
        }
        foreach($ids as $id=>$occurred) $metrics['event_wakes']+=DB::table('online_clubs')->where('id',$id)->where('is_bot',true)
            // Ignore facts already considered by a committed review, including its own actions.
            ->whereNotExists(fn($q)=>$q->selectRaw('1')->from('club_world_turns as t')->whereColumn('t.club_id','online_clubs.id')->where('t.completed_at','>=',$occurred))
            ->where('world_review_at','>',now()->addMinutes((int)config('living_world.event_review_minutes',15)))
            ->update(['world_review_at'=>now()->addMinutes((int)config('living_world.event_review_minutes',15))]);
        if($events->isNotEmpty())DB::table('living_world_runtime')->where('id',1)->update(['event_cursor'=>$events->last()->id]);
    }

    private function record(array $metrics,float $start): array
    {
        $metrics['elapsed_ms']=(int)round((microtime(true)-$start)*1000);
        DB::table('living_world_runtime')->where('id',1)->update(['metrics'=>json_encode($metrics),'updated_at'=>now()]);
        return $metrics;
    }
}
