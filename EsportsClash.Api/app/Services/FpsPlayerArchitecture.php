<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

/** Shared versioned catalog. Identity never reads attributes or match performance. */
class FpsPlayerArchitecture
{
    public const ATTRIBUTES = ['rifling','sniping','entry','utility','positioning','shotcalling'];
    public function catalog(): array
    {
        static $catalog;
        if($catalog!==null)return $catalog;
        $source=base_path('../EsportsClash.Web/src/fps/fps-player-architecture-v4.json');
        $packaged=resource_path('fps-player-architecture-v4.json');
        if(is_file($source)&&!hash_equals(hash_file('sha256',$source),hash_file('sha256',$packaged)))throw new \RuntimeException('FPS architecture package differs from its canonical source. Run the catalog sync script.');
        return $catalog ??= json_decode(file_get_contents(is_file($source)?$source:$packaged), true, 512, JSON_THROW_ON_ERROR);
    }
    public function personalities(): array
    {
        static $all;
        if($all!==null)return $all;
        $c=$this->catalog(); $all=[];
        foreach($c['temperaments'] as $temperament) foreach($c['playstyles'] as $playstyle) foreach($c['mindsets'] as $mindset) foreach($c['decisionStyles'] as $decisionStyle) $all[]=$this->personality(compact('temperament','playstyle','mindset','decisionStyle'));
        return $all;
    }
    public function personality(array $p): array
    {
        $c=$this->catalog();
        foreach(['temperament'=>'temperaments','playstyle'=>'playstyles','mindset'=>'mindsets','decisionStyle'=>'decisionStyles'] as $key=>$values) if(!in_array($p[$key]??null,$c[$values],true)) throw ValidationException::withMessages(['personality'=>'Invalid '.$key]);
        $index=array_search($p['playstyle'],$c['playstyles'],true)*6+array_search($p['mindset'],$c['mindsets'],true)*3+array_search($p['decisionStyle'],$c['decisionStyles'],true);
        $p=array_intersect_key($p,array_flip(['temperament','playstyle','mindset','decisionStyle']));
        $p['id']=implode(':',[$p['temperament'],$p['playstyle'],$p['mindset'],$p['decisionStyle']]);
        $p['name']=($p['temperament']==='ICE_COLD'?'Ice-Cold':ucwords(strtolower($p['temperament']))).' '.$c['profiles'][$index]['name'];
        return $p;
    }
    public function generate(string $id): array
    {
        $hash=2166136261;$value=$id.':fps-personality-v4';
        for($i=0;$i<strlen($value);$i++)$hash=(($hash^ord($value[$i]))*16777619)&0xffffffff;
        return $this->personalities()[$hash%54];
    }
    /** Only manager choices are assignments. Drafts may be incomplete; match lineups may not. */
    public function assignments(array $ids,array $orders=[],bool $requireComplete=true): array
    {
        $c=$this->catalog();$result=[];
        if(count($ids)!==5||count(array_unique($ids))!==5)throw ValidationException::withMessages(['lineup'=>'Exactly five distinct players are required.']);
        foreach(['t'=>'tPositions','ct'=>'ctPositions'] as $side=>$key){
            $used=[];
            foreach($ids as $id)if(isset($orders[$id][$side])){
                $position=$orders[$id][$side];
                if(!in_array($position,$c[$key],true)||in_array($position,$used,true))throw ValidationException::withMessages(['instructions'=>'Duplicate or invalid '.$side.' assignment.']);
                $result[$id][$side]=$position;$used[]=$position;
            }
            if($requireComplete&&count($used)!==5)throw ValidationException::withMessages(['instructions.'.$side=>'Assign all five '.strtoupper($side).'-side roles in your tactical system before starting a match.']);
        }
        return $result;
    }
    public function recruitmentFit(array $definition,array $plan): float
    {
        $p=$definition['fpsIdentity']['personality']??null;if(!$p)return .5;
        $initiative=match($p['playstyle']){'AGGRESSIVE'=>.9,'PASSIVE'=>.1,default=>.5};
        $preparation=match($p['decisionStyle']){'METHODICAL'=>.85,'INSTINCTIVE'=>.15,default=>.5};
        return (2-abs($initiative-($plan['aggression']??.5))-abs($preparation-($plan['preparation']??.5)))/2;
    }
    /** Capability helps a manager assign responsibilities; the assigned identity still comes only from personality. */
    public function recommendedAssignments(array $definitions,array $plan): array
    {
        $weights=['T_IGL'=>['shotcalling'=>1],'T_ENTRY'=>['entry'=>.6,'rifling'=>.4],
            'T_SUPPORT'=>['utility'=>.7,'shotcalling'=>.3],'T_LURKER'=>['positioning'=>.7,'rifling'=>.3],
            'T_FLEX'=>['rifling'=>.4,'sniping'=>.3,'positioning'=>.3],
            'CT_IGL'=>['shotcalling'=>1],'CT_ROTATOR'=>['positioning'=>.65,'rifling'=>.35],
            'CT_ANCHOR_A'=>['positioning'=>.6,'utility'=>.4],'CT_ANCHOR_B'=>['positioning'=>.6,'utility'=>.4],
            'CT_FLEX'=>['rifling'=>.4,'sniping'=>.3,'positioning'=>.3]];
        $result=[];
        foreach(['t'=>'tPositions','ct'=>'ctPositions'] as $side=>$key){$remaining=$definitions;
            foreach($this->catalog()[$key] as $position){
                $scores=[];foreach($remaining as $id=>$definition){$score=0;foreach($weights[$position] as $attribute=>$weight)$score+=($definition['stats'][$attribute]??50)*$weight;
                    $scores[$id]=$score+12*($this->recruitmentFit($definition,$plan)-.5);
                }
                uksort($scores,fn($a,$b)=>$scores[$b]<=>$scores[$a]?:strcmp((string)$a,(string)$b));
                $id=array_key_first($scores);if($id===null)throw ValidationException::withMessages(['lineup'=>'Exactly five definitions are required.']);
                $result[$id][$side]=$position;unset($remaining[$id]);
            }
        }
        return $this->assignments(array_keys($definitions),$result);
    }
    /** Only the migration invokes this conversion. The original input is archived before replacement. */
    public function migrateAttributes(array $s): array
    {
        if(isset($s['rifling']))return array_intersect_key($s,array_flip(self::ATTRIBUTES));
        $bounded=fn($v)=>(int)round(max(1,min(99,$v)));
        return ['rifling'=>$bounded($s['lan']??50),'sniping'=>$bounded(($s['lan']??50)*.55+($s['clu']??50)*.35+($s['iq']??50)*.1),
            'entry'=>$bounded(($s['lan']??50)*.6+($s['tf']??50)*.4),'utility'=>$bounded((($s['tf']??50)+($s['flx']??50))/2),
            'positioning'=>$bounded($s['iq']??50),'shotcalling'=>$bounded($s['ldr']??$s['iq']??50)];
    }
}
