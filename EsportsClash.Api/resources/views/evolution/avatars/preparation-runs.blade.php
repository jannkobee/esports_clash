@php
    $categoryFor=function($run) {
        if(in_array($run->status,[...\App\Services\AvatarPreparationService::ACTIVE,'cancelling','pausing'],true)) return 'active';
        if(in_array($run->status,['ready','published'],true)) return 'ready';
        if(in_array($run->status,['paused','cancelled'],true)) return 'stopped';
        if($run->status==='awaiting_retarget'&&!empty($run->state['preparation']['mapping_review']['reasons'])) return 'review';
        if($run->status==='failed'||$run->error||!empty($run->state['report']['reasons']??$run->state['preparation']['problems']??[])) return 'failed';
        return in_array($run->status,['awaiting_retarget','awaiting_validation','needs_review'],true) ? 'review' : 'stopped';
    };
    $statusLabels=['queued'=>'Queued','preparing'=>'Preparing','rigging'=>'Building rig','animating'=>'Preparing animation','validating'=>'Checking qualification','waiting_models'=>'Waiting for checkpoints','waiting_resources'=>'Waiting for capacity','waiting_worker'=>'Worker disconnected','cancelling'=>'Stopping','pausing'=>'Pausing','paused'=>'Paused','cancelled'=>'Cancelled','failed'=>'Failed','awaiting_retarget'=>'Mapping needs review','awaiting_validation'=>'Awaiting qualification','needs_review'=>'Needs review','ready'=>'Ready for sign-off','published'=>'Published'];
@endphp
@unless($singleReport??false)
<div class="category-filter-bar" data-target="#live-reports">
@foreach(['all'=>'All jobs','active'=>'In progress','review'=>'Needs review','ready'=>'Ready / Published','failed'=>'Issues / Failed','stopped'=>'Paused / Cancelled'] as $key=>$label)
    <button type="button" class="category-pill {{ $key==='all'?'active':'' }}" data-category="{{ $key }}">{{ $label }} <span class="category-count">{{ $key==='all'?$runs->count():$runs->filter(fn($entry)=>$categoryFor($entry)===$key)->count() }}</span></button>
@endforeach
</div>
@endunless
@forelse($runs as $run)
@php
    $attempts=$run->reportAttempts??collect([$run]);
    $reportId=$run->report_id??$run->id;
    $reportStarted=$attempts->first()->created_at;
    $deletable=$attempts->every(fn($attempt)=>app(\App\Services\ReportDeletionService::class)->canDelete('preparation',$attempt->status,$attempt->control));
    $reasons=$run->state['report']['reasons']??$run->state['preparation']['problems']??[];
    $mappingHold=($run->state['preparation']['mapping_review']['accepted']??null)===false&&!empty($run->state['preparation']['mapping_review']['reasons']);
    $historicalMapping=$mappingHold&&(!empty($run->control['replacement_id'])||in_array($run->status,['cancelled','failed'],true));
    if($mappingHold) {
        $otherReasons=array_filter($reasons,fn($reason)=>!str_starts_with($reason,'Review native animation mapping for:')&&!str_starts_with($reason,'Automatic bone mapping needs review:'));
        $reasons=array_values(array_unique([...$run->state['preparation']['mapping_review']['reasons'],...$otherReasons]));
    }
    $geometry=$run->state['report']['geometry']??null;
    $category=$categoryFor($run);
    $isReady=in_array($run->status,['ready','published'],true);
    $avatarName=$catalog[$run->avatar_id]['name']??$run->avatar_id;
