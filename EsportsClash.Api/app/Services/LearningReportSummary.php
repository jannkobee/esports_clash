<?php

namespace App\Services;

use App\Models\EvolutionRun;

/** Short presentation of stored evidence; never infers improvement from training. */
class LearningReportSummary
{
    public function describe(EvolutionRun $run): array
    {
        $plan = $run->plan ?? [];
        $progress = $run->progress ?? [];
        $result = $run->result ?? [];
        $assessment = $result['assessment'] ?? [];
        $evaluation = $result['evaluation'] ?? [];
        $fullMatch = in_array($plan['version'] ?? 0, [3, 4], true);
        $stage = $progress['stage'] ?? 'queued';
        $status = $run->status ?? 'queued';
        $hasTraining = isset($result['training']) || isset($progress['training']) || isset($progress['metrics']);
        $training = $result['training'] ?? $progress['training'] ?? (isset($progress['metrics']) ? [$progress['metrics']] : []);
        $updates = count(array_filter($training, fn ($entry) => ($entry['updated'] ?? false) === true));
        $stages = [
            'queued' => ['Waiting to start', 'Waiting for the worker.'],
            'software-checks' => ['Checking software', 'Checking game compatibility before matches start.'],
            'baseline' => ['Checking the baseline', 'Repeating previous-policy matches to check consistency.'],
            'fitting' => ['Trying candidates', 'Trying candidate settings in development matches.'],
            'teaching' => ['Preparing the model', 'Preparing the starting model from examples.'],
            'self-play' => ['Learning from matches', 'Playing training matches and collecting experience.'],
            'trained' => ['Model updated', 'A model update was recorded; independent testing is still needed.'],
            'held-out' => ['Testing independently', 'Comparing the candidate with the previous policy in fresh matches.'],
            'complete' => ['Study finished', 'Collection has ended.'],
        ];
        [$stageLabel, $now] = $stages[$stage] ?? ['Work in progress', 'The worker has not recorded a recognized stage.'];
        $tone = 'neutral';
        $title = 'No improvement measured yet';
        $proof = $fullMatch ? 'A win-rate improvement has not been established.' : 'These task windows do not measure full-match win rate.';
        if ($fullMatch) {
            [$title, $tone, $proof] = match ($assessment['status'] ?? '') {
                'promote' => ['Improvement confirmed in this test', 'positive', 'The candidate passed the independent match test.'],
                'reject' => ['Candidate did not pass', 'warning', 'The candidate failed this study\'s acceptance requirements.'],
                'inconclusive' => ['No clear improvement', 'neutral', 'The independent results do not establish stronger play.'],
                default => [$title, $tone, $proof],
            };
        } elseif ($result) {
            $title = ($evaluation['passes_exploratory_gate'] ?? false) ? 'Exploratory check passed' : 'Exploratory check did not pass';
            $tone = ($evaluation['passes_exploratory_gate'] ?? false) ? 'neutral' : 'warning';
        }
        if ($status === 'running' && $stage === 'self-play' && !$assessment) $title = 'Learning is in progress';
        if ($status === 'queued') $title = 'Waiting to start';
        if ($status === 'failed') {
            $title = 'Study stopped on an error';
            $tone = 'danger';
            $stageLabel = 'Failed';
            $now = 'The worker stopped. Recorded progress is retained.';
            $proof = 'This failure does not establish gameplay improvement.';
        } elseif ($status === 'cancelled') {
            $title = 'Study stopped';
            $stageLabel = 'Cancelled';
            $now = 'No more matches are being collected for this study.';
        } elseif (in_array($status, ['paused_budget', 'paused_resource', 'stopping'], true)) {
            $stageLabel = match ($status) {
                'paused_budget' => 'Compute window paused',
                'paused_resource' => 'Waiting for resources',
                default => 'Stopping',
            };
            $now = match ($status) {
                'paused_budget' => 'The compute window ended; progress is saved.',
                'paused_resource' => 'Waiting for available compute resources.',
                default => 'Closing the current attempt and retaining its evidence.',
            };
        }

        $bullets = [$now, $proof];
        $pairs = $result['outcomes']['terminal_pairs'] ?? null;
        $controlWins = $result['outcomes']['control_wins'] ?? null;
        $candidateWins = $result['outcomes']['challenger_wins'] ?? null;
        $hasRates = is_numeric($pairs) && $pairs > 0 && is_numeric($controlWins) && is_numeric($candidateWins);
        $interval = $assessment['winDelta'] ?? null;
        if ($fullMatch && isset($interval['estimate'], $interval['lower'], $interval['upper'])) {
            $bullets[] = sprintf('Estimated win-rate change: %+.1f percentage points (%.0f%% range: %+.1f to %+.1f).',
                100 * $interval['estimate'], 100 * ($interval['confidence'] ?? .95), 100 * $interval['lower'], 100 * $interval['upper']);
        } elseif ($fullMatch) {
            $bullets[] = !$hasTraining ? 'No training history is attached to this report.' : ($updates > 0
                ? $updates.' model '.($updates === 1 ? 'update' : 'updates').' recorded; more training does not itself prove better play.'
                : 'No successful model update is recorded in this report yet.');
        } else {
            $changed = $evaluation['changed'] ?? null;
            $bullets[] = is_numeric($changed) ? number_format($changed).' changed decisions recorded; changed does not mean better.' : 'No measured decision changes are available yet.';
        }

        // Only describe measurements with both arms present; do not invent tactical conclusions.
        $changes = [];
        $labels = ['deaths' => 'Team deaths', 'cs' => 'Last hits', 'gold' => 'Unspent gold', 'damage' => 'Champion damage', 'durationSeconds' => 'Match length (seconds)'];
        foreach ($result['outcomes']['averages'] ?? [] as $key => $values) {
            if (isset($labels[$key], $values['control'], $values['candidate'])) {
                $changes[] = ['label' => $labels[$key], 'before' => number_format($values['control'], 1), 'after' => number_format($values['candidate'], 1)];
            }
        }
        $reasons = [
            'incomplete-full-matches' => 'Some planned matches did not finish.',
            'invalid-or-unstable-evidence' => 'A consistency or evidence check failed.',
            'team-survival-regression' => 'Extra team deaths failed this study\'s original requirement.',
            'insufficient-independent-seeds' => 'More independent match groups are needed.',
            'insufficient-draft-diversity' => 'Not enough different lineups were tested.',
            'missing-opponent-coverage' => 'Some planned opponents have not been tested.',
            'improvement-not-established' => 'The uncertainty range does not confirm an advantage.',
            'side-regression' => 'Results were worse on one side of the map.',
            'total-budget-exhausted' => 'The total compute budget ended.',
        ];
        $limits = [];
        foreach ($assessment['reasons'] ?? [] as $reason) $limits[] = $reasons[$reason] ?? str_replace('-', ' ', $reason);
        if (!$limits) $limits[] = $fullMatch ? 'Training rewards and losses are not proof of better play.' : 'Full-match competitive improvement remains unmeasured.';
        if ($hasRates) $limits[] = 'Matched games share seeds; they are not all independent samples.';
        $next = match ($status) {
            'failed' => 'Review the error in the full analysis before retrying.',
            'cancelled' => 'This study is stopped; its recorded results remain available.',
            'paused_budget' => 'Resume this study to continue its saved work.',
            'paused_resource' => 'The worker can continue when resources are available.',
            'stopping' => 'Wait for the worker to finish stopping.',
            'completed' => ($assessment['status'] ?? '') === 'promote'
                ? 'Qualification passed. Game activation is recorded separately.'
                : 'Keep this result; further experiments need fresh comparisons.',
            default => match ($stage) {
                'queued', 'software-checks', 'baseline' => 'Finish setup checks, then collect training or development matches.',
                'held-out' => 'Finish the independent comparison and report the result.',
                default => 'Finish training or candidate selection, then test independently.',
            },
        };

        $complete = $progress['complete'] ?? $progress['completed'] ?? null;
        $planned = $progress['planned'] ?? null;
        // Self-play reports the update index separately, not a completed match count.
        if ($stage === 'self-play') $complete = ($plan['domain'] ?? '') === 'arena' && $hasTraining ? $updates : null;
        $bar = is_numeric($complete) && is_numeric($planned) && $planned > 0
            ? ['complete' => $complete, 'planned' => $planned, 'percent' => min(100, max(0, 100 * $complete / $planned))] : null;
        $measured = $assessment['measured'] ?? null;
        $evaluationPlanned = $assessment['planned'] ?? null;
        $metrics = [
            ['label' => 'Model updates', 'value' => $hasTraining ? number_format($updates) : 'Not recorded', 'note' => 'Successful updates recorded'],
            ['label' => $fullMatch ? 'Evaluation comparisons' : 'Valid evaluation cases',
                'value' => $fullMatch ? (isset($measured) ? number_format($measured).(isset($evaluationPlanned) ? ' / '.number_format($evaluationPlanned) : '') : 'Not available') : (isset($evaluation['valid']) ? number_format($evaluation['valid']) : 'Not available'),
                'note' => $fullMatch ? (isset($assessment['independentSeeds']) ? $assessment['independentSeeds'].' independent seed groups' : 'Independent results only') : 'Recorded task windows'],
            ['label' => 'Previous win rate', 'value' => $hasRates ? number_format(100 * $controlWins / $pairs, 1).'%' : 'Not measured', 'note' => $hasRates ? $controlWins.' wins / '.$pairs.' paired games' : 'Completed paired games needed'],
            ['label' => 'Candidate win rate', 'value' => $hasRates ? number_format(100 * $candidateWins / $pairs, 1).'%' : 'Not measured', 'note' => $hasRates ? $candidateWins.' wins / '.$pairs.' paired games' : 'Completed paired games needed'],
        ];
        return compact('title', 'tone', 'stageLabel', 'bullets', 'metrics', 'changes', 'limits', 'next', 'bar');
    }
}
