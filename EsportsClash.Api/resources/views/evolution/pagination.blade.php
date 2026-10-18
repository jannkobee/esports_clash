@if($runs->hasPages())
<nav class="actions" aria-label="Report pages">
    @if($runs->previousPageUrl())<a class="button" rel="prev" href="{{ $runs->previousPageUrl() }}">Previous</a>@endif
    <span class="fine">Page {{ $runs->currentPage() }} of {{ $runs->lastPage() }}</span>
    @if($runs->nextPageUrl())<a class="button" rel="next" href="{{ $runs->nextPageUrl() }}">Next</a>@endif
</nav>
@endif
