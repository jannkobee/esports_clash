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

/** Needs-based management with persistent preferences, using the same legal services as humans. */
class BotClubManager
{
    public function __construct(private ClubMarketService $market, private ClubDevelopmentService $development, private OnlineService $online, private ClubTournamentService $tournaments) {}

    public function run(int $clubId, string $window, ?int $epoch = null): void
    {
        if(!app(LivingWorldEngine::class)->managementAllowed())return;
        $slot = Carbon::parse($window)->utc();
        if ($slot->minute % 15 !== 0 || $slot->second !== 0 || $slot->isFuture() || $slot->lt(now()->subMinutes(30))) {
            return;
        }
        $ran = DB::transaction(function () use ($clubId, $slot, $epoch) {
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $club = OnlineClub::whereKey($clubId)->where('is_bot', true)->lockForUpdate()->first();
            if (! $club || ($epoch !== null && (int)$club->management_epoch !== $epoch) || DB::table('club_world_turns')->where('club_id', $clubId)->where('window_at', $slot)->exists()) {
                return false;
            }
            $summary = [];
            $policy = app(WorldManagerPolicy::class)->assess($club, OwnedPlayerCard::where('user_id', $club->user_id)->count(), $this->market->balance($clubId), $this->market->weeklyWages($club));
            if (! ClubFixture::awaitingSnapshot($clubId)) {
                $this->market->payroll($club);
                if($staffDecision=app(StaffContracts::class)->considerBot($club))$summary[]=$staffDecision;
                $this->considerAcademy($club, $summary, $policy['academy_cover_weeks']);
                $freeOpportunity=$this->considerFreeAgent($club,$catalog,$policy,$summary);
                $this->development->manageBot($club, $this->market, $this->online, $policy['target_roster'],!$freeOpportunity&&!$this->preferMarket($club,$catalog,$policy));
                $club->refresh();
                $templates = collect($catalog->payload['cards'])->keyBy('id');
                $avatars = collect($catalog->payload['avatars'])->keyBy('id');
                $owned = OwnedPlayerCard::where('user_id', $club->user_id)->where('catalog_id', $catalog->id)->get();
                $definitions = $owned->mapWithKeys(fn ($player) => [$player->id => app(WorldPlayerProfiles::class)->definition($player, $templates[$player->definition_id])]);
                $listed = ClubAuction::where('seller_id', $clubId)->whereNotNull('active_card_id')->pluck('active_card_id')->all();
                $wages = $this->market->weeklyWages($club, $catalog);
                $spendable = max(0, $this->market->balance($clubId) - config('world_players.bot_wage_reserve_weeks') * $wages);
                $this->considerSale($club, $owned, $definitions, $avatars, $listed, $spendable === 0, $summary, $policy['target_roster']);
                $listed = ClubAuction::where('seller_id', $clubId)->whereNotNull('active_card_id')->pluck('active_card_id')->all();
                $this->considerBid($club, $owned, $definitions, $avatars, $listed, $spendable, $catalog->id, $summary, $templates, $policy);
                if (Schema::hasTable('bot_club_plans')) {
                    DB::table('bot_club_plans')->updateOrInsert(['club_id' => $clubId], [
                        'plan' => json_encode(['strategy' => $policy, 'target_roster' => $policy['target_roster'], 'reserve_weeks' => config('world_players.bot_wage_reserve_weeks'), 'weekly_payroll' => $wages,
                            'available_after_actions' => $this->market->balance($clubId), 'academy_open' => $club->academy_opened_at !== null, 'decisions' => $summary]), 'reviewed_at' => now()]);
                }
            } else {
                $summary[] = 'Fixture order lock takes precedence.';
            }
            DB::table('club_world_turns')->insert(['club_id' => $clubId, 'window_at' => $slot, 'completed_at' => now(), 'summary' => json_encode($summary, JSON_THROW_ON_ERROR)]);

            return true;
        }, 3);
        // Registration takes the event lock after market/lineup locks have committed.
        if ($ran && ($club = OnlineClub::where('is_bot', true)->find($clubId))) {
            $summary = [];
            $this->considerTournament($club, $summary, $epoch ?? (int)$club->management_epoch);
            if ($summary) DB::transaction(function () use ($clubId, $slot, $summary) {
                $turn = DB::table('club_world_turns')->where('club_id', $clubId)->where('window_at', $slot)->lockForUpdate()->first();
                if ($turn) DB::table('club_world_turns')->where('id', $turn->id)->update(['summary' => json_encode([...json_decode($turn->summary, true), ...$summary])]);
            }, 3);
        }
    }

