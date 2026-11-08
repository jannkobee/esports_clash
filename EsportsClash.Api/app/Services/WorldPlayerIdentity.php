<?php

namespace App\Services;

use App\Models\OnlineCatalog;
use App\Models\OwnedPlayerCard;
use Illuminate\Support\Facades\DB;

class WorldPlayerIdentity
{
    public function assign(OwnedPlayerCard $player, OnlineCatalog $catalog, bool $preferOriginal = true, string $source = 'starter', ?int $nationality = null): OwnedPlayerCard
    {
        $profiles = app(WorldPlayerProfiles::class);
        if ($player->persona_name) {
            $profiles->initialize($player, $catalog, $source, $nationality);

            return $player;
        }
        $definition = collect($catalog->payload['cards'])->firstWhere('id', $player->definition_id);
        abort_unless($definition, 422, 'The player archetype is missing.');
        $original = ! $profiles->enabled() && $preferOriginal && ! OwnedPlayerCard::where('original_identity', $player->definition_id)->exists();
        $name = $original ? $definition['name'] : $this->generatedName($player->id);
        // The caller holds the shared catalog lock. Unique indexes also protect concurrent identity admission.
        $player->update(['persona_name' => $name, 'original_identity' => $original ? $player->definition_id : null]);
        $profiles->initialize($player, $catalog, $source, $nationality);

        return $player;
    }

    private function generatedName(string $id, ?string $previous = null): string
    {
        $reserved = collect(OnlineCatalog::where('active', true)->first()?->payload['cards'] ?? [])->pluck('name')->map(fn ($n) => strtolower($n))->all();
        $generator = app(PlayerIgnGenerator::class);
        for ($attempt = 0; $attempt < 100; $attempt++) {
            $name = $generator->generate($id.':'.$attempt);
            $same=OwnedPlayerCard::withoutGlobalScopes()->whereRaw('LOWER(persona_name) = ?', [strtolower($name)])->where('id','!=',$id);
            $owner=OwnedPlayerCard::withoutGlobalScopes()->whereKey($id)->value('user_id');
            if (in_array(strtolower($name), $reserved, true) || (clone $same)->count()>=3 || ($owner&&(clone $same)->where('user_id',$owner)->exists())) {
                continue;
            }
            DB::table('competition_audits')->insert(['action' => 'player.identity.generated', 'subject' => $id, 'details' => json_encode(['previous_alias' => $previous, 'alias' => $name]), 'created_at' => now()]);

            return $name;
        }
        throw new \RuntimeException('Could not reserve a display IGN within the three-player limit.');
    }

    public function renameGenerated(OwnedPlayerCard $player): void
    {
        abort_if($player->original_identity !== null, 409, 'Archive legacy original players rather than silently renaming them.');
        $player->update(['persona_name' => $this->generatedName($player->id, $player->persona_name)]);
    }

    public function migrate(bool $compact = false): array
    {
        return DB::transaction(function () use ($compact) {
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $count = 0;
            $originals = 0;
            // Human owners first, oldest ownership next. Instance/contract/XP/history remain unchanged.
            $q = OwnedPlayerCard::query()->leftJoin('online_clubs as c', 'c.user_id', '=', 'owned_player_cards.user_id')
                ->whereNull('persona_name')->where('catalog_id', $catalog->id)->orderByRaw('COALESCE(c.is_bot, false) ASC')->orderBy('owned_player_cards.created_at')->orderBy('owned_player_cards.id')->select('owned_player_cards.*');
            foreach ($q->cursor() as $p) {
                $this->assign($p, $catalog);
                $count++;
                if ($p->original_identity) {
                    $originals++;
                }
            }
            $shortened = 0;
            if ($compact) {
                foreach (OwnedPlayerCard::whereNull('original_identity')->whereNotNull('persona_name')->cursor() as $p) {
                    if (! preg_match('/^[A-Za-z]+-[A-F0-9]{32}$/D', $p->persona_name)) {
                        continue;
                    }
                    $p->update(['persona_name' => $this->generatedName($p->id, $p->persona_name)]);
                    $shortened++;
                }
            }

            return ['assigned' => $count, 'original_identities' => $originals, 'new_identities' => $count - $originals, 'shortened_generated_aliases' => $shortened];
        }, 3);
    }
}
