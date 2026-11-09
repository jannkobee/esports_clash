@extends('evolution.layout')
@section('title', 'Machine Learning')
@section('content')
<div class="page-heading">
    <div>
        <p class="eyebrow">AUTOMATED SIMULATION &amp; BALANCE</p>
        <h1>Machine Learning</h1>
        <p class="muted">Simulation telemetry, balance decisions, and learning automation.</p>
    </div>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <button type="button" class="quiet" onclick="document.getElementById('modal-ml-settings').showModal()">⚙️ Settings</button>
        <button type="button" class="quiet" onclick="document.getElementById('modal-ml-proposals').showModal()">📋 Proposals @if($reviews->where('status','open')->count())<span class="category-count">{{ $reviews->where('status','open')->count() }}</span>@endif</button>
        <div class="live-indicator"><span class="dot"></span><span id="live-status" role="status">Reports refresh every 10s</span></div>
    </div>
</div>

<details class="clean-details" style="margin-bottom: 20px;">
    <summary>Policy Scope &amp; Safety Boundary</summary>
    <div class="clean-details-content">
        <p class="notice" style="margin: 0;">This study explores bounded macro decisions. It does not authorize production promotion, mechanical patch releases, or avatar generation.</p>
    </div>
</details>

<div id="live-reports" data-url="{{ route('evolution.live') }}">@include('evolution.reports')</div>
@include('evolution.intelligence-controls')
@include('evolution.operations-controls')

<div class="columns">
<section class="panel" id="schedule">
    <p class="eyebrow">AUTOMATION</p>
    <h2>Schedule &amp; review window</h2>
    <div class="stat-chips" style="margin-bottom: 14px;">
        <span class="stat-chip">Next cycle: <strong>{{ $settings->next_training_at?->timezone('Asia/Manila')->format('M j, g:i A') ?? 'Not scheduled' }}</strong></span>
        <span class="stat-chip">State: <strong>{{ $settings->enabled ? 'Active' : 'Paused' }}</strong></span>
    </div>
    <form method="post" action="{{ route('evolution.settings') }}" class="settings-form">
        @csrf
        <label>Cycle interval (minutes)<input name="training_interval_minutes" type="number" min="30" max="10080" value="{{ old('training_interval_minutes', $settings->training_interval_minutes) }}" required></label>
        <label>Review window (hours)<input name="review_hours" type="number" min="1" max="336" value="{{ old('review_hours', $settings->review_hours) }}" required></label>
        <button class="primary">Save schedule</button>
    </form>
    <form method="post" action="{{ route('evolution.settings') }}" class="actions" style="margin-top: 14px;">
        @csrf
        <input type="hidden" name="enabled" value="{{ $settings->enabled ? '0' : '1' }}">
        <button class="{{ $settings->enabled ? 'danger' : 'primary' }}">{{ $settings->enabled ? 'Pause automatic cycles' : 'Resume automatic cycles' }}</button>
    </form>
    <p class="fine" style="margin-top: 10px;">Pausing the schedule does not stop an active study. After a review deadline, the conservative substitute retains an intact eligible keep-current option or declines.</p>
</section>

<section class="panel" id="history">
    <p class="eyebrow">AUDIT TRAIL</p>
    <h2>Decision history</h2>
    <ol class="timeline">
        @forelse($audit as $event)
            <li>
                <strong>{{ $event->action }}</strong>
                <span>{{ \Carbon\CarbonImmutable::parse($event->created_at)->timezone('Asia/Manila')->format('M j, g:i A') }} · {{ $event->actor }}</span>
            </li>
        @empty
            <li>No decisions recorded.</li>
        @endforelse
    </ol>
</section>
</div>

