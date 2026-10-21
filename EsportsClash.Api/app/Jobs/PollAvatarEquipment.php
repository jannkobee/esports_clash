<?php
namespace App\Jobs;
use App\Models\AvatarEquipmentGeneration;
use App\Services\{AvatarEquipmentService,TrellisGenerationService};
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
class PollAvatarEquipment implements ShouldQueue,ShouldBeUniqueUntilProcessing {
    use Queueable;
    public int $tries=8;
    public int $timeout=120;
    public int $uniqueFor=150;
    public function __construct(public string $runId){$this->onConnection(config('avatars.queue_connection'))->onQueue(config('avatars.queue'));}
    public function uniqueId():string{return 'equipment:'.$this->runId;}
    public function backoff():array{return [20,40,60];}
    public function handle(TrellisGenerationService $worker,AvatarEquipmentService $equipment):void {
        $run=AvatarEquipmentGeneration::findOrFail($this->runId);
        if(!in_array($run->status,[...TrellisGenerationService::ACTIVE,'installing'],true))return;
        // Existing executions are always read first; recovery never restarts inference.
        $response=$worker->worker()->get($worker->endpoint('/jobs/'.$run->id));
        if($response->status()===404){
            $reference=$equipment->reference($run->avatar_id,$run->slot);
            if(!$reference||$reference['sha256']!==$run->plan['reference_sha256']){
                $run->update(['status'=>'superseded','error'=>'The uploaded reference changed. Generate from the current reference.']);return;
            }
            $receipt=$worker->worker()->timeout(45)->post($worker->endpoint('/equipment-references/'.$run->avatar_id.'/'.$run->slot),[
                'source_sha256'=>$reference['sha256'],'png_base64'=>base64_encode(file_get_contents($reference['path']))])->throw()->json();
            if(($receipt['sha256']??null)!==$reference['sha256'])throw new \RuntimeException('Equipment reference receipt mismatch.');
            $response=$worker->worker()->post($worker->endpoint('/equipment-jobs/'.$run->id),$run->plan);
            if($response->status()===409){self::dispatch($run->id)->delay(now()->addSeconds(20));return;}
            if($response->status()===422){$run->update(['status'=>'failed','error'=>'Worker configuration changed or the PNG was rejected. Review the reference and retry.']);return;}
        }
        $state=$response->throw()->json();
        if(($state['id']??null)!==$run->id||($state['avatar_id']??null)!==$run->avatar_id||($state['equipment_slot']??null)!==$run->slot
            ||($state['purpose']??null)!=='modular-equipment'||($state['reference_sha256']??null)!==$run->plan['reference_sha256']
            ||!in_array($state['status']??null,[...TrellisGenerationService::ACTIVE,'generated_unqualified','failed','cancelled'],true))throw new \RuntimeException('Invalid equipment execution receipt.');
        if($state['status']==='generated_unqualified'){
            $run->update(['status'=>'installing','state'=>$state]);
            try{$equipment->installGenerated($run->avatar_id,$run->slot,$run->id,'equipment-generation:'.$run->id);}
            catch(\Illuminate\Validation\ValidationException $error){$run->update(['status'=>'needs_review','error'=>$error->getMessage()]);return;}
            $run->update(['status'=>'ready','installed_at'=>now(),'error'=>null]);return;
        }
        $run->update(['status'=>$state['status'],'state'=>$state,'error'=>$state['error']??null]);
        if(in_array($run->status,TrellisGenerationService::ACTIVE,true))self::dispatch($run->id)->delay(now()->addSeconds(20));
    }
    public function failed(?\Throwable $error):void {
        AvatarEquipmentGeneration::where('id',$this->runId)->whereIn('status',[...TrellisGenerationService::ACTIVE,'installing'])
            ->update(['status'=>'waiting_worker','error'=>'Worker unavailable. Recovery will continue this same generation.']);
    }
}
