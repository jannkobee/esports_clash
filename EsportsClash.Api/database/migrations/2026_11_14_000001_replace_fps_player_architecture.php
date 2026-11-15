<?php

use App\Services\FpsPlayerArchitecture;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB,Schema};

return new class extends Migration {
    public function up(): void
    {
        if(!Schema::hasTable('fps_architecture_archives'))Schema::create('fps_architecture_archives',function(Blueprint $t){$t->id();$t->string('kind',40);$t->string('record_id',100);$t->json('original');$t->timestampTz('created_at');$t->unique(['kind','record_id']);});
        if(!Schema::hasColumn('fps_player_identities','personality'))Schema::table('fps_player_identities',function(Blueprint $t){$t->json('personality')->nullable();$t->json('behavior')->nullable();});
        $architecture=app(FpsPlayerArchitecture::class);
        $archive=fn($kind,$id,$original)=>DB::table('fps_architecture_archives')->insertOrIgnore(['kind'=>$kind,'record_id'=>(string)$id,'original'=>json_encode($original,JSON_THROW_ON_ERROR),'created_at'=>now()]);
        DB::transaction(function()use($architecture,$archive){
            DB::table('fps_player_identities')->orderBy('player_id')->chunk(200,function($rows)use($architecture,$archive){foreach($rows as $row){
                if((int)$row->schema_version>=4)continue;
                $archive('identity',$row->player_id,(array)$row);
                $dev=json_decode($row->development,true);unset($dev['specialty_proficiency'],$dev['specialty_source']);
                $dev['mapping']='deterministic_id_v4_no_reliable_opportunity_history';
                DB::table('fps_player_identities')->where('player_id',$row->player_id)->update(['schema_version'=>4,'personality'=>json_encode($architecture->generate($row->player_id)),'behavior'=>json_encode(['version'=>4,'matches'=>0,'metrics'=>(object)[]]),'development'=>json_encode($dev)]);
            }});
            DB::table('owned_player_cards')->whereNotIn('id',DB::table('fps_player_identities')->select('player_id'))->orderBy('id')->chunk(200,function($players)use($architecture){foreach($players as $player){
                DB::table('fps_player_identities')->insertOrIgnore(['player_id'=>$player->id,'schema_version'=>4,'dna'=>json_encode(app(\App\Services\FpsIdentityProfiles::class)->dna($player->id)),'personality'=>json_encode($architecture->generate($player->id)),'behavior'=>json_encode(['version'=>4,'matches'=>0,'metrics'=>(object)[]]),'development'=>json_encode(['mapping'=>'deterministic_id_v4_no_legacy_identity','role_familiarity'=>(object)[]]),'created_at'=>now(),'updated_at'=>now()]);
            }});
            if(Schema::hasColumn('owned_player_cards','world_profile'))DB::table('owned_player_cards')->whereNotNull('world_profile')->orderBy('id')->chunk(200,function($rows)use($architecture,$archive){foreach($rows as $row){$p=json_decode($row->world_profile,true);if(!isset($p['stats'])||isset($p['stats']['rifling']))continue;$archive('world_profile',$row->id,$p);$p['stats']=$architecture->migrateAttributes($p['stats']);$p['attribute_schema']=4;DB::table('owned_player_cards')->where('id',$row->id)->update(['world_profile'=>json_encode($p)]);}});
            if(Schema::hasTable('online_catalogs'))DB::table('online_catalogs')->orderBy('id')->chunk(20,function($rows)use($architecture,$archive){foreach($rows as $row){$payload=json_decode($row->payload,true);$changed=false;foreach($payload['cards'] as &$card){if(isset($card['stats'])&&!isset($card['stats']['rifling'])){$card['stats']=$architecture->migrateAttributes($card['stats']);$changed=true;}unset($card['primaryPersonality'],$card['secondaryPersonality']);}unset($card);if($changed){$archive('catalog',$row->id,(array)$row);$encoded=json_encode($payload,JSON_THROW_ON_ERROR);$manifest=json_decode($row->manifest,true);$manifest['catalog_version']=hash('sha256',$encoded);$manifest['fps_player_architecture']=4;DB::table('online_catalogs')->where('id',$row->id)->update(['payload'=>$encoded,'manifest'=>json_encode($manifest)]);}}});
            DB::table('fps_team_systems')->orderBy('club_id')->chunk(200,function($rows)use($archive){foreach($rows as $row){$archive('system',$row->club_id,(array)$row);$orders=json_decode($row->instructions??'{}',true);foreach($orders as &$order){unset($order['role']);if(($order['training']??'')==='specialty')$order['training']='system';}unset($order);DB::table('fps_team_systems')->where('club_id',$row->club_id)->update(['instructions'=>json_encode($orders)]);}});
            if(Schema::hasTable('world_wire_accounts'))DB::table('world_wire_accounts')->where('kind','player')->orderBy('id')->chunk(200,function($rows)use($architecture,$archive){foreach($rows as $row){
                $profile=json_decode($row->profile,true);if(isset($profile['personality']['temperament'])&&!isset($profile['primary_personality'])&&!isset($profile['secondary_personality']))continue;
                $archive('wire_profile',$row->id,$profile);unset($profile['primary_personality'],$profile['secondary_personality']);
                $p=DB::table('fps_player_identities')->where('player_id',$row->source_id)->value('personality');$profile['personality']=$p?json_decode($p,true):$architecture->generate((string)$row->source_id);
                DB::table('world_wire_accounts')->where('id',$row->id)->update(['profile'=>json_encode($profile)]);
            }});
            if(DB::table('fps_player_identities')->whereNull('personality')->exists())throw new RuntimeException('Incomplete FPS personality migration');
        });
        $obsolete=array_values(array_filter(['personality_id','specialty_id','legacy_primary','legacy_secondary'],fn($key)=>Schema::hasColumn('fps_player_identities',$key)));
        if($obsolete)Schema::table('fps_player_identities',fn(Blueprint $t)=>$t->dropColumn($obsolete));
    }
    public function down(): void { /* Original rows are archived. Reversing a live identity migration requires an explicit restoration. */ }
};
