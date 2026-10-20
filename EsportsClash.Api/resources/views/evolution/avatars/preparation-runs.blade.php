@php
    $readyCount = $runs->filter(fn($r) => in_array($r->status, ['ready', 'published']))->count();
    $failedCount = $runs->filter(fn($r) => $r->error || !empty($r->state['report']['reasons'] ?? $r->state['preparation']['problems'] ?? []) || in_array($r->status, ['failed', 'cancelled']))->count();
    $activeCount = $runs->filter(fn($r) => in_array($r->status, [...\App\Services\AvatarPreparationService::ACTIVE, 'cancelling', 'pausing']))->count();
    $reviewCount = $runs->filter(fn($r) => in_array($r->status, ['awaiting_retarget', 'awaiting_validation', 'needs_review']))->count();
@endphp

<div class="category-filter-bar" data-target="#live-reports">
    <button type="button" class="category-pill active" data-category="all">All Preparations <span class="category-count">{{ count($runs) }}</span></button>
    <button type="button" class="category-pill pill-success" data-category="ready">✓ Ready / Published <span class="category-count">{{ $readyCount }}</span></button>
    <button type="button" class="category-pill pill-failed" data-category="failed">✕ Issues / Failed <span class="category-count">{{ $failedCount }}</span></button>
    <button type="button" class="category-pill pill-running" data-category="active">⏳ In Progress <span class="category-count">{{ $activeCount }}</span></button>
    <button type="button" class="category-pill" data-category="review">📋 Awaiting Review <span class="category-count">{{ $reviewCount }}</span></button>
</div>

@forelse($runs as $run)
@php
    $deletable = app(\App\Services\ReportDeletionService::class)->canDelete('preparation', $run->status, $run->control);
    $reasons = $run->state['report']['reasons'] ?? $run->state['preparation']['problems'] ?? [];
    $geometry = $run->state['report']['geometry'] ?? null;
    $hasErrors = (bool) $run->error || !empty($reasons) || in_array($run->status, ['failed', 'cancelled']);
    $isReady = in_array($run->status, ['ready', 'published']) || ($geometry['passed'] ?? false);
    $isActive = in_array($run->status, [...\App\Services\AvatarPreparationService::ACTIVE, 'cancelling', 'pausing']);
    $isReview = in_array($run->status, ['awaiting_retarget', 'awaiting_validation', 'needs_review']);

    $category = $isReady ? 'ready' : ($hasErrors ? 'failed' : ($isActive ? 'active' : ($isReview ? 'review' : 'all')));
