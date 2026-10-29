<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up():void {
        $avatars=json_decode(file_get_contents(resource_path('game/catalog.json')),true,flags:JSON_THROW_ON_ERROR)['avatars'];
        $identities=collect(json_decode(file_get_contents(resource_path('game/avatar-identities.json')),true,flags:JSON_THROW_ON_ERROR)['heroes'])->keyBy('key');
        DB::transaction(function()use($avatars,$identities){
            foreach($avatars as $avatar){
                $identity=$identities->get($avatar['id']);
                if(!$identity)throw new RuntimeException('Missing original avatar identity: '.$avatar['id']);
                $payload=array_intersect_key($avatar,array_flip(['displayName','title','primaryRole','secondaryRole','archetype','lore','hp','ad','armor','mr','aspd','range','primaryColor','accentColor','abilityRuleset']));
                $payload+=['name'=>$avatar['displayName'],'internalName'=>$identity['internalName'],'canonicalId'=>$identity['canonicalId'],
                    'legacyName'=>$identity['legacyId'],'assetKey'=>$identity['assetKey']];
                DB::table('game_contents')->insertOrIgnore(['id'=>$avatar['id'],'kind'=>'avatar','payload'=>json_encode($payload,JSON_THROW_ON_ERROR),
                    'version'=>1,'builtin'=>true,'created_at'=>now(),'updated_at'=>now()]);
            }
        });
    }
    public function down():void {
        // Published records and historical match snapshots must survive rollback.
    }
};
