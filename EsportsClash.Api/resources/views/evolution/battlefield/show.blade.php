@extends('evolution.layout')
@php
    $icon = $asset['icon'] ?? '📦';
    $hasModel = !empty($completedModel);
    $pendingRun = ($runs ?? collect())->first(fn($r) => in_array($r->status, [...\App\Services\TrellisGenerationService::ACTIVE, 'cancelling']));
    $backendReady = \App\Services\TrellisGenerationService::cloudGenerationReady($operations);
@endphp
@section('title', $asset['name'].' | Battlefield 3D Studio')
@section('content')

<div class="studio-breadcrumb-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
    <a href="{{ route('battlefield.index') }}">&larr; Back to Battlefield 3D Asset Studio</a>
    <span class="badge {{ $hasModel ? 'good' : '' }}">{{ $hasModel ? '3D Model Baked' : ($currentReference ? 'Reference Ready' : 'Reference Needed') }}</span>
</div>

<div class="page-heading studio-heading">
    <div>
        <p class="eyebrow">{{ strtoupper($asset['category_label'] ?? 'BATTLEFIELD ASSET') }} &middot; {{ strtoupper($asset['subcategory'] ?? 'PROP') }}</p>
        <h1>{{ $icon }} {{ $asset['name'] }}</h1>
        <p class="muted">{{ $asset['description'] ?? '' }}</p>
    </div>
    <div style="display:flex; gap:8px;">
        @if($hasModel)
            <a class="button primary" href="{{ route('trellis.asset', $completedModel) }}" download="{{ $asset['id'] }}.glb">Download .GLB Asset &darr;</a>
        @endif
    </div>
</div>

<nav class="studio-steps" aria-label="Asset workflow">
    @if($hasModel)<a href="#models">3D Model Viewer</a>@endif
    <a href="#reference">Concept Reference</a>
    <a href="#prompts">3D Generation Prompts</a>
    <a href="#generate">Generate Model</a>
    <a href="#history">Job History</a>
</nav>

{{-- 3D Model Review (if completed) --}}
@if($hasModel && isset($completedModel->state['artifact']['sha256'], $completedModel->plan['reference_sha256']))
<section class="panel" id="models" style="margin-bottom: 24px;">
    <div class="section-heading">
        <div>
            <p class="eyebrow">01 / 3D MODEL PREVIEW</p>
            <h2>Interactive 3D Mesh Inspection</h2>
            <p class="muted">{{ $isStatic ? 'Static unrigged game geometry. Rotate, zoom, and verify coordinate orientation and ground contact base.' : 'Skeletal-rig ready creature geometry. Inspect mesh contours and limb joint clearances.' }}</p>
        </div>
        <a class="button primary" href="{{ route('trellis.asset', $completedModel) }}" download="{{ $asset['id'] }}.glb">Download .GLB &darr;</a>
    </div>

    @if($models->count() > 1)
        <nav class="studio-steps" aria-label="Model versions" style="margin-bottom:12px;">
            @foreach($models as $m)
                <a href="{{ route('battlefield.show', [$asset['id'], 'model' => $m->id]) }}#models" @if($m->id === $completedModel->id) aria-current="page" @endif>
                    {{ $m->created_at->timezone('Asia/Manila')->format('M j, g:i A') }} / {{ substr($m->id, 0, 8) }}
                </a>
            @endforeach
        </nav>
    @endif

    @include('evolution.avatars.model-review', ['generation' => $completedModel, 'name' => $asset['name']])

    <details class="clean-details model-actions" style="margin-top:14px;">
        <summary>Model details &amp; deletion</summary>
        <p class="fine">Artifact SHA-256: <code>{{ $completedModel->state['artifact']['sha256'] }}</code> &middot; Format: Binary glTF (.GLB)</p>
        @include('evolution.avatars.delete-generated-model', ['model' => $completedModel])
    </details>
</section>
@endif