<section class="panel" id="balance">
    <div class="section-heading">
        <div>
            <p class="eyebrow">OWNER REVIEW</p>
            <h2>Balance laboratory</h2>
        </div>
        <span class="fine">Eligible proposals backed by simulation evidence</span>
    </div>

    @forelse($reviews as $review)
    <article class="review">
        <div class="section-heading">
            <h3>{{ ucfirst($review->status) }} review</h3>
            <span class="fine">Deadline {{ $review->deadline_at->timezone('Asia/Manila')->format('M j, g:i A') }}</span>
        </div>
        @if($review->reason)<p class="fine">{{ $review->reason }} · {{ $review->decided_by }}</p>@endif
        
        <div class="proposal-grid">
            @foreach($review->proposals as $proposal)
            @php
                $eligible = app(\App\Services\EvolutionService::class)->eligible($proposal);
            @endphp
            <div class="proposal">
                <div class="section-heading" style="margin-bottom: 8px;">
                    <span class="badge {{ $proposal->status === 'selected' ? 'good' : ($proposal->status === 'rejected' ? 'danger' : '') }}">{{ ucfirst($proposal->status) }}</span>
                    @if($eligible)<span class="badge good">Eligible</span>@endif
                </div>
                <h3>{{ $proposal->title }}</h3>
                <p class="fine">{{ $proposal->evidence['reason'] ?? '' }}</p>
                <div class="stat-chips" style="margin: 10px 0;">
                    @foreach($proposal->changes as $change)
                        <span class="stat-chip"><strong>{{ $change['target'] }}</strong> {{ $change['field'] }}: {{ $change['current'] }} → {{ $change['proposed'] }}</span>
                    @endforeach
                </div>
                @if($review->status === 'open' && $proposal->status === 'pending')
                    <div class="actions">
                        <form method="post" action="{{ route('evolution.decide', $review->id) }}">
                            @csrf
                            <input type="hidden" name="action" value="select">
                            <input type="hidden" name="proposal_id" value="{{ $proposal->id }}">
                            <button class="primary" @disabled(!$eligible)>Choose this option</button>
                        </form>
                        <form method="post" action="{{ route('evolution.decide', $review->id) }}">
                            @csrf
                            <input type="hidden" name="action" value="reject">
                            <input type="hidden" name="proposal_id" value="{{ $proposal->id }}">
                            <button class="danger">Reject</button>
                        </form>
                    </div>
                @endif
            </div>
            @endforeach
        </div>

        @if($review->status === 'open')
            <div class="actions" style="margin-top: 18px;">
                <form method="post" action="{{ route('evolution.decide', $review->id) }}">
                    @csrf
                    <input type="hidden" name="action" value="decline">
                    <button class="danger">Decline all proposals</button>
                </form>
                <form method="post" action="{{ route('evolution.decide', $review->id) }}" class="inline-form">
                    @csrf
                    <input type="hidden" name="action" value="defer">
                    <label>Extend by (hours)<input name="hours" type="number" min="1" max="336" required value="{{ $settings->review_hours }}"></label>
                    <button>Extend deadline</button>
                </form>
            </div>
        @endif
    </article>
    @empty
        <p class="muted">No review batches yet. A completed study creates its evidence-backed keep-current review.</p>
    @endforelse
</section>

{{-- Machine Learning Settings Modal --}}
<dialog id="modal-ml-settings" class="evolution-modal">
    <div class="modal-dialog-content">
        <div class="modal-header">
            <div>
                <p class="eyebrow">MACHINE LEARNING</p>
                <h2>Automation &amp; Schedule Settings</h2>
            </div>
            <button type="button" class="modal-close" onclick="this.closest('dialog').close()" aria-label="Close modal">✕</button>
        </div>
        <div class="modal-body">
            <section class="panel" style="margin-bottom:16px;">
                <p class="eyebrow">AUTOMATION STATUS</p>
                <div class="stat-chips">
                    <span class="stat-chip">Next cycle: <strong>{{ $settings->next_training_at?->timezone('Asia/Manila')->format('M j, g:i A') ?? 'Not scheduled' }}</strong></span>
                    <span class="stat-chip">Schedule state: <strong>{{ $settings->enabled ? 'Active' : 'Paused' }}</strong></span>
                </div>
                <form method="post" action="{{ route('evolution.settings') }}" style="margin-top:14px;">
                    @csrf
                    <input type="hidden" name="enabled" value="{{ $settings->enabled ? '0' : '1' }}">
                    <button class="{{ $settings->enabled ? 'danger' : 'primary' }}">
                        {{ $settings->enabled ? 'Pause automatic learning cycles' : 'Resume automatic learning cycles' }}
                    </button>
                </form>
                <p class="fine" style="margin-top: 8px;">Pausing the schedule disables autonomous trigger cycles while retaining completed models and data.</p>
            </section>

            <section class="panel">
                <p class="eyebrow">CYCLE INTERVAL &amp; REVIEW DEADLINE</p>
                <form method="post" action="{{ route('evolution.settings') }}" class="settings-form">
                    @csrf
                    <label>Cycle interval (minutes)
                        <input name="training_interval_minutes" type="number" min="30" max="10080" value="{{ old('training_interval_minutes', $settings->training_interval_minutes) }}" required>
                    </label>
                    <label>Review window (hours)
                        <input name="review_hours" type="number" min="1" max="336" value="{{ old('review_hours', $settings->review_hours) }}" required>
                    </label>
                    <button class="primary" style="margin-top:8px;">Save schedule settings</button>
                </form>
            </section>
        </div>
        <div class="modal-footer">
            <button type="button" onclick="this.closest('dialog').close()">Close</button>
        </div>
    </div>
