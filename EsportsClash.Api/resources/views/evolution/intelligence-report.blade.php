@php($assessment=$run->result['assessment']??null)
@php($story=app(\App\Services\IntelligenceNarrative::class)->describe($run))
<section class="panel ml-readable"><p class="eyebrow">WHAT ACTUALLY CHANGED</p><h2>{{ $story['verdict'] }}</h2>
  <h3>What this study is trying to improve</h3><p>{{ $story['purpose'] }}</p>
  @if(($run->plan['domain']??'')==='arena')
  @if(!empty($story['playbook']['knowledge_only']))<p>The learner receives the rules, actual legal commands, card context and transferable kit facts. Self-play determines how to use them. There is no authored strategy or personal reward formula for each avatar.</p>
  @else<p>The starting advice is: work together to destroy the enemy Nexus; use available information; farm and pressure structures to make progress; manage health and mana; learn when a fight or risk is worthwhile. A neural model learns examples of that advice. During play, the model selects concrete commands; the old tower-risk, retreat, objective priority and strategic commitment rules do not override those choices.</p>@endif
  <p>This study learns movement, attack targets, spell choices, recalls, wards and Kaelen orb/invoke commands. The game still defines item builds, individual spell effects, resources, hit detection, terrain and crowd control. This does not yet establish unrestricted mastery of every game mechanic.</p>
  <p><strong>You can watch the updates in existing arena simulations.</strong> New matches can use an experimental checkpoint before qualification, clearly labelled in the spectator. The current match keeps its original model. An experimental checkpoint may be weaker; only the independent evaluation below can establish improvement.</p>@endif
  @if($run->plan['initialization']??null)<p>This study starts training from a retained, compatible experimental actor. That preserves learned progress between studies. The starting actor is not declared better: the independent comparison still uses the qualified incumbent or instructional foundation.</p>@endif
  <h3>How the comparison works</h3><p>The plan reserves {{ $run->plan['evaluation_seeds']??32 }} fresh evaluation seeds. The candidate and previous policy face matching drafted teams on both sides, with repeated control runs and the planned opponent versions. Development and training matches are excluded from this final test. Replaying the same seed on multiple sides does not create more independent evidence.</p>
  <h3>What is happening now</h3><p>{{ $story['stage'] }}</p>
  @if($run->status==='paused_budget')<p>The invocation budget has ended. This study keeps its original policy, seeds and evidence when it resumes; a pause does not mean the candidate passed.</p>@endif
  <h3>What the evidence actually shows</h3><ul>@foreach($story['findings'] as $finding)<li style="margin-bottom:10px">{{ $finding }}</li>@endforeach</ul>
  @if($story['limits'])<h3>What failed or remains uncertain</h3><ul>@foreach(array_unique($story['limits']) as $limit)<li style="margin-bottom:10px">{{ $limit }}</li>@endforeach</ul>@endif
  @if($story['training'])<h3>Training progress</h3>@foreach($story['training'] as $i=>$training)
    <p>Update {{ $i+1 }}: {{ $training['transitions']??'Unrecorded number of' }} experience transitions.
    {{ ($training['updated']??false)?'The optimizer updated the model.':'No model update was established.' }}
    @if(isset($training['actor_loss']))Recorded actor loss: {{ number_format($training['actor_loss'],6) }}.@endif
    @if(isset($training['value_loss']))Recorded value prediction loss: {{ number_format($training['value_loss'],6) }}.@endif
    These optimization measurements do not measure win-rate improvement.</p>
    @if(!empty($training['reward_components']))<details><summary>Where this update's rewards and penalties came from</summary>
      <p>These are raw sums over recorded training transitions for the trained actors. They depend on match length and sampling; they are not win rates, independent improvement or proof that a particular action was correct. Discounted shaping closes to zero at a real ending. A censored match has no terminal win/loss reward.</p>
      <p>Reward version: {{ $training['reward_version']??'Unrecorded' }}. Per-second discount: {{ $training['reward_gamma_second']??'Unrecorded' }}.</p>
      @php($rewardLabels=['outcome'=>'Actual terminal win or loss','structures'=>'Discounted structure progress and losses','economy'=>'Economy advantage, including bought items','trades'=>'Team kill/death balance','health'=>'Living team health balance','dragon'=>'Actual Dragon captures','siege'=>'Actual Siege Golem captures','mana'=>'Team mana readiness','shaping'=>'Total discounted progress shaping'])
      <table><thead><tr><th>Measured component</th><th>Signed training sum</th></tr></thead><tbody>
      @foreach($rewardLabels as $key=>$label)
        @if(isset($training['reward_components'][$key]))<tr><td>{{ $label }}</td><td>{{ sprintf('%+.5f',$training['reward_components'][$key]) }}</td></tr>@endif
      @endforeach
      </tbody></table>
    </details>@endif
    @if(!empty($training['identity_experience']))<details><summary>Which player cards and avatars supplied this update</summary>
    <p>These are recorded training exposures and reward components, not a mastery certificate or an independent improvement result. Censored matches have no terminal win reward.</p>
    <table><thead><tr><th>Player card</th><th>Avatar</th><th>Transitions</th>@if(($training['reward_version']??'')==='terminal-potential-mastery-v2')<th>Mastery shaping sum</th>@endif<th>Terminal outcome sum</th></tr></thead><tbody>
    @foreach($training['identity_experience'] as $entry)<tr><td>{{ $entry['cardName'] }}</td><td>{{ collect($story['playbook']['avatars']??[])->firstWhere('id',$entry['avatarId'])['name']??$entry['avatarId'] }}</td><td>{{ $entry['transitions'] }}</td>@if(($training['reward_version']??'')==='terminal-potential-mastery-v2')<td>{{ number_format($entry['mastery_shaping_sum'],4) }}</td>@endif<td>{{ number_format($entry['terminal_outcome_sum'],4) }}</td></tr>@endforeach
    </tbody></table></details>@endif
  @endforeach @endif
  <h3>What happens next</h3><p>{{ $run->status==='running'||$run->status==='queued'?'The worker continues the frozen study. Once the independent comparisons finish, this report can state whether the candidate won more often, failed a requirement, or remains inconclusive.':'Keep the conclusion attached to this policy version. Future experiments need their own fresh evidence; unfinished or rejected results are not promoted as improvements.' }}</p>
