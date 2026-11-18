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
    public function tendenciesCatalog(): array
    {
        static $tendencies;
        if($tendencies!==null)return $tendencies;
        $source=base_path('../EsportsClash.Web/src/fps/fps-player-tendencies-v4.json');
        $packaged=resource_path('fps-player-tendencies-v4.json');
        if(is_file($source)&&is_file($packaged)&&!hash_equals(hash_file('sha256',$source),hash_file('sha256',$packaged)))throw new \RuntimeException('FPS tendencies package differs from its canonical source. Run the catalog sync script.');
        return $tendencies ??= json_decode(file_get_contents(is_file($source)?$source:$packaged), true, 512, JSON_THROW_ON_ERROR);
    }
    /** Keys returned by scouting derivation, in the order the shared vectors list them. */
    public const SCOUTING_TENDENCY_KEYS = ['structuredCalling','defaultPreference','rushCalling','utilityHeavyCalling','delegation','playerAutonomy','leadFromFront','midroundAdaptation','tempoSwitching','opportunityCalling','riskCalling','secondaryCallerTrust','earlyAggression','playDiscipline','supportFlash','lurkFlank','wideSwing','jigglePeek','utilityConservation','rotationProactivity'];
    private const DNA_KEYS = ['riskTolerance','emotionalStability','coachability','tacticalDiscipline','adaptability','creativity','confidenceVolatility','socialTrust','leadershipInitiative','competitiveDrive','teamOrientation','preparationPreference'];
    /** Shared weight table generated from fpsPlayerTendencies.ts deriveFpsTendencies (see fpsTendencyFormulas.ts). */
    public function tendencyFormulas(): array
    {
        static $formulas;
        if($formulas!==null)return $formulas;
        $source=base_path('../EsportsClash.Web/src/fps/fps-tendency-formulas-v4.json');
        $packaged=resource_path('fps-tendency-formulas-v4.json');
        if(is_file($source)&&is_file($packaged)&&!hash_equals(hash_file('sha256',$source),hash_file('sha256',$packaged)))throw new \RuntimeException('FPS tendency formula package differs from its canonical source. Run the catalog sync script.');
        return $formulas ??= json_decode(file_get_contents(is_file($source)?$source:$packaged), true, 512, JSON_THROW_ON_ERROR);
    }
    /**
     * Natural tendencies exactly as the client's deriveFpsTendencies computes them: the shared weight
     * table summed in source order, the same FNV jitter and the same rounding. Reads only the 4D
     * personality and stable DNA; never attributes, K/D or match results. Raw DNA never leaves here.
     */
    public function deriveTendencyValues(array $p, array $dna, array $keys): array
    {
        $p=$this->personality($p);
        $table=$this->tendencyFormulas();
        $prefInit=match($p['playstyle']){'AGGRESSIVE'=>.9,'PASSIVE'=>.1,default=>.5};
        $prefCoord=$p['mindset']==='TEAM_FIRST'?.85:.25;
        $prefDelib=match($p['decisionStyle']){'METHODICAL'=>.85,'INSTINCTIVE'=>.15,default=>.5};
        $prefReass=match($p['decisionStyle']){'ADAPTIVE'=>.85,'INSTINCTIVE'=>.6,default=>.4};
        $prefPress=match($p['temperament']){'VOLATILE'=>1,'STEADY'=>.45,default=>.1};
        $inputs=['init'=>$prefInit*100,'coord'=>$prefCoord*100,'delib'=>$prefDelib*100,'reass'=>$prefReass*100,'press'=>$prefPress*100,'inst'=>(1-$prefDelib)*100,'indiv'=>(1-$prefCoord)*100];
        $d=array_replace(array_fill_keys(self::DNA_KEYS,50),array_intersect_key($dna,array_flip(self::DNA_KEYS)));
        $sig=implode(':',array_map(fn($k)=>(string)$d[$k],['riskTolerance','creativity','tacticalDiscipline','teamOrientation','leadershipInitiative','adaptability']));
        $span=$table['jitterSpan'];
        $jitter=function(string $key)use($p,$sig,$span): float {
            $hash=2166136261;$value=$p['id'].':'.$sig.':'.$key;
            for($i=0;$i<strlen($value);$i++)$hash=(($hash^ord($value[$i]))*16777619)&0xffffffff;
            return (($hash%1000)/999-0.5)*$span;
        };
        $evaluate=function(array $terms)use(&$evaluate,$inputs,$d): float {
            $sum=0.0;
            foreach($terms as [$weight,$input,$inverted]){
                $value=is_array($input)?$evaluate($input):(str_starts_with($input,'d.')?$d[substr($input,2)]:$inputs[$input]);
                $sum+=$weight*($inverted?100-$value:$value);
            }
            return $sum;
        };
        $out=[];
        foreach($keys as $key){
            $base=isset($table['formulas'][$key])?$evaluate($table['formulas'][$key]):50;
            $out[$key]=(int)round(max(0,min(100,$base+$jitter($key))));
        }
        return $out;
    }
    /** Scouting subset (20 keys) used for top tendencies and IGL leadership identity. */
    public function deriveTendencies(array $p, array $dna): array
    {
        return $this->deriveTendencyValues($p,$dna,self::SCOUTING_TENDENCY_KEYS);
    }
    /** The derived values the manager's team diagnostics read (shared `diagnosticKeys`); never DNA. */
    public function diagnosticTendencies(array $p, array $dna): array
    {
        return $this->deriveTendencyValues($p,$dna,$this->tendencyFormulas()['diagnosticKeys']);
    }
    /**
     * Hidden capability trait (0..100), mirrored exactly from fpsConsistency.ts deriveFpsConsistency:
     * 10 + .30 emotional stability + .25 (100 - confidence volatility) + .15 tactical discipline
     * + .05 preparation + .15 (100 - pressure sensitivity). It scales execution variance only; it is not
     * a tendency. Only its qualitative label leaves the server.
     */
    public function deriveConsistency(array $p, array $dna): int
    {
        $p=$this->personality($p);
        $press=match($p['temperament']){'VOLATILE'=>1,'STEADY'=>.45,default=>.1}*100;
        $d=array_replace(array_fill_keys(self::DNA_KEYS,50),array_intersect_key($dna,array_flip(self::DNA_KEYS)));
        return (int)round(max(0,min(100,10+.30*$d['emotionalStability']+.25*(100-$d['confidenceVolatility'])+.15*$d['tacticalDiscipline']+.05*$d['preparationPreference']+.15*(100-$press))));
    }
    /** Manager-facing 1–10 scale, mirrored exactly from fpsScale10.ts (owner decision 2026-11-17). */
    public const SKILL_SCALE_LABELS=['Erratic','Wretched','Poor','Weak','Passable','Solid','Steady','Excellent','Formidable','Metronomic'];
    public const TENDENCY_SCALE_LABELS=['Never','Almost never','Rarely','Seldom','Sometimes','Often','Usually','Strongly','Very strongly','Always'];
    public function scale10(float $value): int
    {
        return (int)max(1,min(10,ceil($value/10)));
    }
    /** @return array{value:int,label:string} */
    public function rated(float $value, string $kind): array
    {
        $level=$this->scale10($value);
        return ['value'=>$level,'label'=>($kind==='skill'?self::SKILL_SCALE_LABELS:self::TENDENCY_SCALE_LABELS)[$level-1]];
    }
    public function consistencyLabel(int $value): string
    {
        return $this->rated($value,'skill')['label'];
    }
    public function iglLeadershipIdentity(array $t): array
    {
        $groups=[
            ['score'=>(($t['structuredCalling']??50)+($t['utilityHeavyCalling']??50)+($t['defaultPreference']??50))/3,'label'=>'Tactical Architect','summary'=>'Rehearsed defaults, synchronized utility, disciplined spacing and structured executes.','potentialWeakness'=>'Can struggle when opponents repeatedly disrupt structure.'],
            ['score'=>(($t['leadFromFront']??50)+($t['rushCalling']??50)+($t['riskCalling']??50))/3,'label'=>'Fragging Playmaker','summary'=>'Fast commitments, aggressive openings, momentum-driven attacks and proactive combat.','potentialWeakness'=>'Risk of overcommitment and thin preparation against disciplined defenses.'],
            ['score'=>(($t['midroundAdaptation']??50)+($t['tempoSwitching']??50)+($t['opportunityCalling']??50))/3,'label'=>'Adaptive Mastermind','summary'=>'Information-driven defaults, frequent mid-round pivots and opponent-specific adjustments.','potentialWeakness'=>'Teammates with low adaptability may struggle to keep up with frequent changes.'],
            ['score'=>(($t['delegation']??50)+($t['playerAutonomy']??50)+($t['secondaryCallerTrust']??50))/3,'label'=>'Player-Centric Facilitator','summary'=>'Distributed decision-making, high player freedom and tactics built around roster strengths.','potentialWeakness'=>'Can lack direction when independent plays fail to create openings.'],
        ];
        usort($groups,fn($a,$b)=>$b['score']<=>$a['score']);
        return ['label'=>$groups[0]['label'],'summary'=>$groups[0]['summary'],'potentialWeakness'=>$groups[0]['potentialWeakness']];
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