    private function considerAcademy(OnlineClub $club, array &$summary, int $coverWeeks): void
    {
        if (! app(WorldPlayerProfiles::class)->enabled()) {
            return;
        }
        $balance = $this->market->balance($club->id);
        $wages = $this->market->weeklyWages($club);
        if ($club->academy_opened_at && $balance < $wages * config('world_players.bot_wage_reserve_weeks')) {
            $this->attempt(fn () => $this->market->setAcademy($club, false), $summary, 'Closed the academy to protect payroll.');
            $club->refresh();
        } elseif (! $club->academy_opened_at && $balance > ClubMarketService::ACADEMY_OPENING_FEE + $wages * 6 + ClubMarketService::YOUTH_COACH_WAGE * $coverWeeks) {
            $this->attempt(fn () => $this->market->setAcademy($club, true), $summary, 'Funded an optional academy with '.$coverWeeks.' weeks of coach cover.');
            $club->refresh();
        }
    }

    private function fits(array $player, array $avatar): bool
    {
        $roles = array_filter([...($player['playableRoles'] ?? []), $player['preferredRole'] ?? null, $player['role'] ?? null]);

        return in_array($avatar['primaryRole'] ?? null, $roles, true) || in_array($avatar['secondaryRole'] ?? null, $roles, true);
    }

