<?php

namespace App\Services;

use App\Models\OnlineClub;
use Illuminate\Support\Facades\{DB, Schema};
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;

class WorldActivityService
{
    public function record(string $key, string $kind, ?OnlineClub $actor, string $message, array $payload = []): void
    {
        if (! Schema::hasTable('club_world_events')) return;
        $public = array_intersect_key($payload, array_flip(['player_id', 'player_instance_id', 'team_id', 'seller_id', 'buyer_id', 'tournament_id', 'match_id', 'auction_id', 'amount', 'currency', 'reason']));
        DB::table('club_world_events')->insertOrIgnore(['event_key' => $key, 'kind' => $kind, 'actor_club_id' => $actor?->id,
            'message' => Str::limit($message, 500, ''), 'payload' => json_encode($public, JSON_THROW_ON_ERROR), 'occurred_at' => now()]);
    }

    public function feed(): array
    {
        if (! Schema::hasTable('club_world_events')) return ['events' => [], 'last_review_at' => null, 'available' => false];
        $events = DB::table('club_world_events as event')->leftJoin('online_clubs as club', 'club.id', '=', 'event.actor_club_id')
            ->where(fn ($query) => $query->whereNull('event.actor_club_id')->orWhereNotNull('club.tag'))
            ->orderByDesc('event.id')->limit(50)->get(['event.*', 'club.name as club_name', 'club.tag', 'club.is_bot', 'club.identity'])
            ->map(fn ($row) => ['id' => $row->id, 'kind' => $row->kind, 'message' => $row->message, 'occurred_at' => Carbon::parse($row->occurred_at)->toIso8601String(),
                'payload' => (function()use($row){$payload=json_decode($row->payload,true,flags:JSON_THROW_ON_ERROR);if(!empty($payload['player_instance_id']))$payload['player_id']=$payload['player_instance_id'];return $payload;})(),
                'actor' => $row->actor_club_id ? ['id' => $row->actor_club_id, 'name' => $row->club_name, 'tag' => $row->tag,
                    'is_bot' => (bool) $row->is_bot, 'identity' => $row->identity ? json_decode($row->identity, true, flags: JSON_THROW_ON_ERROR) : null] : null]);
        $last = DB::table('club_world_turns')->max('completed_at');
        return ['events' => $events, 'last_review_at' => $last ? Carbon::parse($last)->toIso8601String() : null, 'available' => true];
    }
}
