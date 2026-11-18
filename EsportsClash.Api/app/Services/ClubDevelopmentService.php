<?php

namespace App\Services;

use App\Models\ClubAuction;
use App\Models\OnlineClub;
use App\Models\OwnedPlayerCard;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class ClubDevelopmentService
{
    public function postTraining(): void
    {
        $startOfWeek = now('Asia/Manila')->startOfWeek()->utc();
        $levels = [];
        DB::table('club_training_sessions')->whereNull('processed_at')
            ->whereIn('match_id', DB::table('online_matches')->select('id')->where('completed_at', '<', $startOfWeek))
            ->chunkById(100, function ($sessions) use (&$levels) {
                $focus = [];
                foreach ($sessions as $session) {
                    DB::transaction(function () use ($session, &$levels, &$focus) {
                        $updated = DB::table('club_training_sessions')->where('id', $session->id)->whereNull('processed_at')
                            ->update(['processed_at' => now()]);
                        if (! $updated) return;
                        $profiles = app(WorldPlayerProfiles::class);
                        $card = OwnedPlayerCard::withoutGlobalScopes()->lockForUpdate()->find($session->card_id);
                        if (! $card) return;
                        $profiles->ensureAllocation($card);
                        $card->increment('training_xp', $session->xp);
                        app(FpsIdentityEngine::class)->train($session->card_id,$session->match_id,(int)$session->xp);
                        $changes = $profiles->allocateSteps($card->refresh(), $this->focus($session, $card, $focus));
                        if ($changes) $levels[$card->user_id][$card->id] = array_replace($levels[$card->user_id][$card->id] ?? [], $changes);
                    }, 3);
                }
            });
        $this->announceLevels($levels, now('Asia/Manila')->format('o-W'));
    }

    /**
     * The development focus that applies to a training session: the one pinned in the match plan (what the
     * manager had chosen when the match was allocated), else the club's current choice (reserve practice).
     */
    private function focus(object $session, OwnedPlayerCard $card, array &$cache): ?string
    {
        $pinned = $cache[$session->match_id] ??= (function () use ($session) {
            $plan = DB::table('online_matches')->where('id', $session->match_id)->value('plan');
            $players = json_decode($plan ?? 'null', true)['fps_identity']['players'] ?? [];
            return array_map(fn ($p) => $p['trainingFocus'] ?? null, $players);
        })();
        if (array_key_exists($card->id, $pinned)) return $pinned[$card->id];
        $club = OnlineClub::where('user_id', $card->user_id)->value('id');
        $instructions = json_decode(DB::table('fps_team_systems')->where('club_id', $club)->value('instructions') ?? '{}', true) ?: [];
        return $instructions[$card->id]['training'] ?? null;
    }

    /** Inbox note of whole-level changes only (never progress toward the next level). */
    private function announceLevels(array $levels, string $week): void
    {
        $labels = ['rifling' => 'Rifling', 'sniping' => 'Sniping', 'entry' => 'Entry', 'utility' => 'Utility', 'positioning' => 'Positioning', 'shotcalling' => 'Shotcalling'];
        foreach ($levels as $userId => $players) {
            $club = OnlineClub::where('user_id', $userId)->first();
            if (! $club || $club->is_bot) continue;
            $lines = [];
            foreach ($players as $playerId => $changes) {
                $name = OwnedPlayerCard::withoutGlobalScopes()->whereKey($playerId)->value('persona_name') ?? 'A player';
                $parts = [];
                foreach ($changes as $key => $change) $parts[] = ($labels[$key] ?? $key).' '.($change['to'] > $change['from'] ? 'rose' : 'fell').' to '.$change['to'].' · '.FpsPlayerArchitecture::SKILL_SCALE_LABELS[$change['to'] - 1];
                $lines[] = $name.': '.implode(', ', $parts).'.';
            }
            if ($lines) app(ClubOffice::class)->notify($club->id, 'training-levels:'.$week, 'training', count($lines) === 1 ? 'A player reached a new level' : count($lines).' players reached new levels',
                implode(' ', $lines), ['type' => 'route', 'route' => 'squad?tab=training']);
        }
    }

    public function manageBot(OnlineClub $club, ClubMarketService $market, OnlineService $online, ?int $targetRoster = null,bool $allowScouting=true): void
    {
        if (! $club->is_bot) {
            return;
        }
        $targetRoster ??= app(WorldManagerPolicy::class)->assess($club, OwnedPlayerCard::where('user_id', $club->user_id)->count(), $market->balance($club->id), $market->weeklyWages($club))['target_roster'];
        if ($allowScouting && OwnedPlayerCard::where('user_id', $club->user_id)->count() < $targetRoster
            && $market->balance($club->id) >= $market->weeklyWages($club) * config('world_players.bot_wage_reserve_weeks') + ClubMarketService::SCOUT_COST) {
            try {
                $market->scout($club, $club->academy_opened_at?->lte(now()->subWeek()) ?? false);
            } catch (HttpExceptionInterface $exception) {
                if (! in_array($exception->getStatusCode(), [409, 422], true)) {
                    throw $exception;
                }
            }
        }
        $catalog = $online->activeCatalog();
        $templates = collect($catalog->payload['cards'])->keyBy('id');
        $owned = OwnedPlayerCard::where('user_id', $club->user_id)->where('catalog_id', $catalog->id)->get()->keyBy('id');
        $definitions = $owned->mapWithKeys(fn ($p) => [$p->id => app(WorldPlayerProfiles::class)->definition($p, $templates[$p->definition_id])]);
        $lineup = $club->starters ?? array_map(
            fn (array $slot): array => ['instance_id' => $slot['instance_id']],
            $club->lineup,
        );
        $listed = ClubAuction::where('seller_id', $club->id)->whereNotNull('active_card_id')->pluck('active_card_id')->all();
        $tacticalPlan=json_decode(DB::table('fps_team_systems')->where('club_id',$club->id)->value('gameplan')??'{}',true);
        $lineupScore=fn($id)=>($definitions[$id]['ovr']??0)+12*(app(FpsPlayerArchitecture::class)->recruitmentFit($definitions[$id]??[],$tacticalPlan)-.5);
        $candidates = $owned->reject(fn ($card) => in_array($card->id, $listed, true))->sortByDesc(fn ($card) => $lineupScore($card->id));
        foreach ($lineup as $index => $slot) {
            $starter = $owned[$slot['instance_id']] ?? null;
            $rating = $lineupScore($starter?->id);
            foreach ($candidates as $candidate) {
                if ($lineupScore($candidate->id) <= $rating) {
                    break;
                }
                if (in_array($candidate->id, array_column($lineup, 'instance_id'), true)) {
                    continue;
                }
                $proposal = $lineup;
                $proposal[$index]['instance_id'] = $candidate->id;
                try {
                    $online->validatedStarters($club->user_id, $proposal, $catalog);
                    $lineup = $proposal;
                    break;
                } catch (ValidationException) {
                    // Try another candidate for this avatar.
                }
            }
        }
        if ($lineup !== $club->starters) {
            try {
                $online->updateClub($club->user, ['revision' => $club->revision, 'lineup' => $lineup]);
                app(WorldActivityService::class)->record('lineup:'.$club->id.':'.($club->revision + 1), 'club', $club, $club->name.' updated its default lineup.', ['team_id' => $club->id]);
            } catch (ValidationException) {
                // A fixture lock or concurrent update takes precedence over the bot's selection.
            }
        }
    }
}
