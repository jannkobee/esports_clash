@extends('evolution.layout')
@section('title', 'Game modes')
@section('content')
<section class="panel">
    <h1>Game modes</h1>
    <p><a class="button-tactile" href="{{ rtrim(config('game_bootstrap.game_url'), '/') }}#fps-simulation">Watch FPS simulation</a>
    <a href="{{ rtrim(config('game_bootstrap.game_url'), '/') }}#hexapedia/fps">Open current FPS reference</a></p>
    <p>Tactical FPS is the active match format. MOBA can be disabled without deleting its engine, catalog, pipeline or historical recordings.</p>
    @if(session('status'))<p role="status">{{ session('status') }}</p>@endif
    @if($errors->any())<p role="alert">{{ $errors->first() }}</p>@endif
    <form method="post" action="{{ route('game-modes.update') }}">
        @csrf
        <input type="hidden" name="moba_enabled" value="0">
        <label><input type="checkbox" name="moba_enabled" value="1" @checked($modes['moba_enabled'])> Enable MOBA exhibitions and reference pages</label>
        <p>When disabled, new MOBA entry points, avatar/item reference pages and public laboratory links are unavailable. Old recordings remain replayable. This does not stop an already allocated match or delete any data.</p>
        <button class="button-tactile">Save game modes</button>
    </form>
</section>
@endsection
