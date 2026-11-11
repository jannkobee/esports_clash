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

    public const VERSION = 1;

    public const ATTRIBUTES = ['lan', 'tf', 'iq', 'ldr', 'clu', 'sta', 'flx'];

    public function enabled(): bool
    {
        return $this->enabled ??= Schema::hasTable('world_player_settings') &&
            (config('world_players.enabled') || (int) DB::table('world_player_settings')->where('id', 1)->value('profile_version') === self::VERSION);
    }

    public function invalidate(): void
    {
        $this->enabled = null;
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
            'training_baseline' => (int) $player->training_xp, 'wage' => max(15, (int) round(array_sum($stats) / count($stats))),
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
        $out['name'] = $player->persona_name ?? $template['name'];
        $out['presentation'] = $player->presentation;
        if (Schema::hasTable('fps_player_identities')) {
            $identity=DB::table('fps_player_identities')->where('player_id',$player->id)->first();
            if($identity)$out['fpsIdentity']=app(FpsIdentityProfiles::class)->scouting($identity);
        }
        $profile = $this->enabled() ? $player->world_profile : null;
        if (! $profile) {
            return $out;
        }
        $earned = max(0, (int) $player->training_xp - ($profile['training_baseline'] ?? 0));
        $steps = (int) floor(sqrt($earned / config('world_players.training_xp_per_step')));
        $stats = [];
        foreach (self::ATTRIBUTES as $key) {
            $stats[$key] = min($profile['potential'], max(1, (int) ($profile['stats'][$key] ?? 18)) + $steps);
        }
        $nationality = $player->nationality_id ? CompetitionGeography::find($player->nationality_id) : null;

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
