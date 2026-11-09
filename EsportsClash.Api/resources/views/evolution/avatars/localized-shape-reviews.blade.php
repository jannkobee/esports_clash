@foreach(($preparation->state['localized_shape_reviews']??[]) as $shapeReview)
@php($shapeReport=$shapeReview['report'])
<section class="panel"><h2>Left hip shape correction {{ substr($shapeReport['id'],0,8) }}</h2>
<p class="notice">{{ $shapeReview['assessment']['scope'] }}</p>
<p>Same generated body, skeleton and dense weight field. This localized corrective changes {{ $shapeReport['sculpt']['active_vertices'] }} vertices and fades to zero in the rest pose. These static views do not qualify an animated avatar.</p>
@foreach(($shapeReview['assessment']['observations']??[]) as $observation)<p>{{ $observation }}</p>@endforeach
@foreach([22.5,45,67.5,90] as $degrees)
<h3>Left hip / {{ $degrees }} degrees</h3><div style="display:flex;gap:1rem;flex-wrap:wrap">
@foreach(['baseline'=>'Before correction','sculpt'=>'Localized correction'] as $mode=>$label)
@php($capture=collect($shapeReport['views'])->first(fn($v)=>$v['mode']===$mode && $v['degrees']===$degrees && $v['orbit']===3))
@if($capture)<figure style="margin:0;flex:1;min-width:200px"><figcaption>{{ $label }}</figcaption><a href="{{ route('preparations.file',[$preparation,'local-shape-'.$shapeReport['id'].'-'.$capture['sha256'].'.png']) }}"><img loading="lazy" style="width:100%;height:auto" src="{{ route('preparations.file',[$preparation,'local-shape-'.$shapeReport['id'].'-'.$capture['sha256'].'.png']) }}" alt="{{ $label }}, left hip {{ $degrees }} degrees"></a></figure>@endif
@endforeach
</div>
@endforeach
<details><summary>All views, static snapshots and corrective data</summary>
@foreach($shapeReport['views'] as $capture)<a href="{{ route('preparations.file',[$preparation,'local-shape-'.$shapeReport['id'].'-'.$capture['sha256'].'.png']) }}">{{ $capture['mode'] }} {{ $capture['degrees'] }} orbit {{ $capture['orbit'] }}</a><br>@endforeach
@foreach($shapeReport['assets'] as $asset)<a href="{{ route('preparations.file',[$preparation,'local-shape-'.$shapeReport['id'].'-'.$asset['sha256'].'.glb']) }}">Static snapshot: {{ $asset['mode'] }} {{ $asset['degrees'] }}</a><br>@endforeach
<a href="{{ route('preparations.file',[$preparation,'local-shape-'.$shapeReport['id'].'-'.$shapeReport['sculpt_artifact']['sha256'].'.npz']) }}">Experimental corrective data</a>
<pre>{{ json_encode($shapeReview,JSON_PRETTY_PRINT) }}</pre></details></section>
@endforeach
