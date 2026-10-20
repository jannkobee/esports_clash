@extends('evolution.layout')
@section('title','3D Generation')
@section('content')
@php
    $references = array_replace($localReferences, $operations['references'] ?? []);
    $names = collect($catalog)->pluck('name', 'id');
    $active = $runs->whereIn('status', \App\Services\TrellisGenerationService::ACTIVE);
    $completedCount = $completedModels->count();
    $refCount = count($references);
@endphp

<div class="page-heading">
    <div>
        <p class="eyebrow">AVATAR CREATION STUDIO</p>
        <h1>3D Generation</h1>
        <p class="muted">Reconstruct high-fidelity 3D humanoid meshes from 2D concept cutouts.</p>
    </div>
    <div style="display:flex;gap:12px;align-items:center;">
        <button type="button" class="quiet" onclick="document.getElementById('modal-generation-settings').showModal()">⚙️ Settings</button>
        <a class="button" href="{{ route('avatars.index') }}">Open 3D Enhancements &rarr;</a>
    </div>
</div>

@if($selectedDesign ?? null)
    <div class="notice">Using the saved appearance prompt from <a href="{{ route('management.edit',['avatar',$selectedDesign]) }}">{{ $selectedDesign->name }} v{{ $selectedDesign->version }}</a> for its concept brief. This only prepares the prompt. Uploading an image and queuing 3D generation remain manual.</div>
@endif

<div class="generation-summary">
    <section class="panel"><span class="eyebrow">ROSTER</span><strong>{{ count($catalog) }}</strong><span>avatars supported</span></section>
    <section class="panel"><span class="eyebrow">REFERENCE IMAGES</span><strong>{{ $refCount }}</strong><span>concept images ready</span></section>
    <section class="panel"><span class="eyebrow">GPU QUEUE</span><strong>{{ $active->count() }}</strong><span>active jobs running</span></section>
    <section class="panel"><span class="eyebrow">GENERATED SOURCES</span><strong>{{ $runs->where('status','generated_unqualified')->count() }}</strong><span>sources in history</span></section>
</div>

{{-- GPU Worker Telemetry Panel --}}
<section class="panel">
    <div class="section-heading">
        <div>
            <h2>Local GPU worker</h2>
            <div class="stat-chips" style="margin-top:6px;">
                @if($operations)
                    <span class="stat-chip">GPU: <strong>{{ $operations['hardware']['gpu'] ?? 'Available' }}</strong></span>
                    <span class="stat-chip">VRAM Free: <strong>{{ number_format($operations['hardware']['gpu_free_mib'] ?? 0) }} MiB</strong></span>
                    <span class="stat-chip">Checkpoints: <strong>{{ ($operations['models']['ready'] ?? false) ? 'Ready' : 'Unavailable' }}</strong></span>
                @else
                    <span class="stat-chip">Status: <strong>Offline</strong></span>
                @endif
            </div>
        </div>
        <span class="badge {{ $operations ? 'good' : 'danger' }}">{{ $operations ? 'Connected' : 'Unavailable' }}</span>
    </div>

    @if($operations)
        @if($operations['last_error'] ?? null)
            <div class="failure-box">
                <div class="failure-box-title">✕ Worker Warning</div>
                <p class="error-text">{{ $operations['last_error'] }}</p>
            </div>
        @endif
        <details class="clean-details">
            <summary>Hardware validation, quantization &amp; pipeline details</summary>
            <div class="clean-details-content fine">
                <p>{{ ($operations['gpu_validated']??false)?'GPU and workflow-node smoke checks passed. Actual generation is reported separately below.':'GPU validation pending. Queued jobs wait until this engine passes its GPU checks.' }}</p>
                <p>Geometry {{ $operations['limits']['quantization']??'Q4_K_M' }} &middot; texture {{ $operations['limits']['texture_quantization']??$operations['limits']['quantization']??'Q4_K_M' }} &middot; {{ $operations['limits']['resolution']??512 }} resolution &middot; low-memory offload. Checkpoint readiness alone does not establish successful inference.</p>
            </div>
        </details>
    @else
        <p class="muted">The GPU worker is offline. Your models and reports are retained. Generation becomes available when it reconnects.</p>
    @endif
</section>

{{-- Avatar Selection Header & Quick Filters --}}
<div class="page-heading" style="margin-top: 32px;">
    <div>
        <h2>Choose an avatar</h2>
        <p class="muted">Filter by generation state or search by character name and role.</p>
    </div>
    <label>Find an avatar<input type="search" id="generation-search" placeholder="Filter by name or role…" autocomplete="off"></label>
</div>