{{-- Concept Reference & Prompt Workspace --}}
<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-bottom: 24px;">
    {{-- Reference Card --}}
    <article class="panel" id="reference" style="margin:0;">
        <div class="section-heading">
            <div>
                <p class="eyebrow">02 / REFERENCE ARTWORK</p>
                <h3>Concept Reference PNG</h3>
            </div>
            <span class="badge {{ $currentReference ? 'good' : 'warning' }}">{{ $currentReference ? 'Ready' : 'Missing' }}</span>
        </div>

        <div class="asset-preview checkerboard" style="min-height: 260px; display:flex; align-items:center; justify-content:center; background:#070d14; border-radius:6px; margin-bottom:12px;">
            @if($currentReference)
                <img src="{{ $currentReference['url'] }}" alt="{{ $asset['name'] }} concept reference" style="max-height: 240px; object-fit: contain;">
            @else
                <div class="asset-placeholder">
                    <span aria-hidden="true" style="font-size:36px;">{{ $icon }}</span>
                    <strong>Concept Reference Needed</strong>
                </div>
            @endif
        </div>

        <p class="fine" style="margin-bottom: 12px;">
            {{ $isStatic ? 'High-contrast transparent PNG showing the full architectural silhouette and ground-contact plane.' : 'Symmetrical rest pose on transparent background ready for 3D reconstruction.' }}
        </p>

        @if($currentReference)
            <div class="asset-meta" style="margin-bottom: 12px;">
                <a href="{{ $currentReference['url'] }}" target="_blank" rel="noopener">Open Full Resolution &nearr;</a>
                <span title="{{ $currentReference['sha256'] }}">SHA: <code>{{ substr($currentReference['sha256'], 0, 10) }}...</code></span>
            </div>
        @endif

        <form method="post" enctype="multipart/form-data" action="{{ route('trellis.upload') }}" data-no-ajax>
            @csrf
            <input type="hidden" name="avatar_id" value="{{ $asset['id'] }}">
            <input type="hidden" name="prompt" value="{{ $prompts['values']['body'] ?? $prompts['defaults']['body'] }}">
            <label class="asset-file-label">{{ $currentReference ? 'Replace Reference PNG' : 'Upload Concept PNG' }}
                <input type="file" name="reference" accept="image/png" data-max-mib="12" required>
            </label>
            <p class="fine">PNG on transparent background &middot; up to 12 MiB.</p>
            <button class="button" type="submit" style="margin-top:8px;">{{ $currentReference ? 'Replace Reference' : 'Upload Reference' }}</button>
        </form>
    </article>

    {{-- Technical Prompt Details --}}
    <article class="panel" id="prompts" style="margin:0;">
        <div class="section-heading">
            <div>
                <p class="eyebrow">03 / TECHNICAL SPECIFICATION</p>
                <h3>Trellis 3D Prompts &amp; Guidance</h3>
            </div>
            <span class="badge">{{ $isStatic ? 'Unrigged Mesh' : 'Rig-Ready Creature' }}</span>
        </div>

        <div style="background:#0b131e; border:1px solid #1c2738; border-radius:6px; padding:14px; margin-bottom:14px;">
            <p class="eyebrow" style="margin-bottom:6px;">PIPELINE CLASSIFICATION</p>
            <p style="font-size:13px; margin-bottom:8px;">
                <strong>Type:</strong> {{ $isStatic ? 'Static Unrigged Environment Prop' : 'Skeletal Rig-Ready Animated Creature' }}<br>
                <strong>Collision Footprint:</strong> {{ $asset['category'] === 'structure' ? ($asset['subcategory'] === 'nexus' ? 'Radius 38px (Obstacle)' : ($asset['subcategory'] === 'barracks' ? 'Radius 26px (Obstacle)' : 'Radius 24px (Obstacle)')) : ($asset['category'] === 'environment' && $asset['subcategory'] === 'rock' ? 'Radius 22px (Obstacle)' : '0px (Ambient Walkable / Unit Collision)') }}<br>
                <strong>Role:</strong> {{ $asset['role'] ?? 'Arena Prop' }}
            </p>
            <p class="fine" style="margin:0;">
                {{ $isStatic ? 'Trellis will generate rigid geometric vertex coordinates without skinning or bone weight hierarchies. Procedural hover/crystal rotations are handled in Babylon.' : 'Trellis generates a clean neutral mesh ready for landmark detection and bone weighting in Colab.' }}
            </p>
        </div>

        <form method="post" action="{{ route('trellis.prompts', $asset['id']) }}" data-no-ajax>
            @csrf
            @method('PATCH')
            <label style="display:block; margin-bottom:12px;">
                <span style="font-weight:bold; font-size:12px; display:block; margin-bottom:4px;">3D Geometry Generation Prompt</span>
                <textarea name="body" rows="4" style="width:100%; font-size:12px; background:#08101a; border:1px solid #1e2c3c; color:#cbd5e1; border-radius:4px; padding:8px;">{{ $prompts['values']['body'] ?? $prompts['defaults']['body'] }}</textarea>
            </label>

            <label style="display:block; margin-bottom:12px;">
                <span style="font-weight:bold; font-size:12px; display:block; margin-bottom:4px;">Surface Material &amp; Shader Prompt</span>
                <textarea name="outfit" rows="3" style="width:100%; font-size:12px; background:#08101a; border:1px solid #1e2c3c; color:#cbd5e1; border-radius:4px; padding:8px;">{{ $prompts['values']['outfit'] ?? $prompts['defaults']['outfit'] }}</textarea>
            </label>

            <button type="submit" class="button quiet" style="font-size:12px;">Save Prompt Changes</button>
        </form>
    </article>
