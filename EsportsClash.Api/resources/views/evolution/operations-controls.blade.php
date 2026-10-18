@php($policy = $settings->preferences['operations'] ?? $settings->preferences['operations_snapshot']['policy'] ?? [])
<section class="panel" id="operations">
    <p class="eyebrow">OWNER OPERATIONS</p><h2>Training budgets &amp; safe retention</h2>
    <p class="fine">A world is one seeded scenario/checkpoint plus paired continuations, not a full MOBA match. Collection and training settings apply to new studies. Resource limits and retention settings apply immediately. Smaller valid counts do not imply equal reliability. Independent evaluation runs for every candidate.</p>
    <form method="post" action="{{ route('evolution.operations') }}" class="settings-form">@csrf<input type="hidden" name="action" value="configure">
        <div class="proposal-grid">
        @foreach(['fit_cases'=>['Fitting worlds',32,16,512],'calibration_cases'=>['Calibration worlds',24,16,512],'evaluation_cases'=>['Evaluation worlds',24,18,512],
          'max_minutes'=>['Wall-clock budget (minutes)',90,1,180],'scout_seconds'=>['Scout limit (game seconds)',360,180,900],
          'storage_gib'=>['Managed storage limit (GiB)',20,1,100],'ram_mib'=>['ML anonymous RAM limit (MiB)',2048,512,3072],
          'minimum_available_mib'=>['Minimum available VM RAM (MiB)',2048,512,65536],'reserved_mib'=>['VM RAM reserve (MiB)',2048,512,65536],
          'batch_size'=>['Optimizer microbatch size',64,1,512],'replay_capacity'=>['Compatible fitting replay capacity',512,16,2048],
          'failed_days'=>['Unreferenced failed model retention (days)',7,1,365],'raw_days'=>['Unreferenced processed trajectory retention (days)',14,1,365],
          'log_days'=>['Worker log retention (days)',30,1,365],'quarantine_hours'=>['Quarantine delay (hours)',24,1,168]] as $key=>$field)
            <label>{{ $field[0] }}<input name="{{ $key }}" type="number" min="{{ $field[2] }}" max="{{ $field[3] }}" value="{{ old($key, $policy[$key] ?? $field[1]) }}" required></label>
        @endforeach
        <label>Simulation mode<select name="speed">@foreach(['1'=>'Normal 1×','2'=>'Accelerated 2×','4'=>'Fast 4×','headless'=>'Headless fixed ticks'] as $value=>$label)<option value="{{ $value }}" @selected(($policy['speed'] ?? 'headless') === (string) $value)>{{ $label }}</option>@endforeach</select></label>
        <label>Qualified simultaneous simulation workers<input name="workers" type="number" value="1" min="1" max="1" required></label>
        <label>Automatic safe cleanup<select name="automatic_cleanup"><option value="1" @selected($policy['automatic_cleanup'] ?? true)>Enabled</option><option value="0" @selected(!($policy['automatic_cleanup'] ?? true))>Disabled</option></select></label>
        </div><button>Save training &amp; resource policy</button>
    </form>
    <div class="actions">
        <form method="post" action="{{ route('evolution.operations') }}">@csrf<input type="hidden" name="action" value="preview"><button>Preview cleanup</button></form>
        <form method="post" action="{{ route('evolution.operations') }}">@csrf<input type="hidden" name="action" value="cleanup"><button>Run safe cleanup</button></form>
    </div>
    <p class="fine">Only registered, expired, unreferenced artifacts can enter quarantine. References are checked again before deletion. Current studies, model/match/rollback pins and required evidence remain protected. No production model is deployed. GPU memory limits are unavailable with the CPU-only image; 8× and multiple simulators require qualification.</p>
    @if(isset($settings->preferences['cleanup_preview']))<pre>{{ json_encode($settings->preferences['cleanup_preview'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) }}</pre>@endif
</section>
