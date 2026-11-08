<?php

namespace App\Services;

use App\Models\{OnlineClub, OnlineMatch, OwnedPlayerCard};
use Illuminate\Support\Collection;

class CoachDraftService
{
    public function draft(OnlineClub $blueClub, OnlineClub $redClub, array $blueRoster, array $redRoster, array $catalog, int $seed): array
    {
        $staff = app(ClubStaffService::class);
        $staffSnapshots = ['blue' => $staff->snapshot($blueClub), 'red' => $staff->snapshot($redClub)];
        $coaches = ['blue' => $staff->coachCard($blueClub), 'red' => $staff->coachCard($redClub)];
        $definitions = collect($catalog['cards'])->keyBy('id');
        $avatars = collect($catalog['avatars'])->values();
        $profiles = $this->playerDefinitions([...$blueRoster, ...$redRoster], $definitions);
        $meta = $this->metaForm();
        $assignments = ['blue' => [], 'red' => []];
        $unavailable = [];
        $turns = [['blue', 0], ['red', 0], ['red', 1], ['blue', 1], ['blue', 2],
            ['red', 2], ['red', 3], ['red', 4], ['blue', 3], ['blue', 4]];

        foreach ($turns as [$side, $slot]) {
            $roster = $side === 'blue' ? $blueRoster : $redRoster;
            $player = $roster[$slot] ?? null;
            if (! $player) {
                continue;
            }
            $opponentSide = $side === 'blue' ? 'red' : 'blue';
            $team = array_column($assignments[$side], 'avatar');
            $opponent = array_column($assignments[$opponentSide], 'avatar');
            $candidate = $this->bestAvatar(
                $avatars, $profiles[$player['instance_id']], $team, $opponent, $unavailable,
                $staffSnapshots[$side], $meta, $seed, $side, $slot,
            );
            if (! $candidate) {
                throw new \RuntimeException('The staff draft could not fill every starting slot.');
            }
            $unavailable[] = $candidate['id'];
            $assignments[$side][$slot] = [
                'player' => $player,
                'avatar' => $candidate,
            ];
        }

        $lineups = [];
        foreach (['blue', 'red'] as $side) {
            ksort($assignments[$side]);
            $lineups[$side] = array_map(fn (array $pick): array => [
                ...$pick['player'],
                'avatar_id' => $pick['avatar']['id'],
            ], array_values($assignments[$side]));
        }

        return [
            'blue' => $lineups['blue'],
            'red' => $lineups['red'],
            'staff' => $staffSnapshots,
            'coaches' => $coaches,
            'meta' => $meta,
        ];
    }

    private function playerDefinitions(array $rosters, Collection $definitions): array
    {
        $players = OwnedPlayerCard::whereIn('id', array_column($rosters, 'instance_id'))->get()->keyBy('id');
        $profiles = app(WorldPlayerProfiles::class);

        return collect($rosters)->mapWithKeys(function (array $slot) use ($players, $definitions, $profiles): array {
            $owned = $players[$slot['instance_id']];
            $template = $definitions[$owned->definition_id];

            return [$owned->id => $profiles->definition($owned, $template)];
        })->all();
    }