</div>

{{-- 3D Generation Action Panel --}}
<section class="panel generation-controls" id="generate" style="margin-bottom: 24px;">
    <div class="section-heading">
        <div>
            <p class="eyebrow">04 / DISPATCH 3D GENERATION</p>
            <h2>Queue Trellis 3D Generation Job</h2>
            <p class="muted">Dispatches native TRELLIS.2 reconstruction to Google Colab T4. Emits binary glTF (.GLB) model.</p>
        </div>
        <span class="badge {{ ($operations['models']['ready'] ?? false) ? 'good' : 'warning' }}">
            {{ ($operations['models']['ready'] ?? false) ? 'Google Colab T4 Ready' : 'Colab Router Offline' }}
        </span>
    </div>

    @if($pendingRun)
        <div class="notice" role="status" style="margin-bottom:12px;">
            A 3D generation job is currently running for <strong>{{ $asset['name'] }}</strong> (Job ID: <code>{{ substr($pendingRun->id, 0, 8) }}</code>).
            <a href="#history">View Live Telemetry Below &darr;</a>
        </div>
    @else
        <form method="post" action="{{ route('battlefield.generate', $asset['id']) }}" data-no-ajax>
            @csrf
            <div style="display:flex; align-items:center; gap:16px;">
                <button type="submit" class="primary" @disabled(!$backendReady || !$currentReference) style="padding:10px 24px; font-size:14px;">
                    Generate 3D Model via Google Colab &rarr;
                </button>
                <span class="fine">Compute: <strong>Google Colab GPU</strong> (TRELLIS.2-4B) &middot; Output: <strong>{{ $asset['id'] }}.glb</strong></span>
            </div>
            @if(!$currentReference)
                <p class="generation-blocker" style="margin-top:10px;">Please upload or confirm a concept reference image before generating.</p>
            @elseif(!$backendReady)
                <p class="generation-blocker" style="margin-top:10px;">Google Colab TRELLIS.2 worker must be connected to dispatch generation.</p>
            @endif
        </form>
    @endif
</section>

{{-- Job History --}}
<section class="panel" id="history">
    <div class="section-heading">
        <div>
            <p class="eyebrow">05 / JOB LEDGER</p>
            <h2>Generation History for {{ $asset['name'] }}</h2>
        </div>
        <p class="fine" id="live-status">Refreshes automatically</p>
    </div>
    <div id="live-reports" data-url="{{ route('trellis.live', ['avatar_id' => $asset['id']]) }}">
        @include('evolution.avatars.generation-runs', ['emptyMessage' => 'No generation runs yet for this battlefield asset.'])
    </div>
</section>

@endsection

