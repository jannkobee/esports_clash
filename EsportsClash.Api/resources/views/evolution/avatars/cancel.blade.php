@if(in_array($run->status,\App\Services\AvatarJobCancellationService::CANCELLABLE,true))
@if($run->status==='cancelling')<p class="notice" role="status">Stopping worker &mdash; publication is blocked. Cancellation retries automatically until acknowledged.</p>
@else<form method="post" action="{{ route('avatar-jobs.cancel',[$type,$run->id]) }}">@csrf<button class="danger">Cancel {{ $type }}</button></form>@endif
@endif
