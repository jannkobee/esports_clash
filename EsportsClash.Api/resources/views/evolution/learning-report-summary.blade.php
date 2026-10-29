@php($brief = app(\App\Services\LearningReportSummary::class)->describe($run))
<section class="ml-brief ml-brief--{{ $brief['tone'] }}" aria-labelledby="ml-tldr-heading">
    <div class="ml-brief-top"><p class="ml-kicker">TL;DR</p><span class="ml-state">{{ $brief['stageLabel'] }}</span></div>
    <h2 id="ml-tldr-heading">{{ $brief['title'] }}</h2>
    <ul class="ml-bullets">@foreach($brief['bullets'] as $bullet)<li>{{ $bullet }}</li>@endforeach</ul>
    @if($brief['bar'])
    <div class="ml-stage-progress">
        <div><span>Current stage progress</span><strong>{{ $brief['bar']['complete'] }} / {{ $brief['bar']['planned'] }}</strong></div>
        <progress aria-label="Current stage progress" value="{{ $brief['bar']['percent'] }}" max="100">{{ round($brief['bar']['percent']) }}%</progress>
    </div>
    @endif
</section>
<div class="ml-stat-grid" aria-label="Recorded learning results">
    @foreach($brief['metrics'] as $metric)<article class="ml-stat"><h3>{{ $metric['label'] }}</h3><strong>{{ $metric['value'] }}</strong><p>{{ $metric['note'] }}</p></article>@endforeach
</div>
<div class="ml-insight-grid">
    <section class="ml-insight" aria-labelledby="ml-changes-heading"><h2 id="ml-changes-heading">What changed?</h2>
        @if($brief['changes'])
        <ul class="ml-comparison-list">@foreach($brief['changes'] as $change)<li><span>{{ $change['label'] }}</span><strong>{{ $change['before'] }} <span aria-label="to">&rarr;</span> {{ $change['after'] }}</strong></li>@endforeach</ul>
        <p class="ml-caption">Previous &rarr; candidate averages. These changes alone do not prove better play.</p>
        @else<ul class="ml-bullets"><li>No before-and-after gameplay measurements yet.</li><li>Results will appear when comparisons are recorded.</li></ul>@endif
    </section>
    <section class="ml-insight" aria-labelledby="ml-next-heading"><h2 id="ml-next-heading">What happens next?</h2>
        <ul class="ml-bullets"><li>{{ $brief['next'] }}</li></ul>
        <h3>Keep in mind</h3><ul class="ml-bullets ml-secondary">@foreach(array_slice($brief['limits'], 0, 2) as $limit)<li>{{ $limit }}</li>@endforeach</ul>
        @if($run->status==='paused_budget' && in_array($run->plan['version']??0,[3,4],true))<form method="post" action="{{ route('intelligence.resume',$run->id) }}">@csrf<button>Resume study</button></form>@endif
    </section>
</div>
