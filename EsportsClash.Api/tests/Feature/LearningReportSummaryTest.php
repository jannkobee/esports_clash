<?php

namespace Tests\Feature;

use App\Models\{EvolutionRun, User};
use App\Services\LearningReportSummary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class LearningReportSummaryTest extends TestCase
{
    use RefreshDatabase;

    private function brief(array $values): array
    {
        return app(LearningReportSummary::class)->describe(new EvolutionRun($values));
    }

    public function test_baseline_counts_do_not_become_training_updates_or_evaluation_wins(): void
    {
        $brief = $this->brief(['status' => 'running', 'plan' => ['version' => 4, 'domain' => 'arena'],
            'progress' => ['stage' => 'baseline', 'complete' => 2, 'planned' => 4, 'training' => []]]);
        $this->assertSame('No improvement measured yet', $brief['title']);
        $this->assertSame('0', $brief['metrics'][0]['value']);
        $this->assertSame('Not available', $brief['metrics'][1]['value']);
        $this->assertSame('Not measured', $brief['metrics'][2]['value']);
        $this->assertSame(50, $brief['bar']['percent']);
        $this->assertCount(3, $brief['bullets']);
    }

    public function test_only_recorded_successful_updates_count_and_a_generation_is_not_a_win(): void
    {
        $brief = $this->brief(['status' => 'running', 'plan' => ['version' => 4, 'domain' => 'arena'],
            'progress' => ['stage' => 'self-play', 'generation' => 7, 'planned' => 8,
                'training' => [['updated' => true], ['updated' => false], ['updated' => true]]]]);
        $this->assertSame('2', $brief['metrics'][0]['value']);
        $this->assertSame(2, $brief['bar']['complete']);
        $this->assertSame('Not measured', $brief['metrics'][3]['value']);
        $this->assertStringContainsString('does not itself prove', implode(' ', $brief['bullets']));
    }

    public function test_observed_win_change_does_not_override_an_inconclusive_assessment(): void
    {
        $brief = $this->brief(['status' => 'completed', 'plan' => ['version' => 4], 'result' => [
            'assessment' => ['status' => 'inconclusive', 'measured' => 64, 'planned' => 128, 'independentSeeds' => 16,
                'winDelta' => ['estimate' => .1, 'lower' => -.2, 'upper' => .4], 'reasons' => ['improvement-not-established']],
            'outcomes' => ['terminal_pairs' => 64, 'control_wins' => 30, 'challenger_wins' => 36,
                'averages' => ['deaths' => ['control' => 10, 'candidate' => 8, 'delta' => -2]]]]]);
        $this->assertSame('No clear improvement', $brief['title']);
        $this->assertSame('46.9%', $brief['metrics'][2]['value']);
        $this->assertSame('56.3%', $brief['metrics'][3]['value']);
        $this->assertStringContainsString('+10.0 percentage points', implode(' ', $brief['bullets']));
        $this->assertStringContainsString('-20.0 to +40.0', implode(' ', $brief['bullets']));
        $this->assertSame('10.0', $brief['changes'][0]['before']);
        $this->assertSame('8.0', $brief['changes'][0]['after']);
        $this->assertSame('neutral', $brief['tone']);
    }

    public function test_missing_arm_and_empty_match_count_never_become_zero_percent(): void
    {
        foreach ([['terminal_pairs' => 0, 'control_wins' => 0, 'challenger_wins' => 0],
            ['terminal_pairs' => 4, 'control_wins' => 1]] as $outcomes) {
            $brief = $this->brief(['plan' => ['version' => 4], 'result' => ['outcomes' => $outcomes]]);
            $this->assertSame('Not measured', $brief['metrics'][2]['value']);
            $this->assertSame('Not measured', $brief['metrics'][3]['value']);
        }
    }

    public function test_missing_training_history_is_not_reported_as_zero_updates(): void
    {
        $brief = $this->brief(['status' => 'failed', 'plan' => ['version' => 4, 'domain' => 'arena']]);
        $this->assertSame('Not recorded', $brief['metrics'][0]['value']);
        $this->assertStringContainsString('No training history', implode(' ', $brief['bullets']));
    }

    public function test_failure_retains_updates_but_does_not_present_them_as_improvement(): void
    {
        $brief = $this->brief(['status' => 'failed', 'plan' => ['version' => 4], 'progress' => [
            'stage' => 'self-play', 'training' => [['updated' => true], ['updated' => true], ['updated' => true]]]]);
        $this->assertSame('Study stopped on an error', $brief['title']);
        $this->assertSame('3', $brief['metrics'][0]['value']);
        $this->assertSame('danger', $brief['tone']);
        $this->assertStringContainsString('does not establish', implode(' ', $brief['bullets']));
    }

    public function test_passed_gate_remains_distinct_from_game_activation_and_legacy_task_checks(): void
    {
        $brief = $this->brief(['status' => 'completed', 'plan' => ['version' => 4],
            'result' => ['assessment' => ['status' => 'promote']]]);
        $this->assertSame('positive', $brief['tone']);
        $this->assertStringContainsString('activation is recorded separately', $brief['next']);
        $legacy = $this->brief(['status' => 'completed', 'plan' => [],
            'result' => ['evaluation' => ['passes_exploratory_gate' => true, 'changed' => 5]]]);
        $this->assertSame('Exploratory check passed', $legacy['title']);
        $this->assertStringContainsString('do not measure full-match', implode(' ', $legacy['bullets']));
    }

    public function test_report_renders_short_summary_with_collapsed_analysis_and_escaped_error(): void
    {
        $run = EvolutionRun::create(['id' => (string) Str::uuid(), 'status' => 'failed',
            'plan' => ['version' => 4, 'domain' => 'arena'], 'progress' => ['stage' => 'baseline'],
            'error' => '<script>bad()</script>']);
        $response = $this->actingAs(User::factory()->create(['is_evolution_admin' => true]))
            ->get('/evolution/runs/'.$run->id)->assertOk()->assertSee('TL;DR')
            ->assertSee('What changed?')->assertSee('Not measured')->assertSee('Full analysis')
            ->assertSee('&lt;script&gt;bad()&lt;/script&gt;', false)->assertDontSee('<script>bad()</script>', false);
        $dom = new \DOMDocument();
        @$dom->loadHTML($response->getContent());
        $xpath = new \DOMXPath($dom);
        $this->assertSame(2, $xpath->query('//details[contains(@class,"ml-disclosure")]')->length);
        $this->assertSame(0, $xpath->query('//details[contains(@class,"ml-disclosure") and @open]')->length);
        $this->assertSame(3, $xpath->query('//section[@aria-labelledby="ml-tldr-heading"]/ul/li')->length);
        $this->assertLessThan(strpos($response->getContent(), 'id="ml-analysis"'), strpos($response->getContent(), 'id="ml-tldr-heading"'));
    }
}