@endphp
<article class="run-row preparation-job" id="preparation-{{ $reportId }}" data-preparation-id="{{ $reportId }}" data-name="{{ $avatarName }}" data-job-id="{{ $reportId }}" data-created="{{ $reportStarted->getTimestampMs() }}" data-search="{{ $avatarName.' '.$run->status.' '.($statusLabels[$run->status]??'').' '.$attempts->pluck('id')->join(' ') }}" data-status-category="{{ $category }}">
    <div class="job-header">
        <div class="job-identity">
            @unless($singleReport??false)<input type="checkbox" class="preparation-select" name="ids[]" value="{{ $reportId }}" form="preparation-bulk-delete" @disabled(!$deletable) aria-label="Select {{ $avatarName }} report {{ substr($reportId,0,8) }} for deletion">@endunless
            <div><h3><a href="{{ route('trellis.avatar',$run->avatar_id) }}">{{ $avatarName }}</a></h3><p class="fine">Started {{ $reportStarted->timezone('Asia/Manila')->format('M j, g:i A') }} &middot; {{ $attempts->count() }} {{ \Illuminate\Support\Str::plural('attempt',$attempts->count()) }} &middot; Source {{ substr($run->generation_id,0,8) }}</p></div>
        </div>
        <span class="badge {{ $isReady?'good':($category==='failed'?'danger':'') }}">{{ $statusLabels[$run->status]??ucfirst(str_replace('_',' ',$run->status)) }}</span>
    </div>
    @include('evolution.avatars.preparation-progress')
    @if($run->error || !empty($reasons))
        <div class="{{ $mappingHold?'notice mapping-review-notice':'failure-box' }}"><strong>{{ $mappingHold?($historicalMapping?'Previous attempt / mapping review':'Native mapping needs review'):'What needs attention' }}</strong>@if($run->error)<p class="error-text">{{ $run->error }}</p>@endif
            @if($reasons)<ul class="failure-list">@foreach($reasons as $reason)<li>{{ $reason }}</li>@endforeach</ul>@endif
            @if($mappingHold)<p class="fine">The saved rig exists. These are mapping-detection reasons, not a list of absent source bones. Retargeting can be retried using the saved rig without a fresh UniRig prediction.</p>@endif
        </div>
    @endif
    @if($isReady)<div class="success-box"><strong>{{ $run->status==='published'?'Published for new scenes':'Technical checks passed / visual sign-off required' }}</strong>
        @if($geometry['passed']??false)<p class="fine">Recorded geometry qualification passed.</p>@endif
    </div>@endif
    <div class="job-main-actions">
        @if(isset($run->state['preparation']['sha256']))<a class="button" href="{{ route('preparations.preview',$run) }}">Review model &amp; animations &rarr;</a>@endif
        @unless($singleReport??false)<a href="{{ route('preparations.report',$reportId) }}">Open full report &rarr;</a>@endunless
    </div>
    @if(($run->plan['provider']??null)==='tokenrig')<p class="notice">This attempt contains a raw Colab rig of source {{ substr($run->generation_id,0,8) }}. Animation, appearance and publication remain gated by deformation review.</p>@endif
    @if(in_array($run->status,['awaiting_validation','needs_review'])&&($run->plan['provider']??null)!=='tokenrig')
        <form method="post" action="{{ route('preparations.validate',$run) }}">@csrf<button class="primary">Run runtime qualification</button></form>
    @endif
    @if($run->status==='ready')
        <form method="post" action="{{ route('preparations.publish',$run) }}" class="job-signoff">@csrf
            <label class="checkbox-label"><input type="checkbox" name="identity_review" value="1" required> I reviewed identity, equipment, team readability, deformation and ability attachments in the previews.</label>
            <button class="primary">Publish qualified visual version</button>
        </form>
    @endif
    @include('evolution.avatars.preparation-controls')
    @include('evolution.avatars.preparation-attempt-history')
    <details class="job-detail job-technical" id="preparation-technical-{{ $run->id }}"><summary>Files, evidence &amp; advanced actions</summary>
        <dl class="job-facts"><div><dt>Job ID</dt><dd><code>{{ $run->id }}</code></dd></div><div><dt>Source</dt><dd><a href="{{ route('trellis.avatar',[$run->avatar_id,'model'=>$run->generation_id]) }}#models">{{ $run->generation_id }}</a></dd></div><div><dt>Profile</dt><dd>{{ $run->plan['profile']??'unirig-v1' }}</dd></div>
        @if(isset($run->plan['rig_reuse']))<div><dt>Saved rig</dt><dd>{{ $run->plan['rig_reuse']['id'] }}</dd></div>@endif
        @if(isset($geometry['policy']))<div><dt>Geometry policy</dt><dd>{{ $geometry['policy'] }}</dd></div>@endif</dl>
        <div class="run-links"><a href="{{ route('preparations.report',[$run,'format'=>'json']) }}">Download JSON report</a>
        @if(isset($run->state['preparation']['sha256']))
            @if(($run->plan['provider']??null)==='tokenrig')
            <a href="{{ route('preparations.file',[$run,'raw-rig.glb']) }}">Exact raw Colab rig</a>
            @else
            <a href="{{ route('preparations.file',[$run,'candidate-01.glb']) }}">Prepared GLB</a>
            @if(($run->plan['provider']??'')==='unirig')<a href="{{ route('preparations.file',[$run,'unirig-rigged.glb']) }}">Original UniRig rig</a>@endif
            <a href="{{ route('preparations.file',[$run,'candidate-01.blend']) }}">Editable Blender scene</a>
            @endif
        @endif</div>
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
            <summary>Predicted bones and native clip mapping</summary>
            <div class="clean-details-content">
                <pre>{{ json_encode(['predicted_bones'=>$run->state['preparation']['predicted_bones'],'bone_map'=>$run->state['preparation']['bone_map']??[],'mapping_review'=>$run->state['preparation']['mapping_review']??null],JSON_PRETTY_PRINT) }}</pre>
            </div>
        </details>
    @endif


        @include('evolution.avatars.cancel',['type'=>'preparation'])
        @if(!$deletable)<p class="fine">This job must finish or acknowledge cancellation before its report can be selected for deletion.</p>@endif
        <form method="post" action="{{ route('reports.delete',['preparation',$reportId]) }}">@csrf @method('DELETE')<button class="danger" @disabled(!$deletable)>Delete report &amp; attempt history</button></form>
    </details>
</article>
@empty<div class="job-empty"><h3>No preparation jobs yet</h3><p class="muted">Choose a generated source above to prepare its rig and animations.</p></div>@endforelse
