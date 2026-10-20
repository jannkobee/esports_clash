@extends('evolution.layout')
@section('title','3D Generation')
@section('content')
@php
    $references = $assetReferences;
    $names = collect($catalog)->pluck('name','id');
    $active = $activeRuns;
    $counts = ['generated'=>0,'queued'=>0,'has_ref'=>0,'needs_ref'=>0];
    foreach($catalog as $entry) {
        $category=$active->contains('avatar_id',$entry['id']) ? 'queued' : ($completedModels->has($entry['id']) ? 'generated' : (isset($references[$entry['id']]) ? 'has_ref' : 'needs_ref'));
        $counts[$category]++;
    }
@endphp
<div class="page-heading studio-heading">
    <div><p class="eyebrow">AVATAR ASSET STUDIO</p><h1>3D Generation</h1><p class="muted">From a clean body reference to a game-ready avatar, one step at a time.</p></div>
    <div class="actions"><button type="button" class="quiet" onclick="document.getElementById('modal-generation-settings').showModal()">Worker details</button><a class="button" href="{{ route('preparations.index') }}">Asset Preparation &rarr;</a><a href="{{ route('avatars.index') }}">3D Enhancements</a></div>
</div>
@if($selectedDesign ?? null)
<section class="panel"><p class="eyebrow">SAVED APPEARANCE BRIEF</p><h2>{{ $selectedDesign->name }} <span class="muted">v{{ $selectedDesign->version }}</span></h2><p>{{ $selectedDesign->payload['designBrief']['appearancePrompt']??'' }}</p><p class="fine">This only prepares the prompt. Uploading assets and generating a model remain manual.</p><a class="button" href="{{ route('trellis.avatar',[$selectedDesign->source_id,'design'=>$selectedDesign->id]) }}#asset-prompts">Open studio with this brief &rarr;</a></section>
@endif
<div class="studio-overview">
    <div><span class="eyebrow">THE WORKFLOW</span><h2>Body first. Equipment optional.</h2><p class="muted">Upload a neutral T-pose PNG with empty hands. Add separate equipment for either hand, generate a 3D source, then prepare its rig and animations.</p></div>
    <ol class="studio-workflow"><li><span>01</span><div><strong>Prepare assets</strong><p>Prompts, body &amp; optional weapons</p></div></li><li><span>02</span><div><strong>Generate a source</strong><p>Local TRELLIS.2 reconstruction</p></div></li><li><span>03</span><div><strong>Rig &amp; review</strong><p>Qualify before live use</p></div></li></ol>
</div>
<div class="studio-stats"><div><strong>{{ count($catalog) }}</strong><span>Avatars</span></div><div><strong>{{ count($references) }}</strong><span>Body references</span></div><div><strong>{{ $completedModels->count() }}</strong><span>Avatars with models</span></div><div><strong>{{ $active->count() }}</strong><span>Active jobs</span></div><div class="studio-worker"><span class="status-led {{ $operations ? 'green' : '' }}"></span><span>{{ $operations ? 'Local worker connected' : 'Local worker offline' }}<small>{{ $operations['hardware']['gpu'] ?? 'You can still manage source assets' }}</small></span></div></div>
@if($operations['last_error'] ?? null)<div class="notice error" role="alert">Worker: {{ $operations['last_error'] }}</div>@endif
<div class="page-heading roster-heading"><div><h2>Choose an avatar</h2><p class="muted">One studio for its models, assets, prompts and jobs.</p></div></div>
<div class="collection-toolbar" data-list-controls="#generation-roster">
    <label class="collection-search">Search avatars<input type="search" id="generation-search" data-list-search placeholder="Name or role" autocomplete="off"></label>
    <label>Role<select data-list-filter="role"><option value="">All roles</option>@foreach(collect($catalog)->pluck('role')->unique()->sort() as $role)<option value="{{ $role }}">{{ $role }}</option>@endforeach</select></label>
    <label>Equipment<select data-list-filter="equipment"><option value="">All equipment</option><option value="custom">Custom assets</option><option value="default">Default / unarmed</option></select></label>
    <label>Sort by<select data-list-sort><option value="name">Name: A to Z</option><option value="name-desc">Name: Z to A</option><option value="role">Role, then name</option></select></label>
    <button type="button" class="quiet" data-list-reset>Reset filters</button>
