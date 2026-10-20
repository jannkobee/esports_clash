<section class="preparation-attempt-controls" aria-label="Pause resume and retry controls">
@if($run->previous_preparation_id)<p class="fine">Linked attempt from <a href="#preparation-{{ $run->previous_preparation_id }}">{{ $run->previous_preparation_id }}</a>. The original source and earlier attempt are preserved.</p>@endif
@if($run->control['replacement_id']??null)
<p class="notice">This attempt was continued as <a href="#preparation-{{ $run->control['replacement_id'] }}">{{ $run->control['replacement_id'] }}</a>. Use that linked attempt for progress and controls.</p>
@elseif($run->control['intent']??null)
<p class="notice" role="status">{{ ucfirst($run->control['intent']) }} requested. {{ $run->status==='pausing'?'Waiting for both workers to acknowledge the stop.':($run->status==='cancelling'?'Stopping both workers before admitting a linked retry.':'The stopped job is waiting for linked-attempt admission.') }} No parallel attempt will be created.</p>
@if(in_array($run->control['intent'],['resume','retry'],true))<form method="post" action="{{ route('preparations.control',$run) }}">@csrf<input type="hidden" name="operation" value="cancel_pending"><button class="danger">Cancel linked-attempt request</button></form>@endif
@else
@if($run->control['restart_error']??null)<p class="error-text">{{ $run->control['restart_error'] }}</p>@endif
<div class="actions">
@if(in_array($run->status,\App\Services\AvatarPreparationService::ACTIVE,true))
<form method="post" action="{{ route('preparations.control',$run) }}">@csrf<input type="hidden" name="operation" value="pause"><button class="danger">Pause preparation</button></form>
@endif
@if($run->status==='paused')
<form method="post" action="{{ route('preparations.control',$run) }}">@csrf<input type="hidden" name="operation" value="resume"><button class="primary">Resume preparation</button></form>
@endif
@if(in_array($run->status,\App\Services\AvatarPreparationControlService::RETRYABLE,true))
<form method="post" action="{{ route('preparations.control',$run) }}">@csrf<input type="hidden" name="operation" value="retry"><button>Retry preparation</button></form>
@endif
</div>
@if(in_array($run->status,[...\App\Services\AvatarPreparationControlService::RETRYABLE,'pausing','cancelling'],true))<p class="fine">Pause safely stops worker processes and waits for acknowledgement; it does not freeze model memory in place. Resume and Retry create one linked attempt using the same source and settings. Unfinished work may repeat. Retry first stops the old attempt; it cannot fix insufficient memory, a missing bone map or failed quality checks.</p>@endif
@endif
</section>
