@extends('evolution.layout')
@section('title',$avatar['name'].' | Avatar studio')
@section('content')
<a href="{{ route('trellis.index') }}#avatar-{{ $avatar['id'] }}">&larr; All avatars</a>
<div class="page-heading studio-heading">
    <div><p class="eyebrow">AVATAR STUDIO / {{ $avatar['role'] }}</p><h1>{{ $avatar['name'] }}</h1><p class="muted">{{ $avatar['design']['silhouette'] ?? $avatar['motif'] ?? '' }}</p></div>
    <span class="badge {{ $retainedModel ? 'good' : '' }}">{{ $retainedModel ? '3D source available' : ($currentReference && empty($currentReference['is_legacy']) ? 'Body uploaded' : 'Body reference needed') }}</span>
</div>
<nav class="studio-steps" aria-label="Avatar workflow">@if($completedModel)<a href="#models">3D models</a>@endif<a href="#assets">Source assets</a><a href="#generate">Generate model</a><a href="#generation-history">Job history</a></nav>
@if($completedModel && isset($completedModel->state['artifact']['sha256'],$completedModel->plan['reference_sha256']))
<div class="section-heading"><div><h2>3D models</h2><p class="muted">Review a generated source here, then prepare its rig and animations.</p></div><a class="button" href="{{ route('preparations.index',['generation'=>$completedModel->id]) }}">Prepare this model &rarr;</a></div>
@if($models->count()>1)<nav class="studio-steps" aria-label="Model versions">@foreach($models as $model)<a href="{{ route('trellis.avatar',[$avatar['id'],'model'=>$model->id]) }}#models" @if($model->id===$completedModel->id) aria-current="page" @endif>{{ $model->created_at->timezone('Asia/Manila')->format('M j, g:i A') }} / {{ substr($model->id,0,8) }}</a>@endforeach</nav>@endif
@include('evolution.avatars.model-review',['generation'=>$completedModel,'name'=>$avatar['name']])
<details class="clean-details model-actions"><summary>Model details &amp; deletion</summary><p class="fine">This source needs rigging and qualification before live use. SHA-256: <code>{{ $completedModel->state['artifact']['sha256'] }}</code></p>@include('evolution.avatars.delete-generated-model',['model'=>$completedModel])</details>
@endif
@include('evolution.avatars.asset-editor')
@include('evolution.avatars.generation-controls')
<section class="panel" id="generation-history">
    <div class="section-heading"><div><p class="eyebrow">03 / MODELS &amp; HISTORY</p><h2>Generation history</h2></div><p class="fine" id="live-status">Status refreshes every 10 seconds.</p></div>
    @include('evolution.avatars.report-toolbar')
    <div id="live-reports" data-url="{{ route('trellis.live',['avatar_id'=>$avatar['id']]) }}">@include('evolution.avatars.generation-runs',['emptyMessage'=>'No generation reports yet. Upload a body reference, then create your first 3D source.'])</div>
</section>
@endsection
