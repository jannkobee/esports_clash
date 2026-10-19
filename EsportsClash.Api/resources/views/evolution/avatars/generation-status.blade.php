@extends('evolution.layout')
@section('title',$avatar['name'].' · 3D status')
@section('content')
<a href="{{ route('trellis.index') }}#avatar-{{ $avatar['id'] }}">&larr; 3D Generation</a>
<h1>{{ $avatar['name'] }} &middot; 3D status</h1>
<p class="muted">Current generation and recent activity for this avatar. This page does not start another job.</p>
@if($retainedModel)<p class="notice">A completed generated model exists. Another generation is disabled. Deleted report details stay deleted.</p>@endif
<section class="panel"><p class="fine" id="live-status">Status refreshes every 10 seconds.</p>
<div id="live-reports" data-url="{{ route('trellis.live',['avatar_id'=>$avatar['id']]) }}">@include('evolution.avatars.generation-runs',['emptyMessage'=>'No visible generation reports for this avatar. Deleted report details are not shown.'])</div>
</section>
@endsection
