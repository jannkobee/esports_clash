<?php
namespace App\Jobs;
use App\Services\AvatarPreparationControlService;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
class RestartAvatarPreparation implements ShouldQueue,ShouldBeUniqueUntilProcessing {
    use Queueable;
    public int $tries=3;public int $timeout=60;public int $uniqueFor=60;
    public function __construct(public string $runId){$this->onConnection(config('avatars.queue_connection'))->onQueue(config('avatars.queue'));}
    public function uniqueId():string{return 'preparation-restart:'.$this->runId;}
    public function backoff():array{return [15,45];}
    public function handle(AvatarPreparationControlService $service):void{$service->restart($this->runId);}
    public function failed(?\Throwable $error):void{app(AvatarPreparationControlService::class)->failedRestart($this->runId);}
}