<div class="category-filter-bar" data-target="#generation-roster">
    <button type="button" class="category-pill active" data-category="all">All ({{ count($catalog) }})</button>
    <button type="button" class="category-pill pill-success" data-category="generated">✓ 3D Generated ({{ $completedCount }})</button>
    <button type="button" class="category-pill pill-running" data-category="queued">⏳ Queued / Active ({{ $active->count() }})</button>
    <button type="button" class="category-pill" data-category="has_ref">📷 Has Concept ({{ $refCount - $completedCount }})</button>
    <button type="button" class="category-pill pill-failed" data-category="needs_ref">⚠️ Needs Concept ({{ count($catalog) - $refCount }})</button>
</div>

<p class="fine" id="generation-filter-status" role="status">{{ count($catalog) }} avatars shown</p>
<div class="generation-roster" id="generation-roster">
@foreach($catalog as $avatar)
@php
    $reference = $references[$avatar['id']] ?? null;
    $workerReference = $operations['references'][$avatar['id']] ?? null;
    $pending = $active->firstWhere('avatar_id', $avatar['id']);
    $completed = $completedModels->get($avatar['id']);

    $category = $completed ? 'generated' : ($pending ? 'queued' : ($reference ? 'has_ref' : 'needs_ref'));

    $brief='Create one original full-body '.$avatar['role'].' character named '.$avatar['name'].'. '.($avatar['design']['silhouette']??'').'. Costume: '.($avatar['design']['costume']??'').'. Equipment: '.($avatar['design']['signature']??'').'. Skin '.($avatar['design']['skin']??'').', hair '.($avatar['design']['hair']??'').'. Canonical symmetrical A-pose, arms angled downward at 45 degrees away from torso, hands open with fingers separated, feet shoulder-width apart, upright standing posture, near-frontal eye-level view, entire figure visible from head to toe with generous margins. Polished stylized MOBA character art, clean silhouette, coherent anatomy, attached equipment and weapons resting in hand or sheathed. Plain transparent RGBA background, no floor, no scenery, no detached VFX, no motion blur, no dynamic action pose. Single-image TRELLIS.2 3D mesh reconstruction reference.';
    if (($selectedDesign->source_id ?? null) === $avatar['id'] && !empty($selectedDesign->payload['designBrief']['appearancePrompt'])) {
        $brief=$selectedDesign->payload['designBrief']['appearancePrompt']."\nCanonical symmetrical A-pose, arms angled downward at 45 degrees away from torso, hands open with fingers separated, feet shoulder-width apart, upright standing posture, near-frontal eye-level view, entire figure visible from head to toe with generous margins. Clean silhouette, coherent anatomy and attached equipment. Plain transparent RGBA background, no floor, no scenery, no detached VFX. Preserve identity and primary weapon type. This is a static 3D reconstruction reference, not a skill animation.";
    }
@endphp
@php
    $cardUrl = $completed ? route('trellis.preview', $completed) : route('trellis.avatar', $avatar['id']);
