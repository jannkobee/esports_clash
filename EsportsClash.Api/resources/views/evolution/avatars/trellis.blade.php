@extends('evolution.layout')
@section('title','3D Generation Studio')
@section('content')
@php
    $references = $assetReferences;
    $names = collect($catalog)->pluck('name','id');
    $active = $activeRuns;
    $counts = ['generated'=>0,'queued'=>0,'has_ref'=>0,'needs_ref'=>0];
    $suiteCounts = ['avatar'=>0,'environment'=>0,'structure'=>0,'creep'=>0];
    foreach($catalog as $entry) {
        $suite = $entry['category'] ?? 'avatar';
        if (isset($suiteCounts[$suite])) $suiteCounts[$suite]++;
        $category=$active->contains('avatar_id',$entry['id']) ? 'queued' : ($completedModels->has($entry['id']) ? 'generated' : (isset($references[$entry['id']]) ? 'has_ref' : 'needs_ref'));
        $counts[$category]++;
    }
@endphp
<div class="page-heading studio-heading">
    <div><p class="eyebrow">GAME ASSET 3D STUDIO</p><h1>3D Generation Studio</h1><p class="muted">Generate game-ready 3D models for champions, arena environment (rocks, trees, river frogs), defensive towers, and lane creeps.</p></div>
    <div class="actions"><button type="button" class="quiet" onclick="document.getElementById('modal-generation-settings').showModal()">Worker details</button><a class="button" href="{{ route('preparations.index') }}">Asset Preparation &rarr;</a><a href="{{ route('avatars.index') }}">3D Enhancements</a></div>
</div>
@if($selectedDesign ?? null)
<section class="panel"><p class="eyebrow">SAVED APPEARANCE BRIEF</p><h2>{{ $selectedDesign->name }} <span class="muted">v{{ $selectedDesign->version }}</span></h2><p>{{ $selectedDesign->payload['designBrief']['appearancePrompt']??'' }}</p><p class="fine">This only prepares the prompt. Uploading assets and generating a model remain manual.</p><a class="button" href="{{ route('trellis.avatar',[$selectedDesign->source_id,'design'=>$selectedDesign->id]) }}#asset-prompts">Open studio with this brief &rarr;</a></section>
@endif
<div class="studio-overview">
    <div><span class="eyebrow">3D PIPELINE</span><h2>Champions, Battlefield Environment &amp; Combat Units</h2><p class="muted">Upload concept references or generate new 3D assets via TRELLIS.2. Map props (rocks, trees, wildlife), defense structures (towers, barracks, nexus), and lane minions/creeps generate as game-ready placement meshes.</p></div>
    <ol class="studio-workflow"><li><span>01</span><div><strong>Select &amp; Prompt</strong><p>Briefs &amp; reference art</p></div></li><li><span>02</span><div><strong>TRELLIS.2 Generate</strong><p>Google Colab / Cloud compute</p></div></li><li><span>03</span><div><strong>Inspect &amp; Export</strong><p>360&deg; viewer, wireframe &amp; GLB</p></div></li></ol>
</div>
<div class="studio-stats">
    <div><strong>{{ count($catalog) }}</strong><span>Total Assets</span></div>
    <div><strong>{{ $suiteCounts['environment'] ?? 0 }}</strong><span>Map Environment</span></div>
    <div><strong>{{ $suiteCounts['structure'] ?? 0 }}</strong><span>Towers &amp; Nexus</span></div>
    <div><strong>{{ $suiteCounts['creep'] ?? 0 }}</strong><span>Creeps &amp; Bosses</span></div>
    <div><strong>{{ $suiteCounts['avatar'] ?? 0 }}</strong><span>Champions</span></div>
    <div><strong>{{ $completedModels->count() }}</strong><span>Models Ready</span></div>
    <div><strong>{{ $active->count() }}</strong><span>Active Jobs</span></div>
    <div class="studio-worker"><span class="status-led {{ ($operations['models']['ready'] ?? false) ? 'green' : '' }}"></span><span>{{ ($operations['models']['ready']??false) ? (($operations['provider']??null)==='google-colab' ? 'Google TRELLIS.2 ready' : 'Local TRELLIS.2 ready') : 'TRELLIS.2 setup needed' }}<small>{{ $operations['hardware']['gpu'] ?? 'You can still manage source assets' }}</small></span></div>
</div>
@if($operations['last_error'] ?? null)<div class="notice error" role="alert">Worker: {{ $operations['last_error'] }}</div>@endif
<section class="panel generation-controls" id="generate"><div class="section-heading"><div><h2>Generation compute</h2><p class="muted">Choose where new 3D generation jobs run.</p></div></div>@include('evolution.avatars.compute-controls')</section>
@include('evolution.avatars.pipeline-readiness')
<div class="page-heading roster-heading"><div><h2>Choose an asset to inspect or generate</h2><p class="muted">Select from champions, map environment, defense towers, or creeps.</p></div></div>
<div class="collection-toolbar" data-list-controls="#generation-roster">
    <label class="collection-search">Search assets<input type="search" id="generation-search" data-list-search placeholder="Name, role or keyword (e.g. frog, rock, turret)" autocomplete="off"></label>
    <label>Category<select data-list-filter="category"><option value="">All categories ({{ count($catalog) }})</option><option value="environment">Map Environment ({{ $suiteCounts['environment'] ?? 0 }})</option><option value="structure">Structures &amp; Towers ({{ $suiteCounts['structure'] ?? 0 }})</option><option value="creep">Creeps &amp; Monsters ({{ $suiteCounts['creep'] ?? 0 }})</option><option value="avatar">Champions ({{ $suiteCounts['avatar'] ?? 0 }})</option></select></label>
    <label>Equipment<select data-list-filter="equipment"><option value="">All equipment</option><option value="custom">Custom equipment</option><option value="default">Default / unarmed</option></select></label>
    <label>Role<select data-list-filter="role"><option value="">All roles</option>@foreach(collect($catalog)->pluck('role')->unique()->sort() as $role)<option value="{{ $role }}">{{ $role }}</option>@endforeach</select></label>
    <label>Sort by<select data-list-sort><option value="name">Name: A to Z</option><option value="name-desc">Name: Z to A</option><option value="role">Role, then name</option></select></label>
    <button type="button" class="quiet" data-list-reset>Reset filters</button>
