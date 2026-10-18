@extends('evolution.layout')
@section('title', 'Learning report')
@section('content')
<div class="actions"><a href="{{ route('evolution.reports') }}">All ML reports</a></div>
<a href="{{ route('dashboard') }}">← Evolution Lab</a>
<div class="page-heading"><div><p class="eyebrow">MACHINE LEARNING REPORT</p><h1>{{ ucfirst($run->status) }} study</h1><code>{{ $run->id }}</code></div><a class="button primary" href="{{ route('evolution.download', $run) }}">Download report JSON</a></div>
@php($evaluation = $run->result['evaluation'] ?? [])
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
@foreach(['plan' => 'Frozen execution plan', 'progress' => 'Recorded progress', 'result' => 'Complete recorded result'] as $field => $label)
<section class="panel"><h2>{{ $label }}</h2><pre>{{ json_encode($run->$field, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}</pre></section>
@endforeach
@endsection
