@extends('evolution.layout')
@section('title','Avatar candidates')
@section('content')
@include('evolution.delete-report',['type'=>'enhancement'])
<div class="actions"><a href="{{ route('avatars.reports') }}">All model reports</a><a href="{{ route('avatars.download', $run) }}">Download model JSON</a></div>
<a href="{{ route('avatars.index') }}">← Avatar Evolution</a>

<div class="page-heading">
    <div>
        <p class="eyebrow">AUTOMATED DESIGN DIAGNOSTICS</p>
        <h1>{{ $run->plan['avatar']['name'] }} candidates</h1>
        <p class="muted">{{ $run->status }} · {{ $run->report['stage']??'Queued' }}</p>
    </div>
    <code>{{ $run->id }}</code>
</div>

@if(($run->plan['version']??1)===1)<p class="notice">Historical manual-era experiment. Its recorded state and artifacts remain intact; it cannot be automatically published.</p>@endif
@if($run->artifacts_deleted_at)<p class="notice">Unreferenced temporary files were retired under retention policy. The immutable JSON report remains available.</p>@endif
@if(in_array($run->status,['queued','running','paused_resource','complete']))<p class="notice">This generation is running independently. Refresh to inspect new evidence. It continues when this page closes.</p><script>setTimeout(()=>location.reload(),20000);</script>@endif
@include('evolution.avatars.cancel',['type'=>'enhancement'])

@if($run->error)
    <div class="failure-box">
        <div class="failure-box-title">✕ Run Diagnostic Error</div>
        <p class="error-text">{{ $run->error }}</p>
    </div>
@endif

{{-- Baseline Panel --}}
@if(isset($run->report['baseline']))
<section class="panel">
    <h2>Before: current visual version</h2>
    <iframe title="Current avatar and animation preview" src="{{ route('avatars.viewer',['path'=>'avatar-review.html']) }}?run={{ $run->id }}&amp;avatar={{ $run->avatar_id }}&amp;candidate=baseline" class="avatar-frame" loading="lazy"></iframe>
    <div class="avatar-plates">
        @foreach($run->report['baseline']['render']['previews'] as $preview)
            <a href="{{ route('avatars.file',[$run->id,$preview['file']]) }}">
                <img src="{{ route('avatars.file',[$run->id,$preview['file']]) }}" alt="Original {{ $preview['name'] }}" loading="lazy">
                <span>{{ $preview['name'] }}</span>
            </a>
        @endforeach
    </div>
    <div class="actions">
        <a href="{{ route('avatars.file',[$run->id,'baseline.blend']) }}">Download editable baseline Blender scene</a>
    </div>
</section>
@endif

{{-- Detected Issues & Decisions Folded Cleanly --}}
@if(isset($run->report['art_analysis']))
<section class="panel">
    <h2>Detected component problems</h2>
    <p class="muted">{{ $run->report['stop_reason'] ?? 'Analysis is in progress.' }}</p>
    <details class="clean-details">
        <summary>View raw art analysis findings</summary>
        <div class="clean-details-content">
            <pre>{{ json_encode($run->report['art_analysis'],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES) }}</pre>
        </div>
    </details>
</section>
@endif

@if($run->decisions)
<section class="panel">
    <h2>Automatic decision</h2>
    <details class="clean-details" open>
        <summary>System decision breakdown</summary>
        <div class="clean-details-content">
            <pre>{{ json_encode($run->decisions,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES) }}</pre>
        </div>
    </details>
</section>
@endif

{{-- Candidate Breakdown --}}
@foreach($run->report['candidates']??[] as $candidate)
@php
    $decision = $run->decisions[$candidate['id']] ?? null;
    $passed = (bool)($candidate['validation']['passed'] ?? false);
    $issues = $candidate['validation']['issues'] ?? [];
