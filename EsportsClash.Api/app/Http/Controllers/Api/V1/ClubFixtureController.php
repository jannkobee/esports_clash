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
            ->with(['homeClub:id,name,tag,identity', 'awayClub:id,name,tag,identity', 'match:id,status,plan,started_at,spectator_ready,on_air_at'])
            ->where('kickoff_at', '>=', now()->subDays(30))->orderBy('kickoff_at')->limit(100)->get();

        $invites = ClubFriendlyInvite::where('away_club_id', $club->id)->whereNull('fixture_id')
            ->where('kickoff_at', '>', now()->addMinutes(ClubFixture::ordersLeadMinutes()))->with('homeClub:id,name,tag')->orderBy('kickoff_at')->limit(50)->get()
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
                'plan' => $fixture->home_club_id === $club->id ? $fixture->home_plan : $fixture->away_plan,
                'side' => $fixture->home_club_id === $club->id ? 'blue' : 'red',
                'outcome' => $fixture->outcomeFor($club->id),
                'score' => $fixture->result_score ? ['blue' => $fixture->result_score['blue'], 'red' => $fixture->result_score['red']] : null,
                'map' => $fixture->map_id ? ['id' => $fixture->map_id, 'name' => OnlineService::FPS_MAP_NAMES[$fixture->map_id] ?? ucfirst($fixture->map_id)] : null,
                'opponent_id' => $fixture->home_club_id === $club->id ? $fixture->away_club_id : $fixture->home_club_id,
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
            // Optional plan for this fixture only: a gameplan and individual instructions (positions stay club-wide).
            'plan' => ['nullable', 'array:gameplan,instructions'],
            'plan.gameplan' => ['nullable', 'array:tempo,structure,aggression,preparation,freedom,economy'],
            'plan.gameplan.*' => ['numeric', 'between:0,1'],
            'plan.instructions' => ['nullable', 'array'],
            'plan.instructions.*' => ['in:balanced,hold,initiative,support'],
        ]);
        DB::transaction(function () use ($id, $club, $data, $online) {
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $fixture = ClubFixture::whereKey($id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($club->id, [$fixture->home_club_id, $fixture->away_club_id], true), 403);
            abort_if($fixture->match_id || $fixture->orders_close_at->lte(now()), 409, 'Match orders are locked.');
            $starters = $online->validatedStarters($club->user_id, $data['lineup'], $catalog);
            $side = $fixture->home_club_id === $club->id ? 'home_orders' : 'away_orders';
            $plan = null;
            if (! empty($data['plan']['gameplan']) || ! empty($data['plan']['instructions'])) {
                $ids = array_column($starters, 'instance_id');
                $gameplan = isset($data['plan']['gameplan']) ? array_map(fn ($v) => round((float) $v, 2), $data['plan']['gameplan']) : null;
                if ($gameplan !== null) abort_unless(count($gameplan) === 6, 422, 'A fixture gameplan sets all six dimensions.');
                $instructions = array_intersect_key($data['plan']['instructions'] ?? [], array_flip($ids));
                $plan = array_filter(['gameplan' => $gameplan, 'instructions' => $instructions ?: null], fn ($v) => $v !== null);
            }
            $fixture->update([$side => array_map(fn (array $slot): array => ['instance_id' => $slot['instance_id']], $starters),
                ($side === 'home_orders' ? 'home_plan' : 'away_plan') => $plan]);
        }, 3);

        return response()->noContent();
    }

    /** The owning club's debrief: public report plus its pinned plan and observed decisions. */
    public function debrief(Request $request, int $id, OnlineService $online)
    {
        $club = $online->provision($request->user());
        $fixture = ClubFixture::with('match')->findOrFail($id);
        abort_unless(in_array($club->id, [$fixture->home_club_id, $fixture->away_club_id], true), 403);
        $match = $fixture->match;
        abort_unless($match?->status === 'completed', 404, 'The match has not been settled yet.');
        $debrief = app(\App\Services\MatchDebrief::class);
        return ['data' => $debrief->public($fixture, $match) + ['club' => $debrief->private($fixture, $match, $club->id)]];
    }

    /** Lawful pre-match scouting of this fixture's opponent (results, rating, head-to-head, observed tendencies). */
    public function opponent(Request $request, int $id, OnlineService $online)
    {
        $club = $online->provision($request->user());
        $fixture = ClubFixture::findOrFail($id);
        abort_unless(in_array($club->id, [$fixture->home_club_id, $fixture->away_club_id], true), 403);
        return ['data' => app(\App\Services\OpponentScouting::class)->report($fixture, $club)];
    }

    /** Drop this fixture's own orders: the club's saved default lineup is used at the lock. */
    public function useDefault(Request $request, int $id, OnlineService $online)
    {
        $club = $online->provision($request->user());
        DB::transaction(function () use ($id, $club) {
            $fixture = ClubFixture::whereKey($id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($club->id, [$fixture->home_club_id, $fixture->away_club_id], true), 403);
            abort_if($fixture->match_id || $fixture->orders_close_at->lte(now()), 409, 'Match orders are locked.');
            $fixture->update($fixture->home_club_id === $club->id ? ['home_orders' => null, 'home_plan' => null] : ['away_orders' => null, 'away_plan' => null]);
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
        $lead = ClubFixture::ordersLeadMinutes() + 15;
        abort_if($kickoff->lte(now()->addMinutes($lead)) || $kickoff->gt(now()->addDays(30)), 422, 'Pick a kickoff between '.($lead >= 120 ? intdiv($lead, 60).' hours' : $lead.' minutes').' and 30 days from now.');
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
            $deadline = ClubFixture::ordersCloseAt($invite->kickoff_at);
            abort_if($deadline->lte(now()), 409, 'The invitation has expired.');
            abort_if(ClubFixture::conflicts($ids, $invite->kickoff_at), 409, 'A club has a conflicting fixture.');
            abort_if(ClubFixture::hourFull($invite->kickoff_at), 409, 'That kickoff hour is fully booked. Ask for another time.');
            $fixture = ClubFixture::create(['home_club_id' => $ids[0], 'away_club_id' => $ids[1], 'competition' => 'Scrimmage',
                'kickoff_at' => $invite->kickoff_at, 'orders_close_at' => $deadline]);
            $invite->update(['fixture_id' => $fixture->id]);
        }, 3);
    }
}
