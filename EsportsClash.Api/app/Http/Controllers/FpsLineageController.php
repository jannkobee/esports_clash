<?php

namespace App\Http\Controllers;

use App\Services\AutomaticLearningBundle;
use App\Services\FpsLineageStore;
use App\Services\FpsOfficialLearning;
use App\Services\FpsPlaybookValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use RuntimeException;

/**
 * Team learning lineages. Reads serve each kind's current version verbatim (matches fetch both teams'
 * lineages at start); writes come from the headless learning worker with its bearer token and only
 * ever append versions or events.
 */
final class FpsLineageController extends Controller
{
    public function current(Request $request, string $key, FpsLineageStore $store): Response|JsonResponse
    {
        if (str_starts_with($key, FpsOfficialLearning::LINEAGE_PREFIX)) $this->authorizeWriter($request);
        $lineage = $store->find($key);
        if (! $lineage) return response()->json(['version' => 1, 'lineage' => $key, 'kinds' => (object) []]);
        $parts = [];
        foreach (FpsLineageStore::KINDS as $kind) {
            $state = $store->state($lineage, $kind);
            if (! $state['current']) continue;
            try {
                $bytes = $store->payload($state['current']);
            } catch (RuntimeException) {
                abort(503);
            }
            $parts[] = json_encode($kind).':{"version":'.(int) $state['current']->version.',"sha256":'.json_encode($state['current']->sha256).',"payload":'.trim($bytes).'}';
        }
        return response('{"version":1,"lineage":'.json_encode($key).',"kinds":{'.implode(',', $parts).'}}', 200, ['Content-Type' => 'application/json']);
    }

    public function history(Request $request, string $key, FpsLineageStore $store): JsonResponse
    {
        if (str_starts_with($key, FpsOfficialLearning::LINEAGE_PREFIX)) $this->authorizeWriter($request);
        $lineage = $store->find($key);
        abort_unless($lineage, 404);
        $kinds = [];
        foreach (FpsLineageStore::KINDS as $kind) {
            $state = $store->state($lineage, $kind);
            $kinds[$kind] = ['current' => $state['current']?->version, 'paused' => $state['paused'], 'versions' => $state['versions']];
        }
        return response()->json(['version' => 1, 'lineage' => $key, 'kinds' => $kinds]);
    }

