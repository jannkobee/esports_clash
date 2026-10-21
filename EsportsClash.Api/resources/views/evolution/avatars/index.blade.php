@extends('evolution.layout')
@section('title','3D Enhancements')
@section('content')

@if(!$settings->enabled)
<div class="notice">
    <strong>Live visual evolution paused:</strong> The game defaults to your latest supplied Arsenaldo GLB without auto-generating candidates. Earlier models remain selectable. Existing reports and releases are retained.
</div>
@endif

<div class="actions" style="margin-bottom: 18px;">
    <a href="{{ route('dashboard') }}">← Learning &amp; balance</a>
    <a href="{{ route('trellis.index') }}">Open 3D Generation &amp; reports →</a>
</div>

<div class="page-heading">
    <div>
        <p class="eyebrow">INDEPENDENT VISUAL ENGINE</p>
        <h1>3D Enhancements</h1>
        <p class="muted">Problem-driven model repairs, canary diagnostics, and visual release rollback.</p>
    </div>
    <div style="display:flex;gap:10px;align-items:center;">
        <a class="button quiet" href="{{ route('avatars.reports') }}">View Enhancement Reports &rarr;</a>
        <span class="badge">Manual jobs only</span>
    </div>
</div>

<div class="metrics">
    <article class="metric"><span>Start mode</span><strong>Manual</strong><small>Jobs start strictly on owner request</small></article>
    <article class="metric"><span>Published repairs</span><strong>{{ $releases->count() }}</strong><small>Active &amp; archived visual releases</small></article>
    <article class="metric"><span>Worker RAM</span><strong>{{ $operations?number_format($operations['resources']['anonymous_mib'],0):'—' }} <em>MiB</em></strong><small>{{ $operations?'Worker connected':'Worker unavailable' }}</small></article>
    <article class="metric"><span>Avatar storage</span><strong>{{ $operations?number_format($operations['storage_bytes']/1073741824,2):'—' }} <em>GiB</em></strong><small>{{ $settings->storage_gib }} GiB budget</small></article>
</div>

@include('evolution.avatars.intelligence', ['intelligence' => $operations['asset_intelligence'] ?? null])

<section class="panel">
    <div class="section-heading">
        <div>
            <h2>Analyze current model</h2>
            <p class="muted">Scans for component problems and proposes targeted repair candidates.</p>
        </div>
    </div>
    <form action="{{ route('avatars.start') }}" method="post" class="inline-form">
        @csrf
        <label>Select avatar
            <select name="avatar_id">
                @foreach($catalog as $avatar)
                    <option value="{{ $avatar['id'] }}" @selected($avatar['id']==='c_invoker')>{{ $avatar['name'] }}</option>
                @endforeach
            </select>
        </label>
        <input type="hidden" name="focus" value="balanced">
        <button class="primary">Analyze detected problems</button>
    </form>
</section>

{{-- Art Analysis Cycles List --}}
<section class="panel" id="analysis-cycles">
    <div class="section-heading">
        <div>
            <h2>Art analysis cycles</h2>
            <p class="muted">Evaluated candidates, validation results, and decisions.</p>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
            <a href="{{ route('avatars.reports') }}">All model reports</a>
            <form method="post" action="{{ route('avatar-jobs.cancel-all','enhancement') }}">@csrf<button class="danger">Cancel all</button></form>
        </div>
    </div>

    @php
        $cyclesValid = $runs->filter(fn($r) => ((int)($r->report['valid_candidates'] ?? 0)) > 0)->count();
        $cyclesFailed = $runs->filter(fn($r) => (bool)$r->error)->count();
        $cyclesActive = $runs->filter(fn($r) => in_array($r->status, ['queued', 'running', 'analyzing']))->count();
    @endphp

    <div class="category-filter-bar" data-target="#analysis-cycles">
        <button type="button" class="category-pill active" data-category="all">All Cycles ({{ count($runs) }})</button>
        <button type="button" class="category-pill pill-success" data-category="valid">✓ Has Valid Repairs ({{ $cyclesValid }})</button>
        <button type="button" class="category-pill pill-failed" data-category="failed">✕ Has Issues / Errors ({{ $cyclesFailed }})</button>
        <button type="button" class="category-pill pill-running" data-category="active">⏳ Active ({{ $cyclesActive }})</button>
    </div>

    @forelse($runs as $run)
        @php
            $hasVal = ((int)($run->report['valid_candidates'] ?? 0)) > 0;
            $hasErr = (bool)$run->error;
            $isAct = in_array($run->status, ['queued', 'running', 'analyzing']);
            $cat = $hasVal ? 'valid' : ($hasErr ? 'failed' : ($isAct ? 'active' : 'all'));
        @endphp
        <div class="run-row" data-status-category="{{ $cat }}">
            <div class="run-title">
                <a href="{{ route('avatars.show',$run) }}">{{ $run->plan['avatar']['name'] }} · {{ $run->created_at->timezone('Asia/Manila')->format('M j, g:i A') }}</a>
                <span class="badge {{ $hasVal ? 'good' : ($hasErr ? 'danger' : '') }}">{{ str_replace('_',' ',$run->status) }}</span>
            </div>

            @if($run->error)
                <div class="failure-box">
                    <div class="failure-box-title">✕ Analysis Error</div>
                    <p class="error-text">{{ $run->error }}</p>
                </div>
            @endif

            <div class="stat-chips">
                <span class="stat-chip">Stage: <strong>{{ $run->report['stage'] ?? 'Queued' }}</strong></span>
                <span class="stat-chip">Candidates collected: <strong>{{ count($run->report['candidates'] ?? []) }}</strong></span>
                <span class="stat-chip">Technically valid: <strong>{{ $run->report['valid_candidates'] ?? '—' }}</strong></span>
            </div>

            @include('evolution.avatars.cancel',['type'=>'enhancement'])
        </div>
    @empty
        <p class="muted">The scheduler will create the first Arsenaldo cycle automatically.</p>
    @endforelse
</section>

{{-- Published Visual History & Rollback --}}
<section class="panel">
    <div class="section-heading">
        <div>
            <h2>Published visual history &amp; rollback</h2>
            <p class="muted">Runtime releases, canary health verification, and rollback controls.</p>
        </div>
    </div>
    @forelse($releases as $release)
        <div class="run-row">
            <div class="run-title">
                <strong>{{ $release->avatar_id }} · V{{ $release->version }}</strong>
                <span class="badge {{ $release->active ? 'good' : '' }}">{{ $release->active ? 'Active for new scenes' : 'Archived' }} &middot; {{ $release->health_status }}</span>
            </div>
            <div class="stat-chips">
                <span class="stat-chip">SHA-256: <code>{{ substr($release->sha256, 0, 16) }}…</code></span>
                <span class="stat-chip">Health: <strong>{{ $release->health_status }}</strong></span>
            </div>
            <p class="fine">{{ $release->rollback_reason ?? 'Runtime canary checks model loading, animation, shaders and local frame cost.' }}</p>
            <form method="post" action="{{ route('avatars.rollback') }}">
                @csrf
                <input type="hidden" name="avatar_id" value="{{ $release->avatar_id }}">
                <input type="hidden" name="release_id" value="{{ $release->id }}">
                <button class="danger" @disabled($release->active || $release->quarantined_at)>Roll back to this version</button>
            </form>
        </div>
    @empty
        <p class="muted">No automatic visual version has been published. The shipped originals remain active.</p>
    @endforelse
</section>
@endsection
