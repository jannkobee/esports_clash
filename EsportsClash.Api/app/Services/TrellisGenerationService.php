<?php
namespace App\Services;
use App\Models\{TrellisGeneration,AvatarEvolutionSetting};
use App\Jobs\PollTrellisGeneration;
use Illuminate\Support\Facades\{DB,Http};
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TrellisGenerationService
{
    public const ACTIVE=['queued','waiting_models','waiting_resources','waiting_worker','running'];
    public function catalog(): array { return app(AvatarEvolutionService::class)->catalog(); }
    private function referenceIndex(): array
    {
        $manifest=resource_path('avatars/generation-reference-index.json');
        return is_file($manifest)?json_decode(file_get_contents($manifest),true,flags:JSON_THROW_ON_ERROR):[];
    }
    private function referenceFile(array $reference): ?string
    {
        $name=$reference['file']??'';
        if(!is_string($name)||basename($name)!==$name||!str_ends_with($name,'.png'))return null;
        $path=resource_path('avatars/generation-references/'.$name);
        return is_file($path)?$path:null;
    }
    public function localReferences(): array
    {
        $result=[];
        foreach($this->referenceIndex()as $id=>$reference){
            if($path=$this->referenceFile($reference))$result[$id]=[...$reference,'sha256'=>hash_file('sha256',$path)];
        }
        return $result;
    }
    public function localReference(string $avatar,string $digest): ?string
    {
        $reference=$this->referenceIndex()[$avatar]??null;
        $path=$reference?$this->referenceFile($reference):null;
        return $path&&hash_equals(hash_file('sha256',$path),$digest)?$path:null;
    }
    public function worker() { return Http::withToken(config('avatars.worker_token'))->timeout(10)->connectTimeout(3); }
    public function endpoint(string $path): string { return rtrim(config('avatars.trellis_url'),'/').$path; }
    public function operations(): ?array
    {
        try{return $this->worker()->get($this->endpoint('/operations'))->throw()->json();}catch(\Throwable){return null;}
    }
    public function start(string $actor,int $seed=25001,string $avatarId='c_invoker'): TrellisGeneration
    {
        $operations=$this->operations();
        if(!$operations||($operations['provider']??null)!=='trellis2-gguf')throw ValidationException::withMessages(['provider'=>'The isolated TRELLIS.2 worker is unavailable.']);
        if(!collect($this->catalog())->contains('id',$avatarId))throw ValidationException::withMessages(['avatar_id'=>'Unknown avatar.']);
        $reference=$operations['references'][$avatarId]??null;
        if(!$reference)throw ValidationException::withMessages(['avatar_id'=>'Prepare a reference image for this avatar first.']);
        $operations['reference_sha256']=$reference['sha256'];
        $plan=['version'=>1,'avatar_id'=>$avatarId,'seed'=>$seed];
        foreach(['reference_sha256','workflow_sha256','pins_sha256','limits_sha256','engine_sha256']as $key){
            if(!preg_match('/^[a-f0-9]{64}$/',$operations[$key]??''))throw ValidationException::withMessages(['provider'=>'The worker configuration has no valid frozen hash.']);
            $plan[$key]=$operations[$key];
        }
        AvatarEvolutionSetting::current();
        return DB::transaction(function()use($plan,$actor){
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            if(TrellisGeneration::withTrashed()->where('avatar_id',$plan['avatar_id'])->where('status','generated_unqualified')->exists())throw ValidationException::withMessages(['avatar_id'=>'This avatar already has a completed generated GLB. Inspect or prepare its existing model instead of queuing another generation. Deleting a report does not delete its model.']);
            if(TrellisGeneration::where('avatar_id',$plan['avatar_id'])->whereIn('status',[...self::ACTIVE,'cancelling'])->exists())throw ValidationException::withMessages(['provider'=>'This avatar already has a queued generation or cancellation awaiting acknowledgement.']);
            if(TrellisGeneration::whereIn('status',self::ACTIVE)->count()>=45)throw ValidationException::withMessages(['provider'=>'The generation queue is full.']);
            $run=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>$plan['avatar_id'],'status'=>'queued','plan'=>$plan]);
            app(EvolutionService::class)->audit($run->id,'trellis.generation-queued',$actor,['seed'=>$plan['seed'],'reference_sha256'=>$plan['reference_sha256']]);
            DB::afterCommit(fn()=>PollTrellisGeneration::dispatch($run->id));
            return $run;
        });
    }
    public function deleteModel(TrellisGeneration $generation,string $actor):void
    {
        AvatarEvolutionSetting::current();
        DB::transaction(function()use($generation,$actor){
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            $run=TrellisGeneration::withTrashed()->lockForUpdate()->findOrFail($generation->id);
            if($run->status!=='generated_unqualified')throw ValidationException::withMessages(['model'=>'Only a completed generated model can be deleted.']);
            $preparations=\App\Models\AvatarPreparation::withTrashed()->where('generation_id',$run->id);
            $ids=(clone $preparations)->pluck('id');
            if((clone $preparations)->where(function($query){
                $query->whereNotIn('status',['failed','cancelled','rejected','paused','ready','needs_review','awaiting_retarget','awaiting_validation','complete'])
                    ->orWhere(function($visible){$visible->whereNull('deleted_at')->whereNotIn('status',['failed','cancelled','rejected']);});
            })->exists()
                ||\App\Models\AvatarVisualRelease::whereIn('run_id',$ids)->exists()
                ||(!empty($run->state['artifact']['sha256'])&&\App\Models\AvatarVisualRelease::where('source_sha256',$run->state['artifact']['sha256'])->exists()))
                throw ValidationException::withMessages(['model'=>'This source is used by a preparation or release. Cancel unfinished preparation first; published and retained release sources are protected.']);
            $response=$this->worker()->delete($this->endpoint('/jobs/'.$run->id.'/artifact'));
            if(!$response->successful()||$response->json('status')!=='model_deleted')throw ValidationException::withMessages(['model'=>'The worker could not confirm deletion. The model remains reserved; try again when the worker is available.']);
            $local=storage_path('trellis-sources/'.$run->id.'.glb');
            if(is_file($local)&&!is_link($local)&&!unlink($local))throw ValidationException::withMessages(['model'=>'Local source removal failed. Retry deletion.']);
            $state=$run->state??[];unset($state['artifact']);$state['stage']='model_deleted';
            $run->update(['status'=>'model_deleted','state'=>$state]);
            app(EvolutionService::class)->audit($run->id,'trellis.model-deleted',$actor,['avatar_id'=>$run->avatar_id]);
        });
    }
    public function verifiedAsset(TrellisGeneration $run): string
    {
        if($run->status!=='generated_unqualified')abort(409,'No generated source is available.');
        $local=storage_path('trellis-sources/'.$run->id.'.glb');
        if(is_file($local)&&!is_link($local)){
            abort_if(filesize($local)>32*1024*1024,409,'Generated source exceeds the artifact limit.');
            $bytes=file_get_contents($local);
        }else{
            $bytes=$this->worker()->timeout(45)->get($this->endpoint('/jobs/'.$run->id.'/artifact'))->throw()->body();
        }
        $expected=$run->state['artifact']??[];
        if(strlen($bytes)>32*1024*1024||strlen($bytes)!==($expected['bytes']??null)||strlen($bytes)<20||substr($bytes,0,4)!=='glTF'
            ||!hash_equals($expected['sha256']??'',hash('sha256',$bytes)))abort(409,'Generated source integrity check failed.');
        $header=unpack('Vversion/Vlength',substr($bytes,4,8));
        if($header['version']!==2||$header['length']!==strlen($bytes))abort(409,'Generated GLB container is invalid.');
        return $bytes;
    }
}
