<?php
namespace App\Services;

use App\Models\{OnlineClub,OwnedPlayerCard,WorldAgent};
use Illuminate\Support\Facades\{DB,Schema};
use Illuminate\Support\Str;

/** Career identity, bounded knowledge and evidence-based adaptation shared across professions. */
class WorldAgents {
    public const VERSION=1;
    private ?bool $available=null;
    public function ready():bool{return $this->available??=Schema::hasTable('world_agents');}
    public function identity(string $key,string $kind,string $source,string $name,string $profession,array $skills,?int $club=null,?int $wire=null):WorldAgent {
        $mind=app(WorldSocialMind::class);$traits=[];
        if($wire&&($actor=DB::table('world_wire_accounts')->find($wire)))$traits=$mind->traits($actor);
        foreach(['ambition','patience','loyalty','thrift','adaptability','confidence','professionalism','cooperation','risk'] as $trait)$traits[$trait]??=round(.2+.6*$mind->noise($key.':'.$trait),4);
        return WorldAgent::firstOrCreate(['source_key'=>$key],['id'=>\Ramsey\Uuid\Uuid::uuid5(\Ramsey\Uuid\Uuid::NAMESPACE_URL,'hexatrick:'.$key)->toString(),'source_id'=>$source,'kind'=>$kind,'name'=>$name,'profession'=>$profession,'skills'=>$skills,
            'traits'=>$traits,'goals'=>['develop','financial_security','meaningful_work'],'policy'=>['version'=>1,'baseline'=>$traits,'adjustments'=>[],'beliefs'=>[]],
            'club_id'=>$club,'wire_account_id'=>$wire,'status'=>$club?'employed':'available','review_at'=>now()]);
    }
    public function player(OwnedPlayerCard $player):WorldAgent {
        $club=OnlineClub::where('user_id',$player->user_id)->first();
        if($existing=WorldAgent::where('source_key','player:'.$player->id)->first()){
            if($existing->club_id!==$club?->id)$existing->update(['club_id'=>$club?->id]);return $existing;
        }
        $wire=app(WireAccounts::class)->player($player);
        $profile=$player->world_profile??[];$stats=$profile['stats']??[];
        $agent=$this->identity('player:'.$player->id,'player',$player->id,$player->persona_name??'Circuit player','player',[
            'analysis'=>(float)($stats['iq']??20)/10,'coaching'=>(float)($stats['ldr']??20)/10,'development'=>(float)($stats['flx']??20)/10,'competition'=>array_sum($stats)/max(10,count($stats)*10)],$club?->id,$wire);
        if($agent->club_id!==$club?->id)$agent->update(['club_id'=>$club?->id]);
        if($club&&!DB::table('world_employments')->where('active_agent_id',$agent->id)->exists())$this->employ($agent,$club,'player','player-admission:'.$player->id,['arrangement'=>'Existing roster registration; no new wage or expiry imposed.'],$this->joinedAt($player,$club));
        return $agent;
    }
    public function joinedAt(OwnedPlayerCard $p,OnlineClub $club):\Carbon\CarbonInterface {
        $joined=\Carbon\Carbon::parse($p->created_at??now())->max($club->created_at??now());
        $auction=\App\Models\ClubAuction::where('card_id',$p->id)->where('status','sold')->where('bidder_id',$club->id)->latest('updated_at')->first();
        $trade=\App\Models\ClubTradeProposal::where('status','accepted')->where(fn($q)=>$q->where(fn($q)=>$q->where('recipient_id',$club->id)->whereJsonContains('offered_player_ids',$p->id))->orWhere(fn($q)=>$q->where('proposer_id',$club->id)->whereJsonContains('requested_player_ids',$p->id)))->latest('resolved_at')->first();
        if($auction)$joined=$joined->max($auction->updated_at);if($trade)$joined=$joined->max($trade->resolved_at);return $joined;
    }
    public function employ(WorldAgent $agent,OnlineClub $club,string $profession,string $source,array $terms,?\Carbon\CarbonInterface $startsAt=null):void {
        DB::transaction(function()use($agent,$club,$profession,$source,$terms,$startsAt){
        $agent=WorldAgent::whereKey($agent->id)->lockForUpdate()->firstOrFail();
        if(DB::table('world_employments')->where('source_key',$source)->exists())return;
        DB::table('world_employments')->where('active_agent_id',$agent->id)->update(['active_agent_id'=>null,'ends_at'=>now(),'end_reason'=>'moved']);
        DB::table('world_employments')->insert(['agent_id'=>$agent->id,'active_agent_id'=>$agent->id,'club_id'=>$club->id,'profession'=>$profession,'source_key'=>$source,'starts_at'=>$startsAt??now(),'terms'=>json_encode($terms)]);
        $agent->update(['club_id'=>$club->id,'profession'=>$profession,'status'=>'employed']);
        },3);
    }
    public function remember(WorldAgent $agent,string $cause,string $kind,string $outcome,array $facts,float $confidence=1,float $salience=.6,?string $subject=null,float $trust=0):void {
        DB::transaction(function()use($agent,$cause,$kind,$outcome,$facts,$confidence,$salience,$subject,$trust){
            $agent=WorldAgent::whereKey($agent->id)->lockForUpdate()->firstOrFail();
            if(!DB::table('world_agent_memories')->insertOrIgnore(['agent_id'=>$agent->id,'cause_key'=>$cause,'kind'=>$kind,'outcome'=>$outcome,'confidence'=>max(0,min(1,$confidence)),'salience'=>max(0,min(1,$salience)),'facts'=>json_encode($facts),'observed_at'=>now()]))return;
            if($subject){
                DB::table('world_agent_relationships')->insertOrIgnore(['agent_id'=>$agent->id,'subject_key'=>$subject,'updated_at'=>now()]);
                $r=DB::table('world_agent_relationships')->where('agent_id',$agent->id)->where('subject_key',$subject)->lockForUpdate()->first();
                DB::table('world_agent_relationships')->where('id',$r->id)->update(['trust'=>max(-1,min(1,(float)$r->trust+$trust)),'respect'=>max(-1,min(1,(float)$r->respect+$trust*.5)),'interactions'=>$r->interactions+1,'updated_at'=>now()]);
            }
            $policy=$agent->policy;$traits=$agent->traits;$baseline=$policy['baseline'];
            // A decision is evidence, not proof of optimality. Adapt at most .002 per observation,
            // and never beyond .12 from this person's versioned baseline.
            if(in_array($outcome,['accepted','rejected','completed','expired'])){
                $key=$outcome==='rejected'?'patience':'confidence';$delta=$outcome==='expired'?-.001:.002;
                $traits[$key]=max(.05,min(.95,max(($baseline[$key]??.5)-.12,min(($baseline[$key]??.5)+.12,($traits[$key]??.5)+$delta))));
                $policy['adjustments'][$key]=round($traits[$key]-($baseline[$key]??.5),4);
            }
            $beliefs=$policy['beliefs']??[];$beliefs[$kind]=['last_outcome'=>$outcome,'confidence'=>$confidence,'observed_at'=>now()->toIso8601String()];$policy['beliefs']=array_slice($beliefs,-12,null,true);
            $agent->update(['traits'=>$traits,'policy'=>$policy,'experience'=>$agent->experience+1]);
        });
    }
    public function context(WorldAgent $agent):array {
        return ['memories'=>DB::table('world_agent_memories')->where('agent_id',$agent->id)->orderByDesc('observed_at')->limit(12)->get(),
            'relationships'=>DB::table('world_agent_relationships')->where('agent_id',$agent->id)->orderByDesc('updated_at')->limit(12)->get()];
    }
    public function publicProfile(WorldAgent $agent):array {
        return ['id'=>$agent->id,'name'=>$agent->name,'profession'=>$agent->profession,'status'=>$agent->status,'club_id'=>$agent->club_id,'experience'=>$agent->experience,'reputation'=>$agent->policy['reputation']??null,
            'employment'=>DB::table('world_employments as e')->leftJoin('online_clubs as c','c.id','=','e.club_id')->where('e.agent_id',$agent->id)->orderByDesc('e.id')->limit(30)->get(['e.club_id','c.name as club','e.profession','e.starts_at','e.ends_at','e.end_reason'])];
    }
}
