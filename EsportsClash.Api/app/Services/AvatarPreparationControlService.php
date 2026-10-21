<?php
namespace App\Services;
use App\Models\{AvatarPreparation,AvatarEvolutionSetting,TrellisGeneration};
use App\Jobs\{CancelAvatarJob,RestartAvatarPreparation};
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
class AvatarPreparationControlService {
    public const RETRYABLE=['queued','preparing','rigging','animating','validating','waiting_models','waiting_resources','waiting_worker','failed','cancelled','paused','awaiting_retarget','awaiting_validation','needs_review'];
    public function request(AvatarPreparation $preparation,string $operation,string $actor):void {
        // Legacy clients use the same acknowledged, evidence-preserving retry path.
        $operation=match($operation){'resume_in_place','reset'=>'retry',default=>$operation};
        DB::transaction(function()use($preparation,$operation,$actor){
            $run=AvatarPreparation::lockForUpdate()->findOrFail($preparation->id);$control=$run->control??[];
            if($operation==='cancel_pending') {
                if(in_array($control['intent']??null,['resume','retry'],true)) {
                    $run->update(['control'=>[...$control,'intent'=>null]]);
                    app(EvolutionService::class)->audit($run->id,'avatar.preparation-continuation-cancelled',$actor);
                }
                return;
            }
            if(!empty($control['replacement_id']))throw ValidationException::withMessages(['preparation'=>'This report has a newer attempt. Refresh it to use the current controls.']);
            if(!empty($control['intent']))return; // A double click cannot create two attempts.
            $allowed=match($operation){'pause'=>AvatarPreparationService::ACTIVE,'resume'=>['paused'],'retry'=>self::RETRYABLE,default=>[]};
            if(!in_array($run->status,$allowed,true))throw ValidationException::withMessages(['preparation'=>'This action is not available in the current job state. Refresh its status first.']);
            $control=[...$control,'intent'=>$operation,'actor'=>$actor,'requested_at'=>now()->toIso8601String(),'restart_error'=>null];
            $run->update(['control'=>$control]);
            if($operation==='resume') DB::afterCommit(fn()=>RestartAvatarPreparation::dispatch($run->id));
            else {
                $run->update(['status'=>$operation==='pause'?'pausing':'cancelling']);
                app(PreparationProgressService::class)->record($run,['status'=>$run->status,'stage'=>$operation==='pause'?'pause_requested':'retry_stop_requested']);
                DB::afterCommit(fn()=>CancelAvatarJob::dispatch('preparation',$run->id));
            }
            app(EvolutionService::class)->audit($run->id,'avatar.preparation-'.$operation.'-requested',$actor);
        });
    }
    public function restart(string $id):?AvatarPreparation {
        AvatarEvolutionSetting::current();
        return DB::transaction(function()use($id){
            // Match the existing admission lock order and serialize per-avatar work.
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            $old=AvatarPreparation::lockForUpdate()->find($id);if(!$old)return null;
            $control=$old->control??[];
            if(!empty($control['replacement_id']))return AvatarPreparation::find($control['replacement_id']);
            if(!in_array($control['intent']??null,['resume','retry'],true)||!in_array($old->status,['paused','cancelled'],true))return null;
            $generation=TrellisGeneration::find($old->generation_id);
            if(!$generation||($generation->state['artifact']['sha256']??null)!==($old->plan['source_sha256']??null))throw ValidationException::withMessages(['preparation'=>'The original source report is unavailable or its artifact identity changed. A fresh reviewed source is required.']);
            $new=app(AvatarPreparationService::class)->start($generation,$old->plan['profile'],(float)$old->plan['yaw'],$old->plan['attachments']??[],$control['actor'],$old->plan['bone_map']??[],$old->id);
            $old->update(['control'=>[...$control,'intent'=>null,'replacement_id'=>$new->id,'restart_error'=>null]]);
            app(EvolutionService::class)->audit($old->id,'avatar.preparation-linked-attempt',$control['actor'],['replacement_id'=>$new->id,'operation'=>$control['intent']]);
            return $new;
        });
    }
    public function failedRestart(string $id):void {
        DB::transaction(function()use($id){$run=AvatarPreparation::lockForUpdate()->find($id);if(!$run||!in_array($run->control['intent']??null,['resume','retry'],true)||!empty($run->control['replacement_id']))return;
            $run->update(['control'=>[...$run->control,'intent'=>null,'restart_error'=>'The retry could not be admitted. Check source availability, worker readiness and other active jobs, then try again.']]);
        });
    }

    public function resumeInPlace(AvatarPreparation $preparation, string $actor): void {
        $this->request($preparation,'retry',$actor);
    }

    public function resetInPlace(AvatarPreparation $preparation, string $actor): void {
        $this->request($preparation,'retry',$actor);
    }
}
