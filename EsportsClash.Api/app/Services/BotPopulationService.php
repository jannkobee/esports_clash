<?php

namespace App\Services;

use App\Jobs\PopulateBotClubs;
use App\Models\ClubTournament;
use App\Models\CompetitionGeography;
use App\Models\OnlineClub;
use App\Models\OwnedPlayerCard;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class BotPopulationService
{
    public function populate(int $target): array
    {
        abort_if($target < 0 || $target > 10000, 422, 'Choose a bounded target of up to 10,000 bot clubs per batch.');
        $created = 0;
        for ($i = OnlineClub::where('is_bot', true)->count(); $i < $target; $i++) {
            DB::transaction(function () use (&$created) {
                $suffix = strtoupper(Str::random(7));
                $brand=app(WorldClubIdentity::class)->make('population:'.$suffix);
                $user = User::create(['name' => $brand['manager'], 'email' => strtolower($suffix).'@bots.invalid', 'password' => Str::random(64)]);
                $club = app(OnlineService::class)->provision($user, true);
                $countries = CompetitionGeography::where('kind', 'country')->where('eligible', true)->orderBy('id')->get();
                $origin = $countries->isNotEmpty() ? $countries[(($club->id - 1) % $countries->count())] : null;
                $club->update(['tag' => 'B'.$suffix, 'name' => $brand['name'], 'geography_id' => $origin?->id, 'identity' => $brand['identity']+['country'=>$origin?->code??'PH']]);
                $verifier = User::where('is_evolution_admin', true)->orderBy('id')->first();
                if (! app(WorldPlayerProfiles::class)->enabled() && $origin && $verifier) {
                    foreach (OwnedPlayerCard::where('user_id', $user->id)->whereNull('original_identity')->get() as $player) {
                        DB::table('player_national_eligibilities')->insertOrIgnore(['player_id' => $player->id, 'geography_id' => $origin->id, 'evidence' => 'Fictional player generation origin: '.$origin->code, 'verified_by' => $verifier->id, 'verified_at' => now()]);
                    }
                }
                DB::table('club_manager_history')->insert(['club_id' => $club->id, 'user_id' => $user->id, 'kind' => 'bot', 'starts_at' => now()]);
                $created++;
            }, 3);
        }

        return ['created' => $created, 'bot_clubs' => OnlineClub::where('is_bot', true)->count()];
    }

    public function adopt(User $user): ?OnlineClub
    {
        // Called inside provisioning with the catalog and new user locked.
        $q = OnlineClub::where('is_bot', true)->where('tier', 5)->whereNotNull('tag')->whereNotIn('id',
            DB::table('club_fixtures')->whereNotNull('home_club_id')->where(fn ($q) => $q->whereNotNull('match_id')->whereIn('match_id', DB::table('online_matches')->whereIn('status', ['allocated', 'running'])->select('id'))
                ->orWhere(fn ($q) => $q->whereNull('match_id')->where('orders_close_at', '<=', now())))->select('home_club_id'));
        $q->whereNotIn('id', DB::table('club_fixtures')->whereNotNull('away_club_id')->where('orders_close_at', '<=', now())->where(fn ($q) => $q->whereNull('match_id')->orWhereIn('match_id', DB::table('online_matches')->whereIn('status', ['allocated', 'running'])->select('id')))->select('away_club_id'));
        $club = null;
        $profiles = app(WorldPlayerProfiles::class);
        $catalog = app(OnlineService::class)->activeCatalog();
        $templates = collect($catalog->payload['cards'])->keyBy('id');
        foreach ($q->orderBy('id')->limit(20)->lockForUpdate()->get() as $candidate) {
            if ($profiles->enabled()) {
                $players = OwnedPlayerCard::where('user_id', $candidate->user_id)->get();
                if (count(array_intersect($players->pluck('id')->all(), array_column($candidate->starters ?? $candidate->lineup, 'instance_id'))) !== 5) {
                    continue;
                }
                $ratings = $players->map(fn ($p) => $profiles->definition($p, $templates[$p->definition_id])['ovr']);
                if ($ratings->max() > config('world_players.new_manager_max_overall')) {
                    continue;
                }
            }
            $club = $candidate;
            break;
        }
        if (! $club) {
            return null;
        }
        $previous = $club->user_id;
        OwnedPlayerCard::where('user_id', $previous)->update(['user_id' => $user->id]);
        $club->update(['user_id' => $user->id, 'is_bot' => false, 'revision' => $club->revision + 1]);
        DB::table('club_manager_history')->where('club_id', $club->id)->whereNull('ends_at')->update(['ends_at' => now()]);
        DB::table('club_manager_history')->insert(['club_id' => $club->id, 'user_id' => $user->id, 'kind' => 'human', 'starts_at' => now()]);
        app(WorldActivityService::class)->record('club:'.$club->id.':human-manager:'.$user->id, 'club', $club, $club->name.' appointed a human manager.', ['team_id' => $club->id]);
        PopulateBotClubs::dispatch(config('world_players.minimum_bot_population'))->afterCommit();

        return $club;
    }

    public function fill(int $editionId): int
    {
        return DB::transaction(function () use ($editionId) {
            $e = ClubTournament::whereKey($editionId)->lockForUpdate()->firstOrFail();
            if ($e->status !== 'registration' || $e->registration_closes_at->isPast() || $e->participant_type !== 'club') {
                return 0;
            }
            $field = DB::table('club_tournament_entries')->where('tournament_id', $e->id)->where('status', 'accepted');
            $missing = $e->capacity - (clone $field)->count();
            $count = 0;
            if (! $e->definition_id) {
                foreach (OnlineClub::where('is_bot', true)->where('tier', $e->tier)->whereNotIn('id', (clone $field)->select('club_id'))->orderBy('id')->limit(max(0, $missing))->get() as $bot) {
                    DB::table('club_tournament_entries')->insertOrIgnore(['tournament_id' => $e->id, 'club_id' => $bot->id, 'source' => json_encode(['method' => 'bot_fill']), 'seed' => (clone $field)->count() + 1]);
                    $count++;
                }

return $count;
            }
            // Bot fillers occupy explicitly open places only, never purchased/ranked qualification slots.
            foreach (OnlineClub::where('is_bot', true)->whereNotIn('id', (clone $field)->select('club_id'))->orderBy('id')->limit(min(256, max(0, $missing)))->get() as $bot) {
                try {
                    app(CompetitionQualification::class)->enter($e->id, 'club', $bot->id, ['method' => 'open', 'bot_fill' => true]);
                    $count++;
                } catch (HttpException) {
                    continue;
                }
            }

            return $count;
        }, 3);
    }
}
