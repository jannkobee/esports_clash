<?php
namespace App\Services;

use Carbon\CarbonImmutable;

/** A read projection of verified ratings, never a combat-stat modifier. */
class PlayerForm
{
    public function summarize(iterable $ratings): array
    {
        $now = CarbonImmutable::now('UTC');
        $samples = collect($ratings)->map(function ($row) {
            $row = (array) $row;
            return ['rating' => (float) $row['rating'], 'date' => $row['date'] ?? $row['created_at'],
                'won' => (bool) $row['won']];
        })->filter(fn ($r) => CarbonImmutable::parse($r['date'])->lte($now))
            ->sortByDesc('date')->take(10)->filter(fn ($r) => CarbonImmutable::parse($r['date'])->gte($now->subDays(56)))->values();
        $weight = 0.0; $total = 0.0;
        foreach ($samples as $i => $r) {
            $days = max(0, CarbonImmutable::parse($r['date'])->diffInSeconds($now) / 86400);
            $w = pow(0.5, $days / 21) * pow(0.85, $i);
            $weight += $w; $total += $w * $r['rating'];
        }
        // Two neutral prior appearances temper one-match spikes. Inactivity reduces evidence.
        $score = $samples->isEmpty() ? null : round(max(1, min(10, (12 + $total) / (2 + $weight))), 1);
        $delta = $samples->count() >= 6 ? $samples->take(3)->avg('rating') - $samples->slice(3, 3)->avg('rating') : null;
        return ['score' => $score, 'sample_count' => $samples->count(),
            'evidence' => $samples->isEmpty() ? 'Unrated' : ($samples->count() < 3 ? 'Provisional' : ($samples->count() < 5 ? 'Building' : 'Established')),
            'trend' => $delta === null ? 'insufficient' : ($delta >= 0.25 ? 'rising' : ($delta <= -0.25 ? 'falling' : 'steady')),
            'trend_delta' => $delta === null ? null : round($delta, 2), 'samples' => $samples->all(),
            'model' => 'recency-prior-v1', 'window_days' => 56, 'half_life_days' => 21, 'prior_rating' => 6, 'prior_weight' => 2];
    }
}
