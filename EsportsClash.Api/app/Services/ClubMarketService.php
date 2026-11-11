<?php

namespace App\Services;

use App\Models\{ClubAuction, ClubFixture, ClubTradeProposal, NormalQueueTicket, OnlineCatalog, OnlineClub, OwnedPlayerCard, ScrimmageQueueTicket};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ClubMarketService
{
    public const OPENING_BALANCE = 5_000_000;
    public const SCOUT_COST = 100_000;
    public const BID_INCREMENT = 5_000;
    public const ACADEMY_OPENING_FEE = 300_000;
    public const YOUTH_COACH_WAGE = 75_000;

    public function weeklyWages(OnlineClub $club,?OnlineCatalog $catalog=null,bool $negotiated=true): int
    {
        $catalog??=app(OnlineService::class)->activeCatalog();$templates=collect($catalog->payload['cards'])->keyBy('id');
        $base=OwnedPlayerCard::where('user_id',$club->user_id)->get()->mapWithKeys(fn($p)=>[$p->id=>max(0,(int)(app(WorldPlayerProfiles::class)->definition($p,$templates[$p->definition_id])['wage']??45))*100])->all();
        $wages=array_sum($base);
        if($negotiated&&app(WorldAgents::class)->ready())$wages+=app(WorldCareerContracts::class)->salaryDelta($club,$base);
        return $wages+($club->academy_opened_at?self::YOUTH_COACH_WAGE:0)+app(StaffContracts::class)->weeklySalary($club->id);
    }

    public function balance(int $clubId): int
    {
        DB::table('club_money_entries')->insertOrIgnore(['club_id' => $clubId, 'amount' => self::OPENING_BALANCE,
            'kind' => 'Opening balance', 'reference' => 'opening:'.$clubId, 'created_at' => now()]);
        return (int) DB::table('club_money_entries')->where('club_id', $clubId)->sum('amount');
    }

    private function entry(int $clubId, int $amount, string $kind, string $reference): void
    {
        DB::table('club_money_entries')->insert(['club_id' => $clubId, 'amount' => $amount,
            'kind' => $kind, 'reference' => $reference, 'created_at' => now()]);
    }

    private function transaction(callable $action): mixed
    {
        return DB::transaction(function () use ($action) {
            // Share the catalog lock with fixture allocation and lineup edits.
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            return $action($catalog);
        }, 3);
    }

    public function scout(OnlineClub $club, bool $academy = false): void
    {
        $this->transaction(function (OnlineCatalog $catalog) use ($club, $academy) {
            $club->refresh();
            $key = ($academy ? 'academy' : 'scouting').':'.$club->id.':'.now('Asia/Manila')->format('o-W');
            if ($academy) abort_if(! $club->academy_opened_at || $club->academy_opened_at->gt(now()->subWeek()), 409, 'The academy must operate for a week before promoting a prospect.');
            abort_if(DB::table('club_money_entries')->where('reference', $key)->exists(), 409, 'This recruitment channel has already been used this week.');
            $cost = $academy ? 0 : self::SCOUT_COST;
            abort_if($this->balance($club->id) < $cost, 422, 'Insufficient available money.');
            $owned = OwnedPlayerCard::where('user_id', $club->user_id)->pluck('definition_id')->all();
            $prospect = collect($catalog->payload['cards'])->first(fn ($card) => ! in_array($card['id'], $owned, true)
                && (app(WorldPlayerProfiles::class)->enabled() || ! $academy || ($card['age'] ?? 22) <= 19));
            abort_if(! $prospect, 409, 'No eligible prospect is available.');
            $card = OwnedPlayerCard::create(['id' => (string) Str::uuid(), 'user_id' => $club->user_id,
                'catalog_id' => $catalog->id, 'definition_id' => $prospect['id'], 'grant_key' => $key]);
            app(WorldPlayerIdentity::class)->assign($card,$catalog,!$club->is_bot,$academy?'academy':'scouting');
            $this->entry($club->id, -$cost, $academy ? 'Academy promotion' : 'Scout signing', $key);
            app(WorldActivityService::class)->record($key, 'recruitment', $club, $club->name.' signed '.($card->persona_name??$prospect['name']).($academy ? ' from its academy.' : ' through scouting.'), ['player_id' => $card->id, 'player_instance_id' => $card->id]);
        });
    }

    public function setAcademy(OnlineClub $club, bool $open): void
    {
        $this->transaction(function () use ($club, $open) {
            $club->refresh();
            if ((bool) $club->academy_opened_at === $open) return;
            if ($open) {
                abort_if($this->balance($club->id) < self::ACADEMY_OPENING_FEE, 422, 'Insufficient available money.');
                $this->entry($club->id, -self::ACADEMY_OPENING_FEE, 'Academy opening', 'academy-opening:'.Str::uuid());
            } else {
                $this->payroll($club);
            }
            $club->update(['academy_opened_at' => $open ? now() : null]);
        });
    }

    public function payroll(OnlineClub $club): void
    {
        $this->transaction(function (OnlineCatalog $catalog) use ($club) {
            $week = now('Asia/Manila')->startOfWeek();
            if ($club->created_at->gte($week)) return;
            $key = 'payroll:'.$club->id.':'.$week->copy()->subWeek()->format('o-W');
            if (DB::table('club_money_entries')->where('reference', $key)->exists()) return;
            $club->refresh();
            $wages=$this->weeklyWages($club,$catalog,false)-app(StaffContracts::class)->weeklySalary($club->id);
            if(app(WorldAgents::class)->ready()){
                $wages+=app(WorldCareerContracts::class)->salaryDelta($club,[],$week->copy()->subWeek(),$week);
                $wages+=app(WorldCareerContracts::class)->basePayrollAdjustment($club,$week->copy()->subWeek(),$week);
            }
            if($club->academy_opened_at && $club->academy_opened_at->gte($week))$wages-=self::YOUTH_COACH_WAGE;
            $this->balance($club->id);
            $this->entry($club->id, -$wages, 'Weekly payroll', $key);
            $staffCost=app(StaffContracts::class)->salaryForPeriod($club->id,$week->copy()->subWeek()->toImmutable()->utc(),$week->toImmutable()->utc());
            if($staffCost)$this->entry($club->id,-$staffCost,'Staff payroll','staff-'.$key);
        });
    }

    public function list(OnlineClub $seller, string $cardId, int $openingBid): void
    {
        abort_if($openingBid < self::BID_INCREMENT || $openingBid > 1_000_000_000, 422, 'The opening bid is outside the market limits.');
        $this->transaction(function (OnlineCatalog $catalog) use ($seller, $cardId, $openingBid) {
            $seller->refresh();
            $card = OwnedPlayerCard::whereKey($cardId)->where('user_id', $seller->user_id)
                ->where('catalog_id', $catalog->id)->firstOrFail();
            abort_if($this->queueLocked($seller), 409, 'Leave matchmaking before listing a player.');
            $this->assertTradeable($seller, [$card->id], $catalog);
            abort_if(ClubAuction::where('active_card_id', $card->id)->exists(), 409, 'That player is already listed.');
            $auction = ClubAuction::create(['seller_id' => $seller->id, 'card_id' => $card->id, 'active_card_id' => $card->id,
                'opening_bid' => $openingBid, 'closes_at' => now()->addHours(24)]);
            $name = $card->persona_name ?? collect($catalog->payload['cards'])->firstWhere('id', $card->definition_id)['name'] ?? 'a reserve player';
            app(WorldActivityService::class)->record('auction:'.$auction->id.':listed', 'auction', $seller, $seller->name.' listed '.$name.' for auction.', ['player_id' => $card->definition_id, 'player_instance_id' => $card->id, 'auction_id' => $auction->id, 'amount' => $openingBid, 'currency' => 'PHP']);
        });
    }

    public function expireTrades(): void
    {
        $this->transaction(function (OnlineCatalog $_catalog): void {
            $expired = ClubTradeProposal::where('status', 'pending')->where('expires_at', '<=', now())->lockForUpdate()->get();
            foreach ($expired as $proposal) {
                if ($proposal->offered_cash > 0) {
                    $this->entry($proposal->proposer_id, $proposal->offered_cash, 'Trade offer refunded', "trade:$proposal->id:refund");
                }
                $proposal->update(['status' => 'expired', 'resolved_at' => now()]);
                app(ClubOffice::class)->notify($proposal->proposer_id, "trade:$proposal->id:expired", 'market', 'Trade proposal expired',
                    'The proposal was not accepted in time. Reserved cash, if any, has been returned.', ['type' => 'route', 'route' => 'market']);
            }
        });
    }

    public function pendingOfferedPlayers(int $clubId): array
    {
        return ClubTradeProposal::where('proposer_id', $clubId)->where('status', 'pending')->where('expires_at', '>', now())
            ->get()->flatMap(fn (ClubTradeProposal $proposal) => $proposal->offered_player_ids)->unique()->values()->all();
    }

    public function proposeTrade(OnlineClub $proposer, OnlineClub $recipient, array $offeredIds, array $requestedIds, int $offeredCash, int $requestedCash): ClubTradeProposal
    {
        abort_if($proposer->id === $recipient->id, 422, 'Choose another club.');
        abort_if(count($offeredIds) < 1 || count($requestedIds) < 1 || count($offeredIds) > 5 || count($requestedIds) > 5
            || count(array_unique($offeredIds)) !== count($offeredIds) || count(array_unique($requestedIds)) !== count($requestedIds), 422, 'Offer one to five distinct reserve players from each club.');
        abort_if($offeredCash < 0 || $requestedCash < 0 || $offeredCash > 1_000_000_000 || $requestedCash > 1_000_000_000, 422, 'Cash amounts exceed the transfer limits.');

        return $this->transaction(function (OnlineCatalog $catalog) use ($proposer, $recipient, $offeredIds, $requestedIds, $offeredCash, $requestedCash): ClubTradeProposal {
            $clubs = OnlineClub::whereKey([$proposer->id, $recipient->id])->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $seller = $clubs[$proposer->id] ?? null;
            $buyer = $clubs[$recipient->id] ?? null;
            abort_unless($seller && $buyer, 404);
            abort_if($this->queueLocked($seller) || $this->queueLocked($buyer), 409, 'A club must leave matchmaking before proposing a trade.');
            $this->assertTradeable($seller, $offeredIds, $catalog);
            $this->assertTradeable($buyer, $requestedIds, $catalog);
            abort_if($this->balance($seller->id) < $offeredCash, 422, 'Insufficient available money for the offered cash.');

            $comparison = $this->tradeComparison($offeredIds, $requestedIds, $offeredCash, $requestedCash, $catalog);
            if(app(WorldAgents::class)->ready()){
                $bindings=[];
                foreach([[$offeredIds,$buyer],[$requestedIds,$seller]] as [$ids,$destination])foreach(OwnedPlayerCard::whereIn('id',$ids)->get() as $p){
                    abort_unless(app(WorldCareerContracts::class)->consent($p,$destination),422,'A player wants to negotiate employment terms before this trade.');
                    $bindings[$p->id]=app(WorldCareerContracts::class)->acceptedTransferTerms($p->id,$destination->id);
                }$comparison['career_terms']=$bindings;
            }
            $proposal = ClubTradeProposal::create([
                'proposer_id' => $seller->id,
                'recipient_id' => $buyer->id,
                'offered_player_ids' => $offeredIds,
                'requested_player_ids' => $requestedIds,
                'offered_cash' => $offeredCash,
                'requested_cash' => $requestedCash,
                'comparison' => $comparison,
                ...(app(WorldAgents::class)->ready()?['proposer_epoch'=>$seller->management_epoch??0,'recipient_epoch'=>$buyer->management_epoch??0]:[]),
                'status' => 'pending',
                'expires_at' => now()->addHours(48),
            ]);
            if ($offeredCash > 0) $this->entry($seller->id, -$offeredCash, 'Trade offer escrow', "trade:$proposal->id:offer");
            app(ClubOffice::class)->notify($buyer->id, "trade:$proposal->id:received", 'market', 'Player trade proposal received',
                'Review the players, cash, and non-binding comparison before accepting or declining.',
                ['type' => 'route', 'route' => 'market', 'trade_id' => $proposal->id], $proposal->expires_at);

            return $proposal;
        });
    }

    public function respondToTrade(OnlineClub $club, int $proposalId, string $action,?int $managementEpoch=null): ClubTradeProposal
    {
        abort_unless(in_array($action, ['accept', 'decline', 'withdraw'], true), 422);

        return $this->transaction(function (OnlineCatalog $catalog) use ($club, $proposalId, $action,$managementEpoch): ClubTradeProposal {
            $club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            if($managementEpoch!==null)app(WorldCareers::class)->authority($club,true,$managementEpoch);
            $proposal = ClubTradeProposal::whereKey($proposalId)->lockForUpdate()->firstOrFail();
            $isProposer = $proposal->proposer_id === $club->id;
            abort_unless($isProposer ? $action === 'withdraw' : $proposal->recipient_id === $club->id && $action !== 'withdraw', 403);
            if ($proposal->status !== 'pending') return $proposal;
            if ($proposal->expires_at->lte(now())) {
                if ($proposal->offered_cash > 0) $this->entry($proposal->proposer_id, $proposal->offered_cash, 'Trade offer refunded', "trade:$proposal->id:refund");
                $proposal->update(['status' => 'expired', 'resolved_at' => now()]);
                app(ClubOffice::class)->notify($proposal->proposer_id, "trade:$proposal->id:expired", 'market', 'Trade proposal expired',
                    'The proposal was not accepted in time. Reserved cash, if any, has been returned.', ['type' => 'route', 'route' => 'market']);
                return $proposal->fresh();
            }

            if ($action === 'withdraw' || $action === 'decline') {
                if ($proposal->offered_cash > 0) $this->entry($proposal->proposer_id, $proposal->offered_cash, 'Trade offer refunded', "trade:$proposal->id:refund");
                $proposal->update(['status' => $action === 'withdraw' ? 'withdrawn' : 'declined', 'resolved_at' => now()]);
                $notifiedClub = $action === 'withdraw' ? $proposal->recipient_id : $proposal->proposer_id;
                app(ClubOffice::class)->notify($notifiedClub, "trade:$proposal->id:$action", 'market',
                    $action === 'withdraw' ? 'Trade proposal withdrawn' : 'Trade proposal declined',
                    'The proposal is closed and any reserved cash has been returned.', ['type' => 'route', 'route' => 'market']);
                return $proposal->fresh();
            }

            $clubs = OnlineClub::whereKey([$proposal->proposer_id, $proposal->recipient_id])->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $seller = $clubs[$proposal->proposer_id] ?? null;
            $buyer = $clubs[$proposal->recipient_id] ?? null;
            abort_unless($seller && $buyer, 409, 'A club in this proposal is no longer available.');
            abort_if($this->queueLocked($seller) || $this->queueLocked($buyer), 409, 'A club must leave matchmaking before completing the trade.');
            $this->assertTradeable($seller, $proposal->offered_player_ids, $catalog, $proposal->id);
            $this->assertTradeable($buyer, $proposal->requested_player_ids, $catalog, $proposal->id);
            abort_if($this->balance($buyer->id) < $proposal->requested_cash, 422, 'The requested cash is no longer available.');

            $offered = OwnedPlayerCard::whereIn('id', $proposal->offered_player_ids)->where('user_id', $seller->user_id)->lockForUpdate()->get();
            $requested = OwnedPlayerCard::whereIn('id', $proposal->requested_player_ids)->where('user_id', $buyer->user_id)->lockForUpdate()->get();
            abort_unless($offered->count() === count($proposal->offered_player_ids) && $requested->count() === count($proposal->requested_player_ids), 409, 'A player is no longer available for this trade.');
            foreach ($offered as $card){if(app(WorldAgents::class)->ready())app(WorldAgents::class)->player($card);$card->update(['user_id' => $buyer->user_id]);app(WorldCareerContracts::class)->moved($card,$seller,$buyer,'trade:'.$proposal->id,$proposal->comparison['career_terms'][$card->id]??null);}
            foreach ($requested as $card){if(app(WorldAgents::class)->ready())app(WorldAgents::class)->player($card);$card->update(['user_id' => $seller->user_id]);app(WorldCareerContracts::class)->moved($card,$buyer,$seller,'trade:'.$proposal->id,$proposal->comparison['career_terms'][$card->id]??null);}

            if ($proposal->offered_cash > 0) $this->entry($buyer->id, $proposal->offered_cash, 'Trade cash received', "trade:$proposal->id:offer-transfer");
            if ($proposal->requested_cash > 0) {
                $this->entry($buyer->id, -$proposal->requested_cash, 'Trade cash paid', "trade:$proposal->id:request");
                $this->entry($seller->id, $proposal->requested_cash, 'Trade cash received', "trade:$proposal->id:request-transfer");
            }
            $proposal->update(['status' => 'accepted', 'resolved_at' => now()]);
            app(ClubOffice::class)->notify($seller->id, "trade:$proposal->id:accepted", 'market', 'Trade accepted',
                'The agreed players and cash have transferred. Review your squad and available balance.', ['type' => 'route', 'route' => 'squad']);
            app(ClubOffice::class)->notify($buyer->id, "trade:$proposal->id:accepted-copy", 'market', 'Trade completed',
                'The agreed players and cash have transferred. Review your squad and available balance.', ['type' => 'route', 'route' => 'squad']);
            app(WorldActivityService::class)->record("trade:$proposal->id:completed", 'transfer', $buyer,
                $seller->name.' and '.$buyer->name.' completed a direct player trade.',
                ['trade_id' => $proposal->id, 'seller_id' => $seller->id, 'buyer_id' => $buyer->id,
                    'player_instance_id' => $offered->first()->id]);

            return $proposal->fresh();
        });
    }

    private function queueLocked(OnlineClub $club): bool
    {
        $normal = NormalQueueTicket::where('user_id', $club->user_id)->first();
        $activeMatch = $normal?->match_id && \App\Models\OnlineMatch::whereKey($normal->match_id)->whereIn('status', ['allocated', 'running'])->exists();
        return ($normal?->status === 'queued') || $activeMatch
            || ScrimmageQueueTicket::where('user_id', $club->user_id)->where('status', 'queued')->exists()
            || ClubFixture::awaitingSnapshot($club->id);
    }

    private function assertTradeable(OnlineClub $club, array $ids, OnlineCatalog $catalog, ?int $ignoreProposalId = null): void
    {
        $cards = OwnedPlayerCard::whereIn('id', $ids)->where('user_id', $club->user_id)->where('catalog_id', $catalog->id)->get();
        abort_unless($cards->count() === count($ids), 422, 'Every offered player must still belong to its club.');
        $starterIds = array_column($club->starters ?? $club->lineup, 'instance_id');
        abort_if(array_intersect($ids, $starterIds), 422, 'Starting lineup players cannot be traded.');
        abort_if(ClubAuction::whereIn('active_card_id', $ids)->exists(), 409, 'A listed player cannot be traded.');
        $fixtureRows = ClubFixture::where('kickoff_at', '>', now())
            ->where(fn ($query) => $query->where('home_club_id', $club->id)->orWhere('away_club_id', $club->id))
            ->get(['home_club_id', 'away_club_id', 'home_orders', 'away_orders']);
        foreach ($fixtureRows as $fixture) {
            $orders = $fixture->home_club_id === $club->id ? $fixture->home_orders : $fixture->away_orders;
            $orders ??= $club->starters ?? $club->lineup;
            if (array_intersect($ids, array_column($orders, 'instance_id'))) {
                abort(409, 'A player saved in an upcoming fixture order cannot be traded.');
            }
        }
        $reserved = ClubTradeProposal::where('status', 'pending')->where('expires_at', '>', now())
            ->when($ignoreProposalId, fn ($query) => $query->where('id', '<>', $ignoreProposalId))->get()
            ->flatMap(fn (ClubTradeProposal $proposal) => $proposal->proposer_id === $club->id ? $proposal->offered_player_ids : []);
        abort_if($reserved->intersect($ids)->isNotEmpty(), 409, 'A player already committed to another pending trade cannot be traded.');
    }

    private function tradeComparison(array $offeredIds, array $requestedIds, int $offeredCash, int $requestedCash, OnlineCatalog $catalog): array
    {
        $definitions = collect($catalog->payload['cards'])->keyBy('id');
        $players = OwnedPlayerCard::whereIn('id', [...$offeredIds, ...$requestedIds])->get()->keyBy('id');
        $value = function (array $ids) use ($players, $definitions): int {
            return collect($ids)->sum(function (string $id) use ($players, $definitions): int {
                $player = $players[$id];
                $profile = app(WorldPlayerProfiles::class)->definition($player, $definitions[$player->definition_id]);
                return (int) round($profile['ovr'] * 100_000);
            });
        };
        $offerValue = $value($offeredIds) + $offeredCash;
        $requestValue = $value($requestedIds) + $requestedCash;
        $difference = $offerValue - $requestValue;

        return [
            'method' => 'Player overall × PHP 1,000 plus cash',
            'offered_value' => $offerValue,
            'requested_value' => $requestValue,
            'difference' => $difference,
            'assessment' => abs($difference) <= max(100_000, (int) round(max($offerValue, $requestValue) * 0.15)) ? 'close' : ($difference > 0 ? 'offer-ahead' : 'request-ahead'),
            'binding' => false,
        ];
    }

    public function bid(OnlineClub $bidder, int $auctionId, int $amount): void
    {
        abort_if($amount < self::BID_INCREMENT || $amount > 1_000_000_000, 422, 'The bid is outside the market limits.');
        $this->transaction(function () use ($bidder, $auctionId, $amount) {
            $auction = ClubAuction::whereKey($auctionId)->lockForUpdate()->firstOrFail();
            abort_if($auction->status !== 'open' || $auction->closes_at->lte(now()), 409, 'The auction is closed.');
            abort_if($auction->seller_id === $bidder->id, 422, 'You cannot bid on your own player.');
            $minimum = $auction->bid === null ? $auction->opening_bid : $auction->bid + self::BID_INCREMENT;
            abort_if($amount < $minimum, 422, 'The bid is below the current minimum.');
            $ownHold = $auction->bidder_id === $bidder->id ? $auction->bid : 0;
            abort_if($amount > $this->balance($bidder->id) + $ownHold, 422, 'Insufficient available money.');
            if(app(WorldAgents::class)->ready()){
                $activated=DB::table('living_world_runtime')->value('careers_activated_at');
                if($activated&&$auction->created_at->gte(\Carbon\Carbon::parse($activated)))abort_unless(app(WorldCareerContracts::class)->consent($auction->card,$bidder),422,'The player wants to discuss employment terms before this move. Submit a transfer-terms offer in the career desk.');
            }

            if ($auction->bidder_id !== null) {
                $this->entry($auction->bidder_id, $auction->bid, 'Bid released', "auction:$auctionId:release:$auction->bid");
            }
            $this->entry($bidder->id, -$amount, 'Bid reserved', "auction:$auctionId:bid:$amount");
            if($auction->bidder_id && $auction->bidder_id!==$bidder->id)app(ClubOffice::class)->notify($auction->bidder_id,"outbid:$auctionId:$amount",'market','You have been outbid','Your previous reservation was released back to available money. Review the current auction before bidding again.',['type'=>'route','route'=>'market','auction_id'=>$auctionId],$auction->closes_at);
            $auction->update(['bidder_id' => $bidder->id, 'bid' => $amount,...(app(WorldAgents::class)->ready()?['career_negotiation_id'=>app(WorldCareerContracts::class)->acceptedTransferTerms($auction->card_id,$bidder->id)]:[])]);
            app(WorldActivityService::class)->record("auction:$auctionId:bid:$amount", 'bid', $bidder, $bidder->name.' placed a bid in the transfer market.', ['auction_id' => $auctionId, 'player_id' => $auction->card->definition_id, 'player_instance_id' => $auction->card_id, 'amount' => $amount, 'currency' => 'PHP']);
        });
    }

    public function close(int $auctionId): void
    {
        $this->transaction(function (OnlineCatalog $catalog) use ($auctionId) {
            $auction = ClubAuction::whereKey($auctionId)->lockForUpdate()->firstOrFail();
            if ($auction->status !== 'open' || $auction->closes_at->isFuture()) return;
            $seller = $auction->seller;
            if (ClubFixture::awaitingSnapshot($seller->id)) return;
            $card = $auction->card;
            $eligible = $card->user_id === $seller->user_id
                && ! in_array($card->id, array_column($seller->starters ?? $seller->lineup, 'instance_id'), true);
            $sold = $eligible && $auction->bidder_id !== null;
            if ($sold) {
                $buyer = OnlineClub::findOrFail($auction->bidder_id);
                if(app(WorldAgents::class)->ready())app(WorldAgents::class)->player($card);
                $card->update(['user_id' => $buyer->user_id]);
                app(WorldCareerContracts::class)->moved($card,$seller,$buyer,'auction:'.$auctionId,$auction->career_negotiation_id);
                $this->entry($seller->id, $auction->bid, 'Player sale', "auction:$auctionId:sale");
            } elseif ($auction->bidder_id !== null) {
                $this->entry($auction->bidder_id, $auction->bid, 'Bid refunded', "auction:$auctionId:refund");
            }
            $auction->update(['status' => $sold ? 'sold' : 'closed', 'active_card_id' => null]);
            app(ClubOffice::class)->notify($seller->id,"auction:$auctionId:closed",'market',$sold?'Your player auction has sold':'Your auction has closed',$sold?'The settled sale is recorded in your money ledger and the player career record.':'No player transfer was completed. Any held bid has been refunded.',['type'=>'route','route'=>'market']);
            if($sold)app(ClubOffice::class)->notify($buyer->id,"auction:$auctionId:won",'market','Auction won: player joined','The player is now under your club contract. Review their role and update your saved lineup.',['type'=>'route','route'=>'squad']);
            $name = $card->persona_name ?? collect($catalog->payload['cards'])->firstWhere('id', $card->definition_id)['name'] ?? 'a reserve player';
            app(WorldActivityService::class)->record("auction:$auctionId:closed", $sold ? 'transfer' : 'auction', $seller,
                $sold ? $name.' joined '.$buyer->name.' from '.$seller->name.'.' : $seller->name.' closed an unsold auction for '.$name.'.',
                ['auction_id' => $auctionId, 'player_id' => $card->definition_id, 'player_instance_id' => $card->id, 'seller_id' => $seller->id,
                    ...($sold ? ['buyer_id' => $buyer->id, 'amount' => $auction->bid, 'currency' => 'PHP'] : [])]);
        });
    }

    public function assertCareerRelease(OnlineClub $club,array $ids):void {
        abort_if($this->queueLocked($club)||ClubFixture::awaitingSnapshot($club->id),409,'Finish or leave the current match allocation first.');
        abort_if(DB::table('competition_player_reservations')->whereIn('player_id',$ids)->where('ends_at','>',now())->exists(),409,'A national call-up or recovery reservation still protects this player.');
        $catalog=app(OnlineService::class)->activeCatalog();$this->assertTradeable($club,$ids,$catalog);
        abort_if(OwnedPlayerCard::where('user_id',$club->user_id)->count()-count($ids)<5,409,'A club must retain at least five active players.');
    }
    public function releaseReserve(OnlineClub $club,string $player,bool $autonomous=false,?int $epoch=null):void {
        $this->transaction(fn()=>app(WorldFreeAgency::class)->release($club,$player,$autonomous,$epoch));
    }
    public function signFreeAgent(OnlineClub $club,OwnedPlayerCard $player,int $salary,int $agreement):void {
        $this->transaction(function()use($club,$player,$salary,$agreement){$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();$player=OwnedPlayerCard::whereKey($player->id)->lockForUpdate()->firstOrFail();app(WorldFreeAgency::class)->sign($club,$player,$salary,$agreement);});
    }

}
