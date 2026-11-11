<?php

namespace App\Services;

use Illuminate\Support\Facades\{DB, Schema};

class GameModes
{
    public const MOBA_CATEGORIES = ['avatars', 'items', 'releases'];

    public function state(): array
    {
        $enabled = Schema::hasTable('game_mode_settings')
            ? DB::table('game_mode_settings')->where('id', 1)->value('moba_enabled') : null;
        return ['active' => 'fps', 'fps_enabled' => true,
            'moba_enabled' => $enabled === null ? (bool) config('game_modes.moba_enabled', false) : (bool) $enabled,
            'historical_replays_enabled' => true];
    }

    public function configure(bool $enabled): void
    {
        abort_unless(Schema::hasTable('game_mode_settings'), 409, 'Apply the game-mode settings migration first.');
        DB::table('game_mode_settings')->updateOrInsert(['id' => 1], [
            'moba_enabled' => $enabled, 'created_at' => now(), 'updated_at' => now(),
        ]);
        \Illuminate\Support\Facades\Cache::forget('world.revision.v2');
        \Illuminate\Support\Facades\Cache::put('world.public.cache-revision', (string) \Illuminate\Support\Str::uuid(), 60);
    }

    public function requireMoba(): void
    {
        abort_unless($this->state()['moba_enabled'], 409, 'MOBA is disabled by the owner. Its code, assets and historical recordings are preserved.');
    }
}
