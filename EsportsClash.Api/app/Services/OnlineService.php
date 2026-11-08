<?php

namespace App\Services;

use App\Jobs\PollOnlineMatch;
use App\Jobs\MatchQueuedBotOpponent;
use App\Models\{ClubFixture, NormalQueueTicket, OnlineCatalog, OnlineClub, OnlineMatch, OwnedPlayerCard, User};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OnlineService
{
    public function activeCatalog(): OnlineCatalog
    {
        return OnlineCatalog::where('active', true)->firstOrFail();
    }

    public function provision(User $user, bool $bot = false): OnlineClub
    {
        return DB::transaction(function () use ($user, $bot) {
            User::lockForUpdate()->findOrFail($user->id);
            if ($club = OnlineClub::where('user_id', $user->id)->first()) {
                if (! $club->starters) {
                    $club->update(['starters' => array_map(
                        fn (array $slot): array => ['instance_id' => $slot['instance_id']],
                        $club->lineup,
                    )]);
                    $club->refresh();
                }
                app(ClubStaffService::class)->ensure($club);

                return $club;
            }
            $catalog = $this->activeCatalog();
            // All admissions share the catalog lock with kickoff and ownership transfers.
            $catalog=OnlineCatalog::whereKey($catalog->id)->lockForUpdate()->firstOrFail();
            if(!$bot && ($adopted=app(BotPopulationService::class)->adopt($user)))return $adopted;
            $lineup = [];
            foreach ($catalog->payload['starter'] as $slot) {
                $source = $bot ? 'bot-scout' : 'starter';
                $card = OwnedPlayerCard::firstOrCreate(['grant_key' => $source.':'.$user->id.':'.$slot['card_id']],
                    ['id' => (string) Str::uuid(), 'user_id' => $user->id, 'catalog_id' => $catalog->id, 'definition_id' => $slot['card_id']]);
                app(WorldPlayerIdentity::class)->assign($card,$catalog,!$bot);
                $lineup[] = ['instance_id' => $card->id, 'avatar_id' => $slot['avatar_id']];
            }
            $club = OnlineClub::create(['user_id' => $user->id, 'name' => Str::limit($bot ? $user->name : $user->name."'s Club", 80, ''),
                'lineup' => $lineup, 'starters' => array_map(fn (array $slot): array => ['instance_id' => $slot['instance_id']], $lineup),
                'is_bot' => $bot,'tier'=>5]);
            app(ClubStaffService::class)->ensure($club);

            return $club;
        });
    }

    public function validatedStarters(int $userId, array $starters, OnlineCatalog $catalog): array
    {
        if (count($starters) !== 5 || count(array_unique(array_column($starters, 'instance_id'))) !== 5) {
            $this->invalid('Choose five distinct starting players.');
        }
        $definitions = collect($catalog->payload['cards'])->keyBy('id');
        $output = [];
        foreach ($starters as $slot) {
            $owned = OwnedPlayerCard::where('id', $slot['instance_id'])->where('user_id', $userId)
                ->where('catalog_id', $catalog->id)->first();
            if (! $owned || ! $definitions->has($owned->definition_id)) {
                $this->invalid('A selected player is unavailable.');
            }
            $output[] = ['instance_id' => $owned->id, 'card_id' => $owned->definition_id];
        }

        return $output;
    }

    public function validatedLineup(int $userId, array $lineup, OnlineCatalog $catalog): array
    {
        if (count($lineup) !== 5 || count(array_unique(array_column($lineup, 'instance_id'))) !== 5
            || count(array_unique(array_column($lineup, 'avatar_id'))) !== 5) $this->invalid('Choose five distinct owned cards and avatars.');
        $definitions = collect($catalog->payload['cards'])->keyBy('id');
        $avatars = collect($catalog->payload['avatars'])->keyBy('id');
        $output = [];
        foreach ($lineup as $slot) {
            $owned = OwnedPlayerCard::where('id', $slot['instance_id'])->where('user_id', $userId)->where('catalog_id', $catalog->id)->first();
            if (! $owned || ! $definitions->has($owned->definition_id) || ! $avatars->has($slot['avatar_id'])) $this->invalid('The selected card or avatar is unavailable.');
            $card = $definitions[$owned->definition_id];
            $avatar = $avatars[$slot['avatar_id']];
            $roles = array_unique(array_filter([...($card['playableRoles'] ?? []), $card['preferredRole'] ?? null, $card['role'] ?? null]));
            if (! in_array($avatar['primaryRole'], $roles, true) && ! in_array($avatar['secondaryRole'] ?? '', $roles, true)) $this->invalid('This card cannot play that avatar role.');
            $output[] = ['instance_id' => $owned->id, 'card_id' => $owned->definition_id, 'avatar_id' => $avatar['id']];
        }
        return $output;
    }

    private function invalid(string $message): never
    {
        throw ValidationException::withMessages(['lineup' => $message]);
    }

    public function updateClub(User $user, array $data): OnlineClub
    {
        $this->provision($user);
        return DB::transaction(function () use ($user, $data) {
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $club = OnlineClub::where('user_id', $user->id)->lockForUpdate()->firstOrFail();
            if (ClubFixture::awaitingSnapshot($club->id)) $this->invalid('A fixture is locking its lineup. Try again shortly.');
            $ticket = NormalQueueTicket::where('user_id', $user->id)->first();
            if ($ticket && $ticket->status === 'queued') $this->invalid('Leave the queue before changing the lineup.');
            if (\App\Models\ScrimmageQueueTicket::where('user_id', $user->id)->where('status', 'queued')->exists()) {
                $this->invalid('Leave the scrimmage queue before changing the lineup.');
            }
            $lineupUpdate = [];
            if (isset($data['lineup'])) {
                if (isset($data['lineup'][0]['avatar_id'])) {
                    $legacy = $this->validatedLineup($user->id, $data['lineup'], $catalog);
                    $lineupUpdate['lineup'] = array_map(fn (array $slot): array => [
                        'instance_id' => $slot['instance_id'], 'avatar_id' => $slot['avatar_id'],
                    ], $legacy);
                    $starters = array_map(fn (array $slot): array => ['instance_id' => $slot['instance_id']], $legacy);
                } else {
                    $starters = $this->validatedStarters($user->id, $data['lineup'], $catalog);
                }
                $reserved = \App\Models\ClubTradeProposal::where('proposer_id', $club->id)->where('status', 'pending')
                    ->where('expires_at', '>', now())->get()->flatMap(fn ($proposal) => $proposal->offered_player_ids);
                if ($reserved->intersect(array_column($starters, 'instance_id'))->isNotEmpty()) {
                    $this->invalid('A player committed to a pending trade cannot be moved into the starting lineup.');
                }
                $lineupUpdate['starters'] = array_map(fn (array $slot): array => ['instance_id' => $slot['instance_id']], $starters);
            }
            if ($club->revision !== $data['revision']) $this->invalid('The club changed. Refresh before saving.');
            unset($data['lineup']);
            $club->update([...$data, ...$lineupUpdate, 'revision' => $club->revision + 1]);
            return $club;
        });
    }

    public function queue(User $user): array
    {
        $this->provision($user);
        return DB::transaction(function () use ($user) {
            // Single catalog row serializes allocation and lineup/queue mutations.
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $scrimmage = \App\Models\ScrimmageQueueTicket::where('user_id', $user->id)->first();
            $scrimmageActive = $scrimmage?->status === 'queued' || ($scrimmage?->status === 'matched' && $scrimmage->fixture_id
                && ClubFixture::whereKey($scrimmage->fixture_id)->where(fn ($query) => $query->where('kickoff_at', '>', now())
                    ->orWhereHas('match', fn ($match) => $match->whereIn('status', ['allocated', 'running'])))->exists());
            if ($scrimmageActive) {
                $this->invalid('Leave the scrimmage queue or finish its active fixture before joining normal matchmaking.');
            }
            $ticket = NormalQueueTicket::where('user_id', $user->id)->lockForUpdate()->first();
            if ($ticket?->match_id) {
                $match = OnlineMatch::findOrFail($ticket->match_id);
                if (in_array($match->status, ['allocated', 'running'], true)) return ['ticket' => $ticket, 'match' => $match];
            }
            if ($ticket?->status === 'queued') {
                MatchQueuedBotOpponent::dispatch($user->id)->delay(now()->addSeconds(15))->afterCommit();

                return ['ticket' => $ticket, 'match' => null];
            }
            $club = OnlineClub::where('user_id', $user->id)->firstOrFail();
            $lineup = $this->validatedStarters($user->id, $club->starters ?? $club->lineup, $catalog);
            $ticket = NormalQueueTicket::updateOrCreate(['user_id' => $user->id], ['status' => 'queued',
                'catalog_id' => $catalog->id, 'lineup' => $lineup, 'club_name' => $club->name, 'match_id' => null]);
            $opponent = NormalQueueTicket::where('status', 'queued')->where('catalog_id', $catalog->id)
                ->where('user_id', '<>', $user->id)->orderBy('id')->lockForUpdate()->first();
            if (! $opponent) {
                MatchQueuedBotOpponent::dispatch($user->id)->delay(now()->addSeconds(15))->afterCommit();

                return ['ticket' => $ticket, 'match' => null];
            }
            $match = $this->allocate($catalog, $opponent->user_id, $ticket->user_id,
                $opponent->lineup, $ticket->lineup, ['blue' => $opponent->club_name, 'red' => $ticket->club_name]);
            $opponent->update(['status' => 'matched', 'match_id' => $match->id]);
            $ticket->update(['status' => 'matched', 'match_id' => $match->id]);
            PollOnlineMatch::dispatch($match->id)->afterCommit();
            return ['ticket' => $ticket->fresh(), 'match' => $match];
        });
    }

    public function matchQueuedBotOpponent(int $userId): bool
    {
        return DB::transaction(function () use ($userId): bool {
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $ticket = NormalQueueTicket::where('user_id', $userId)->lockForUpdate()->first();
            if (! $ticket || $ticket->status !== 'queued') {
                return true;
            }
            if ($ticket->catalog_id !== $catalog->id) {
                return false;
            }

            $humanUsers = OnlineClub::where('is_bot', false)->select('user_id');
            $opponent = NormalQueueTicket::where('status', 'queued')->where('catalog_id', $catalog->id)
                ->where('user_id', '<>', $userId)->whereIn('user_id', $humanUsers)
                ->orderBy('id')->lockForUpdate()->first();
            if ($opponent) {
                $match = $this->allocate($catalog, $opponent->user_id, $ticket->user_id,
                    $opponent->lineup, $ticket->lineup,
                    ['blue' => $opponent->club_name, 'red' => $ticket->club_name]);
                $opponent->update(['status' => 'matched', 'match_id' => $match->id]);
                $ticket->update(['status' => 'matched', 'match_id' => $match->id]);
                PollOnlineMatch::dispatch($match->id)->afterCommit();

                return true;
            }

            $bot = $this->availableBotOpponent($catalog, $userId);
            if (! $bot) {
                return false;
            }
            $botLineup = $this->validatedStarters($bot->user_id, $bot->starters ?? $bot->lineup, $catalog);
            $botTicket = NormalQueueTicket::where('user_id', $bot->user_id)->lockForUpdate()->first();
            $botTicket ??= new NormalQueueTicket(['user_id' => $bot->user_id]);
            $humanIsBlue = random_int(0, 1) === 0;
            $blueUser = $humanIsBlue ? $userId : $bot->user_id;
            $redUser = $humanIsBlue ? $bot->user_id : $userId;
            $blue = $humanIsBlue ? $ticket->lineup : $botLineup;
            $red = $humanIsBlue ? $botLineup : $ticket->lineup;
            $blueName = $humanIsBlue ? $ticket->club_name : $bot->name;
            $redName = $humanIsBlue ? $bot->name : $ticket->club_name;
            $match = $this->allocate($catalog, $blueUser, $redUser, $blue, $red,
                ['blue' => $blueName, 'red' => $redName]);
            $ticket->update(['status' => 'matched', 'match_id' => $match->id]);
            $botTicket->fill([
                'status' => 'matched',
                'catalog_id' => $catalog->id,
                'lineup' => $botLineup,
                'club_name' => $bot->name,
                'match_id' => $match->id,
            ])->save();
            PollOnlineMatch::dispatch($match->id)->afterCommit();

            return true;
        }, 3);
    }

    public function allocate(OnlineCatalog $catalog, ?int $blueUser, ?int $redUser, array $blue, array $red, array $clubs, ?array $fixture = null): OnlineMatch
    {
            $id = (string) Str::uuid();
            $seed = random_int(1, 2147483647);
            $coachCards = null;
            if ($blueUser !== null && $redUser !== null) {
                $blueClub = OnlineClub::where('user_id', $blueUser)->firstOrFail();
                $redClub = OnlineClub::where('user_id', $redUser)->firstOrFail();
                $draft = app(CoachDraftService::class)->draft(
                    $blueClub, $redClub, $blue, $red, $catalog->payload, $seed,
                );
                $blue = $draft['blue'];
                $red = $draft['red'];
                $coachCards = $draft['coaches'];
            }
            $plan = ['schema' => 1, 'match_id' => $id, 'mode' => 'normal', 'seed' => $seed,
                'versions' => array_intersect_key($catalog->manifest, array_flip(['catalog_version', 'rules_version', 'policy_version', 'observation_version'])),
                'blue' => $blue, 'red' => $red,
                'clubs' => $clubs,
                'content_catalog' => app(GameContentService::class)->snapshot(),
                'visual_releases' => \App\Models\AvatarVisualRelease::where('active',true)
                    ->get(['id','avatar_id','variant','version','sha256'])->toArray(),
                'coach_id' => $catalog->payload['coaches'][0]['id']];
            if ($blueUser !== null && $redUser !== null) {
                $botUsers = OnlineClub::whereIn('user_id', [$blueUser, $redUser])
                    ->where('is_bot', true)->pluck('user_id')->all();
                $plan['bot_sides'] = array_values(array_filter(['blue', 'red'], fn (string $side) =>
                    in_array($side === 'blue' ? $blueUser : $redUser, $botUsers, true)));
            }
            if ($coachCards !== null) {
                $plan['staff'] = $draft['staff'];
                $plan['coaches'] = $coachCards;
                $plan['staff_meta'] = $draft['meta'];
                $plan['coach_id'] = null;
            }
            $plan['player_identities']=OwnedPlayerCard::whereIn('id',array_column([...$blue,...$red],'instance_id'))->pluck('persona_name','id')->filter()->all();
            if(app(WorldPlayerProfiles::class)->enabled()){
                // New world clubs have no signed senior coach; retain only the engine's neutral baseline.
                $plan['coach_id']=null;
                $definitions=collect($catalog->payload['cards'])->keyBy('id');$plan['player_profile_schema']=WorldPlayerProfiles::VERSION;
                $plan['player_profiles']=OwnedPlayerCard::whereIn('id',array_column([...$blue,...$red],'instance_id'))->get()->mapWithKeys(fn($player)=>[$player->id=>app(WorldPlayerProfiles::class)->snapshot($player,$definitions[$player->definition_id])])->all();
            }
            if(($catalog->manifest['policy_version']??'')==='arena-command-v1'){
                $release=app(IntelligenceService::class)->manifest();
                $plan['intelligence']=['controller'=>'arena','release'=>($release['engine']==='arena-command-v1'
                    &&$release['source_hash']===($catalog->manifest['arena_source_hash']??null))?$release:null];
            }
            if(in_array($catalog->manifest['policy_version']??'',['baseline-hybrid-v1','original-v3-hybrid-v2'],true)){
                $release=app(IntelligenceService::class)->manifest();
                $plan['intelligence']=['controller'=>'hybrid','release'=>($release['engine']==='safe-macro-v1'
                    &&($release['qualification']??null)==='qualified'
                    &&$release['source_hash']===($catalog->manifest['arena_source_hash']??null))?$release:null];
            }
            if ($fixture !== null) $plan['fixture'] = $fixture;
            return OnlineMatch::create(['id' => $id, 'blue_user_id' => $blueUser, 'red_user_id' => $redUser,
                'plan' => $plan, 'plan_hash' => hash('sha256', json_encode($plan, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))]);
    }

    private function availableBotOpponent(OnlineCatalog $catalog, int $humanUserId): ?OnlineClub
    {
        $bots = OnlineClub::where('is_bot', true)->where('user_id', '<>', $humanUserId)
            ->whereNotIn('user_id', DB::table('normal_queue_tickets')->where('status', 'queued')->select('user_id'))
            ->orderBy('id')->lockForUpdate()->get();

        foreach ($bots as $bot) {
            $activeMatch = OnlineMatch::whereIn('status', ['allocated', 'running'])
                ->where(fn ($query) => $query->where('blue_user_id', $bot->user_id)->orWhere('red_user_id', $bot->user_id))
                ->exists();
            $upcomingFixture = ClubFixture::where('kickoff_at', '>', now())
                ->where(fn ($query) => $query->where('home_club_id', $bot->id)->orWhere('away_club_id', $bot->id))
                ->exists();
            if ($activeMatch || $upcomingFixture || ClubFixture::awaitingSnapshot($bot->id)) {
                continue;
            }

            try {
                $this->validatedStarters($bot->user_id, $bot->starters ?? $bot->lineup, $catalog);
            } catch (ValidationException) {
                continue;
            }

            return $bot;
        }

        return null;
    }

    public function leave(User $user): void
    {
        DB::transaction(function () use ($user) {
            OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            NormalQueueTicket::where('user_id', $user->id)->where('status', 'queued')->update(['status' => 'cancelled', 'updated_at' => now()]);
        });
    }

    public function participant(User $user, string $id): OnlineMatch
    {
        $match = OnlineMatch::findOrFail($id);
        abort_unless($match->belongsToParticipant($user->id) || $match->canSpectate(), 403);
        abort_if($match->isBeforeKickoff(), 404);
        return $match;
    }

    public function settle(string $id, array $result, int $sequence): OnlineMatch
    {
        return DB::transaction(function () use ($id, $result, $sequence) {
            $match = OnlineMatch::lockForUpdate()->findOrFail($id);
            $hash = hash('sha256', json_encode($result, JSON_THROW_ON_ERROR));
            if ($match->status === 'completed') {
                if (! hash_equals($match->result_hash, $hash)) $this->invalid('A completed result is immutable.');
                return $match;
            }
            if (! in_array($match->status, ['allocated', 'running'], true)) $this->invalid('This match cannot be settled.');
            if (($result['match_id'] ?? '') !== $match->id || ($result['seed'] ?? null) !== $match->plan['seed']
                || ($result['versions'] ?? null) !== $match->plan['versions'] || ! in_array($result['winner'] ?? '', ['blue', 'red'], true)
                || ! isset($result['report']['durationSeconds']) || $result['report']['durationSeconds'] <= 0
                || ($result['report']['winner'] ?? '') !== $result['winner']
                || ($result['report']['seed'] ?? null) !== $match->plan['seed']) $this->invalid('Worker result does not match its allocation.');
            $nexus = $result['terminal_nexus'] ?? [];
            // Preserve the live engine's existing red-Nexus-first terminal ordering,
            // including the rare case where both structures fall in the same tick.
            $expected = ($nexus['red'] ?? null) === false ? 'blue' : ((($nexus['blue'] ?? null) === false) ? 'red' : null);
            if (! is_bool($nexus['blue'] ?? null) || ! is_bool($nexus['red'] ?? null) || $expected !== $result['winner']) $this->invalid('A real Nexus finish is required.');
            foreach (['blue', 'red'] as $side) {
                $draft = $result['report']['draft'][$side] ?? [];
                if (array_column(array_column($draft, 'player'), 'id') !== array_column($match->plan[$side], 'card_id')
                    || array_column(array_column($draft, 'champion'), 'id') !== array_column($match->plan[$side], 'avatar_id')) $this->invalid('Result draft differs from the allocated owned lineup.');
            }
            $performances = $this->validatedPerformances($result, $match);
            $match->update(['status' => 'completed', 'sequence' => $sequence, 'result' => $result, 'result_hash' => $hash, 'completed_at' => now()]);
            $fixture = null;
            $progression = $match->plan['fixture']['progression'] ?? ['training'=>true,'player_ratings'=>true];
            if (isset($match->plan['fixture'])) {
                $fixture = ClubFixture::where('match_id', $match->id)->first();
                $trainingSessions = [];
                foreach (['blue', 'red'] as $side) {
                    $bonus = app(ClubStaffService::class)->trainingBonusFromSnapshot($match->plan['staff'][$side] ?? null);
                    $baseXp = (int) ceil($result['report']['durationSeconds'] / 60);
                    $xp = $baseXp + (int) round($baseXp * $bonus / 100);
                    foreach ($match->plan[$side] as $slot) {
                        $trainingSessions[] = ['match_id' => $match->id, 'card_id' => $slot['instance_id'], 'xp' => $xp];
                    }
                }
                if ($progression['training'] ?? true) DB::table('club_training_sessions')->insert($trainingSessions);
                if (($fixture = ClubFixture::where('match_id', $match->id)->first()) && $fixture->home_club_id) {
                    $winner = OnlineClub::findOrFail($result['winner'] === 'blue' ? $fixture->home_club_id : $fixture->away_club_id);
                    app(WorldActivityService::class)->record('match:'.$match->id.':completed', 'result', $winner,
                        ($match->plan['clubs'][$result['winner']] ?? $winner->name).' won a scheduled Arena match.',
                        ['match_id' => $match->canSpectate() ? $match->id : null, 'team_id' => $winner->id, 'tournament_id' => $fixture->tournament_id]);
                }
                if ($fixture?->stage_id) \App\Jobs\ProcessCompetitionEdition::dispatch($fixture->tournament_id)->afterCommit();
            }
            if ($performances && ($progression['player_ratings'] ?? true)) {
                $rows = [];
                foreach (['blue', 'red'] as $side) {
                    $clubId = $fixture
                        ? ($side === 'blue' ? $fixture->home_club_id : $fixture->away_club_id)
                        : OnlineClub::where('user_id', $side === 'blue' ? $match->blue_user_id : $match->red_user_id)->value('id');
                    foreach ($match->plan[$side] as $slot) {
                        $performance = $performances[$slot['instance_id']];
                        $rows[] = [
                            'match_id' => $match->id,
                            'card_id' => $slot['instance_id'],
                            'club_id' => $clubId,
                            'club_name' => $match->plan['clubs'][$side],
                            'competition' => $fixture?->competition ?? 'Open match',
                            'won' => $result['winner'] === $side,
                            'rating' => $performance['rating'],
                            'performance' => json_encode($performance['stats'], JSON_THROW_ON_ERROR),
                            'created_at' => $match->completed_at,
                        ];
                    }
                }
                DB::table('club_player_match_ratings')->insert($rows);
            }
            \App\Jobs\PublishWorldCoverage::dispatch($match->id)->afterCommit();
            return $match;
        });
    }

    private function validatedPerformances(array $result, OnlineMatch $match): array
    {
        if (! array_key_exists('player_performance', $result)) {
            return [];
        }
        $rows = $result['player_performance'];
        if (! is_array($rows) || count($rows) !== 10) $this->invalid('Worker performance record must contain ten players.');

        $expected = [];
        foreach (['blue', 'red'] as $side) {
            foreach ($match->plan[$side] as $slot) {
                $expected[$slot['instance_id']] = $side;
            }
        }
        $performance = [];
        foreach ($rows as $row) {
            if (! is_array($row) || ! isset($row['instance_id'], $row['team'])
                || ! isset($expected[$row['instance_id']]) || $expected[$row['instance_id']] !== $row['team']
                || isset($performance[$row['instance_id']])) {
                $this->invalid('Worker performance record does not match the allocated players.');
            }
            $stats = [];
            foreach (['kills' => 999, 'deaths' => 999, 'assists' => 999, 'cs' => 10000, 'gold' => 1000000, 'damage' => 10000000] as $field => $maximum) {
                $value = $row[$field] ?? null;
                if (! is_numeric($value) || ! is_finite((float) $value) || $value < 0 || $value > $maximum) {
                    $this->invalid('Worker performance record contains an invalid statistic.');
                }
                $stats[$field] = (float) $value;
            }
            $participation = $stats['kills'] + $stats['assists'] / 2;
            $rating = 5 + ($result['winner'] === $row['team'] ? 1.5 : 0)
                + min(1.2, $participation * 0.18)
                - min(2, $stats['deaths'] * 0.35)
                + min(0.7, $stats['cs'] / 250)
                + min(0.8, $stats['damage'] / 20000)
                + min(0.3, $stats['gold'] / 20000);
            $performance[$row['instance_id']] = [
                'rating' => round(max(1, min(10, $rating)), 2),
                'stats' => $stats,
            ];
        }
        if (count($performance) !== 10) $this->invalid('Worker performance record is incomplete.');

        return $performance;
    }
}
