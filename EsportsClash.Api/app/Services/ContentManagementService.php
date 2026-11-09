<?php
namespace App\Services;
use App\Models\{ManagedContent, ManagedContentRevision};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ContentManagementService {
    public const ROLES = ['Tank','Fighter','Assassin','Mage','Marksman','Support'];
    // Editor bounds are input safeguards, not a claim of competitive balance.
    public const AVATAR_STATS = ['hp'=>[1,20000,'Health'], 'ad'=>[0,2000,'Attack damage'], 'armor'=>[0,1000,'Armor'], 'mr'=>[0,1000,'Magic resistance'], 'aspd'=>[0.1,5,'Attacks / second'], 'range'=>[0.1,30,'Attack range (game units)']];
    public const ITEM_STATS = ['hp'=>[0,10000,'Health'],'ad'=>[0,1000,'Attack damage'],'ap'=>[0,2000,'Ability power'],'armor'=>[0,1000,'Armor'],'mr'=>[0,1000,'Magic resistance'],'aspd'=>[0,5,'Attack speed bonus (ratio)'],'haste'=>[0,200,'Ability haste'],'crit'=>[0,100,'Critical chance (%)'],'armorPen'=>[0,100,'Armor penetration (%)'],'lethality'=>[0,200,'Flat armor penetration'],'magicPen'=>[0,200,'Flat magic penetration'],'lifesteal'=>[0,100,'Lifesteal (%)'],'moveSpeed'=>[0,200,'Move speed'],'mana'=>[0,5000,'Mana'],'manaRegen'=>[0,100,'Mana / second']];
    public const SLOTS = ['skill1'=>'Skill 1','skill2'=>'Skill 2','ultimate'=>'Ultimate'];

    public function defaults(string $kind): array {
        if ($kind === 'item') return ['name'=>'','cost'=>500,'tier'=>'Starting','icon'=>'','stats'=>[],'passiveName'=>'','passiveDesc'=>'','suitableRoles'=>[], 'designBrief'=>[]];
        $data = ['name'=>'','displayName'=>'','title'=>'','primaryRole'=>'Mage','secondaryRole'=>null,'archetype'=>'','hp'=>1000,'ad'=>60,'armor'=>30,'mr'=>30,'aspd'=>0.7,'range'=>5,'passiveDesc'=>'','primaryColor'=>'#72e0ca','accentColor'=>'#fbbf24','designBrief'=>[]];
        foreach (self::SLOTS as $slot=>$label) $data[$slot]=['name'=>'','desc'=>'','damage'=>0,'cooldown'=>$slot==='ultimate'?60:8,'damageType'=>'Magic','castType'=>'unit'];
        return $data;
    }
    public function sources(string $kind): array {
        if($kind==='avatar') {
            $snapshot=app(GameContentService::class)->snapshot();
            $skills=collect($snapshot['records'])->where('kind','skill')->keyBy('id');
            return app(AvatarRegistryService::class)->records()->map(function($entry)use($skills){
                $p=$entry->payload;$p['id']=$entry->id;$p['name']=$p['internalName'];
                $p['passiveDesc']=$skills->get($entry->id.':passive')['data']['desc']??'';
                foreach(self::SLOTS as $slot=>$label)$p[$slot]=$skills->get($entry->id.':'.$slot)['data']??[];
                return $p;
            })->all();
        }
        return json_decode(file_get_contents(resource_path($kind==='avatar'?'game/catalog.json':'game/management-items.json')), true, 512, JSON_THROW_ON_ERROR)[$kind==='avatar'?'avatars':'items'];
    }
    public function import(string $kind, int $actor): int {
        return DB::transaction(function () use ($kind,$actor) {
            $count=0;
            foreach ($this->sources($kind) as $source) {
                // Unique source identity prevents refresh from overwriting edited drafts.
                $entry=ManagedContent::firstOrCreate(['kind'=>$kind,'source_id'=>$source['id']], ['name'=>$source['displayName']??$source['name'],'payload'=>$source,'updated_by'=>$actor]);
                if ($entry->wasRecentlyCreated) { $this->snapshot($entry,'import',$actor); $count++; }
            }
            return $count;
        });
    }
    public function save(string $kind, array $input, int $actor, ?ManagedContent $entry=null): ManagedContent {
        return DB::transaction(function () use ($kind,$input,$actor,$entry) {
            if ($entry) {
                $entry=ManagedContent::whereKey($entry->id)->lockForUpdate()->firstOrFail();
                $this->checkVersion($entry,(int)$input['version']);
                if ($entry->status==='archived') throw ValidationException::withMessages(['content'=>'Restore this archived design before editing it.']);
            }
            $payload=$entry?->payload ?? $this->defaults($kind);
            // Preserve engine-specific skill metadata that this editor does not author.
            foreach ($input['data'] as $key=>$value) {
                $payload[$key]=in_array($key,array_keys(self::SLOTS),true) ? array_replace($payload[$key]??[], $value) : $value;
            }
            $payload['designBrief']=$input['brief']??[];
            if (!$entry) {
                $payload['id']=($kind==='avatar'?'c_custom_':'item_custom_').Str::lower(Str::random(12));
                if ($kind==='avatar') $payload['name']=$payload['displayName'];
            }
            $name=$kind==='avatar'?$payload['displayName']:$payload['name'];
            if ($entry) $entry->update(['name'=>$name,'payload'=>$payload,'status'=>'draft','version'=>$entry->version+1,'updated_by'=>$actor]);
            else $entry=ManagedContent::create(['kind'=>$kind,'name'=>$name,'payload'=>$payload,'updated_by'=>$actor]);
            $this->snapshot($entry,'save',$actor);
            return $entry;
        });
    }
    public function transition(ManagedContent $entry, int $version, string $action, int $actor, ?int $revision=null): void {
        DB::transaction(function () use ($entry,$version,$action,$actor,$revision) {
            $entry=ManagedContent::whereKey($entry->id)->lockForUpdate()->firstOrFail();
            $this->checkVersion($entry,$version);
            $data=$entry->payload;
            $status=$entry->status;
            if ($action==='restore_revision') {
                $data=$entry->revisions()->where('version',$revision)->firstOrFail()->payload;
                $status='draft';
            } elseif ($action==='review') {
                if ($status==='archived') throw ValidationException::withMessages(['content'=>'Restore this design first.']);
                $missing=[];
                if (empty($data['designBrief']['appearancePrompt'])) $missing[]='appearance prompt';
                if ($entry->kind==='avatar') foreach(self::SLOTS as $slot=>$label) {
                    foreach(['gameplayPrompt'=>'gameplay prompt','appearancePrompt'=>'appearance / VFX prompt','animationPrompt'=>'animation prompt'] as $field=>$fieldLabel) if(empty($data['designBrief']['skills'][$slot][$field])) $missing[]="$label $fieldLabel";
                }
                if ($entry->kind==='item' && empty($data['designBrief']['effectPrompt'])) $missing[]='item effect prompt';
                if ($missing) throw ValidationException::withMessages(['content'=>'Complete these fields before marking ready for review: '.implode(', ',$missing).'.']);
                $status='review';
            } else $status=$action==='archive'?'archived':'draft';
            $entry->update(['payload'=>$data,'name'=>$entry->kind==='avatar'?$data['displayName']:$data['name'],'status'=>$status,'version'=>$entry->version+1,'updated_by'=>$actor]);
            $this->snapshot($entry,$action,$actor);
        });
    }
    private function checkVersion(ManagedContent $entry, int $version): void {
        if ($entry->version!==$version) throw ValidationException::withMessages(['version'=>'This design changed in another tab. Your input is retained below. Open the latest saved design in another tab and compare before saving.']);
    }
    private function snapshot(ManagedContent $entry, string $action, int $actor): void {
        $entry->revisions()->create(['version'=>$entry->version,'action'=>$action,'status'=>$entry->status,'payload'=>$entry->payload,'created_by'=>$actor,'created_at'=>now()]);
    }
    public function prompt(ManagedContent $entry): string {
        $p=$entry->payload; $b=$p['designBrief']??[];
        $lines=[strtoupper($entry->kind).' DESIGN BRIEF: '.$entry->name, 'Draft v'.$entry->version.' / Not published', '', 'Appearance: '.($b['appearancePrompt']??'Not specified')];
        if ($entry->kind==='avatar') {
            $lines[]='Identity: '.($p['title']??'').' / '.($p['archetype']??'').' / '.$p['primaryRole'];
            $lines[]='Palette: '.$p['primaryColor'].' / '.$p['accentColor'];
            $lines[]='Passive: '.$p['passiveDesc'];
            $lines[]='Passive design: '.($b['passivePrompt']??'');
            foreach(self::SLOTS as $slot=>$label) {
                $s=$p[$slot];$sb=$b['skills'][$slot]??[];
                $lines[]="\n$label: ".$s['name']."\n".$s['desc'];
                $lines[]='Gameplay: '.($sb['gameplayPrompt']??'');
                $lines[]='Look / VFX: '.($sb['appearancePrompt']??'');
                $lines[]='Animation: '.($sb['animationPrompt']??'');
                $lines[]='Proposed values: '.$s['damage'].' '.$s['damageType'].' damage; '.$s['cooldown'].'s cooldown; '.$s['castType'];
            }
            $lines[]="\nPreserve recognizable identity, weapon type, team readability and gameplay hitboxes. Synchronize visual wind-up, strike and recovery with actual combat timing; never change hit timing to fit animation.";
        } else {
            $lines[]='Tier / cost: '.$p['tier'].' / '.$p['cost'].' gold';
            $lines[]='Passive: '.$p['passiveName'].' - '.$p['passiveDesc'];
            $lines[]='Effect design: '.($b['effectPrompt']??'');
            $lines[]='Proposed stats: '.json_encode($p['stats']);
        }
        $lines[]="\nPrompts are design input. New mechanics require implementation and balance review. Asset generation and rigging are separate manual workflows; qualification precedes live use.";
        return implode("\n",$lines);
    }
}
