<?php

namespace App\Services;

use App\Models\ClubAuction;
use App\Models\ClubFixture;
use App\Models\ClubTournament;
use App\Models\OnlineCatalog;
use App\Models\OnlineClub;
use App\Models\OwnedPlayerCard;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/** Rule-based club management. All transfers use the same escrow and ownership services as human managers. */
class BotClubManager
{
    public function __construct(private ClubMarketService $market, private ClubDevelopmentService $development, private OnlineService $online, private ClubTournamentService $tournaments) {}

    public function run(int $clubId, string $window): void
    {
        $slot = Carbon::parse($window)->utc();
        if ($slot->minute % 15 !== 0 || $slot->second !== 0 || $slot->isFuture() || $slot->lt(now()->subMinutes(30))) {
            return;
        }
        $ran = DB::transaction(function () use ($clubId, $slot) {
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $club = OnlineClub::whereKey($clubId)->where('is_bot', true)->lockForUpdate()->first();
            if (! $club || DB::table('club_world_turns')->where('club_id', $clubId)->where('window_at', $slot)->exists()) {
                return false;
            }
            $summary = [];
            if (! ClubFixture::awaitingSnapshot($clubId)) {
                $this->market->payroll($club);
                if($staffDecision=app(StaffContracts::class)->considerBot($club))$summary[]=$staffDecision;
                $this->considerAcademy($club, $summary);
                $this->development->manageBot($club, $this->market, $this->online);
                $club->refresh();
                $templates = collect($catalog->payload['cards'])->keyBy('id');
                $avatars = collect($catalog->payload['avatars'])->keyBy('id');
                $owned = OwnedPlayerCard::where('user_id', $club->user_id)->where('catalog_id', $catalog->id)->get();
                $definitions = $owned->mapWithKeys(fn ($player) => [$player->id => app(WorldPlayerProfiles::class)->definition($player, $templates[$player->definition_id])]);
                $listed = ClubAuction::where('seller_id', $clubId)->whereNotNull('active_card_id')->pluck('active_card_id')->all();
                $wages = $this->market->weeklyWages($club, $catalog);
                $spendable = max(0, $this->market->balance($clubId) - config('world_players.bot_wage_reserve_weeks') * $wages);
                $this->considerSale($club, $owned, $definitions, $avatars, $listed, $spendable === 0, $summary);
                $listed = ClubAuction::where('seller_id', $clubId)->whereNotNull('active_card_id')->pluck('active_card_id')->all();
                $this->considerBid($club, $owned, $definitions, $avatars, $listed, $spendable, $catalog->id, $summary, $templates);
                if (Schema::hasTable('bot_club_plans')) {
                    DB::table('bot_club_plans')->updateOrInsert(['club_id' => $clubId], [
                        'plan' => json_encode(['target_roster' => 8, 'reserve_weeks' => config('world_players.bot_wage_reserve_weeks'), 'weekly_payroll' => $wages,
                            'available_after_actions' => $this->market->balance($clubId), 'academy_open' => $club->academy_opened_at !== null, 'decisions' => $summary]), 'reviewed_at' => now()]);
                }
            } else {
                $summary[] = 'Fixture order lock takes precedence.';
            }
            DB::table('club_world_turns')->insert(['club_id' => $clubId, 'window_at' => $slot, 'completed_at' => now(), 'summary' => json_encode($summary, JSON_THROW_ON_ERROR)]);

            return true;
        }, 3);
        // Registration takes the event lock after market/lineup locks have committed.
        if ($ran && ($club = OnlineClub::find($clubId))) {
            $summary = [];
            $this->considerTournament($club, $summary);
        }
    }

    private function considerAcademy(OnlineClub $club, array &$summary): void
    {
        if (! app(WorldPlayerProfiles::class)->enabled()) {
            return;
        }
        $balance = $this->market->balance($club->id);
        $wages = $this->market->weeklyWages($club);
        if ($club->academy_opened_at && $balance < $wages * config('world_players.bot_wage_reserve_weeks')) {
            $this->attempt(fn () => $this->market->setAcademy($club, false), $summary, 'Closed the academy to protect payroll.');
            $club->refresh();
        } elseif (! $club->academy_opened_at && $balance > ClubMarketService::ACADEMY_OPENING_FEE + $wages * 6 + ClubMarketService::YOUTH_COACH_WAGE * 12) {
            $this->attempt(fn () => $this->market->setAcademy($club, true), $summary, 'Funded an optional academy with twelve weeks of coach cover.');
            $club->refresh();
        }
    }

    private function fits(array $player, array $avatar): bool
    {
        $roles = array_filter([...($player['playableRoles'] ?? []), $player['preferredRole'] ?? null, $player['role'] ?? null]);

        return in_array($avatar['primaryRole'] ?? null, $roles, true) || in_array($avatar['secondaryRole'] ?? null, $roles, true);
    }

