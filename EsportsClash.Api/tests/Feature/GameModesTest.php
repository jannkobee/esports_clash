<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\GameModes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GameModesTest extends TestCase
{
    use RefreshDatabase;

    public function test_fps_is_active_and_moba_defaults_to_disabled_without_deleting_history(): void
    {
        $this->getJson('/api/v1/game-modes')->assertOk()->assertJsonPath('data.active', 'fps')
            ->assertJsonPath('data.moba_enabled', false)->assertJsonPath('data.historical_replays_enabled', true);
        $this->getJson('/api/v1/avatarpedia/directory/avatars')->assertStatus(409);
        $this->getJson('/api/v1/avatarpedia/articles/items/old-item')->assertStatus(409);
        $this->assertDatabaseCount('game_mode_settings', 0);
    }

    public function test_only_owner_can_update_the_persistent_reversible_switch(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->post('/evolution/game-modes', ['moba_enabled'=>true])->assertForbidden();
        $owner = User::factory()->create(['is_evolution_admin'=>true]);
        $this->actingAs($owner)->get('/evolution/game-modes')->assertOk()->assertSee('Enable MOBA');
        $this->actingAs($owner)->post('/evolution/game-modes', ['moba_enabled'=>true])->assertRedirect();
        $this->assertTrue(app(GameModes::class)->state()['moba_enabled']);
        $this->actingAs($owner)->post('/evolution/game-modes', ['moba_enabled'=>false])->assertRedirect();
        $this->assertFalse(app(GameModes::class)->state()['moba_enabled']);
        $this->assertDatabaseCount('game_mode_settings', 1);
    }
}
