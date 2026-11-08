@foreach(($preparation->state['combined_contour_reviews']??[]) as $id=>$trial)
<section class="panel"><h2>Bounded contour trial: {{ $trial['assessment']['status'] }}</h2>
<p class="notice">Unqualified diagnostic. Production admission and publication remain disabled.</p>
<p>{{ $trial['assessment']['summary'] }}</p>
<p>Original 52-bone skeleton and seven skin influences. Report <code>{{ $id }}</code>.</p>
@if(!empty($trial['gltf']))<p>GLB validator: {{ $trial['gltf']['result']['issues']['numErrors'] }} errors, {{ $trial['gltf']['result']['issues']['numWarnings'] }} warnings. This does not qualify deformation.</p>@endif
<table><thead><tr><th>Pose</th><th>Before contacts</th><th>Authored contacts</th><th>Reimported GLB contacts</th></tr></thead><tbody>
@foreach($trial['report']['poses'] as $index=>$pose)<tr><td>{{ $pose['case'] }}</td><td>{{ $pose['baseline']['collision']['self_intersections'] }}</td><td>{{ $pose['candidate']['collision']['self_intersections'] }}</td><td>{{ $trial['reimport']['poses'][$index]['collision']['self_intersections']??'unmeasured' }}</td></tr>@endforeach
</tbody></table>
@if(($trial['export']['status']??null)==='ready_for_babylon_review')
<p><a href="{{ route('preparations.file',[$preparation,'contour-proof-'.$id.'-'.$trial['export']['sha256'].'.glb']) }}">Download unqualified diagnostic playback GLB</a></p>
@endif
<details><summary>Before/after close views and retained evidence</summary><div style="display:flex;flex-wrap:wrap;gap:1rem">
@foreach($trial['visual']['views'] as $capture)<figure style="width:360px;margin:0"><figcaption>{{ $capture['case'] }} / {{ $capture['mode'] }} / {{ $capture['view'] }}</figcaption><a href="{{ route('preparations.file',[$preparation,'contour-proof-'.$id.'-'.$capture['sha256'].'.png']) }}"><img loading="lazy" style="width:100%" src="{{ route('preparations.file',[$preparation,'contour-proof-'.$id.'-'.$capture['sha256'].'.png']) }}" alt="{{ $capture['case'] }} {{ $capture['mode'] }} {{ $capture['view'] }}"></a></figure>@endforeach
</div><pre>{{ json_encode($trial['assessment'],JSON_PRETTY_PRINT) }}</pre></details></section>
@endforeach
