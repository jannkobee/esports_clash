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
        DB::table('club_training_sessions')->whereNull('processed_at')
            ->whereIn('match_id', DB::table('online_matches')->select('id')->where('completed_at', '<', $startOfWeek))
            ->chunkById(100, function ($sessions) {
                foreach ($sessions as $session) {
                    DB::transaction(function () use ($session) {
                        $updated = DB::table('club_training_sessions')->where('id', $session->id)->whereNull('processed_at')
                            ->update(['processed_at' => now()]);
                        if ($updated) {
                            OwnedPlayerCard::withoutGlobalScopes()->whereKey($session->card_id)->increment('training_xp', $session->xp);
                            app(FpsIdentityEngine::class)->train($session->card_id,$session->match_id,(int)$session->xp);
                        }
                    }, 3);
                }
            });
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
        $candidates = $owned->reject(fn ($card) => in_array($card->id, $listed, true))->sortByDesc(fn ($card) => $definitions[$card->id]['ovr'] ?? 0);
        foreach ($lineup as $index => $slot) {
            $starter = $owned[$slot['instance_id']] ?? null;
            $rating = $definitions[$starter?->id]['ovr'] ?? 0;
            foreach ($candidates as $candidate) {
                if (($definitions[$candidate->id]['ovr'] ?? 0) <= $rating) {
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
