<?php
namespace App\Services;

use App\Models\{ClubFixture, OnlineClub, OnlineMatch};
use Illuminate\Support\Facades\DB;

/**
 * What a club may lawfully know about an opponent before a fixture: public results, rating, head-to-head
 * and the opponent's observed team tendencies (recorded match behaviour only, never DNA or natural
 * profiles). Categories stay empty until their thresholds are met and are never back-filled. The club's
 * analyst decides how many categories the report covers.
 */
class OpponentScouting
{
    public const CATEGORIES = ['opening' => 'Opening', 'execution' => 'Execution', 'midround' => 'Mid-round', 'defense' => 'Defense',
        'coordination' => 'Coordination', 'economy' => 'Economy', 'psychology' => 'Opponent reading', 'objective' => 'Objective', 'leadership' => 'Leadership adherence'];
    /** Mirrors FPS_OBSERVED_TEAM_MIN_OPPORTUNITIES / _MIN_MATCHES in fpsPlayerTendencies.ts. */
    public const MIN_OPPORTUNITIES = 15;
    public const MIN_MATCHES = 5;

    /**
     * Exact port of computeObservedTeamTendencies (fpsPlayerTendencies.ts): 0–100 per category or null.
     * @param array<int,array|null> $behaviors observed behaviour records that passed the per-player gate
     */
    public function teamTendencies(array $behaviors): array
    {
        $records = array_values(array_filter($behaviors, 'is_array'));
        $rate = function (string $metric) use ($records): ?float {
            $obs = 0; $opp = 0;
            foreach ($records as $b) { $m = $b['metrics'][$metric] ?? null; if (! $m) continue; $obs += $m['attempts'] ?? 0; $opp += $m['opportunities'] ?? 0; }
            return $opp >= self::MIN_OPPORTUNITIES ? $obs / $opp * 100 : null;
        };
        $blend = function (array $parts): ?float {
            $total = 0; $weight = 0;
            foreach ($parts as [$value, $w]) if ($value !== null) { $total += $value * $w; $weight += $w; }
            return $weight > 0 ? max(0, min(100, $total / $weight)) : null;
        };
        $inv = fn (?float $v) => $v === null ? null : 100 - $v;
        $samples = array_sum(array_map(fn ($b) => (int) ($b['matches'] ?? 0), $records));
        [$engagement, $first, $utility, $coordination, $retake, $rotation, $compliance, $improv, $failed, $oppAdj, $risk, $lurk, $sacrifice] = array_map($rate,
            ['engagement', 'firstContact', 'utilitySupport', 'coordination', 'retake', 'rotation', 'strategyCompliance', 'improvisation', 'failedExecuteAdjustment', 'opponentAdjustment', 'risk', 'lurkTiming', 'sacrifice']);
        $categories = [
            'opening' => $blend([[$engagement, .45], [$first, .55]]),
            'execution' => $blend([[$utility, .50], [$compliance, .50]]),
            'midround' => $blend([[$failed, .55], [$improv, .45]]),
            'defense' => $blend([[$retake, .55], [$inv($rotation), .45]]),
            'coordination' => $blend([[$coordination, .50], [$sacrifice, .15], [$compliance, .35]]),
            'economy' => $blend([[$inv($risk), .65], [$compliance, .35]]),
            'psychology' => $blend([[$oppAdj, .55], [$lurk, .45]]),
            'objective' => $blend([[$compliance, .55], [$retake, .45]]),
            'leadership' => $blend([[$compliance, .55], [$coordination, .45]]),
        ];
        if ($samples < self::MIN_MATCHES) $categories = array_map(fn () => null, $categories);
        return ['categories' => $categories, 'samples' => $samples];
    }

    /** Categories an analyst covers: 3 at the lowest rating, all nine at 10. */
    public static function analystDetail(int $scouting): int
    {
        return max(3, min(9, $scouting - 1));
    }

