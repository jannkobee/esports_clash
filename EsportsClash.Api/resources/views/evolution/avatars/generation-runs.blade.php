@php
    $activeStatuses=[...\App\Services\TrellisGenerationService::ACTIVE,'cancelling'];
    $generatedCount=$runs->where('status','generated_unqualified')->count();
    $failedGenCount=$runs->where('status','failed')->count();
    $activeGenCount=$runs->whereIn('status',$activeStatuses)->count();
    $removedGenCount=$runs->whereIn('status',['model_deleted','cancelled'])->count();
    $statusLabels=['generated_unqualified'=>'Source ready / Needs preparation','queued'=>'Queued','waiting_models'=>'Waiting for checkpoints','waiting_resources'=>'Waiting for resources','waiting_worker'=>'Waiting for worker','running'=>'Generating','cancelling'=>'Stopping','cancelled'=>'Cancelled','failed'=>'Failed','model_deleted'=>'Model deleted'];
@endphp
<div class="category-filter-bar" data-target="#live-reports">
    <button type="button" class="category-pill active" data-category="all">All <span class="category-count">{{ count($runs) }}</span></button>
    <button type="button" class="category-pill pill-success" data-category="generated">Models <span class="category-count">{{ $generatedCount }}</span></button>
    <button type="button" class="category-pill pill-running" data-category="active">In progress <span class="category-count">{{ $activeGenCount }}</span></button>
    <button type="button" class="category-pill pill-failed" data-category="failed">Failed <span class="category-count">{{ $failedGenCount }}</span></button>
    <button type="button" class="category-pill" data-category="removed">Deleted / cancelled <span class="category-count">{{ $removedGenCount }}</span></button>
</div>
@forelse($runs as $run)
@php
    $progress=$run->state['node_progress']??$run->state['sampler_progress']??[];
    $isSuccess=$run->status==='generated_unqualified';
    $isFailed=$run->status==='failed';
    $isActive=in_array($run->status,$activeStatuses,true);
    $category=$isSuccess?'generated':($isFailed?'failed':($isActive?'active':'removed'));
@endphp
<article class="run-row studio-run" data-name="{{ $names[$run->avatar_id]??$run->avatar_id }}" data-job-id="{{ $run->id }}" data-created="{{ $run->created_at->getTimestampMs() }}" data-search="{{ ($names[$run->avatar_id]??$run->avatar_id).' '.$run->status.' '.$run->id }}" data-status-category="{{ $category }}">
    <div class="run-title"><div><strong>{{ $names[$run->avatar_id]??$run->avatar_id }}</strong><span class="fine"> &middot; {{ $run->created_at->timezone('Asia/Manila')->format('M j, g:i A') }} &middot; Seed {{ $run->plan['seed']??'?' }}</span></div><span class="badge {{ $isSuccess?'good':($isFailed?'danger':'') }}">{{ $statusLabels[$run->status]??str_replace('_',' ',$run->status) }}</span></div>
    @if(isset($run->plan['compute_preference']))<p class="fine">Requested: <strong>{{ $run->plan['compute_preference'] === 'google' ? 'Google Colab' : 'Local' }}</strong>@if(isset($run->state['provider'])) &middot; Used: <strong>{{ $run->state['provider'] === 'google-colab' ? 'Google Colab' : 'Local' }}</strong>@endif</p>@endif
    @if($run->state['compute']['fallback_reason'] ?? null)<p class="notice" role="status">{{ $run->state['compute']['fallback_reason'] }}</p>@endif
    @if(($run->state['artifact']['generation']['model'] ?? null) === 'existing-avatar-donor')<p class="fine">Saved local geometry was reused. This source is not a new reconstruction of the reference image.</p>@endif
    @if($run->error)<div class="failure-box"><strong>Generation could not finish</strong><p class="error-text">{{ \Illuminate\Support\Str::limit($run->error,2000) }}</p><a href="{{ route('trellis.avatar',$run->avatar_id) }}#generate">Review assets &amp; try again &rarr;</a></div>
    @elseif($isSuccess)<p class="muted">3D source saved. Review its anatomy and reference similarity before preparing its rig and animations.</p>
    @elseif($run->status==='model_deleted')<p class="muted">The generated model was deleted. This report and its original input are retained.</p>
    @elseif($run->status==='cancelled')<p class="muted">Generation was cancelled. Your source assets are retained.</p>
    @else<p class="fine"><strong>Stage:</strong> {{ $run->state['stage']??'Waiting in GPU queue' }} @if(isset($progress['value']))&middot; Node progress {{ $progress['value'] }}/{{ $progress['max']??'?' }}@endif</p>
        @if(isset($progress['value'],$progress['max']) && $progress['max']>0)<progress class="generation-progress" value="{{ $progress['value'] }}" max="{{ $progress['max'] }}" aria-label="Current generation stage progress"></progress>@endif
    @endif
    @if($run->status==='waiting_resources' && isset($run->state['resources']))<p class="fine">Available: {{ number_format($run->state['resources']['vm_available_mib']??0) }} MiB RAM &middot; {{ number_format($run->state['resources']['gpu_free_mib']??0) }} MiB GPU memory. Waiting for admission headroom.</p>@endif
    @if(isset($run->state['reason']))<p class="fine">{{ $run->state['reason'] }}</p>@endif
    <div class="run-links">
        @if($isSuccess)<a class="button" href="{{ route('trellis.preview',$run) }}">Inspect 3D model &rarr;</a><a href="{{ route('trellis.asset',$run) }}">Download GLB</a><a href="{{ route('preparations.index',['generation'=>$run->id]) }}">Prepare rig &amp; animations</a>@endif
        @if(isset($run->plan['reference_sha256']))<a href="{{ route('trellis.reference',[$run->avatar_id,$run->plan['reference_sha256']]) }}">Original input</a>@endif
        <a href="{{ route('trellis.report',$run) }}">Download report</a>
    </div>
    <details class="clean-details" id="generation-technical-{{ $run->id }}"><summary>Technical details &amp; actions</summary><div class="clean-details-content">
        <div class="stat-chips"><span class="stat-chip">Job: <code>{{ $run->id }}</code></span><span class="stat-chip">Execution: <code>{{ $run->state['prompt_id']??'Not submitted yet' }}</code></span>
        @if(isset($run->state['sampled_peaks']))<span class="stat-chip">Worker RAM: <strong>{{ number_format($run->state['sampled_peaks']['worker_anonymous_mib']??0) }} MiB</strong></span><span class="stat-chip">VRAM: <strong>{{ number_format($run->state['sampled_peaks']['gpu_used_mib']??0) }} MiB</strong></span>@endif</div>
        <div class="actions">@if($isSuccess)@include('evolution.avatars.delete-generated-model',['model'=>$run])@endif @include('evolution.avatars.cancel',['type'=>'generation'])
            <form method="post" action="{{ route('reports.delete',['generation',$run->id]) }}" onsubmit="return confirm('Delete this job report? Its generated model and source assets will be kept.');">@csrf @method('DELETE')<button class="quiet" @disabled($isActive)>Delete report only</button></form>
        </div>
        <p class="fine">Deleting a model removes its GLB. Deleting a report only hides its job record.</p>
    </div></details>
</article>
@empty<p class="muted">{{ $emptyMessage??'No generation reports yet. Open an avatar studio to prepare its body reference.' }}</p>@endforelse
