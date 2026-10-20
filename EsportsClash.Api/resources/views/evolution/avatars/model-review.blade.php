<div class="generation-comparison" id="models">
    <section class="panel">
        <div class="run-title">
            <h2>Actual generated GLB</h2>
            <a href="{{ route('trellis.asset',$generation) }}">Download</a>
        </div>
        <div id="generation-stage" data-asset="{{ route('trellis.asset',$generation) }}" aria-label="Interactive generated model"></div>
        <div class="actions">
            <button type="button" data-model-view="front">Front</button>
            <button type="button" data-model-view="side">Side</button>
            <button type="button" data-model-view="back">Back</button>
            <button type="button" data-model-view="fit">Fit</button>
            <button type="button" id="generation-wireframe" aria-pressed="false" title="Toggle wireframe rendering">🕸️ Wireframe</button>
            <button type="button" id="generation-skeleton" aria-pressed="false" title="Toggle skeleton bones overlay">🦴 Skeleton</button>
            <button type="button" id="generation-grid" aria-pressed="false" title="Toggle ground grid">📐 Grid</button>
        </div>
        <p class="fine" id="generation-view-status" role="status">Loading the actual generated file…</p>
        <p class="fine">Drag to orbit &middot; Scroll or pinch to zoom. This is a generated source; skeletons, sockets and animation require preparation.</p>
    </section>

    <section class="panel">
        <div class="run-title">
            <h2>Original generation input</h2>
            <span class="badge good">Frozen input</span>
        </div>
        <div class="generation-reference-large">
            <img src="{{ route('trellis.reference', [$generation->avatar_id, $generation->plan['reference_sha256']]) }}" alt="{{ $name }} anatomical T-pose reference">
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
