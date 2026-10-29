<?php
namespace App\Services;
use App\Models\EvolutionRun;

/** Describes recorded evidence. Missing measurements never become zeroes or wins. */
class IntelligenceNarrative {
    public function describe(EvolutionRun $run):array {
        $plan=$run->plan??[];$progress=$run->progress??[];$result=$run->result??[];
        $a=$result['assessment']??[];$stage=$progress['stage']??'queued';$domain=$plan['domain']??'macro';
        $purpose=match($domain){
            'parameter'=>'Test whether changing the importance of farming and pushing helps the same team win more often.',
            'marl'=>'Learn macro decisions from team experience, then compare the frozen learned policy against the previous policy.',
            'source'=>'Test an isolated alternative decision-scoring program without changing combat mechanics.',
            'arena'=>'Teach a starting controller from examples, then learn movement, targets, casting and strategic choices through matches.',
            default=>'Compare a candidate policy with the existing policy using recorded game outcomes.'};
        $explanations=[
            'queued'=>'The job is waiting for the worker. No match result is available yet.',
            'software-checks'=>'The worker is checking the actual game tests and build before collecting evidence. Passing these checks establishes software compatibility, not better play.',
            'baseline'=>'The existing policy is playing repeated control matches on both sides. These checks establish a reproducible comparison; they do not count as wins for the challenger.',
            'fitting'=>'The worker is trying candidate settings on development matches. These matches help choose a candidate; they are excluded from the independent improvement test.',
            'self-play'=>'The agents are collecting experience from actual matches. A changed decision or a lower training loss does not yet establish better gameplay.',
            'teaching'=>'The starting model is learning from examples of basic play. This gives it a foundation; the examples are not evidence that it beats the previous policy.',
            'trained'=>'A model update has been recorded. The worker must still test its performance on matches that did not train or select it.',
            'held-out'=>'The selected candidate is frozen. The worker is now comparing it with repeated controls on fresh evaluation matches, including both sides and the planned opponents.',
            'complete'=>'Collection has ended. The conclusion below is based on the recorded full-match assessment.'
        ];
        $findings=[];$limits=[];$interval=$a['winDelta']??null;
        if(isset($progress['complete'],$progress['planned']))$findings[]=sprintf('%d of %d planned %s have been collected in the current stage. The stage must finish before its final conclusion is available.',$progress['complete'],$progress['planned'],$stage==='baseline'?'control matches':'comparisons');
        if($stage==='fitting'&&isset($progress['candidate']))$findings[]='The worker is testing candidate '.($progress['candidate']+1).' on development matches. A development result cannot be reused as independent proof of improvement.';
        if(isset($progress['generation']))$findings[]='Training update '.($progress['generation']+($stage==='trained'?0:1)).' is the current recorded update. A higher update number means more optimization work, not necessarily stronger play.';
        if(isset($progress['partial']['terminal'])){
            $p=$progress['partial'];$findings[]=sprintf('So far, %d completed reproducible comparisons include %d outcomes changed from a loss to a win, %d changed from a win to a loss, and %d unchanged outcomes. This is an unfinished tally; it is not the final independent result.',$p['terminal'],$p['wins_gained'],$p['wins_lost'],$p['unchanged']);
        }
        $outcomes=$result['outcomes']??[];$pairs=$outcomes['terminal_pairs']??null;
        if(is_numeric($pairs)&&$pairs>0&&isset($outcomes['control_wins'],$outcomes['challenger_wins'])){
            $findings[]=sprintf('Across %d completed paired worlds, the previous policy won %d matches (%.1f%%) and the candidate won %d (%.1f%%). These are matched comparisons, not %d independent samples.',
                $pairs,$outcomes['control_wins'],100*$outcomes['control_wins']/$pairs,$outcomes['challenger_wins'],100*$outcomes['challenger_wins']/$pairs,$pairs);
        }
        if($interval&&isset($interval['estimate'],$interval['lower'],$interval['upper'])){
            $findings[]=sprintf('The estimated win-rate change is %+.2f percentage points. The %.0f%% uncertainty interval runs from %+.2f to %+.2f points, using %d independent seed groups. Both sides and opponent variants of the same seed stay in the same group.',
                100*$interval['estimate'],100*($interval['confidence']??.95),100*$interval['lower'],100*$interval['upper'],$a['independentSeeds']??0);
            if($interval['lower']<=0&&$interval['upper']>=0)$limits[]='The interval includes no improvement. The current evidence cannot distinguish a real advantage from match-to-match variation.';
        }
        $behavior=$result['behavior']??[];
        if(isset($behavior['controllerDecisions']))$findings[]=number_format($behavior['controllerDecisions']).' concrete controller choices were recorded across the candidate worlds (both teams). '.number_format($behavior['intents_recorded']??0).' commands actually started executing. Repeated ticks of the same held command are counted once.';
        $labels=['deaths'=>'team deaths','cs'=>'team last hits','gold'=>'unspent team gold at match end','damage'=>'team champion damage','durationSeconds'=>'match duration in seconds'];
        foreach($result['outcomes']['averages']??[] as $metric=>$values)if(isset($labels[$metric],$values['control'],$values['candidate'],$values['delta']))
            $findings[]=sprintf('Average %s: %.1f with the previous policy; %.1f with the candidate (%+.1f per matched world). This is descriptive: longer matches, spending and trades can change it without improving the chance of winning.',$labels[$metric],$values['control'],$values['candidate'],$values['delta']);
        if(isset($behavior['eligible'],$behavior['changed'])&&$behavior['eligible']>0){
            $findings[]=sprintf('The candidate chose a different action on %d of %d recorded eligible decisions (%.1f%%). This proves behavioral influence; it does not prove those choices were better.',
                $behavior['changed'],$behavior['eligible'],100*$behavior['changed']/$behavior['eligible']);
        }
        $candidate=$result['candidate']['policy']??null;
        if(($candidate['kind']??null)==='macro-strategy'){
            $defaults=['farmStrategic'=>.42,'farmTactical'=>.36,'farmConversionTactical'=>.65,'pushStrategic'=>.18,'pushTempoStrategic'=>.62];
            $labels=['farmStrategic'=>'long-term farming preference','farmTactical'=>'ordinary farming opportunity','farmConversionTactical'=>'farming after a won fight','pushStrategic'=>'ordinary lane pushing','pushTempoStrategic'=>'pushing during a team advantage'];
            foreach($defaults as $key=>$base)if(isset($candidate[$key])&&abs($candidate[$key]-$base)>1e-8)
                $findings[]=sprintf('The candidate weights %s at %.3f; the authored starting value is %.3f. This describes a policy change, not a demonstrated improvement.',$labels[$key],$candidate[$key],$base);
        }
        $reasons=[
            'incomplete-full-matches'=>'Some planned matches did not finish. Their missing outcomes cannot be treated as wins.',
            'invalid-or-unstable-evidence'=>'At least one control comparison or evidence check failed, so the comparison is not reliable.',
            'team-survival-regression'=>'The candidate caused extra team deaths in at least one paired case and failed this study’s original survival requirement.',
            'insufficient-independent-seeds'=>'Too few independent seed groups have been measured for the declared acceptance test.',
            'insufficient-draft-diversity'=>'The required variety of drafted lineups has not been established.',
            'missing-opponent-coverage'=>'The planned opponent-policy coverage is incomplete.',
            'improvement-not-established'=>'The lower confidence bound does not establish a positive win-rate improvement.',
            'side-regression'=>'The candidate’s average result was worse on at least one side of the map.',
            'total-budget-exhausted'=>'The study used its total compute allowance before it could establish qualification.'
        ];
        foreach($a['reasons']??[] as $reason)$limits[]=$reasons[$reason]??('The worker recorded: '.$reason);
        if(isset($a['extraTeamDeathCases']))$findings[]='Extra team deaths occurred in '.$a['extraTeamDeathCases'].' measured paired cases. This is a count of affected cases, not the total number of deaths.';
        $verdict=match($a['status']??''){
            'promote'=>'The recorded independent gate passed. This is evidence for the measured policy and test distribution; game activation and broader generalization are separate questions.',
            'reject'=>'The candidate was rejected. It should not replace the incumbent based on this study.',
            'inconclusive'=>'No improvement has been established by this study. The incumbent should be retained.',
            default=>'No independent improvement result is available yet.'};
        if($run->status==='failed')$verdict='The study failed before qualification. This is an experiment or infrastructure failure, not evidence that gameplay improved.';
        if($run->status==='cancelled')$verdict='The study was stopped. Recorded work is retained, but unfinished comparisons do not establish improvement.';
        if($domain==='arena'&&in_array($a['status']??'',['reject','inconclusive'],true))$verdict.=' This conclusion governs qualification. A separately labelled experimental preview can still be observed, and may be weaker.';
        if(!$findings)$findings[]='No measured gameplay improvement can be reported from the currently stored results.';
        $playbook=[];$teaching=$plan['teaching']??null;
        if($domain==='arena'&&in_array($teaching['version']??null,[3,4,5,6],true)){
            $path=resource_path('game/arena-playbook-v'.$teaching['version'].'.json');
            if(is_file($path)&&hash_equals($teaching['playbook_sha256']??'',hash_file('sha256',$path)))$playbook=json_decode(file_get_contents($path),true,flags:JSON_THROW_ON_ERROR);
            else $limits[]='The exact teaching brief for this study is unavailable or its hash differs. The report will not substitute a newer brief.';
        }
        $current=match($run->status){
            'cancelled'=>'The study has stopped. Its recorded work remains available; no additional matches are being collected for it.',
            'failed'=>'The worker stopped on an error. The recorded error and technical evidence below explain the failure; no further matches are currently running for this study.',
            'completed'=>'The study has ended. The recorded assessment determines what its completed comparisons establish; unfinished comparisons remain missing evidence.',
            'paused_budget'=>'The compute window is paused and its original progress is saved. Resuming continues the same frozen study rather than creating new evidence from a different model.',
            'paused_resource'=>'The worker is waiting for resources. Collection is paused, and a resource wait does not establish a gameplay result.',
            'stopping'=>'A stop was requested. The worker is closing the current attempt and retaining its evidence.',
            default=>$explanations[$stage]??('The worker is in the recorded stage: '.$stage.'.')};
        return compact('purpose','verdict','findings','limits','playbook')+['stage'=>$current,
            'planned'=>$a['planned']??$progress['planned']??null,'measured'=>$a['measured']??$progress['complete']??null,
            'training'=>$result['training']??$progress['training']??(isset($progress['metrics'])?[$progress['metrics']]:[])];
    }
}