    private function considerSale(OnlineClub $club, Collection $owned, Collection $definitions, Collection $avatars, array $listed, bool $cashPressure, array &$summary, int $target): void
    {
        if ($listed || $owned->count() <= 5) {
            return;
        }
        $starters = array_column($club->starters ?? $club->lineup, 'instance_id');
        $requests=app(WorldAgents::class)->ready()?\App\Models\WorldAgent::where('kind','player')->where('club_id',$club->id)->get(['source_id','policy'])->filter(fn($a)=>!empty($a->policy['playing_time_concern']))->pluck('source_id')->all():[];
        $candidate = $owned->filter(fn ($card) => ! in_array($card->id, $starters, true))->sortBy(fn ($card) => ($definitions[$card->id]['ovr'] ?? 0)-(in_array($card->id,$requests,true)?100:0))
            ->first(function ($card) use ($club, $definitions, $avatars, $owned, $cashPressure, $target) {
                if ($owned->count() > $target || $cashPressure) {
                    return true;
                }
                foreach ($club->lineup as $slot) {
                    $avatar = isset($slot['avatar_id']) ? ($avatars[$slot['avatar_id']] ?? []) : ['primaryRole' => $definitions[$slot['instance_id']]['preferredRole'] ?? $definitions[$slot['instance_id']]['role'] ?? null];
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
        $failures=ClubAuction::where('card_id',$candidate->id)->where('status','closed')->whereNull('bidder_id')->where('updated_at','>=',now()->subDays(28))->latest('updated_at')->limit(4)->get();
        if(app(WorldAgents::class)->ready()&&$cashPressure&&($failures->count()>=2||$this->market->balance($club->id)<2*$this->market->weeklyWages($club))){
            $this->attempt(fn()=>$this->market->releaseReserve($club,$candidate->id,true,(int)$club->management_epoch),$summary,'Paid protected compensation to reduce an unsustainable reserve payroll.');return;
        }
        if($failures->isNotEmpty()){
            $backoff=[1,3,7,14][min(3,$failures->count()-1)];
            if($failures->first()->updated_at->gt(now()->subDays($backoff)))return;
        }
        $wage = max(0, (int) ($definitions[$candidate->id]['wage'] ?? 45));
        $opening = max(ClubMarketService::BID_INCREMENT, (int) ceil($wage * 800 * pow(.9,$failures->count()) / ClubMarketService::BID_INCREMENT) * ClubMarketService::BID_INCREMENT);
        $this->attempt(fn () => $this->market->list($club, $candidate->id, $opening), $summary, 'Listed a surplus reserve.');
    }

    private function considerBid(OnlineClub $club, Collection $owned, Collection $definitions, Collection $avatars, array $listed, int $spendable, string $catalogId, array &$summary, Collection $templates, array $policy): void
    {
        $leading = ClubAuction::where('status', 'open')->where('bidder_id', $club->id)->where('closes_at', '>', now())->count();
        if ($spendable < ClubMarketService::BID_INCREMENT || $leading >= 2 || $owned->count() + $leading >= 10) {
            return;
        }
        $byId = $owned->keyBy('id');
        $best = null;
        foreach (ClubAuction::where('status', 'open')->where('closes_at', '>', now())->where('seller_id', '<>', $club->id)
            ->where(fn ($query) => $query->whereNull('bidder_id')->orWhere('bidder_id', '<>', $club->id))
            ->with('card')->orderBy('closes_at')->limit(max(1,min(24,(int)config('living_world.auction_candidates',12))))->get() as $auction) {
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
                $avatar = isset($slot['avatar_id']) ? ($avatars[$slot['avatar_id']] ?? []) : ['primaryRole' => $definitions[$slot['instance_id']]['preferredRole'] ?? $definitions[$slot['instance_id']]['role'] ?? null];
                if (! $this->fits($player, $avatar)) {
                    continue;
                }
                $starter = $byId[$slot['instance_id']] ?? null;
                $improvement = ($player['ovr'] ?? 0) - ($definitions[$starter?->id]['ovr'] ?? 0);
                if ($improvement >= $policy['minimum_improvement']) {
                    $need = max($need, 200 + $improvement);
                }
                $depth = $owned->filter(fn ($card) => ! in_array($card->id, $listed, true) && $this->fits($definitions[$card->id] ?? [], $avatar))->count();
                if ($owned->count() + $leading < $policy['target_roster'] && $depth < 2) {
                    $need = max($need, 100 + (int) ($player['ovr'] ?? 0));
                }
            }
            if (! $need) {
                continue;
            }
            $minimum = $auction->bid === null ? $auction->opening_bid : $auction->bid + ClubMarketService::BID_INCREMENT;
            $comparable = ClubAuction::where('status', 'sold')->whereHas('card', fn ($query) => $query->where('definition_id', $candidate->definition_id))
                ->latest('updated_at')->limit(10)->pluck('bid')->median();
            $ceiling = min((int) floor($spendable * $policy['bid_fraction']), $comparable ? (int) floor($comparable * 1.25) : max(ClubMarketService::BID_INCREMENT, (int) ($player['wage'] ?? 45) * 1200));
            if ($minimum > $ceiling) {
                continue;
            }
            if ($best === null || $need > $best['need']) {
                $best = ['auction' => $auction, 'amount' => $minimum, 'need' => $need];
            }
        }
        if ($best) {
            if(app(WorldCareers::class)->ready() && !app(WorldCareerContracts::class)->consent($best['auction']->card,$club)){
                $player=$best['auction']->card;$terms=app(WorldCareerContracts::class);
                $this->attempt(fn()=>$terms->offerPlayer($club,$player,(int)ceil($terms->salary($player)*1.5),26,'rotation','auction-interest:'.$best['auction']->id,true,(int)$club->management_epoch),$summary,'Proposed private employment terms for a compatible market opportunity.');
                return;
            }
            $this->attempt(fn () => $this->market->bid($club, $best['auction']->id, $best['amount']), $summary, 'Bid on a compatible upgrade or missing reserve role.');
        }
    }

    private function preferMarket(OnlineClub $club,OnlineCatalog $catalog,array $policy):bool {
        if(OwnedPlayerCard::where('user_id',$club->user_id)->count()<5)return false;
        $templates=collect($catalog->payload['cards'])->keyBy('id');$cheapest=null;
        foreach(ClubAuction::where('status','open')->where('seller_id','<>',$club->id)->where('closes_at','>',now())->with('card')->orderBy('closes_at')->limit(12)->get() as $a){
            if(!$a->card||$a->card->catalog_id!==$catalog->id||!isset($templates[$a->card->definition_id]))continue;
            $price=$a->bid===null?$a->opening_bid:$a->bid+ClubMarketService::BID_INCREMENT;
            $cheapest=$cheapest===null?$price:min($cheapest,$price);
        }
        if($cheapest===null)return false;
        $market=.7*(1-$cheapest/ClubMarketService::SCOUT_COST)+.2*$policy['traits']['thrift']+.1*$policy['traits']['patience'];
        $scout=.3*$policy['traits']['development']+.15*(1-$policy['traits']['patience'])+($club->academy_opened_at?.1:0);
        return $market>$scout;
    }
    private function considerFreeAgent(OnlineClub $club,OnlineCatalog $catalog,array $policy,array &$summary):bool {
        if(!app(WorldAgents::class)->ready()||OwnedPlayerCard::where('user_id',$club->user_id)->count()>=$policy['target_roster'])return false;
        $templates=collect($catalog->payload['cards'])->keyBy('id');$choices=[];
        foreach(DB::table('world_free_agents')->where('status','available')->orderBy('available_at')->limit(8)->get() as $f){
            $p=OwnedPlayerCard::find($f->player_id);if(!$p||$p->catalog_id!==$catalog->id)continue;
            $salary=(int)ceil(app(WorldCareerContracts::class)->baseWage($p)*1.5);$weeks=8+(int)round(8*$policy['traits']['patience']);
            if($this->market->balance($club->id)<4*$this->market->weeklyWages($club)+$salary*($weeks+1))continue;
            $definition=app(WorldPlayerProfiles::class)->definition($p,$templates[$p->definition_id]);$score=(float)($definition['ovr']??0)/100+.2*$policy['traits']['development']-.1*$salary/max(1,$this->market->balance($club->id))*$policy['traits']['thrift'];
            $choices[]=['player'=>$p,'salary'=>$salary,'weeks'=>$weeks,'key'=>'free-interest:'.$p->id.':'.\Carbon\Carbon::parse($f->available_at)->timestamp,'score'=>$score];
        }
        if(!$choices)return false;usort($choices,fn($a,$b)=>$b['score']<=>$a['score']);$c=$choices[0];
        $this->attempt(fn()=>app(WorldCareerContracts::class)->offerPlayer($club,$c['player'],$c['salary'],$c['weeks'],'rotation',$c['key'],true,(int)$club->management_epoch),$summary,'Discussed a funded free-agent opportunity.');return true;
    }

    private function considerTournament(OnlineClub $club, array &$summary, int $epoch): void
    {
        $events = ClubTournament::where('participant_type', 'club')->where(fn ($q) => $q->where('tier', $club->tier)->orWhereNull('tier'))->where('status', 'registration')->where('registration_closes_at', '>', now())
            ->whereNotExists(fn($q)=>$q->selectRaw('1')->from('club_tournament_entries as entry')->whereColumn('entry.tournament_id','club_tournaments.id')->where('entry.club_id',$club->id))
            ->orderBy('semifinals_at')->limit(6)->get();
        // A stable preference breaks equal opportunities differently for each manager.
        $profile = app(WorldManagerPolicy::class)->profile($club->id);
        $events = $events->sortByDesc(fn ($event) => ($event->tier === $club->tier ? 2 : 0) + $profile['traits']['ambition'] * (float) ($event->regulations['ladder'] ?? false) + hexdec(substr(hash('sha256', $club->id.':'.$event->id), 0, 4)) / 65535);
        foreach ($events as $event) {
            $entries = DB::table('club_tournament_entries')->where('tournament_id', $event->id);
            if ((clone $entries)->where('club_id', $club->id)->exists() || $entries->count() >= $event->capacity) {
                continue;
            }
            $this->attempt(fn () => $this->tournaments->register($event->id, $club, $epoch), $summary, 'Entered an eligible scheduled competition.');
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
