@extends('evolution.layout')
@section('title', 'Avatar registry')
@section('content')
<div class="page-heading"><div><p class="eyebrow">SHARED GAME CATALOG</p><h1>Avatar registry</h1><p class="muted">The published roster used by the engine, generation and asset preparation.</p></div><a class="button" href="{{ route('management.index','avatar') }}">Design drafts</a></div>
<div class="notice">{{ $entries->count() }} avatars shown. Engines refresh published content automatically. Active matches and replays retain their recorded catalog.</div>
<p class="fine" style="overflow-wrap:anywhere">Catalog {{ $hash }}</p>
<form method="get" class="panel manage-filter"><label>Find avatar<input name="q" value="{{ request('q') }}" maxlength="100" placeholder="Current name, old alias or stable ID"></label><button>Search</button><a href="{{ route('registry.index') }}">Clear</a></form>
<div class="manage-cards">
@forelse($entries as $entry)
@php($p=$entry->payload)
<article class="panel manage-card"><div class="section-heading"><span class="badge good">Published</span><span class="fine">v{{ $entry->version }}</span></div><h2><a href="{{ route('registry.edit',$entry->id) }}">{{ $p['displayName'] }}</a></h2><p>{{ $p['title'] }}</p><p class="fine">{{ $p['primaryRole'] }} · Previously {{ $p['legacyName'] }} · {{ $entry->id }}</p><p class="muted">{{ ($p['assets']['status']??null)==='missing' ? 'Previous model and picture versions deleted. New base, rig and animation pipeline pending.' : 'Original character art and animation qualification pending.' }}</p><a href="{{ route('registry.edit',$entry->id) }}">Edit published avatar &amp; inspect pipeline →</a></article>
@empty<p class="panel">No matching avatars.</p>@endforelse
</div>
@endsection
