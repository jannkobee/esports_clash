@extends('evolution.layout')
@section('title',$name.' / Raw Colab rig')
@section('content')
<a href="{{ route('preparations.report',$preparation) }}">&larr; Preparation report</a>
<div class="page-heading"><div><p class="eyebrow">GENERATED BODY / RAW RIG</p><h1>{{ $name }}</h1></div></div>
@if(in_array(request()->query('candidate'),$candidateIds,true))
<p class="notice">This measured joint candidate uses the actual generated body's TokenRig lineage. It is diagnostic only; animation and appearance are not qualified.</p>
@else
<p class="notice">This is the actual generated body's raw TokenRig result. Animation and appearance are not qualified.</p>
@endif
<p class="fine">Source {{ $preparation->generation_id }} / SHA {{ $preparation->plan['source_sha256'] }} / source compute {{ $preparation->plan['source_compute'] }} / rig compute Google Colab.</p>
@php($showStress=$stressAvailable && request()->query('view')==='stress')
@if($stressAvailable)
<p><a href="{{ route('preparations.preview',$preparation) }}">Raw bind pose</a> / <a href="{{ route('preparations.preview',[$preparation,'view'=>'stress']) }}">Play controlled bend tests</a> / <a href="{{ route('preparations.file',[$preparation,'stress.glb']) }}">Download bend-test model</a></p>
@endif
@foreach($candidateIds as $candidateId)
@php($candidateEvidence=$preparation->state['skinning_reviews'][$candidateId]['report']??[])
@php($candidateLabel=isset($candidateEvidence['corrective_recipe']) ? 'Baked pose correctives' : (isset($candidateEvidence['variant']) ? ((str_starts_with($candidateEvidence['method']??'','weight-fixed-hip-') ? 'Hip' : 'Shoulder').' / '.str_replace(['0p99pct','0p5pct','_'],['0.99%','0.5%',' '],$candidateEvidence['variant'])) : 'Measured joint candidate'))
<p><a href="{{ route('preparations.preview',[$preparation,'view'=>'candidate','candidate'=>$candidateId]) }}">{{ $candidateLabel }} {{ substr($candidateId,0,8) }}</a> / <a href="{{ route('preparations.file',[$preparation,'candidate-'.$candidateId.'.glb']) }}">Download candidate GLB</a> / unqualified</p>
@endforeach
@foreach($candidateBendOptions as $bend)
<p><a href="{{ route('preparations.preview',[$preparation,'view'=>'candidate-bends','candidate'=>$bend['candidate_id'],'visual_review'=>$bend['review_id']]) }}">Play measured candidate bends {{ substr($bend['candidate_id'],0,8) }}</a></p>
@endforeach
@foreach(($preparation->state['stage_visual_audits']??[]) as $visualId=>$visualEntry)
@if(isset($visualEntry['fit_bends']))<p><a href="{{ route('preparations.preview',[$preparation,'view'=>'weight-fit-bends','candidate'=>$visualEntry['fit_bends']['candidate_id'],'visual_review'=>$visualId]) }}">Play fitted weight diagnostic bends {{ substr($visualEntry['fit_bends']['candidate_id'],0,8) }}</a></p>@endif
@endforeach
@if($showStress)<p class="notice">Diagnostic bends from the recorded Colab review. Deep bends contain known intersections; these clips are not game animations.</p>@endif
@php($candidateId=in_array(request()->query('candidate'),$candidateIds,true) ? request()->query('candidate') : null)
@php($candidateReview=$candidateId ? ($preparation->state['skinning_reviews'][$candidateId]['report']??[]) : [])
@if($candidateId)<p class="notice">{{ $candidateReview['scope']??'Experimental geometry candidate; diagnostic only and unpublished.' }} This candidate has no game animation clips and remains unqualified.</p>@endif
@if(isset($candidateReview['corrective_recipe']))
<p>Pose corrections are stored in this base. Choose its measured candidate bends to review them in motion. The base download opens in its unchanged rest pose.</p>
@endif
@if($selectedCandidateBendReviewId)<p class="notice">Controlled bend clips reproduce this candidate's recorded 45/90-degree poses. Review {{ $selectedCandidateBendReviewId }}. These are diagnostic motions; full game animation review remains pending.</p>@endif
<section class="panel"><div id="base-inspection" style="height:560px;max-height:65vh" data-asset="{{ route('preparations.file',[$preparation,($selectedWeightFitVisualId??null) ? 'weight-fit-bends-'.$selectedWeightFitVisualId.'-'.$candidateId.'.glb' : ($selectedCandidateBendReviewId ? 'candidate-bends-'.$selectedCandidateBendReviewId.'-'.$candidateId.'.glb' : ($candidateId ? 'candidate-'.$candidateId.'.glb' : ($showStress?'stress.glb':'raw-rig.glb')))]) }}"></div>
<div class="actions">
<button type="button" data-base-view="front">Front</button><button type="button" data-base-view="side">Side</button><button type="button" data-base-view="back">Back</button><button type="button" data-base-view="fit">Fit</button>
<label>Clip<select id="base-clip"><option value="">Bind pose</option></select></label><button type="button" id="base-play">Play</button><button type="button" id="base-skeleton" aria-pressed="false">Skeleton</button><button type="button" id="base-wireframe" aria-pressed="false">Wireframe</button>
<label>Phase<input id="base-phase" type="range" min="0" max="1" step="0.001" value="0"></label><label>Time (seconds)<input id="base-time" type="number" min="0" step="0.001" value="0"></label>
<label>Speed<select id="base-speed"><option>1</option><option>0.25</option><option>0.5</option><option>2</option><option>4</option></select></label>
</div><p id="base-status" role="status">Loading exact raw rig</p></section>
<p><a href="{{ route('preparations.file',[$preparation,'raw-rig.glb']) }}">Download raw rig</a> / SHA {{ $preparation->state['preparation']['sha256'] }}</p>
@if(isset($preparation->state['raw_review']))
<section class="panel"><h2>Controlled Colab rig review</h2><p>{{ $preparation->state['raw_review']['status'] }} / this review does not qualify game motion or appearance.</p>
@if(isset($preparation->state['raw_review']['report']))
@php($review=$preparation->state['raw_review']['report'])
<p>Source intersections: {{ $review['source']['self_intersections']??'unmeasured' }} / raw rest intersections: {{ $review['raw_rest']['self_intersections']??'unmeasured' }}</p>
<div style="overflow-x:auto"><table><thead><tr><th>Joint</th><th>Bend</th><th>Surface intersections</th><th>Severe stretched edges</th></tr></thead><tbody>
@foreach(($review['poses']??[]) as $pose)<tr><td>{{ $pose['joint'] }}</td><td>{{ $pose['degrees'] }} degrees</td><td>{{ $pose['self_intersections'] }}</td><td>{{ $pose['edge_deformation']['severely_stretched_edges']??'unmeasured' }}</td></tr>@endforeach
</tbody></table></div>
<details><summary>Full measurement report</summary><pre>{{ json_encode($review,JSON_PRETTY_PRINT) }}</pre></details>
@endif
</section>
@endif
@foreach(($preparation->state['stage_geometry_audits']??[]) as $audit)
@php($stageReport=$audit['report'])
<section class="panel"><h2>Source and rig stage geometry {{ substr($stageReport['id'],0,8) }}</h2>
<p>Colab rest-pose diagnostic · unqualified. Vertex distances are nearest-neighbour measurements, not a surface or animation quality guarantee.</p>
<div style="overflow-x:auto"><table><thead><tr><th>Stage</th><th>Body vertices</th><th>Boundary edges</th><th>Non-manifold edges</th><th>Maximum vertex distance from source</th></tr></thead><tbody>
@foreach($stageReport['stages'] as $stageName=>$stage)
<tr><td>{{ $stageName }}</td><td>{{ $stage['meshes'][0]['vertices'] }}</td><td>{{ $stage['meshes'][0]['boundary_edges'] }}</td><td>{{ $stage['meshes'][0]['nonmanifold_edges'] }}</td><td>{{ $stage['rest_vertex_distance_to_source']['max']??'source' }}</td></tr>
@endforeach
</tbody></table></div><p class="fine">Imported skinned meshes can split vertices at attribute seams; boundary counts alone do not establish visible holes. No posed or game-motion qualification follows from this report.</p>
<details><summary>Full source-bound stage report</summary><pre>{{ json_encode($stageReport,JSON_PRETTY_PRINT) }}</pre></details></section>
@endforeach
@foreach(($preparation->state['joint_seam_audits']??[]) as $audit)
@php($seamReport=$audit['report'])
<section class="panel"><h2>Joint seam and skin-weight audit {{ substr($seamReport['id'],0,8) }}</h2>
<p>Coincident positions are grouped at 0.000001 world units. These are approximate geometric measurements, not proof of visual or animation quality.</p>
<div style="overflow-x:auto"><table><thead><tr><th>Stage</th><th>Joint</th><th>Geometric boundary edges near joint</th><th>Coincident-vertex weight differences over 0.01</th></tr></thead><tbody>
@foreach($seamReport['stages'] as $stageName=>$stage)
@foreach($stage['local'] as $joint=>$local)
<tr><td>{{ $stageName }}</td><td>{{ $joint }}</td><td>{{ $local['geometric_boundary_edges'] }}</td><td>{{ $local['duplicate_weight_l1_over_0_01'] }}</td></tr>
@endforeach
@endforeach
</tbody></table></div><details><summary>Full seam and weight report</summary><pre>{{ json_encode($seamReport,JSON_PRETTY_PRINT) }}</pre></details></section>
@endforeach
@foreach(($preparation->state['stage_visual_audits']??[]) as $audit)
@php($visual=$audit['report'])
<section class="panel"><h2>Matched joint views {{ substr($visual['id'],0,8) }}</h2>
@if(($visual['plan']['stages']??null)===['raw','fitted'])
<p>Original raw rig and fitted four-influence weights on the same body and joint rest transforms. Controlled bends at nominal 90 degrees; game animation review remains pending.</p>
@else
<p>Raw rig, early pivot adjustment, and later corrective at nominal 90-degree isolated bends. Joint pivots differ; these are diagnostic views, not identical world-space poses or game animations.</p>
@endif
@if(isset($audit['assessment']))<p class="notice">Manual assessment: {{ str_replace('_',' ',$audit['assessment']['status']) }}. {{ $audit['assessment']['scope'] }}</p>@endif
@foreach(['UpperArmL','UpperArmR','ThighL','ThighR'] as $joint)
<h3>{{ $joint }}</h3><div style="display:flex;gap:1rem;flex-wrap:wrap">
@foreach(($visual['plan']['stages']??['raw','early','corrected']) as $stage)
@php($view=collect($visual['views'])->first(fn($v)=>$v['stage']===$stage && $v['joint']===$joint && $v['degrees']===90 && $v['orbit']===($joint==='ThighL'?1:3)))
@if($view)<figure style="margin:0;flex:1;min-width:180px"><figcaption>{{ $stage }}</figcaption><a href="{{ route('preparations.file',[$preparation,'stage-visual-'.$visual['id'].'-'.$view['sha256'].'.png']) }}"><img style="width:100%;height:auto" src="{{ route('preparations.file',[$preparation,'stage-visual-'.$visual['id'].'-'.$view['sha256'].'.png']) }}" alt="{{ $stage }} {{ $joint }} diagnostic bend"></a></figure>@endif
@endforeach
</div>
@endforeach
<details><summary>All recorded views and capture metadata</summary><pre>{{ json_encode($visual['views'],JSON_PRETTY_PRINT) }}</pre></details></section>
@endforeach
@include('evolution.avatars.pose-contract-reviews')
@foreach(($preparation->state['weight_field_comparisons']??[]) as $comparison)
@php($fieldReport=$comparison['report'])
<section class="panel"><h2>Weight field comparison {{ substr($fieldReport['id'],0,8) }}</h2>
<p>Same body, skeleton, pose and camera. Static diagnostic surfaces compare original weights, regional BBW and full BBW. These snapshots have no skeleton or animations and are not playable avatars.</p>
<p class="notice">{{ $comparison['assessment']['scope'] }}</p>
@if(isset($fieldReport['correction']))
<p>Influence-based transition: {{ $fieldReport['correction']['modified_vertices'] }} vertices changed. Original weights preserved on {{ $fieldReport['correction']['protected_hand_vertices'] }} hand/finger vertices and {{ $fieldReport['correction']['protected_torso_vertices'] }} core torso vertices. These checks do not qualify finger articulation or anatomical shape.</p>
<p><a href="{{ route('preparations.file',[$preparation,'weight-field-'.$fieldReport['id'].'-'.$fieldReport['weight_artifact']['sha256'].'.npz']) }}">Download experimental dense weights</a></p>
@endif
@foreach($fieldReport['plan']['poses'] as [$joint,$degrees])
<h3>{{ $joint }} / {{ $degrees }} degrees</h3><div style="display:flex;gap:1rem;flex-wrap:wrap">
@foreach($fieldReport['plan']['fields'] as $field)
@php($label=['raw'=>'Original weights','regional'=>'Regional BBW','full'=>'Full BBW','bounded'=>'Influence-based BBW','bounded_soft'=>'Continuous support BBW'][$field])
@php($fieldView=collect($fieldReport['views'])->first(fn($v)=>$v['field']===$field && $v['joint']===$joint && $v['degrees']===$degrees && $v['orbit']===($joint==='ThighL'?1:3)))
@if($fieldView)<figure style="margin:0;flex:1;min-width:180px"><figcaption>{{ $label }}</figcaption><a href="{{ route('preparations.file',[$preparation,'weight-field-'.$fieldReport['id'].'-'.$fieldView['sha256'].'.png']) }}"><img loading="lazy" style="width:100%;height:auto" src="{{ route('preparations.file',[$preparation,'weight-field-'.$fieldReport['id'].'-'.$fieldView['sha256'].'.png']) }}" alt="{{ $label }} {{ $joint }} {{ $degrees }} degrees"></a></figure>@endif
@endforeach
</div>
@endforeach
<details><summary>All views and static snapshot downloads</summary>
@foreach($fieldReport['views'] as $fieldView)<a href="{{ route('preparations.file',[$preparation,'weight-field-'.$fieldReport['id'].'-'.$fieldView['sha256'].'.png']) }}">{{ $fieldView['field'] }} {{ $fieldView['joint'] }} {{ $fieldView['degrees'] }} orbit {{ $fieldView['orbit'] }}</a><br>@endforeach
@foreach($fieldReport['assets'] as $fieldAsset)<a href="{{ route('preparations.file',[$preparation,'weight-field-'.$fieldReport['id'].'-'.$fieldAsset['sha256'].'.glb']) }}">Static GLB: {{ $fieldAsset['field'] }} {{ $fieldAsset['joint'] }} {{ $fieldAsset['degrees'] }}</a><br>@endforeach
<pre>{{ json_encode($comparison,JSON_PRETTY_PRINT) }}</pre></details></section>
@endforeach
@foreach(($preparation->state['weight_solver_reviews']??[]) as $solverReview)
@php($solver=$solverReview['report'])
<section class="panel"><h2>Skin-weight solver trial {{ substr($solver['id'],0,8) }}</h2>
<p class="notice">{{ str_replace('_',' ',$solver['status']) }} · {{ ($solver['candidate_available']??false) ? 'Diagnostic candidate available; visual and game-motion review remain pending.' : 'No avatar candidate produced; deformation remains unqualified.' }}</p>
@if(($solver['candidate_available']??false))<p><a href="{{ route('preparations.preview',[$preparation,'view'=>'candidate','candidate'=>$solver['id']]) }}">Inspect fitted weight candidate</a></p>@endif
<p>libigl {{ $solver['libigl_version']??'volume weighting' }} on Google Colab.</p>
@if(isset($solver['solver_check']))<p>Solver check: {{ $solver['solver_check']['status'] }} on a synthetic volume.</p>@endif
@if(isset($solver['proxy']))
<p>Computational proxy: {{ $solver['proxy']['nodes'] }} nodes / {{ $solver['proxy']['tetrahedra'] }} tetrahedra. Maximum transfer distance: {{ $solver['proxy']['max_transfer_distance'] }} world units.</p>
<p>{{ implode(', ',$solver['blockers']??[]) }}</p>
@if(isset($solver['proxy_artifact']))<p><a href="{{ route('preparations.file',[$preparation,'weight-domain-'.$solver['id'].'.npz']) }}">Download computational volume and correspondence</a></p>@endif
@endif
@if(isset($solver['vertices']))<p>Computed weights: {{ $solver['vertices'] }} body vertices / {{ $solver['channels'] }} channels. Export and deformation review remain pending.</p>@endif
@if(isset($solver['weight_changes']))<p>Four-influence export review: {{ $solver['weight_changes']['modified_vertices'] }} evaluated vertices; maximum discarded weight mass {{ number_format(100*$solver['weight_changes']['max_discarded_mass_to_four_influences'],2) }}%.</p>@endif
@if(isset($solver['heldout_error']))<p>Held-out deformation error: maximum {{ $solver['heldout_error']['max_error'] }} world units; relative maximum {{ number_format(100*$solver['heldout_error']['max_relative_error'],3) }}%. This measures agreement with the dense weight field, not visual quality.</p>@endif
@foreach(($solver['geometry']??[]) as $label=>$geometry)
<p>{{ $label }}: {{ $geometry['boundary_edges'] }} boundary edges, {{ $geometry['overincident_edges'] }} edges with more than two incident faces. {{ implode(', ',$geometry['blockers']) }}</p>
@endforeach
<p>{{ $solver['next_requirement']??($solver['error']??'Review retained evidence.') }}</p>
<details><summary>Full solver admission report</summary><pre>{{ json_encode($solver,JSON_PRETTY_PRINT) }}</pre></details></section>
@endforeach
@foreach(($preparation->state['skinning_reviews']??[]) as $comparison)
<section class="panel"><h2>Skinning comparison {{ substr($comparison['report']['id']??'',0,8) }}</h2><p>{{ $comparison['report']['status'] }} · Diagnostic only; no repair is qualified.</p>
@if(isset($comparison['report']['scope']))<p class="fine">{{ $comparison['report']['scope'] }}</p>@endif
@if(isset($comparison['report']['error']))<p class="failure-box">{{ $comparison['report']['error'] }}</p>@endif
@php($baselinePoses=collect(collect($comparison['report']['variants']??[])->firstWhere('name','linear_baseline')['poses']??[]))
<div style="overflow-x:auto"><table><thead><tr><th>Variant</th><th>Joint</th><th>Bend</th><th>Intersections</th><th>Change from baseline</th></tr></thead><tbody>
@foreach(($comparison['report']['variants']??[]) as $variant)
@foreach(($variant['poses']??[]) as $pose)
@php($original=$baselinePoses->first(fn($entry)=>$entry['joint']===$pose['joint'] && $entry['degrees']===$pose['degrees']))
@php($delta=$original ? $pose['self_intersections']-$original['self_intersections'] : null)
<tr><td>{{ $variant['name'] }}</td><td>{{ $pose['joint'] }}</td><td>{{ $pose['degrees'] }} degrees</td><td>{{ $pose['self_intersections'] }}</td><td>{{ $delta===null ? 'Not comparable' : ($delta>0 ? '+'.$delta.' — worse' : ($delta<0 ? $delta.' — fewer intersections' : 'Unchanged')) }}</td></tr>
@endforeach
@endforeach
@foreach(($comparison['report']['pose_results']??[]) as $pose)
<tr><td>knee pivot candidate</td><td>{{ $pose['joint'] }}</td><td>{{ $pose['degrees'] }} degrees</td><td>{{ $pose['self_intersections'] }}</td><td>reload measured</td></tr>
@endforeach
@foreach(($comparison['report']['comparison']??[]) as $pose)
<tr><td>combined pivot candidate</td><td>{{ $pose['joint'] }}</td><td>{{ $pose['degrees'] }} degrees</td><td>{{ $pose['candidate_intersections'] }}</td><td>{{ $pose['delta']>0 ? '+'.$pose['delta'].' worse' : ($pose['delta']<0 ? $pose['delta'].' fewer' : 'unchanged') }}</td></tr>
@endforeach
@foreach(($comparison['report']['poses']??[]) as $pose)
<tr><td>{{ isset($comparison['report']['corrective_recipe']) ? 'Baked pose corrective' : ($comparison['report']['variant']??'localized weight transfer') }}</td><td>{{ $pose['joint'] }}</td><td>{{ $pose['degrees'] }} degrees</td><td>{{ $pose['self_intersections'] }}</td><td>{{ $pose['delta_vs_parent']>0 ? '+'.$pose['delta_vs_parent'].' worse' : ($pose['delta_vs_parent']<0 ? $pose['delta_vs_parent'].' fewer' : 'unchanged') }} / {{ $pose['edge_deformation']['severely_stretched_edges']??'unmeasured' }} severe stretch edges @if(isset($pose['reference_intersections']))<br>versus reference {{ $pose['delta_vs_reference']>0 ? '+'.$pose['delta_vs_reference'] : $pose['delta_vs_reference'] }} (reference {{ $pose['reference_intersections'] }})@endif</td></tr>
@endforeach
</tbody></table></div><details><summary>Exact comparison evidence</summary><pre>{{ json_encode($comparison,JSON_PRETTY_PRINT) }}</pre></details></section>
@endforeach
@foreach($skinningDiagnostics as $diagnostic)
@php($profile=$diagnostic['report']??[])
@php($hipStudy=in_array($profile['method']??null,['weight-fixed-hip-socket-placement-v1','weight-fixed-hip-forward-extent-v2'],true))
@php($skinningModeStudy=($profile['method']??null)==='linear-versus-preserve-volume-v1')
@php($surfaceProbe=in_array($profile['method']??null,['contact-bound-corrective-smooth-probe-v1','contact-bound-hybrid-corrective-probe-v1'],true))
@php($portableBake=str_starts_with($profile['method']??'','contact-bound-portable-pose-correctives-'))
@php($failedVisual=($profile['method']??null)==='failed-babylon-candidate-review-v1')
@php($motionReview=($profile['method']??null)==='retained-corrective-cycle-interpolation-v1')
@php($shapeStudy=($profile['method']??null)==='half-strength-shoulder-target-v1')
@php($failedContact=in_array($profile['method']??null,['failed-corrected-contact-map-v1','failed-shoulder-separation-v1','failed-hip-contact-aware-v1'],true))
@php($separationStudy=in_array($profile['method']??null,['rest-sign-shoulder-separation-v1','contact-bound-local-arap-v1','contact-pair-centroid-probe-v1'],true))
@php($contactTopology=($profile['method']??null)==='corrected-contact-topology-v1')
@php($hipFoldProfile=($profile['method']??null)==='corrected-hip-fold-profile-v1')
@php($hipFoldArap=in_array($profile['method']??null,['contact-bound-hip-fold-arap-v1','contact-aware-hip-fold-v1','contact-aware-hip-dihedral-v1'],true))
@php($arapRemap=in_array($profile['method']??null,['corrective-arap-remapped-target-v1','corrective-centroid-remapped-target-v1','corrective-hip-contact-remapped-target-v1'],true))
@php($failedArapRemap=($profile['method']??null)==='failed-arap-remap-v1')
@php($interruptedHipRemap=($profile['method']??null)==='interrupted-hip-contact-remap-v1')
@php($socketStudy=$hipStudy || in_array($profile['method']??null,['weight-fixed-shoulder-socket-placement-v1','weight-fixed-shoulder-socket-combined-v2'],true))
<section class="panel"><h2>{{ $interruptedHipRemap ? 'Interrupted hip target correspondence' : ($hipFoldArap ? 'Hip fold surface trial' : ($hipFoldProfile ? 'Hip crease measurements' : ($contactTopology ? 'Contact surface connectivity' : ($arapRemap ? 'Corrective target correspondence' : ($failedArapRemap ? 'Failed corrective target correspondence' : ($separationStudy ? 'Shoulder contact separation study' : ($failedContact ? (($profile['method']??null)==='failed-shoulder-separation-v1' ? 'Failed shoulder separation study' : (($profile['method']??null)==='failed-hip-contact-aware-v1' ? 'Failed hip contact-aware trial' : 'Failed corrected contact map')) : ($shapeStudy ? 'Shoulder shape target study' : ($motionReview ? 'Corrective motion interpolation' : ($failedVisual ? 'Failed candidate visual review' : ($portableBake ? 'Portable corrective bake' : ($socketStudy ? ($hipStudy ? 'Hip socket placement study' : 'Shoulder socket placement study') : ($surfaceProbe ? 'Joint surface correction probe' : ($skinningModeStudy ? 'Skin volume diagnostic' : 'Residual collision weight profile')))))))))))))) }}</h2>
<p>{{ $profile['status']??'diagnostic' }} / {{ $socketStudy ? 'Colab diagnostic joint placements; weights held fixed, no candidate qualified.' : (($surfaceProbe || $portableBake || $shapeStudy || $separationStudy) ? 'Colab experiment; source preserved, no candidate qualified.' : 'Colab measurement only; no weights or geometry changed.') }} Candidate {{ $diagnostic['plan']['parent_candidate_id']??$diagnostic['plan']['candidate_id']??'unknown' }}.</p>
@if(isset($profile['error']))<p class="failure-box">{{ $profile['error'] }}</p>@endif
@if(isset($profile['scope']))<p class="fine">{{ $profile['scope'] }}</p>@endif
@if($interruptedHipRemap)
<p class="notice">The remap was interrupted; its result is unknown and no target was registered.</p>
@elseif($hipFoldArap)
<p class="notice">This is a posed-surface experiment, not a model or visual approval.</p>
<div style="overflow-x:auto"><table><thead><tr><th>Joint</th><th>Contacts before</th><th>Contacts after</th><th>Shape metric before</th><th>Shape metric after</th><th>Maximum displacement (mm)</th></tr></thead><tbody>
@foreach(($profile['hip_trials']??[]) as $trial)
<tr><td>{{ $trial['joint'] }}</td><td>{{ $trial['before_intersections'] }}</td><td>{{ $trial['after_intersections'] }}</td><td>{{ number_format($trial['edge_strain_before']??$trial['fold_loss_before'],4) }}</td><td>{{ number_format($trial['edge_strain_after']??$trial['fold_loss_after'],4) }}</td><td>{{ number_format($trial['max_added_delta_m']*1000,3) }}</td></tr>
@endforeach
</tbody></table></div>
@elseif($hipFoldProfile)
<p class="notice">Exploratory contact-patch measurements against rest; these do not establish a deformation pass or exclude contacts.</p>
<div style="overflow-x:auto"><table><thead><tr><th>Joint</th><th>Bend</th><th>Contacts</th><th>Patch edges</th><th>Edges below half rest length</th><th>Edges over 1.5 times rest length</th><th>90th percentile fold change</th></tr></thead><tbody>
@foreach(($profile['poses']??[]) as $pose)
<tr><td>{{ $pose['joint'] }}</td><td>{{ $pose['degrees'] }}</td><td>{{ $pose['intersections'] }}</td><td>{{ $pose['patch_edges'] }}</td><td>{{ $pose['compressed_below_0_5'] }}</td><td>{{ $pose['expanded_over_1_5'] }}</td><td>{{ number_format($pose['signed_dihedral_change_degrees']['p90'],1) }} degrees</td></tr>
@endforeach
</tbody></table></div>
@elseif($contactTopology)
<p class="notice">Mesh edge distance is a connectivity measure, not penetration depth or visual approval. Distances over six edges are not measured further.</p>
<div style="overflow-x:auto"><table><thead><tr><th>Joint at 90 degrees</th><th>Region pair</th><th>Contacts</th><th>Mesh edge distances</th><th>Mean rest centroid distance (mm)</th></tr></thead><tbody>
@foreach(($profile['poses']??[]) as $pose) @foreach(($pose['regions']??[]) as $region)
<tr><td>{{ $pose['joint'] }}</td><td>{{ $region['pair'] }}</td><td>{{ $region['count'] }}</td><td>{{ collect($region['edge_hop_histogram']??[])->map(fn($count,$distance)=>$distance.': '.$count)->implode(', ') }}</td><td>{{ number_format(($region['rest_centroid_distance_m']['mean']??0)*1000,2) }}</td></tr>
@endforeach @endforeach
</tbody></table></div>
@elseif($arapRemap)
<p>Mapped {{ $profile['mapping']['native_vertices']??0 }} native vertices; {{ $profile['mapping']['unmatched_native']??'unknown' }} unmatched. This is a diagnostic target, awaiting exported and visual review.</p>
@elseif($failedArapRemap)
<p class="notice">This attempt failed and is retained only as evidence; its incomplete output is not a usable target.</p>
@elseif($separationStudy)
<p class="notice">Single-shoulder posed-surface experiment only; no model or anatomical approval has been produced.</p>
@php($surfaceResult=$profile['separation']??$profile['arap']??$profile['centroid_probe']??null)
@if($surfaceResult)<p>90-degree left shoulder intersections: {{ $surfaceResult['before_intersections'] }} before / {{ $surfaceResult['after_intersections'] }} after. Maximum added displacement {{ number_format($surfaceResult['max_added_delta_m']*1000,2) }} mm.</p>@endif
@elseif($failedContact)
<p class="notice">This attempt failed and is retained only as evidence; its incomplete output is not a usable repair or contact map.</p>
@elseif($shapeStudy)
<p class="notice">This compares diagnostic surface targets. An exported candidate and visual review are needed before judging the shoulder shape.</p>
<div style="overflow-x:auto"><table><thead><tr><th>Target</th><th>Joint</th><th>Bend</th><th>Intersections</th><th>Change from native</th></tr></thead><tbody>
@foreach(($profile['variants']??[]) as $variant) @foreach(($variant['poses']??[]) as $pose)
<tr><td>{{ $variant['name'] }}</td><td>{{ $pose['joint'] }}</td><td>{{ $pose['degrees'] }}</td><td>{{ $pose['self_intersections'] }}</td><td>{{ $pose['delta_vs_parent']??'baseline' }}</td></tr>
@endforeach @endforeach
</tbody></table></div>
@elseif($motionReview)
<p class="notice">Controlled single-joint cycles only; this does not qualify game animations or appearance. {{ count($profile['regressions']??[]) }} sampled poses have more intersections than the native comparison.</p>
@foreach(($profile['assets']??[]) as $asset)<p>{{ $asset['label'] }}: {{ count($asset['poses']??[]) }} measured poses, {{ count($asset['cycles']??[]) }} cycles.</p>@endforeach
@elseif($failedVisual)
<p class="notice">The review stopped before completion and cannot be used as visual approval. Its preserved error is shown above.</p>
@elseif($portableBake)
<p class="notice">This attempt failed a bake check and is retained as diagnostic evidence. It is unavailable as a candidate.</p>
@elseif($skinningModeStudy || $surfaceProbe)
<p class="notice">{{ $surfaceProbe ? 'Surface evaluation is a Blender diagnostic. A useful result needs a portable GLB bake and Babylon review.' : 'The preserve-volume mode is a Blender diagnostic. It is not standard glTF/Babylon skinning and is not an exported correction.' }}</p>
<div style="overflow-x:auto"><table><thead><tr><th>Evaluation</th><th>Joint</th><th>Bend</th><th>Intersections</th><th>Change from linear baseline</th><th>Severe stretched edges</th><th>Max seam opening (mm)</th></tr></thead><tbody>
@foreach(($profile['variants']??[]) as $variant)
@foreach(($variant['poses']??[]) as $pose)
<tr><td>{{ $variant['name'] }}</td><td>{{ $pose['joint'] }}</td><td>{{ $pose['degrees'] }}</td><td>{{ $pose['self_intersections'] }}</td><td>{{ $pose['delta_vs_parent'] }}</td><td>{{ $pose['edge_deformation']['severely_stretched_edges']??'unmeasured' }}</td><td>{{ isset($pose['max_coincident_rest_vertex_spread_m']) ? number_format($pose['max_coincident_rest_vertex_spread_m']*1000,3) : 'unmeasured' }}</td></tr>
@endforeach
@endforeach
</tbody></table></div>
@elseif($socketStudy)
<div style="overflow-x:auto"><table><thead><tr><th>Placement</th><th>Joint</th><th>Bend</th><th>Intersections</th><th>Change from parent</th><th>Weights preserved after export</th></tr></thead><tbody>
@foreach(($profile['variants']??[]) as $variant)
@if(($variant['status']??null)==='rejected_by_frozen_bounds')
<tr><td>{{ $variant['variant'] }}</td><td colspan="5">Rejected by unchanged source-section/displacement bounds. No candidate exported.</td></tr>
@endif
@foreach(($variant['poses']??[]) as $pose)
@if(str_starts_with($pose['joint'],$hipStudy ? 'Thigh' : 'UpperArm'))
<tr><td><a href="{{ route('preparations.preview',[$preparation,'view'=>'candidate','candidate'=>$variant['candidate_id']]) }}">{{ $variant['variant'] }}</a></td><td>{{ $pose['joint'] }}</td><td>{{ $pose['degrees'] }}</td><td>{{ $pose['self_intersections'] }}</td><td>{{ $pose['delta_vs_parent'] }}</td><td>{{ ($variant['weight_correspondence']['verified']??false) ? 'Verified' : 'Failed' }}</td></tr>
@endif
@endforeach
@endforeach
</tbody></table></div>
@else
<div style="overflow-x:auto"><table><thead><tr><th>Joint at 90°</th><th>Total intersections</th><th>Dominant region pair</th><th>Pairs</th><th>Unique vertices</th><th>Mean vertex weights</th></tr></thead><tbody>
@foreach(($profile['pose_diagnostics']??[]) as $pose)
@foreach(($pose['top_region_weight_profiles']??[]) as $region)
<tr><td>{{ $pose['joint'] }}</td><td>{{ $pose['self_intersections'] }}</td><td>{{ implode(' / ',$region['regions']) }}</td><td>{{ $region['intersection_pairs'] }}</td><td>{{ $region['unique_vertices'] }}</td><td>{{ collect($region['weight_mean_by_group']??[])->map(fn($weight,$bone)=>$bone.' '.number_format($weight,3))->implode(', ') }}</td></tr>
@endforeach
@endforeach
</tbody></table></div>
@endif
<details><summary>Exact diagnostic evidence</summary><pre>{{ json_encode($diagnostic,JSON_PRETTY_PRINT) }}</pre></details></section>
@endforeach
@foreach(($preparation->state['candidate_visual_reviews']??[]) as $reviewId=>$visual)
<section class="panel"><h2>Candidate visual review {{ substr($reviewId,0,8) }}</h2>
<p>{{ $visual['visual_assessment']['status']??'Rendered for review' }} / unqualified. {{ count($visual['render']['views']??[]) }} recorded views; {{ count($visual['render']['errors']??[]) }} browser errors.</p>
@foreach(($visual['visual_assessment']['observations']??[]) as $observation)<p>{{ $observation }}</p>@endforeach
<details><summary>Exact visual review evidence</summary><pre>{{ json_encode($visual,JSON_PRETTY_PRINT) }}</pre></details></section>
@endforeach
<details><summary>Frozen cloud execution evidence</summary><pre>{{ json_encode($preparation->state['cloud_raw_rig']??[],JSON_PRETTY_PRINT) }}</pre></details>
@if(is_file(public_path('base-inspector/base-inspector.js')))<script type="module" src="{{ asset('base-inspector/base-inspector.js') }}?v={{ hash_file('sha256',public_path('base-inspector/base-inspector.js')) }}"></script>
@else<p class="notice">Build the base inspector to enable playback.</p>@endif
@endsection
