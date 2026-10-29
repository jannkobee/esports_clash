@extends('evolution.layout')
@section('title', ucfirst($kind).' management')
@section('content')
<div class="page-heading"><div><p class="eyebrow">CONTENT STUDIO &middot; MANUAL CONTROLS</p><h1>{{ ucfirst($kind) }} management</h1><p class="muted">{{ $kind === 'avatar' ? 'Build a character, shape its look, and write a design prompt for every skill.' : 'Create items, set their proposed stats, and describe their appearance and effects.' }}</p></div><a class="button primary" href="{{ route('management.create',$kind) }}">+ Create {{ $kind }}</a></div>
<div class="notice">These are editable design drafts. Saving or marking ready for review does not publish gameplay changes or start AI / 3D jobs.</div>
@if($kind==='avatar')<div class="notice"><a href="{{ route('registry.index') }}">Open the published avatar registry</a> for the current roster, engine values, skills and asset status. Existing design drafts below remain available.</div>@endif
<section class="panel"><div class="section-heading"><div><h2>Start from the existing {{ $kind === 'avatar' ? 'roster' : 'items' }}</h2><p class="muted">Import {{ $kind === 'avatar' ? '45 avatars' : '49 items, including boots' }} as drafts. Existing imported designs are kept, including your edits.</p></div><form method="post" action="{{ route('management.import',$kind) }}">@csrf<button>Import existing {{ $kind === 'avatar' ? 'avatars' : 'items' }}</button></form></div></section>
<form class="panel manage-filter" method="get">
<label>Search by name<input name="q" value="{{ request('q') }}" maxlength="100" placeholder="{{ $kind === 'avatar' ? 'e.g. Arsenaldo' : 'e.g. Greatsword' }}"></label>
<label>Status<select name="status"><option value="">All designs</option>@foreach(['draft'=>'Draft','review'=>'Ready for review','archived'=>'Archived'] as $value=>$label)<option value="{{ $value }}" @selected(request('status')===$value)>{{ $label }}</option>@endforeach</select></label>
<button>Find designs</button><a href="{{ route('management.index',$kind) }}">Clear filters</a>
</form>
<p class="fine">{{ $entries->total() }} matching designs &middot; Select a design to edit its details and prompts.</p>
<div class="manage-cards">
@forelse($entries as $entry)
<a class="panel manage-card" href="{{ route('management.edit',[$kind,$entry]) }}"><div class="section-heading"><span class="badge {{ $entry->status==='review'?'good':'' }}">{{ ['draft'=>'Draft','review'=>'Ready for review','archived'=>'Archived'][$entry->status] }}</span><span class="fine">v{{ $entry->version }}</span></div><h2>{{ $entry->name }}</h2><p class="muted">{{ $kind==='avatar' ? ($entry->payload['title']??$entry->payload['primaryRole']) : ($entry->payload['tier'].' / '.$entry->payload['cost'].' gold') }}</p><p class="fine">{{ $entry->source_id ? 'Imported from current game' : 'Custom design' }} &middot; Updated {{ $entry->updated_at->diffForHumans() }}</p><span>Edit design &rarr;</span></a>
@empty
<div class="panel manage-empty"><h2>No designs here yet</h2><p class="muted">{{ request('q') || request('status') ? 'Try clearing the filters, or create a new design.' : 'Import the existing catalog above, or create your first design.' }}</p></div>
@endforelse
</div>
@include('evolution.management.pagination',['pager'=>$entries])
@endsection