    private function considerSale(OnlineClub $club, Collection $owned, Collection $definitions, Collection $avatars, array $listed, bool $cashPressure, array &$summary): void
    {
        if ($listed || $owned->count() <= 5) {
            return;
        }
        $starters = array_column($club->starters ?? $club->lineup, 'instance_id');
        $candidate = $owned->filter(fn ($card) => ! in_array($card->id, $starters, true))->sortBy(fn ($card) => $definitions[$card->id]['ovr'] ?? 0)
            ->first(function ($card) use ($club, $definitions, $avatars, $owned, $cashPressure) {
                if ($owned->count() > 8 || $cashPressure) {
                    return true;
                }
                foreach ($club->lineup as $slot) {
                    $avatar = $avatars[$slot['avatar_id']] ?? [];
                    if (! $this->fits($definitions[$card->id] ?? [], $avatar)) {
                        continue;
                    }
                    $otherDepth = $owned->filter(fn ($other) => $other->id !== $card->id && $this->fits($definitions[$other->id] ?? [], $avatar))->count();
                    if ($otherDepth < 2) {
                        return false;
                    }
                }

                return true;
            });
        if (! $candidate) {
            return;
        }
        $wage = max(0, (int) ($definitions[$candidate->id]['wage'] ?? 45));
        $opening = max(ClubMarketService::BID_INCREMENT, (int) ceil($wage * 800 / ClubMarketService::BID_INCREMENT) * ClubMarketService::BID_INCREMENT);
        $this->attempt(fn () => $this->market->list($club, $candidate->id, $opening), $summary, 'Listed a surplus reserve.');
    }

    private function considerBid(OnlineClub $club, Collection $owned, Collection $definitions, Collection $avatars, array $listed, int $spendable, string $catalogId, array &$summary, Collection $templates): void
    {
        $leading = ClubAuction::where('status', 'open')->where('bidder_id', $club->id)->where('closes_at', '>', now())->count();
        if ($spendable < ClubMarketService::BID_INCREMENT || $leading >= 2 || $owned->count() + $leading >= 10) {
            return;
        }
        $byId = $owned->keyBy('id');
        $best = null;
        foreach (ClubAuction::where('status', 'open')->where('closes_at', '>', now())->where('seller_id', '<>', $club->id)
            ->where(fn ($query) => $query->whereNull('bidder_id')->orWhere('bidder_id', '<>', $club->id))
            ->with('card')->orderBy('closes_at')->limit(100)->get() as $auction) {
            $candidate = $auction->card;
            if (! $candidate || $candidate->catalog_id !== $catalogId || $candidate->user_id === $club->user_id) {
                continue;
            }
            $player = isset($templates[$candidate->definition_id]) ? app(WorldPlayerProfiles::class)->definition($candidate, $templates[$candidate->definition_id]) : null;
            if (! $player) {
                continue;
            }
            $need = 0;
            foreach ($club->lineup as $slot) {
                $avatar = $avatars[$slot['avatar_id']] ?? [];
                if (! $this->fits($player, $avatar)) {
                    continue;
                }
                $starter = $byId[$slot['instance_id']] ?? null;
                $improvement = ($player['ovr'] ?? 0) - ($definitions[$starter?->id]['ovr'] ?? 0);
                if ($improvement >= 2) {
                    $need = max($need, 200 + $improvement);
                }
                $depth = $owned->filter(fn ($card) => ! in_array($card->id, $listed, true) && $this->fits($definitions[$card->id] ?? [], $avatar))->count();
                if ($owned->count() + $leading < 8 && $depth < 2) {
                    $need = max($need, 100 + (int) ($player['ovr'] ?? 0));
                }
            }
            if (! $need) {
                continue;
            }
            $minimum = $auction->bid === null ? $auction->opening_bid : $auction->bid + ClubMarketService::BID_INCREMENT;
            $comparable = ClubAuction::where('status', 'sold')->whereHas('card', fn ($query) => $query->where('definition_id', $candidate->definition_id))
                ->latest('updated_at')->limit(10)->pluck('bid')->median();
            $ceiling = min((int) floor($spendable * config('world_players.bot_bid_fraction')), $comparable ? (int) floor($comparable * 1.25) : max(ClubMarketService::BID_INCREMENT, (int) ($player['wage'] ?? 45) * 1200));
            if ($minimum > $ceiling) {
                continue;
            }
            if ($best === null || $need > $best['need']) {
                $best = ['auction' => $auction, 'amount' => $minimum, 'need' => $need];
            }
        }
        if ($best) {
            $this->attempt(fn () => $this->market->bid($club, $best['auction']->id, $best['amount']), $summary, 'Bid on a compatible upgrade or missing reserve role.');
        }
    }

    private function considerTournament(OnlineClub $club, array &$summary): void
    {
        foreach (ClubTournament::where('participant_type', 'club')->where(fn ($q) => $q->where('tier', $club->tier)->orWhereNull('tier'))->where('status', 'registration')->where('registration_closes_at', '>', now())->orderBy('semifinals_at')->limit(20)->get() as $event) {
            $entries = DB::table('club_tournament_entries')->where('tournament_id', $event->id);
            if ((clone $entries)->where('club_id', $club->id)->exists() || $entries->count() >= $event->capacity) {
                continue;
            }
            $this->attempt(fn () => $this->tournaments->register($event->id, $club), $summary, 'Entered an eligible scheduled competition.');
            break;
        }
    }

    private function attempt(callable $action, array &$summary, string $success): void
    {
        try {
            $action();
            $summary[] = $success;
        } catch (HttpExceptionInterface $error) {
            if (! in_array($error->getStatusCode(), [403, 404, 409, 422], true)) {
                throw $error;
            }
        } catch (ValidationException) { /* A newer lineup, deadline or balance takes precedence. */
        }
    }
}
