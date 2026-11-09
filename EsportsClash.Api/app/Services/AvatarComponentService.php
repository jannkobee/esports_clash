<?php
namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{DB, Storage};
use Illuminate\Validation\ValidationException;

/** Authoring inventory only. Uploads never qualify, fit, queue or publish assets. */
class AvatarComponentService {
    public const CATEGORIES = [
        'outfit'=>'Clothing / armor', 'hair'=>'Hair / cosmetic fur',
        'back'=>'Back-mounted gear', 'accessory'=>'Accessories / floating gear',
        'vehicle'=>'Vehicles / mounts', 'companion'=>'Companions',
    ];
    public const BINDINGS = [
        'skinned'=>'Deforms with the body', 'rigid'=>'Rigid attachment',
        'independent'=>'Independent rig / actor',
    ];
    public function inventory(string $avatar): array {
        $row=DB::table('avatar_component_inventories')->where('avatar_id',$avatar)->first();
        return ['avatar_id'=>$avatar,'version'=>$row?->version??0,
            'components'=>$row?json_decode($row->components,true,512,JSON_THROW_ON_ERROR):[]];
    }
    public function save(string $avatar,array $input,?UploadedFile $file,int $actor): array {
        abort_unless(collect(app(TrellisGenerationService::class)->catalog())->contains('id',$avatar),404);
        $asset=$file?$this->storeFile($file):null;
        return DB::transaction(function()use($avatar,$input,$asset,$actor){
            DB::table('avatar_component_inventories')->insertOrIgnore([
                'avatar_id'=>$avatar,'version'=>0,'components'=>'[]','created_at'=>now(),'updated_at'=>now(),
            ]);
            $row=DB::table('avatar_component_inventories')->where('avatar_id',$avatar)->lockForUpdate()->first();
            if($row->version!==(int)$input['version'])throw ValidationException::withMessages(['version'=>'This inventory changed. Reload before saving.']);
            $items=collect(json_decode($row->components,true,512,JSON_THROW_ON_ERROR))->keyBy('id');
            $old=$items->get($input['component_id']);
            $item=['id'=>$input['component_id'],'label'=>$input['label'],'category'=>$input['category'],
                'binding'=>$input['binding'],'attachment'=>$input['attachment']??'', 'prompt'=>$input['prompt']??'',
                'reference'=>$old['reference']??null,'model'=>$old['model']??null];
            // Metadata changes never carry a qualification forward; references and meshes remain separate.
            if($asset){
                if($asset['format']==='png')$asset['purpose']=$input['reference_purpose']??'reconstruction';
                $item[$asset['format']==='png'?'reference':'model']=$asset;
            }
            $item['status']=$item['model']?'model_unqualified':($item['reference']?'reference_uploaded':'missing');
            $items->put($item['id'],$item);
            $components=$items->sortKeys()->values()->all();$version=$row->version+1;
            $json=json_encode($components,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
            DB::table('avatar_component_inventories')->where('avatar_id',$avatar)->update(['version'=>$version,'components'=>$json,'updated_at'=>now()]);
            DB::table('avatar_component_revisions')->insert(['avatar_id'=>$avatar,'version'=>$version,'components'=>$json,'created_by'=>$actor,'created_at'=>now()]);
            return ['avatar_id'=>$avatar,'version'=>$version,'components'=>$components];
        });
    }
    private function storeFile(UploadedFile $file):array {
        $bytes=file_get_contents($file->getRealPath());$format=strtolower($file->getClientOriginalExtension());
        $valid=false;
        if($format==='png')$valid=str_starts_with($bytes,"\x89PNG\r\n\x1a\n")&&@getimagesizefromstring($bytes)!==false;
        if($format==='glb'&&strlen($bytes)>=20&&substr($bytes,0,4)==='glTF'){
            $h=unpack('Vversion/Vlength/VjsonLength/VjsonType',substr($bytes,4,16));
            if($h['version']===2&&$h['length']===strlen($bytes)&&$h['jsonType']===0x4e4f534a&&$h['jsonLength']<=strlen($bytes)-20){
                $json=json_decode(substr($bytes,20,$h['jsonLength']),true);
                $valid=is_array($json)&&($json['asset']['version']??null)==='2.0';
                foreach(['buffers','images'] as $key){
                    if(isset($json[$key])&&!is_array($json[$key])){$valid=false;continue;}
                    foreach($json[$key]??[] as $resource)if(!is_array($resource)||(isset($resource['uri'])&&(!is_string($resource['uri'])||!str_starts_with($resource['uri'],'data:'))))$valid=false;
                }
            }
        }
        if(!$valid)throw ValidationException::withMessages(['asset'=>'Upload a valid PNG or self-contained GLB 2.0.']);
        $hash=hash('sha256',$bytes);$path='avatar-components/'.$hash.'.'.$format;
        $disk=Storage::disk('local');
        if(!$disk->exists($path))abort_unless($disk->put($path,$bytes),500,'Asset storage failed.');
        abort_unless(hash_equals($hash,hash_file('sha256',$disk->path($path))),500,'Stored asset integrity mismatch.');
        return ['sha256'=>$hash,'format'=>$format,'bytes'=>strlen($bytes)];
    }
    public function file(string $avatar,string $hash,string $format):string {
        abort_unless(preg_match('/^[a-f0-9]{64}$/D',$hash)&&in_array($format,['png','glb'],true),404);
        $owned=false;
        foreach($this->inventory($avatar)['components'] as $item)foreach(['reference','model'] as $kind)
            if(($item[$kind]['sha256']??null)===$hash&&($item[$kind]['format']??null)===$format)$owned=true;
        abort_unless($owned,404);$disk=Storage::disk('local');$path='avatar-components/'.$hash.'.'.$format;
        abort_unless($disk->exists($path)&&hash_equals($hash,hash_file('sha256',$disk->path($path))),404);
        return $disk->path($path);
    }
    public function summary(string $avatar):array {
        $inventory=$this->inventory($avatar);$source=app(TrellisGenerationService::class);
        $body=$source->currentReference($avatar,[]);$items=[];
        $items[]=['id'=>'base','label'=>'Base body','category'=>'base','binding'=>'skinned','status'=>$body?'reference_uploaded':'missing','reference_sha256'=>$body['sha256']??null,'model_sha256'=>null];
        foreach(['primary'=>'Right hand','secondary'=>'Left hand'] as $slot=>$label){
            $file=$source->weaponFile($avatar,$slot);if(!$file)continue;
            $png=$file['mime']==='image/png';
            $items[]=['id'=>$slot,'label'=>$label,'category'=>'hand','binding'=>'rigid','status'=>$png?'reference_uploaded':'model_unqualified','reference_sha256'=>$png?$file['sha256']:($file['meta']['reference_sha256']??null),'model_sha256'=>$png?null:$file['sha256']];
        }
        foreach($inventory['components'] as $item)$items[]=[
            'id'=>$item['id'],'label'=>$item['label'],'category'=>$item['category'],'binding'=>$item['binding'],'status'=>$item['status'],
            'reference_purpose'=>$item['reference']['purpose']??null,
            'reference_sha256'=>$item['reference']['sha256']??null,'model_sha256'=>$item['model']['sha256']??null,
        ];
        $result=['schema'=>1,'avatar_id'=>$avatar,'version'=>$inventory['version'],'categories'=>['base'=>'Base body','hand'=>'Handheld equipment',...self::CATEGORIES],'components'=>$items];
        $result['hash']=hash('sha256',json_encode($result,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
        return $result;
    }
}
