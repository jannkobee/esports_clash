<?php
namespace App\Services;
use App\Models\{AvatarPreparation,AvatarEvolutionRun,AvatarEvolutionSetting,AvatarVisualRelease,TrellisGeneration};
use App\Jobs\{PollAvatarPreparation,CheckAvatarVisualHealth};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
class AvatarPreparationService {
    public const ACTIVE=['queued','preparing','rigging','animating','validating','waiting_models','waiting_resources','waiting_worker'];
    public function worker(){return app(AvatarEvolutionService::class)->worker();}
    public function endpoint(string $path):string{return app(AvatarEvolutionService::class)->endpoint($path);}
    public function rigEndpoint(string $path):string{return rtrim(config('avatars.unirig_url'),'/').$path;}
    public function profileFor(array $meta):string{return 'unirig-v1';}
    public function tick():void {
        // Kept for backward compatibility; visual admission is manual-only.
        return;
    }
    public function start(TrellisGeneration $generation,string $profile,float $yaw,array $attachments,string $actor,array $boneMap=[],?string $previousId=null):AvatarPreparation {
        if($generation->status!=='generated_unqualified')throw ValidationException::withMessages(['generation_id'=>'Select a completed generated source.']);
        $artifact=$generation->state['artifact']??[];
        if(!preg_match('/^[a-f0-9]{64}$/',$artifact['sha256']??''))throw ValidationException::withMessages(['generation_id'=>'The source has no frozen artifact hash.']);
        $meta=collect(app(AvatarEvolutionService::class)->catalog())->firstWhere('id',$generation->avatar_id);
        abort_unless($meta,422);
        if($profile!=='unirig-v1')throw ValidationException::withMessages(['profile'=>'Use the UniRig provider. Local surface-transfer admission is retired.']);
        try{$rigOps=$this->worker()->get($this->rigEndpoint('/operations'))->throw()->json();$rigEngine=$rigOps['engine_sha256']??null;}catch(\Throwable){throw ValidationException::withMessages(['worker'=>'The local UniRig worker is unavailable. Complete its installation/startup before queuing a rig.']);}
        if(($rigOps['runtime_ready']??false)!==true||($rigOps['models_ready']??false)!==true)throw ValidationException::withMessages(['worker'=>'UniRig checkpoints/native setup are not ready. No job was queued.']);
        if(!is_string($rigEngine)||!preg_match('/^[a-f0-9]{64}$/',$rigEngine))throw ValidationException::withMessages(['worker'=>'UniRig worker is not installed or available.']);
        $engine=$this->worker()->get($this->endpoint('/preparations/operations'))->throw()->json('engine_sha256');
        if(!is_string($engine)||!preg_match('/^[a-f0-9]{64}$/',$engine))throw ValidationException::withMessages(['worker'=>'Preparation worker upgrade is required.']);
        AvatarEvolutionSetting::current();
        return DB::transaction(function()use($generation,$profile,$yaw,$attachments,$actor,$meta,$engine,$artifact,$rigEngine,$boneMap,$previousId){
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            if(TrellisGeneration::withTrashed()->findOrFail($generation->id)->status!=='generated_unqualified')throw ValidationException::withMessages(['generation_id'=>'This generated source was deleted.']);
            if($actor==='preparation-scheduler'&&!\App\Models\AvatarPreparationSetting::lockForUpdate()->findOrFail(1)->enabled)throw ValidationException::withMessages(['schedule'=>'Continuous preparation was paused.']);
            if(AvatarPreparation::where('avatar_id',$generation->avatar_id)->whereIn('status',[...self::ACTIVE,'cancelling','pausing'])->exists())throw ValidationException::withMessages(['generation_id'=>'This avatar already has an active preparation.']);
            $current=AvatarVisualRelease::where('avatar_id',$generation->avatar_id)->where('variant',$meta['variant'])->where('active',true)->first();
            $plan=['version'=>1,'generation_id'=>$generation->id,'avatar_id'=>$generation->avatar_id,'source_sha256'=>$artifact['sha256'],
                'donor_sha256'=>$meta['sha256'],'engine_sha256'=>$engine,'profile'=>$profile,'yaw'=>$yaw,'attachments'=>$attachments,'validation'=>'deferred'];
            $plan['storage_gib']=AvatarEvolutionSetting::findOrFail(1)->storage_gib;
            $plan['provider']='unirig';$plan['unirig_engine_sha256']=$rigEngine;$plan['bone_map']=$boneMap;$plan['seed']=(int)($generation->plan['seed']??25001);
            $plan['baseline']=$current?['release_id'=>$current->id,'run_id'=>$current->run_id,'file'=>$current->file,'sha256'=>$current->sha256]:null;
            $run=AvatarPreparation::create(['id'=>(string)Str::uuid(),'generation_id'=>$generation->id,'avatar_id'=>$generation->avatar_id,'status'=>'queued','plan'=>$plan,'previous_preparation_id'=>$previousId]);
            app(PreparationProgressService::class)->record($run,['status'=>'queued','stage'=>'manual_admission']);
            app(EvolutionService::class)->audit($run->id,'avatar.preparation-queued',$actor,['plan'=>$plan]);
            DB::afterCommit(fn()=>PollAvatarPreparation::dispatch($run->id));return $run;
        });
    }
    public function validate(AvatarPreparation $run,string $actor):void {
        DB::transaction(function()use($run,$actor){
            $run=AvatarPreparation::lockForUpdate()->findOrFail($run->id);
            if(!in_array($run->status,['awaiting_validation','needs_review'],true))throw ValidationException::withMessages(['preparation'=>'This job is not awaiting qualification.']);
            // Serialize this request with cancellation so it cannot reopen a cancelled run.
            $this->worker()->post($this->endpoint('/preparations/'.$run->id.'/validate'))->throw();
            $run->update(['status'=>'queued']);app(PreparationProgressService::class)->record($run,['status'=>'queued','stage'=>'validation_requested']);app(EvolutionService::class)->audit($run->id,'avatar.qualification-requested',$actor);
            DB::afterCommit(fn()=>PollAvatarPreparation::dispatch($run->id));
        });
    }
    public function publish(AvatarPreparation $preparation,string $actor):void {
        AvatarEvolutionSetting::current();
        $remote=$this->worker()->get($this->endpoint('/preparations/'.$preparation->id))->throw()->json();
        DB::transaction(function()use($preparation,$actor,$remote){
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);$run=AvatarPreparation::lockForUpdate()->findOrFail($preparation->id);
            if($run->status==='published')return;
            $report=$run->state['report']??[];$candidate=$report['candidates'][0]??[];
            if(($run->plan['provider']??'')!=='unirig'||$run->status!=='ready'||($remote['status']??null)!=='ready'||($remote['report']??null)!==$report
                ||($report['engine_sha256']??null)!==$run->plan['engine_sha256']||($report['source_hash']??null)!==$run->plan['source_sha256']
                ||($candidate['validation']['passed']??false)!==true||!empty($report['reasons'])||($report['gltf']['errors']??1)!==0
                ||($report['geometry']['passed']??false)!==true
                ||($candidate['render']['passed']??false)!==true||($candidate['render']['gameplay']['passed']??false)!==true
                ||($candidate['bytes']??PHP_INT_MAX)>config('avatars.max_asset_bytes')||!preg_match('/^[a-f0-9]{64}$/',$candidate['sha256']??''))
                throw ValidationException::withMessages(['preparation'=>'Qualification is incomplete, failed or changed. Publication refused.']);
            $engine=$this->worker()->get($this->endpoint('/preparations/operations'))->throw()->json('engine_sha256');
            if($engine!==$run->plan['engine_sha256'])throw ValidationException::withMessages(['preparation'=>'Worker changed after qualification. Prepare a new version.']);
            $asset=$this->worker()->timeout(45)->get($this->endpoint('/files/'.$run->id.'/candidate-01.glb'))->throw()->body();
            if(strlen($asset)!==$candidate['bytes']||!hash_equals($candidate['sha256'],hash('sha256',$asset)))throw ValidationException::withMessages(['preparation'=>'Prepared artifact integrity failed.']);
            $meta=collect(app(AvatarEvolutionService::class)->catalog())->firstWhere('id',$run->avatar_id);$variant=$meta['variant'];
            $current=AvatarVisualRelease::where('avatar_id',$run->avatar_id)->where('variant',$variant)->where('active',true)->lockForUpdate()->first();
            if(($current?->sha256??$run->plan['donor_sha256'])!==($run->plan['baseline']['sha256']??$run->plan['donor_sha256']))throw ValidationException::withMessages(['preparation'=>'The live version changed after preparation. Prepare a new comparison.']);
            if(AvatarVisualRelease::where('avatar_id',$run->avatar_id)->where('variant',$variant)->where('sha256',$candidate['sha256'])->whereNotNull('quarantined_at')->exists())throw ValidationException::withMessages(['preparation'=>'This artifact was quarantined.']);
            // The existing release FK and canary path retain a versioned publication
            // record, explicitly distinguished from enhancement experiments.
            AvatarEvolutionRun::create(['id'=>$run->id,'avatar_id'=>$run->avatar_id,'status'=>'deployed','plan'=>['version'=>3,'avatar'=>$meta,'provider'=>'asset-preparation'],
                'report'=>$report,'manifest_hash'=>hash('sha256',json_encode($report)),'decisions'=>['identity_review'=>['actor'=>$actor,'at'=>now()->toIso8601String()]]]);
            $version=(AvatarVisualRelease::where('avatar_id',$run->avatar_id)->where('variant',$variant)->max('version')??1)+1;
            $current?->update(['health_status'=>'healthy','health_failures'=>0,'last_checked_at'=>now(),'health_report'=>['status'=>'healthy','source'=>'preparation-baseline-validation','renderer'=>$report['baseline']['render']['renderer']]]);
            AvatarVisualRelease::where('avatar_id',$run->avatar_id)->where('variant',$variant)->update(['active'=>false]);
            $release=AvatarVisualRelease::create(['avatar_id'=>$run->avatar_id,'variant'=>$variant,'version'=>$version,'run_id'=>$run->id,'candidate_id'=>'candidate-01',
                'file'=>'candidate-01.glb','sha256'=>$candidate['sha256'],'source_sha256'=>$run->plan['source_sha256'],'previous_release_id'=>$current?->id,
                'validation'=>$candidate['validation'],'approved_by'=>$actor,'health_status'=>'pending']);
            $run->update(['status'=>'published']);app(PreparationProgressService::class)->record($run,['status'=>'published','stage'=>'published']);app(EvolutionService::class)->audit($run->id,'avatar.prepared-published',$actor,['release_id'=>$release->id]);
            DB::afterCommit(fn()=>CheckAvatarVisualHealth::dispatch($release->id)->delay(now()->addSeconds(30)));
        });
    }
}
