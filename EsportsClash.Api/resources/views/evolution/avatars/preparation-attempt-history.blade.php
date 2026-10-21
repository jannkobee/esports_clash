@if($attempts->count()>1)
<details class="job-detail" id="preparation-history-{{ $reportId }}">
    <summary>Attempt history <span>{{ $attempts->count() }} attempts / oldest first</span></summary>
    <p class="fine">Earlier results are retained here. The status and actions above apply to the current attempt.</p>
    @foreach($attempts as $attempt)
    <details class="job-detail" id="preparation-attempt-{{ $attempt->id }}">
        <summary>Attempt {{ $loop->iteration }}{{ $attempt->id===$run->id?' / current':'' }} <span>{{ $statusLabels[$attempt->status]??ucfirst(str_replace('_',' ',$attempt->status)) }} &middot; {{ $attempt->created_at->timezone('Asia/Manila')->format('M j, g:i A') }}</span></summary>
        <p class="fine">Execution {{ $attempt->id }}</p>
        @if($attempt->error)<p>{{ $attempt->error }}</p>@endif
        @if($attempt->id!==$run->id)
            @foreach(($attempt->state['preparation']['mapping_review']['reasons']??$attempt->state['report']['reasons']??$attempt->state['preparation']['problems']??[]) as $reason)<p>{{ $reason }}</p>@endforeach
        @endif
        <a href="{{ route('preparations.report',[$attempt,'format'=>'json']) }}">Download recorded evidence</a>
        @if(isset($attempt->state['preparation']['sha256']))<a class="button quiet" href="{{ route('preparations.preview',$attempt) }}">Review this attempt's model</a>@endif
    </details>
    @endforeach
</details>
@endif
