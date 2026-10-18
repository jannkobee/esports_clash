@extends('evolution.layout')
@section('title','Avatar Evolution')
@section('content')
<a href="{{ route('dashboard') }}">← Learning &amp; balance</a>
<div class="page-heading"><div><p class="eyebrow">INDEPENDENT VISUAL ENGINE</p><h1>Avatar Evolution</h1><p class="muted">Geometry, animation and ability presentation. Every published version needs your approval.</p></div><span class="badge">{{ $settings->enabled?'Automatic cycles enabled':'Automatic cycles paused' }}</span></div>
<div class="metrics">
<article class="metric"><span>Cadence</span><strong>{{ $settings->interval_minutes }} <em>minutes</em></strong><small>Scheduler checked {{ $settings->heartbeat_at?->timezone('Asia/Manila')->format('g:i A')??'Awaiting first tick' }}</small></article>
<article class="metric"><span>Awaiting review</span><strong>{{ $runs->where('status','review')->count() }}</strong><small>Further cycles for that avatar wait for review</small></article>
<article class="metric"><span>Worker RAM</span><strong>{{ $operations?number_format($operations['resources']['anonymous_mib'],0):'—' }} <em>MiB</em></strong><small>{{ $operations?'Worker available':'Worker unavailable' }} · CPU renderer</small></article>
<article class="metric"><span>Avatar storage</span><strong>{{ $operations?number_format($operations['storage_bytes']/1073741824,2):'—' }} <em>GiB</em></strong><small>{{ $settings->storage_gib }} GiB budget · original and released assets retained</small></article>
</div>
<section class="panel"><h2>Generate a comparison</h2><p class="fine">Starts with Arsenaldo. Five candidates are the default. Technical ranking compares compatibility, contacts, intersections and cost; you judge artistic quality. No external AI service or coding agent is required.</p>
<form action="{{ route('avatars.start') }}" method="post" class="inline-form">@csrf
<label>Avatar<select name="avatar_id">@foreach($catalog as $avatar)<option value="{{ $avatar['id'] }}" @selected($avatar['id']==='c_invoker')>{{ $avatar['name'] }}</option>@endforeach</select></label>
<label>Focus<select name="focus"><option value="balanced">Balanced</option><option value="silhouette">Body &amp; silhouette</option><option value="equipment">Armor &amp; equipment</option><option value="motion">Animation &amp; abilities</option></select></label><button class="primary">Generate candidates</button></form></section>
<section class="panel"><h2>Always-on schedule</h2>
<form action="{{ route('avatars.settings') }}" method="post" class="settings-form">@csrf
<div class="proposal-grid"><label>Automation<select name="enabled"><option value="1" @selected($settings->enabled)>Enabled</option><option value="0" @selected(!$settings->enabled)>Paused</option></select></label>
<label>Minutes between eligible cycles<input type="number" name="interval_minutes" min="5" max="10080" value="{{ $settings->interval_minutes }}"></label>
<label>Candidates per generation<input type="number" name="candidates_per_cycle" min="3" max="10" value="{{ $settings->candidates_per_cycle }}"></label>
<label>Maximum optimization generations<input type="number" name="generations" min="1" max="3" value="{{ $settings->generations }}"></label>
<label>Managed storage budget (GiB)<input type="number" name="storage_gib" min="1" max="20" value="{{ $settings->storage_gib }}"></label>
<label>Automatic roster<select name="avatar_ids[]" multiple size="5">@foreach($catalog as $avatar)<option value="{{ $avatar['id'] }}" @selected(in_array($avatar['id'],$settings->avatar_ids))>{{ $avatar['name'] }}</option>@endforeach</select></label></div><button>Save automation</button></form>
<p class="fine">One generator runs at a time. It waits when owner reviews, RAM reserves or storage budgets prevent new work. Originals, approved versions and rollback assets are retained. Publishing is always manual.</p></section>
<section class="panel"><div class="section-heading"><h2>Candidate cycles</h2><a href="{{ route('avatars.reports') }}">All model reports</a></div>@forelse($runs as $run)<div class="run-row"><div class="run-title"><a href="{{ route('avatars.show',$run) }}">{{ $run->plan['avatar']['name'] }} · {{ $run->created_at->timezone('Asia/Manila')->format('M j, g:i A') }}</a><span class="badge">{{ str_replace('_',' ',$run->status) }}</span></div><p class="fine">{{ $run->report['stage']??'Queued' }} · {{ count($run->report['candidates']??[]) }} candidates collected · {{ $run->report['valid_candidates']??'—' }} technically valid</p>@if($run->error)<p class="error-text">{{ $run->error }}</p>@endif</div>@empty<p class="muted">The scheduler will create the first Arsenaldo cycle automatically.</p>@endforelse</section>
<section class="panel"><h2>Published visual history &amp; rollback</h2>@forelse($releases as $release)<div class="run-row"><strong>{{ $release->avatar_id }} · V{{ $release->version }}</strong><span class="badge">{{ $release->active?'Active for new scenes':'Archived' }}</span><p class="fine"><code>{{ $release->sha256 }}</code></p><form method="post" action="{{ route('avatars.rollback') }}">@csrf<input type="hidden" name="avatar_id" value="{{ $release->avatar_id }}"><input type="hidden" name="release_id" value="{{ $release->id }}"><button @disabled($release->active)>Roll back to this version</button></form></div>@empty<p class="muted">No evolved model has been published. The shipped originals remain active.</p>@endforelse</section>
@endsection
