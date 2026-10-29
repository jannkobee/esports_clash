<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\TrellisGenerationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BattlefieldAssetTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get(route('battlefield.index'))
            ->assertRedirect(route('login'));
    }

    public function test_authenticated_owner_can_access_battlefield_studio(): void
    {
        Http::fake(['*' => Http::response([], 503)]);
        $owner = User::factory()->create(['is_evolution_admin' => true]);

        $response = $this->actingAs($owner)
            ->get(route('battlefield.index'))
            ->assertOk()
            ->assertSee('Battlefield 3D Asset Studio')
            ->assertSee('Structures &amp; Defensive Spire Network', false)
            ->assertSee('Battlefield Terrain, Flora &amp; Ambient Wildlife', false)
            ->assertSee('Combat Minions, Jungle Guardians &amp; Epic Bosses', false)
            ->assertSee('River Amber Frog')
            ->assertSee('Radiant Outer Bastion Turret')
            ->assertSee('Dragon Embermaw')
            ->assertSee('Siege Golem Gravemarch');

        $this->assertStringContainsString('33', $response->getContent());
    }

    public function test_tactical_arena_schematic_renders_hotspots(): void
    {
        Http::fake(['*' => Http::response([], 503)]);
        $owner = User::factory()->create(['is_evolution_admin' => true]);

        $this->actingAs($owner)
            ->get(route('battlefield.index'))
            ->assertOk()
            ->assertSee('struct_nexus_core_blue')
            ->assertSee('struct_turret_outer_blue')
            ->assertSee('struct_turret_outer_red')
            ->assertSee('env_critter_river_frog')
            ->assertSee('creep_boss_embermaw')
            ->assertSee('creep_boss_gravemarch');
    }

    public function test_all_33_world_assets_have_valid_references(): void
    {
        $service = app(TrellisGenerationService::class);
        $assets = $service->worldCatalog();
        $this->assertCount(33, $assets);

        foreach ($assets as $asset) {
            $refPath = resource_path('game/world-references/' . $asset['id'] . '.png');
            $this->assertFileExists($refPath, "Missing reference PNG for {$asset['id']}");
        }
    }

    public function test_battlefield_show_renders_asset_studio_with_tailored_prompts(): void
    {
        Http::fake(['*' => Http::response([], 503)]);
        $owner = User::factory()->create(['is_evolution_admin' => true]);

        $this->actingAs($owner)
            ->get(route('battlefield.show', 'env_critter_river_frog'))
            ->assertOk()
            ->assertSee('River Amber Frog')
            ->assertSee('Ambient Wildlife')
            ->assertSee('A cute stylized fantasy river frog creature', false)
            ->assertSee('Generate 3D Model via Google Colab');

        // Test static unrigged structure prompt
        $this->actingAs($owner)
            ->get(route('battlefield.show', 'struct_turret_outer_blue'))
            ->assertOk()
            ->assertSee('Radiant Outer Bastion Turret')
            ->assertSee('Defensive Tower')
            ->assertSee('Static unrigged 3D architectural/environment mesh', false);
    }

    public function test_invalid_asset_returns_404(): void
    {
        Http::fake(['*' => Http::response([], 503)]);
        $owner = User::factory()->create(['is_evolution_admin' => true]);

        $this->actingAs($owner)
            ->get(route('battlefield.show', 'invalid_nonexistent_asset'))
            ->assertNotFound();
    }
}
