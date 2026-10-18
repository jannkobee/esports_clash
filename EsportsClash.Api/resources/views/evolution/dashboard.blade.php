@extends('evolution.layout')
@section('title', 'ML controls')
@section('content')
<div class="page-heading"><div><p class="eyebrow">MACHINE LEARNING</p><h1>ML controls</h1><p class="muted">Inspect studies and make the next balance decision.</p></div><div class="live-indicator"><span class="dot"></span><span id="live-status" role="status">Reports refresh every 10 seconds</span></div></div>
<p class="notice">This study explores bounded macro decisions. It does not authorize production promotion, mechanical patch releases, or avatar generation.</p>
<div id="live-reports" data-url="{{ route('evolution.live') }}">@include('evolution.reports')</div>
@include('evolution.operations-controls')
<div class="columns">
<section class="panel" id="schedule">
    <p class="eyebrow">AUTOMATION</p><h2>Schedule &amp; review window</h2>
    <p class="muted">Next eligible cycle: {{ $settings->next_training_at?->timezone('Asia/Manila')->format('M j, g:i A') ?? 'Not scheduled' }}. An active cycle finishes before another begins.</p>
    <form method="post" action="{{ route('evolution.settings') }}" class="settings-form">
        @csrf
        <label>Cycle interval (minutes)<input name="training_interval_minutes" type="number" min="30" max="10080" value="{{ old('training_interval_minutes', $settings->training_interval_minutes) }}" required></label>
        <label>Review window (hours)<input name="review_hours" type="number" min="1" max="336" value="{{ old('review_hours', $settings->review_hours) }}" required></label>
        <button>Save schedule</button>
    </form>
    <form method="post" action="{{ route('evolution.settings') }}" class="actions">@csrf<input type="hidden" name="enabled" value="{{ $settings->enabled ? '0' : '1' }}"><button>{{ $settings->enabled ? 'Pause automatic cycles' : 'Resume automatic cycles' }}</button></form>
    <p class="fine">Pausing the schedule does not stop an active study. After a review deadline, the conservative substitute retains an intact eligible keep-current option or declines.</p>
</section>
<section class="panel" id="history">
    <p class="eyebrow">AUDIT TRAIL</p><h2>Decision history</h2>
    <ol class="timeline">@forelse($audit as $event)<li><strong>{{ $event->action }}</strong><span>{{ \Carbon\CarbonImmutable::parse($event->created_at)->timezone('Asia/Manila')->format('M j, g:i A') }} · {{ $event->actor }}</span></li>@empty<li>No decisions recorded.</li>@endforelse</ol>
</section>
</div>
<section class="panel" id="balance">
    <p class="eyebrow">OWNER REVIEW</p><h2>Balance laboratory</h2>
    <p class="muted">Choose an eligible option, reject individual proposals, decline a batch, or extend its deadline. This macro study supports keeping current balance; buff/nerf alternatives require separate evidence and simulations.</p>
    @forelse($reviews as $review)
    <article class="review">
        <div class="section-heading"><h3>{{ ucfirst($review->status) }} review</h3><span class="fine">Deadline {{ $review->deadline_at->timezone('Asia/Manila')->format('M j, g:i A') }}</span></div>
        @if($review->reason)<p class="fine">{{ $review->reason }} · {{ $review->decided_by }}</p>@endif
        <div class="proposal-grid">@foreach($review->proposals as $proposal)
            <div class="proposal"><span class="badge">{{ ucfirst($proposal->status) }}</span><h3>{{ $proposal->title }}</h3><p class="fine">{{ $proposal->evidence['reason'] ?? '' }}</p>
                @foreach($proposal->changes as $change)<p>{{ $change['target'] }} · {{ $change['field'] }}: {{ $change['current'] }} → {{ $change['proposed'] }}</p>@endforeach
                @if($review->status === 'open' && $proposal->status === 'pending')<div class="actions">
                    <form method="post" action="{{ route('evolution.decide', $review->id) }}">@csrf<input type="hidden" name="action" value="select"><input type="hidden" name="proposal_id" value="{{ $proposal->id }}"><button class="primary" @disabled(!app(\App\Services\EvolutionService::class)->eligible($proposal))>Choose this option</button></form>
                    <form method="post" action="{{ route('evolution.decide', $review->id) }}">@csrf<input type="hidden" name="action" value="reject"><input type="hidden" name="proposal_id" value="{{ $proposal->id }}"><button>Reject</button></form>
                </div>@endif
            </div>
        @endforeach</div>
        @if($review->status === 'open')<div class="actions">
            <form method="post" action="{{ route('evolution.decide', $review->id) }}">@csrf<input type="hidden" name="action" value="decline"><button class="danger">Decline all proposals</button></form>
            <form method="post" action="{{ route('evolution.decide', $review->id) }}" class="inline-form">@csrf<input type="hidden" name="action" value="defer"><label>Extend by (hours)<input name="hours" type="number" min="1" max="336" required value="{{ $settings->review_hours }}"></label><button>Extend deadline</button></form>
        </div>@endif
    </article>
    @empty<p class="muted">No review batches yet. A completed study creates its evidence-backed keep-current review.</p>@endforelse
</section>
@endsection
