<?php
namespace App\Services;

use App\Models\{AvatarEvolutionRun,AvatarPreparation,AvatarVisualRelease,AvatarEquipmentGeneration,TrellisGeneration};
use Illuminate\Support\Facades\{DB,Log};

class AvatarRetentionService
{
    public function computeProtected(): array
    {
        $keep = collect();
        $reasons = [];

        $protect = function (string $id, string $reason) use (&$keep, &$reasons) {
            $keep->push($id);
            $reasons[$id][] = $reason;
        };

        // 1. All releases in AvatarVisualRelease (active, rollback, and historical)
        foreach (AvatarVisualRelease::all() as $release) {
            if ($release->run_id) {
                $protect($release->run_id, $release->active ? 'active_release' : 'rollback_release');
            }
        }

        // 2. All preparations associated with any retained/active 3D source generation
        $existingGenIds = TrellisGeneration::pluck('id');
        $generationPreps = AvatarPreparation::whereIn('generation_id', $existingGenIds)->get();
        foreach ($generationPreps as $prep) {
            $protect($prep->id, 'active_generation_attempt_' . substr($prep->generation_id, 0, 8));
        }

        // 3. Active preparations and paused/cancelling preparations
        $activePreps = AvatarPreparation::whereIn('status', [
            ...AvatarPreparationService::ACTIVE, 'paused', 'pausing', 'cancelling'
        ])->get();
        foreach ($activePreps as $prep) {
            $protect($prep->id, 'active_preparation');
        }

        // 4. Latest ready or draft preparation for each avatar
        $catalog = app(TrellisGenerationService::class)->catalog();
        foreach ($catalog as $item) {
            $avatarId = $item['id'];
            $latestDraft = AvatarPreparation::where('avatar_id', $avatarId)
                ->whereIn('status', ['ready', 'published', 'needs_review', 'validating', 'awaiting_validation'])
                ->latest()
                ->first();
            if ($latestDraft) {
                $protect($latestDraft->id, 'latest_ready_draft');
            }
        }

        // 5. Dependencies of all protected preparations (rig_reuse, baseline, and recursive dependencies)
        $checkedIds = [];
        $toCheck = $keep->unique()->values()->all();
        while (!empty($toCheck)) {
            $id = array_shift($toCheck);
            if (isset($checkedIds[$id])) continue;
            $checkedIds[$id] = true;

            $prep = AvatarPreparation::find($id);
            if ($prep) {
                if (!empty($prep->plan['rig_reuse']['id'])) {
                    $reuseId = $prep->plan['rig_reuse']['id'];
                    $protect($reuseId, 'reused_rig_dependency_of_' . $id);
                    $toCheck[] = $reuseId;
                }
                if (!empty($prep->plan['baseline']['run_id'])) {
                    $baselineId = $prep->plan['baseline']['run_id'];
                    $protect($baselineId, 'baseline_dependency_of_' . $id);
                    $toCheck[] = $baselineId;
                }
            }
        }

        // 6. Active & recent Evolution runs
        $activeRuns = AvatarEvolutionRun::whereIn('status', [...AvatarEvolutionService::ACTIVE, 'complete'])->get();
        foreach ($activeRuns as $run) {
            $protect($run->id, 'active_evolution_run');
            if (!empty($run->plan['parent']['run_id'])) {
                $protect($run->plan['parent']['run_id'], 'evolution_parent_of_' . $run->id);
            }
        }
        $recentRuns = AvatarEvolutionRun::latest()->limit(5)->get();
        foreach ($recentRuns as $run) {
            $protect($run->id, 'recent_evolution_run');
        }

        // 7. Active equipment generations
        $activeEquipment = AvatarEquipmentGeneration::whereIn('status', [
            ...TrellisGenerationService::ACTIVE, 'installing'
        ])->get();
        foreach ($activeEquipment as $eq) {
            $protect($eq->id, 'active_equipment_job');
        }

        // 8. Equipment hashes & references to keep
        $equipmentHashes = collect();
        $weaponRefs = app(TrellisGenerationService::class)->weaponReferences();
        foreach ($weaponRefs as $avatarId => $slots) {
            foreach (['primary', 'secondary'] as $slot) {
                if (!empty($slots[$slot]['sha256'])) {
                    $equipmentHashes->push($slots[$slot]['sha256']);
                }
                if (!empty($slots[$slot]['reference_sha256'])) {
                    $equipmentHashes->push($slots[$slot]['reference_sha256']);
                }
            }
        }

        // Also protect equipment hashes in all protected preparations
        foreach ($keep->unique() as $id) {
            $prep = AvatarPreparation::find($id);
            if ($prep && !empty($prep->plan['equipment'])) {
                foreach ($prep->plan['equipment'] as $item) {
                    if (!empty($item['sha256'])) $equipmentHashes->push($item['sha256']);
                }
            }
        }

        return [
            'keep' => $keep->unique()->values()->all(),
            'reasons' => $reasons,
            'equipment_hashes' => $equipmentHashes->unique()->values()->all(),
        ];
    }

