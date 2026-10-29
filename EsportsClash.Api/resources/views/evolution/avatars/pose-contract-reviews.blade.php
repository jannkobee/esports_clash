@foreach(($preparation->state['pose_contract_reviews']??[]) as $poseReview)
@php($poseReport=$poseReview['report'])
<section class="panel"><h2>Joint pose contract {{ substr($poseReport['id'],0,8) }}</h2>
<p>Same generated body and saved weight field. The old tests rotate one bone; the new controls target an explicit forward limb direction. Coordination is an authored diagnostic sample, not a validated anatomical rhythm or game animation.</p>
<p class="notice">{{ $poseReview['assessment']['scope'] }}</p>
@foreach(($poseReview['assessment']['observations']??[]) as $observation)<p>{{ $observation }}</p>@endforeach
<p>Shoulder coordination rotates the clavicle 15 degrees and re-aims the arm, moving its joint centre. Hip coordination bends the knee 60 degrees while holding pelvis and hip direction fixed. Cameras remain fixed across all three modes.</p>
@foreach($poseReport['plan']['contract']['poses'] as [$joint,$degrees])
<h3>{{ $joint }} / {{ $degrees }} degrees target</h3><div style="display:flex;gap:1rem;flex-wrap:wrap">
@foreach(['legacy'=>'Legacy isolated rotation','world_target'=>'Explicit world target','coordinated'=>'Coordinated control'] as $mode=>$label)
@php($pose=collect($poseReport['poses'])->first(fn($p)=>$p['mode']===$mode && $p['joint']===$joint && $p['degrees']===$degrees))
@php($capture=collect($poseReport['views'])->first(fn($v)=>$v['mode']===$mode && $v['joint']===$joint && $v['degrees']===$degrees && $v['orbit']===($joint==='ThighL'?1:3)))
<figure style="margin:0;flex:1;min-width:180px"><figcaption>{{ $label }} / target error {{ number_format($pose['target_error_degrees'],4) }} degrees</figcaption>
@if($capture)<a href="{{ route('preparations.file',[$preparation,'pose-contract-'.$poseReport['id'].'-'.$capture['sha256'].'.png']) }}"><img loading="lazy" style="width:100%;height:auto" src="{{ route('preparations.file',[$preparation,'pose-contract-'.$poseReport['id'].'-'.$capture['sha256'].'.png']) }}" alt="{{ $label }} {{ $joint }} {{ $degrees }} degrees"></a>@endif
</figure>
@endforeach
</div>
@endforeach
<details><summary>All diagnostic views, static snapshots and measurements</summary>
@foreach($poseReport['views'] as $capture)<a href="{{ route('preparations.file',[$preparation,'pose-contract-'.$poseReport['id'].'-'.$capture['sha256'].'.png']) }}">{{ $capture['mode'] }} {{ $capture['joint'] }} {{ $capture['degrees'] }} orbit {{ $capture['orbit'] }}</a><br>@endforeach
@foreach($poseReport['assets'] as $asset)<a href="{{ route('preparations.file',[$preparation,'pose-contract-'.$poseReport['id'].'-'.$asset['sha256'].'.glb']) }}">Static snapshot: {{ $asset['mode'] }} {{ $asset['joint'] }} {{ $asset['degrees'] }}</a><br>@endforeach
<pre>{{ json_encode($poseReview,JSON_PRETTY_PRINT) }}</pre></details></section>
@endforeach