</section>
@if($story['playbook'])<section class="panel ml-readable"><h2>The detailed directions used for this study</h2>
  <p>{{ $story['playbook']['scope'] }}</p>
  @if(!empty($story['playbook']['knowledge_only']))<p>The current policy receives numeric kit facts, not a handwritten strategy for each avatar. General command preferences are inherited from an earlier foundation; new kit and card-context weights learn from real self-play. There are no avatar-specific reward weights. Adding a playable kit supplies its features automatically, but does not establish mastery or professional skill.</p>
  @else<p>The frozen written brief is converted into numerical teaching examples for the starting neural model. It is not a live script that overrides learned decisions, and reading this brief does not establish that the model has mastered each lesson.</p>@endif
  <h3>Mechanical rules</h3><ul>@foreach($story['playbook']['mechanics'] as $rule)<li style="margin-bottom:10px">{{ $rule }}</li>@endforeach</ul>
  @foreach($story['playbook']['lessons'] as $lesson)<h3>{{ $loop->iteration }}. {{ $lesson['title'] }}</h3><ul>@foreach($lesson['directions'] as $direction)<li style="margin-bottom:10px">{{ $direction }}</li>@endforeach</ul>@endforeach
  @if(isset($story['playbook']['player_identity']))
  <h3>Player card identity</h3><ul>@foreach($story['playbook']['player_identity'] as $direction)<li>{{ $direction }}</li>@endforeach</ul>
  <h3>Role lessons</h3>@foreach($story['playbook']['roles'] as $role)<details><summary>{{ $role['id'] }}</summary><ul>@foreach($role['directions'] as $direction)<li>{{ $direction }}</li>@endforeach</ul></details>@endforeach
  <h3>{{ !empty($story['playbook']['knowledge_only'])?'Frozen kit reference':'Individual lessons' }} for all {{ count($story['playbook']['avatars']) }} avatars</h3>
  @foreach($story['playbook']['avatars'] as $avatar)<details><summary>{{ $avatar['name'] }} — {{ $avatar['role'] }}: {{ !empty($story['playbook']['knowledge_only'])?$avatar['archetype']:str_replace('-',' ',$avatar['job']) }}</summary>
  @if(isset($avatar['directions']))<ul>@foreach($avatar['directions'] as $direction)<li>{{ $direction }}</li>@endforeach</ul><p>Tradeoff: {{ $avatar['tradeoff'] }}</p>@endif
  @foreach($avatar['abilities'] as $ability)<p><strong>{{ $ability['name'] }}:</strong> {{ $ability['description'] }}</p>@endforeach
  </details>@endforeach
  <h3>Learning rewards</h3><ul>@foreach($story['playbook']['rewards']['directions'] as $direction)<li>{{ $direction }}</li>@endforeach</ul>
  @endif
</section>@endif
<section class="panel"><h2>Full-match intelligence study</h2>
  <p>Domain: {{ $run->plan['domain'] }} · {{ $run->progress['stage']??'Waiting' }} · {{ $run->status }}</p>
  @if($run->error)<p class="error-text">{{ $run->error }}</p>@endif
  @if($assessment)
    <p>Assessment: <strong>{{ $assessment['status'] }}</strong> · {{ $assessment['measured']??0 }} / {{ $assessment['planned']??0 }} worlds measured · {{ $assessment['independentSeeds']??0 }} independent seeds.</p>
    @if($interval=$assessment['winDelta']??null)<p>Paired win difference: {{ number_format($interval['estimate'],4) }} (95% interval {{ number_format($interval['lower'],4) }} to {{ number_format($interval['upper'],4) }}).</p>@endif
    @foreach($assessment['reasons']??[] as $reason)<p>{{ $reason }}</p>@endforeach
  @else<p>Held-out full-match results are not available. Training loss and changed decisions do not establish competitive improvement.</p>@endif
  @php($frozenCandidate=$run->result['candidate']['hash']??null)
  @if(!$frozenCandidate && is_string($run->progress['candidate']??null) && preg_match('/^[a-f0-9]{64}$/',$run->progress['candidate']))@php($frozenCandidate=$run->progress['candidate'])@endif
  <p>Frozen evaluation candidate: <code>{{ $frozenCandidate??'Not frozen yet' }}</code>. Final evidence source: <code>{{ $run->result['source_hash']??'Recorded when the study finishes' }}</code>.</p>
  @if($run->status==='paused_budget')<form method="post" action="{{ route('intelligence.resume',$run->id) }}">@csrf<button>Resume original study</button></form>@endif
</section>