    public function report(ClubFixture $fixture, OnlineClub $club): array
    {
        $opponentId = $fixture->home_club_id === $club->id ? $fixture->away_club_id : $fixture->home_club_id;
        abort_unless($opponentId, 404, 'This fixture has no club opponent.');
        $opponent = OnlineClub::findOrFail($opponentId);
        $analyst = collect(app(ClubStaffService::class)->roster($club))->firstWhere('role', 'analyst');
        $detail = self::analystDetail(ClubStaffService::analystQuality($analyst));
        // The opponent's most likely five: its saved default lineup (public through its fixtures and Hexapedia).
        $ids = array_column($opponent->starters ?? $opponent->lineup ?? [], 'instance_id');
        $behaviors = [];
        foreach (DB::table('fps_player_identities')->whereIn('player_id', $ids)->get(['player_id', 'behavior']) as $row) {
            $b = json_decode($row->behavior ?? 'null', true);
            // Same per-player gate as FpsIdentityProfiles::scouting (observed only once sufficient).
            if (is_array($b) && ($b['matches'] ?? 0) >= 5 && ($b['metrics']['engagement']['opportunities'] ?? 0) >= 30) $behaviors[] = $b;
        }
        $team = $this->teamTendencies($behaviors);
        $arch = app(FpsPlayerArchitecture::class);
        $known = array_filter($team['categories'], fn ($v) => $v !== null);
        uasort($known, fn ($a, $b) => abs($b - 50) <=> abs($a - 50));
        $covered = array_slice(array_keys($known), 0, $detail);
        $tendencies = [];
        foreach (self::CATEGORIES as $key => $label) {
            $value = in_array($key, $covered, true) ? $known[$key] : null;
            $tendencies[] = ['key' => $key, 'label' => $label] + ($value === null ? ['level' => null, 'reason' => isset($known[$key]) ? 'beyond your analyst\'s report' : 'not enough recorded matches'] : $arch->rated($value, 'tendency'));
        }
        $recent = ClubFixture::where(fn ($q) => $q->where('home_club_id', $opponentId)->orWhere('away_club_id', $opponentId))->whereNotNull('result_winner')
            ->with(['homeClub:id,name', 'awayClub:id,name'])->orderByDesc('kickoff_at')->limit(5)->get()
            ->map(fn (ClubFixture $f) => ['competition' => $f->competition, 'kickoff_at' => $f->kickoff_at, 'outcome' => $f->outcomeFor($opponentId),
                'opponent' => ($f->home_club_id === $opponentId ? $f->awayClub : $f->homeClub)?->name, 'score' => $f->result_score ? [($f->home_club_id === $opponentId ? 'blue' : 'red'), $f->result_score] : null]);
        $meetings = ClubFixture::where(fn ($q) => $q->where(fn ($q) => $q->where('home_club_id', $club->id)->where('away_club_id', $opponentId))
            ->orWhere(fn ($q) => $q->where('home_club_id', $opponentId)->where('away_club_id', $club->id)))->whereNotNull('result_winner')->get();
        $wins = $meetings->filter(fn (ClubFixture $f) => $f->outcomeFor($club->id) === 'win')->count();
        $rating = DB::table('competition_ratings')->where('system', 'HGR')->where('participant_id', $opponentId)->first();
        return ['club' => $opponent->only(['id', 'name', 'tag', 'tier', 'identity']), 'is_bot' => (bool) $opponent->is_bot,
            'rating' => $rating ? ['score' => round((float) ($rating->score ?? 0), 1), 'games' => (int) ($rating->games ?? 0)] : null,
            'recent' => $recent, 'head_to_head' => ['games' => $meetings->count(), 'wins' => $wins, 'losses' => $meetings->count() - $wins],
            'tendencies' => $tendencies, 'samples' => $team['samples'], 'analyst' => ['name' => $analyst['name'] ?? null, 'categories' => $detail],
            'map' => $fixture->map_id ? ['id' => $fixture->map_id, 'name' => OnlineService::FPS_MAP_NAMES[$fixture->map_id] ?? ucfirst($fixture->map_id)] : null];
    }
}
