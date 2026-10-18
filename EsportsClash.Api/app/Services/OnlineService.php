<?php

namespace App\Services;

use App\Jobs\PollOnlineMatch;
use App\Models\{NormalQueueTicket, OnlineCatalog, OnlineClub, OnlineMatch, OwnedPlayerCard, User};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OnlineService
{
    public function activeCatalog(): OnlineCatalog
    {
        return OnlineCatalog::where('active', true)->firstOrFail();
    }

    public function provision(User $user): OnlineClub
    {
        return DB::transaction(function () use ($user) {
            User::lockForUpdate()->findOrFail($user->id);
            if ($club = OnlineClub::where('user_id', $user->id)->first()) return $club;
            $catalog = $this->activeCatalog();
            $lineup = [];
            foreach ($catalog->payload['starter'] as $slot) {
                $card = OwnedPlayerCard::firstOrCreate(['grant_key' => 'starter:'.$user->id.':'.$slot['card_id']],
                    ['id' => (string) Str::uuid(), 'user_id' => $user->id, 'catalog_id' => $catalog->id, 'definition_id' => $slot['card_id']]);
                $lineup[] = ['instance_id' => $card->id, 'avatar_id' => $slot['avatar_id']];
            }
            return OnlineClub::create(['user_id' => $user->id, 'name' => Str::limit($user->name."'s Club", 80, ''), 'lineup' => $lineup]);
        });
    }

    public function validatedLineup(int $userId, array $lineup, OnlineCatalog $catalog): array
    {
        if (count($lineup) !== 5 || count(array_unique(array_column($lineup, 'instance_id'))) !== 5
            || count(array_unique(array_column($lineup, 'avatar_id'))) !== 5) $this->invalid('Choose five distinct owned cards and avatars.');
        $definitions = collect($catalog->payload['cards'])->keyBy('id');
        $avatars = collect($catalog->payload['avatars'])->keyBy('id');
        $output = [];
        foreach ($lineup as $slot) {
            $owned = OwnedPlayerCard::where('id', $slot['instance_id'])->where('user_id', $userId)->where('catalog_id', $catalog->id)->first();
            if (! $owned || ! $definitions->has($owned->definition_id) || ! $avatars->has($slot['avatar_id'])) $this->invalid('The selected card or avatar is unavailable.');
            $card = $definitions[$owned->definition_id];
            $avatar = $avatars[$slot['avatar_id']];
            $roles = array_unique(array_filter([...($card['playableRoles'] ?? []), $card['preferredRole'] ?? null, $card['role'] ?? null]));
            if (! in_array($avatar['primaryRole'], $roles, true) && ! in_array($avatar['secondaryRole'] ?? '', $roles, true)) $this->invalid('This card cannot play that avatar role.');
            $output[] = ['instance_id' => $owned->id, 'card_id' => $owned->definition_id, 'avatar_id' => $avatar['id']];
        }
        return $output;
    }

    private function invalid(string $message): never
    {
        throw ValidationException::withMessages(['lineup' => $message]);
    }

    public function updateClub(User $user, array $data): OnlineClub
    {
        $this->provision($user);
        return DB::transaction(function () use ($user, $data) {
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $club = OnlineClub::where('user_id', $user->id)->lockForUpdate()->firstOrFail();
            $ticket = NormalQueueTicket::where('user_id', $user->id)->first();
            if ($ticket && $ticket->status === 'queued') $this->invalid('Leave the queue before changing the lineup.');
            if (isset($data['lineup'])) $this->validatedLineup($user->id, $data['lineup'], $catalog);
            if ($club->revision !== $data['revision']) $this->invalid('The club changed. Refresh before saving.');
            $club->update([...$data, 'revision' => $club->revision + 1]);
            return $club;
        });
    }

    public function queue(User $user): array
    {
        $this->provision($user);
        return DB::transaction(function () use ($user) {
            // Single catalog row serializes allocation and lineup/queue mutations.
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $ticket = NormalQueueTicket::where('user_id', $user->id)->lockForUpdate()->first();
            if ($ticket?->match_id) {
                $match = OnlineMatch::findOrFail($ticket->match_id);
                if (in_array($match->status, ['allocated', 'running'], true)) return ['ticket' => $ticket, 'match' => $match];
            }
            if ($ticket?->status === 'queued') return ['ticket' => $ticket, 'match' => null];
            $club = OnlineClub::where('user_id', $user->id)->firstOrFail();
            $lineup = $this->validatedLineup($user->id, $club->lineup, $catalog);
            $ticket = NormalQueueTicket::updateOrCreate(['user_id' => $user->id], ['status' => 'queued',
                'catalog_id' => $catalog->id, 'lineup' => $lineup, 'club_name' => $club->name, 'match_id' => null]);
            $opponent = NormalQueueTicket::where('status', 'queued')->where('catalog_id', $catalog->id)
                ->where('user_id', '<>', $user->id)->orderBy('id')->lockForUpdate()->first();
            if (! $opponent) return ['ticket' => $ticket, 'match' => null];
            $id = (string) Str::uuid();
            $plan = ['schema' => 1, 'match_id' => $id, 'mode' => 'normal', 'seed' => random_int(1, 2147483647),
                'versions' => array_intersect_key($catalog->manifest, array_flip(['catalog_version', 'rules_version', 'policy_version', 'observation_version'])),
                'blue' => $opponent->lineup, 'red' => $ticket->lineup,
                'clubs' => ['blue' => $opponent->club_name, 'red' => $ticket->club_name],
                'coach_id' => $catalog->payload['coaches'][0]['id']];
            $match = OnlineMatch::create(['id' => $id, 'blue_user_id' => $opponent->user_id, 'red_user_id' => $user->id,
                'plan' => $plan, 'plan_hash' => hash('sha256', json_encode($plan, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))]);
            $opponent->update(['status' => 'matched', 'match_id' => $id]);
            $ticket->update(['status' => 'matched', 'match_id' => $id]);
            PollOnlineMatch::dispatch($id)->afterCommit();
            return ['ticket' => $ticket->fresh(), 'match' => $match];
        });
    }

    public function leave(User $user): void
    {
        DB::transaction(function () use ($user) {
            OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            NormalQueueTicket::where('user_id', $user->id)->where('status', 'queued')->update(['status' => 'cancelled', 'updated_at' => now()]);
        });
    }

    public function participant(User $user, string $id): OnlineMatch
    {
        $match = OnlineMatch::findOrFail($id);
        abort_unless(in_array($user->id, [$match->blue_user_id, $match->red_user_id], true), 403);
        return $match;
    }

    public function settle(string $id, array $result, int $sequence): OnlineMatch
    {
        return DB::transaction(function () use ($id, $result, $sequence) {
            $match = OnlineMatch::lockForUpdate()->findOrFail($id);
            $hash = hash('sha256', json_encode($result, JSON_THROW_ON_ERROR));
            if ($match->status === 'completed') {
                if (! hash_equals($match->result_hash, $hash)) $this->invalid('A completed result is immutable.');
                return $match;
            }
            if (! in_array($match->status, ['allocated', 'running'], true)) $this->invalid('This match cannot be settled.');
            if (($result['match_id'] ?? '') !== $match->id || ($result['seed'] ?? null) !== $match->plan['seed']
                || ($result['versions'] ?? null) !== $match->plan['versions'] || ! in_array($result['winner'] ?? '', ['blue', 'red'], true)
                || ! isset($result['report']['durationSeconds']) || $result['report']['durationSeconds'] <= 0
                || ($result['report']['winner'] ?? '') !== $result['winner']
                || ($result['report']['seed'] ?? null) !== $match->plan['seed']) $this->invalid('Worker result does not match its allocation.');
            $nexus = $result['terminal_nexus'] ?? [];
            // Preserve the live engine's existing red-Nexus-first terminal ordering,
            // including the rare case where both structures fall in the same tick.
            $expected = ($nexus['red'] ?? null) === false ? 'blue' : ((($nexus['blue'] ?? null) === false) ? 'red' : null);
            if (! is_bool($nexus['blue'] ?? null) || ! is_bool($nexus['red'] ?? null) || $expected !== $result['winner']) $this->invalid('A real Nexus finish is required.');
            foreach (['blue', 'red'] as $side) {
                $draft = $result['report']['draft'][$side] ?? [];
                if (array_column(array_column($draft, 'player'), 'id') !== array_column($match->plan[$side], 'card_id')
                    || array_column(array_column($draft, 'champion'), 'id') !== array_column($match->plan[$side], 'avatar_id')) $this->invalid('Result draft differs from the allocated owned lineup.');
            }
            $match->update(['status' => 'completed', 'sequence' => $sequence, 'result' => $result, 'result_hash' => $hash, 'completed_at' => now()]);
            // Normal matches grant no global Rating, wallet credit or progression in this slice.
            return $match;
        });
    }
}
