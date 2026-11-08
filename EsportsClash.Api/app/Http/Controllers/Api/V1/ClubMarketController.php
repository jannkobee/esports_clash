<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\{ClubAuction, ClubTradeProposal, OnlineClub, OwnedPlayerCard};
use App\Services\{ClubMarketService, OnlineService};
use Illuminate\Http\Request;

class ClubMarketController extends Controller
{
    public function index(Request $request, OnlineService $online, ClubMarketService $market)
    {
        $market->expireTrades();
        $club = $online->provision($request->user());
        $catalog = $online->activeCatalog();
        $players = collect($catalog->payload['cards'])->keyBy('id');
        $listed = ClubAuction::where('seller_id', $club->id)->whereNotNull('active_card_id')->pluck('active_card_id')->all();
        $reserved = $market->pendingOfferedPlayers($club->id);
        $reserves = OwnedPlayerCard::where('user_id', $club->user_id)->where('catalog_id', $catalog->id)
            ->whereNotIn('id', [...array_column($club->starters ?? $club->lineup, 'instance_id'), ...$listed, ...$reserved])->get()
            ->map(function ($card) use ($players) {
                $profile = app(\App\Services\WorldPlayerProfiles::class)->definition($card, $players[$card->definition_id]);
                return ['id' => $card->id, 'name' => $card->persona_name ?? $profile['name'],
                    'role' => $profile['preferredRole'] ?? $profile['role'] ?? null, 'overall' => $profile['ovr'],
                    'nationality' => $profile['nationality'] ?? null, 'age' => $profile['age'] ?? null,
                    'wage' => $profile['wage'] ?? null, 'stats' => $profile['stats'] ?? []];
            });
        $auctions = ClubAuction::where('status', 'open')->where('closes_at', '>', now())
            ->with(['card', 'seller:id,name,tag,is_bot', 'bidder:id,name,tag,is_bot'])->orderBy('closes_at')->limit(100)->get()
            ->filter(fn($auction)=>$auction->card!==null)->map(function (ClubAuction $auction) use($players,$club){
                $profile=app(\App\Services\WorldPlayerProfiles::class)->definition($auction->card,$players[$auction->card->definition_id]);
                return [
                'id' => $auction->id, 'player' => $auction->card->persona_name??$players[$auction->card->definition_id]['name'] ?? 'Player',
                'seller' => $auction->seller->name, 'your_listing' => $auction->seller_id === $club->id,
                'player_id' => $auction->card->id, 'seller_id' => $auction->seller_id, 'seller_tag' => $auction->seller->tag,
                'seller_is_bot' => $auction->seller->is_bot,
                'bidder' => $auction->bidder?->only(['id', 'name', 'tag', 'is_bot']),
                'nationality'=>$profile['nationality']??null,'overall'=>$profile['ovr'],'role'=>$profile['preferredRole']??$profile['role']??null,
                'age'=>$profile['age']??null,'wage'=>$profile['wage']??null,'stats'=>$profile['stats']??[],
                'leading' => $auction->bidder_id === $club->id, 'bid' => $auction->bid, 'closes_at' => $auction->closes_at,
                'minimum' => $auction->bid === null ? $auction->opening_bid : $auction->bid + ClubMarketService::BID_INCREMENT,
            ];})->values();
        $trades = ClubTradeProposal::where(fn ($query) => $query->where('proposer_id', $club->id)->orWhere('recipient_id', $club->id))
            ->with(['proposer:id,name,tag', 'recipient:id,name,tag'])->latest()->limit(30)->get();
        $tradeCardIds = $trades->flatMap(fn ($trade) => [...$trade->offered_player_ids, ...$trade->requested_player_ids])->unique()->all();
        $tradeCards = OwnedPlayerCard::whereIn('id', $tradeCardIds)->get()->keyBy('id');
        $tradeData = $trades->map(function (ClubTradeProposal $trade) use ($club, $tradeCards, $players) {
            $other = $trade->proposer_id === $club->id ? $trade->recipient : $trade->proposer;
            $names = fn (array $ids) => collect($ids)->map(function (string $id) use ($tradeCards, $players) {
                $card = $tradeCards->get($id);
                return ['id' => $id, 'name' => $card?->persona_name ?? ($card ? ($players[$card->definition_id]['name'] ?? 'Player') : 'Transferred player')];
            })->all();
            return ['id' => $trade->id, 'status' => $trade->status, 'incoming' => $trade->recipient_id === $club->id,
                'other_club' => $other?->only(['id', 'name', 'tag']),
                'offered_players' => $names($trade->offered_player_ids), 'requested_players' => $names($trade->requested_player_ids),
                'offered_cash' => $trade->offered_cash, 'requested_cash' => $trade->requested_cash,
                'comparison' => $trade->comparison, 'expires_at' => $trade->expires_at];
        })->values();
        return response()->json(['data' => ['currency' => 'PHP', 'available' => $market->balance($club->id),
            'academy_opened_at' => $club->academy_opened_at, 'academy_opening_fee' => ClubMarketService::ACADEMY_OPENING_FEE,
            'youth_coach_wage' => ClubMarketService::YOUTH_COACH_WAGE,
            'scout_cost' => ClubMarketService::SCOUT_COST, 'reserves' => $reserves, 'auctions' => $auctions, 'trades' => $tradeData]]);
    }

