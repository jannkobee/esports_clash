<?php
namespace App\Services;

use Illuminate\Validation\ValidationException;

class AvatarEquipmentService {
    public function reference(string $avatar,string $slot):?array {
        $source=app(TrellisGenerationService::class);$file=$source->weaponFile($avatar,$slot);
        if(!$file)return null;
        if($file['mime']==='image/png')return $file;
        $hash=$file['meta']['reference_sha256']??'';
        if(!preg_match('/^[a-f0-9]{64}$/',$hash))return null;
        $path=$source->weaponStoragePath($avatar).'/'.$slot.'-reference-'.$hash.'.png';
        if(is_link($path)||!is_file($path)||!hash_equals($hash,hash_file('sha256',$path)))return null;
        return ['path'=>$path,'sha256'=>$hash,'mime'=>'image/png'];
    }
    public function start(string $avatar,string $slot,string $actor):\App\Models\AvatarEquipmentGeneration {
        $source=app(TrellisGenerationService::class);
        abort_unless(in_array($slot,['primary','secondary'],true)&&collect($source->catalog())->contains('id',$avatar),422);
        $reference=$this->reference($avatar,$slot);
        if(!$reference)throw ValidationException::withMessages(['equipment'=>'Upload a PNG reference for this hand first.']);
        $ops=$source->operations();
        $source->requireCloudGeneration($ops, 'equipment');
        if(!($ops['equipment']['supported']??false))throw ValidationException::withMessages(['equipment'=>'The equipment generation worker is unavailable.']);
        $plan=['version'=>1,'avatar_id'=>$avatar,'seed'=>random_int(0,2147483647),'reference_sha256'=>$reference['sha256'],'purpose'=>'modular-equipment','equipment_slot'=>$slot];
        if ($ops['compute']['switching_supported']??false) $plan['compute_preference']='google';
        foreach(['workflow_sha256','pins_sha256','limits_sha256','engine_sha256']as $key){
            if(!preg_match('/^[a-f0-9]{64}$/',$ops[$key]??''))throw ValidationException::withMessages(['equipment'=>'Worker configuration is incomplete.']);
            $plan[$key]=$ops[$key];
        }
        \App\Models\AvatarEvolutionSetting::current();
        return \Illuminate\Support\Facades\DB::transaction(function()use($avatar,$slot,$plan,$actor){
            \App\Models\AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            if(\App\Models\AvatarEquipmentGeneration::where('avatar_id',$avatar)->where('slot',$slot)->whereIn('status',[...TrellisGenerationService::ACTIVE,'installing'])->exists())
                throw ValidationException::withMessages(['equipment'=>'This hand already has a generation in progress.']);
            $run=\App\Models\AvatarEquipmentGeneration::create(['id'=>(string)\Illuminate\Support\Str::uuid(),'avatar_id'=>$avatar,'slot'=>$slot,'status'=>'queued','plan'=>$plan]);
            app(EvolutionService::class)->audit($run->id,'equipment.generation-queued',$actor,['avatar_id'=>$avatar,'slot'=>$slot,'seed'=>$plan['seed']]);
            \Illuminate\Support\Facades\DB::afterCommit(fn()=>\App\Jobs\PollAvatarEquipment::dispatch($run->id));return $run;
        });
    }
    /** Freeze only real 3D geometry. Images remain design references. */
    public function freeze(string $avatar):array {
        $assets=[];$references=[];$source=app(TrellisGenerationService::class);$worker=app(AvatarPreparationService::class);
        foreach(['primary','secondary'] as $slot) {
            $file=$source->weaponFile($avatar,$slot);if(!$file)continue;
            $body=file_get_contents($file['path']);$hash=hash('sha256',$body);
            if(!hash_equals($file['sha256'],$hash))throw ValidationException::withMessages(['equipment'=>'Equipment changed while preparing. Review the uploaded files.']);
            $format=strtolower(pathinfo($file['path'],PATHINFO_EXTENSION));
            if($format==='png'){$references[]=['slot'=>$slot,'sha256'=>$hash];continue;}
            $asset=['slot'=>$slot,'sha256'=>$hash,'bytes'=>strlen($body),'format'=>$format,'weapon_type'=>$file['meta']['weapon_type']??'generic',
                'height_cm'=>(float)($file['meta']['height_cm']??(($file['meta']['weapon_type']??'')==='shield'?90:120)),
                'avatar_height_cm'=>180];
            $receipt=$worker->worker()->timeout(45)->withBody($body,$file['mime'])->put($worker->endpoint('/equipment/'.$hash.'.'.$format))->throw()->json();
            if(($receipt['sha256']??null)!==$hash||($receipt['bytes']??null)!==strlen($body))throw ValidationException::withMessages(['equipment'=>'The equipment worker did not acknowledge the exact uploaded mesh.']);
            $assets[]=$asset;
        }
        return ['equipment'=>$assets,'equipment_references'=>$references];
    }

    public function installGenerated(string $avatar,string $slot,string $id,string $actor):array {
        $source=app(TrellisGenerationService::class);$worker=app(AvatarPreparationService::class);
        abort_unless(in_array($slot,['primary','secondary'],true)&&preg_match('/^[a-f0-9-]{36}$/',$id),422);
        $url=rtrim(config('avatars.trellis_url'),'/').'/jobs/'.$id;
        $state=$worker->worker()->get($url)->throw()->json();
        $file=$source->weaponFile($avatar,$slot);
        $reference=$file['meta']['reference_sha256']??($file&&$file['mime']==='image/png'?$file['sha256']:null);
        if(!$file||($state['status']??null)!=='generated_unqualified'||($state['purpose']??null)!=='modular-equipment'
            ||($state['avatar_id']??null)!==$avatar||($state['equipment_slot']??null)!==$slot||($state['reference_sha256']??null)!==$reference)
            throw ValidationException::withMessages(['equipment'=>'This generated equipment does not match the selected uploaded reference and hand slot.']);
        $bytes=$worker->worker()->timeout(45)->get($url.'/artifact')->throw()->body();
        if(strlen($bytes)>20*1024**2||strlen($bytes)!==($state['artifact']['bytes']??null)||!hash_equals($state['artifact']['sha256']??'',hash('sha256',$bytes)))
            throw ValidationException::withMessages(['equipment'=>'Generated equipment integrity or size check failed.']);
        $temporary=tempnam(sys_get_temp_dir(),'equipment-');
        try {
            file_put_contents($temporary,$bytes);
            return $source->saveGeneratedWeapon($avatar,new \Illuminate\Http\UploadedFile($temporary,$slot.'.glb','model/gltf-binary',null,true),$slot,$reference,$id,$actor);
        } finally {if(is_file($temporary))unlink($temporary);}
    }
}
