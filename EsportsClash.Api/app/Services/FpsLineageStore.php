<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Server-side source of truth for learned FPS models, per team lineage.
 *
 * Every version is an immutable row (content hash, parent, origin, metrics); large payloads live in
 * content-addressed files whose hash is checked on every read. Promotions, rollbacks and pauses are
 * appended events, and the current version is the fold of those events. Nothing is updated or
 * deleted, so learned skills cannot be lost by a later write.
 */
final class FpsLineageStore
{
    /** Learned-model kinds a lineage can hold. */
    public const KINDS = ['bundle', 'utility', 'playbook', 'opponents'];
    /** Payloads above this many bytes are stored as files (hash kept in the row). */
    public const INLINE_MAX_BYTES = 262144;
    /** Hard bound for one version payload. */
    public const PAYLOAD_MAX_BYTES = 16000000;
    private const DISK_DIRECTORY = 'fps-lineages';

    public function lineage(string $key, ?int $clubId = null, string $mapScope = '*', ?string $label = null): object
    {
        if (! preg_match('/^(club:[0-9]{1,18}|worker:[a-z0-9-]{1,60}|exhibition:[a-z0-9-]{1,60})$/D', $key)) {
            throw new RuntimeException('Invalid lineage key');
        }
        $existing = DB::table('fps_team_lineages')->where('lineage_key', $key)->first();
        if ($existing) return $existing;
        DB::table('fps_team_lineages')->insertOrIgnore([
            'lineage_key' => $key, 'club_id' => $clubId, 'map_scope' => $mapScope, 'label' => $label, 'created_at' => now(),
        ]);
        return DB::table('fps_team_lineages')->where('lineage_key', $key)->first();
    }

    public function find(string $key): ?object
    {
        return DB::table('fps_team_lineages')->where('lineage_key', $key)->first();
    }

    /**
     * Append a new immutable version. Identical bytes under the same lineage/kind return the existing
     * version instead of a duplicate row.
     */
    public function append(object $lineage, string $kind, string $bytes, string $origin, ?int $parentId = null, ?array $metrics = null): object
    {
        $this->kind($kind);
        if (! preg_match('/^[a-z-]{1,32}$/D', $origin)) throw new RuntimeException('Invalid origin');
        $size = strlen($bytes);
        if ($size === 0 || $size > self::PAYLOAD_MAX_BYTES) throw new RuntimeException('Payload size out of bounds');
        json_decode($bytes, true, 512, JSON_THROW_ON_ERROR);
        $sha = hash('sha256', $bytes);
        return DB::transaction(function () use ($lineage, $kind, $bytes, $sha, $size, $origin, $parentId, $metrics) {
            $duplicate = DB::table('fps_model_versions')->where(['lineage_id' => $lineage->id, 'kind' => $kind, 'sha256' => $sha])->orderBy('id')->first();
            if ($duplicate) return $duplicate;
            if ($parentId !== null && ! DB::table('fps_model_versions')->where(['id' => $parentId, 'kind' => $kind])->exists()) {
                throw new RuntimeException('Unknown parent version');
            }
            $path = null;
            if ($size > self::INLINE_MAX_BYTES) {
                $path = self::DISK_DIRECTORY.'/'.$sha.'.json';
                $disk = Storage::disk('local');
                if (! $disk->exists($path)) $disk->put($path, $bytes);
                if (hash('sha256', (string) $disk->get($path)) !== $sha) throw new RuntimeException('Stored payload checksum mismatch');
            }
            $version = (int) DB::table('fps_model_versions')->where(['lineage_id' => $lineage->id, 'kind' => $kind])->lockForUpdate()->max('version') + 1;
            $id = DB::table('fps_model_versions')->insertGetId([
                'lineage_id' => $lineage->id, 'kind' => $kind, 'version' => $version, 'parent_id' => $parentId, 'sha256' => $sha,
                'payload' => $path === null ? $bytes : null, 'payload_path' => $path, 'bytes' => $size, 'origin' => $origin,
                'metrics' => $metrics === null ? null : json_encode($metrics, JSON_THROW_ON_ERROR), 'created_at' => now(),
            ]);
            return DB::table('fps_model_versions')->find($id);
        });
    }

    /** The exact stored bytes, verified against the row's hash. */
    public function payload(object $version): string
    {
        $bytes = $version->payload ?? Storage::disk('local')->get((string) $version->payload_path);
        if (! is_string($bytes) || ! hash_equals($version->sha256, hash('sha256', $bytes))) {
            throw new RuntimeException('Version payload checksum mismatch');
        }
        return $bytes;
    }

    public function event(object $lineage, string $kind, string $action, ?int $versionId, string $reason, string $actor): void
    {
        $this->kind($kind);
        if (! in_array($action, ['promote', 'rollback', 'pause', 'resume'], true)) throw new RuntimeException('Invalid action');
        if (in_array($action, ['promote', 'rollback'], true) && $versionId !== null) {
            $version = DB::table('fps_model_versions')->find($versionId);
            if (! $version || (int) $version->lineage_id !== (int) $lineage->id || $version->kind !== $kind) throw new RuntimeException('Version is not in this lineage');
            if ($action === 'rollback' && ! DB::table('fps_lineage_events')->where(['lineage_id' => $lineage->id, 'kind' => $kind, 'action' => 'promote', 'version_id' => $versionId])->exists()) {
                throw new RuntimeException('Rollback target was never promoted');
            }
        }
        if ($action === 'promote' && $versionId === null) throw new RuntimeException('Promotion needs a version');
        DB::table('fps_lineage_events')->insert([
            'lineage_id' => $lineage->id, 'kind' => $kind, 'action' => $action, 'version_id' => $versionId,
            'reason' => mb_substr($reason, 0, 240), 'actor' => mb_substr($actor, 0, 80), 'created_at' => now(),
        ]);
    }

    /** Current version (fold of promote/rollback events), pause state and history counts. */
    public function state(object $lineage, string $kind): array
    {
        $this->kind($kind);
        $currentId = null; $paused = false;
        foreach (DB::table('fps_lineage_events')->where(['lineage_id' => $lineage->id, 'kind' => $kind])->orderBy('id')->get() as $event) {
            if ($event->action === 'promote' || $event->action === 'rollback') $currentId = $event->version_id;
            elseif ($event->action === 'pause') $paused = true;
            elseif ($event->action === 'resume') $paused = false;
        }
        return [
            'current' => $currentId === null ? null : DB::table('fps_model_versions')->find($currentId),
            'paused' => $paused,
            'versions' => DB::table('fps_model_versions')->where(['lineage_id' => $lineage->id, 'kind' => $kind])->count(),
        ];
    }

    private function kind(string $kind): void
    {
        if (! in_array($kind, self::KINDS, true)) throw new RuntimeException('Invalid model kind');
    }
}