    public function tradeTarget(Request $request, OnlineService $online, ClubMarketService $market)
    {
        $data = $request->validate(['tag' => ['required', 'regex:/^[A-Za-z0-9]{2,12}$/']]);
        $club = $online->provision($request->user());
        $target = OnlineClub::where('tag', strtoupper($data['tag']))->firstOrFail();
        abort_if($target->id === $club->id || $target->is_bot, 422, 'Choose another human-managed club.');
        $catalog = $online->activeCatalog();
        $templates = collect($catalog->payload['cards'])->keyBy('id');
        $listed = ClubAuction::where('seller_id', $target->id)->whereNotNull('active_card_id')->pluck('active_card_id')->all();
        $reserved = $market->pendingOfferedPlayers($target->id);
        $cards = OwnedPlayerCard::where('user_id', $target->user_id)->where('catalog_id', $catalog->id)
            ->whereNotIn('id', [...array_column($target->lineup, 'instance_id'), ...$listed, ...$reserved])->get()
            ->map(function ($card) use ($templates) {
                $profile = app(\App\Services\WorldPlayerProfiles::class)->definition($card, $templates[$card->definition_id]);
                return ['id' => $card->id, 'name' => $card->persona_name ?? $profile['name'],
                    'overall' => $profile['ovr'], 'role' => $profile['preferredRole'] ?? $profile['role'] ?? null,
                    'nationality' => $profile['nationality'] ?? null, 'stats' => $profile['stats'] ?? []];
            })->values();
        return response()->json(['data' => ['club' => $target->only(['id', 'name', 'tag']), 'players' => $cards]]);
    }

    public function propose(Request $request, OnlineService $online, ClubMarketService $market)
    {
        $data = $request->validate([
            'tag' => ['required', 'regex:/^[A-Za-z0-9]{2,12}$/'],
            'offered_player_ids' => ['required', 'array', 'min:1', 'max:5'],
            'offered_player_ids.*' => ['required', 'uuid', 'distinct'],
            'requested_player_ids' => ['required', 'array', 'min:1', 'max:5'],
            'requested_player_ids.*' => ['required', 'uuid', 'distinct'],
            'offered_cash' => ['sometimes', 'integer', 'min:0', 'max:1000000000'],
            'requested_cash' => ['sometimes', 'integer', 'min:0', 'max:1000000000'],
        ]);
        $proposer = $online->provision($request->user());
        $recipient = OnlineClub::where('tag', strtoupper($data['tag']))->firstOrFail();
        $proposal = $market->proposeTrade($proposer, $recipient, $data['offered_player_ids'], $data['requested_player_ids'],
            $data['offered_cash'] ?? 0, $data['requested_cash'] ?? 0);
        return response()->json(['data' => $proposal], 201);
    }

    public function tradeResponse(Request $request, int $id, OnlineService $online, ClubMarketService $market)
    {
        $data = $request->validate(['action' => ['required', 'in:accept,decline,withdraw']]);
        $proposal = $market->respondToTrade($online->provision($request->user()), $id, $data['action']);
        return response()->json(['data' => $proposal]);
    }

    public function scout(Request $request, OnlineService $online, ClubMarketService $market)
    {
        $data = $request->validate(['academy' => ['sometimes', 'boolean']]);
        abort_unless($data['academy']??false,410,'Direct prospect signing has been removed. Bid in the transfer market or develop your youth academy.');
        $market->scout($online->provision($request->user()), (bool) ($data['academy'] ?? false));
        return response()->noContent();
    }

    public function academy(Request $request, OnlineService $online, ClubMarketService $market)
    {
        $data = $request->validate(['open' => ['required', 'boolean']]);
        $market->setAcademy($online->provision($request->user()), (bool) $data['open']);
        return response()->noContent();
    }

    public function store(Request $request, OnlineService $online, ClubMarketService $market)
    {
        $data = $request->validate(['card_id' => ['required', 'uuid'], 'opening_bid' => ['required', 'integer', 'min:5000', 'max:1000000000']]);
        $market->list($online->provision($request->user()), $data['card_id'], $data['opening_bid']);
        return response()->noContent();
    }

    public function bid(Request $request, int $id, OnlineService $online, ClubMarketService $market)
    {
        $data = $request->validate(['amount' => ['required', 'integer', 'min:5000', 'max:1000000000']]);
        $market->bid($online->provision($request->user()), $id, $data['amount']);
        return response()->noContent();
    }
}
