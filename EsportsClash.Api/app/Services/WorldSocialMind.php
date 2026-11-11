<?php
namespace App\Services;

/** Pure, repeatable utility decisions. These traits affect social behavior only. */
class WorldSocialMind
{
    public const ENGINE='world-simulation-v1';
    public const GOALS=[
        'understand'=>'Understand the next competitive change','prepare'=>'Prepare for the next opportunity',
        'belong'=>'Build team confidence','explore'=>'Find a useful question to explore',
        'explain'=>'Make the competition easier to follow','develop'=>'Keep improving through the next challenge',
        'organize'=>'Help people follow the published competition','observe'=>'Focus on what the recording can show',
    ];

    public function noise(string $seed): float { return hexdec(substr(hash('sha256',$seed),0,7))/0xfffffff; }
    public function traits(object $actor): array {
        $profile=json_decode($actor->profile,true)??[];$traits=[];
        foreach(['expression','curiosity','caution','teamwork','ambition'] as $key)$traits[$key]=0.25+0.5*$this->noise($actor->source_key.':'.$key);
        $groups=[
            'expression'=>['showman'=>.35,'short_fuse'=>.2,'silent_operator'=>-.35,'cold_as_ice'=>-.2,'bush_stalker'=>-.18],
            'curiosity'=>['limit_tester'=>.3,'challenger'=>.28,'perfectionist'=>.2,'counterpuncher'=>.2,'tunnel_vision'=>-.2],
            'caution'=>['survivalist'=>.3,'patient_predator'=>.3,'fragile_mental'=>.2,'perfectionist'=>.2,'overconfident'=>-.3,'steal_gambler'=>-.25,'first_blood_hunter'=>-.2],
            'teamwork'=>['captain'=>.35,'glue_guy'=>.35,'loyalist'=>.3,'bodyguard'=>.3,'igl'=>.25,'egoistic'=>-.3,'silent_operator'=>-.2],
            'ambition'=>['iron_will'=>.3,'clutch_performer'=>.25,'momentum_junkie'=>.25,'revenge_driven'=>.2,'siege_closer'=>.2,'objective_zealot'=>.2,'wave_architect'=>.15],
        ];
        foreach($groups as $trait=>$effects)foreach(['primary_personality'=>1,'secondary_personality'=>.5] as $field=>$weight)$traits[$trait]+=($effects[$profile[$field]??'']??0)*$weight;
        if($actor->role==='analyst'){$traits['curiosity']+=.2;$traits['caution']+=.15;}
        if($actor->role==='streamer'){$traits['expression']+=.2;$traits['curiosity']+=.15;}
        if(in_array($actor->role,['manager','general_manager'])&&!empty($profile['management_traits'])){
            $m=$profile['management_traits'];$traits['curiosity']=.25+.5*$m['development'];$traits['ambition']=.2+.6*$m['ambition'];$traits['caution']=.2+.4*$m['thrift']+.2*$m['patience'];
        }
        if(in_array($actor->role,['referee','observer'])){$traits['caution']+=.25;$traits['expression']-=.15;}
        return array_map(fn($v)=>round(max(.05,min(.95,$v)),3),$traits);
    }

    public function initial(object $actor): array {
        $goals=match($actor->role){
            'player'=>['develop','belong','prepare'],'manager','general_manager'=>['prepare','belong','develop'],
            'head_coach','assistant_coach','performance_coach','psychologist'=>['prepare','develop','belong'],
            'analyst'=>['understand','explain','explore'],'streamer'=>['explore','explain','understand'],
            'referee','organizer','tournament'=>['organize','explain'],'observer'=>['observe','explain'],
            'caster'=>['explain','observe','prepare'],default=>['explain','organize','belong'],
        };
        return ['traits'=>$this->traits($actor),'mood'=>['energy'=>.5,'confidence'=>.5,'concern'=>.2],
            'interests'=>[],'goals'=>$goals,'current_goal'=>$goals[0],'observations'=>0];
    }

