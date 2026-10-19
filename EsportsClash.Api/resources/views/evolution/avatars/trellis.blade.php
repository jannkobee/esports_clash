@extends('evolution.layout')
@section('title','3D Generation')
@section('content')
@php
    $references=array_replace($localReferences,$operations['references']??[]);
    $names=collect($catalog)->pluck('name','id');
    $active=$runs->whereIn('status',\App\Services\TrellisGenerationService::ACTIVE);
@endphp
<div class="page-heading"><div><p class="eyebrow">AVATAR CREATION STUDIO</p><h1>3D Generation</h1><p class="muted">An individual concept image. A new 3D source. Every avatar has its own identity and history.</p></div><a class="button" href="{{ route('avatars.index') }}">Open 3D Enhancements &rarr;</a></div>
@if($selectedDesign ?? null)<div class="notice">Using the saved appearance prompt from <a href="{{ route('management.edit',['avatar',$selectedDesign]) }}">{{ $selectedDesign->name }} v{{ $selectedDesign->version }}</a> for its concept brief. This only prepares the prompt. Uploading an image and queuing 3D generation remain manual.</div>@endif
<div class="generation-summary">
    <section class="panel"><span class="eyebrow">ROSTER</span><strong>{{ count($catalog) }}</strong><span>avatars supported</span></section>
    <section class="panel"><span class="eyebrow">REFERENCE IMAGES</span><strong>{{ count($references) }}</strong><span>concept images prepared</span></section>
    <section class="panel"><span class="eyebrow">GPU QUEUE</span><strong>{{ $active->count() }}</strong><span>one execution at a time</span></section>
    <section class="panel"><span class="eyebrow">GENERATED SOURCES</span><strong>{{ $runs->where('status','generated_unqualified')->count() }}</strong><span>in the latest 100 jobs</span></section>
</div>
<section class="panel generation-pipeline" aria-label="Generation workflow"><div><b>01 &middot; Reference image</b><p>Create a concept from the avatar's design brief, or upload your own transparent cutout.</p></div><div><b>02 &middot; TRELLIS.2</b><p>Queue a versioned image-to-3D job. Follow actual stages, resource measurements and output.</p></div><div><b>03 &middot; Qualification</b><p>Inspect the generated source. Rigging, animation and runtime validation precede live use.</p></div></section>
<section class="panel"><div class="run-title"><h2>Local GPU worker</h2><span class="badge">{{ $operations ? 'Connected' : 'Unavailable' }}</span></div>
@if($operations)
<p>{{ $operations['hardware']['gpu']??'GPU unavailable' }} &middot; {{ number_format($operations['hardware']['gpu_free_mib']??0) }} MiB VRAM free &middot; {{ ($operations['models']['ready']??false)?'Pinned checkpoints present':'Checkpoints unavailable' }}</p>
<p class="fine">{{ ($operations['gpu_validated']??false)?'GPU and workflow-node smoke checks passed. Actual generation is reported separately below.':'GPU validation pending. Queued jobs wait until this engine passes its GPU checks.' }}</p>
@if($operations['last_error']??null)<p class="error-text">{{ $operations['last_error'] }}</p>@endif
<p class="fine">Geometry {{ $operations['limits']['quantization']??'Q4_K_M' }} &middot; texture {{ $operations['limits']['texture_quantization']??$operations['limits']['quantization']??'Q4_K_M' }} &middot; {{ $operations['limits']['resolution']??512 }} resolution &middot; low-memory offload. Checkpoint readiness alone does not establish successful inference.</p>
@else<p class="muted">The GPU worker is offline. Your models and reports are retained. Generation becomes available when it reconnects.</p>@endif
</section>
<div class="page-heading"><div><h2>Choose an avatar</h2><p class="muted">New geometry belongs here. Materials, rig-compatible refinements and VFX belong in 3D Enhancements.</p></div><label>Find an avatar<input type="search" id="generation-search" placeholder="Name or role" autocomplete="off"></label></div>
<div class="generation-roster" id="generation-roster">
@foreach($catalog as $avatar)
@php
    $reference=$references[$avatar['id']]??null;
    $workerReference=$operations['references'][$avatar['id']]??null;
    $pending=$active->firstWhere('avatar_id',$avatar['id']);
    $completed=$completedModels->get($avatar['id']);
    $brief='Create one original full-body '.$avatar['role'].' character named '.$avatar['name'].'. '.($avatar['design']['silhouette']??'').'. Costume: '.($avatar['design']['costume']??'').'. Equipment: '.($avatar['design']['signature']??'').'. Skin '.($avatar['design']['skin']??'').', hair '.($avatar['design']['hair']??'').'. Polished stylized MOBA concept, coherent anatomy, clearly attached equipment, relaxed A stance, near-frontal view, entire figure visible with generous margins. Transparent RGBA background, no text, no scene, no detached particles. Preserve identity, weapon type and archetype. Single-image TRELLIS.2 reconstruction reference.';
    if (($selectedDesign->source_id ?? null) === $avatar['id'] && !empty($selectedDesign->payload['designBrief']['appearancePrompt'])) {
        $brief=$selectedDesign->payload['designBrief']['appearancePrompt']."\nFull-body concept reference, relaxed A stance, coherent anatomy and attached equipment. Entire figure visible with generous margins, transparent RGBA background, no text, scenery or detached VFX. Preserve identity and primary weapon type. This is a static reconstruction reference, not a skill animation.";
    }
