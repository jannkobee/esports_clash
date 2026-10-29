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
                </select>
            </label>
            <button type="submit">Save compute preference</button>
            <a href="{{ url()->current() }}#generate" class="button quiet">Refresh status</a>
        </div>
        <p class="fine" id="compute-help">New body and equipment generation require Google Colab. Disconnections block processing; local fallback is disabled. Historical jobs retain their recorded compute evidence.</p>
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
        <p class="notice" role="status">A verified Google Colab runtime is required before generation can start.</p>
    @endif
</div>
