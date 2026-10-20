@php
    $generatedCount = $runs->filter(fn($r) => $r->status === 'generated_unqualified')->count();
    $failedGenCount = $runs->filter(fn($r) => (bool)$r->error || in_array($r->status, ['failed', 'cancelled']))->count();
    $activeGenCount = $runs->filter(fn($r) => in_array($r->status, ['generating', 'waiting_resources', 'queued']))->count();
@endphp

<div class="category-filter-bar" data-target="#live-reports">
    <button type="button" class="category-pill active" data-category="all">All Generations <span class="category-count">{{ count($runs) }}</span></button>
    <button type="button" class="category-pill pill-success" data-category="generated">✓ Generated Sources <span class="category-count">{{ $generatedCount }}</span></button>
    <button type="button" class="category-pill pill-failed" data-category="failed">✕ Failed <span class="category-count">{{ $failedGenCount }}</span></button>
    <button type="button" class="category-pill pill-running" data-category="active">⏳ Active / Queued <span class="category-count">{{ $activeGenCount }}</span></button>
</div>

@forelse($runs as $run)
@php
    $progress = $run->state['node_progress'] ?? $run->state['sampler_progress'] ?? [];
    $isSuccess = ($run->status === 'generated_unqualified');
    $isFailed = (bool)$run->error || in_array($run->status, ['failed', 'cancelled']);
    $isActive = in_array($run->status, ['generating', 'waiting_resources', 'queued']);
    $category = $isSuccess ? 'generated' : ($isFailed ? 'failed' : ($isActive ? 'active' : 'all'));
@endphp
<article class="run-row" data-status-category="{{ $category }}">
    <div class="run-title">
        <strong>{{ $names[$run->avatar_id] ?? $run->avatar_id }} &middot; {{ $run->created_at->timezone('Asia/Manila')->format('M j, g:i A') }}</strong>
        <span class="badge {{ $isSuccess ? 'good' : ($isFailed ? 'danger' : '') }}">{{ str_replace('_',' ',$run->status) }}</span>
    </div>

    {{-- Categorized Outcome --}}
    @if($run->error)
        <div class="failure-box">
            <div class="failure-box-title">✕ Generation Error</div>
            <p class="error-text">{{ \Illuminate\Support\Str::limit($run->error, 2000) }}</p>
        </div>
    @elseif($isSuccess)
        <div class="success-box">
            <div class="success-box-title">✓ 3D Mesh &amp; Texture Reconstructed</div>
            <p class="fine">Raw textured 3D source created from concept image. Ready for UniRig skeleton &amp; native animation preparation.</p>
        </div>
    @else
        <p class="fine" style="margin: 8px 0;"><strong>Stage:</strong> {{ $run->state['stage'] ?? 'Waiting in GPU queue' }} @if(isset($progress['value']))&middot; Node progress {{ $progress['value'] }}/{{ $progress['max']??'?' }}@endif</p>
    @endif

    {{-- Stat Chips --}}
    <div class="stat-chips">
        <span class="stat-chip">Execution: <code>{{ $run->state['prompt_id'] ?? 'Not submitted yet' }}</code></span>
        <span class="stat-chip">Seed: <strong>{{ $run->plan['seed'] ?? '—' }}</strong></span>
        @if(isset($progress['value']))
            <span class="stat-chip">Progress: <strong>{{ $progress['value'] }}/{{ $progress['max'] ?? '?' }}</strong></span>
        @endif
        @if(isset($run->state['sampled_peaks']))
            <span class="stat-chip">Worker RAM: <strong>{{ number_format($run->state['sampled_peaks']['worker_anonymous_mib'] ?? 0, 0) }} MiB</strong></span>
            <span class="stat-chip">VRAM: <strong>{{ number_format($run->state['sampled_peaks']['gpu_used_mib'] ?? 0, 0) }} MiB</strong></span>
        @endif
    </div>

    @if($run->status==='waiting_resources' && isset($run->state['resources']))
        <p class="fine">Available: {{ number_format($run->state['resources']['vm_available_mib']??0) }} MiB VM RAM &middot; {{ number_format($run->state['resources']['gpu_free_mib']??0) }} MiB GPU memory. Waiting for the configured admission headroom.</p>
    @endif
    @if(isset($run->state['reason']))
        <p class="fine">{{ $run->state['reason'] }}</p>
    @endif

    <div class="run-links">
        @if(isset($run->plan['reference_sha256']))
            <a href="{{ route('trellis.reference',[$run->avatar_id,$run->plan['reference_sha256']]) }}">Input image</a>
        @endif
        <a href="{{ route('trellis.report',$run) }}">Generation report</a>
        @if($run->status==='generated_unqualified')
            <a href="{{ route('trellis.preview',$run) }}">Inspect 3D source</a>
            <a href="{{ route('trellis.asset',$run) }}">Download generated GLB</a>
            <a href="{{ route('preparations.index',['generation'=>$run->id]) }}">Prepare rig and animations</a>
        @endif
    </div>

    @if($run->status==='generated_unqualified')
        @include('evolution.avatars.delete-generated-model',['model'=>$run])
    @endif
    @include('evolution.avatars.cancel',['type'=>'generation'])
    @include('evolution.delete-report',['type'=>'generation'])
</article>
@empty
    <p class="muted">{{ $emptyMessage??'No visible generation reports. Choose an avatar with a reference image to begin.' }}</p>
@endforelse
