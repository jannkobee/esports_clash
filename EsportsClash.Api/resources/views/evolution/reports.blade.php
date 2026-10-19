<div class="metrics">
    <article class="metric"><span>Learning cycle</span><strong>{{ $active ? ucfirst($active->status) : 'Idle' }}</strong><small>{{ $active ? ($active->progress['stage'] ?? 'Waiting for worker') : 'No active training cycle' }}</small></article>
    <article class="metric"><span>Study history</span><strong>{{ $completedCount }} <em>/ {{ $runCount }}</em></strong><small>Completed / all recorded runs</small></article>
    <article class="metric"><span>Pending reviews</span><strong>{{ $openReviews }}</strong><small>Owner or deadline substitute</small></article>
    <article class="metric"><span>Automatic learning</span><strong>{{ $settings->enabled ? 'Enabled' : 'Paused' }}</strong><small>Every {{ $settings->training_interval_minutes }} minutes</small></article>
</div>
<section class="panel" id="learning">
    <div class="section-heading"><div><p class="eyebrow">REAL EXECUTION DATA</p><h2>Machine learning reports</h2></div><span class="fine">Updated {{ now('Asia/Manila')->format('g:i:s A') }}</span></div>
    @unless($reportOnly ?? false)<div class="actions">
        <form method="post" action="{{ route('evolution.start') }}">@csrf<button class="primary" @disabled($active)>Start learning cycle</button></form>
        @if($active)<form method="post" action="{{ route('evolution.stop', $active->id) }}">@csrf<button class="danger" @disabled($active->status === 'stopping')>Stop current cycle</button></form>@endif
    </div>@endunless
    @forelse($runs as $run)
        @php
            $done = (int) ($run->progress['completed'] ?? 0);
            $planned = max(1, (int) ($run->progress['planned'] ?? 80));
            $evaluation = $run->result['evaluation'] ?? [];
        @endphp
        <article class="run-row">
            <div class="run-title"><a href="{{ route('evolution.report', $run) }}">{{ $run->created_at->timezone('Asia/Manila')->format('M j, Y · g:i A') }}</a><span class="badge {{ ($evaluation['passes_exploratory_gate'] ?? false) ? 'good' : '' }}">{{ $run->status === 'completed' ? (($evaluation['passes_exploratory_gate'] ?? false) ? 'Exploratory gate passed · offline' : 'Evaluated · not qualified') : ucfirst($run->status) }}</span></div>
            <div class="progress-caption"><span>{{ ucfirst($run->progress['stage'] ?? 'Waiting') }}</span><span>{{ $done }} / {{ $planned }} planned worlds</span></div>
            <progress max="{{ $planned }}" value="{{ min($done, $planned) }}" aria-label="World collection progress"></progress>
            @if(isset($run->progress['counts']))<p class="fine">Valid {{ $run->progress['counts']['valid'] ?? 0 }} · no target {{ $run->progress['counts']['no-target'] ?? 0 }} · other/invalid {{ array_sum($run->progress['counts']) - ($run->progress['counts']['valid'] ?? 0) - ($run->progress['counts']['no-target'] ?? 0) }} · informative contrasts {{ $run->progress['informative_contrasts'] ?? 0 }} · learned changes {{ $run->progress['learned_action_changes'] ?? 0 }}</p>@endif
            @if(isset($run->progress['worlds_per_minute']))<p class="fine">{{ $run->progress['speed'] ?? 'headless' }} · {{ number_format($run->progress['worlds_per_minute'], 2) }} worlds/min · {{ number_format($run->progress['mean_world_seconds'], 1) }} s/world · {{ number_format($run->progress['simulated_seconds_per_wall_second'], 2) }} game seconds/wall second · estimated remaining collection {{ number_format($run->progress['estimated_remaining_collection_seconds'] / 60, 1) }} min · {{ $run->progress['active_simulation_workers'] ?? 0 }} simulator(s)</p>@endif
            @if($run->error)<p class="error-text">{{ $run->error }}</p>@endif
            @if(isset($run->progress['checkpoint_hash']))<p class="fine">Batch {{ $run->progress['current_batch_size'] ?? '—' }} · {{ $run->progress['collector'] ?? 'trusted live executor' }} · checkpoint <code>{{ $run->progress['checkpoint_hash'] }}</code></p>@endif
            @if($run->result)
                <p class="fine">Exploratory gate: <strong>{{ ($evaluation['passes_exploratory_gate'] ?? false) ? 'Passed' : 'Not passed' }}</strong> · {{ $evaluation['valid'] ?? '—' }} valid evaluation cases · {{ $evaluation['changed'] ?? '—' }} changed decisions · Remains offline</p>
                @if(isset($evaluation['reason']))<p class="fine">{{ $evaluation['reason'] }}</p>@endif
            @endif
            <div class="run-links"><a href="{{ route('evolution.report', $run) }}">View report →</a><a href="{{ route('evolution.download', $run) }}">Download JSON</a><code>{{ $run->id }}</code></div>
            @include('evolution.delete-report',['type'=>'ml'])
        </article>
    @empty<p class="muted">No studies recorded yet. Start a cycle or enable the schedule.</p>@endforelse
</section>
@include('evolution.resources')
