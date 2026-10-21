@php
    $pendingRun = ($runs ?? collect())->first(fn($run)=>in_array($run->status,[...\App\Services\TrellisGenerationService::ACTIVE,'cancelling']));
    $provider = $operations['provider'] ?? null;
    $workerConnected = in_array($provider, ['google-colab', 'trellis2-gguf', 'trellis2-router'], true);
    $backendReady = $workerConnected && (($operations['compute']['switching_supported'] ?? false) ? ($operations['compute']['ready'] ?? false) : ($operations['models']['ready'] ?? false));
    $providerBadge = match($provider) {
        'google-colab' => 'Google TRELLIS.2 ready',
        'trellis2-gguf' => 'TRELLIS.2 worker connected',
        'trellis2-router' => 'TRELLIS.2 setup needed',
        default => 'Worker offline'
    };
    $bodyReady = $currentReference && empty($currentReference['is_legacy']);
@endphp
<section class="panel generation-controls" id="generate">
    <div class="section-heading"><div><p class="eyebrow">02 / GENERATE A MODEL</p><h2>{{ empty($completedModel) ? 'Create your first 3D source' : 'Create another model' }}</h2><p class="muted">Generate a source, review its shape and appearance, then prepare its rig, animations and equipment.</p></div><span class="badge {{ $workerConnected ? 'good' : 'warning' }}">{{ $providerBadge }}</span></div>
    @include('evolution.avatars.compute-controls')
    @if($pendingRun)
        <div class="notice" role="status">{{ $pendingRun->status==='cancelling' ? 'Cancellation is awaiting worker acknowledgement.' : 'This avatar already has a generation in progress.' }} <a href="{{ route('trellis.avatar',$avatar['id']) }}#generation-history">View live progress &darr;</a></div>
    @else
        <form method="post" action="{{ route('trellis.start') }}" class="generation-action" data-no-ajax>
            @csrf<input type="hidden" name="avatar_id" value="{{ $avatar['id'] }}"><input type="hidden" name="allow_new_instance" value="1">
            <div class="generation-queue-row"><button type="submit" class="primary" @disabled(!$backendReady || !$bodyReady)>{{ empty($completedModel) ? 'Generate 3D source' : 'Generate new model' }} &rarr;</button></div>
            <p class="fine" id="seed-help">Seeds are generated automatically on the server to ensure fresh variation. Each model's seed is recorded in its report.</p>
        </form>
        @if(!$bodyReady)<p class="generation-blocker">Add a clean T-pose body reference above to enable generation. Older equipped concept art is retained for reference only.</p>@elseif(!$backendReady)<p class="generation-blocker">Your assets are saved. A verified TRELLIS.2 backend must be ready before generation can start.</p>@endif
    @endif
    @if(!empty($completedModel))<p class="fine">New generations keep your existing models. Review them in the 3D models section above.</p>@endif
</section>
