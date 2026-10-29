<?php
namespace App\Services;

use App\Models\GameContent;

/** Published content lives in game_contents; source files only seed new installations. */
class AvatarRegistryService {
    public function records() {
        return GameContent::where('kind','avatar')->orderBy('id')->get();
    }
    public function catalog():array {
        $art=collect(json_decode(file_get_contents(resource_path('avatars/catalog.json')),true,flags:JSON_THROW_ON_ERROR)['avatars'])->keyBy('id');
        $skills=GameContent::where('kind','skill')->get()->keyBy('id');
        return $this->records()->map(function($entry)use($art,$skills){
            $p=$entry->payload;$old=$art->get($entry->id,[]);
            $missing=isset($p['assets']['epoch']);
            // Keep exact existing asset identity; current character art remains unqualified.
            $meta=array_replace($old,['id'=>$entry->id,'name'=>$p['displayName'],'internal_name'=>$p['internalName'],
                'canonical_id'=>$p['canonicalId'],'legacy_name'=>$p['legacyName'],'role'=>$p['primaryRole'],
                'title'=>$p['title'],'registry_version'=>$entry->version,'abilityRuleset'=>$p['abilityRuleset'],
                'appearance_status'=>$missing?'Fresh asset pipeline: '.str_replace('_',' ',$p['assets']['status']??'missing'):'legacy artwork; original character qualification pending']);
            if($missing){$meta['file']=null;$meta['sha256']=null;$meta['bytes']=0;$meta['asset_epoch']=$p['assets']['epoch'];}
            $meta['abilities']=collect(['skill1','skill2','ultimate'])->map(fn($slot)=>['slot'=>$slot,'name'=>$skills->get($entry->id.':'.$slot)?->payload['name']??'Missing skill'])->all();
            return $meta;
        })->all();
    }
}
