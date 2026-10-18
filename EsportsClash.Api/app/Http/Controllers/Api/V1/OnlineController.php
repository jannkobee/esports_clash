<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\{NormalQueueTicket, OnlineMatch, OwnedPlayerCard};
use App\Services\OnlineService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class OnlineController extends Controller
{
    public function index(Request $request, OnlineService $service)
    {
        $club = $service->provision($request->user());
        $catalog = $service->activeCatalog();
        $cards = OwnedPlayerCard::where('user_id', $request->user()->id)->get()->map(function ($owned) use ($catalog) {
            $definition = collect($catalog->payload['cards'])->firstWhere('id', $owned->definition_id);
            unset($definition['realName']);
            return ['id' => $owned->id, 'definition' => $definition, 'catalog_version' => $owned->catalog_id];
        });
        $avatars = array_map(function ($avatar) { unset($avatar['realName']); return $avatar; }, $catalog->payload['avatars']);
        return response()->json(['data' => ['club' => $club, 'cards' => $cards, 'avatars' => $avatars,
            'ticket' => NormalQueueTicket::where('user_id', $request->user()->id)->first(),
            'matches' => OnlineMatch::where(fn ($query) => $query->where('blue_user_id', $request->user()->id)->orWhere('red_user_id', $request->user()->id))->latest()->limit(20)->get(),
            'versions' => array_diff_key($catalog->manifest, ['sources' => true]), 'mode' => 'normal']]);
    }

    public function update(Request $request, OnlineService $service)
    {
        $data = $request->validate(['name' => ['sometimes', 'string', 'min:2', 'max:80'],
            'revision' => ['required', 'integer', 'min:1'], 'lineup' => ['sometimes', 'array', 'size:5'],
            'lineup.*' => ['array:instance_id,avatar_id'], 'lineup.*.instance_id' => ['required', 'uuid', 'distinct'],
            'lineup.*.avatar_id' => ['required', 'string', 'max:100', 'distinct']]);
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
        return response()->json(['data' => $service->participant($request->user(), $id)]);
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
            ->get(rtrim(config('online.worker_url'), '/').'/matches/'.$id.'/replay', $data)->throw()->json();
        return response()->json(['data' => $frames]);
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
            abort_unless(in_array($grant->user_id, [$match->blue_user_id, $match->red_user_id], true), 403);
            DB::table('online_stream_grants')->where('id', $grant->id)->update(['used_at' => now()]);
            return response()->json(['match_id' => $match->id, 'user_id' => $grant->user_id]);
        });
    }
}
