<?php
namespace App\Services;
use App\Models\GameContent;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GameContentService {
    public function avatar(array $avatar,array $snapshot):array {
        $rows=collect($snapshot['records']);
        $record=$rows->first(fn($row)=>$row['kind']==='avatar'&&$row['id']===$avatar['id']&&!$row['deleted']);
        if($record&&($record['data']['abilityRuleset']??null)===($avatar['abilityRuleset']??null)) {
            $avatar=array_replace($avatar,array_intersect_key($record['data'],array_flip(['displayName','title','archetype','lore','primaryColor','accentColor',...array_keys(ContentManagementService::AVATAR_STATS)])));
        }
        foreach($rows as $row) {
            if($row['kind']!=='skill'||($row['data']['avatarId']??null)!==$avatar['id']||($row['data']['abilityRuleset']??null)!==($avatar['abilityRuleset']??null))continue;
            $data=$row['data'];$slot=$data['slot'];
            if($slot==='passive'&&!$row['deleted']){$avatar['passiveName']=$data['name'];$avatar['passiveDesc']=$data['desc'];}
            elseif(in_array($slot,['skill1','skill2','ultimate'],true))$avatar[$slot]=array_replace($avatar[$slot],array_intersect_key($data,array_flip(['name','desc','cooldown','image'])),['disabled'=>$row['deleted']]);
        }
        return $avatar;
    }
    public function snapshot():array {
        $records=GameContent::withTrashed()->orderBy('id')->get()->map(fn($entry)=>[
            'id'=>$entry->id,'kind'=>$entry->kind,'version'=>$entry->version,
            'deleted'=>$entry->trashed(),'builtin'=>$entry->builtin,'data'=>$entry->payload,
        ])->all();
        $canonical=json_encode($records,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        return ['schema'=>1,'hash'=>hash('sha256',$canonical),'canonical_records'=>$canonical,'records'=>$records];
    }
    public function mutate(GameContent $entry, int $version, int $actor, string $action, ?array $payload=null):GameContent {
        return DB::transaction(function()use($entry,$version,$actor,$action,$payload){
            $entry=GameContent::withTrashed()->whereKey($entry->id)->lockForUpdate()->firstOrFail();
            if($entry->version!==$version) throw ValidationException::withMessages(['version'=>'This entry changed in another tab. Reload before saving.']);
            if($action==='save'&&$entry->trashed()) throw ValidationException::withMessages(['content'=>'Restore this entry before editing.']);
            $entry->fill(['payload'=>$payload??$entry->payload,'version'=>$version+1,'updated_by'=>$actor]);
            if($action==='delete') $entry->deleted_at=now();
            if($action==='restore') $entry->deleted_at=null;
            $entry->save();
            $this->revision($entry,$action,$actor);
            return $entry;
        });
    }
    public function revision(GameContent $entry,string $action,int $actor):void {
        DB::table('game_content_revisions')->insert(['content_id'=>$entry->id,'version'=>$entry->version,
            'action'=>$action,'payload'=>json_encode($entry->payload,JSON_THROW_ON_ERROR),'created_by'=>$actor,'created_at'=>now()]);
    }
}
