<?php
namespace App\Services;

use App\Models\{ClubFixture, OnlineMatch};
use Illuminate\Support\Facades\DB;

/**
 * What happened in a settled match, built only from the stored, verified result (never from replay chunks,
 * which expire). The public part is the scoreline, rounds and player lines. The private part, for one club,
 * is the plan that was pinned for its side and the aggregated decisions its players were observed making.
 * Nothing private is exposed: no DNA, no raw tendencies, no other club's orders.
 */
class MatchDebrief
{
    public const GAMEPLAN = ['tempo' => ['Tempo', 'Measured', 'Fast'], 'structure' => ['Structure', 'Flexible', 'Assigned'],
        'aggression' => ['Contact risk', 'Conservative', 'Assertive'], 'preparation' => ['Preparation', 'Improvised', 'Prepared'],
        'freedom' => ['Individual freedom', 'Directed', 'Autonomous'], 'economy' => ['Economy', 'Spend now', 'Preserve resources']];
    public const BEHAVIOR = ['engagement' => 'Took the fight when one was available', 'firstContact' => 'Took first contact',
        'coordination' => 'Played off a teammate', 'rotation' => 'Rotated on a call', 'improvisation' => 'Improvised when the plan broke',
        'failedExecuteAdjustment' => 'Adjusted after a failed execute', 'opponentAdjustment' => 'Adjusted to the opponent',
        'sacrifice' => 'Gave up their life for the round', 'retake' => 'Joined a retake', 'utilitySupport' => 'Supported with utility',
        'lurkTiming' => 'Timed a lurk', 'risk' => 'Took a risky option', 'strategyCompliance' => 'Followed the called strategy'];
    public const REASONS = ['attackers_eliminated' => 'Attackers eliminated', 'defenders_eliminated' => 'Defenders eliminated',
        'device_exploded' => 'Bomb exploded', 'device_defused' => 'Bomb defused', 'time_expired' => 'Time ran out'];

    /** Public report of a fixture's settled match. */
    public function public(ClubFixture $fixture, OnlineMatch $m): array
    {
        $r = $m->result['report'] ?? [];
        $fps = $m->isFpsResult();
        $ratings = DB::table('club_player_match_ratings')->where('match_id', $m->id)->pluck('rating', 'card_id');
        $performance = collect($m->result['player_performance'] ?? [])->keyBy('instance_id');
        $players = [];
        foreach (['blue', 'red'] as $side) foreach ($m->plan[$side] as $i => $slot) {
            $id = $slot['instance_id'];
            $p = $m->plan['player_profiles'][$id] ?? [];
            $draft = $r['draft'][$side][$i] ?? [];
            $row = ['id' => $id, 'name' => $p['name'] ?? $m->plan['player_identities'][$id] ?? $draft['player']['name'] ?? 'Archived player',
                'team' => $side, 'nationality' => $p['nationality'] ?? null];
            if (! $fps) $row['avatar'] = $draft['champion']['displayName'] ?? $draft['champion']['name'] ?? $slot['avatar_id'] ?? null;
            if ($stats = $performance[$id] ?? null) $row['stats'] = array_intersect_key($stats, array_flip(['kills', 'deaths', 'assists', 'adr', 'headshot_rate', 'first_bloods', 'trade_kills', 'clutches_won', 'plants', 'defuses']));
            if (isset($ratings[$id])) $row['rating'] = (float) $ratings[$id];
            $players[] = $row;
        }
        $rounds = [];
        foreach ($fps ? ($r['roundResults'] ?? []) : [] as $round) {
            $n = (int) ($round['roundNumber'] ?? 0);
            $rounds[] = ['round' => $n, 'winner' => $round['winnerTeam'] ?? null, 'side' => $round['winnerSide'] ?? null,
                'reason' => self::REASONS[$round['reason'] ?? ''] ?? null, 'site' => $round['plantedSite'] ?? null,
                'pistol' => $n === 1 || $n === 16, 'score' => ['blue' => $round['blueScoreAfter'] ?? null, 'red' => $round['redScoreAfter'] ?? null],
                'seconds' => isset($round['roundDurationSeconds']) ? (float) $round['roundDurationSeconds'] : null];
        }
        return ['fixture_id' => $fixture->id, 'competition' => $fixture->competition, 'kickoff_at' => $fixture->kickoff_at, 'started_at' => $m->started_at,
            'completed_at' => $m->completed_at, 'match_id' => $m->id, 'clubs' => $m->plan['clubs'], 'winner' => $m->result['winner'],
            'verified' => $m->verifiedWinner() !== null, 'format' => $fps ? 'fps' : 'legacy', 'duration_seconds' => $r['durationSeconds'] ?? null,
            'map' => $fps ? ['id' => $r['mapId'] ?? null, 'name' => $r['mapName'] ?? null] : null,
            'score' => $m->finalScore(), 'half_score' => $fps ? ($r['halfScore'] ?? null) : null, 'second_half_score' => $fps ? ($r['secondHalfScore'] ?? null) : null,
            'overtime_score' => $fps ? ($r['overtimeScore'] ?? null) : null, 'rounds' => $rounds,
            'blue_kills' => $r['blueKills'] ?? null, 'red_kills' => $r['redKills'] ?? null, 'terminal_nexus' => $m->result['terminal_nexus'] ?? null,
            'players' => $players, 'events' => array_map(fn ($e) => array_intersect_key($e, array_flip(['second', 'text', 'type', 'sequence', 'tick'])), $r['events'] ?? []),
            'provenance' => 'verified', 'execution' => array_intersect_key($m->result['execution'] ?? [], array_flip(['mode', 'from_second', 'notice'])),
            'tournament_id' => $fixture->tournament_id];
    }