@endphp
<section class="panel">
    <div class="section-heading">
        <h2>{{ ucfirst($candidate['recipe']) }} · {{ $candidate['id'] }}</h2>
        <span class="badge {{ $passed ? 'good' : 'danger' }}">{{ $decision['action'] ?? $candidate['status'] }}</span>
    </div>

    {{-- Categorized What Succeeded vs What Failed --}}
    @if($passed)
        <div class="success-box">
            <div class="success-box-title">✓ Technical validation: Passed</div>
            <p class="fine">All deformation, hitbox and runtime geometry constraints satisfied.</p>
        </div>
    @else
        <div class="failure-box">
            <div class="failure-box-title">✕ Technical validation: Rejected ({{ count($issues) }} issues)</div>
            @if(!empty($issues))
                <ul class="failure-list">
                    @foreach($issues as $issue)
                        <li>{{ $issue }}</li>
                    @endforeach
                </ul>
            @endif
        </div>
    @endif

    <div class="stat-chips">
        <span class="stat-chip">Technical rank: <strong>{{ $candidate['technical_rank'] ?? '—' }}</strong></span>
        <span class="stat-chip">Generation: <strong>{{ $candidate['generation'] }}</strong></span>
        <span class="stat-chip">Explanation: <strong>{{ $candidate['rank_explanation'] ?? 'Validation did not complete' }}</strong></span>
    </div>

    @if(isset($candidate['render']['previews']))
        <div class="proposal-grid" style="margin: 18px 0;">
            <div>
                <p class="fine">Before: current visual version</p>
                <iframe title="Baseline for {{ $candidate['id'] }}" src="{{ route('avatars.viewer',['path'=>'avatar-review.html']) }}?run={{ $run->id }}&amp;avatar={{ $run->avatar_id }}&amp;candidate=baseline" class="avatar-frame" loading="lazy"></iframe>
            </div>
            <div>
                <p class="fine">After: candidate</p>
                <iframe title="{{ $candidate['id'] }} model and animation preview" src="{{ route('avatars.viewer',['path'=>'avatar-review.html']) }}?run={{ $run->id }}&amp;avatar={{ $run->avatar_id }}&amp;candidate={{ $candidate['id'] }}" class="avatar-frame" loading="lazy"></iframe>
            </div>
        </div>
        <div class="avatar-plates">
            @foreach($candidate['render']['previews'] as $preview)
                <a href="{{ route('avatars.file',[$run->id,$preview['file']]) }}">
                    <img src="{{ route('avatars.file',[$run->id,$preview['file']]) }}" alt="Candidate {{ $preview['name'] }}" loading="lazy">
                    <span>{{ $preview['name'] }}</span>
                </a>
            @endforeach
        </div>
    @endif

    @if(isset($candidate['improvement']['meaning']))
        <p class="fine">{{ $candidate['improvement']['meaning'] }}</p>
    @endif
    @foreach($candidate['improvement']['reasons']??[] as $reason)
        <p class="fine">Retain current: {{ $reason }}</p>
    @endforeach

    <p style="display:none">Technical validation: <strong>{{ $candidate['validation']['passed']?'Passed':'Rejected' }}</strong></p>
    @foreach($candidate['validation']['issues'] as $issue)
        <p class="error-text" style="display:none">{{ $issue }}</p>
    @endforeach

    <details class="clean-details">
        <summary>Actual geometry, material and animation changes</summary>
        <div class="clean-details-content">
            <ul class="fine">
                @foreach($candidate['changes']??[] as $change)
                    <li>{{ $change['kind'] }} · {{ $change['part']??$change['clip']??('material '.($change['index']??'')) }} · {{ $change['reason'] }}</li>
                @endforeach
            </ul>
        </div>
    </details>

    <details class="clean-details">
        <summary>Measured technical evidence &amp; raw metrics</summary>
        <div class="clean-details-content">
            <pre>{{ json_encode(['validation'=>$candidate['validation'],'render'=>$candidate['render'],'blender'=>$candidate['blender']??null],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES) }}</pre>
        </div>
    </details>

    @if(isset($candidate['sha256']))
        <div class="actions">
            <a href="{{ route('avatars.file',[$run->id,$candidate['file']]) }}">Download candidate GLB</a>
            <a href="{{ route('avatars.file',[$run->id,str_replace('.glb','.blend',$candidate['file'])]) }}">Editable Blender scene</a>
        </div>
    @endif
</section>
@endforeach

<section class="panel">
    <h2>Analyze again or restore</h2>
    <div class="actions">
        <form method="post" action="{{ route('avatars.regenerate',$run) }}" class="inline-form">
            @csrf
            <input type="hidden" name="focus" value="balanced">
            <button>Analyze current visual problems</button>
        </form>
        <form method="post" action="{{ route('avatars.rollback') }}">
            @csrf
            <input type="hidden" name="avatar_id" value="{{ $run->avatar_id }}">
            <button class="danger">Restore shipped original (V1)</button>
        </form>
    </div>
</section>

<section class="panel">
    <details class="clean-details">
        <summary>Visual analysis and immutable execution plan</summary>
        <div class="clean-details-content">
            <pre>{{ json_encode(['plan'=>$run->plan,'analysis'=>$run->report['analysis']??null,'manifest_hash'=>$run->manifest_hash],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES) }}</pre>
        </div>
    </details>
</section>
@endsection
