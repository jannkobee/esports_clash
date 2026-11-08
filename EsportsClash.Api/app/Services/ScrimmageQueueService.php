<?php

namespace App\Services;

use App\Jobs\PollOnlineMatch;
use App\Models\{ClubFixture, NormalQueueTicket, OnlineCatalog, OnlineClub, ScrimmageQueueTicket, User};
use Illuminate\Support\Facades\DB;

class ScrimmageQueueService
{
    public function join(User $user, OnlineService $online): array
    {
        $online->provision($user);

        return DB::transaction(function () use ($user, $online): array {
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $normalTicket = NormalQueueTicket::where('user_id', $user->id)->lockForUpdate()->first();
            $normalMatchActive = $normalTicket?->match_id
                && \App\Models\OnlineMatch::whereKey($normalTicket->match_id)->whereIn('status', ['allocated', 'running'])->exists();
            abort_if($normalTicket?->status === 'queued' || $normalMatchActive, 409,
                'Leave the normal match queue or finish its active match first.');

            $club = OnlineClub::where('user_id', $user->id)->lockForUpdate()->firstOrFail();
            $existing = ScrimmageQueueTicket::where('user_id', $user->id)->lockForUpdate()->first();
            if ($existing?->status === 'queued') {
                return $this->tryPair($existing, $club, $catalog, $online);
            }
            if ($existing?->status === 'matched' && $existing->fixture_id) {
                $fixture = ClubFixture::with('match')->find($existing->fixture_id);
                if ($fixture && ($fixture->kickoff_at->gt(now()) || in_array($fixture->match?->status, ['allocated', 'running'], true))) {
                    return ['ticket' => $existing, 'fixture' => $fixture];
                }
            }

            $lineup = $online->validatedStarters($user->id, $club->starters ?? $club->lineup, $catalog);
            $profiles = app(WorldPlayerProfiles::class);
            $definitions = collect($catalog->payload['cards'])->keyBy('id');
            $cards = \App\Models\OwnedPlayerCard::whereIn('id', array_column($lineup, 'instance_id'))->get()->keyBy('id');
            $rating = collect($lineup)->avg(function (array $slot) use ($cards, $definitions, $profiles): float {
                $card = $cards[$slot['instance_id']];
                return (float) $profiles->definition($card, $definitions[$card->definition_id])['ovr'];
            });
            $ticket = ScrimmageQueueTicket::updateOrCreate(['user_id' => $user->id], [
                'club_id' => $club->id,
                'tier' => min(9, max(0, (int) floor($rating / 10))),
                'rating' => round($rating, 2),
                'lineup' => array_map(fn (array $slot) => ['instance_id' => $slot['instance_id']], $lineup),
                'club_name' => $club->name,
                'status' => 'queued',
                'fixture_id' => null,
            ]);

            return $this->tryPair($ticket, $club, $catalog, $online);
        }, 3);
    }

    public function leave(User $user): void
    {
        DB::transaction(function () use ($user): void {
            $ticket = ScrimmageQueueTicket::where('user_id', $user->id)->lockForUpdate()->first();
            if (! $ticket || $ticket->status !== 'queued') {
                return;
            }
            $ticket->update(['status' => 'left']);
        }, 3);
    }

    private function tryPair(ScrimmageQueueTicket $ticket, OnlineClub $club, OnlineCatalog $catalog, OnlineService $online): array
    {
        $opponents = ScrimmageQueueTicket::where('status', 'queued')
            ->where('tier', $ticket->tier)
            ->where('user_id', '<>', $ticket->user_id)
            ->orderBy('created_at')
            ->lockForUpdate()
            ->get()
            ->sortBy(fn (ScrimmageQueueTicket $candidate) => [
                abs($candidate->rating - $ticket->rating),
                $candidate->created_at->getTimestamp(),
            ]);
        $kickoff = now()->addMinutes(30);

        foreach ($opponents as $opponent) {
            $ids = [$club->id, $opponent->club_id];
            if (ClubFixture::conflicts($ids, $kickoff)) {
                continue;
            }
            $otherClub = OnlineClub::whereKey($opponent->club_id)->lockForUpdate()->first();
            if (! $otherClub || $otherClub->user_id !== $opponent->user_id) {
                $opponent->update(['status' => 'invalid']);
                continue;
            }
            $otherLineup = $online->validatedStarters($opponent->user_id, $opponent->lineup, $catalog);
            $fixture = ClubFixture::create([
                'home_club_id' => $otherClub->id,
                'away_club_id' => $club->id,
                'competition' => 'Scrimmage',
                'kickoff_at' => $kickoff,
                'orders_close_at' => $kickoff->copy()->subMinutes(15),
                'home_orders' => array_map(fn (array $slot) => ['instance_id' => $slot['instance_id']], $otherLineup),
                'away_orders' => $ticket->lineup,
            ]);
            $opponent->update(['status' => 'matched', 'fixture_id' => $fixture->id]);
            $ticket->update(['status' => 'matched', 'fixture_id' => $fixture->id]);
            app(ClubOffice::class)->notify($otherClub->id, "scrimmage-queue:$fixture->id:matched", 'fixture', 'Scrimmage opponent found',
                'Your club was paired with a same-tier opponent. Review the scheduled fixture and match orders.',
                ['type' => 'route', 'route' => 'play?club=calendar', 'fixture_id' => $fixture->id]);
            app(ClubOffice::class)->notify($club->id, "scrimmage-queue:$fixture->id:matched-copy", 'fixture', 'Scrimmage opponent found',
                'Your club was paired with a same-tier opponent. Review the scheduled fixture and match orders.',
                ['type' => 'route', 'route' => 'play?club=calendar', 'fixture_id' => $fixture->id]);
            return ['ticket' => $ticket->fresh(), 'fixture' => $fixture];
        }

        return ['ticket' => $ticket->fresh(), 'fixture' => null];
    }
}