@endphp
<article class="run-row" id="preparation-{{ $run->id }}" data-preparation-id="{{ $run->id }}" data-status-category="{{ $category }}">
    <div class="run-title">
        <label class="preparation-selection checkbox-label">
            <input type="checkbox" class="preparation-select" name="ids[]" value="{{ $run->id }}" form="preparation-bulk-delete" @disabled(!$deletable) aria-label="Select {{ $catalog[$run->avatar_id]['name']??$run->avatar_id }} report {{ substr($run->id,0,8) }} for deletion">
            <strong>{{ $catalog[$run->avatar_id]['name']??$run->avatar_id }}</strong>
        </label>
        <span class="badge {{ $isReady ? 'good' : ($hasErrors ? 'danger' : '') }}">{{ str_replace('_',' ',$run->status) }}</span>
    </div>

    @include('evolution.avatars.preparation-progress')

    {{-- Categorized What Failed Box --}}
    @if($run->error || !empty($reasons))
        <div class="failure-box">
            <div class="failure-box-title">✕ Identified Issues &amp; Unmet Criteria ({{ count($reasons) + ($run->error ? 1 : 0) }})</div>
            @if($run->error)<p class="error-text" style="margin-bottom:6px;">{{ $run->error }}</p>@endif
            @if(!empty($reasons))
                <ul class="failure-list">
                    @foreach($reasons as $reason)
                        <li>{{ $reason }}</li>
                    @endforeach
                </ul>
            @endif
        </div>
    @endif

    {{-- Categorized What Succeeded Box --}}
    @if($isReady)
        <div class="success-box">
            <div class="success-box-title">✓ Verified Verification Gates</div>
            <ul class="success-list">
                @if($geometry['passed'] ?? false)<li>Full-mesh collision &amp; deformation policy passed without severe intersections.</li>@endif
                @if(isset($run->state['preparation']['sha256']))<li>Native clip retargeting and bone map verified.</li>@endif
                @if($run->status === 'ready')<li>Ready for owner visual sign-off and publication.</li>@endif
                @if($run->status === 'published')<li>Published for runtime matches.</li>@endif
            </ul>
        </div>
    @endif

    {{-- Stat Chips --}}
    <div class="stat-chips">
        <span class="stat-chip">Created: <strong>{{ $run->created_at->timezone('Asia/Manila')->format('M j, Y, g:i A') }}</strong></span>
        <span class="stat-chip">Profile: <strong>{{ $run->plan['profile']??'unirig-v1' }}</strong></span>
        @if(isset($run->plan['rig_reuse']))
            <span class="stat-chip">Rig Reused: <strong>{{ substr($run->plan['rig_reuse']['id'], 0, 8) }}…</strong></span>
        @endif
        @if(isset($geometry['policy']))
            <span class="stat-chip">Policy: <strong>{{ $geometry['policy'] }}</strong></span>
        @endif
    </div>

    {{-- In-Place Job Controls (No New Instance) --}}
    <div class="actions" style="margin: 14px 0 8px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        @if(in_array($run->status, ['paused', 'failed', 'needs_review', 'cancelled']))
            <form method="post" action="{{ route('preparations.control', $run) }}" style="display:inline;">
                @csrf
                <input type="hidden" name="operation" value="resume_in_place">
                <button class="primary">▶ Resume preparation</button>
            </form>
            <form method="post" action="{{ route('preparations.control', $run) }}" style="display:inline;">
                @csrf
                <input type="hidden" name="operation" value="reset">
                <button class="danger">↺ Reset preparation</button>
            </form>
        @endif
        @if(in_array($run->status, \App\Services\AvatarPreparationService::ACTIVE))
            <form method="post" action="{{ route('preparations.control', $run) }}" style="display:inline;">
                @csrf
                <input type="hidden" name="operation" value="pause">
                <button class="danger">⏸ Pause</button>
            </form>
        @endif
    </div>

    @if(\App\Models\TrellisGeneration::whereKey($run->generation_id)->where('status','generated_unqualified')->exists()&&isset($run->state['preparation']['unirig']['artifact']['sha256'])&&!in_array($run->status,[...\App\Services\AvatarPreparationService::ACTIVE,'cancelling','pausing','paused','published'],true))
        <details class="clean-details" style="margin: 8px 0;">
            <summary>Advanced: Branch revision with saved rig</summary>
            <div class="clean-details-content">
                <form method="post" action="{{ route('preparations.start') }}" style="margin: 10px 0 6px;">
                    @csrf
                    <input type="hidden" name="generation_id" value="{{ $run->generation_id }}">
                    <input type="hidden" name="rig_preparation_id" value="{{ $run->id }}">
                    <input type="hidden" name="profile" value="unirig-v1">
                    <input type="hidden" name="yaw" value="{{ $run->plan['yaw']??0 }}">
                    <input type="hidden" name="bone_map" value="{{ json_encode($run->plan['bone_map']??new \stdClass) }}">
                    <input type="hidden" name="attachments" value="[]">
                    <button>Create branch attempt using this rig</button>
                    <p class="fine" style="margin-top:4px;">Creates an isolated preparation copy with the exact saved rig. Use only if you want an alternate branch.</p>
                </form>
            </div>
        </details>
    @endif

    @if($run->status==='awaiting_retarget')
        <div class="notice">UniRig produced a real rig. Review the predicted bones and mapping reasons below. New preparations attempt conservative automatic humanoid mapping; uncertain skeletons need an explicit reviewed map. Native game compatibility has not been established.</div>
    @endif

    {{-- Folded Technical Evidence Accordions --}}
    @if(isset($run->state['report']['geometry']))
        <details class="clean-details">
            <summary>Geometry and skin-repair evidence</summary>
            <div class="clean-details-content">
                @unless(isset($run->state['report']['geometry']['policy']))
                    <p class="notice">Legacy sampled geometry check. Revise animations using the saved rig to use the current full-mesh policy.</p>
                @endunless
                <pre>{{ json_encode(['geometry'=>$run->state['report']['geometry'],'skin_repairs'=>$run->state['preparation']['skin_repairs']??[]],JSON_PRETTY_PRINT) }}</pre>
            </div>
        </details>
    @endif

    @if(isset($run->state['preparation']['predicted_bones']))
        <details class="clean-details" id="preparation-bones-{{ $run->id }}">
            <summary>UniRig bones and native clip mapping</summary>
            <div class="clean-details-content">
                <pre>{{ json_encode(['predicted_bones'=>$run->state['preparation']['predicted_bones'],'bone_map'=>$run->state['preparation']['bone_map']??[],'mapping_review'=>$run->state['preparation']['mapping_review']??null],JSON_PRETTY_PRINT) }}</pre>
            </div>
        </details>
    @endif

    <div class="run-links">
        <a href="{{ route('preparations.report',$run) }}">Preparation report</a>
        @if(isset($run->state['preparation']['sha256']))
            <a href="{{ route('preparations.preview',$run) }}">Inspect model and animations</a>
            <a href="{{ route('preparations.file',[$run,'candidate-01.glb']) }}">Prepared GLB</a>
            @if(($run->plan['provider']??'')==='unirig')
                <a href="{{ route('preparations.file',[$run,'unirig-rigged.glb']) }}">Original UniRig rig</a>
            @endif
            <a href="{{ route('preparations.file',[$run,'candidate-01.blend']) }}">Editable Blender scene</a>
        @endif
        <code>{{ $run->id }}</code>
    </div>

    @if(in_array($run->status,['awaiting_validation','needs_review']))
        <form method="post" action="{{ route('preparations.validate',$run) }}" style="margin: 10px 0;">
            @csrf
            <button class="primary">Run runtime qualification</button>
        </form>
    @endif

    @if($run->status==='ready')
        <form method="post" action="{{ route('preparations.publish',$run) }}" style="margin: 12px 0;">
            @csrf
            <label class="checkbox-label" style="margin-bottom:8px;"><input type="checkbox" name="identity_review" value="1" required> I reviewed identity, equipment, team readability, deformation and ability attachments in the previews.</label>
            <button class="primary">Publish qualified visual version</button>
        </form>
    @endif

    @include('evolution.avatars.preparation-controls')
    @include('evolution.avatars.cancel',['type'=>'preparation'])

    @if($run->status==='published')
        <p class="fine">Published for new scenes. Use <a href="{{ route('avatars.index') }}">visual history and rollback</a> to restore a previous version.</p>
    @endif
    @if(!$deletable)
        <p class="fine">This job must finish or acknowledge cancellation before its report can be selected for deletion.</p>
    @endif
    @include('evolution.delete-report',['type'=>'preparation'])
</article>
@empty
    <p class="muted">No preparation jobs yet. Choose a completed generation above.</p>
@endforelse
