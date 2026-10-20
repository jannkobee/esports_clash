@extends('evolution.layout')
@section('title','Asset Preparation')
@section('content')
<div class="page-heading">
    <div>
        <p class="eyebrow">FROM GENERATED SOURCE TO PLAYABLE CANDIDATE</p>
        <h1>Asset Preparation</h1>
        <p class="muted">Humanoid rigging, native animations, equipment repairs, and runtime qualification.</p>
    </div>
    <a class="button" href="{{ route('trellis.index') }}">Generate another source &rarr;</a>
</div>

<section class="panel">
    <div class="section-heading">
        <div>
            <h2>Local UniRig worker</h2>
            <p class="muted">Manual jobs only &middot; {{ $rigOperations ? (($rigOperations['models_ready']??false)&&($rigOperations['runtime_ready']??false) ? 'Checkpoints & Runtime Ready' : 'Online (Setup Pending)') : 'Offline' }}</p>
        </div>
        <div class="stat-chips">
            <span class="stat-chip">Mode: <strong>Manual Jobs Only</strong></span>
            @if($rigOperations && ($rigOperations['active']??null))
                <span class="stat-chip">Active Job: <code>{{ substr($rigOperations['active'], 0, 8) }}…</code></span>
            @endif
        </div>
    </div>
</section>

{{-- Prepare a Generated Avatar Form --}}
<section class="panel">
    <div class="section-heading">
        <div>
            <h2>Prepare a generated avatar</h2>
            <p class="muted">Reuses frozen rig or queues UniRig prediction and maps native animation clips.</p>
        </div>
    </div>

    <form method="post" action="{{ route('preparations.start') }}" class="settings-form">
        @csrf
        <div class="proposal-grid">
            <label>Completed generated source
                <select name="generation_id" required>
                    <option value="">Choose a source</option>
                    @foreach($sources as $source)
                        <option value="{{ $source->id }}" @selected(request('generation')===$source->id)>{{ $catalog[$source->avatar_id]['name']??$source->avatar_id }} &middot; {{ $source->created_at->timezone('Asia/Manila')->format('M j, g:i A') }} &middot; {{ substr($source->id,0,8) }}</option>
                    @endforeach
                </select>
            </label>
            <label>Preparation profile
                <select name="profile">
                    <option value="unirig-v1">UniRig &middot; skeleton + skin prediction</option>
                </select>
            </label>
            <label>Facing correction (degrees)
                <input type="number" name="yaw" value="0" min="-180" max="180" step="1" required>
            </label>
        </div>

        <details class="clean-details">
            <summary>Advanced: Custom native-to-UniRig bone map</summary>
            <div class="clean-details-content">
                <p class="fine">Optional JSON mapping, e.g. <code>{"Hips":"mixamorig:Hips"}</code>. Leave empty for conservative automatic humanoid hierarchy and foot-facing direction matching.</p>
                <label>Native-to-UniRig bone map
                    <textarea name="bone_map" rows="4">{}</textarea>
                </label>
            </div>
        </details>

        <input type="hidden" name="attachments" value="[]">

        <label class="checkbox-label" style="margin: 10px 0;">
            <input type="checkbox" name="fresh_rig" value="1"> Force fresh rig prediction instead of reusing saved rig (GPU inference)
        </label>

        <button class="primary" @disabled($sources->isEmpty())>Queue rigging and animation preparation</button>
    </form>
</section>

{{-- Preparation & Deployment History --}}
<section class="panel">
    <div class="section-heading">
        <div>
            <h2>Preparation and deployment history</h2>
            <p class="muted">Interactive candidates, full-mesh qualification outcomes, and publication gates.</p>
        </div>
        <form method="post" action="{{ route('avatar-jobs.cancel-all','preparation') }}">
            @csrf
            <button class="danger">Cancel all preparation jobs</button>
        </form>
    </div>

    {{-- Bulk Delete Panel --}}
    <form id="preparation-bulk-delete" method="post" action="{{ route('preparations.bulk-delete') }}" class="preparation-bulk">
        @csrf @method('DELETE')
        <h3>Delete selected preparation reports</h3>
        <p class="fine">Clears database report details and progress history. Active jobs and published releases remain protected.</p>
        <div class="actions">
            <label class="preparation-selection checkbox-label"><input type="checkbox" id="preparation-select-all"> Select all eligible shown reports</label>
            <strong id="preparation-selected-count" role="status">0 selected</strong>
            <button type="button" id="preparation-clear-selection" class="button-danger-subtle">Clear selection</button>
        </div>
        <label class="preparation-selection checkbox-label" style="margin-top: 10px;">
            <input type="checkbox" name="confirm" value="1" id="preparation-delete-confirm" required>
            I understand that the selected report details and progress history will be cleared.
        </label>
        <button class="danger" id="preparation-delete-selected">Delete selected reports</button>
    </form>

    <div id="live-reports" data-url="{{ route('preparations.live') }}">@include('evolution.avatars.preparation-runs')</div>
</section>

<script src="{{ asset('preparation-controls.js') }}" defer></script>
@endsection
