<?php
namespace Tests\Support;

use App\Models\OnlineClub;
use App\Services\FpsIdentityEngine;
use App\Services\FpsPlayerArchitecture;
use App\Services\OnlineService;
use App\Services\WorldPlayerProfiles;
use Illuminate\Support\Facades\DB;

/**
 * Matches require complete manager-chosen T/CT roles (2026-11-14). Test clubs save them the way a
 * manager would (the recommended draft for their starters), unless a test has already saved its own.
 */
trait AssignsManagerRoles
{
    protected function assignManagerRolesOnSave(): void
    {
        OnlineClub::saved(function (OnlineClub $club) {
            if (empty($club->lineup) || DB::table('fps_team_systems')->where('club_id', $club->id)->exists()) return;
            $templates = collect(app(OnlineService::class)->activeCatalog()->payload['cards'])->keyBy('id');
            $definitions = \App\Models\OwnedPlayerCard::whereIn('id', array_column($club->lineup, 'instance_id'))->get()
                ->filter(fn ($p) => isset($templates[$p->definition_id]))
                ->mapWithKeys(fn ($p) => [$p->id => app(WorldPlayerProfiles::class)->definition($p, $templates[$p->definition_id])])->all();
            if (count($definitions) !== 5) return;
            $orders = [];
            foreach (app(FpsPlayerArchitecture::class)->recommendedAssignments($definitions, FpsIdentityEngine::PLAN) as $id => $roles)
                $orders[$id] = array_merge($roles, ['instruction' => 'balanced', 'training' => 'system']);
            DB::table('fps_team_systems')->updateOrInsert(['club_id' => $club->id], ['revision' => 1, 'gameplan' => json_encode(FpsIdentityEngine::PLAN),
                'culture' => json_encode(FpsIdentityEngine::PLAN), 'instructions' => json_encode($orders), 'created_at' => now(), 'updated_at' => now()]);
        });
    }
}
