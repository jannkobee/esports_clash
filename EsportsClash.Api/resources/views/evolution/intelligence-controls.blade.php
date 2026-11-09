<section class="panel" style="margin-bottom:20px">
  <p class="eyebrow">INTELLIGENCE LAB</p><h2>Full-match learning</h2>
  <p class="muted">Arena learning chooses movement, targets, spells, recalls and wards in the actual match engine. New ordinary simulations can preview labelled learning checkpoints. Qualification still requires 32 independent seeds, repeated controls, both sides, planned opponents and a positive 95% improvement bound. Arena studies report deaths as a diagnostic, allowing learned trades; historical macro studies retain their original zero-extra-deaths gate.</p>
  <p>Current policy: <strong>{{ app(\App\Services\IntelligenceService::class)->manifest()['id'] ?? 'Existing policy' }}</strong>. A running match keeps its starting version.</p>
  <p>Qualified arena champion: <code>{{ $settings->preferences['intelligence_arena_champion']??'Instructional foundation; no qualified arena improvement yet' }}</code>. Arena matches can preview labelled experimental checkpoints. Historical macro studies keep their separate manual activation control.</p>
  <form method="post" action="{{ route('intelligence.start') }}" class="settings-form">@csrf
    <input type="hidden" name="request_id" value="{{ (string)\Illuminate\Support\Str::uuid() }}">
    <label>Domain<select name="domain"><option value="arena">Arena decisions (movement, targets and spells)</option><option value="parameter">Bounded parameters</option><option value="marl">Multi-agent PPO</option><option value="source">Isolated macro source</option></select></label>
    <label>Invocation minutes<input name="max_minutes" type="number" value="30" min="16" max="90" required></label>
    <label>Total minutes<input name="total_minutes" type="number" value="1440" min="16" max="10080" required></label>
    <label>PPO generations<input name="generations" type="number" value="2" min="1" max="8" required></label>
    <label>Training matches per generation<input name="training_matches" type="number" value="4" min="1" max="16" required></label>
    <button class="primary">Queue study</button>
  </form>
  @foreach($runs->filter(fn($r)=>in_array($r->plan['version']??0,[3,4],true)) as $study)
    <div class="notice"><a href="{{ route('evolution.report',$study) }}">{{ $study->plan['domain'] }} · {{ $study->id }}</a> — {{ $study->status }}
      <p>{{ app(\App\Services\IntelligenceNarrative::class)->describe($study)['stage'] }}</p>
      @if(isset($study->progress['complete'],$study->progress['planned']))<p>{{ $study->progress['complete'] }} of {{ $study->progress['planned'] }} planned stage records collected.</p>@endif
      @if($study->status==='paused_budget')<form method="post" action="{{ route('intelligence.resume',$study->id) }}">@csrf<button>Continue next budget window</button></form>@endif
      @if(($study->result['assessment']['status']??'')==='promote')<form method="post" action="{{ route('intelligence.activate',$study->id) }}">@csrf<button>Recheck evidence and activate</button></form>@endif
    </div>
  @endforeach
  <details><summary>Continuous experiments and rollback</summary>
    <form method="post" action="{{ route('intelligence.settings') }}" class="settings-form">@csrf
      <label>Automation<select name="enabled"><option value="0" @selected(!($settings->preferences['intelligence']['enabled']??false))>Paused</option><option value="1" @selected($settings->preferences['intelligence']['enabled']??false)>Enabled</option></select></label>
      <label>Domain<select name="domain">@foreach(['arena','parameter','marl','source'] as $domain)<option @selected(($settings->preferences['intelligence']['domain']??'parameter')===$domain)>{{ $domain }}</option>@endforeach</select></label>
      <input type="hidden" name="preview_learning" value="0"><label><input type="checkbox" name="preview_learning" value="1" @checked($settings->preferences['intelligence_preview_enabled']??true)> Show experimental arena checkpoints in new matches (may be weaker)</label>
      <label><input type="checkbox" name="cycle_domains" value="1" @checked($settings->preferences['intelligence']['cycle_domains']??false)> Cycle all domains after each study</label>
      <label>Invocation minutes<input name="max_minutes" value="{{ $settings->preferences['intelligence']['max_minutes']??30 }}" type="number" min="16" max="90"></label>
      <label>Total minutes<input name="total_minutes" value="{{ $settings->preferences['intelligence']['total_minutes']??1440 }}" type="number" min="16" max="10080"></label>
      <input type="hidden" name="generations" value="2"><input type="hidden" name="training_matches" value="4"><button>Save automation</button>
    </form>
    <form method="post" action="{{ route('intelligence.rollback') }}" class="settings-form">@csrf
      <label>Restore qualified version<select name="policy_id"><option value="">Existing policy</option>
        @foreach(\Illuminate\Support\Facades\DB::table('intelligence_policies')->orderByDesc('created_at')->get() as $policy)<option value="{{ $policy->id }}">{{ $policy->id }}</option>@endforeach
      </select></label><button>Restore for new matches</button>
    </form>
  </details>
</section>
