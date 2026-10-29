<section class="panel" data-avatar-pipeline-status data-status-url="{{ route('preparations.readiness') }}">
    <div class="section-heading"><div><h2>Cloud pipeline readiness</h2><p class="muted">Each processing stage requires its own verified Colab connection.</p></div><button type="button" class="quiet" data-pipeline-refresh>Refresh stages</button></div>
    <p role="status" data-pipeline-message>Checking cloud stages&hellip;</p>
    <div class="table-scroll"><table><thead><tr><th>Stage</th><th>Engine</th><th>Compute</th><th>Status</th><th>Next requirement</th></tr></thead><tbody data-pipeline-stages></tbody></table></div>
    <p class="fine" data-pipeline-checked></p>
    <details class="clean-details"><summary>Recent deformation diagnostics</summary><div data-pipeline-diagnostics>Loading recorded cloud reviews&hellip;</div></details>
    <details class="clean-details"><summary>Execution evidence</summary><pre data-pipeline-evidence>Waiting for a readiness receipt.</pre></details>
</section>
<script src="{{ asset('avatar-pipeline-status.js') }}" defer></script>
