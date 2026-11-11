<?php
namespace App\Services;

/** Compatibility entry point for queued jobs. All voices now use the local simulation. */
class WorldNarration
{
    public function ready(): bool { return app(WorldVoiceSimulation::class)->ready(); }
    public function status(): string { return app(WorldVoiceSimulation::class)->status(); }
    public function tick(): array { return app(WorldVoiceSimulation::class)->tick(); }
}
