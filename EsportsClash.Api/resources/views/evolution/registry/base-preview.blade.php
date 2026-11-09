@extends('evolution.layout')
@section('title',$name.' · Clean base inspection')
@section('content')
<a href="{{ route('registry.edit',$avatar) }}">&larr; Avatar &amp; pipeline</a>
<div class="page-heading"><div><p class="eyebrow">CLEAN BASE · RIG · ANIMATION</p><h1>{{ $name }}</h1><p class="muted">{{ str_replace('_',' ',$candidate->status) }} · {{ $candidate->report['provider']??'' }}</p></div></div>
<div class="notice">This base is awaiting deformation and appearance qualification. The inspector loads the exact recorded GLB.</div>
<section class="panel"><div id="base-inspection" style="height:560px;max-height:65vh" data-asset="{{ route('base-candidates.file',[$avatar,$candidate,$assetFile]) }}"><p>Loading Babylon base inspector&hellip;</p></div>
<div class="actions">
    <button type="button" data-base-view="front">Front</button><button type="button" data-base-view="side">Side</button><button type="button" data-base-view="back">Back</button><button type="button" data-base-view="fit">Fit</button>
    <label>Clip<select id="base-clip"><option value="">Bind pose</option></select></label><button type="button" id="base-play">Play</button><button type="button" id="base-skeleton" aria-pressed="false">Skeleton</button><button type="button" id="base-wireframe" aria-pressed="false">Wireframe</button>
    <label>Phase<input id="base-phase" type="range" min="0" max="1" step="0.001" value="0"></label><label>Time (seconds)<input id="base-time" type="number" min="0" step="0.001" value="0" style="width:100px"></label>
    <label>Speed<select id="base-speed"><option>1</option><option>0.25</option><option>0.5</option><option>2</option><option>4</option></select></label>
</div><p id="base-status" role="status">Loading exact exported artifact</p></section>
@if($diagnostics->isNotEmpty())
<section class="panel"><h2>Controlled Colab deformation reviews</h2><p class="muted">These experiments preserve the failed source and its qualification status. Each comparison records its own source and report hashes.</p>
@foreach($diagnostics as $diagnostic)
<details class="clean-details"><summary>{{ $diagnostic['summary']??$diagnostic['id'] }}</summary>
<p class="fine">Attempt {{ $diagnostic['id'] }} · Source {{ $diagnostic['plan']['source_sha256']??'' }} · Report {{ $diagnostic['artifact']['sha256']??'' }}</p>
<div style="overflow-x:auto"><table><thead><tr><th>Clip / phase</th><th>Variant</th><th>Surface intersections</th></tr></thead><tbody>
@foreach(($diagnostic['comparisons']??[]) as $case=>$variants)
@foreach($variants as $variant=>$intersections)<tr><td>{{ $case }}</td><td>{{ str_replace('_',' ',$variant) }}</td><td>{{ $intersections }}</td></tr>@endforeach
@endforeach
</tbody></table></div></details>
@endforeach
</section>
@endif
<section class="panel"><h2>Artifacts &amp; evidence</h2><p>{{ $candidate->report['bones']??'—' }} bones · {{ $candidate->report['vertices']??'—' }} vertices · {{ count($candidate->report['clips']??[]) }} authored clips</p>
@foreach($candidate->artifacts as $file=>$artifact)<p><a href="{{ route('base-candidates.file',[$avatar,$candidate,$file]) }}">{{ $file }}</a> · {{ number_format($artifact['bytes']) }} bytes <small style="overflow-wrap:anywhere">{{ $artifact['sha256'] }}</small></p>@endforeach
<h3>Remaining qualification gates</h3>@foreach(($candidate->report['remaining_gates']??[]) as $gate)<p>{{ $gate }}</p>@endforeach
</section>
@if(is_file(public_path('base-inspector/base-inspector.js')))<script type="module" src="{{ asset('base-inspector/base-inspector.js') }}?v={{ hash_file('sha256',public_path('base-inspector/base-inspector.js')) }}"></script>
@elseif(config('app.dev_vite_url'))<script type="module" src="{{ rtrim(config('app.dev_vite_url'),'/') }}/src/baseInspection.ts"></script>
@else<p class="notice">The Babylon inspector bundle is missing. Build the base inspector to enable playback; recorded artifact downloads remain available.</p>@endif
@endsection