</dialog>

{{-- Balance Proposals Modal --}}
<dialog id="modal-ml-proposals" class="evolution-modal modal-large">
    <div class="modal-dialog-content">
        <div class="modal-header">
            <div>
                <p class="eyebrow">BALANCE LABORATORY</p>
                <h2>Pending Balance Proposals</h2>
            </div>
            <button type="button" class="modal-close" onclick="this.closest('dialog').close()" aria-label="Close modal">✕</button>
        </div>
        <div class="modal-body">
            @php $openReviews = $reviews->where('status', 'open'); @endphp
            @forelse($openReviews as $review)
                <article class="review" style="margin-bottom:16px;">
                    <div class="section-heading">
                        <h3>Open review batch</h3>
                        <span class="fine">Deadline: {{ $review->deadline_at->timezone('Asia/Manila')->format('M j, g:i A') }}</span>
                    </div>
                    <div class="proposal-grid">
                        @foreach($review->proposals as $proposal)
                        @php $eligible = app(\App\Services\EvolutionService::class)->eligible($proposal); @endphp
                        <div class="proposal">
                            <div class="section-heading" style="margin-bottom: 6px;">
                                <span class="badge {{ $proposal->status === 'selected' ? 'good' : ($proposal->status === 'rejected' ? 'danger' : '') }}">{{ ucfirst($proposal->status) }}</span>
                                @if($eligible)<span class="badge good">Eligible</span>@endif
                            </div>
                            <h3>{{ $proposal->title }}</h3>
                            <p class="fine">{{ $proposal->evidence['reason'] ?? '' }}</p>
                            <div class="stat-chips" style="margin: 8px 0;">
                                @foreach($proposal->changes as $change)
                                    <span class="stat-chip"><strong>{{ $change['target'] }}</strong> {{ $change['field'] }}: {{ $change['current'] }} → {{ $change['proposed'] }}</span>
                                @endforeach
                            </div>
                            @if($proposal->status === 'pending')
                            <div class="actions">
                                <form method="post" action="{{ route('evolution.decide', $review->id) }}">
                                    @csrf
                                    <input type="hidden" name="action" value="select">
                                    <input type="hidden" name="proposal_id" value="{{ $proposal->id }}">
                                    <button class="primary" @disabled(!$eligible)>Select</button>
                                </form>
                                <form method="post" action="{{ route('evolution.decide', $review->id) }}">
                                    @csrf
                                    <input type="hidden" name="action" value="reject">
                                    <input type="hidden" name="proposal_id" value="{{ $proposal->id }}">
                                    <button class="danger">Reject</button>
                                </form>
                            </div>
                            @endif
                        </div>
                        @endforeach
                    </div>
                </article>
            @empty
                <p class="muted" style="padding:24px 0; text-align:center;">No pending balance proposals require review right now.</p>
            @endforelse
        </div>
        <div class="modal-footer">
            <a class="button" href="#balance" onclick="this.closest('dialog').close()">Go to full laboratory &darr;</a>
            <button type="button" onclick="this.closest('dialog').close()">Close</button>
        </div>
    </div>
</dialog>
@endsection
