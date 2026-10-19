<?php
namespace App\Services;
use App\Models\{AvatarEvolutionRun,AvatarPreparation,TrellisGeneration};
use App\Jobs\CancelAvatarJob;
use Illuminate\Support\Facades\DB;
class AvatarJobCancellationService {
    public const TYPES=['generation'=>TrellisGeneration::class,'preparation'=>AvatarPreparation::class,'enhancement'=>AvatarEvolutionRun::class];
    public const CANCELLABLE=['queued','waiting_models','waiting_resources','waiting_worker','running','paused_resource','preparing','rigging','animating','awaiting_retarget','awaiting_validation','validating','needs_review','ready','complete','cancelling','pausing'];
    public function request(string $type,string $id,string $actor):void {
        abort_unless(isset(self::TYPES[$type]),404);
        DB::transaction(function()use($type,$id,$actor){
            $model=self::TYPES[$type];$run=$model::lockForUpdate()->findOrFail($id);
            if(!in_array($run->status,self::CANCELLABLE,true))return;
            $run->update(['status'=>'cancelling']);
            if($type==='preparation'&&($run->control['intent']??null))$run->update(['control'=>[...$run->control,'intent'=>null]]);
            if($type==='preparation')app(PreparationProgressService::class)->record($run,['status'=>'cancelling','stage'=>'stop_requested']);
            app(EvolutionService::class)->audit($id,'avatar.cancel-requested',$actor,['type'=>$type]);
            DB::afterCommit(fn()=>CancelAvatarJob::dispatch($type,$id));
        });
    }
    public function synchronize(string $type,string $id):void {
        $model=self::TYPES[$type];$run=$model::find($id);if(!$run||!in_array($run->status,['cancelling','pausing'],true))return;
        $service=app($type==='generation'?TrellisGenerationService::class:AvatarEvolutionService::class);
        $path=match($type){'generation'=>'/jobs/','preparation'=>'/preparations/',default=>'/runs/'};
        $rigError=null;
        if($type==='preparation'&&($run->plan['provider']??null)==='unirig'){
            try{$rig=$service->worker()->post(rtrim(config('avatars.unirig_url'),'/').'/jobs/'.$id.'/cancel')->throw()->json();if(($rig['status']??null)!=='cancelled')throw new \RuntimeException('UniRig stop pending');}catch(\Throwable $error){$rigError=$error;}
        }
        $response=$service->worker()->post($service->endpoint($path.$id.'/cancel'));
        // 404 is NOT an acknowledgement: a stale worker may lack cancellation.
        $state=$response->throw()->json();
        if(($state['status']??null)!=='cancelled')throw new \RuntimeException('Worker has not acknowledged cancellation.');
        if($rigError)throw $rigError;
        DB::transaction(function()use($model,$id,$type,$state){
            $run=$model::lockForUpdate()->find($id);if(!$run||!in_array($run->status,['cancelling','pausing'],true))return;
            $paused=$type==='preparation'&&$run->status==='pausing';
            $run->update(['status'=>$paused?'paused':'cancelled','error'=>null]);
            if($paused)$run->update(['control'=>[...($run->control??[]),'intent'=>null,'stopped_at'=>now()->toIso8601String()]]);
            if($type==='preparation')app(PreparationProgressService::class)->record($run,['status'=>$run->status,'stage'=>$run->status]);
            if($type==='preparation'&&($run->control['intent']??null)==='retry')DB::afterCommit(fn()=>\App\Jobs\RestartAvatarPreparation::dispatch($id));
            app(EvolutionService::class)->audit($id,$paused?'avatar.preparation-paused':'avatar.cancelled','worker',['type'=>$type,'worker'=>$state]);
        });
    }
}
