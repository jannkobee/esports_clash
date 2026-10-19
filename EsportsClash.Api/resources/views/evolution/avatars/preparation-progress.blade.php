@php
    $track=app(\App\Services\PreparationProgressService::class)->view($run);
    $step=(int)$track['step'];
    $steps=\App\Services\PreparationProgressService::STEPS;
    $halted=in_array($run->status,['failed','cancelled','cancelling','pausing','paused','waiting_worker'],true);
@endphp
<section class="preparation-progress" aria-label="Preparation progress for {{ $catalog[$run->avatar_id]['name']??$run->avatar_id }}">
@if($track['position_known'])
<div class="progress-caption"><strong>{{ $halted?'Last workflow position':'Workflow stage' }} {{ $step+1 }} of {{ count($steps) }}: {{ $steps[$step] }}</strong><span>Job age {{ $run->created_at->diffForHumans(null,true) }} (includes waiting)</span></div>
<progress value="{{ $step+1 }}" max="{{ count($steps) }}" aria-label="Workflow stage {{ $step+1 }} of {{ count($steps) }}"></progress>
@else<p class="fine">The earlier workflow position was not recorded for this job.</p>@endif
<p class="preparation-message" role="status">{{ $track['message'] }}</p>
<p class="fine">Stage-based progress, not an inference percentage or time estimate. Worker polls approximately every 20 seconds; this page refreshes every 10 seconds.</p>
@if(isset($track['observed_at']))<p class="fine">Last observed {{ \Carbon\Carbon::parse($track['observed_at'])->timezone('Asia/Manila')->format('M j, g:i:s A') }}@if(isset($track['worker_updated_at'])) &middot; UniRig heartbeat {{ \Carbon\Carbon::parse($track['worker_updated_at'])->timezone('Asia/Manila')->format('g:i:s A') }}@endif</p>@else<p class="fine">No new worker observation recorded yet. Earlier stage timings were not collected.</p>@endif
@if(!empty($track['resources']['sample']))
<div class="preparation-resources">@foreach(['gpu_free_mib'=>'Free GPU memory','gpu_used_mib'=>'GPU memory used (whole device)','vm_available_mib'=>'Available Docker VM memory'] as $key=>$label)@if(isset($track['resources']['sample'][$key]))<span>{{ $label }}: <strong>{{ number_format($track['resources']['sample'][$key]) }} MiB</strong></span>@endif @endforeach</div>
<p class="fine">Last UniRig resource sample observed {{ \Carbon\Carbon::parse($track['resources']['observed_at'])->timezone('Asia/Manila')->format('g:i:s A') }}; this is not a live measurement of the animation worker.</p>
@endif
<details id="preparation-stages-{{ $run->id }}"><summary>All workflow stages</summary><ol class="preparation-stages">@foreach($steps as $index=>$label)<li class="{{ $index===$step?'current':($index<$step?'prior':'') }}" @if($index===$step) aria-current="step" @endif>{{ $label }} @if($index===$step)<strong> &larr; {{ $halted?'last position':'current' }}</strong>@endif</li>@endforeach</ol></details>
<details id="preparation-events-{{ $run->id }}"><summary>Detailed observed messages ({{ count($track['events']??[]) }})</summary>
<p class="fine">Real stage/status changes observed by Laravel, newest first. Repeated polls do not add duplicate messages. Up to 100 recent transitions are retained; private raw subprocess logs are not streamed here.</p>
<ol class="preparation-events">@forelse(array_reverse($track['events']??[]) as $event)<li><time>{{ \Carbon\Carbon::parse($event['observed_at'])->timezone('Asia/Manila')->format('M j, g:i:s A') }}</time><strong>{{ str_replace('_',' ',$event['stage']) }} &middot; {{ str_replace('_',' ',$event['status']) }}</strong><p>{{ $event['message'] }}</p></li>@empty<li>No stage history has been observed for this job yet.</li>@endforelse</ol>
</details>
</section>
