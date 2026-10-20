@extends('evolution.layout')
@section('title', 'Model reports')
@section('content')
<div class="page-heading">
    <div>
        <p class="eyebrow">AVATAR MODEL EVOLUTION</p>
        <h1>Model reports</h1>
        <p class="muted">Geometry, animation, ability presentation, technical validation and owner decisions.</p>
    </div>
    <a class="button quiet" href="{{ route('avatars.index') }}">&larr; Back to 3D Enhancements</a>
</div>

<div class="metrics report-metrics">
    <article class="metric"><span>Model cycles</span><strong>{{ $runCount }}</strong></article>
    <article class="metric"><span>Active analysis cycles</span><strong>{{ $activeCount }}</strong></article>
    <article class="metric"><span>Published visual versions</span><strong>{{ $releaseCount }}</strong></article>
</div>

<section class="panel">
    <div class="section-heading">
        <h2>Model generation reports</h2>
        <a href="{{ route('trellis.index') }}">TRELLIS.2 neural generation reports &rarr;</a>
    </div>

    @php
        $validRuns = $runs->filter(fn($r) => ((int)($r->report['valid_candidates'] ?? 0)) > 0)->count();
        $failedRuns = $runs->filter(fn($r) => $r->error || (isset($r->report['valid_candidates']) && ((int)$r->report['valid_candidates']) === 0))->count();
        $activeRuns = $runs->filter(fn($r) => in_array($r->status, ['queued', 'running', 'analyzing']))->count();
    @endphp

    <div class="category-filter-bar" data-target=".panel">
        <button type="button" class="category-pill active" data-category="all">All ({{ count($runs) }})</button>
        <button type="button" class="category-pill pill-success" data-category="valid">✓ Has Valid Candidates ({{ $validRuns }})</button>
        <button type="button" class="category-pill pill-failed" data-category="failed">✕ Errors / Rejected ({{ $failedRuns }})</button>
        <button type="button" class="category-pill pill-running" data-category="active">⏳ Active ({{ $activeRuns }})</button>
    </div>

    @forelse($runs as $run)
        @php
            $hasValid = ((int)($run->report['valid_candidates'] ?? 0)) > 0;
            $hasErr = (bool)$run->error || (isset($run->report['valid_candidates']) && ((int)$run->report['valid_candidates']) === 0);
            $isAct = in_array($run->status, ['queued', 'running', 'analyzing']);
            $cat = $hasValid ? 'valid' : ($hasErr ? 'failed' : ($isAct ? 'active' : 'all'));
        @endphp
        <article class="run-row" data-status-category="{{ $cat }}">
            <div class="run-title">
                <a href="{{ route('avatars.show', $run) }}">{{ $run->plan['avatar']['name'] ?? $run->avatar_id }} &middot; {{ $run->created_at->timezone('Asia/Manila')->format('M j, Y, g:i A') }}</a>
                <span class="badge {{ $hasValid ? 'good' : ($hasErr ? 'danger' : '') }}">{{ str_replace('_', ' ', $run->status) }}</span>
            </div>

            @if($run->error)
                <div class="failure-box">
                    <div class="failure-box-title">✕ Analysis Error</div>
                    <p class="error-text">{{ $run->error }}</p>
                </div>
            @endif

            <div class="stat-chips">
                <span class="stat-chip">Stage: <strong>{{ $run->report['stage'] ?? 'Queued' }}</strong></span>
                <span class="stat-chip">Candidates: <strong>{{ count($run->report['candidates'] ?? []) }}</strong></span>
                <span class="stat-chip">Technically valid: <strong>{{ $run->report['valid_candidates'] ?? 'Not evaluated' }}</strong></span>
            </div>

            <div class="run-links">
                <a href="{{ route('avatars.show', $run) }}">Compare models &amp; inspect evidence</a>
                <a href="{{ route('avatars.download', $run) }}">Download model JSON</a>
                <code>{{ $run->id }}</code>
            </div>
            @include('evolution.delete-report',['type'=>'enhancement'])
        </article>
    @empty
        <p class="muted">No model generation reports yet.</p>
    @endforelse
</section>

@include('evolution.pagination')
@endsection
