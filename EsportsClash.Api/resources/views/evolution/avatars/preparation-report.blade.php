@extends('evolution.layout')
@section('title',$name.' | Preparation report')
@section('content')
<a href="{{ route('preparations.index') }}#preparation-{{ $preparation->id }}">&larr; All preparation jobs</a>
<div class="page-heading studio-heading"><div><p class="eyebrow">PREPARATION REPORT</p><h1>{{ $name }}</h1><p class="muted">Current status, chronological activity and recorded evidence. Times use Asia/Manila.</p></div><a class="button" href="{{ route('preparations.report',[$preparation,'format'=>'json']) }}">Download JSON</a></div>
<p class="fine" id="live-status">Updates every 10 seconds</p>
<div id="live-reports" data-url="{{ route('preparations.live',['preparation'=>$preparation->id]) }}">@include('evolution.avatars.preparation-runs')</div>
<script src="{{ asset('preparation-controls.js') }}" defer></script>
@endsection
