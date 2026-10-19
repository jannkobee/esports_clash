<?php
namespace App\Jobs;
use App\Models\AvatarPreparation;
use App\Services\AvatarPreparationService;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
class PollAvatarPreparation implements ShouldQueue,ShouldBeUniqueUntilProcessing {
    use Queueable;
    public int $tries=6;public int $timeout=30;public int $uniqueFor=45;
    public function __construct(public string $runId){$this->onConnection(config('avatars.queue_connection'))->onQueue(config('avatars.queue'));}
    public function uniqueId():string{return 'prepare:'.$this->runId;}
    public function backoff():array{return [15,30,60];}
    public function handle(AvatarPreparationService $service):void {
        $run=AvatarPreparation::find($this->runId);if(!$run||!in_array($run->status,$service::ACTIVE,true))return;
        if(($run->plan['provider']??null)==='unirig'){
            $rigPlan=['version'=>1,'generation_id'=>$run->generation_id,'avatar_id'=>$run->avatar_id,'source_sha256'=>$run->plan['source_sha256'],'engine_sha256'=>$run->plan['unirig_engine_sha256'],'seed'=>$run->plan['seed']];
            $rig=$service->worker()->get($service->rigEndpoint('/jobs/'.$run->id));
            if($rig->status()===404)$rig=$service->worker()->post($service->rigEndpoint('/jobs/'.$run->id),$rigPlan);
            $rigState=$rig->throw()->json();
            if(($rigState['id']??null)!==$run->id||!in_array($rigState['status']??null,['queued','rigging','waiting_models','waiting_resources','rigged_unqualified','failed','cancelled'],true))throw new \RuntimeException('Invalid UniRig worker state');
            if($rigState['status']!=='rigged_unqualified'){
                $this->observe($rigState);
                if(in_array($rigState['status'],$service::ACTIVE,true))self::dispatch($run->id)->delay(now()->addSeconds(20));return;
            }
            if(($run->progress['step']??0)<5) {
                $this->observe([...$rigState,'status'=>'preparing','stage'=>'waiting_for_animation_worker']);
            }
        }
        $response=$service->worker()->post($service->endpoint('/preparations/'.$run->id),$run->plan);
        if($response->status()===409){self::dispatch($run->id)->delay(now()->addSeconds(20));return;}
        if($response->status()===422){$this->observe(['status'=>'failed','stage'=>'worker_rejected_plan','error'=>'Worker rejected the frozen profile/engine. Create a new preparation with the current configuration.']);return;}
        $state=$response->throw()->json();
        if(($state['id']??null)!==$run->id||!in_array($state['status']??null,[...$service::ACTIVE,'awaiting_validation','awaiting_retarget','ready','needs_review','cancelled','failed'],true))throw new \RuntimeException('Invalid preparation worker state');
        $this->observe($state);
        if(in_array($state['status'],$service::ACTIVE,true))self::dispatch($run->id)->delay(now()->addSeconds(20));
    }
    private function observe(array $state):void {
        DB::transaction(function()use($state){
            $run=AvatarPreparation::lockForUpdate()->find($this->runId);
            if(!$run||!in_array($run->status,AvatarPreparationService::ACTIVE,true))return;
            $run->update(['status'=>$state['status'],'state'=>array_replace($run->state??[],$state),'error'=>$state['error']??null]);
            app(\App\Services\PreparationProgressService::class)->record($run,$state);
        });
    }
    public function failed(?\Throwable $error):void {
        $this->observe(['status'=>'waiting_worker','stage'=>'worker_unavailable','error'=>'Worker unavailable; durable recovery retains the same preparation.']);
    }
}