</div>
<div class="category-filter-bar" data-target="#generation-roster">
    <button type="button" class="category-pill active" data-category="all">All ({{ count($catalog) }})</button>
    <button type="button" class="category-pill" data-category="has_ref">Ready for generation ({{ $counts['has_ref'] }})</button>
    <button type="button" class="category-pill pill-running" data-category="queued">In progress ({{ $counts['queued'] }})</button>
    <button type="button" class="category-pill pill-success" data-category="generated">Has 3D model ({{ $counts['generated'] }})</button>
    <button type="button" class="category-pill" data-category="needs_ref">Needs body ({{ $counts['needs_ref'] }})</button>
</div>
<p class="fine" id="generation-filter-status" role="status">{{ count($catalog) }} avatars shown</p>
<div class="generation-roster studio-roster" id="generation-roster">
@foreach($catalog as $avatar)
@php
    $reference=$references[$avatar['id']]??null;
    $equipment=$weaponReferences[$avatar['id']]??[];
    $pending=$active->firstWhere('avatar_id',$avatar['id']);
    $completed=$completedModels->get($avatar['id']);
    $category=$pending ? 'queued' : ($completed ? 'generated' : ($reference ? 'has_ref' : 'needs_ref'));
    $labels=['queued'=>'In progress','generated'=>'3D source available','has_ref'=>'Body uploaded','needs_ref'=>'Needs body reference'];
    $cardUrl=route('trellis.avatar',$avatar['id']);
@endphp
<article id="avatar-{{ $avatar['id'] }}" class="panel generation-card studio-avatar-card" data-name="{{ $avatar['name'] }}" data-role="{{ $avatar['role'] }}" data-equipment="{{ !empty($equipment['has_custom_asset']) ? 'custom' : 'default' }}" data-search="{{ mb_strtolower($avatar['name'].' '.$avatar['role']) }}" data-status-category="{{ $category }}">
    <a class="studio-avatar-art" href="{{ $cardUrl }}" aria-label="View {{ $avatar['name'] }} 3D status">
        @if($reference)<img loading="lazy" src="{{ route('trellis.reference',[$avatar['id'],$reference['sha256']]) }}" alt="{{ $avatar['name'] }} body reference">@else<div class="asset-placeholder"><span aria-hidden="true">T</span><strong>Body reference needed</strong></div>@endif
        <span class="badge {{ $completed ? 'good' : '' }}">{{ $avatar['role'] }}</span>
    </a>
    <div class="studio-avatar-content"><div class="run-title"><h3><a href="{{ $cardUrl }}">{{ $avatar['name'] }}</a></h3><span class="studio-state state-{{ $category }}">{{ $labels[$category] }}</span></div>
        <p class="generation-identity">{{ $avatar['design']['silhouette']??$avatar['motif']??'' }}</p>
        <p class="studio-costume">{{ $avatar['design']['costume']??'Stylized MOBA character' }}</p>
        <div class="studio-equipment">@foreach(['primary'=>'Right','secondary'=>'Left'] as $slot=>$label)<span><strong>{{ $label }}</strong> {{ !empty($equipment[$slot]['has_custom_asset']) ? (str_ends_with($equipment[$slot]['filename']??'','.png') ? 'PNG reference' : '3D file') : 'Default / unarmed' }}</span>@endforeach</div>
        <a class="button studio-open" href="{{ $cardUrl }}">Open avatar studio &rarr;</a>
    </div>
</article>
@endforeach
</div>
<section class="panel" id="generation-history"><div class="section-heading"><div><h2>Generation history</h2><p class="muted">Oldest to newest. Deleting a report keeps its model.</p></div><p class="fine" id="live-status">Status refreshes every 10 seconds.</p></div>@include('evolution.avatars.report-toolbar')<div id="live-reports" data-url="{{ route('trellis.live') }}">@include('evolution.avatars.generation-runs')</div></section>
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
