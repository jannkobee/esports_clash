@php
    $track=app(\App\Services\PreparationProgressService::class)->view($run);
    $step=(int)$track['step'];
    $steps=\App\Services\PreparationProgressService::STEPS;
    $halted=in_array($run->status,['failed','cancelled','cancelling','pausing','paused','waiting_worker'],true);
    $nextStep=match($run->status) {
        'waiting_resources','waiting_models','queued'=>'Admission retries automatically. Leave this job queued, or pause it if you want to stop waiting.',
        'waiting_worker'=>'The same job will be polled again when its worker reconnects.',
        'awaiting_validation'=>'Select Run runtime qualification to check this model in the game renderer.',
        'awaiting_retarget'=>'Review the mapping reason below. After correcting the mapper, select Retry preparation. The saved rig can be reused without fresh rig prediction.',
        'needs_review','failed'=>'Review the issues below before retrying or preparing a revised asset.',
        'ready'=>'Review the model and animations, then confirm visual sign-off before publishing.',
        'published'=>'Available for new scenes. Previous versions remain available for rollback.',
        'paused'=>'Select Resume preparation to continue in this report with the same source and settings.',
        'cancelled'=>'This attempt has stopped. Select Retry preparation when you are ready; its updates will appear here.',
        'pausing','cancelling'=>'Waiting for both workers to acknowledge the stop.',
        default=>'The worker is processing this stage. Updates appear automatically.'
    };
    $events=($attempts??collect([$run]))->values()->flatMap(function($attempt,$index) {
        $observations=app(\App\Services\PreparationProgressService::class)->view($attempt)['events']??[];
        return collect($observations)->map(fn($event)=>[...$event,'attempt_number'=>$index+1]);
    })->sortBy(fn($event)=>\Carbon\Carbon::parse($event['observed_at'])->getTimestampMs())->values();
@endphp
<section class="preparation-progress job-progress" aria-label="Preparation progress for {{ $catalog[$run->avatar_id]['name']??$run->avatar_id }}">
    <div class="job-stage-line">
        <div><p class="eyebrow">{{ $halted ? 'LAST RECORDED STAGE' : 'CURRENT STAGE' }}</p><h3>{{ $track['position_known'] ? $steps[$step] : 'Waiting for an observation' }}</h3></div>
        @if($track['position_known'])<span class="job-stage-count">{{ $step+1 }} / {{ count($steps) }} stages</span>@endif
    </div>
    <p class="preparation-message" role="status">{{ $track['message'] }}</p>
    <p class="job-next-step"><strong>Next:</strong> {{ $nextStep }}</p>
    <details id="preparation-stages-{{ $reportId??$run->id }}" class="job-detail"><summary>Workflow stages @if($track['position_known'])<span>{{ $step+1 }} of {{ count($steps) }}</span>@endif</summary>
        <p class="fine">Workflow stage {{ $step+1 }} of {{ count($steps) }}. Stages show workflow position, not an inference percentage or an ETA.</p>
        @unless($track['position_known'])<p class="fine">The earlier workflow position was not recorded for this job.</p>@endunless
        <ol class="preparation-stages">@foreach($steps as $index=>$label)<li class="{{ $index===$step && $track['position_known']?'current':($index<$step?'prior':'') }}" @if($index===$step && $track['position_known']) aria-current="step" @endif>{{ $label }} @if($index===$step && $track['position_known'])<strong>{{ $halted?' / last recorded':' / current' }}</strong>@endif</li>@endforeach</ol>
    </details>
    <details id="preparation-events-{{ $reportId??$run->id }}" class="job-detail" open><summary>Activity timeline <span>{{ $events->count() }} updates / oldest first</span></summary>
        <ol class="preparation-events job-timeline">
        @forelse($events as $event)
            @php($observed=\Carbon\Carbon::parse($event['observed_at'])->timezone('Asia/Manila'))
            <li data-event-at="{{ $observed->getTimestampMs() }}"><div class="job-event-heading"><strong>{{ $steps[$event['step']??-1]??ucfirst(str_replace('_',' ',$event['stage'])) }}</strong><time datetime="{{ $observed->toIso8601String() }}">{{ $observed->format('M j, g:i:s A') }}</time></div><span class="job-event-state">@if(($attempts??collect([$run]))->count()>1)Attempt {{ $event['attempt_number'] }} &middot; @endif{{ ucfirst(str_replace('_',' ',$event['status'])) }}</span><p>{{ $event['message'] }}</p></li>
        @empty<li>No stage history has been observed for this job yet.</li>@endforelse
        </ol>
        <p class="fine">Observed status changes across attempts, oldest to newest. Repeated polls are deduplicated; up to 100 transitions per attempt are retained.</p>
    </details>
    <details id="preparation-resources-{{ $reportId??$run->id }}" class="job-detail"><summary>Worker &amp; resource details</summary>
        @if(isset($track['observed_at']))<p class="fine">Last observed <time>{{ \Carbon\Carbon::parse($track['observed_at'])->timezone('Asia/Manila')->format('M j, g:i:s A') }}</time>@if(isset($track['worker_updated_at'])) &middot; UniRig heartbeat {{ \Carbon\Carbon::parse($track['worker_updated_at'])->timezone('Asia/Manila')->format('g:i:s A') }}@endif</p>@else<p class="fine">No new worker observation recorded yet. Earlier stage timings were not collected.</p>@endif
        @if(!empty($track['resources']['sample']))
            <div class="job-resource-grid">@foreach(['gpu_free_mib'=>'GPU memory free','gpu_used_mib'=>'GPU memory used / whole device','vm_available_mib'=>'Docker VM memory available'] as $key=>$label)@if(isset($track['resources']['sample'][$key]))<div><span>{{ $label }}</span><strong>{{ number_format($track['resources']['sample'][$key]) }} MiB</strong></div>@endif @endforeach</div>
            <p class="fine">UniRig snapshot observed {{ \Carbon\Carbon::parse($track['resources']['observed_at'])->timezone('Asia/Manila')->format('M j, g:i:s A') }}. This is not a live measurement of the animation worker or a guarantee that admission requirements are met.</p>
        @endif
        <p class="fine">Worker polls approximately every 20 seconds; the page refreshes every 10 seconds. Private raw subprocess logs are not streamed here.</p>
    </details>
</section>
