<?php

namespace App\Services;

/**
 * Structural checks for team playbooks and lawful opponent models, mirroring loadFpsTeamPlaybook /
 * loadFpsOpponentModel in EsportsClash.Web/src/fps/fpsLivePlaybook.ts. Clients still run their own
 * strict loaders; this guards what the server accepts into a lineage.
 */
final class FpsPlaybookValidator
{
    public const MAX_PLAYS_PER_SIDE = 400;
    public const MAX_VS_OPPONENTS = 64;
    public const MAX_OPPONENTS = 2000;
    private const ATTACK_FAMILIES = ['rush_a', 'rush_b', 'default_pick', 'split_a', 'split_b', 'fake_execute', 'mid_control'];
    private const DEFENSE_FAMILIES = ['standard', 'stack_a', 'stack_b', 'aggressive_banana', 'mid_push', 'retake_setup'];
    private const ATTACK_RANGES = ['rushBelow' => [0, 1], 'rushSmokeBelow' => [0, 1], 'midOpenBelow' => [0, 1], 'defaultMidAbove' => [.5, 2], 'fakeOpenBelow' => [0, 1],
        'fakeSmokeAbove' => [0, 2], 'lurkerHoldBelow' => [0, 1], 'fakeWindow' => [14, 36], 'pistolWeight' => [.5, 3]];
    private const DEFENSE_RANGES = ['stackSlots' => [3, 4], 'quietOpenBelow' => [0, .6], 'midPushBelow' => [0, 1]];
    private const DEFENSE_FLAGS = ['flexMid', 'flexMidOrientation', 'anchorGallery', 'rotatorDeck', 'aggressivePair', 'midPushPair'];

    public function validPlaybook(array $book): bool
    {
        if (($book['version'] ?? null) !== 1 || ! is_string($book['map'] ?? null) || ! preg_match('/^[a-z0-9-]{1,40}$/D', $book['map'])) return false;
        foreach (['rounds', 'innovations', 'promotions', 'archived'] as $key) if (! $this->number($book[$key] ?? null, 0, 1e9)) return false;
        if (! $this->plays($book['attack'] ?? null, 'attack') || ! $this->plays($book['defense'] ?? null, 'defense')) return false;
        foreach (self::ATTACK_FAMILIES as $family) if (! isset($book['attack']['seed:'.$family])) return false;
        foreach (self::DEFENSE_FAMILIES as $family) if (! isset($book['defense']['seed:'.$family])) return false;
        return true;
    }

    public function validOpponents(array $model): bool
    {
        $opponents = $model['opponents'] ?? null;
        if (($model['version'] ?? null) !== 1 || ! is_array($opponents) || count($opponents) > self::MAX_OPPONENTS) return false;
        foreach ($opponents as $key => $p) {
            if (! is_string($key) || strlen($key) > 80 || ! is_array($p)) return false;
            $values = [$p['rounds'] ?? null, $p['attackRounds'] ?? null, $p['earlyRush'] ?? null, $p['slowDefault'] ?? null, $p['heavyUtility'] ?? null, $p['saves'] ?? null,
                $p['passiveAnchors'] ?? null, $p['plants']['A'] ?? null, $p['plants']['B'] ?? null, $p['firstBlood']['A'] ?? null, $p['firstBlood']['B'] ?? null, $p['firstBlood']['Mid'] ?? null];
            foreach ($values as $value) if (! $this->number($value, 0, 1e9)) return false;
            // Only lawful observation fields: anything else (such as an opponent's play ids) is refused.
            if (array_diff(array_keys($p), ['rounds', 'attackRounds', 'plants', 'firstBlood', 'earlyRush', 'slowDefault', 'heavyUtility', 'saves', 'passiveAnchors'])) return false;
        }
        return true;
    }

    private function plays(mixed $plays, string $side): bool
    {
        if (! is_array($plays) || count($plays) > self::MAX_PLAYS_PER_SIDE) return false;
        foreach ($plays as $id => $record) {
            if (! is_string($id) || ! preg_match('/^(seed|v):[a-z0-9_]{1,40}$/D', $id) || ! is_array($record)) return false;
            $spec = $record['spec'] ?? null;
            if (! is_array($spec) || ($spec['id'] ?? null) !== $id || ! is_string($spec['name'] ?? null) || mb_strlen($spec['name']) > 80) return false;
            if (! in_array($record['status'] ?? null, ['active', 'candidate', 'archived'], true)) return false;
            if (! $this->number($record['trials'] ?? null, 0, 1e9) || ! $this->number($record['wins'] ?? null, 0, $record['trials'])) return false;
            foreach (['generation', 'bornAt', 'statusAt'] as $key) if (! $this->number($record[$key] ?? null, 0, 1e9)) return false;
            if (isset($record['parent']) && (! is_string($record['parent']) || ! preg_match('/^(seed|v):[a-z0-9_]{1,40}$/D', $record['parent']))) return false;
            $vs = $record['vs'] ?? null;
            if (! is_array($vs) || count($vs) > self::MAX_VS_OPPONENTS) return false;
            foreach ($vs as $key => $s) {
                if (! is_string($key) || strlen($key) > 80 || ! is_array($s) || ! $this->number($s['trials'] ?? null, 0, 1e9) || ! $this->number($s['wins'] ?? null, 0, $s['trials'])) return false;
            }
            if ($side === 'attack') {
                if (! in_array($spec['family'] ?? null, self::ATTACK_FAMILIES, true) || ! in_array($spec['site'] ?? null, ['A', 'B', 'any'], true) || ! is_bool($spec['fake'] ?? null)) return false;
                foreach (self::ATTACK_RANGES as $key => [$lo, $hi]) if (! $this->number($spec[$key] ?? null, $lo, $hi)) return false;
            } else {
                if (! in_array($spec['family'] ?? null, self::DEFENSE_FAMILIES, true) || (isset($spec['stack']) && ! in_array($spec['stack'], ['A', 'B'], true))) return false;
                foreach (self::DEFENSE_RANGES as $key => [$lo, $hi]) if (! $this->number($spec[$key] ?? null, $lo, $hi)) return false;
                if (! is_int($spec['stackSlots'])) return false;
                foreach (self::DEFENSE_FLAGS as $flag) if (! is_bool($spec[$flag] ?? null)) return false;
            }
        }
        return true;
    }

    private function number(mixed $value, float $min, float $max): bool
    {
        return (is_int($value) || is_float($value)) && is_finite((float) $value) && $value >= $min && $value <= $max;
    }
}
