<?php

namespace App\Services;

use App\Models\CompetitionGeography;
use App\Models\OnlineCatalog;
use App\Models\OwnedPlayerCard;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WorldPlayerProfiles
{
    private ?bool $enabled = null;

    /** Read-path batches (request-scoped service): identity rows, scouting, assignments and nationalities by key. */
    private array $primedIdentities = [];

    private array $primedScouting = [];

    private array $primedAssignments = [];

    private array $primedGeographies = [];

    public const VERSION = 1;

    public const ATTRIBUTES = ['rifling', 'entry', 'positioning', 'shotcalling', 'sniping', 'utility'];

    public function enabled(): bool
    {
        return $this->enabled ??= Schema::hasTable('world_player_settings') &&
            (config('world_players.enabled') || (int) DB::table('world_player_settings')->where('id', 1)->value('profile_version') === self::VERSION);
    }

    public function invalidate(): void
    {
        $this->enabled = null;
        $this->primedIdentities = $this->primedScouting = $this->primedAssignments = $this->primedGeographies = [];
    }

    /**
     * Batch-load what definition() reads for many players at once (directories, rosters, tournament
     * pages): one query per kind instead of four per player. Only read paths call this.
     */
    public function prime(iterable $players): void
    {
        $players = collect($players)->filter(fn ($p) => $p instanceof OwnedPlayerCard)->values();
        if ($players->isEmpty()) {
            return;
        }
        if (app(FpsIdentityEngine::class)->ready()) {
            $rows = DB::table('fps_player_identities')->whereIn('player_id', $players->pluck('id')->all())->get()->keyBy('player_id');
            $clubs = \App\Models\OnlineClub::whereIn('user_id', $players->pluck('user_id')->unique()->all())->orderBy('id')->get(['id', 'user_id'])->unique('user_id')->keyBy('user_id');
            $orders = $clubs->isEmpty() ? collect() : DB::table('fps_team_systems')->whereIn('club_id', $clubs->pluck('id')->all())->pluck('instructions', 'club_id');
            foreach ($players as $player) {
                $this->primedIdentities[$player->id] = $rows[$player->id] ?? null;
                $club = $clubs[$player->user_id] ?? null;
                $instructions = $club ? (json_decode($orders[$club->id] ?? '{}', true) ?: []) : [];
                $assigned = $club ? array_filter(array_intersect_key($instructions[$player->id] ?? [], array_flip(['t', 'ct']))) : [];
                $this->primedAssignments[$player->id] = $assigned ?: null;
            }
        }
        $ids = $players->pluck('nationality_id')->filter()->unique()->reject(fn ($id) => array_key_exists($id, $this->primedGeographies))->values();
        if ($ids->isNotEmpty()) {
            foreach (CompetitionGeography::whereIn('id', $ids->all())->get() as $geography) {
                $this->primedGeographies[$geography->id] = $geography;
            }
        }
    }

    public function countries()
    {
        if (! CompetitionGeography::where('kind', 'country')->exists()) {
            app(CompetitionCalendar::class)->installGeographies();
        }

        return CompetitionGeography::where('kind', 'country')->where('eligible', true)->orderBy('id')->get();
    }

    public function initialize(OwnedPlayerCard $player, OnlineCatalog $catalog, string $source = 'starter', ?int $nationality = null): void
    {
        if(app(FpsIdentityEngine::class)->ready()){
            $identityTemplate=collect($catalog->payload['cards'])->firstWhere('id',$player->definition_id);
            if($identityTemplate)app(FpsIdentityProfiles::class)->initialize($player,$identityTemplate,true);
        }
        if (! $this->enabled() || $player->world_profile) {
            return;
        }
        $countries = $this->countries();
        abort_if($countries->isEmpty(), 409, 'Configure eligible countries before admitting players.');
        $hex = hash('sha256', $player->id.':rookie-v1');
        $number = fn (int $offset, int $min, int $max) => $min + (hexdec(substr($hex, $offset, 2)) % ($max - $min + 1));
        $nationality ??= DB::table('player_national_eligibilities')->where('player_id', $player->id)->orderBy('id')->value('geography_id');
        $nationality ??= $countries[$number(0, 0, $countries->count() - 1)]->id;
        abort_unless($countries->contains('id', $nationality), 422, 'A generated player requires an eligible country.');
        $min = $source === 'academy' ? config('world_players.academy_min') : config('world_players.starter_min');
        $max = $source === 'academy' ? config('world_players.academy_max') : config('world_players.starter_max');
        $stats = [];
        foreach (self::ATTRIBUTES as $i => $key) {
            $stats[$key] = $number(2 + $i * 2, $min, $max);
        }
        $age = $number(18, 18, $source === 'academy' ? 19 : 22);
        $profile = ['schema' => self::VERSION, 'source' => $source, 'stats' => $stats, 'potential' => $number(20, config('world_players.potential_min'), config('world_players.potential_max')),
            'birth_date' => now('UTC')->startOfDay()->subYears($age)->subDays($number(22, 0, 300))->toDateString(),
            'training_baseline' => (int) $player->training_xp, 'wage' => self::wageFor($stats),
        ];
        $player->update(['world_profile' => $profile, 'nationality_id' => $nationality]);
        DB::table('player_national_eligibilities')->insertOrIgnore(['player_id' => $player->id, 'geography_id' => $nationality,
            'evidence' => 'Server-generated fictional birth nationality; world profile v1', 'verified_by' => null, 'verified_at' => now()]);
        app(WorldPersonBiography::class)->initialize($player);
        if(app(FpsIdentityEngine::class)->ready()) {
            $template=collect($catalog->payload['cards'])->firstWhere('id',$player->definition_id);
            if($template)app(FpsIdentityProfiles::class)->initialize($player,$this->definition($player,$template),true);
        }
    }

    public function definition(OwnedPlayerCard $player, array $template): array
    {
        $out = $template;
        unset($out['primaryPersonality'],$out['secondaryPersonality']);
        $out['name'] = $player->persona_name ?? $template['name'];
        $out['presentation'] = $player->presentation;
        if (app(FpsIdentityEngine::class)->ready()) {
            $primed=array_key_exists($player->id,$this->primedIdentities);
            $identity=$primed?$this->primedIdentities[$player->id]:DB::table('fps_player_identities')->where('player_id',$player->id)->first();
            if($identity){
                $scouting=$primed?($this->primedScouting[$player->id]??=app(FpsIdentityProfiles::class)->scouting($identity)):app(FpsIdentityProfiles::class)->scouting($identity);
                $assignments=array_key_exists($player->id,$this->primedAssignments)?$this->primedAssignments[$player->id]:app(FpsIdentityProfiles::class)->assignmentsFor($player);
                $out['fpsIdentity']=[...$scouting,'assignments'=>$assignments];$out['personality']=$out['fpsIdentity']['personality']['name'];
            }
        }
        $profile = $this->enabled() ? $player->world_profile : null;
        if (! $profile) {
            return $out;
        }
        $stats = $this->stats($player);
        $nationality = $player->nationality_id ? ($this->primedGeographies[$player->nationality_id] ?? CompetitionGeography::find($player->nationality_id)) : null;

        return array_replace($out, [
            'name' => $player->persona_name, 'tier' => 'Bronze', 'stats' => $stats, 'ovr' => (int) round(array_sum($stats) / count($stats)),
            'age' => (int) CarbonImmutable::parse($profile['birth_date'])->diffInYears(now('UTC')),
            'wage' => $profile['wage'], 'potentialOvr' => $profile['potential'], 'badges' => [], 'signatureChampions' => [],
            'avatarSvg' => 'world-'.$player->id, 'nationality' => $nationality?->only(['id', 'code', 'name']),
            'level' => 1, 'currentXp' => 0, 'maxXp' => 100, 'morale' => 70, 'fatigue' => 0, 'isEvo' => false, 'evolutionLevel' => 0, 'evolutionHistory' => [],
        ]);
    }

    public function snapshot(OwnedPlayerCard $player, array $template): array
    {
        abort_unless($player->world_profile && $player->nationality_id && ! $player->retired_at, 409, 'The active player is missing their world profile or nationality.');

        return array_intersect_key($this->definition($player, $template), array_flip(['name', 'tier', 'stats', 'ovr', 'age', 'wage', 'potentialOvr', 'badges', 'signatureChampions', 'avatarSvg', 'nationality', 'level', 'currentXp', 'maxXp', 'morale', 'fatigue', 'isEvo', 'evolutionLevel', 'evolutionHistory']));
    }

    /**
     * Weekly wage in pesos for a newly generated player: one curve for everyone (the founding-roster curve), so
     * stronger players cost disproportionately more. Existing players keep the wage they were signed on.
     */
    public static function wageFor(array $stats): int
    {
        $mean = array_sum($stats) / max(1, count($stats));
        return max(15, (int) round(50 * (($mean / 25) ** 3)));
    }

    /** Total attribute points one training step adds (even growth gives one to each of the six attributes). */
    public const STEP_POINTS = 6;
    /** Points of each step an attribute focus puts into the focused attribute; the rest go to the others. */
    public const FOCUS_POINTS = 3;

    private function stepsEarned(OwnedPlayerCard $player, array $profile): int
    {
        $earned = max(0, (int) $player->training_xp - ($profile['training_baseline'] ?? 0));
        return (int) floor(sqrt($earned / config('world_players.training_xp_per_step')));
    }

    /**
     * Current attributes: the profile's base plus allocated training points, capped at potential. Players
     * without an allocation (and any steps not yet allocated) grow evenly, exactly as before focused training.
     */
    public function stats(OwnedPlayerCard $player): array
    {
        $profile = $player->world_profile;
        $steps = $this->stepsEarned($player, $profile);
        $allocation = $profile['allocation'] ?? null;
        $pending = is_array($allocation) ? max(0, $steps - (int) ($profile['allocated_steps'] ?? 0)) : $steps;
        $stats = [];
        foreach (self::ATTRIBUTES as $key) {
            $stats[$key] = min($profile['potential'], max(1, (int) ($profile['stats'][$key] ?? 18)) + (int) ($allocation[$key] ?? 0) + $pending);
        }
        return $stats;
    }

    /**
     * Turn every training step earned since the last allocation into attribute points, following the
     * player's focus: 'system' (or none) grows all six evenly; an attribute focus puts three of a step's six
     * points into that attribute and one each into three others (rotating). Total growth per step is the same
     * either way, so a focus shapes a player without making them stronger overall. Points that would pass the
     * potential cap go to the lowest attribute still below it. Returns whole 1–10 level changes.
     * @return array<string,array{from:int,to:int}>
     */
    public function allocateSteps(OwnedPlayerCard $player, ?string $focus): array
    {
        $profile = $player->world_profile;
        if (! $this->enabled() || ! is_array($profile)) return [];
        $before = $this->stats($player);
        $steps = $this->stepsEarned($player, $profile);
        // A player never allocated keeps every step earned so far exactly as it was (even growth).
        if (! is_array($profile['allocation'] ?? null)) $profile = $this->withAllocation($player, $profile);
        $allocation = $profile['allocation'];
        $base = fn (string $key) => max(1, (int) ($profile['stats'][$key] ?? 18));
        $cap = (int) $profile['potential'];
        $add = function (string $key, int $points) use (&$allocation, $base, $cap): void {
            for ($i = 0; $i < $points; $i++) {
                $target = $key;
                if ($base($target) + $allocation[$target] >= $cap) {
                    $open = array_filter(self::ATTRIBUTES, fn ($k) => $base($k) + $allocation[$k] < $cap);
                    if (! $open) return;
                    usort($open, fn ($a, $b) => ($base($a) + $allocation[$a]) <=> ($base($b) + $allocation[$b]) ?: strcmp($a, $b));
                    $target = $open[0];
                }
                $allocation[$target]++;
            }
        };
        $focus = in_array($focus, self::ATTRIBUTES, true) ? $focus : null;
        for ($step = (int) $profile['allocated_steps']; $step < $steps; $step++) {
            if ($focus === null) { foreach (self::ATTRIBUTES as $key) $add($key, 1); continue; }
            $add($focus, self::FOCUS_POINTS);
            $others = array_values(array_diff(self::ATTRIBUTES, [$focus]));
            for ($i = 0; $i < self::STEP_POINTS - self::FOCUS_POINTS; $i++) $add($others[($step * 3 + $i) % count($others)], 1);
        }
        $profile['allocation'] = $allocation;
        $profile['allocated_steps'] = max((int) $profile['allocated_steps'], $steps);
        $player->world_profile = $profile;
        $player->save();
        $arch = app(FpsPlayerArchitecture::class);
        $changes = [];
        foreach ($this->stats($player) as $key => $value) {
            $from = $arch->scale10($before[$key]); $to = $arch->scale10($value);
            if ($to !== $from) $changes[$key] = ['from' => $from, 'to' => $to];
        }
        return $changes;
    }

    /** Record the steps already earned as even growth, before new XP is posted (ClubDevelopmentService). */
    public function ensureAllocation(OwnedPlayerCard $player): void
    {
        if (! $this->enabled() || ! is_array($player->world_profile) || is_array($player->world_profile['allocation'] ?? null)) return;
        $player->world_profile = $this->withAllocation($player, $player->world_profile);
        $player->save();
    }

    private function withAllocation(OwnedPlayerCard $player, array $profile): array
    {
        $steps = $this->stepsEarned($player, $profile);
        return array_replace($profile, ['allocation' => array_fill_keys(self::ATTRIBUTES, $steps), 'allocated_steps' => $steps]);
    }

    public function progress(OwnedPlayerCard $player): ?array
    {
        if (! $this->enabled() || ! $player->world_profile) {
            return null;
        }
        $baseline = (int) ($player->world_profile['training_baseline'] ?? 0);
        $earned = max(0, $player->training_xp - $baseline);
        $step = (int) floor(sqrt($earned / config('world_players.training_xp_per_step')));

        return ['earned_xp' => $earned, 'skill_steps' => $step, 'next_step_at' => config('world_players.training_xp_per_step') * ($step + 1) ** 2];
    }
}
