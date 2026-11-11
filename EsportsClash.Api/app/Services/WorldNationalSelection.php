<?php
namespace App\Services;
use App\Models\NationalTeam;
use Illuminate\Support\Facades\DB;

/** Utility ordering within the existing legal, bounded national pool. Never alters eligibility. */
class WorldNationalSelection {
    public function assign(array $pool,array $slots,array $definitions,array $avatars):array {
        $edges=[];
        foreach($slots as $i=>$slot){$avatar=$avatars[$slot['avatar_id']]??[];$edges[$i]=[];
            foreach($pool as $p){$d=$definitions[$p->definition_id]??[];$roles=array_filter([...($d['playableRoles']??[]),$d['preferredRole']??null,$d['role']??null]);
                if(in_array($avatar['primaryRole']??null,$roles,true)||in_array($avatar['secondaryRole']??'', $roles,true))$edges[$i][]=$p->id;
            }
        }
        // Five-slot augmenting-path matching, bounded by the 50-person observed pool.
        // A flexible early pick must not consume the only legal player for a later role.
        $assigned=[];$visit=function(int $slot,array &$seen)use(&$visit,&$assigned,$edges):bool{
            foreach($edges[$slot] as $player){if(isset($seen[$player]))continue;$seen[$player]=true;
                if(!isset($assigned[$player])||$visit($assigned[$player],$seen)){$assigned[$player]=$slot;return true;}
            }return false;
        };
        foreach(array_keys($slots) as $slot){$seen=[];if(!$visit($slot,$seen))return [];}
        $lineup=[];foreach($assigned as $player=>$slot)$lineup[$slot]=['instance_id'=>$player,'avatar_id'=>$slots[$slot]['avatar_id']];ksort($lineup);return array_values($lineup);
    }
    public function order(int $team,array $pool):array {
        if(!app(WorldAgents::class)->ready())return $pool;
        $nation=NationalTeam::findOrFail($team);
        $selector=app(WorldAgents::class)->identity('national-selector:'.$team,'selector',(string)$team,$nation->name.' selection desk','national_selector',['scouting'=>7,'analysis'=>7]);
        $ids=array_map(fn($p)=>$p->id,$pool);
        $form=DB::table('club_player_match_ratings as r')->join('online_matches as m','m.id','=','r.match_id')->where('m.status','completed')->whereIn('r.card_id',$ids)->where('r.created_at','>=',now()->subDays(90))->select('r.card_id')->selectRaw('AVG(r.rating) AS form, COUNT(*) AS samples')->groupBy('r.card_id')->get()->keyBy('card_id');
        $scores=[];
        foreach($pool as $p){$skills=$p->getAttribute('skills')??[];$ability=array_sum($skills)/max(1,count($skills))/100;$f=$form[$p->id]??null;
            $confidence=$f?min(1,$f->samples/10):0;$performance=$f?($f->form/10)*$confidence+.5*(1-$confidence):.5;
            $scores[$p->id]=(.7+.1*$selector->traits['patience'])*$ability+(.3-.1*$selector->traits['patience'])*$performance;
        }
        usort($pool,fn($a,$b)=>($scores[$b->id]<=>$scores[$a->id])?:strcmp($a->id,$b->id));return $pool;
    }
    public function record(int $team,int $event,array $lineup,int $squad):void {
        if(!app(WorldAgents::class)->ready())return;
        $nation=NationalTeam::findOrFail($team);$selector=\App\Models\WorldAgent::where('source_key','national-selector:'.$team)->first();
        if($selector)app(WorldAgents::class)->remember($selector,'national-squad:'.$squad,'selection','completed',['tournament_id'=>$event,'players'=>array_column($lineup,'instance_id'),'basis'=>'Eligible pool, public skills and recent verified form. Existing role and allegiance validation passed.'],.85,.9);
        app(WorldActivityService::class)->record('national-squad:'.$squad,'competition',null,$nation->name.' registered a national squad for '.\App\Models\ClubTournament::findOrFail($event)->title().'.',['tournament_id'=>$event,'reason'=>'national_selection']);
    }
}