@endphp
<article id="avatar-{{ $avatar['id'] }}" class="panel generation-card" data-search="{{ mb_strtolower($avatar['name'].' '.$avatar['role']) }}" data-status-category="{{ $category }}">
    <a class="generation-art generation-status-link" href="{{ $cardUrl }}" aria-label="{{ $completed ? 'Inspect '.$avatar['name'].' 3D model' : 'View '.$avatar['name'].' 3D status' }}">
        @if($reference)
            <img loading="lazy" src="{{ route('trellis.reference',[$avatar['id'],$reference['sha256']]) }}" alt="{{ $avatar['name'] }} full-body generation reference">
        @else
            <div class="generation-empty">
                <span>{{ mb_substr($avatar['name'],0,1) }}</span>
                <p>Reference image needed</p>
            </div>
        @endif
    </a>

    <div class="run-title" style="margin-top: 14px;">
        <h3><a href="{{ $cardUrl }}">{{ $avatar['name'] }}</a></h3>
        <span class="badge {{ $completed ? 'good' : ($pending ? 'good' : '') }}">{{ $completed ? '3D Generated' : ($pending ? 'Generating' : $avatar['role']) }}</span>
    </div>

    <p class="generation-identity">{{ $avatar['design']['silhouette'] ?? $avatar['motif'] }}</p>

    <div class="stat-chips" style="margin: 8px 0 12px;">
        <span class="stat-chip">Reference: <strong>{{ $reference ? str_replace('-',' ',$reference['provider']) : 'None' }}</strong></span>
        @if($completed)
            <span class="stat-chip"><a href="{{ route('trellis.preview',$completed) }}">Inspect GLB →</a></span>
        @endif
    </div>

    @if($completed)
        @include('evolution.avatars.delete-generated-model',['model'=>$completed])
        <p class="fine">Generation is disabled because this avatar already has a completed GLB. @if(!$completed->trashed())<a href="{{ route('trellis.preview',$completed) }}">Inspect existing model</a> &middot; <a href="{{ route('preparations.index') }}">Asset Preparation</a>. @else Its source report was deleted; its retained asset does not become eligible for another generation. @endif</p>
    @endif

    <form method="post" action="{{ route('trellis.start') }}" class="generation-action">
        @csrf
        <input type="hidden" name="avatar_id" value="{{ $avatar['id'] }}">
        <label>Seed<input type="number" name="seed" min="0" max="2147483647" value="25001" required @disabled($completed)></label>
        <button class="{{ !$completed && $operations && $workerReference && !$pending ? 'primary' : '' }}" @disabled(!$operations||!$workerReference||$pending||$completed)>
            {{ $completed ? '3D model already generated' : ($pending ? 'Already queued' : 'Queue 3D generation') }}
        </button>
    </form>

    <details class="clean-details">
        <summary>Upload image &amp; concept prompt</summary>
        <div class="clean-details-content">
            <p class="fine">This brief is ready for an image generator. An autonomous image provider is not configured; no paid API request is made here.</p>
            <textarea rows="4" readonly aria-label="{{ $avatar['name'] }} concept prompt">{{ $brief }}</textarea>
            <form method="post" enctype="multipart/form-data" action="{{ route('trellis.upload') }}" style="margin-top: 10px;">
                @csrf
                <input type="hidden" name="avatar_id" value="{{ $avatar['id'] }}">
                <input type="hidden" name="prompt" value="{{ $brief }}">
                <label>Transparent full-body PNG (up to 12 MiB)<input type="file" name="reference" accept="image/png" required></label>
                <button style="margin-top: 8px;" @disabled(!$operations)>Save reference image</button>
            </form>
        </div>
    </details>
</article>
@endforeach
</div>

<section class="panel" id="generation-history">
    <div class="section-heading">
        <div>
            <h2>3D generation history</h2>
            <p class="muted">Generated source GLBs awaiting rigging and compatibility qualification.</p>
        </div>
        <form method="post" action="{{ route('avatar-jobs.cancel-all','generation') }}">@csrf<button class="danger">Cancel all generation jobs</button></form>
    </div>
    <div id="live-reports" data-url="{{ route('trellis.live') }}">@include('evolution.avatars.generation-runs')</div>
</section>

<dialog id="modal-generation-settings" class="evolution-modal">
    <div class="modal-dialog-content">
        <div class="modal-header">
            <div>
                <p class="eyebrow">3D GENERATION STUDIO</p>
                <h2>Generation settings &amp; status</h2>
            </div>
            <button type="button" class="modal-close" onclick="this.closest('dialog').close()" aria-label="Close modal">✕</button>
        </div>
        <div class="modal-body">
            <section class="panel" style="margin-bottom:16px;">
                <p class="eyebrow">GPU WORKER TELEMETRY</p>
                <div class="stat-chips">
                    <span class="stat-chip">GPU: <strong>{{ $operations['hardware']['gpu'] ?? 'Available' }}</strong></span>
                    <span class="stat-chip">VRAM Free: <strong>{{ number_format($operations['hardware']['gpu_free_mib'] ?? 0) }} MiB</strong></span>
                    <span class="stat-chip">Checkpoints: <strong>{{ ($operations['models']['ready'] ?? false) ? 'Ready' : 'Unavailable' }}</strong></span>
                    <span class="stat-chip">Quantization: <strong>{{ $operations['limits']['quantization'] ?? 'Q4_K_M' }}</strong></span>
                </div>
                <p class="fine" style="margin-top:10px;">
                    GPU memory offload and quantization parameters are managed by the container profile. When checkpoints or hardware are offline, jobs remain safely queued without loss of assets or reports.
                </p>
            </section>

            <section class="panel">
                <p class="eyebrow">RESOURCE ADMISSION &amp; QUEUE</p>
                <p class="fine">Active generation runs: <strong>{{ $active->count() }}</strong> &middot; Completed sources: <strong>{{ $runs->where('status','generated_unqualified')->count() }}</strong></p>
                <div class="actions" style="margin-top:14px;">
                    <form method="post" action="{{ route('avatar-jobs.cancel-all','generation') }}">
                        @csrf
                        <button class="danger">Cancel all running generation jobs</button>
                    </form>
                </div>
            </section>
        </div>
        <div class="modal-footer">
            <button type="button" onclick="this.closest('dialog').close()">Close</button>
        </div>
    </div>
</dialog>
@endsection
