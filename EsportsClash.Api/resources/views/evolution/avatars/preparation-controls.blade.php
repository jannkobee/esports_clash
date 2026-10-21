<section class="preparation-attempt-controls" aria-label="Pause resume and retry controls">
@if($run->control['replacement_id']??null)
<p class="notice">The next attempt is recorded in this report. Refresh to see its current progress.</p>
@elseif($run->control['intent']??null)
<p class="notice" role="status">{{ ucfirst($run->control['intent']) }} requested. {{ $run->status==='pausing'?'Waiting for both workers to acknowledge the stop.':($run->status==='cancelling'?'Stopping both workers before retrying.':'Waiting for retry admission.') }} Progress and earlier evidence stay in this report.</p>
@if(in_array($run->control['intent'],['resume','retry'],true))<form method="post" action="{{ route('preparations.control',$run) }}">@csrf<input type="hidden" name="operation" value="cancel_pending"><button class="danger">Cancel retry request</button></form>@endif
@else
@if($run->control['restart_error']??null)<p class="error-text">{{ $run->control['restart_error'] }}</p>@endif
<div class="actions">
@if(in_array($run->status,\App\Services\AvatarPreparationService::ACTIVE,true))
<form method="post" action="{{ route('preparations.control',$run) }}">@csrf<input type="hidden" name="operation" value="pause"><button class="quiet">Pause preparation</button></form>
@endif
@if($run->status==='paused')
<form method="post" action="{{ route('preparations.control',$run) }}">@csrf<input type="hidden" name="operation" value="resume"><button class="primary">Resume preparation</button></form>
@endif
@if(in_array($run->status,\App\Services\AvatarPreparationControlService::RETRYABLE,true))
<form method="post" action="{{ route('preparations.control',$run) }}">@csrf<input type="hidden" name="operation" value="retry"><button>Retry preparation</button></form>
@endif
</div>
@if(in_array($run->status,[...\App\Services\AvatarPreparationControlService::RETRYABLE,'pausing','cancelling'],true))<details class="job-detail" id="preparation-control-help-{{ $reportId??$run->id }}"><summary>How pause, resume and retry work</summary><p class="fine">Pause stops worker processes and waits for acknowledgement. Resume and Retry add an attempt to this report using the same source and settings, reusing a verified saved rig when available. Earlier evidence stays in the history. Unfinished work may repeat; every attempt still needs normal qualification.</p></details>@endif
@endif
</section>
