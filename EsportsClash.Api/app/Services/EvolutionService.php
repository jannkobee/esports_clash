<?php

namespace App\Services;

use App\Jobs\PollEvolutionRun;
use App\Models\BalanceProposal;
use App\Models\BalanceReview;
use App\Models\EvolutionRun;
use App\Models\EvolutionSetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EvolutionService
{
    public function updateSettings(array $data, string $actor): EvolutionSetting
    {
        EvolutionSetting::current();
        return DB::transaction(function () use ($data, $actor) {
            $settings = EvolutionSetting::lockForUpdate()->findOrFail(1);
            $settings->update($data);
            $this->audit('settings', 'settings.updated', $actor, $data);
            return $settings->fresh();
        });
    }

    public function stopRun(string $id, string $actor): EvolutionRun
    {
        return DB::transaction(function () use ($id, $actor) {
            $run = EvolutionRun::lockForUpdate()->findOrFail($id);
            if (in_array($run->status, ['queued', 'running', 'paused_resource'], true)) {
                $run->update(['status' => 'stopping']);
                $this->audit($id, 'training.stop-requested', $actor);
                // Acquire the database-backed unique queue lock after the SQL
                // transaction commits. PostgreSQL aborts a transaction when
                // the existing unique-lock insert hits its primary key.
                DB::afterCommit(fn () => PollEvolutionRun::dispatch($id));
            }
            return $run;
        });
    }

    public function audit(string $subject, string $action, string $actor, array $details = []): void
    {
        DB::table('evolution_audits')->insert(['subject_id' => $subject, 'action' => $action,
            'actor' => $actor, 'details' => json_encode($details, JSON_THROW_ON_ERROR), 'created_at' => now()]);
    }

    public function startRun(string $actor, bool $scheduled = false): ?EvolutionRun
    {
        EvolutionSetting::current();
        return DB::transaction(function () use ($actor, $scheduled): ?EvolutionRun {
            $settings = EvolutionSetting::lockForUpdate()->findOrFail(1);
            if ($scheduled && (! $settings->enabled || ($settings->next_training_at?->isFuture() ?? false))) {
                return null;
            }
            if (EvolutionRun::whereIn('status', ['queued', 'running', 'stopping', 'paused_resource'])->exists()) {
                if ($scheduled) return null;
                throw ValidationException::withMessages(['run' => 'A training run is already active.']);
            }
            $seed = $settings->next_seed;
            $operations = array_replace(['fit_cases' => 32, 'calibration_cases' => 24, 'evaluation_cases' => 24,
                'max_minutes' => config('evolution.max_run_minutes'), 'speed' => 'headless'], $settings->preferences['operations'] ?? []);
            $run = EvolutionRun::create(['id' => (string) Str::uuid(), 'plan' => [
                'version' => 2, 'seed_start' => $seed, 'fit_cases' => $operations['fit_cases'] ?? 32, 'calibration_cases' => $operations['calibration_cases'] ?? 24,
                'evaluation_cases' => $operations['evaluation_cases'] ?? 24, 'horizon_seconds' => 30, 'after_seconds' => 120,
                'max_minutes' => $operations['max_minutes'] ?? config('evolution.max_run_minutes'), 'policy_scope' => 'offline-live-macro',
                'minimum_evaluation_cases' => config('evolution.minimum_evaluation_cases'),
                'automatic_promotion' => false, 'operations' => $operations,
            ]]);
            $settings->update(['next_seed' => $seed + 1000,
                'next_training_at' => now()->addMinutes($settings->training_interval_minutes)]);
            $this->audit($run->id, 'training.queued', $actor, ['seed_start' => $seed]);
            DB::afterCommit(fn () => PollEvolutionRun::dispatch($run->id));
            return $run;
        });
    }

    public function createReview(EvolutionRun $run): BalanceReview
    {
        return DB::transaction(function () use ($run): BalanceReview {
            // Serialize creation with the same row used by the scheduler and settings changes.
            $settings = EvolutionSetting::lockForUpdate()->findOrFail(1);
            if ($existing = BalanceReview::where('run_id', $run->id)->first()) return $existing;
            $result = $run->result ?? [];
            $review = BalanceReview::create(['id' => (string) Str::uuid(), 'run_id' => $run->id,
                'baseline_version' => $result['source_hash'] ?? 'unknown',
                'preferences' => $settings->preferences ?? [], 'deadline_at' => now()->addHours($settings->review_hours)]);
            // No synthetic buff/nerf evidence: the first vertical slice only supports a keep-current option.
            $proposal = new BalanceProposal(['review_id' => $review->id, 'title' => 'Keep the current game balance',
                'changes' => [], 'evidence' => ['baseline_version' => $review->baseline_version,
                    'run_id' => $run->id, 'summary' => $result['evaluation'] ?? [],
                    'reason' => 'This macro-learning study does not establish avatar or item imbalance.'],
                'evaluation' => ['passed' => true, 'kind' => 'no-change']]);
            $proposal->manifest_hash = hash('sha256', json_encode($proposal->immutableManifest(), JSON_THROW_ON_ERROR));
            $proposal->save();
            $this->audit($review->id, 'review.opened', 'system', ['deadline_at' => $review->deadline_at->toIso8601String()]);
            return $review->load('proposals');
        });
    }

    public function eligible(BalanceProposal $proposal): bool
    {
        if ($proposal->status !== 'pending' || ! $proposal->intact()) return false;
        // Mechanical patches are intentionally blocked until actual candidate simulation/release gates exist.
        return $proposal->changes === [] && ($proposal->evaluation['passed'] ?? false) === true
            && ($proposal->evaluation['kind'] ?? '') === 'no-change';
    }

    public function decide(string $id, string $action, ?int $proposalId, string $actor, ?int $hours = null): BalanceReview
    {
        return DB::transaction(function () use ($id, $action, $proposalId, $actor, $hours): BalanceReview {
            $review = BalanceReview::lockForUpdate()->findOrFail($id);
            if ($review->status !== 'open') {
                throw ValidationException::withMessages(['review' => 'This review has already been closed.']);
            }
            $proposals = $review->proposals()->lockForUpdate()->get();
            if ($actor === 'substitute') {
                if ($review->deadline_at->isFuture()) return $review->load('proposals');
                $choice = $proposals->filter(fn ($proposal) => $this->eligible($proposal))->sortBy('id')->first();
                $proposalId = $choice?->id;
                $action = $choice ? 'select' : 'decline';
            }
            if ($action === 'defer') {
                $review->update(['deadline_at' => now()->addHours($hours ?? 48)]);
            } elseif ($action === 'reject') {
                $proposal = $proposals->firstWhere('id', $proposalId);
                if (! $proposal || $proposal->status !== 'pending') {
                    throw ValidationException::withMessages(['proposal' => 'Choose a pending proposal from this review.']);
                }
                $proposal->update(['status' => 'rejected']);
            } else {
                $proposal = $proposals->firstWhere('id', $proposalId);
                if ($action === 'select' && (! $proposal || ! $this->eligible($proposal))) {
                    throw ValidationException::withMessages(['proposal' => 'This proposal has not passed the available release gates.']);
                }
                $review->update(['status' => $action === 'select' ? 'selected' : 'declined',
                    'selected_proposal_id' => $action === 'select' ? $proposalId : null,
                    'decided_at' => now(), 'decided_by' => $actor,
                    'reason' => $actor === 'substitute' ? 'Review deadline expired; retained the current balance using verified eligible evidence.' : 'Owner decision.']);
                foreach ($proposals as $item) {
                    if ($item->status === 'pending') $item->update(['status' => $action === 'select' && $item->id === $proposalId ? 'selected' : 'closed']);
                }
            }
            $this->audit($review->id, 'review.'.$action, $actor, ['proposal_id' => $proposalId]);
            return $review->fresh('proposals');
        });
    }
}
