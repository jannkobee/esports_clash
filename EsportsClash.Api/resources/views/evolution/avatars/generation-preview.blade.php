@extends('evolution.layout')
@section('title',$name.' · generated source')
@section('content')
<a href="{{ route('trellis.index') }}#generation-history">&larr; 3D Generation history</a>
<div class="page-heading"><div><p class="eyebrow">GENERATED SOURCE REVIEW</p><h1>{{ $name }}</h1><p class="muted">A textured 3D source from the frozen concept image. Compatibility qualification is still required.</p></div><span class="badge">Not published</span></div>
<div class="generation-comparison">
<section class="panel"><h2>Input concept</h2><div class="generation-reference-large"><img src="{{ route('trellis.reference',[$generation->avatar_id,$generation->plan['reference_sha256']]) }}" alt="{{ $name }} frozen input concept"></div><p class="fine">Seed {{ $generation->plan['seed'] }} &middot; {{ $generation->state['reference_source']['provider']??'Versioned reference' }}</p></section>
<section class="panel"><div class="run-title"><h2>Actual generated GLB</h2><a href="{{ route('trellis.asset',$generation) }}">Download</a></div><div id="generation-stage" data-asset="{{ route('trellis.asset',$generation) }}" aria-label="Interactive generated model"></div><div class="actions"><button type="button" data-model-view="front">Front</button><button type="button" data-model-view="side">Side</button><button type="button" data-model-view="back">Back</button><button type="button" data-model-view="fit">Fit</button></div><p class="fine" id="generation-view-status" role="status">Loading the actual generated file…</p><p class="fine">Drag to orbit &middot; Scroll or pinch to zoom. The preview does not add a rig, animations or gameplay abilities.</p></section>
</div>
<section class="panel"><h2>Qualification boundary</h2><p>This source remains outside the live game until identity, geometry, rigging, animation, attachments and runtime performance meet the configured requirements.</p><p class="fine">SHA-256 <code>{{ $generation->state['artifact']['sha256'] }}</code></p><div class="run-links"><a href="{{ route('trellis.report',$generation) }}">Download generation report</a><a href="{{ route('avatars.index') }}">3D Enhancements</a></div></section>
@include('evolution.avatars.delete-generated-model',['model'=>$generation])
<script type="importmap">{"imports":{"three":@json(asset('evolution-vendor/three/three.module.js'))}}</script>
<script type="module" src="{{ asset('generation-viewer.js') }}"></script>
@endsection
