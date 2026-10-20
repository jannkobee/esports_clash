<div class="collection-toolbar report-toolbar" data-list-controls="#live-reports">
    <label class="collection-search">Find a job<input type="search" data-list-search placeholder="Avatar name, status or job ID"></label>
    <label>Job order<select data-list-sort><option value="oldest">Oldest first</option><option value="newest">Newest first</option><option value="name">Avatar: A to Z</option></select></label>
    <button type="button" class="quiet" data-list-reset>Reset filters</button>
</div>
<p class="fine collection-results" data-list-results="#live-reports" role="status">Latest {{ count($runs) }} retained reports, in chronological order.</p>
