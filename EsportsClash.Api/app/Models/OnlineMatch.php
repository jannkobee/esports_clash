<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OnlineMatch extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected function casts(): array { return ['plan' => 'array', 'result' => 'array', 'started_at' => 'immutable_datetime', 'completed_at' => 'immutable_datetime', 'on_air_at' => 'immutable_datetime', 'spectator_ready' => 'boolean']; }

    public function toArray(): array
    {
        $out=parent::toArray();
        unset($out['plan']['fps_identity'], $out['plan']['fps_learning']);
        unset($out['result']['report']['identityExperiment'],$out['result']['report']['identityDevelopment'],
            $out['result']['report']['playbookExperience'], $out['result']['report']['orderObservations']);
        return $out;
    }

    public const FPS_FORMAT = 'MR15_TACTICAL_FPS';

    /** A tactical FPS result (settlement validated its MR15 report in OnlineService::validateFpsReport). */
    public function isFpsResult(): bool
    {
        return ($this->result['report']['format'] ?? null) === self::FPS_FORMAT;
    }

    /**
     * The verified winning side ('blue' or 'red'), or null. A completed, hashed result only: an FPS report must
     * carry the validated MR15 contract (winner, regulation score, rounds and the allocated map); a legacy
     * result needs the losing side's Nexus to have fallen. Nothing is inferred from a score or a timeout.
     */
    public function verifiedWinner(): ?string
    {
        if ($this->status !== 'completed' || ! $this->result_hash) return null;
        $winner = $this->result['winner'] ?? null;
        if (! in_array($winner, ['blue', 'red'], true)) return null;
        $report = $this->result['report'] ?? [];
        if (($report['format'] ?? null) === self::FPS_FORMAT) {
            return ($report['winnerTeam'] ?? null) === $winner && is_int($report['totalRounds'] ?? null) && $report['totalRounds'] >= 1
                && ($report['finalScore'][$winner] ?? 0) >= 16 && ($report['mapId'] ?? null) === ($this->plan['fps']['map_id'] ?? null) ? $winner : null;
        }
        return ($this->result['terminal_nexus'][$winner === 'blue' ? 'red' : 'blue'] ?? false) === true ? $winner : null;
    }

    /** Final round score of an FPS result ({blue, red}), null for legacy results. */
    public function finalScore(): ?array
    {
        $score = $this->result['report']['finalScore'] ?? null;
        return $this->isFpsResult() && is_int($score['blue'] ?? null) && is_int($score['red'] ?? null) ? ['blue' => $score['blue'], 'red' => $score['red']] : null;
    }

    /** Query counterpart of verifiedWinner(): settled FPS results, or legacy Nexus finishes. */
    public static function constrainVerified($query)
    {
        return $query->where('status', 'completed')->whereNotNull('result_hash')->where(fn ($q) => $q->where('result->report->format', self::FPS_FORMAT)
            ->orWhere(fn ($q) => $q->where('result->winner', 'blue')->where('result->terminal_nexus->red', true))
            ->orWhere(fn ($q) => $q->where('result->winner', 'red')->where('result->terminal_nexus->blue', true)));
    }

    /** Memo of pendingOnAir() for this instance (one query per request at most). */
    private ?array $onAirMemo = null;

    /** Not on air yet: before kickoff, or a live 3D game still waiting for the previous game on its stream. */
    public function isBeforeKickoff(): bool
    {
        $kickoff = $this->kickoffAt();
        if ($kickoff === null) return false;
        if ($this->on_air_at !== null) return $this->on_air_at->isFuture();
        return $kickoff->isFuture() || $this->awaitsOnAir();
    }

    /** A live 3D fixture past kickoff, with no recorded on-air time, that cannot go on air yet. */
    public function awaitsOnAir(): bool
    {
        if (! $this->onAirUndecided()) return false;
        $at = ($this->onAirMemo ??= [$this->pendingOnAir()])[0];
        return $at === null || $at->isFuture();
    }

    private function onAirUndecided(): bool
    {
        return $this->on_air_at === null && $this->usesLiveEngine() && isset($this->plan['fixture'])
            && in_array($this->status, ['allocated', 'running'], true) && ! ($this->kickoffAt()?->isFuture() ?? true);
    }

    /**
     * When this live 3D game goes on air: its kickoff, or the end of the previous game on the same tournament
     * stream plus the break. Null while that previous game is still on air (held). It is only known once the
     * previous game has ended, so a delay never reveals that game's length in advance.
     */
    private function pendingOnAir(): ?\Carbon\CarbonImmutable
    {
        $at = $this->kickoffAt();
        $fixture = ClubFixture::find($this->plan['fixture']['id'] ?? 0);
        if (! $fixture?->tournament_id) return $at;
        $earlier = ClubFixture::where('tournament_id', $fixture->tournament_id)->where('broadcast_stream', $fixture->broadcast_stream ?? 0)
            ->where('kickoff_at', '<', $fixture->kickoff_at)->where('kickoff_at', '>=', $fixture->kickoff_at->subHours(12))
            ->whereNotNull('match_id')->where('id', '<>', $fixture->id)->with('match:id,status,completed_at')->get();
        $airing = $earlier->contains(fn (ClubFixture $f) => in_array($f->match?->status, ['allocated', 'running'], true));
        if ($airing && now()->lt($at->addMinutes(max(0, (int) config('competitions.broadcast_max_hold_minutes', 180))))) return null;
        $ended = $earlier->map(fn (ClubFixture $f) => $f->match?->status === 'completed' ? $f->match->completed_at : null)->filter()->max();
        if ($ended) $at = $at->max(\Carbon\CarbonImmutable::instance($ended)->addMinutes(max(0, (int) config('competitions.broadcast_break_minutes', 15))));
        return $airing ? $at->max(now()->toImmutable()) : $at; // Held past the limit: on air now.
    }

    /** Record the on-air time once it is known (PollOnlineMatch). Null while the game is held. */
    public function resolveOnAir(): ?\Carbon\CarbonImmutable
    {
        if ($this->on_air_at !== null) return $this->on_air_at;
        if (! $this->onAirUndecided()) return null;
        $this->onAirMemo = null;
        $at = $this->pendingOnAir();
        if ($at === null) return null;
        static::whereKey($this->id)->whereNull('on_air_at')->update(['on_air_at' => $at->utc()]);
        $this->refresh();
        return $this->on_air_at;
    }

    /** Official live 3D engine (simulated ahead, watched as a recorded broadcast). */
    public function usesLiveEngine(): bool
    {
        return ($this->plan['game_mode'] ?? null) === 'fps_mr15_v1' && ($this->plan['fps']['simulation_version'] ?? 0) === 5;
    }

    public function kickoffAt(): ?\Carbon\CarbonImmutable
    {
        $kickoff = $this->plan['fixture']['kickoff_at'] ?? null;
        return $kickoff !== null ? \Carbon\CarbonImmutable::parse($kickoff) : null;
    }

    /** Live 3D matches may be simulated before kickoff; the result stays private until the broadcast reaches it. */
    public function isBeforeComputeWindow(): bool
    {
        $kickoff = $this->kickoffAt();
        if ($kickoff === null) return false;
        $opens = $this->usesLiveEngine() ? $kickoff->subMinutes(max(0, (int) config('online.precompute_minutes', 90))) : $kickoff;
        return $opens->isFuture();
    }

    /** When the broadcast clock starts: the on-air time (kickoff unless held), the first worker start otherwise. */
    public function broadcastStartsAt(): ?\Carbon\CarbonImmutable
    {
        if ($this->on_air_at !== null) return $this->on_air_at;
        if ($this->onAirUndecided() && ($at = ($this->onAirMemo ??= [$this->pendingOnAir()])[0]) !== null) return $at;
        return $this->kickoffAt() ?? $this->started_at;
    }

    /** Seconds of the broadcast a viewer may see now (everything once the match is settled). */
    public function broadcastSecondsVisible(): float
    {
        if ($this->status === 'completed') return INF;
        if ($this->awaitsOnAir()) return 0.0;
        $start = $this->broadcastStartsAt();
        return $start === null || $start->isFuture() ? 0.0 : (float) $start->diffInMilliseconds(now()) / 1000;
    }

    /** The match worker that simulates (and serves) this match: stable per match across several workers. */
    public function workerUrl(): string
    {
        $urls = array_values(array_filter(array_map('trim', explode(',', (string) config('online.worker_urls')))));
        if (! $urls) $urls = [(string) config('online.worker_url')];
        return rtrim($urls[crc32($this->id) % count($urls)], '/');
    }

    public function belongsToParticipant(int $userId): bool
    {
        return in_array($userId, [$this->blue_user_id, $this->red_user_id], true);
    }

    public function canSpectate(): bool
    {
        return $this->spectator_ready && isset($this->plan['fixture']) && ! $this->isBeforeKickoff()
            && in_array($this->status, ['running', 'completed', 'interrupted'], true);
    }
}