    private function bestAvatar(Collection $avatars, array $player, array $team, array $opponent, array $unavailable,
        array $staff, array $meta, int $seed, string $side, int $slot): ?array
    {
        $roles = array_unique(array_filter([
            ...($player['playableRoles'] ?? []),
            $player['preferredRole'] ?? null,
            $player['role'] ?? null,
        ]));
        $coach = $staff['head_coach']['attributes'];
        $assistant = $staff['assistant_coach']['attributes'];
        $analyst = $staff['analyst']['attributes'];
        $best = null;
        $bestScore = -INF;

        foreach ($avatars as $avatar) {
            if (in_array($avatar['id'], $unavailable, true)) {
                continue;
            }
            $primaryFit = in_array($avatar['primaryRole'], $roles, true);
            $secondaryFit = in_array($avatar['secondaryRole'] ?? null, $roles, true);
            if (! $primaryFit && ! $secondaryFit) {
                continue;
            }
            $score = $primaryFit ? 38 : 22;
            if (in_array($avatar['name'], $player['signatureChampions'] ?? [], true)) {
                $score += 10 + (float) ($player['stats']['flx'] ?? 50) / 20
                    + $coach['drafting'] / 5
                    + $analyst['scouting'] / 10
                    + $assistant['preparation'] / 10;
            }
            $metaScore = $meta[$avatar['id']] ?? null;
            if ($metaScore !== null && $metaScore['games'] >= 3) {
                $score += (($metaScore['win_rate'] - 0.5) * 12 + ($metaScore['pick_rate'] - 0.1) * 10)
                    * (($analyst['meta_reading'] + $analyst['data_quality'] + $analyst['scouting']) / 30);
            }
            if (in_array($avatar['primaryRole'], ['Tank', 'Fighter'], true)
                && ! collect($team)->contains(fn (array $pick) => in_array($pick['primaryRole'], ['Tank', 'Fighter'], true))) {
                $score += 8 * $coach['tactics'] / 10;
            }
            if (in_array($avatar['primaryRole'], ['Mage', 'Marksman'], true)
                && ! collect($team)->contains(fn (array $pick) => in_array($pick['primaryRole'], ['Mage', 'Marksman'], true))) {
                $score += 7 * $coach['adaptation'] / 10;
            }
            if (in_array($avatar['primaryRole'], ['Tank', 'Fighter', 'Support'], true)) {
                $score += (float) ($player['stats']['tf'] ?? 50) / 20 * $assistant['teamwork'] / 10;
            }
            if ($opponent) {
                $threat = count(array_filter($opponent, fn (array $pick) =>
                    ($pick['primaryRole'] === $avatar['primaryRole'])
                    || (($pick['secondaryRole'] ?? null) === $avatar['primaryRole'])));
                $score += min(4, $threat) * $analyst['counter_pick'] / 10;
            }
            $tie = hexdec(substr(hash('sha256', "$seed:$side:$slot:{$avatar['id']}"), 0, 7)) / 0xFFFFFFF;
            $score += $tie / 100;
            if ($score > $bestScore) {
                $best = $avatar;
                $bestScore = $score;
            }
        }

        return $best;
    }

    private function metaForm(): array
    {
        $records = OnlineMatch::where('status', 'completed')->whereNotNull('completed_at')
            ->where(fn($q)=>$q->whereNull('plan->fixture->progression->kind')->orWhere('plan->fixture->progression->kind','!=','community_fun'))
            ->where('completed_at', '>=', now()->subDays(90))
            ->orderByDesc('completed_at')->limit(500)->get(['plan', 'result']);
        $totals = [];
        $matchCount = 0;
        foreach ($records as $record) {
            if (($record->plan['fixture']['progression']['kind'] ?? null) === 'community_fun') continue;
            if (($record->plan['mode'] ?? null) !== 'normal'
                || ! isset($record->result['player_performance'], $record->result['report']['draft'])) {
                continue;
            }
            $matchCount++;
            foreach (['blue', 'red'] as $side) {
                $won = ($record->result['winner'] ?? null) === $side;
                foreach ($record->result['report']['draft'][$side] ?? [] as $pick) {
                    $id = $pick['champion']['id'] ?? null;
                    if (! is_string($id)) {
                        continue;
                    }
                    $totals[$id] ??= ['games' => 0, 'wins' => 0];
                    $totals[$id]['games']++;
                    $totals[$id]['wins'] += (int) $won;
                }
            }
        }
        $meta = [];
        foreach ($totals as $id => $row) {
            $meta[$id] = [
                'games' => $row['games'],
                'win_rate' => ($row['wins'] + 1) / ($row['games'] + 2),
                'pick_rate' => $row['games'] / max(1, $matchCount * 10),
            ];
        }

        return $meta;
    }
}
