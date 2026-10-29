@extends('evolution.layout')
@section('title', 'Learning report')
@section('content')
<div class="ml-report">
<nav class="ml-breadcrumb" aria-label="Breadcrumb"><a href="{{ route('dashboard') }}">Evolution Lab</a><span aria-hidden="true">/</span><a href="{{ route('evolution.reports') }}">All ML reports</a></nav>
<div class="ml-report-heading"><div><p class="ml-kicker">ML BALANCE</p><h1>Machine Learning Report</h1><p>Results at a glance. Expand the details when you need them.</p></div><a class="button" href="{{ route('evolution.download', $run) }}">Download JSON</a></div>
@include('evolution.learning-report-summary')
@if($run->error)<div class="ml-error" role="alert"><strong>Worker error</strong><p>{{ \Illuminate\Support\Str::limit($run->error, 240) }}</p><a href="#ml-analysis">Full error in analysis</a></div>@endif
<details class="ml-disclosure" id="ml-analysis"><summary>Full analysis <span>Findings, training history and learning reference</span></summary><div class="ml-disclosure-body">
@php($evaluation = $run->result['evaluation'] ?? [])
@if(in_array($run->plan['version']??0,[3,4],true))
@include('evolution.intelligence-report')
@else
<section class="panel">
    <h2>Evaluation evidence</h2>
    <p class="muted">{{ $run->progress['completed'] ?? 0 }} / {{ $run->progress['planned'] ?? 80 }} planned worlds · {{ $run->progress['stage'] ?? 'Waiting' }}</p>
    @if($run->error)<p class="error-text">{{ $run->error }}</p>@endif
    @if($run->result)
        <div class="metrics report-metrics">
            @foreach(['valid' => 'Valid evaluation cases', 'changed' => 'Changed decisions', 'supported' => 'Supported cases', 'coverage' => 'Empirical coverage', 'prediction_loss' => 'Prediction MSE', 'zero_prediction_loss' => 'Zero-contrast MSE'] as $key => $label)
            <article class="metric"><span>{{ $label }}</span><strong>{{ isset($evaluation[$key]) ? (is_float($evaluation[$key]) ? number_format($evaluation[$key], 5) : $evaluation[$key]) : '—' }}</strong></article>
            @endforeach
        </div>
        <p>Exploratory gate: <strong>{{ ($evaluation['passes_exploratory_gate'] ?? false) ? 'Passed' : 'Not passed' }}</strong>. Production promotion is not authorized by this gate.</p>
        @if(isset($evaluation['reason']))<p class="muted">{{ $evaluation['reason'] }}</p>@endif
        <p class="fine">Candidate hash: <code>{{ $run->result['candidate_hash'] ?? 'No candidate produced' }}</code></p>
    @else<p class="muted">Evaluation results are not available yet. Collection progress is shown on the live dashboard.</p>@endif
</section>
@php($diagnostics = $evaluation['diagnostics'] ?? null)
<section class="panel">
    <h2>Regression diagnosis</h2>
    @if($diagnostics)
        <p>Assessment: <strong>{{ ucfirst($diagnostics['assessment'] ?? 'inconclusive') }}</strong> · {{ $diagnostics['measured'] ?? 0 }} measured / {{ $diagnostics['planned'] ?? 0 }} planned worlds.</p>
        @if(!empty($diagnostics['signals']))
            <ul>@foreach($diagnostics['signals'] as $signal)<li>{{ $signal }}</li>@endforeach</ul>
        @endif
        @if($rate = $diagnostics['decision_change_rate'] ?? null)
            <p>Changed decisions: {{ number_format(100 * $rate['estimate'], 2) }}% (95% interval {{ number_format(100 * $rate['lower'], 2) }}–{{ number_format(100 * $rate['upper'], 2) }}%; {{ $rate['denominator'] }} measured cases).</p>
        @endif
        @if($interval = $diagnostics['reward_delta_interval'] ?? null)
            <p>Mean team reward difference: {{ number_format($interval['estimate'], 5) }} (95% interval {{ number_format($interval['lower'], 5) }}–{{ number_format($interval['upper'], 5) }}; {{ $interval['independent_seeds'] }} independent seeds).</p>
        @endif
        <p class="muted">{{ $diagnostics['scope'] ?? '' }}</p>
    @else
        <p class="muted">No versioned regression diagnosis was recorded for this study. Historical results have not been rewritten.</p>
    @endif
    <p class="fine">Full-match win rate and competitive improvement are unmeasured by these task windows. The incumbent remains active.</p>
</section>
@endif
</div></details>
<details class="ml-disclosure"><summary>Technical details and raw evidence <span>Original plan, progress and results</span></summary><div class="ml-disclosure-body"><p class="muted">Original recorded values. Download the JSON for independent inspection.</p>
@foreach(['plan' => 'Frozen execution plan', 'progress' => 'Recorded progress', 'result' => 'Complete recorded result'] as $field => $label)
<section class="panel"><h2>{{ $label }}</h2><pre>{{ json_encode($run->$field, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}</pre></section>
@endforeach
</div></details>
<footer class="ml-report-footer"><span>Study ID <code>{{ $run->id }}</code></span>@include('evolution.delete-report',['type'=>'ml'])</footer>
</div>
@endsection
