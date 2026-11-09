@foreach(($preparation->state['animation_playback_reviews']??[]) as $key=>$playback)
<section class="panel"><h2>Animated hip correction: export and playback review</h2>
<p class="notice">Diagnostic only. Not production qualified. Original body and 52-bone rig; all seven skin influences retained.</p>
<p>Bone motion and both corrective shapes play together in Babylon. Shoulder deformation, full gameplay clips, equipment and target-device performance remain unqualified.</p>
<p><a href="{{ route('preparations.file',[$preparation,'animation-proof-'.$key.'-'.$key.'.glb']) }}">Download the verified diagnostic animation</a></p>
<div style="display:flex;gap:1rem;flex-wrap:wrap">
@foreach($playback['browser']['samples'] as $capture)
@if($capture['view']==='side' && in_array($capture['phase'],[0,0.25,0.5,1]))
<figure style="margin:0;flex:1;min-width:220px"><figcaption>Animation phase {{ $capture['phase'] }}</figcaption><img loading="lazy" style="width:100%" src="{{ route('preparations.file',[$preparation,'animation-proof-'.$key.'-'.$capture['sha256'].'.png']) }}" alt="Actual Babylon hip diagnostic, phase {{ $capture['phase'] }}"></figure>
@endif
@endforeach
</div><details><summary>Export and playback evidence</summary><pre>{{ json_encode($playback,JSON_PRETTY_PRINT) }}</pre></details>
</section>
@endforeach
