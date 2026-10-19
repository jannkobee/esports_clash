<?php
namespace App\Services;
use App\Models\AvatarPreparation;

/** Observed checkpoints, never a fabricated inference percentage or ETA. */
class PreparationProgressService {
    public const STEPS = ['Queue & resource admission','Extract mesh','Predict skeleton','Predict skin weights','Merge original materials','Retarget native animations','Await qualification request','Run technical qualification','Review identity & equipment','Published'];
    private const STAGES = [
        'manual_admission'=>[0,'The owner requested this job. Waiting for a free GPU and sufficient memory.'],
        'preparing'=>[0,'The requested preparation is queued for worker admission.'],
        'checkpoint_verification'=>[0,'UniRig is verifying its official checkpoint files before inference can start.'],
        'native_setup_required'=>[0,'Native runtime verification is required for this exact UniRig worker version.'],
        'waiting_for_shared_gpu'=>[0,'Another visual job holds the shared GPU lease. This job will wait without running inference.'],
        'resource_admission'=>[0,'Waiting for sufficient worker memory, GPU headroom or storage budget. No progress percentage is available.'],
        'gpu_unavailable'=>[0,'The worker cannot currently read the CUDA device. The requested job is retained for recovery.'],
        'mesh_extraction'=>[1,'UniRig is extracting and simplifying mesh data for the skeleton and skin models.'],
        'skeleton_prediction'=>[2,'The skeleton model is predicting the bone hierarchy and joint positions. This stage can take several minutes.'],
        'skeleton_mesh_extraction'=>[2,'The predicted skeleton was exported. Extracting its mesh and joint hierarchy into the skinning model input.'],
        'skin_weight_prediction'=>[3,'The skin model is predicting how mesh vertices deform with the skeleton.'],
        'merge_original_materials'=>[4,'The worker is merging the predicted rig with the original mesh materials and exporting a rigged GLB.'],
        'awaiting_animation_retarget'=>[5,'UniRig exported a skinned rig. Native animation compatibility is still unverified.'],
        'waiting_for_animation_worker'=>[5,'The rig is available. Waiting for the bounded animation worker to accept the frozen preparation plan.'],
        'download_unirig_and_retarget_native_clips'=>[5,'Downloading and hash-checking the UniRig result, then mapping compatible native bones and animation clips in Blender.'],
        'review_unirig_bone_mapping'=>[5,'Automatic native bone mapping could not establish compatibility. Review predicted bone names and queue a corrected mapping.'],
        'rig_and_clips_exported_validation_deferred'=>[6,'The rig and native clips are exported. Select Run runtime qualification to continue; validation is not automatic.'],
        'validation_requested'=>[7,'You requested qualification. Waiting for the animation worker to run the technical checks.'],
        'gltf_and_actual_game_renderer'=>[7,'Running glTF, posed geometry and actual game renderer checks against the frozen baseline. This stage does not publish the asset.'],
        'qualification_blocked'=>[7,'Technical qualification found blockers. Read the reasons and report before requesting another check or preparing a revised asset.'],
        'technical_checks_passed_identity_review_required'=>[8,'Technical checks passed. Review identity, equipment, deformation, readability and ability attachments before publishing.'],
        'published'=>[9,'The qualified visual version was published. Previous assets remain available for rollback.'],
    ];
    public function describe(array $state, array $previous=[]): array {
        $status=$state['status']??'queued';$stage=$state['stage']??$status;
        $fallback=match($status){'rigging'=>'mesh_extraction','animating'=>'download_unirig_and_retarget_native_clips','awaiting_validation'=>'rig_and_clips_exported_validation_deferred','awaiting_retarget'=>'review_unirig_bone_mapping','validating'=>'gltf_and_actual_game_renderer','ready'=>'technical_checks_passed_identity_review_required','needs_review'=>'qualification_blocked','published'=>'published',default=>'manual_admission'};
        [$step,$message]=self::STAGES[$stage]??self::STAGES[$fallback];
        if($stage==='preparing'&&($previous['step']??0)>=5) {
            $step=$previous['step'];
            $message='The rig is available. The animation worker has queued the requested preparation; waiting for its next observed stage.';
        }
        if($status==='waiting_resources'&&($previous['step']??0)>=5)$step=$previous['step'];
        $known=true;
        if(in_array($status,['failed','cancelled','cancelling','pausing','paused','waiting_worker'],true)) {
            $known=$previous['position_known']??isset($previous['step']);
            $step=$previous['step']??0;
            $message=match($status){'pausing'=>'Pause was requested. Waiting for both workers to stop; inference may still be winding down.','paused'=>'Both workers acknowledged the stop. Resume creates a linked attempt; unfinished work may need to repeat.','failed'=>'Preparation stopped with an error. The original game asset is retained. Read the error and observed history below.','cancelled'=>'Cancellation is recorded. This job will not publish an asset.','cancelling'=>'Stop was requested. Waiting for both workers to acknowledge termination; the job is not stopped yet.',default=>'Worker communication is interrupted. Recovery will poll the same requested job; it will not create a new source.'};
        }
        return ['step'=>$step,'position_known'=>$known,'stage'=>$stage,'status'=>$status,'message'=>$message];
    }
    // Call while holding the preparation row lock, alongside its status update.
    public function record(AvatarPreparation $run, array $state): void {
        $progress=$run->progress??[];$event=$this->describe($state,$progress);$now=now()->toIso8601String();
        $history=$progress['events']??[];
        if(($progress['stage']??null)!==$event['stage']||($progress['status']??null)!==$event['status']) {
            $history[]=[...$event,'observed_at'=>$now];
            $progress['stage_observed_at']=$now;
        }
        $progress=[...$progress,...$event,'events'=>array_slice($history,-100),'observed_at'=>$now];
        if(isset($state['updated_unix'])&&is_numeric($state['updated_unix'])&&is_finite((float)$state['updated_unix'])) $progress['worker_updated_at']=gmdate('c',(int)$state['updated_unix']);
        if(is_array($state['resources']??null)) {
            $sample=[];
            foreach(['gpu_free_mib','gpu_used_mib','vm_available_mib'] as $key) if(isset($state['resources'][$key])&&is_numeric($state['resources'][$key])&&is_finite((float)$state['resources'][$key])&&$state['resources'][$key]>=0) $sample[$key]=round((float)$state['resources'][$key]);
            if($sample) $progress['resources']=['sample'=>$sample,'observed_at'=>$now];
        }
        $run->update(['progress'=>$progress]);
    }
    public function view(AvatarPreparation $run): array {
        $progress=$run->progress??[];
        // Status may change via cancellation/publication between polling intervals.
        $state=['status'=>$run->status,'stage'=>$run->state['stage']??$run->status];
        if(($progress['status']??null)===$run->status) $state['stage']=$progress['stage'];
        $summary=$this->describe($state,$progress);
        return [...$progress,...$summary];
    }
}
