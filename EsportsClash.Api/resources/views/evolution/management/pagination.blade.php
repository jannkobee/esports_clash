@if($pager->hasPages())
<nav class="manage-pagination" aria-label="Pagination">
@if($pager->onFirstPage())<span class="muted">&larr; Previous</span>@else<a class="button" href="{{ $pager->previousPageUrl() }}" rel="prev">&larr; Previous</a>@endif
<span>Page {{ $pager->currentPage() }} of {{ $pager->lastPage() }}</span>
@if($pager->hasMorePages())<a class="button" href="{{ $pager->nextPageUrl() }}" rel="next">Next &rarr;</a>@else<span class="muted">Next &rarr;</span>@endif
</nav>
@endif
