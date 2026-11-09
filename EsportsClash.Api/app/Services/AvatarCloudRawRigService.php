<?php
namespace App\Services;

use App\Jobs\PollAvatarPreparation;
use App\Models\{AvatarEvolutionSetting,AvatarPreparation,TrellisGeneration};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** A separately gated raw-rig stage; never claims animation or release readiness. */
class AvatarCloudRawRigService {
    public const PROFILE='tokenrig-colab-raw-v1';
    public function endpoint(string $path):string {return rtrim(config('avatars.trellis_url'),'/').'/rigging'.$path;}
    public function worker(){return app(AvatarEvolutionService::class)->worker()->connectTimeout(3)->timeout(22);}
    public function start(TrellisGeneration $source,string $actor,?string $previousId=null):AvatarPreparation {
        $artifact=$source->state['artifact']??[];
        if($actor==='preparation-scheduler'||!TrellisGeneration::currentAssets()->whereKey($source->id)->where('status','generated_unqualified')->exists()
            ||!preg_match('/^[a-f0-9]{64}$/',$artifact['sha256']??'')||!is_int($artifact['bytes']??null)||$artifact['bytes']<20||$artifact['bytes']>32*1024**2)
            throw ValidationException::withMessages(['generation_id'=>'Choose an exact current generated body and explicitly start its raw rig.']);
        $ops=$this->worker()->get($this->endpoint('/operations'))->throw()->json();
        AvatarPreparationService::requireCloudStage($ops,'rigging');
        if(($ops['provider']??null)!=='tokenrig'||($ops['profile']??null)!==self::PROFILE)
            throw ValidationException::withMessages(['worker'=>'The verified TokenRig Colab profile is required.']);
        AvatarEvolutionSetting::current();
        return DB::transaction(function()use($source,$actor,$artifact,$ops,$previousId){
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            $current=TrellisGeneration::currentAssets()->whereKey($source->id)->lockForUpdate()->first();
            if(!$current||$current->status!=='generated_unqualified'||($current->state['artifact']??null)!==$artifact)
                throw ValidationException::withMessages(['generation_id'=>'The source changed before admission.']);
            if(AvatarPreparation::where('avatar_id',$source->avatar_id)->whereIn('status',[...AvatarPreparationService::ACTIVE,'cancelling','pausing'])->exists())
                throw ValidationException::withMessages(['generation_id'=>'This avatar already has active preparation work.']);
            $plan=['version'=>1,'generation_id'=>$source->id,'avatar_id'=>$source->avatar_id,'source_sha256'=>$artifact['sha256'],
                'source_bytes'=>$artifact['bytes'],'provider'=>'tokenrig','profile'=>self::PROFILE,'compute'=>'google',
                'stage'=>'clean_base_raw_rig','seed'=>(int)($source->plan['seed']??25001),'engine_sha256'=>$ops['engine_sha256'],
                'source_compute'=>$source->state['compute']['selected']??'unknown','yaw'=>0,'attachments'=>[],
                'publication_eligible'=>false];
            $run=AvatarPreparation::create(['id'=>(string)Str::uuid(),'generation_id'=>$source->id,'avatar_id'=>$source->avatar_id,
                'status'=>'queued','plan'=>$plan,'previous_preparation_id'=>$previousId??AvatarPreparation::where('generation_id',$source->id)->latest()->value('id')]);
            app(PreparationProgressService::class)->record($run,['status'=>'queued','stage'=>'cloud_raw_rig_admission']);
            app(EvolutionService::class)->audit($run->id,'avatar.cloud-raw-rig-requested',$actor,['plan'=>$plan]);
            DB::afterCommit(fn()=>PollAvatarPreparation::dispatch($run->id));
            return $run;
        });
    }
    public function poll(AvatarPreparation $run):array {
        $path=$this->endpoint('/jobs/'.$run->id);
        // First recover the exact attempt. Tool upgrades cannot hide retained completed output.
        $response=$this->worker()->get($path);
        if($response->status()===404||($response->json('status')==='waiting_resources')){
            $ops=$this->worker()->get($this->endpoint('/operations'))->throw()->json();
            AvatarPreparationService::requireCloudStage($ops,'rigging');
            if(($ops['provider']??null)!=='tokenrig'||($ops['engine_sha256']??null)!==$run->plan['engine_sha256'])
                return ['status'=>'failed','stage'=>'cloud_engine_changed','error'=>'The frozen rig engine changed. Retain this attempt and start a new reviewed one.'];
            $response=$this->worker()->post($path,$run->plan);
        }
        if($response->status()===503)return ['status'=>'waiting_worker','stage'=>'waiting_for_colab','error'=>'Colab is unavailable. This exact attempt is retained; local fallback is disabled.'];
        if(in_array($response->status(),[409,422],true))return ['status'=>'failed','stage'=>'cloud_plan_rejected','error'=>$response->json('error')??'The cloud worker rejected the frozen plan.'];
        $state=$response->throw()->json();
        if(($state['id']??null)!==$run->id||($state['plan']??null)!=$run->plan||($state['publication_eligible']??true)!==false
            ||!in_array($state['status']??null,['queued','rigging','waiting_resources','rigged_unqualified','failed','cancelled'],true))
            throw new \RuntimeException('Cloud raw-rig execution identity mismatch.');
        if($state['status']==='rigged_unqualified'){
            $a=$state['artifact']??[];$proof=$state['report']??[];$execution=$state['execution']??[];
            if(($execution['compute']??null)!=='google'||($execution['engine_sha256']??null)!==$run->plan['engine_sha256']
                ||($proof['source_sha256']??null)!==$run->plan['source_sha256']||($proof['status']??null)!=='rigged_unqualified'
                ||!preg_match('/^[a-f0-9]{64}$/',$a['sha256']??'')||($proof['artifact_sha256']??null)!==$a['sha256']
                ||!is_int($a['bytes']??null)||$a['bytes']<20||$a['bytes']>64*1024**2||($proof['artifact_bytes']??null)!==$a['bytes'])
                throw new \RuntimeException('Cloud raw-rig artifact proof is incomplete.');
            return [...$state,'status'=>'needs_review','stage'=>'raw_rig_awaiting_deformation_review','cloud_raw_rig'=>$state,
                'preparation'=>['sha256'=>$a['sha256'],'bytes'=>$a['bytes'],'provider'=>'tokenrig','runtime_compatible'=>false,
                    'native_clips'=>[],'predicted_bones'=>$a['joints']??[]],
                'report'=>['qualification_complete'=>false,'publication_eligible'=>false,'source_hash'=>$run->plan['source_sha256'],
                    'remaining_gates'=>['Controlled raw-rig deformation review','Animation preparation and qualification','Appearance fitting and final review']]];
        }
        return $state;
    }
    public function file(AvatarPreparation $run):string {
        $a=$run->state['cloud_raw_rig']['artifact']??null;
        abort_unless($a,404);
        $bytes=$this->worker()->get($this->endpoint('/jobs/'.$run->id.'/artifact'))->throw()->body();
        abort_unless(strlen($bytes)===$a['bytes']&&hash_equals($a['sha256'],hash('sha256',$bytes)),409,'Raw-rig artifact hash mismatch.');
        return $bytes;
    }
}