</div>
<div class="category-filter-bar" data-target="#generation-roster">
    <button type="button" class="category-pill active" data-category="all">All ({{ count($catalog) }})</button>
    <button type="button" class="category-pill" data-category="has_ref">Ready for generation ({{ $counts['has_ref'] }})</button>
    <button type="button" class="category-pill pill-running" data-category="queued">In progress ({{ $counts['queued'] }})</button>
    <button type="button" class="category-pill pill-success" data-category="generated">Has 3D model ({{ $counts['generated'] }})</button>
    <button type="button" class="category-pill" data-category="needs_ref">Needs reference ({{ $counts['needs_ref'] }})</button>
</div>
<p class="fine" id="generation-filter-status" role="status">{{ count($catalog) }} assets shown</p>
<div class="generation-roster studio-roster" id="generation-roster">
@foreach($catalog as $avatar)
@php
    $reference=$references[$avatar['id']]??null;
    $equipment=$weaponReferences[$avatar['id']]??[];
    $pending=$active->firstWhere('avatar_id',$avatar['id']);
    $completed=$completedModels->get($avatar['id']);
    $category=$pending ? 'queued' : ($completed ? 'generated' : ($reference ? 'has_ref' : 'needs_ref'));
    $labels=['queued'=>'In progress','generated'=>'3D model available','has_ref'=>'Reference ready','needs_ref'=>'Needs reference image'];
    $cardUrl=route('trellis.avatar',$avatar['id']);
    $isAvatar=($avatar['category'] ?? 'avatar') === 'avatar';
    $icon=$avatar['icon'] ?? ($isAvatar ? '👑' : '📦');
@endphp
<article id="avatar-{{ $avatar['id'] }}" class="panel generation-card studio-avatar-card" data-name="{{ $avatar['name'] }}" data-role="{{ $avatar['role'] }}" data-category="{{ $avatar['category'] ?? 'avatar' }}" data-equipment="{{ !empty($equipment['has_custom_asset']) ? 'custom' : 'default' }}" data-search="{{ mb_strtolower($avatar['name'].' '.$avatar['role'].' '.($avatar['category_label']??'').' '.($avatar['subcategory']??'').' '.($avatar['motif']??'')) }}" data-status-category="{{ $category }}">
    <a class="studio-avatar-art" href="{{ $cardUrl }}" aria-label="View {{ $avatar['name'] }} 3D status">
        @if($reference)<img loading="lazy" src="{{ route('trellis.reference',[$avatar['id'],$reference['sha256']]) }}" alt="{{ $avatar['name'] }} reference">@else<div class="asset-placeholder"><span aria-hidden="true">{{ $icon }}</span><strong>Reference needed</strong></div>@endif
        <span class="badge {{ $completed ? 'good' : '' }}">{{ $icon }} {{ $avatar['role'] }}</span>
    </a>
    <div class="studio-avatar-content"><div class="run-title"><h3><a href="{{ $cardUrl }}">{{ $avatar['name'] }}</a></h3><span class="studio-state state-{{ $category }}">{{ $labels[$category] }}</span></div>
        <p class="generation-identity">{{ $avatar['design']['silhouette'] ?? $avatar['silhouette'] ?? $avatar['motif'] ?? '' }}</p>
        <p class="studio-costume">{{ $avatar['design']['costume'] ?? $avatar['costume'] ?? $avatar['description'] ?? 'Stylized MOBA game asset' }}</p>
        @if($isAvatar)
            <div class="studio-equipment">@foreach(['primary'=>'Right','secondary'=>'Left'] as $slot=>$label)<span><strong>{{ $label }}</strong> {{ !empty($equipment[$slot]['has_custom_asset']) ? (str_ends_with($equipment[$slot]['filename']??'','.png') ? 'PNG reference' : '3D file') : 'Default / unarmed' }}</span>@endforeach</div>
        @else
            <div class="studio-equipment"><span><strong>Suite</strong> {{ $avatar['category_label'] ?? 'World' }}</span><span><strong>Subcategory</strong> {{ ucfirst($avatar['subcategory'] ?? 'Prop') }}</span></div>
        @endif
        <a class="button studio-open" href="{{ $cardUrl }}">Open asset studio &rarr;</a>
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
                <p class="eyebrow">WORKER &amp; ACCELERATION TELEMETRY</p>
                <div class="stat-chips">
                    <span class="stat-chip">Provider: <strong>{{ $operations['provider_label'] ?? ($operations['provider'] ?? 'Offline') }}</strong></span>
                    <span class="stat-chip">Hardware: <strong>{{ $operations['hardware']['gpu'] ?? 'Available' }}</strong></span>
                    <span class="stat-chip">VRAM Free: <strong>{{ number_format($operations['hardware']['gpu_free_mib'] ?? 0) }} MiB</strong></span>
                    <span class="stat-chip">Checkpoints: <strong>{{ ($operations['models']['ready'] ?? false) ? 'Ready' : 'Unavailable' }}</strong></span>
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
