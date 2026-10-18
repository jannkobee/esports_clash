@extends('evolution.layout')
@section('title', 'ML reports')
@section('content')
<div class="page-heading"><div><p class="eyebrow">MACHINE LEARNING</p><h1>ML reports</h1><p class="muted">Training progress, evaluation evidence and offline qualification results.</p></div><a class="button" href="{{ route('dashboard') }}">ML controls</a></div>
@include('evolution.reports', ['reportOnly' => true])
@include('evolution.pagination')
@endsection
