@include('evolution.avatars.combined-contour-reviews')
@foreach(($preparation->state['combined_motion_reviews']??[]) as $id=>$combined)
<section class="panel"><h2>Combined motion: {{ $combined['failed_pose_count'] }} of 17 poses have intersections</h2>
<p class="notice">Motion qualification blocked. Successful export and playback do not mean the avatar is ready for gameplay.</p>
<p>Tested the exact exported avatar with combined hip/knee/twist and shoulder/elbow controls. Seven influences are retained in the diagnostic eight-influence profile; production admission remains disabled.</p>
<p>{{ $combined['assessment']['summary'] }}</p>
<table><thead><tr><th>Diagnostic pose</th><th>Intersecting triangle pairs</th></tr></thead><tbody>
@foreach($combined['motion']['poses'] as $pose)<tr><td>{{ $pose['case'] }}</td><td>{{ $pose['collision']['self_intersections'] }}</td></tr>@endforeach
</tbody></table>
<details><summary>Actual Babylon captures and isolation controls</summary><div style="display:flex;flex-wrap:wrap;gap:1rem">
@foreach($combined['visual']['views'] as $capture)<figure style="width:360px;margin:0"><figcaption>{{ $capture['case'] }} / {{ $capture['view'] }}</figcaption><a href="{{ route('preparations.file',[$preparation,'combined-proof-'.$id.'-'.$capture['sha256'].'.png']) }}"><img loading="lazy" style="width:100%" src="{{ route('preparations.file',[$preparation,'combined-proof-'.$id.'-'.$capture['sha256'].'.png']) }}" alt="Combined motion {{ $capture['case'] }} {{ $capture['view'] }}"></a></figure>@endforeach
</div><pre>{{ json_encode($combined,JSON_PRETTY_PRINT) }}</pre></details></section>
@endforeach
