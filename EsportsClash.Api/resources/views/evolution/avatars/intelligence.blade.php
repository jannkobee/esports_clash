<section class="panel" aria-labelledby="asset-intelligence-title">
    <div class="section-heading">
        <div>
            <h2 id="asset-intelligence-title">Asset quality learning</h2>
            <p class="muted">Quality evidence is collected while the asset worker is running. Training starts when enough reviewed examples are available.</p>
        </div>
        <span class="badge">{{ isset($intelligence['model']['champion']) ? 'Quality model active' : 'Collecting evidence' }}</span>
    </div>
    <div class="metrics">
        <article class="metric"><span>Reviewed examples</span><strong>{{ $intelligence['dataset']['examples']['verified'] ?? 0 }}</strong><small>30 training + 8 validation + 8 test source families required</small></article>
        <article class="metric"><span>Awaiting review</span><strong>{{ $intelligence['dataset']['examples']['uncertain'] ?? 0 }}</strong><small>Technical passes still need a trusted quality rating</small></article>
        <article class="metric"><span>Compute queue</span><strong>{{ ($intelligence['compute']['jobs']['queued'] ?? 0) + ($intelligence['compute']['jobs']['waiting_resources'] ?? 0) + ($intelligence['compute']['jobs']['running'] ?? 0) }}</strong><small>{{ ($intelligence['compute']['colab_configured'] ?? false) ? 'Colab configured; compatibility checked per job' : 'Colab not configured; local quality training available' }}</small></article>
        <article class="metric"><span>Cloud storage</span><strong>{{ ($intelligence['drive']['configured'] ?? false) ? 'Configured' : 'Not connected' }}</strong><small>{{ $intelligence['drive']['registered_versions'] ?? 0 }} recorded artifact versions</small></article>
    </div>
    @if(isset($intelligence['model']['benchmark']['test_rmse']))
        <p class="fine">Locked test prediction error: {{ number_format($intelligence['model']['benchmark']['test_rmse'], 2) }} rating points. Quality predictions help rank candidates; geometry and playback checks still apply.</p>
    @endif
    @if(!$intelligence || ($intelligence['status'] ?? '') === 'initializing')
        <p class="fine">Quality coordinator status is not available yet.</p>
    @endif
</section>
