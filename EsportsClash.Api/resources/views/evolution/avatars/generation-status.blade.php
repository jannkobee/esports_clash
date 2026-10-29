@extends('evolution.layout')
@php
    $isAvatar = ($avatar['category'] ?? 'avatar') === 'avatar';
    $icon = $avatar['icon'] ?? ($isAvatar ? '👑' : '📦');
@endphp
@section('title', $avatar['name'].' | 3D Studio')
@section('content')
<div class="studio-breadcrumb-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
    <a href="{{ route('trellis.index') }}#avatar-{{ $avatar['id'] }}">&larr; Back to 3D Generation Studio</a>
    @if($isAvatar)
        <a class="button" href="{{ route('registry.edit',$avatar['id']) }}">Published avatar &amp; engine values</a>
    @endif
</div>
<div class="page-heading studio-heading">
    <div>
        <p class="eyebrow">{{ strtoupper($avatar['category_label'] ?? '3D Asset') }} &middot; {{ $avatar['role'] }}</p>
        <h1>{{ $icon }} {{ $avatar['name'] }}</h1>
        <p class="muted">{{ $avatar['design']['silhouette'] ?? $avatar['silhouette'] ?? $avatar['motif'] ?? '' }}</p>
    </div>
    <span class="badge {{ $retainedModel ? 'good' : '' }}">{{ $retainedModel ? '3D model available' : ($currentReference && empty($currentReference['is_legacy']) ? 'Reference ready' : 'Reference needed') }}</span>
</div>
<nav class="studio-steps" aria-label="Asset workflow">
    @if($completedModel)<a href="#models">3D models</a>@endif
    <a href="#assets">Source assets</a>
    <a href="#generate">Generate model</a>
    <a href="#generation-history">Job history</a>
</nav>
@if($completedModel && isset($completedModel->state['artifact']['sha256'],$completedModel->plan['reference_sha256']))
<div class="section-heading">
    <div>
        <h2>3D models</h2>
        <p class="muted">{{ $isAvatar ? (($preparedModel??null) ? 'Showing the latest animated preparation for this source.' : 'Review the source body, then prepare its rig, equipment and animations.') : 'Interactive 3D model viewer. Rotate, inspect wireframe and export game-ready GLB.' }}</p>
    </div>
    @if($isAvatar)
        <a class="button" href="{{ route('preparations.index',['generation'=>$completedModel->id]) }}">{{ ($preparedModel??null) ? 'Preparation & revisions' : 'Prepare this model' }} &rarr;</a>
    @else
        <a class="button primary" href="{{ route('trellis.asset',$completedModel) }}" download="{{ $avatar['id'].'-model.glb' }}">Download 3D Model (.GLB) &darr;</a>
    @endif
</div>
@if($models->count()>1)<nav class="studio-steps" aria-label="Model versions">@foreach($models as $model)<a href="{{ route('trellis.avatar',[$avatar['id'],'model'=>$model->id]) }}#models" @if($model->id===$completedModel->id) aria-current="page" @endif>{{ $model->created_at->timezone('Asia/Manila')->format('M j, g:i A') }} / {{ substr($model->id,0,8) }}</a>@endforeach</nav>@endif
@include('evolution.avatars.model-review',['generation'=>$completedModel,'name'=>$avatar['name']])
<details class="clean-details model-actions"><summary>Model details &amp; deletion</summary><p class="fine">{{ $isAvatar ? 'This source needs rigging and qualification before live use.' : 'Game-ready 3D mesh for arena placement.' }} SHA-256: <code>{{ $completedModel->state['artifact']['sha256'] }}</code></p>@include('evolution.avatars.delete-generated-model',['model'=>$completedModel])</details>
@endif
@include('evolution.avatars.asset-editor')
@include('evolution.avatars.generation-controls')
<section class="panel" id="generation-history">
    <div class="section-heading"><div><p class="eyebrow">03 / MODELS &amp; HISTORY</p><h2>Generation history</h2></div><p class="fine" id="live-status">Status refreshes every 10 seconds.</p></div>
    @include('evolution.avatars.report-toolbar')
    <div id="live-reports" data-url="{{ route('trellis.live',['avatar_id'=>$avatar['id']]) }}">@include('evolution.avatars.generation-runs',['emptyMessage'=>'No generation reports yet. Upload a concept reference, then create your first 3D source.'])</div>
</section>
@endsection
