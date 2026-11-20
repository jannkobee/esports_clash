<?php

namespace App\Services;

/**
 * Structural checks for an owner-approved FPS learning bundle before it is served.
 *
 * The client still runs its own bounded checkpoint validators; this guards the served bytes. The
 * utility brain is optional so bundles approved before it existed remain valid.
 */
final class AutomaticLearningBundle
{
    /** Mirrors FPS_UTILITY_BUNDLE_MAX_BYTES / FPS_UTILITY_BRAIN_LIMITS / FPS_UTILITY_ARCHIVE_LIMITS in the TypeScript brain. */
    public const UTILITY_MAX_BYTES = 8000000;
    public const UTILITY_MAX_ENTRIES = 800;
    public const UTILITY_MAX_SPOTS = 200;
    /** Consolidated tiers: memories leave the working set into the archive instead of being deleted. */
    public const UTILITY_MAX_ARCHIVE = 20000;
    public const UTILITY_MAX_AGGREGATES = 200000;
    public const UTILITY_MAX_AIM_OFFSET = 9;

    /** Owner-approved bundle with its immutable digest and original JSON shapes. */
    public function approved(): ?array
    {
        $directory = rtrim(config('automatic_learning.models_path', base_path('AutomaticLearning/models')), '/\\').'/';
        // The append-only registry (promotion/rollback history) takes precedence over the legacy pointer.
        $manifest = is_file($directory.'registry.json')
            ? $this->registryActive(json_decode(file_get_contents($directory.'registry.json'), true, 512, JSON_THROW_ON_ERROR))
            : (is_file($directory.'active.json') ? json_decode(file_get_contents($directory.'active.json'), true, 512, JSON_THROW_ON_ERROR) : []);
        if (($manifest['bundle'] ?? null) === null) {
            return null;
        }
        abort_unless(is_string($manifest['bundle']) && preg_match('/^[a-f0-9]{64}\.json$/D', $manifest['bundle']), 503);
        $path = $directory.$manifest['bundle'];
        abort_unless(is_file($path), 503);
        $bytes = file_get_contents($path);
        abort_unless(is_string($manifest['sha256'] ?? null) && hash_equals($manifest['sha256'], hash('sha256', $bytes)), 503);
        try {
            $bundle = json_decode($bytes, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            abort(503);
        }
        abort_unless(is_array($bundle) && $this->valid($bundle), 503);
        return ['sha256' => $manifest['sha256'], 'bytes' => $bytes];
    }

    /** Mirrors registryState() in infrastructure/automatic-learning/model.mjs. */
    private function registryActive(mixed $registry): array
    {
        abort_unless(is_array($registry) && ($registry['version'] ?? null) === 1 && is_array($registry['events'] ?? null), 503);
        $active = ['bundle' => null, 'sha256' => null];
        $promoted = [];
        foreach ($registry['events'] as $event) {
            $action = $event['action'] ?? null;
            if ($action === 'promote') {
                abort_unless(is_string($event['bundle'] ?? null) && preg_match('/^[a-f0-9]{64}\.json$/D', $event['bundle'])
                    && is_string($event['sha256'] ?? null) && preg_match('/^[a-f0-9]{64}$/D', $event['sha256']), 503);
                $promoted[$event['bundle']] = $event['sha256'];
                $active = ['bundle' => $event['bundle'], 'sha256' => $event['sha256']];
            } elseif ($action === 'rollback') {
                if (($event['bundle'] ?? null) === null) $active = ['bundle' => null, 'sha256' => null];
                else {
                    abort_unless(($promoted[$event['bundle']] ?? null) === ($event['sha256'] ?? false), 503);
                    $active = ['bundle' => $event['bundle'], 'sha256' => $event['sha256']];
                }
            } elseif (! in_array($action, ['pause', 'resume'], true)) abort(503);
        }
        return $active;
    }
    public function valid(array $bundle): bool
    {
        if (($bundle['version'] ?? null) !== 2 || ! is_string($bundle['engine'] ?? null) || ! preg_match('/^[a-f0-9]{64}$/D', $bundle['engine'])) return false;
        foreach (['navigation', 'combat', 'movement'] as $model) if (! is_array($bundle[$model] ?? null)) return false;
        // Optional per-map team playbooks and the lawful opponent model (bundles before them stay valid).
        $playbooks = new FpsPlaybookValidator();
        if (array_key_exists('playbooks', $bundle)) {
            if (! is_array($bundle['playbooks'])) return false;
            foreach ($bundle['playbooks'] as $map => $book) if (! is_array($book) || ($book['map'] ?? null) !== $map || ! $playbooks->validPlaybook($book)) return false;
        }
        if (array_key_exists('opponents', $bundle) && (! is_array($bundle['opponents']) || ! $playbooks->validOpponents($bundle['opponents']))) return false;
        return ! array_key_exists('utility', $bundle) || $this->validUtility($bundle['utility']);
    }

    public function validUtility(mixed $utility): bool
    {
        if (! is_array($utility) || ($utility['version'] ?? null) !== 1) return false;
        $encoded = json_encode($utility);
        if ($encoded === false || strlen($encoded) > self::UTILITY_MAX_BYTES) return false;
        foreach (['revision', 'throws', 'successes'] as $key) if (! is_int($utility[$key] ?? null) || $utility[$key] < 0) return false;
        if ($utility['successes'] > $utility['throws']) return false;
        $entries = $utility['entries'] ?? null;
        $spots = $utility['spots'] ?? null;
        if (! is_array($entries) || ! is_array($spots) || count($entries) > self::UTILITY_MAX_ENTRIES || count($spots) > self::UTILITY_MAX_SPOTS) return false;
        $max = self::UTILITY_MAX_AIM_OFFSET;
        $archive = $utility['archive'] ?? [];
        $spotArchive = $utility['spotArchive'] ?? [];
        $aggregates = $utility['aggregates'] ?? [];
        if (! is_array($archive) || ! is_array($spotArchive) || ! is_array($aggregates) || count($archive) > self::UTILITY_MAX_ARCHIVE
            || count($spotArchive) > self::UTILITY_MAX_ARCHIVE || count($aggregates) > self::UTILITY_MAX_AGGREGATES) return false;
        foreach ($aggregates as $key => $aggregate) {
            if (! is_string($key) || strlen($key) > 160 || ! is_array($aggregate) || ! $this->number($aggregate['attempts'] ?? null, 0, 1e9)
                || ! $this->number($aggregate['successes'] ?? null, 0, $aggregate['attempts']) || ! $this->number($aggregate['memories'] ?? null, 1, 1e9)) return false;
        }
        foreach ($spotArchive as $key => $spot) {
            if (! is_string($key) || strlen($key) > 120 || ! is_array($spot)
                || ! $this->number($spot['x'] ?? null, -80, 80) || ! $this->number($spot['z'] ?? null, -80, 80)
                || ! $this->number($spot['successes'] ?? null, 1, 1e6)) return false;
        }
        foreach ([...$entries, ...$archive] as $key => $entry) {
            if (! is_string($key) || strlen($key) > 120 || ! is_array($entry)) return false;
            if (! is_string($entry['style'] ?? null) || ! preg_match('/^[a-z-]{1,24}$/D', $entry['style'])) return false;
            if (! $this->number($entry['flight'] ?? null, .42, 3.4) || ! $this->number($entry['aimDx'] ?? null, -$max, $max)
                || ! $this->number($entry['aimDz'] ?? null, -$max, $max) || ! $this->number($entry['attempts'] ?? null, 1, 1e6)
                || ! $this->number($entry['successes'] ?? null, 0, $entry['attempts']) || ! $this->number($entry['lastError'] ?? null, 0, 99)) return false;
            if (! is_array($entry['rejected'] ?? null) || count($entry['rejected']) > 8) return false;
        }
        foreach ($spots as $key => $spot) {
            if (! is_string($key) || strlen($key) > 120 || ! is_array($spot)
                || ! $this->number($spot['x'] ?? null, -80, 80) || ! $this->number($spot['z'] ?? null, -80, 80)
                || ! $this->number($spot['successes'] ?? null, 1, 1e6)) return false;
        }
        return true;
    }

    private function number(mixed $value, float $min, float $max): bool
    {
        return (is_int($value) || is_float($value)) && is_finite((float) $value) && $value >= $min && $value <= $max;
    }
}
