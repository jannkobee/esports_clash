<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\{ClubFixture, ClubFriendlyInvite, OnlineCatalog, OnlineClub};
use App\Services\OnlineService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class ClubFixtureController extends Controller
{
    public function index(Request $request, OnlineService $online)
    {
        $club = $online->provision($request->user());
        $fixtures = ClubFixture::where(fn ($query) => $query->where('home_club_id', $club->id)->orWhere('away_club_id', $club->id))
            ->with(['homeClub:id,name,tag,identity', 'awayClub:id,name,tag,identity', 'match:id,status,plan,started_at'])
            ->where('kickoff_at', '>=', now()->subDays(30))->orderBy('kickoff_at')->limit(100)->get();

        $invites = ClubFriendlyInvite::where('away_club_id', $club->id)->whereNull('fixture_id')
            ->where('kickoff_at', '>', now()->addMinutes(15))->with('homeClub:id,name,tag')->orderBy('kickoff_at')->limit(50)->get()
            ->map(fn (ClubFriendlyInvite $invite) => ['id' => $invite->id, 'home' => $invite->homeClub, 'kickoff_at' => $invite->kickoff_at]);
        return response()->json(['invites' => $invites, 'data' => $fixtures->map(function (ClubFixture $fixture) use ($club) {
            $locked = $fixture->orders_close_at->isPast();
            return [
                'id' => $fixture->id, 'tournament_id'=>$fixture->tournament_id, 'competition' => $fixture->competition,
                'kickoff_at' => $fixture->kickoff_at, 'orders_close_at' => $fixture->orders_close_at,
                'started_at' => $fixture->match?->started_at,
                'clubs' => $fixture->match?->plan['fixture']['clubs'] ?? ['blue' => $fixture->homeClub, 'red' => $fixture->awayClub],
                'status' => match (true) {
                    $fixture->hold_reason !== null => 'Needs review',
                    $fixture->match?->status === 'completed' => 'Completed',
                    in_array($fixture->match?->status,['failed','interrupted'],true) => 'Interrupted',
                    $fixture->match?->status === 'running' => 'Live',
                    $fixture->kickoff_at->isPast() => 'Delayed',
                    $locked => 'Orders locked',
                    default => 'Scheduled',
                },
                'match_id' => $fixture->kickoff_at->isPast() ? $fixture->match_id : null,
                'can_watch'=>$fixture->match?->canSpectate()??false,
                'can_submit' => ! $locked && ! $fixture->match_id,
                'orders' => $fixture->home_club_id === $club->id ? $fixture->home_orders : $fixture->away_orders,
            ];
        })]);
    }

    public function update(Request $request, int $id, OnlineService $online)
    {
        $club = $online->provision($request->user());
        $data = $request->validate([
            'lineup' => ['required', 'array', 'size:5', 'list'],
            'lineup.*' => ['array:instance_id'],
            'lineup.*.instance_id' => ['required', 'uuid', 'distinct'],
        ]);
        DB::transaction(function () use ($id, $club, $data, $online) {
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $fixture = ClubFixture::whereKey($id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($club->id, [$fixture->home_club_id, $fixture->away_club_id], true), 403);
            abort_if($fixture->match_id || $fixture->orders_close_at->lte(now()), 409, 'Match orders are locked.');
            $starters = $online->validatedStarters($club->user_id, $data['lineup'], $catalog);
            $side = $fixture->home_club_id === $club->id ? 'home_orders' : 'away_orders';
            $fixture->update([$side => array_map(fn (array $slot): array => ['instance_id' => $slot['instance_id']], $starters)]);
        }, 3);

        return response()->noContent();
    }

    public function invite(Request $request, OnlineService $online)
    {
        $home = $online->provision($request->user());
        $input = $request->validate(['tag' => ['required', 'regex:/^[A-Z0-9]{2,12}$/'], 'kickoff_at' => ['required', 'date_format:Y-m-d\TH:i:sP']]);
        $away = OnlineClub::where('tag', $input['tag'])->firstOrFail();
        abort_if($home->id === $away->id || $home->is_bot, 422, 'Choose another club.');
        $kickoff = Carbon::parse($input['kickoff_at'])->utc();
        abort_if($kickoff->lte(now()->addMinutes(15)) || $kickoff->gt(now()->addDays(30)), 422, 'Pick a kickoff between 15 minutes and 30 days from now.');
        $invite=ClubFriendlyInvite::firstOrCreate(['home_club_id' => $home->id, 'away_club_id' => $away->id, 'kickoff_at' => $kickoff]);
        if($away->is_bot)$this->acceptInvite($invite->id,$away->id);
        return response()->noContent();
    }

    public function accept(Request $request, int $id, OnlineService $online)
    {
        $club = $online->provision($request->user());
        $this->acceptInvite($id,$club->id);
        return response()->noContent();
    }

    private function acceptInvite(int $id,int $clubId):void
    {
        DB::transaction(function () use ($id, $clubId) {
            $invite = ClubFriendlyInvite::whereKey($id)->lockForUpdate()->firstOrFail();
            abort_unless($invite->away_club_id === $clubId, 403);
            if ($invite->fixture_id) return;
            $ids = [$invite->home_club_id, $invite->away_club_id];
            OnlineClub::whereKey($ids)->orderBy('id')->lockForUpdate()->get();
            $deadline = $invite->kickoff_at->subMinutes(15);
            abort_if($deadline->lte(now()), 409, 'The invitation has expired.');
            abort_if(ClubFixture::conflicts($ids, $invite->kickoff_at), 409, 'A club has a conflicting fixture.');
            $fixture = ClubFixture::create(['home_club_id' => $ids[0], 'away_club_id' => $ids[1], 'competition' => 'Scrimmage',
                'kickoff_at' => $invite->kickoff_at, 'orders_close_at' => $deadline]);
            $invite->update(['fixture_id' => $fixture->id]);
        }, 3);
    }
}