    public function append(Request $request, string $key, FpsLineageStore $store, AutomaticLearningBundle $bundles, FpsPlaybookValidator $playbooks): JsonResponse
    {
        $this->authorizeWriter($request);
        $data = $request->validate([
            'kind' => ['required', 'string', 'in:'.implode(',', FpsLineageStore::KINDS)],
            // Raw JSON text, stored byte-for-byte (decoding and re-encoding would turn {} into []).
            'payload' => ['required', 'string', 'max:'.FpsLineageStore::PAYLOAD_MAX_BYTES],
            'origin' => ['required', 'string', 'regex:/^[a-z-]{1,32}$/'],
            'parent_version' => ['nullable', 'integer', 'min:1'],
            'metrics' => ['nullable', 'array'],
            'promote' => ['sometimes', 'boolean'],
            'reason' => ['nullable', 'string', 'max:240'],
        ]);
        try {
            $payload = json_decode($data['payload'], true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            abort(422, 'Payload is not JSON');
        }
        abort_unless(is_array($payload), 422, 'Payload must be a JSON object');
        $valid = match ($data['kind']) {
            'bundle' => $bundles->valid($payload),
            'utility' => $bundles->validUtility($payload),
            'playbook' => $playbooks->validPlaybook($payload),
            'opponents' => $playbooks->validOpponents($payload),
        };
        abort_unless($valid, 422, 'Invalid learned model payload');
        $lineage = $store->lineage($key);
        $parentId = null;
        if (isset($data['parent_version'])) {
            $parentId = \Illuminate\Support\Facades\DB::table('fps_model_versions')
                ->where(['lineage_id' => $lineage->id, 'kind' => $data['kind'], 'version' => $data['parent_version']])->value('id');
            abort_unless($parentId, 422, 'Unknown parent version');
        }
        try {
            $version = $store->append($lineage, $data['kind'], $data['payload'], $data['origin'], $parentId, $data['metrics'] ?? null);
            if ($data['promote'] ?? false) $store->event($lineage, $data['kind'], 'promote', (int) $version->id, $data['reason'] ?? 'worker promotion', 'worker');
        } catch (RuntimeException $error) {
            abort(422, $error->getMessage());
        }
        return response()->json(['lineage' => $key, 'kind' => $data['kind'], 'version' => (int) $version->version, 'sha256' => $version->sha256], 201);
    }

    public function event(Request $request, string $key, FpsLineageStore $store): JsonResponse
    {
        $this->authorizeWriter($request);
        $data = $request->validate([
            'kind' => ['required', 'string', 'in:'.implode(',', FpsLineageStore::KINDS)],
            'action' => ['required', 'string', 'in:promote,rollback,pause,resume'],
            'version' => ['nullable', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:240'],
        ]);
        $lineage = $store->find($key);
        abort_unless($lineage, 404);
        $versionId = null;
        if (isset($data['version'])) {
            $versionId = \Illuminate\Support\Facades\DB::table('fps_model_versions')
                ->where(['lineage_id' => $lineage->id, 'kind' => $data['kind'], 'version' => $data['version']])->value('id');
            abort_unless($versionId, 422, 'Unknown version');
        }
        try {
            $store->event($lineage, $data['kind'], $data['action'], $versionId, $data['reason'], 'worker');
        } catch (RuntimeException $error) {
            abort(422, $error->getMessage());
        }
        $state = $store->state($lineage, $data['kind']);
        return response()->json(['lineage' => $key, 'kind' => $data['kind'], 'current' => $state['current']?->version, 'paused' => $state['paused']]);
    }

    /** Bound for one finished match's submitted experience. */
    public const EXPERIENCE_MAX_BYTES = 262144;
    private const LAWFUL_OBSERVATION = ['opponentAttacked', 'plantSite', 'firstBlood', 'earlyRush', 'slowDefault', 'heavyUtility', 'saved', 'passiveAnchors'];

    /**
     * A signed-in manager submits a finished match's round results for their own club's lineage.
     * Schema-validated, size-bounded, deduplicated per lineage and match, append-only. Only called
     * plays, results and lawful observations are accepted (never raw browser storage).
     */
    public function submit(Request $request, string $key, FpsLineageStore $store): JsonResponse
    {
        abort_unless(preg_match('/^club:([0-9]{1,18})$/D', $key, $club), 403, 'Only club lineages accept match experience');
        $owned = \App\Models\OnlineClub::query()->where('id', (int) $club[1])->where('user_id', $request->user()->id)->exists();
        abort_unless($owned, 403, 'Not your club');
        abort_if(strlen($request->getContent()) > self::EXPERIENCE_MAX_BYTES, 413);
        $data = $request->validate([
            'match_ref' => ['required', 'string', 'regex:/^[A-Za-z0-9:_-]{8,64}$/'],
            'map' => ['required', 'string', 'regex:/^[a-z0-9-]{1,40}$/'],
            'rounds' => ['required', 'array', 'min:1', 'max:60'],
            'rounds.*.round' => ['required', 'integer', 'min:1', 'max:60'],
            'rounds.*.side' => ['required', 'string', 'in:attack,defense'],
            'rounds.*.play_id' => ['required', 'string', 'regex:/^(seed|v):[a-z0-9_]{1,40}$/'],
            'rounds.*.won' => ['required', 'boolean'],
            'rounds.*.opponent' => ['nullable', 'string', 'regex:/^(club:[0-9]{1,18}|worker:[a-z0-9-]{1,60}|exhibition:[a-z0-9-]{1,60})$/'],
            'rounds.*.observed' => ['nullable', 'array'],
            'rounds.*.observed.plantSite' => ['nullable', 'in:A,B'],
            'rounds.*.observed.firstBlood' => ['nullable', 'in:A,B,Mid'],
            'utility' => ['nullable', 'array', 'max:60'],
            'utility.*' => ['array'],
        ]);
        // Check the raw rounds: validated() drops undeclared nested keys, and nothing beyond the
        // declared fields may be stored.
        $rawRounds = (array) $request->input('rounds');
        foreach ($rawRounds as $round) {
            abort_if(! is_array($round) || array_diff(array_keys($round), ['round', 'side', 'play_id', 'won', 'opponent', 'observed']) !== [], 422, 'Unknown round fields');
            $observed = $round['observed'] ?? [];
            abort_unless(is_array($observed), 422);
            abort_if(array_diff(array_keys($observed), self::LAWFUL_OBSERVATION) !== [], 422, 'Only lawful observations are accepted');
            foreach (['opponentAttacked', 'earlyRush', 'slowDefault', 'heavyUtility', 'saved', 'passiveAnchors'] as $flag) {
                abort_if(array_key_exists($flag, $observed) && ! is_bool($observed[$flag]), 422);
            }
        }
        $lineage = $store->lineage($key, (int) $club[1]);
        $bytes = json_encode(['map' => $data['map'], 'rounds' => $rawRounds, 'utility' => $data['utility'] ?? []], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $inserted = \Illuminate\Support\Facades\DB::table('fps_lineage_experience')->insertOrIgnore([
            'lineage_id' => $lineage->id, 'match_ref' => $data['match_ref'], 'user_id' => $request->user()->id,
            'sha256' => hash('sha256', $bytes), 'payload' => $bytes, 'created_at' => now(),
        ]);
        return response()->json(['lineage' => $key, 'match_ref' => $data['match_ref'], 'accepted' => $inserted === 1], $inserted === 1 ? 201 : 200);
    }

    /** The learning worker pulls submitted experience in id order. */
    public function pending(Request $request): JsonResponse
    {
        $this->authorizeWriter($request);
        $after = max(0, (int) $request->query('after', 0));
        $rows = \Illuminate\Support\Facades\DB::table('fps_lineage_experience as e')->join('fps_team_lineages as l', 'l.id', '=', 'e.lineage_id')
            ->where('e.id', '>', $after)->orderBy('e.id')->limit(100)->get(['e.id', 'l.lineage_key', 'e.match_ref', 'e.sha256', 'e.payload']);
        return response()->json(['version' => 1, 'experience' => $rows->map(fn ($r) => ['id' => (int) $r->id, 'lineage' => $r->lineage_key, 'match_ref' => $r->match_ref,
            'sha256' => $r->sha256, 'payload' => json_decode($r->payload, true)])->all()]);
    }

    private function authorizeWriter(Request $request): void
    {
        $configured = (string) config('automatic_learning.writer_token');
        abort_unless(strlen($configured) >= 32 && hash_equals($configured, $request->bearerToken() ?? ''), 401);
    }
}
