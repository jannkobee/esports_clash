<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\{ClubFixture, NormalQueueTicket, OnlineMatch, OwnedPlayerCard, ScrimmageQueueTicket};
use App\Services\OnlineService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class OnlineController extends Controller
{
    public function index(Request $request, OnlineService $service)
    {
        $club = $service->provision($request->user());
        if(app(\App\Services\WorldCareers::class)->ready())DB::table('online_clubs')->where('id',$club->id)->where(fn($q)=>$q->whereNull('manager_seen_at')->orWhere('manager_seen_at','<',now()->subMinutes(10)))->update(['manager_seen_at'=>now()]);
        $catalog = $service->activeCatalog();
        $cards = OwnedPlayerCard::where('user_id', $request->user()->id)->get()->map(function ($owned) use ($catalog) {
            $definition = app(\App\Services\WorldPlayerProfiles::class)->definition($owned,collect($catalog->payload['cards'])->firstWhere('id', $owned->definition_id));
            unset($definition['realName']);
            $definition['name']=$owned->persona_name??$definition['name'];
            return ['id' => $owned->id, 'definition' => $definition, 'catalog_version' => $owned->catalog_id,
                'training_xp' => $owned->training_xp];
        });
        $cardIds = $cards->pluck('id')->all();
        $rankedRatings = DB::query()->fromSub(
            DB::table('club_player_match_ratings')->whereIn('card_id', $cardIds)
                ->selectRaw('*, ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY created_at DESC, id DESC) as row_rank'),
            'ranked_ratings'
        )->where('row_rank', '<=', 10)->orderBy('row_rank')->get()->groupBy('card_id');
        $cards = $cards->map(function (array $card) use ($rankedRatings): array {
            $recent = $rankedRatings->get($card['id'], collect())->values();
            $form = app(\App\Services\PlayerForm::class)->summarize($recent);
            return [...$card,
                'recent_rating' => $recent->first()?->rating,
                'form' => $form,
                'recent_form_rating' => $form['score'],
                'recent_form' => $recent->map(fn ($row) => $row->won ? 'W' : 'L')->all(),
            ];
        });
        $content=app(\App\Services\GameContentService::class);$snapshot=$content->snapshot();
        $avatars = array_map(function ($avatar)use($content,$snapshot) { unset($avatar['realName']); return $content->avatar($avatar,$snapshot); }, $catalog->payload['avatars']);
        $scrimmageTicket = ScrimmageQueueTicket::where('user_id', $request->user()->id)->first();
        if ($scrimmageTicket?->status === 'matched') {
            $fixture = $scrimmageTicket->fixture_id ? ClubFixture::with('match')->find($scrimmageTicket->fixture_id) : null;
            if (! $fixture || ($fixture->kickoff_at->lte(now())
                && ! in_array($fixture->match?->status, ['allocated', 'running'], true))) {
                $scrimmageTicket = null;
            }
        }
        return response()->json(['data' => ['club' => [...$club->toArray(),
            'lineup' => array_map(fn (array $slot): array => ['instance_id' => $slot['instance_id']], $club->starters ?? $club->lineup)],
            'supporter'=>app(\App\Services\SupporterMembership::class)->status($request->user()),
            'cards' => $cards, 'avatars' => $avatars,
            'ticket' => NormalQueueTicket::where('user_id', $request->user()->id)->first(),
            'scrimmage_ticket' => $scrimmageTicket,
            'matches' => OnlineMatch::where(fn ($query) => $query->where('blue_user_id', $request->user()->id)->orWhere('red_user_id', $request->user()->id))
                ->latest()->limit(40)->get()->reject(fn (OnlineMatch $match) => $match->isBeforeKickoff())->take(20)->values(),
            'versions' => array_diff_key($catalog->manifest, ['sources' => true]), 'mode' => 'normal']]);
    }

    public function update(Request $request, OnlineService $service)
    {
        $data = $request->validate(['name' => ['sometimes', 'string', 'min:2', 'max:80'],
            'revision' => ['required', 'integer', 'min:1'], 'lineup' => ['sometimes', 'array', 'size:5'],
            'lineup.*' => ['array:instance_id'], 'lineup.*.instance_id' => ['required', 'uuid', 'distinct']]);
        return response()->json(['data' => $service->updateClub($request->user(), $data)]);
    }

    public function queue(Request $request, OnlineService $service)
    {
        // The request has no authority to choose a queue type, Rating, outcome or card stats.
        abort_if($request->all() !== [], 422, 'Normal queue accepts only your saved server-owned lineup.');
        return response()->json(['data' => $service->queue($request->user())], 202);
    }

    public function leave(Request $request, OnlineService $service)
    {
        $service->leave($request->user());
        return response()->noContent();
    }

    public function show(Request $request, string $id, OnlineService $service)
    {
        $match = $service->participant($request->user(), $id);
        if ($match->belongsToParticipant($request->user()->id)) return response()->json(['data' => $match]);
        $result = $match->result ? [
            'winner' => $match->result['winner'],
            'execution' => array_intersect_key($match->result['execution'] ?? [], array_flip(['mode', 'from_second', 'notice'])),
        ] : null;
        if ($result && ($match->plan['game_mode'] ?? null) === 'fps_mr15_v1') {
            $result['report'] = array_diff_key($match->result['report'], array_flip(['playbookExperience', 'orderObservations']));
            unset($result['report']['identityExperiment'],$result['report']['identityDevelopment']);
        }
        return response()->json(['data' => [
            ...$match->only(['id', 'status', 'sequence', 'started_at', 'completed_at']),
            'plan' => array_intersect_key($match->plan, array_flip(['clubs', 'fixture', 'versions', 'visual_releases', 'game_mode', 'fps'])),
            'result' => $result,
        ]]);
    }

    public function grant(Request $request, string $id, OnlineService $service)
    {
        $match = $service->participant($request->user(), $id);
        $token = bin2hex(random_bytes(32));
        DB::table('online_stream_grants')->insert(['id' => hash('sha256', $token), 'user_id' => $request->user()->id,
            'match_id' => $match->id, 'expires_at' => now()->addMinute(), 'created_at' => now(), 'updated_at' => now()]);
        return response()->json(['data' => ['grant' => $token, 'match_id' => $match->id, 'path' => config('online.stream_path'), 'expires_in' => 60]]);
    }

    public function replay(Request $request, string $id, OnlineService $service)
    {
        $service->participant($request->user(), $id);
        $data = $request->validate(['after' => ['sometimes', 'integer', 'min:0', 'max:7200'], 'limit' => ['sometimes', 'integer', 'min:1', 'max:8']]);
        $frames = Http::withToken(config('online.worker_token'))->connectTimeout(3)->timeout(10)
            ->get(OnlineMatch::findOrFail($id)->workerUrl().'/matches/'.$id.'/replay', $data)->throw()->json();
        return response()->json(['data' => $frames]);
    }

    /**
     * Live 3D broadcast header, capped to what has already been broadcast: viewers of a match that was
     * simulated ahead never learn how long it is (or how it ends) before playback reaches it.
     */
    public function liveReplayHeader(Request $request, string $id, OnlineService $service)
    {
        $match = $service->participant($request->user(), $id);
        abort_unless($match->usesLiveEngine(), 404);
        $header = $this->liveReplayPart($match, 'header');
        [$frames, $complete] = $this->visibleLiveFrames($match, $header);
        $perChunk = (int) $header['framesPerChunk'];
        $complete = $complete && ($header['final'] ?? false);
        // Only whole chunks are served, so a viewer can never read ahead of the broadcast.
        $chunks = $complete ? (int) $header['chunks'] : intdiv($frames, $perChunk);
        $starts = $header['roundStartSeconds'] ?? [];
        if (! $complete) {
            $playableUntil = ($chunks * $perChunk - 1) * (float) $header['frameSeconds'];
            $starts = array_values(array_filter($starts, fn ($at) => $at <= $playableUntil));
        }
        return response()->json(['data' => [...array_diff_key($header, array_flip(['frames', 'chunks', 'broadcastSeconds', 'roundStartSeconds'])),
            'final' => $complete, 'roundStartSeconds' => $starts,
            'frames' => $complete ? (int) $header['frames'] : $chunks * $perChunk, 'chunks' => $chunks, 'complete' => $complete,
            'broadcastSeconds' => $complete ? $header['broadcastSeconds'] : null,
            'liveSeconds' => $complete ? null : round(min($match->broadcastSecondsVisible(), (float) $header['broadcastSeconds']), 1)]]);
    }

    public function liveReplayChunk(Request $request, string $id, int $chunk, OnlineService $service)
    {
        $match = $service->participant($request->user(), $id);
        abort_unless($match->usesLiveEngine() && $chunk >= 0 && $chunk < 100000, 404);
        $header = $this->liveReplayPart($match, 'header');
        [$frames, $complete] = $this->visibleLiveFrames($match, $header);
        $complete = $complete && ($header['final'] ?? false);
        abort_unless($complete ? $chunk < (int) $header['chunks'] : ($chunk + 1) * (int) $header['framesPerChunk'] <= $frames, 404, 'Not broadcast yet.');
        $body = \Illuminate\Support\Facades\Cache::remember("online:live-replay:$id:$chunk", 600, fn () => $this->liveReplayPart($match, (string) $chunk, true));
        return response($body, 200, ['Content-Type' => 'application/json', 'Cache-Control' => 'private, max-age=86400, immutable']);
    }

    /** @return array{0:int,1:bool} frames a viewer may see now, and whether the whole broadcast is visible */
    private function visibleLiveFrames(\App\Models\OnlineMatch $match, array $header): array
    {
        $total = (int) $header['frames'];
        $visible = $match->broadcastSecondsVisible();
        if (is_infinite($visible)) return [$total, true];
        $frames = min($total, (int) floor($visible / max(0.001, (float) $header['frameSeconds'])) + 1);
        return [$frames, $frames >= $total];
    }

    private function liveReplayPart(\App\Models\OnlineMatch $match, string $part, bool $raw = false): array|string
    {
        $load = fn () => Http::withToken(config('online.worker_token'))->connectTimeout(3)->timeout(15)
            ->get($match->workerUrl().'/matches/'.$match->id.'/replay3d/'.$part);
        $key = 'online:live-replay:'.$match->id.':header';
        if ($raw) { $reply = $load(); $this->abortIfReplayGone($match, $reply, $key); abort_unless($reply->successful(), 404, 'Replay part not available.'); return $reply->body(); }
        // Only the final header is immutable; a provisional one (still simulating) is re-read.
        if (\Illuminate\Support\Facades\Cache::has($key)) return \Illuminate\Support\Facades\Cache::get($key);
        $reply = $load();
        $this->abortIfReplayGone($match, $reply, $key);
        abort_unless($reply->successful(), 404, 'The broadcast is still being prepared.');
        $header = $reply->json();
        if ($header['final'] ?? false) \Illuminate\Support\Facades\Cache::put($key, $header, 3600);
        return $header;
    }

    /**
     * The worker removed this replay after its retention period (410), or a settled match's replay is missing
     * from its worker: answer 410 with a reason. The result and fixture report are stored here and stay intact.
     */
    private function abortIfReplayGone(\App\Models\OnlineMatch $match, \Illuminate\Http\Client\Response $reply, string $key): void
    {
        $reason = $reply->status() === 410 ? 'replay_expired'
            : ($reply->status() === 404 && $match->status === 'completed' ? 'replay_missing' : null);
        if ($reason === null) return;
        \Illuminate\Support\Facades\Cache::forget($key);
        throw new \Illuminate\Http\Exceptions\HttpResponseException(response()->json([
            'message' => 'This replay is no longer available. The result and match report are kept.',
            'reason' => $reason,
        ], 410));
    }

    public function authorizeStream(Request $request)
    {
        $configured = config('online.worker_token');
        abort_unless(strlen($configured) >= 32 && hash_equals($configured, $request->bearerToken() ?? ''), 401);
        $data = $request->validate(['grant' => ['required', 'string', 'size:64']]);
        return DB::transaction(function () use ($data) {
            $grant = DB::table('online_stream_grants')->where('id', hash('sha256', $data['grant']))->lockForUpdate()->first();
            abort_unless($grant && ! $grant->used_at && now()->lt($grant->expires_at), 403);
            $match = OnlineMatch::findOrFail($grant->match_id);
            abort_unless(! $match->isBeforeKickoff() && ($match->belongsToParticipant($grant->user_id) || $match->canSpectate()), 403);
            DB::table('online_stream_grants')->where('id', $grant->id)->update(['used_at' => now()]);
            return response()->json(['match_id' => $match->id, 'user_id' => $grant->user_id]);
        });
    }
}
