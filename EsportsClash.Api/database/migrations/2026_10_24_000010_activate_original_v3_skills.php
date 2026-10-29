<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up():void {
        $source=json_decode(file_get_contents(resource_path('game/original-v3-skills.json')),true,flags:JSON_THROW_ON_ERROR);
        DB::transaction(function()use($source){
            foreach($source['records'] as $definition){
                $entry=DB::table('game_contents')->where('id',$definition['id'])->lockForUpdate()->first();
                if(!$entry)continue;
                $old=json_decode($entry->payload,true,flags:JSON_THROW_ON_ERROR);
                if(($old['abilityRuleset']??null)===$definition['payload']['abilityRuleset'])continue;
                // Preserve previous edits as immutable revisions and keep the same binding ID.
                DB::table('game_content_revisions')->insertOrIgnore(['content_id'=>$entry->id,'version'=>$entry->version,
                    'action'=>'legacy-kit','payload'=>$entry->payload,'created_by'=>$entry->updated_by,'created_at'=>now()]);
                $payload=$definition['payload'];if(isset($old['image']))$payload['image']=$old['image'];
                $encoded=json_encode($payload,JSON_THROW_ON_ERROR);
                DB::table('game_contents')->where('id',$entry->id)->update(['payload'=>$encoded,'version'=>$entry->version+1,'deleted_at'=>null,'updated_at'=>now()]);
                DB::table('game_content_revisions')->insert(['content_id'=>$entry->id,'version'=>$entry->version+1,'action'=>'v3-upgrade','payload'=>$encoded,'created_by'=>null,'created_at'=>now()]);
            }
            foreach(DB::table('game_contents')->where('kind','skill')->whereNull('deleted_at')->get() as $entry){
                $payload=json_decode($entry->payload,true,flags:JSON_THROW_ON_ERROR);
                if(($payload['slot']??null)!=='invoked'||!$entry->builtin)continue;
                DB::table('game_contents')->where('id',$entry->id)->update(['deleted_at'=>now(),'version'=>$entry->version+1,'updated_at'=>now()]);
                DB::table('game_content_revisions')->insert(['content_id'=>$entry->id,'version'=>$entry->version+1,'action'=>'v3-retire','payload'=>$entry->payload,'created_by'=>null,'created_at'=>now()]);
            }
        });
    }
    public function down():void {
        // Restore only entries still at this migration's revision; preserve subsequent owner edits.
        foreach(DB::table('game_content_revisions')->whereIn('action',['v3-upgrade','v3-retire'])->get() as $revision){
            $entry=DB::table('game_contents')->where('id',$revision->content_id)->first();
            if(!$entry||$entry->version!==$revision->version)continue;
            $prior=DB::table('game_content_revisions')->where('content_id',$entry->id)->where('version',$revision->version-1)->first();
            $payload=$revision->action==='v3-retire'?$entry->payload:$prior?->payload;
            if(!$payload)continue;
            DB::table('game_contents')->where('id',$entry->id)->update(['payload'=>$payload,'deleted_at'=>null,'version'=>$entry->version+1,'updated_at'=>now()]);
            DB::table('game_content_revisions')->insert(['content_id'=>$entry->id,'version'=>$entry->version+1,'action'=>'v3-rollback','payload'=>$payload,'created_by'=>null,'created_at'=>now()]);
        }
    }
};
