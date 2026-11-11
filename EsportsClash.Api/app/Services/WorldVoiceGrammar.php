<?php
namespace App\Services;

/** Composes a speech act around actual evidence; it cannot invent match or patch facts. */
class WorldVoiceGrammar
{
    public function candidates(object $actor,array $signal,array $decision): array {
        $subject=$signal['subject'];$focus=$signal['focus'];$profile=json_decode($actor->profile,true)??[];
        $frames=match($signal['type']){
            'patch'=>["On $subject:","The talking point in $subject:","My question about $subject:","Looking at $subject,"],
            'recruitment','transfer'=>["With $subject in the news,","That move involving $subject:","The next chapter for $subject:","Following the news about $subject,"],
            'market'=>["Watching $subject:","On the market news around $subject,","A thought on $subject:","Following $subject,"],
            'result'=>["After $subject,","Looking back at $subject:","My takeaway from $subject:","The question after $subject:"],
            'broadcast'=>["With $subject on the calendar,","Watching the coverage of $subject:","On $subject:","The focus around $subject:"],
            default=>["Following $subject,","A thought on $subject:","The next question around $subject:","Keeping an eye on $subject,"],
        };
        $lenses=match($decision['goal']){
            'belong'=>["the squad's communication","each teammate's place in the group",'the balance of roles across the squad','the trust built through preparation'],
            'develop'=>['consistent preparation','the adjustment to new expectations','the next learning opportunity','individual progress within the group'],
            'prepare'=>['the next preparation window','the priorities for the next fixture','the decisions that deserve extra preparation','the balance between continuity and change'],
            'observe'=>['the available recording','the moments worth a closer look','the evidence behind the result','the sequence behind the headline'],
            'organize'=>['clear expectations for participants','the published schedule and entry requirements','the next steps for participants','the clarity of the event rules'],
            'explore'=>["the trade-offs around $focus","the preparation needed for $focus","the questions behind $focus","the different approaches to $focus"],
            default=>["the place of $focus in the bigger picture","the decisions around $focus","the trade-offs in $focus","the preparation behind $focus"],
        };
        if($actor->kind==='player'&&$signal['type']==='patch'&&!empty($profile['preferred_role'])&&in_array(mb_strtolower($profile['preferred_role']),$signal['role_topics'],true)){
            $role=$profile['preferred_role'];$lenses=["my preparation for $role play","the details of $focus","the next question for my $role preparation","the preparation behind $focus"];
        }
        if($signal['self']&&$actor->kind==='player'&&in_array($signal['type'],['transfer','recruitment'])){
            $club=$profile['club_name']??null;
            $frames=$club&&($profile['club_id']??null)===$signal['reported_club_id']?["A new chapter with $club:","Thinking about the next step at $club,","My focus at $club:","As I settle into $club,"]:['A fresh chapter:','Looking toward the next step,','A thought after the move:','For the next chapter,'];
        }
        $acts=[
            'question'=>['What would make the biggest difference to %s?','How would you approach %s?','Which part of %s deserves more attention?','Where would you begin with %s?'],
            'analysis'=>["My starting point is %s.","I'd start by looking at %s.","The useful detail here is %s.","I'd like to understand %s better."],
            'support'=>["I'd like to see care put into %s.","I want to give %s the attention it deserves.","I hope the next step helps with %s.","It would be good to give %s some attention."],
            'caution'=>["I'd take time to understand %s.","I'd keep an open mind about %s.","I'd want more context around %s.","Some care is needed with %s."],
            'resolve'=>["I want to work on %s.","That puts %s on my preparation list.","I'd put some effort into %s.","I want to give %s a clear place in the next step."],
            'watch'=>["I'll be watching %s.","The detail on my radar is %s.","I'm curious about %s.","I'd like to follow %s more closely."],
            'content_idea'=>['An idea for a future discussion: %s.','I could build a breakdown around %s.','A useful topic for a future segment would be %s.','I would like to explore %s in a future discussion.'],
            'clarity'=>['The useful starting point is %s.','I would keep the conversation grounded in %s.','For anyone following along, I would start with %s.','I want the next conversation to be clear about %s.'],
            'observation'=>['I would point viewers toward %s.','My focus for following the action is %s.','I would keep the coverage centered on %s.','The useful viewing question is %s.'],
        ];
        $qualifiers=$signal['type']==='patch'&&$signal['phase']==='announced'
            ?['These are announced notes; the effect in play is still an open question.','The announced direction gives us a question to test once it is released.','I am treating the announced direction as a starting point for discussion.']
            :[''];
        $seed=$actor->id.':'.$signal['source_id'].':'.$decision['tone'];$mind=app(WorldSocialMind::class);$out=[];
        foreach($decision['intents'] as $intent){
            if(!isset($acts[$intent]))continue;
            // Each candidate is a composition of a frame, a goal-specific lens, an act and an optional qualifier.
            for($i=0;$i<6;$i++){
                $pick=fn($name,$count)=>(int)floor($mind->noise($seed.':'.$intent.':'.$i.':'.$name)*$count)%$count;
                $f=$pick('frame',count($frames));$l=$pick('lens',count($lenses));$a=$pick('act',count($acts[$intent]));$q=$pick('qualifier',count($qualifiers));
                $clause=sprintf($acts[$intent][$a],$lenses[$l]);
                if(str_ends_with($frames[$f],',')&&!preg_match('/^I(?:\b|\x27)/',$clause))$clause=lcfirst($clause);
                $body=$frames[$f].' '.$clause;
                if($qualifiers[$q]!=='')$body.=' '.$qualifiers[$q];
                // Quiet identities use concise formulations; personality changes decisions as well as wording.
                if($decision['tone']==='measured'&&$signal['type']!=='patch')$body=$frames[$f].' '.$clause;
                $out[]=['body'=>$body,'intent'=>$intent,'composition'=>['frame'=>$f,'lens'=>$l,'act'=>$a,'qualifier'=>$q,'tone'=>$decision['tone'],'goal'=>$decision['goal']]];
            }
        }
        return $out;
    }
}
