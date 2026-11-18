<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;

class ClubFixture extends Model
{
    protected $guarded = [];
    protected $hidden = ['home_orders', 'away_orders', 'home_plan', 'away_plan'];

    protected function casts(): array
    {
        return ['kickoff_at' => 'immutable_datetime', 'orders_close_at' => 'immutable_datetime',
            'home_orders' => 'array', 'away_orders' => 'array', 'home_plan' => 'array', 'away_plan' => 'array', 'result_score' => 'array'];
    }

    /**
     * Live 3D fixtures draw their map when they are published, so managers can prepare while orders are open.
     * The match seed stays random and is still drawn at allocation; only the map is known earlier.
     */
    protected static function booted(): void
    {
        static::creating(function (ClubFixture $fixture) {
            static $hasMap = null;
            if ($fixture->map_id === null && (int) config('online.fps_simulation_version', 5) >= 5
                && ($hasMap ??= \Illuminate\Support\Facades\Schema::hasColumn('club_fixtures', 'map_id'))) {
                $maps = \App\Services\OnlineService::FPS_LIVE_MAPS;
                $fixture->map_id = $maps[random_int(0, count($maps) - 1)];
            }
        });
    }

    /** Copy a verified outcome onto the fixture (lists read this instead of whole match results). */
    public function recordOutcome(OnlineMatch $match): void
    {
        $winner = $match->verifiedWinner();
        if ($winner === null) return;
        $score = $match->finalScore();
        $this->update(['result_winner' => $winner, 'result_score' => $score ? $score + ['map' => $match->result['report']['mapId'] ?? null, 'map_name' => $match->result['report']['mapName'] ?? null] : null]);
    }

    /** 'win', 'loss' or null from one club's point of view. */
    public function outcomeFor(int $clubId): ?string
    {
        if ($this->result_winner === null) return null;
        $side = $this->home_club_id === $clubId ? 'blue' : ($this->away_club_id === $clubId ? 'red' : null);
        return $side === null ? null : ($side === $this->result_winner ? 'win' : 'loss');
    }

    public function homeClub() { return $this->belongsTo(OnlineClub::class); }
    public function awayClub() { return $this->belongsTo(OnlineClub::class); }
    public function match() { return $this->belongsTo(OnlineMatch::class); }
    public function tournament() { return $this->belongsTo(ClubTournament::class); }
    public function homeNation() { return $this->belongsTo(NationalTeam::class, 'home_national_team_id'); }
    public function awayNation() { return $this->belongsTo(NationalTeam::class, 'away_national_team_id'); }

    public static function conflicts(array $clubIds, CarbonInterface $kickoff): bool
    {
        $hours = \Illuminate\Support\Facades\Schema::hasTable('competition_settings')
            ? app(\App\Services\CompetitionCalendar::class)->settings()['recovery_hours'] : 1;
        $window = \Illuminate\Support\Facades\Schema::hasTable('competition_windows') && \Illuminate\Support\Facades\DB::table('competition_windows')
            ->where('starts_at','<',$kickoff->copy()->addHours($hours))->where('ends_at','>',$kickoff)->exists();
        return $window || static::whereBetween('kickoff_at', [$kickoff->copy()->subHours($hours), $kickoff->copy()->addHours($hours)])
            ->where(fn ($query) => $query->whereIn('home_club_id', $clubIds)->orWhereIn('away_club_id', $clubIds))->exists();
    }

    /**
     * Minutes before kickoff that orders lock: 15, plus the live 3D engine's precompute window, so a
     * locked lineup is allocated before simulation has to start (105 by default; 15 for recorded matches).
     */
    public static function ordersLeadMinutes(): int
    {
        $live = (int) config('online.fps_simulation_version', 5) >= 5;
        return 15 + ($live ? max(0, (int) config('online.precompute_minutes', 90)) : 0);
    }

    public static function ordersCloseAt(CarbonInterface $kickoff): \Carbon\CarbonImmutable
    {
        return \Carbon\CarbonImmutable::instance($kickoff)->subMinutes(static::ordersLeadMinutes());
    }

    /** Worker capacity guard: this UTC clock hour already holds `competitions.kickoffs_per_hour` kickoffs. */
    public static function hourFull(CarbonInterface $kickoff): bool
    {
        $cap = (int) config('competitions.kickoffs_per_hour', 0);
        if ($cap <= 0) return false;
        $hour = \Carbon\CarbonImmutable::instance($kickoff)->utc()->startOfHour();
        return static::where('kickoff_at', '>=', $hour)->where('kickoff_at', '<', $hour->addHour())->count() >= $cap;
    }

    /** The first kickoff at or after this time whose clock hour still has capacity (same minute past the hour). */
    public static function nextOpenKickoff(CarbonInterface $kickoff): \Carbon\CarbonImmutable
    {
        $at = \Carbon\CarbonImmutable::instance($kickoff);
        for ($i = 0; $i < 24 * 28 && static::hourFull($at); $i++) $at = $at->addHour();
        abort_if(static::hourFull($at), 409, 'Every kickoff hour in the next four weeks is fully booked.');
        return $at;
    }

    /** Another game of the same tournament stream kicks off within one broadcast slot of this time. */
    public static function streamBusy(int $tournamentId, int $stream, CarbonInterface $kickoff): bool
    {
        $slot = max(1, (int) config('competitions.broadcast_slot_minutes', 90));
        $at = \Carbon\CarbonImmutable::instance($kickoff);
        return static::where('tournament_id', $tournamentId)->where('broadcast_stream', $stream)
            ->where('kickoff_at', '>', $at->subMinutes($slot))->where('kickoff_at', '<', $at->addMinutes($slot))->exists();
    }

    public static function awaitingSnapshot(int $clubId): bool
    {
        return static::whereNull('match_id')->whereNull('hold_reason')->where('orders_close_at', '<=', now())
            ->where(fn ($query) => $query->where('home_club_id', $clubId)->orWhere('away_club_id', $clubId))->exists();
    }
}
