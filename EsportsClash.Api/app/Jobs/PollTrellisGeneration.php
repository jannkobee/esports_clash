<?php
namespace App\Jobs;
use App\Models\TrellisGeneration;
use App\Services\TrellisGenerationService;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
class PollTrellisGeneration implements ShouldQueue,ShouldBeUniqueUntilProcessing
{
    use Queueable;
    public int $tries=8;
    public int $timeout=30;
    public int $uniqueFor=45;
    public function __construct(public string $runId){$this->onConnection(config('avatars.queue_connection'))->onQueue(config('avatars.queue'));}
    public function uniqueId():string{return 'trellis:'.$this->runId;}
    public function backoff():array{return [15,30,60];}
    public function handle(TrellisGenerationService $service):void
    {
        $run=TrellisGeneration::findOrFail($this->runId);
        if(!in_array($run->status,$service::ACTIVE,true))return;
        // A single GPU processes the durable roster queue in creation order.
        $first=TrellisGeneration::whereIn('status',$service::ACTIVE)->orderBy('created_at')->orderBy('id')->value('id');
        if($first!==$run->id){self::dispatch($run->id)->delay(now()->addSeconds(20));return;}
        // Read existing executions before admission: a worker upgrade must not
        // hide an older completed artifact behind a new engine fingerprint.
        $response=$service->worker()->get($service->endpoint('/jobs/'.$run->id));
        if($response->status()===404){
            $response=$service->worker()->post($service->endpoint('/jobs/'.$run->id),$run->plan);
            if($response->status()===409){self::dispatch($run->id)->delay(now()->addSeconds(20));return;}
            if($response->status()===422){$run->update(['status'=>'failed','error'=>'Worker rejected the frozen source configuration. Regenerate using the current reference and engine.']);return;}
        }
        $state=$response->throw()->json();
        if(($state['id']??null)!==$run->id||!in_array($state['status']??null,[...$service::ACTIVE,'generated_unqualified','failed','cancelled'],true))throw new \RuntimeException('Invalid trusted generation state.');
        DB::transaction(function()use($state){
            $run=TrellisGeneration::lockForUpdate()->findOrFail($this->runId);
            if(in_array($run->status,TrellisGenerationService::ACTIVE,true))$run->update(['status'=>$state['status'],'state'=>$state,'error'=>$state['error']??null]);
        });
        if(in_array($state['status'],$service::ACTIVE,true))self::dispatch($run->id)->delay(now()->addSeconds(20));
    }
    public function failed(?\Throwable $error):void
    {
        TrellisGeneration::where('id',$this->runId)->whereIn('status',TrellisGenerationService::ACTIVE)
            ->update(['status'=>'waiting_worker','error'=>'Worker polling unavailable; scheduled recovery retains the same execution and frozen plan.']);
    }
}
