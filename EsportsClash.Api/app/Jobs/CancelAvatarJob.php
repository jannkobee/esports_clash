<?php
namespace App\Jobs;
use App\Services\AvatarJobCancellationService;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
class CancelAvatarJob implements ShouldQueue,ShouldBeUniqueUntilProcessing {
    use Queueable;
    public int $tries=4;public int $timeout=25;public int $uniqueFor=60;
    public function __construct(public string $type,public string $runId){$this->onConnection(config('avatars.queue_connection'))->onQueue(config('avatars.queue'));}
    public function uniqueId():string{return 'cancel:'.$this->type.':'.$this->runId;}
    public function backoff():array{return [10,30,60];}
    public function handle(AvatarJobCancellationService $service):void{$service->synchronize($this->type,$this->runId);}
}