    /** The owning club's view: its pinned plan and what its players were observed doing. */
    public function private(ClubFixture $fixture, OnlineMatch $m, int $clubId): array
    {
        $side = $fixture->home_club_id === $clubId ? 'blue' : ($fixture->away_club_id === $clubId ? 'red' : null);
        abort_if($side === null, 403);
        $pin = $m->plan['fps_identity'] ?? null;
        $team = $pin['teams'][$side] ?? null;
        $arch = app(FpsPlayerArchitecture::class);
        $gameplan = [];
        foreach (self::GAMEPLAN as $key => [$label, $low, $high]) {
            if (! isset($team['plan'][$key])) continue;
            $gameplan[] = ['key' => $key, 'label' => $label, 'low' => $low, 'high' => $high, 'level' => $arch->scale10((float) $team['plan'][$key] * 100)];
        }
        $summary = $m->result['report']['behaviorSummary'] ?? [];
        $snapshots = collect($m->result['report']['roundSnapshots'] ?? []);
        $players = [];
        foreach ($m->plan[$side] as $slot) {
            $id = $slot['instance_id'];
            $identity = $pin['players'][$id] ?? [];
            $observed = [];
            foreach (self::BEHAVIOR as $metric => $label) {
                $row = $summary[$id][$metric] ?? null;
                if (! $row || ($row['opportunities'] ?? 0) < 1) continue;
                $observed[] = ['metric' => $metric, 'label' => $label, 'attempts' => (int) $row['attempts'], 'opportunities' => (int) $row['opportunities']];
            }
            usort($observed, fn ($a, $b) => $b['opportunities'] <=> $a['opportunities']);
            $players[] = ['id' => $id, 'name' => $m->plan['player_profiles'][$id]['name'] ?? $m->plan['player_identities'][$id] ?? 'Player',
                'positions' => ['t' => $identity['assignments']['t'] ?? null, 'ct' => $identity['assignments']['ct'] ?? null],
                'instruction' => $identity['instruction'] ?? null, 'training_focus' => $identity['trainingFocus'] ?? null,
                'rounds_played' => $snapshots->where('playerId', $id)->count(), 'observed' => array_slice($observed, 0, 6)];
        }
        return ['side' => $side, 'coach' => $team['coachName'] ?? null, 'gameplan' => $gameplan,
            'fixture_plan' => $fixture->home_club_id === $clubId ? $fixture->home_plan : $fixture->away_plan, 'players' => $players,
            'notice' => $pin ? 'Observed counts come from this match only. They describe decisions, not accuracy.' : 'This match predates pinned tactical plans.'];
    }
}
