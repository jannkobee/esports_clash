<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Evolution Lab') · Esports Clash</title>
    <link rel="stylesheet" href="{{ asset('evolution.css') }}">
    <script src="{{ asset('evolution.js') }}" defer></script>
    @if(app()->environment('local') && config('app.dev_vite_url'))
    <script type="module" src="{{ rtrim(config('app.dev_vite_url'), '/') }}/@@vite/client"></script>
    @endif
    @livewireStyles
</head>
<body>
<header class="topbar">
    <a class="brand" href="{{ route('dashboard') }}" wire:navigate><span class="brand-mark">EC</span><span>ESPORTS CLASH<small>ML and avatar model operations</small></span></a>
    @auth
    <div class="account"><span>{{ auth()->user()->name }}</span><form method="post" action="{{ route('logout') }}" data-no-ajax>@csrf<button class="quiet">Sign out</button></form></div>
    @endauth
</header>
<main id="main-content">
    @auth
    <nav class="report-nav" aria-label="Evolution sections">
        <a wire:navigate href="{{ route('management.index', 'avatar') }}" @if(request()->routeIs('management.*') && request()->route('kind') === 'avatar') aria-current="page" @endif>Avatar management</a>
        <a wire:navigate href="{{ route('management.index', 'item') }}" @if(request()->routeIs('management.*') && request()->route('kind') === 'item') aria-current="page" @endif>Item management</a>
        <a wire:navigate href="{{ route('dashboard') }}" @if(request()->routeIs('dashboard', 'evolution.reports', 'evolution.report')) aria-current="page" @endif>Machine Learning</a>
        <a wire:navigate href="{{ route('trellis.index') }}" @if(request()->routeIs('trellis.*')) aria-current="page" @endif>3D Generation</a>
        <a wire:navigate href="{{ route('preparations.index') }}" @if(request()->routeIs('preparations.*')) aria-current="page" @endif>Asset Preparation</a>
        <a wire:navigate href="{{ route('avatars.index') }}" @if(request()->routeIs('avatars.*')) aria-current="page" @endif>3D Enhancements</a>
    </nav>
    @endauth
    @if(session('status'))<div class="notice success" role="status">{{ session('status') }}</div>@endif
    @if($errors->any())<div class="notice error" role="alert"><strong>Please check the following:</strong><ul>@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div>@endif
    @yield('content')
</main>
<footer>Laravel control panel · All times Asia/Manila · Experimental models stay offline until qualified.</footer>
<div id="toast-container" aria-live="polite"></div>
@livewireScripts
</body>
</html>