    public function decide(object $actor,array $signal,array $state,array $recent,float $relevance,float $familiarity): array {
        $traits=$state['traits'];$interests=$state['interests'];$topic=$signal['topic_key'];
        $same=array_values(array_filter($recent,fn($m)=>$m['topic_key']===$topic));
        $posted=array_values(array_filter($same,fn($m)=>$m['outcome']==='published'));
        $novelty=max(0,1-.38*count($same)-.35*count($posted));
        $salience=round(.46*$relevance+.16*$novelty+.11*$traits['curiosity']+.07*$traits['expression']+.07*min(1,$familiarity)+.07*($interests[$signal['type']]??.3)+.06*$state['mood']['energy'],4);
        $goals=$state['goals'];$goalsUsed=array_column(array_slice($recent,0,3),'goal');$goalScores=[];
        foreach($goals as $goal){
            $fit=match($goal){'understand'=>$signal['type']==='patch'?1:.5,'prepare'=>in_array($signal['type'],['patch','calendar','recruitment'])?.85:.4,
                'belong'=>$signal['self']?1:.3,'develop'=>$signal['self']?.9:.45,'organize'=>$signal['type']==='calendar'?1:.4,
                'observe'=>in_array($signal['type'],['result','broadcast'])?1:.35,'explore'=>.55+.3*$traits['curiosity'],default=>.7};
            $fit+=match($goal){'develop'=>.15*$traits['curiosity'],'prepare'=>.15*$traits['caution'],'belong'=>.15*$traits['teamwork'],default=>0};
            $goalScores[$goal]=$fit-.22*count(array_filter($goalsUsed,fn($g)=>$g===$goal))+.09*$this->noise($actor->id.':'.$signal['source_id'].':'.$goal);
        }
        arsort($goalScores);$goal=array_key_first($goalScores);
        $scores=['question'=>.4+.5*$traits['curiosity'],'analysis'=>.3+.5*$traits['caution'],
            'support'=>.2+.65*$traits['teamwork']+($signal['self']?.15:0),'caution'=>.2+.6*$traits['caution'],
            'resolve'=>.2+.6*$traits['ambition'],'watch'=>.35+.2*$traits['caution']];
        if($actor->role==='streamer')$scores['content_idea']=.45+.4*$traits['curiosity'];
        if($actor->role==='observer')$scores['observation']=.9;
        if(in_array($actor->role,['organizer','referee','host']))$scores['clarity']=.8;
        if($signal['type']==='patch')$scores['analysis']+=.2;
        $scores['resolve']+=.2*$state['mood']['confidence'];
        $scores['caution']+=.25*$state['mood']['concern'];
        $scores['support']+=.2*(1-$state['mood']['confidence'])*$traits['teamwork'];
        foreach($scores as $intent=>&$score){
            $score-=.3*count(array_filter(array_slice($recent,0,4),fn($m)=>$m['intent']===$intent&&$m['outcome']==='published'));
            $score+=.12*$this->noise($actor->id.':'.$signal['source_id'].':'.$intent);
        }unset($score);arsort($scores);
        $speak=$relevance>=.42&&$salience>=.48&&$novelty>.25;
        // Quiet identities require stronger reasons, rather than publishing filler to meet a quota.
        if($traits['expression']<.25&&$salience<.7)$speak=false;
        return ['speak'=>$speak,'salience'=>$salience,'novelty'=>$novelty,'goal'=>$goal,'intents'=>array_keys($scores),
            'tone'=>$traits['expression']>.7?'expressive':($traits['caution']>.7?'measured':'plain'),
            'reason'=>$speak?'relevant_new_event':($novelty<=.25?'topic_fatigue':'insufficient_interest')];
    }

    public function evolve(array $state,array $signal,array $decision): array {
        $mood=$state['mood'];
        $mood['energy']=round(max(.1,min(.9,$mood['energy']*.75+.25*$decision['salience'])),3);
        $mood['confidence']=round(max(.1,min(.9,$mood['confidence']*.85+.15*(.5+$signal['valence']*.4))),3);
        $mood['concern']=round(max(.05,min(.9,$mood['concern']*.8+.2*($signal['type']==='patch'?.5:.2))),3);
        $interests=array_map(fn($n)=>round($n*.94,3),$state['interests']);
        $interests[$signal['type']]=round(min(1,($interests[$signal['type']]??.25)+.15*$decision['salience']),3);
        return [...$state,'mood'=>$mood,'interests'=>$interests,'current_goal'=>$decision['goal'],'observations'=>$state['observations']+1];
    }
}
