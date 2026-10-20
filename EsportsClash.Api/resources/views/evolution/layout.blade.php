<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Evolution Console') · Esports Clash Operations</title>
    <link rel="stylesheet" href="{{ asset('evolution.css') }}">
    <script src="{{ asset('evolution.js') }}" defer></script>
    @if(app()->environment('local') && config('app.dev_vite_url'))
    <script type="module" src="{{ rtrim(config('app.dev_vite_url'), '/') }}/@@vite/client"></script>
    @endif
</head>
<body class="ops-terminal">
<header class="topbar">
    <div class="topbar-main">
        <a class="brand" href="{{ route('dashboard') }}" wire:navigate>
            <span class="brand-monogram">EC·OPS</span>
            <span class="brand-text">
                <span class="brand-title">ESPORTS CLASH <span class="brand-tag">DEV CONTROL</span></span>
                <span class="brand-sub">ML Balance &middot; 3D Humanoid Engine &middot; Asset Pipeline</span>
            </span>
        </a>
        <div class="telemetry-bar" aria-label="System status">
            <span class="telemetry-item"><span class="status-led green"></span> SYS: ONLINE</span>
            <span class="telemetry-item">NODE: LOCALHOST:8089</span>
            <span class="telemetry-item">TIME: {{ now()->timezone('Asia/Manila')->format('H:i:s T') }}</span>
        </div>
    </div>
    @auth
    <div class="account-block">
        <span class="operator-badge">OPERATOR: <strong>{{ auth()->user()->name }}</strong></span>
        <form method="post" action="{{ route('logout') }}" data-no-ajax>
            @csrf
            <button class="button-tactile button-danger-subtle btn-sm">Sign Out [Esc]</button>
        </form>
    </div>
    @endauth
</header>
<main id="main-content">
    @auth
    <nav class="report-nav mechanical-tabs" aria-label="Control sections">
        <a wire:navigate href="{{ route('management.index', 'avatar') }}" @if(request()->routeIs('management.*') && request()->route('kind') === 'avatar') aria-current="page" @endif>
            <span class="tab-idx">01</span><span class="tab-label">AVATARS</span>
        </a>
        <a wire:navigate href="{{ route('management.index', 'item') }}" @if(request()->routeIs('management.*') && request()->route('kind') === 'item') aria-current="page" @endif>
            <span class="tab-idx">02</span><span class="tab-label">ITEMS</span>
        </a>
        <a wire:navigate href="{{ route('dashboard') }}" @if(request()->routeIs('dashboard', 'evolution.reports', 'evolution.report')) aria-current="page" @endif>
            <span class="tab-idx">03</span><span class="tab-label">ML BALANCE</span>
        </a>
        <a wire:navigate href="{{ route('trellis.index') }}" @if(request()->routeIs('trellis.*')) aria-current="page" @endif>
            <span class="tab-idx">04</span><span class="tab-label">3D GENERATION</span>
        </a>
        <a wire:navigate href="{{ route('preparations.index') }}" @if(request()->routeIs('preparations.*')) aria-current="page" @endif>
            <span class="tab-idx">05</span><span class="tab-label">ASSET PREPARATION</span>
        </a>
        <a wire:navigate href="{{ route('avatars.index') }}" @if(request()->routeIs('avatars.*')) aria-current="page" @endif>
            <span class="tab-idx">06</span><span class="tab-label">3D REPAIRS</span>
        </a>
    </nav>
    @endauth
    @if(session('status'))
        <div class="notice success" role="status">
            <span class="notice-icon">✓</span>
            <div><strong>OPERATION CONFIRMED:</strong> {{ session('status') }}</div>
        </div>
    @endif
    @if($errors->any())
        <div class="notice error" role="alert">
            <span class="notice-icon">⚠</span>
            <div>
                <strong>OPERATIONAL VALIDATION REJECTED:</strong>
                <ul>@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul>
            </div>
        </div>
    @endif
    @yield('content')
</main>
<footer class="ops-footer">
    <div class="footer-status-line">
        <span>ESPORTS CLASH GAME-DEV CONSOLE &middot; ALL TIMESTAMPS ASIA/MANILA &middot; SAFETY BOUNDARY ACTIVE</span>
        <span class="footer-safe-badge">SAFEGUARD: UNQUALIFIED ASSETS REMAIN OFFLINE</span>
    </div>
</footer>
<div id="toast-container" aria-live="polite"></div>
</body>
</html>