    public function planCleanup(): array
    {
        $protected = $this->computeProtected();
        $keep = $protected['keep'];

        $deletablePreps = AvatarPreparation::whereIn('status', ['failed', 'cancelled', 'superseded'])
            ->whereNotIn('id', $keep)
            ->whereNull('artifacts_deleted_at')
            ->where('created_at', '<', now()->subHours(24))
            ->pluck('id')
            ->all();

        $deletableEnhancements = AvatarEvolutionRun::whereIn('status', ['failed', 'unchanged', 'cancelled'])
            ->whereNotIn('id', $keep)
            ->whereNull('artifacts_deleted_at')
            ->where('created_at', '<', now()->subDays(7))
            ->pluck('id')
            ->all();

        return [
            'keep' => $keep,
            'reasons' => $protected['reasons'],
            'equipment_hashes' => $protected['equipment_hashes'],
            'deletable_preparations' => $deletablePreps,
            'deletable_enhancements' => $deletableEnhancements,
            'delete' => array_values(array_unique([...$deletablePreps, ...$deletableEnhancements])),
        ];
    }

    public function maintain(bool $dryRun = false, string $actor = 'system:retention'): array
    {
        $plan = $this->planCleanup();
        $keep = $plan['keep'];
        $toDelete = $plan['delete'];

        $this->truncateLogs();

        $service = app(AvatarEvolutionService::class);
        $payload = [
            'keep' => $keep,
            'delete' => array_slice($toDelete, 0, 100),
            'keep_equipment' => $plan['equipment_hashes'],
            'scan_orphans' => true,
            'apply' => !$dryRun,
        ];

        $response = $service->worker()->post($service->endpoint('/retention'), $payload);
        if (!$response->successful()) {
            throw new \RuntimeException('Worker retention call failed: ' . $response->body());
        }

        $data = $response->json();
        $deleted = $data['deleted'] ?? [];
        $skipped = $data['skipped'] ?? [];
        $reclaimedBytes = (int)($data['reclaimed_bytes'] ?? 0);

        if ($dryRun) {
            $deletableCandidateIds = array_values(array_unique([...$toDelete, ...$skipped]));
            return [
                'dry_run' => true,
                'protected_count' => count($keep),
                'protected' => $keep,
                'reasons' => $plan['reasons'],
                'deletable_count' => count($deletableCandidateIds),
                'deletable' => $deletableCandidateIds,
                'deletable_preparations' => $plan['deletable_preparations'],
                'deletable_enhancements' => $plan['deletable_enhancements'],
            ];
        }

        if (!empty($deleted)) {
            AvatarPreparation::whereIn('id', $deleted)->update(['artifacts_deleted_at' => now()]);
            AvatarEvolutionRun::whereIn('id', $deleted)->update(['artifacts_deleted_at' => now()]);
        }

        app(EvolutionService::class)->audit('avatars', 'avatar.safe-artifact-cleanup', $actor, [
            'deleted' => $deleted,
            'protected_count' => count($keep),
            'reclaimed_bytes' => $reclaimedBytes,
        ]);

        return [
            'dry_run' => false,
            'deleted' => $deleted,
            'skipped' => $skipped,
            'reclaimed_bytes' => $reclaimedBytes,
            'protected_count' => count($keep),
        ];
    }

    public function truncateLogs(): void
    {
        $logPaths = [
            storage_path('logs/laravel.log'),
        ];
        foreach ($logPaths as $path) {
            if (is_file($path) && filesize($path) > 10 * 1024 * 1024) {
                $tail = substr(file_get_contents($path), -1024 * 1024);
                file_put_contents($path, $tail);
            }
        }
    }
}

