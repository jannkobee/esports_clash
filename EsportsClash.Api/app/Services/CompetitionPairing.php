<?php
namespace App\Services;

use Illuminate\Validation\ValidationException;

/** Pure, bounded-format calculations. IDs are edition-entry IDs, never catalog definitions. */
class CompetitionPairing
{
    public const FORMATS=['single_elimination','double_elimination','swiss','round_robin','groups','open_qualifier'];

    public function drawGroups(array $ids,int $count,array $paths=[],array $limits=[]):array
    {
        $groups=array_fill(0,$count,[]);$capacity=(int)ceil(count($ids)/$count);$budget=50000;
        $assign=function(int $i)use(&$assign,&$groups,$ids,$count,$capacity,$paths,$limits,&$budget):bool{
            if($i===count($ids))return true;if(--$budget<0)return false;
            $order=range(0,$count-1);usort($order,fn($a,$b)=>(count($groups[$a])<=>count($groups[$b]))?:($a<=>$b));
            foreach($order as $g){if(count($groups[$g])>=$capacity)continue;$ok=true;
                foreach($limits as $geo=>$limit){if(!in_array((int)$geo,$paths[$ids[$i]]??[],true))continue;$used=0;foreach($groups[$g] as $member)if(in_array((int)$geo,$paths[$member]??[],true))$used++;if($used>=$limit){$ok=false;break;}}
                if(!$ok)continue;$groups[$g][]=$ids[$i];if($assign($i+1))return true;array_pop($groups[$g]);
            }return false;
        };
        if(!$assign(0))throw ValidationException::withMessages(['draw'=>'The published geographic group limits cannot be satisfied.']);
        return $groups;
    }

    public function roundRobin(array $ids, int $round): array
    {
        if (count($ids)%2) $ids[]=null;
        $n=count($ids); if ($n<2 || $round>$n-1) return [];
        for($i=1;$i<$round;$i++){ $tail=array_pop($ids); array_splice($ids,1,0,[$tail]); }
        $pairs=[];
        for($i=0;$i<$n/2;$i++) if($ids[$i]!==null && $ids[$n-1-$i]!==null) $pairs[]=[$ids[$i],$ids[$n-1-$i]];
        return $pairs;
    }

    public function swiss(array $ordered, array $played, array $previousByes=[]): array
    {
        $bye=null;
        if(count($ordered)%2) {
            foreach(array_reverse($ordered) as $id) if(!in_array($id,$previousByes,true)){ $bye=$id;break; }
            if($bye===null) throw ValidationException::withMessages(['pairing'=>'No eligible Swiss bye remains.']);
            $ordered=array_values(array_diff($ordered,[$bye]));
        }
        $budget=50000;
        $search=function(array $remaining) use (&$search,$played,&$budget): ?array {
            if(!$remaining)return [];
            if(--$budget<0)return null;
            $a=array_shift($remaining);
            foreach($remaining as $i=>$b) {
                $key=min($a,$b).':'.max($a,$b);
                if(isset($played[$key]))continue;
                $rest=$remaining;unset($rest[$i]);
                $pairs=$search(array_values($rest));
                if($pairs!==null)return [[$a,$b],...$pairs];
            }
            return null;
        };
        $pairs=$search($ordered);
        if($pairs===null)throw ValidationException::withMessages(['pairing'=>'Swiss draw requires review; no rematch was silently created.']);
        return ['pairs'=>$pairs,'bye'=>$bye];
    }

    public function standings(array $ids, array $results, array $seeds=[], array $byes=[]): array
    {
        $rows=[]; foreach($ids as $id)$rows[$id]=['id'=>$id,'played'=>0,'wins'=>0,'losses'=>0,'buchholz'=>0,'seed'=>$seeds[$id]??$id,'head'=>[]];
        foreach($results as $r) {
            $w=(int)$r['winner'];$l=(int)$r['loser'];
            if(!isset($rows[$w],$rows[$l]))continue;
            $rows[$w]['wins']++;$rows[$l]['losses']++;$rows[$w]['played']++;$rows[$l]['played']++;
            $rows[$w]['head'][$l]=($rows[$w]['head'][$l]??0)+1;
        }
        foreach($byes as $id)if(isset($rows[$id]))$rows[$id]['wins']++;
        foreach($results as $r) { $w=(int)$r['winner'];$l=(int)$r['loser'];if(isset($rows[$w],$rows[$l])){$rows[$w]['buchholz']+=$rows[$l]['wins'];$rows[$l]['buchholz']+=$rows[$w]['wins'];} }
        // Mini-table head-to-head across every equally-scored team, avoiding a non-transitive comparator.
        foreach($rows as &$row){$row['head_to_head']=0;foreach($rows as $other)if($row['wins']===$other['wins'])$row['head_to_head']+=$row['head'][$other['id']]??0;}unset($row);
        $rows=array_values($rows);
        usort($rows,fn($a,$b)=>($b['wins']<=>$a['wins'])?:($b['head_to_head']<=>$a['head_to_head'])?:($b['buchholz']<=>$a['buchholz'])?:($a['seed']<=>$b['seed'])?:($a['id']<=>$b['id']));
        return $rows;
    }

    public function groupAdvancers(array $tables,int $advance): array
    {
        $guaranteed=(int)floor($advance/count($tables));$selected=[];$next=[];
        foreach($tables as $group=>$table){foreach(array_slice($table,0,$guaranteed) as $row)$selected[]=$row+['group'=>$group];if(isset($table[$guaranteed]))$next[]=$table[$guaranteed]+['group'=>$group];}
        // Cross-group comparison excludes head-to-head and Buchholz (not comparable between groups).
        usort($next,fn($a,$b)=>($b['wins']<=>$a['wins'])?:($a['losses']<=>$b['losses'])?:($a['seed']<=>$b['seed'])?:($a['id']<=>$b['id']));
        $selected=[...$selected,...array_slice($next,0,$advance-count($selected))];
        // Deterministic bracket matching, with group winners placed first and no same-group first round.
        $half=(int)(count($selected)/2);$left=array_slice($selected,0,$half);$right=array_reverse(array_slice($selected,$half));
        $budget=50000;
        $match=function(int $i,array $available)use(&$match,$left,&$budget):?array{
            if($i===count($left))return [];if(--$budget<0)return null;
            foreach($available as $j=>$candidate){if($candidate['group']===$left[$i]['group'])continue;$rest=$available;unset($rest[$j]);$tail=$match($i+1,$rest);if($tail!==null)return [[$left[$i]['id'],$candidate['id']],...$tail];}return null;
        };
        $pairs=$match(0,$right);
        if($pairs===null)throw ValidationException::withMessages(['draw'=>'Cannot satisfy published group separation.']);
        return array_merge(...$pairs);
    }
}
