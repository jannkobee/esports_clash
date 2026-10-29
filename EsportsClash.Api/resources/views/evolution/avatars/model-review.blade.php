<div class="generation-comparison" id="models">
    <section class="panel">
        <div class="run-title">
            <h2>{{ ($preparedModel??null) ? 'Animated model' : 'Source body / unrigged' }}</h2>
            <a href="{{ ($preparedModel??null) ? route('preparations.file',[$preparedModel,'candidate-01.glb']) : route('trellis.asset',$generation) }}">Download</a>
        </div>
        @if($preparedModel??null)<p class="fine">Latest preparation &middot; {{ str_replace('_',' ',$preparedModel->status) }}. <a href="{{ route('preparations.report',$preparedModel) }}">Open report</a> &middot; <a href="{{ route('trellis.asset',$generation) }}">Download unrigged source</a></p>@endif
        <div id="generation-stage" data-asset="{{ ($preparedModel??null) ? route('preparations.file',[$preparedModel,'candidate-01.glb']) : route('trellis.asset',$generation) }}" aria-label="Interactive generated model"></div>
        <div class="actions">
            <button type="button" data-model-view="front">Front</button>
            <button type="button" data-model-view="side">Side</button>
            <button type="button" data-model-view="back">Back</button>
            <button type="button" data-model-view="fit">Fit</button>
            <button type="button" id="generation-wireframe" aria-pressed="false" title="Toggle wireframe rendering">🕸️ Wireframe</button>
            <button type="button" id="generation-skeleton" aria-pressed="false" title="Toggle skeleton bones overlay">🦴 Skeleton</button>
            <button type="button" id="generation-grid" aria-pressed="false" title="Toggle ground grid">📐 Grid</button>
            @if($preparedModel??null)
                <label>Animation<select id="generation-animation"><option value="">Rest pose (rig inspection)</option></select></label><button type="button" id="generation-play">Pause</button>
                <label>Speed<select id="generation-speed"><option value="1">1.0x</option><option value="0.5">0.5x</option><option value="0.25">0.25x</option></select></label>
            @endif
        </div>
        <p class="fine" id="generation-view-status" role="status">Loading the actual generated file…</p>
        <p class="fine">Drag to orbit &middot; Scroll or pinch to zoom. {{ ($preparedModel??null) ? 'Idle plays by default. Review the complete animation cycle and equipment before publishing.' : 'Review the original source anatomy and rest pose before rigging. Outfit fitting and deformation review follow base-rig validation.' }}</p>
    </section>

    <section class="panel">
        <div class="run-title">
            <h2>Original generation input</h2>
            <span class="badge good">Frozen input</span>
        </div>
        <div class="generation-reference-large">
            <img src="{{ route('trellis.reference', [$generation->avatar_id, $generation->plan['reference_sha256']]) }}" alt="{{ $name }} original anatomical reference">
        </div>
        <div class="stat-chips" style="margin-top: 10px;">
            <span class="stat-chip">Instance Seed: <strong>{{ $generation->plan['seed'] }}</strong></span>
            <span class="stat-chip">Reference: <strong>Recorded at generation time</strong></span>
        </div>
        <p class="fine">This is the reference recorded for this model. Replacing the current body above does not change this input or regenerate the model.</p>
    </section>
</div>

<script type="importmap">{"imports":{"three":@json(asset('evolution-vendor/three/three.module.js'))}}</script>
<script type="module" src="{{ asset('generation-viewer.js') }}"></script>
