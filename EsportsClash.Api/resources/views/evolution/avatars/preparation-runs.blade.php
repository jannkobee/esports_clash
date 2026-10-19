@forelse($runs as $run)
@php($deletable=app(\App\Services\ReportDeletionService::class)->canDelete('preparation',$run->status,$run->control))
<article class="run-row" id="preparation-{{ $run->id }}" data-preparation-id="{{ $run->id }}"><div class="run-title"><label class="preparation-selection"><input type="checkbox" class="preparation-select" name="ids[]" value="{{ $run->id }}" form="preparation-bulk-delete" @disabled(!$deletable) aria-label="Select {{ $catalog[$run->avatar_id]['name']??$run->avatar_id }} report {{ substr($run->id,0,8) }} for deletion"><strong>{{ $catalog[$run->avatar_id]['name']??$run->avatar_id }}</strong></label><span class="badge">{{ str_replace('_',' ',$run->status) }}</span></div>
@include('evolution.avatars.preparation-progress')<p class="fine">{{ $run->created_at->timezone('Asia/Manila')->format('M j, Y, g:i A') }} &middot; {{ $run->plan['profile']??'Unknown profile' }} &middot; <code>{{ $run->id }}</code></p>
@if($run->error)<p class="error-text">{{ $run->error }}</p>@endif
@foreach($run->state['report']['reasons']??$run->state['preparation']['problems']??[] as $reason)<p class="error-text">{{ $reason }}</p>@endforeach
@if(isset($run->state['preparation']['predicted_bones']))
<details id="preparation-bones-{{ $run->id }}"><summary>UniRig bones and native clip mapping</summary><pre>{{ json_encode(['predicted_bones'=>$run->state['preparation']['predicted_bones'],'bone_map'=>$run->state['preparation']['bone_map']??[]],JSON_PRETTY_PRINT) }}</pre></details>
@endif
@if($run->status==='awaiting_retarget')
<p class="notice">UniRig produced a real rig. Review the predicted bones in the report and queue a new preparation with an explicit bone map; native game compatibility has not been established.</p>
@endif
<div class="run-links"><a href="{{ route('preparations.report',$run) }}">Preparation report</a>
@if(isset($run->state['preparation']['sha256']))
<a href="{{ route('preparations.preview',$run) }}">Inspect model and animations</a>
<a href="{{ route('preparations.file',[$run,'candidate-01.glb']) }}">Prepared GLB</a>
@if(($run->plan['provider']??'')==='unirig')
<a href="{{ route('preparations.file',[$run,'unirig-rigged.glb']) }}">Original UniRig rig</a>
@endif
<a href="{{ route('preparations.file',[$run,'candidate-01.blend']) }}">Editable Blender scene</a>
@endif
</div>
@if(in_array($run->status,['awaiting_validation','needs_review']))<form method="post" action="{{ route('preparations.validate',$run) }}">@csrf<button>Run runtime qualification</button></form>@endif
@if($run->status==='ready')<form method="post" action="{{ route('preparations.publish',$run) }}">@csrf<label><input type="checkbox" name="identity_review" value="1" required> I reviewed identity, equipment, team readability, deformation and ability attachments in the previews.</label><button class="primary">Publish qualified visual version</button></form>@endif
@include('evolution.avatars.preparation-controls')
@include('evolution.avatars.cancel',['type'=>'preparation'])
@if($run->status==='published')<p class="fine">Published for new scenes. Use <a href="{{ route('avatars.index') }}">visual history and rollback</a> to restore a previous version.</p>@endif
@if(!$deletable)<p class="fine">This job must finish or acknowledge cancellation before its report can be selected for deletion.</p>@endif
@include('evolution.delete-report',['type'=>'preparation'])</article>@empty<p class="muted">No preparation jobs yet. Choose a completed generation above.</p>@endforelse
