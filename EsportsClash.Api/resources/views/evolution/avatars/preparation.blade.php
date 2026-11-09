@extends('evolution.layout')
@section('title','Asset Preparation')
@section('content')
<div class="page-heading studio-heading"><div><p class="eyebrow">AVATAR STUDIO / PREPARATION</p><h1>Asset Preparation</h1><p class="muted">Prepare a rig, create animations, then review and qualify the result.</p></div><a class="button" href="{{ route('trellis.index') }}">Avatar studios &rarr;</a></div>
<div class="preparation-overview">
    <div><strong>{{ $sources->count() }}</strong><span>Generated sources</span></div>
    <div><strong>{{ $runs->whereIn('status',[...\App\Services\AvatarPreparationService::ACTIVE,'cancelling','pausing'])->count() }}</strong><span>Jobs in progress</span></div>
    <div><strong>{{ $runs->whereIn('status',['awaiting_retarget','awaiting_validation','needs_review','ready'])->count() }}</strong><span>Awaiting your action</span></div>
    <div class="worker-summary"><span class="badge {{ \App\Services\AvatarPreparationService::cloudStageReady($rigOperations,'rigging') ? 'good' : '' }}">{{ \App\Services\AvatarPreparationService::cloudStageReady($rigOperations,'rigging') ? 'Colab rig stage ready' : 'Colab rig stage not verified' }}</span><span>Google Colab required / Manual jobs only</span></div>
</div>
@include('evolution.avatars.pipeline-readiness')
<section class="panel preparation-create"><h2>Rig the generated body in Colab</h2>
    <p class="muted">Start with an unchanged generated body. TokenRig predicts its skeleton and skin weights; deformation review comes before animation and appearance.</p>
    <form method="post" action="{{ route('preparations.start') }}" class="settings-form">@csrf
        <label>Generated source<select name="generation_id" required><option value="">Choose a source</option>
        @foreach($sources as $source)<option value="{{ $source->id }}" @selected(request('generation')===$source->id)>{{ $catalog[$source->avatar_id]['name']??$source->avatar_id }} / {{ substr($source->id,0,8) }} / source generated on {{ $source->state['compute']['selected']??'unrecorded compute' }}</option>@endforeach
        </select></label>
        <input type="hidden" name="profile" value="tokenrig-colab-raw-v1"><input type="hidden" name="yaw" value="0">
        <input type="hidden" name="attachments" value="[]"><button class="primary" @disabled($sources->isEmpty())>Create raw rig in Colab</button>
    </form>
</section>
<section class="panel preparation-create"><div class="section-heading"><div><h2>Prepare a model</h2><p class="muted">Choose a generated source. A saved rig is reused when available; new sources use UniRig.</p></div></div>
    <form method="post" action="{{ route('preparations.start') }}" class="settings-form">
        @csrf
        <div class="preparation-source-picker">
            <label>Completed generated source
                <select name="generation_id" required>
                    <option value="">Choose a source</option>
                    @foreach($sources as $source)
                        <option value="{{ $source->id }}" @selected(request('generation')===$source->id)>{{ $catalog[$source->avatar_id]['name']??$source->avatar_id }} &middot; {{ $source->created_at->timezone('Asia/Manila')->format('M j, g:i A') }} &middot; {{ substr($source->id,0,8) }}</option>
                    @endforeach
                </select>
            </label>
        </div>

        <input type="hidden" name="profile" value="unirig-v1">
        <details class="clean-details preparation-advanced">
            <summary>Advanced preparation settings</summary>
            <div class="clean-details-content">
                <label>Facing correction (degrees)<input type="number" name="yaw" value="{{ old('yaw',0) }}" min="-180" max="180" step="1" required></label>
                <label class="checkbox-label"><input type="checkbox" name="fresh_rig" value="1"> Force fresh rig prediction instead of reusing saved rig (GPU inference)</label>
                <p class="fine">Optional JSON mapping, e.g. <code>{"Hips":"mixamorig:Hips"}</code>. Leave empty for conservative automatic humanoid hierarchy and foot-facing direction matching.</p>
                <label>Native-to-UniRig bone map
                    <textarea name="bone_map" rows="4">{}</textarea>
                </label>
            </div>
        </details>

        <input type="hidden" name="attachments" value="[]">

        <button class="primary" @disabled($sources->isEmpty())>Prepare rig &amp; animations</button>
    </form>

    @if($sources->isEmpty())<p class="muted">No generated sources available yet. <a href="{{ route('trellis.index') }}">Open an avatar studio</a> to generate a body first.</p>@endif
</section>
<section class="panel preparation-history">
    <div class="section-heading"><div><h2>Preparation reports</h2><p class="muted">One report per source model. Retries add to the same timeline, oldest to newest.</p></div><p class="fine" id="live-status">Updates every 10 seconds</p></div>
    @include('evolution.avatars.report-toolbar')
    <div id="live-reports" data-url="{{ route('preparations.live',array_filter(['avatar_id'=>request('avatar_id')])) }}">@include('evolution.avatars.preparation-runs')</div>
    <details class="report-management" id="report-management"><summary>Manage report history</summary><p class="fine">Report deletion keeps asset files. Select eligible reports above, then confirm below.</p>
    <form id="preparation-bulk-delete" method="post" action="{{ route('preparations.bulk-delete') }}" class="preparation-bulk compact-bulk">
        @csrf @method('DELETE')
        <h3>Delete selected preparation reports</h3>
        <p class="fine">Clears each selected report and all its attempt history. Stop active jobs first. Published model files and release records are retained.</p>
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


        <form method="post" action="{{ route('avatar-jobs.cancel-all','preparation') }}" onsubmit="return confirm('Request cancellation of all preparation jobs?');">@csrf<button class="danger">Cancel all preparation jobs</button></form>
    </details>
</section>
<script src="{{ asset('preparation-controls.js') }}" defer></script>
@endsection
