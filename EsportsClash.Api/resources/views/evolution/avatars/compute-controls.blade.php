@php
    $preference = $computePreference ?? 'google';
    $selectedCompute = $operations['compute']['selected'] ?? (($operations['provider'] ?? null) === 'google-colab' ? 'google' : 'local');
    $computeSupported = $operations['compute']['switching_supported'] ?? false;
@endphp
<div class="compute-controls">
    <form method="post" action="{{ route('trellis.compute') }}" data-no-ajax>
        @csrf @method('PATCH')
        <div class="generation-queue-row">
            <label for="compute-preference">Generation compute
                <select id="compute-preference" name="compute_preference" aria-describedby="compute-help">
                    <option value="google" @selected($preference === 'google')>Google Colab</option>
                    <option value="local" @selected($preference === 'local')>Local</option>
                </select>
            </label>
            <button type="submit">Save compute preference</button>
            <a href="{{ url()->current() }}#generate" class="button quiet">Refresh status</a>
        </div>
        <p class="fine" id="compute-help">Applies to new body-generation jobs across all avatars. Google automatically falls back to Local if it disconnects or generation fails. Existing jobs keep their saved choice.</p>
    </form>
    @if(!$operations)
        <p class="notice" role="status">Generation worker offline. You can save your preference now; generation resumes after the worker reconnects.</p>
    @elseif($computeSupported)
        <p class="fine" role="status">Selected: <strong>{{ $selectedCompute === 'google' ? 'Google Colab' : 'Local' }}</strong> &middot; Generator: <strong>TRELLIS.2</strong>@if($operations['compute']['fallback_reason'] ?? null) &middot; {{ $operations['compute']['fallback_reason'] }}@endif</p>
        @foreach($operations['compute']['backends'] ?? [] as $backend => $status)
            <p class="fine"><strong>{{ $backend === 'google' ? 'Google Colab' : 'Local' }}:</strong> {{ !empty($status['available']) ? 'TRELLIS.2 ready' : ($status['reason'] ?? 'Not ready') }}</p>
        @endforeach
        @if(!($operations['compute']['ready'] ?? false))<p class="notice" role="status">TRELLIS.2 setup needed. Connect a provisioned runtime with its checkpoints and passing GPU checks to enable generation.</p>@else<p class="fine">Review the generated anatomy, reference similarity and textures before preparing a rig.</p>@endif
        <p class="fine"><a href="{{ route('trellis.colab-setup') }}">Download TRELLIS.2 Colab setup notebook</a> &middot; Use your approved Hugging Face access through Colab Secrets.</p>
    @else
        <p class="fine" role="status">This worker supports Local only. Your preference is saved for a connected Google-capable worker.</p>
    @endif
</div>
