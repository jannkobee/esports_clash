@extends('evolution.layout')
@section('title', 'Model reports')
@section('content')
<div class="page-heading"><div><p class="eyebrow">AVATAR MODEL EVOLUTION</p><h1>Model reports</h1><p class="muted">Geometry, animation, ability presentation, technical validation and owner decisions.</p></div><a class="button" href="{{ route('avatars.index') }}">Model controls</a></div>
<div class="metrics report-metrics">
    <article class="metric"><span>Model cycles</span><strong>{{ $runCount }}</strong></article>
    <article class="metric"><span>Awaiting design review</span><strong>{{ $reviewCount }}</strong></article>
    <article class="metric"><span>Published visual versions</span><strong>{{ $releaseCount }}</strong></article>
</div>
<section class="panel"><h2>Model generation reports</h2>
@forelse($runs as $run)
    <article class="run-row">
        <div class="run-title"><a href="{{ route('avatars.show', $run) }}">{{ $run->plan['avatar']['name'] ?? $run->avatar_id }} &middot; {{ $run->created_at->timezone('Asia/Manila')->format('M j, Y, g:i A') }}</a><span class="badge">{{ str_replace('_', ' ', $run->status) }}</span></div>
        <p class="fine">{{ $run->report['stage'] ?? 'Queued' }} &middot; {{ count($run->report['candidates'] ?? []) }} candidates &middot; {{ $run->report['valid_candidates'] ?? 'Not evaluated' }} technically valid</p>
        @if($run->error)<p class="error-text">{{ $run->error }}</p>@endif
        <div class="run-links"><a href="{{ route('avatars.show', $run) }}">Compare models &amp; review evidence</a><a href="{{ route('avatars.download', $run) }}">Download model JSON</a><code>{{ $run->id }}</code></div>
    </article>
@empty<p class="muted">No model generation reports yet.</p>@endforelse
</section>
@include('evolution.pagination')
@endsection