@endphp
<article id="avatar-{{ $avatar['id'] }}" class="panel generation-card" data-search="{{ mb_strtolower($avatar['name'].' '.$avatar['role']) }}">
    <a class="generation-art generation-status-link" href="{{ route('trellis.avatar',$avatar['id']) }}" aria-label="View {{ $avatar['name'] }} 3D status">@if($reference)<img loading="lazy" src="{{ route('trellis.reference',[$avatar['id'],$reference['sha256']]) }}" alt="{{ $avatar['name'] }} full-body generation reference">@else<div class="generation-empty"><span>{{ mb_substr($avatar['name'],0,1) }}</span><p>Reference image needed</p></div>@endif</a>
    <div class="run-title"><h3><a href="{{ route('trellis.avatar',$avatar['id']) }}">{{ $avatar['name'] }}</a></h3><span class="badge">{{ $avatar['role'] }}</span></div>
    <p class="fine"><a href="{{ route('trellis.avatar',$avatar['id']) }}">View current 3D status &rarr;</a></p>
    <p class="generation-identity">{{ $avatar['design']['silhouette']??$avatar['motif'] }}</p>
    <p class="fine">{{ $reference ? 'Reference: '.str_replace('-',' ',$reference['provider']) : 'Create an image using the design brief below.' }}</p>
    @if($completed)@include('evolution.avatars.delete-generated-model',['model'=>$completed])@endif
    <form method="post" action="{{ route('trellis.start') }}" class="generation-action">@csrf<input type="hidden" name="avatar_id" value="{{ $avatar['id'] }}"><label>Seed<input type="number" name="seed" min="0" max="2147483647" value="25001" required @disabled($completed)></label><button @disabled(!$operations||!$workerReference||$pending||$completed)>{{ $completed ? '3D model already generated' : ($pending ? 'Already queued' : 'Queue 3D generation') }}</button></form>
    @if($completed)<p class="fine">Generation is disabled because this avatar already has a completed GLB. @if(!$completed->trashed())<a href="{{ route('trellis.preview',$completed) }}">Inspect existing model</a> &middot; <a href="{{ route('preparations.index') }}">Asset Preparation</a>. @else Its source report was deleted; its retained asset does not become eligible for another generation. @endif Deleting a report does not delete its model.</p>@endif
    <details><summary>Concept brief &amp; reference image</summary><p class="fine">This brief is ready for an image generator. An autonomous image provider is not configured; no paid API request is made here.</p><textarea rows="6" readonly aria-label="{{ $avatar['name'] }} concept prompt">{{ $brief }}</textarea>
    <form method="post" enctype="multipart/form-data" action="{{ route('trellis.upload') }}">@csrf<input type="hidden" name="avatar_id" value="{{ $avatar['id'] }}"><input type="hidden" name="prompt" value="{{ $brief }}"><label>Transparent full-body PNG<input type="file" name="reference" accept="image/png" required></label><p class="fine">At least 256 &times; 512, up to 12 MiB. Earlier images remain attached to their jobs.</p><button @disabled(!$operations)>Save reference image</button></form></details>
</article>
@endforeach
</div>
<section class="panel" id="generation-history"><form method="post" action="{{ route('avatar-jobs.cancel-all','generation') }}">@csrf<button class="quiet">Cancel all generation jobs</button></form><div class="run-title"><h2>3D generation history</h2><a href="{{ route('trellis.index') }}#generation-history">Refresh progress</a></div><p class="fine">Generation reports are separate from enhancement and ML reports. Sampled device VRAM includes other applications. Generated sources remain unqualified until compatibility checks pass.</p>
<p class="fine" id="live-status">Generation history refreshes every 10 seconds.</p>
<div id="live-reports" data-url="{{ route('trellis.live') }}">@include('evolution.avatars.generation-runs')</div>
</section>
@endsection
