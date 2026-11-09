@extends('evolution.layout')
@section('title', ucfirst($kind).' catalog')
@section('content')
<div class="page-heading"><div><p class="eyebrow">SHARED GAME CATALOG</p><h1>{{ $kind==='item'?'Items':'Skills & abilities' }}</h1><p class="muted">Manage the content used by the web. Saved changes apply when a new catalog is loaded; running matches retain their starting values.</p></div><a class="button primary" href="{{ route('catalog.create',$kind) }}">Create {{ $kind }}</a></div>
<div class="actions"><a class="button" href="{{ route('catalog.index','item') }}">Items</a><a class="button" href="{{ route('catalog.index','skill') }}">Skills & abilities</a>@if($kind==='item')<a href="{{ route('management.index','item') }}">Item design drafts</a>@endif</div>
<form method="get" class="panel manage-filter">
<label>Search<input name="q" value="{{ request('q') }}" maxlength="100" placeholder="Name, avatar or description"></label>
<label>Entries<select name="status"><option value="active" @selected(request('status')!=='deleted')>Active</option><option value="deleted" @selected(request('status')==='deleted')>Deleted</option></select></label>
<button>Search</button><a href="{{ route('catalog.index',$kind) }}">Clear</a>
</form>
<p class="fine">{{ $entries->total() }} entries</p>
<div class="manage-cards">
@forelse($entries as $entry)
@php($p=$entry->payload)
<article class="panel manage-card">
<div class="section-heading"><span class="badge">{{ $entry->trashed()?'Deleted':($entry->builtin?'Game definition':'Custom') }}</span><span class="fine">v{{ $entry->version }}</span></div>
<div class="catalog-card-heading">
@include('evolution.catalog.image',['payload'=>$p,'name'=>$p['name']])
<div><h2><a href="{{ route('catalog.edit',[$kind,$entry->id]) }}">{{ $p['name'] }}</a></h2><p class="fine">{{ $kind==='skill'?($p['avatarName']??'Unassigned library skill').' / '.($p['slot']??'library'):$p['tier'].' / '.$p['cost'].' gold' }}</p></div></div>
<p class="muted catalog-excerpt">{{ $p[$kind==='item'?'passiveDesc':'desc']??'' }}</p>
<a href="{{ route('catalog.edit',[$kind,$entry->id]) }}">{{ $entry->trashed()?'View & restore':'Edit details & image' }} &rarr;</a>
</article>
@empty
<div class="panel"><h2>No entries found</h2><p>Try another search or create an entry.</p></div>
@endforelse
</div>
@include('evolution.management.pagination',['pager'=>$entries])
@endsection
