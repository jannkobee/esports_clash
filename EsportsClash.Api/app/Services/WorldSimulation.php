<?php
namespace App\Services;

use App\Models\{ClubFixture, OnlineClub};
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\{Cache, DB};

/** One read model shared by the game and owner backoffice. No scheduler side effects. */
class WorldSimulation
{
    private function iso(?string $value): ?string { return $value ? Carbon::parse($value, 'UTC')->toIso8601String() : null; }

    public function snapshot(): array
    {
        return Cache::remember('world.simulation.v1', 10, function () {
            $clubs = OnlineClub::count();
            $managed = OnlineClub::where('is_bot', true)->count();
            $horizon=(int)config('living_world.review_minutes',120)+17;
            $reviewed = DB::table('club_world_turns as t')->join('online_clubs as c', 'c.id', '=', 't.club_id')->where('c.is_bot', true)->where('t.completed_at', '>=', now()->subMinutes($horizon))->distinct()->count('t.club_id');
            $runtime=\Illuminate\Support\Facades\Schema::hasTable('living_world_runtime')?DB::table('living_world_runtime')->find(1):null;
            $metrics=json_decode($runtime?->metrics??'{}',true)??[];
            $lastReview = DB::table('club_world_turns')->max('completed_at');
            $decisions = DB::table('bot_club_plans as p')->join('online_clubs as c', 'c.id', '=', 'p.club_id')->join('users as u', 'u.id', '=', 'c.user_id')->where('c.is_bot', true)->orderByDesc('p.reviewed_at')->limit(8)->get(['p.plan', 'p.reviewed_at', 'c.id', 'c.name', 'u.name as manager'])->map(function ($p) {
                $plan = json_decode($p->plan, true);
                $strategy = $plan['strategy'] ?? app(WorldManagerPolicy::class)->profile($p->id);
                // Funds, wages, internal bids and private fixture orders are deliberately excluded.
                return ['club_id' => $p->id, 'club' => $p->name, 'manager' => $p->manager, 'style' => $strategy['style'],
                    'priority' => $strategy['priority'] ?? 'Awaiting a fresh assessment', 'reviewed_at' => $this->iso($p->reviewed_at)];
            });
            $next = ClubFixture::whereNull('hold_reason')->where('kickoff_at', '>', now())->with(['homeClub:id,name', 'awayClub:id,name', 'homeNation:id,name', 'awayNation:id,name'])->orderBy('kickoff_at')->limit(3)->get()->map(fn ($f) => ['id' => $f->id, 'competition' => $f->competition, 'tournament_id' => $f->tournament_id,
                'home' => $f->homeClub?->name ?? $f->homeNation?->name ?? 'To be confirmed', 'away' => $f->awayClub?->name ?? $f->awayNation?->name ?? 'To be confirmed', 'kickoff_at' => $f->kickoff_at->toIso8601String()]);
            return ['observed_at' => now()->toIso8601String(), 'clubs' => $clubs, 'human_clubs' => $clubs - $managed, 'managed_clubs' => $managed,
                'reviewed_clubs' => $reviewed, 'review_window_minutes'=>$horizon, 'last_review_at' => $this->iso($lastReview), 'review_status' => !$managed ? 'no_managed_clubs' : ($reviewed >= $managed ? 'current' : ($reviewed ? 'partial' : 'delayed')),
                'engine'=>['profile'=>'lightweight','management_state'=>$runtime?->management_state??'not_installed',
                    'status'=>!config('living_world.enabled',true)?'paused':($metrics['deferred']??'ready'),
                    'clubs_per_batch'=>(int)config('living_world.clubs_per_tick',8), 'batch_minutes'=>5,
                    'social_persists'=>true,'last_tick_at'=>$this->iso($runtime?->last_tick_at)],
                'activity_24h' => DB::table('club_world_events')->where('occurred_at', '>=', now()->subDay())->count(),
                'stories_24h' => DB::table('world_news_posts')->whereNull('hidden_at')->where('published_at', '>=', now()->subDay())->count(),
                'live_matches' => DB::table('online_matches')->where('status', 'running')->count(),
                'open_auctions' => DB::table('club_auctions')->where('status', 'open')->where('closes_at', '>', now())->count(),
                'decisions' => $decisions->values()->all(), 'next_fixtures' => $next->values()->all(), 'narration' => ['status'=>app(WorldNarration::class)->status(),'mode'=>'simulation'],
                'jobs' => [
                    ['role' => 'player', 'task' => 'React to personal career news, the current club and Arena notes relevant to the player’s recorded role.'],
                    ['role' => 'manager', 'task' => 'Review roster, staff, payroll, auctions and competitions in staggered batches. Real events can bring a review forward. Human takeover ends manager authority.'],
                    ['role' => 'analyst', 'task' => 'Report competition entries, published events and verified records.'],
                    ['role' => 'streamer', 'task' => 'Cover recorded signings, transfers and observed player development.'],
                    ['role' => 'caster', 'task' => 'Cover scheduled broadcasts and accepted Arena finishes.'],
                    ['role' => 'referee', 'task' => 'Take collision-checked fixture appointments; match rules stay authoritative.'],
                    ['role' => 'observer', 'task' => 'Take collision-checked broadcast appointments.'],
                    ['role' => 'host', 'task' => 'Present the annual Laurels ceremony when eligible records exist.'],
                    ['role' => 'organizer', 'task' => 'Follow the organization’s published competitions. Human organizers write their own posts.'],
                    ['role' => 'tournament', 'task' => 'Publish notices from the actual tournament lifecycle and calendar.'],
                    ['role' => 'game', 'task' => 'Carry owner-authored Arena announcements with their actual announced or released status.'],
                ]];
        });
    }

    public function operations(): array
    {
        $runtime=\Illuminate\Support\Facades\Schema::hasTable('living_world_runtime')?DB::table('living_world_runtime')->find(1):null;
        $metrics=json_decode($runtime?->metrics??'{}',true)??[];
        return app(WorldCareerHealth::class)->snapshot()+['pending_jobs' => DB::table('jobs')->count(), 'failed_jobs' => DB::table('failed_jobs')->count(),
            'world_batch_ms'=>$metrics['elapsed_ms']??0,'world_batch_reviews'=>$metrics['reviewed']??0,
            'world_batch_failures'=>$metrics['failed_reviews']??0,
            'world_career_decisions'=>$metrics['career_decisions']??0,'world_career_admissions'=>$metrics['career_admissions']??0,'world_career_errors'=>$metrics['career_errors']??0,
            'world_waiting_clubs'=>$runtime?DB::table('online_clubs')->where('is_bot',true)->where(fn($q)=>$q->whereNull('world_review_at')->orWhere('world_review_at','<=',now()))->count():0,
            'voice_decisions_today' => \Illuminate\Support\Facades\Schema::hasTable('world_voice_memories')?DB::table('world_voice_memories')->where('observed_at','>=',now()->startOfDay())->count():0,
            'voice_posts_today' => \Illuminate\Support\Facades\Schema::hasTable('world_voice_memories')?DB::table('world_voice_memories')->where('outcome','published')->where('observed_at','>=',now()->startOfDay())->count():0,
            'held_fixtures' => DB::table('club_fixtures')->whereNotNull('hold_reason')->where('kickoff_at', '>=', now()->subWeek())->count(),
            'open_media_reports' => DB::table('world_media_reports')->where('status', 'open')->count()];
    }
}
