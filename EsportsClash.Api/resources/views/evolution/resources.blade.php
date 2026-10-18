@php($ops = $settings->preferences['operations_snapshot'] ?? null)
@if($ops)
<section class="panel" id="resources">
    <p class="eyebrow">MEASURED RESOURCES</p><h2>Memory &amp; storage health</h2>
    <p class="fine">{{ $ops['resources']['memory_scope'] }}. Checked {{ $settings->preferences['operations_checked_at'] ?? '—' }}. Anonymous RAM and cached file pages are shown separately.</p>
    <div class="metrics">
        <article class="metric"><span>ML anonymous RAM</span><strong>{{ number_format($ops['resources']['ml_anon_mib'], 0) }} <em>MiB</em></strong><small>Soft limit {{ $ops['policy']['ram_mib'] }} MiB</small></article>
        <article class="metric"><span>Docker VM available</span><strong>{{ number_format($ops['resources']['vm_available_mib'], 0) }} <em>MiB</em></strong><small>Total {{ number_format($ops['resources']['vm_total_mib'], 0) }} MiB; reserve {{ $ops['policy']['reserved_mib'] }}</small></article>
        <article class="metric"><span>Managed ML storage</span><strong>{{ number_format($ops['actual_storage_bytes'] / 1073741824, 2) }} <em>GiB</em></strong><small>Budget {{ $ops['policy']['storage_gib'] }} GiB · {{ $ops['protected_count'] }} protected files</small></article>
        <article class="metric"><span>Cgroup lifetime peak</span><strong>{{ number_format($ops['resources']['cgroup_peak_mib'], 0) }} <em>MiB</em></strong><small>{{ $ops['resources']['oom_kills'] }} cgroup OOM kills</small></article>
    </div>
    <p class="fine">Working set {{ number_format($ops['resources']['ml_working_set_mib'], 0) }} MiB · file cache {{ number_format($ops['resources']['ml_file_cache_mib'], 0) }} MiB · {{ $ops['retained_checkpoints'] ?? count($ops['protected_models']) }} retained checkpoints. GPU VRAM: unavailable (CPU-only image). CPU {{ isset($ops['resources']['cpu_percent']) ? number_format($ops['resources']['cpu_percent'], 1).'%' : 'awaiting another sample' }}.</p>
    <p class="{{ $ops['pause_reason'] ? 'error-text' : 'fine' }}">{{ $ops['pause_reason'] ?? 'Resource admission is available. One simulation worker is qualified.' }}</p>
    <p class="fine">Dry-run recoverable storage: {{ number_format($ops['preview']['recoverable_bytes'] / 1048576, 2) }} MiB. Legacy evidence is pinned; cleanup cannot evict it to force training.</p>
    <details><summary>Protected model/checkpoint references</summary><ul class="fine">@foreach($ops['protected_models'] as $model)<li><code>{{ $model['path'] }}</code> · {{ $model['owners'] }}</li>@endforeach</ul></details>
    <details><summary>Recent measured resource samples (up to 120)</summary><div class="fine">@foreach(array_slice($ops['history'], 0, 12) as $sample)<p>{{ \Carbon\CarbonImmutable::createFromTimestampUTC($sample['at'])->timezone('Asia/Manila')->format('g:i:s A') }} · anonymous {{ number_format($sample['ml_anon_mib'], 0) }} MiB · working set {{ number_format($sample['ml_working_set_mib'], 0) }} MiB</p>@endforeach</div></details>
</section>
@else<p class="fine">Resource telemetry is waiting for the maintenance job. Unavailable measurements are not shown as zero.</p>@endif
