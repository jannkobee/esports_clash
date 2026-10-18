@extends('evolution.layout')
@section('title', 'Owner sign in')
@section('content')
<section class="login panel">
    <p class="eyebrow">EVOLUTION LAB</p>
    <h1>Your machine learning control room.</h1>
    <p class="muted">Sign in to inspect real training reports, manage automatic cycles, and review balance proposals.</p>
    <form method="post" action="{{ url('/login') }}" class="login-form">
        @csrf
        <label>Owner email<input name="email" type="email" autocomplete="username" value="{{ old('email') }}" required autofocus></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="primary">Sign in</button>
    </form>
    <p class="fine">Access is restricted to the designated evolution owner.</p>
</section>
@endsection
