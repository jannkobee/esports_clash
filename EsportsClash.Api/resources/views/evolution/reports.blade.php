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

    @php
        $passedCount = $runs->filter(fn($r) => ($r->result['evaluation']['passes_exploratory_gate'] ?? false)||($r->result['assessment']['status']??'')==='promote')->count();
        $failedCount = $runs->filter(fn($r) => $r->error || ($r->status === 'completed' && !($r->result['evaluation']['passes_exploratory_gate'] ?? false)&&($r->result['assessment']['status']??'')!=='promote'))->count();
        $runningCount = $runs->filter(fn($r) => in_array($r->status, ['running', 'collecting', 'training']))->count();
    @endphp

    <div class="category-filter-bar" data-target="#learning">
        <button type="button" class="category-pill active" data-category="all">All Runs <span class="category-count">{{ count($runs) }}</span></button>
        <button type="button" class="category-pill pill-success" data-category="success">✓ Passed / Qualified <span class="category-count">{{ $passedCount }}</span></button>
        <button type="button" class="category-pill pill-failed" data-category="failed">✕ Failed / Not Qualified <span class="category-count">{{ $failedCount }}</span></button>
        <button type="button" class="category-pill pill-running" data-category="running">⏳ Active <span class="category-count">{{ $runningCount }}</span></button>
    </div>

    @forelse($runs as $run)
        @if(in_array($run->plan['version']??0,[3,4],true))
            <article class="run-row"><div class="run-title"><a href="{{ route('evolution.report',$run) }}">{{ $run->plan['domain'] }} intelligence study</a><span class="badge">{{ $run->status }}</span></div>
            <p>{{ $run->progress['stage']??'Waiting' }}@if(isset($run->progress['planned'])) · {{ $run->progress['complete']??0 }} / {{ $run->progress['planned'] }}@endif</p>
            @if($a=$run->result['assessment']??null)<p>{{ $a['status'] }} · {{ implode(', ',$a['reasons']??[]) }}</p>@endif
            @if($run->error)<p class="error-text">{{ $run->error }}</p>@endif</article>
            @continue
        @endif
        @php
            $done = (int) ($run->progress['completed'] ?? 0);
            $planned = max(1, (int) ($run->progress['planned'] ?? 80));
            $evaluation = $run->result['evaluation'] ?? [];
            $hasPassed = ($evaluation['passes_exploratory_gate'] ?? false);
            $hasFailed = (bool) $run->error || ($run->status === 'completed' && !$hasPassed);
            $isRunning = in_array($run->status, ['running', 'collecting', 'training']);
            $cat = $hasPassed ? 'success' : ($hasFailed ? 'failed' : ($isRunning ? 'running' : 'all'));
        @endphp
        <article class="run-row" data-status-category="{{ $cat }}">
            <div class="run-title">
                <a href="{{ route('evolution.report', $run) }}">{{ $run->created_at->timezone('Asia/Manila')->format('M j, Y · g:i A') }}</a>
                <span class="badge {{ $hasPassed ? 'good' : ($hasFailed ? 'danger' : '') }}">
                    {{ $run->status === 'completed' ? ($hasPassed ? 'Exploratory gate passed · offline' : 'Evaluated · not qualified') : ucfirst($run->status) }}
                </span>
            </div>

            <div class="progress-caption"><span>{{ ucfirst($run->progress['stage'] ?? 'Waiting') }}</span><span>{{ $done }} / {{ $planned }} planned worlds</span></div>
            <progress max="{{ $planned }}" value="{{ min($done, $planned) }}" aria-label="World collection progress"></progress>

            {{-- What Succeeded vs What Failed Categorization --}}
            @if($run->error)
                <div class="failure-box">
                    <div class="failure-box-title">✕ Execution Failure</div>
                    <p class="error-text">{{ $run->error }}</p>
                </div>
            @endif

            @if($run->result)
                @if($hasPassed)
                    <div class="success-box">
                        <div class="success-box-title">✓ Exploratory Gate: Passed</div>
                        <p class="fine">{{ $evaluation['valid'] ?? '—' }} valid evaluation cases · {{ $evaluation['changed'] ?? '—' }} changed decisions · Remains offline</p>
                        @if(isset($evaluation['reason']))<p class="fine">{{ $evaluation['reason'] }}</p>@endif
                    </div>
                @else
                    <div class="failure-box">
                        <div class="failure-box-title">✕ Exploratory Gate: Not passed</div>
                        <p class="fine">{{ $evaluation['valid'] ?? '—' }} valid evaluation cases · {{ $evaluation['changed'] ?? '—' }} changed decisions · Remains offline</p>
                        @if(isset($evaluation['reason']))<p class="fine">{{ $evaluation['reason'] }}</p>@endif
                    </div>
                @endif
            @endif

            {{-- Stat Chips --}}
            <div class="stat-chips">
                @if(isset($run->progress['counts']))
                    <span class="stat-chip">Valid cases: <strong>{{ $run->progress['counts']['valid'] ?? 0 }}</strong></span>
                    <span class="stat-chip">No-target: <strong>{{ $run->progress['counts']['no-target'] ?? 0 }}</strong></span>
                    <span class="stat-chip">Learned changes: <strong>{{ $run->progress['learned_action_changes'] ?? 0 }}</strong></span>
                    <span class="stat-chip">Contrasts: <strong>{{ $run->progress['informative_contrasts'] ?? 0 }}</strong></span>
                @endif
                @if(isset($run->progress['worlds_per_minute']))
                    <span class="stat-chip">Speed: <strong>{{ number_format($run->progress['worlds_per_minute'], 1) }} w/min</strong></span>
                    <span class="stat-chip">Sim workers: <strong>{{ $run->progress['active_simulation_workers'] ?? 0 }}</strong></span>
                @endif
            </div>

            {{-- Folded Deep Telemetry Details --}}
            @if(isset($run->progress['checkpoint_hash']) || isset($run->progress['worlds_per_minute']))
                <details class="clean-details">
                    <summary>Telemetry, Collector &amp; Checkpoints</summary>
                    <div class="clean-details-content fine">
                        @if(isset($run->progress['worlds_per_minute']))
                            <p>{{ $run->progress['speed'] ?? 'headless' }} · {{ number_format($run->progress['worlds_per_minute'], 2) }} worlds/min · {{ number_format($run->progress['mean_world_seconds'], 1) }} s/world · {{ number_format($run->progress['simulated_seconds_per_wall_second'], 2) }} game seconds/wall second · est. remaining {{ number_format(($run->progress['estimated_remaining_collection_seconds'] ?? 0) / 60, 1) }} min</p>
                        @endif
                        @if(isset($run->progress['checkpoint_hash']))
                            <p>Batch {{ $run->progress['current_batch_size'] ?? '—' }} · {{ $run->progress['collector'] ?? 'trusted live executor' }} · checkpoint <code>{{ $run->progress['checkpoint_hash'] }}</code></p>
                        @endif
                    </div>
                </details>
            @endif

            <div class="run-links">
                <a href="{{ route('evolution.report', $run) }}">View report →</a>
                <a href="{{ route('evolution.download', $run) }}">Download JSON</a>
                <code>{{ $run->id }}</code>
            </div>
            @include('evolution.delete-report',['type'=>'ml'])
        </article>
    @empty
        <p class="muted">No studies recorded yet. Start a cycle or enable the schedule.</p>
    @endforelse
</section>
@include('evolution.resources')
