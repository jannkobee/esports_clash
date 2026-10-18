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
</head>
<body>
<header class="topbar">
    <a class="brand" href="{{ route('dashboard') }}"><span class="brand-mark">EC</span><span>ESPORTS CLASH<small>ML and avatar model operations</small></span></a>
    @auth
    <div class="account"><span>{{ auth()->user()->name }}</span><form method="post" action="{{ route('logout') }}">@csrf<button class="quiet">Sign out</button></form></div>
    @endauth
</header>
<main>
    @auth
    <nav class="report-nav" aria-label="Evolution sections">
        <a href="{{ route('dashboard') }}" @if(request()->routeIs('dashboard')) aria-current="page" @endif>ML controls</a>
        <a href="{{ route('evolution.reports') }}" @if(request()->routeIs('evolution.reports', 'evolution.report')) aria-current="page" @endif>ML reports</a>
        <a href="{{ route('avatars.index') }}" @if(request()->routeIs('avatars.index')) aria-current="page" @endif>Model controls</a>
        <a href="{{ route('avatars.reports') }}" @if(request()->routeIs('avatars.reports', 'avatars.show')) aria-current="page" @endif>Model reports</a>
    </nav>
    @endauth
    @if(session('status'))<div class="notice success" role="status">{{ session('status') }}</div>@endif
    @if($errors->any())<div class="notice error" role="alert"><strong>Please check the following:</strong><ul>@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div>@endif
    @yield('content')
</main>
<footer>Laravel control panel · All times Asia/Manila · Experimental models stay offline until qualified.</footer>
</body>
</html>
