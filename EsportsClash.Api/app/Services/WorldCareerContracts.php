<?php
namespace App\Services;

use App\Models\{OnlineCatalog,OnlineClub,OwnedPlayerCard,WorldAgent};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Common, transactional human/bot offers. Opinions cannot call these action methods. */
class WorldCareerContracts {
    public function baseWage(OwnedPlayerCard $p):int {
        if(!empty($p->world_profile['wage'])&&app(WorldPlayerProfiles::class)->enabled())return max(0,(int)$p->world_profile['wage'])*100;
        $catalog=OnlineCatalog::find($p->catalog_id)??app(OnlineService::class)->activeCatalog();$template=collect($catalog->payload['cards'])->firstWhere('id',$p->definition_id)??['wage'=>45,'name'=>$p->persona_name];
        return max(0,(int)(app(WorldPlayerProfiles::class)->definition($p,$template)['wage']??45))*100;
    }
    public function salary(OwnedPlayerCard $p):int {
        $club=OnlineClub::where('user_id',$p->user_id)->value('id');
        return (int)(DB::table('world_player_terms')->where('active_player_id',$p->id)->where('club_id',$club)->value('weekly_salary')??$this->baseWage($p));
    }
    public function offerPlayer(OnlineClub $club,OwnedPlayerCard $p,int $salary,int $weeks,string $playingTime,string $request,bool $autonomous=false,?int $epoch=null):int {
        abort_unless($weeks>=4&&$weeks<=52&&$salary>=1&&$salary<=10000000&&in_array($playingTime,['starter','rotation','development']),422,'Choose valid salary, 4–52 weeks and a playing-time plan.');
        return DB::transaction(function()use($club,$p,$salary,$weeks,$playingTime,$request,$autonomous,$epoch){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();app(WorldCareers::class)->authority($club,$autonomous,$epoch);
            if($existing=DB::table('world_negotiations')->where('request_key','agreement:'.$club->id.':'.$request)->value('id'))return $existing;
            $p=OwnedPlayerCard::whereKey($p->id)->lockForUpdate()->firstOrFail();$agent=app(WorldAgents::class)->player($p);
            abort_if($salary<$this->baseWage($p),422,'Existing registered wages are protected.');
            $kind=$p->user_id===$club->user_id?'player_terms':'transfer_terms';
            if(DB::table('world_free_agents')->where('player_id',$p->id)->where('status','available')->exists())$kind='free_agent';
            $this->reserveCheck($club,$salary,$p,$kind==='free_agent');
            $this->represent($agent);
            return $this->create($club,$agent,$kind,['weekly_salary'=>$salary,'weeks'=>$weeks,'playing_time'=>$playingTime],$request,$autonomous,$p->id);
        },3);
    }
    public function offerStaff(OnlineClub $club,WorldAgent $agent,int $vacancyId,string $request,bool $autonomous=false,?int $epoch=null):int {
        return DB::transaction(function()use($club,$agent,$vacancyId,$request,$autonomous,$epoch){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();app(WorldCareers::class)->authority($club,$autonomous,$epoch);
            if($existing=DB::table('world_negotiations')->where('request_key','agreement:'.$club->id.':'.$request)->value('id'))return $existing;
            $v=DB::table('world_vacancies')->where('id',$vacancyId)->where('club_id',$club->id)->lockForUpdate()->first();
            abort_unless($v&&$v->status==='open'&&$v->expires_at>now(),409,'Vacancy has closed.');
            $agent=WorldAgent::whereKey($agent->id)->lockForUpdate()->firstOrFail();abort_unless(app(WorldCareers::class)->qualified($agent,$v->role),409,'Professional is unavailable or unqualified.');
            abort_if(array_sum($agent->skills)/max(1,count($agent->skills))<$v->minimum_skill,422,'The professional does not meet the published vacancy qualification.');
            return $this->create($club,$agent,'staff',['weekly_salary'=>(int)$v->weekly_salary,'weeks'=>$v->weeks,'role'=>$v->role,'playing_time'=>'professional'],$request,$autonomous,null,$v->id);
        },3);
    }
    private function create(OnlineClub $club,WorldAgent $agent,string $kind,array $offer,string $request,bool $autonomous,?string $player=null,?int $vacancy=null):int {
        abort_if(strlen($request)>110||strlen($request)<4,422,'A stable request identifier is required.');$key='agreement:'.$club->id.':'.$request;
        if($id=DB::table('world_negotiations')->where('request_key',$key)->value('id'))return $id;
        abort_if(DB::table('world_negotiations')->where('club_id',$club->id)->where('agent_id',$agent->id)->whereIn('status',['pending','countered'])->exists(),409,'An offer is already under consideration.');
        $id=DB::table('world_negotiations')->insertGetId(['request_key'=>$key,'kind'=>$kind,'club_id'=>$club->id,'agent_id'=>$agent->id,'player_id'=>$player,'vacancy_id'=>$vacancy,'offer'=>json_encode($offer),
            'status'=>'pending','management_epoch'=>$club->management_epoch,'autonomous'=>$autonomous,'review_at'=>now(),'expires_at'=>now()->addDays(3),'created_at'=>now(),'updated_at'=>now()]);
        app(WorldAgents::class)->remember($agent,'offer:'.$id,'negotiation','offered',['club_id'=>$club->id,'kind'=>$kind],1,.7);
        app(ClubOffice::class)->notify($club->id,'agreement:'.$id.':offered','staff','Contract offer submitted',$agent->name.' is considering the proposed terms. Negotiations stay private.',['type'=>'route','route'=>'squad?tab=staff']);
        return $id;
    }
    private function represent(WorldAgent $player):void {
        if(DB::table('world_representation')->where('player_agent_id',$player->id)->exists())return;
        $index=hexdec(substr(hash('sha256',$player->id),0,2))%12;
        $representative=app(WorldAgents::class)->identity('representative:'.$index,'representative',(string)$index,['Ari','Luca','Sena','Remy','Vera','Noa','Ilan','Asha','Rin','Tavi','Mika','Kian'][$index].' Accord','player_agent',['negotiation'=>5+$index%4,'analysis'=>5]);
        DB::table('world_representation')->insertOrIgnore(['player_agent_id'=>$player->id,'representative_id'=>$representative->id,'mandate'=>json_encode(['evaluate_offers'=>true,'protect_base_wage'=>true,'ownership_actions'=>false,'fees'=>0]),'starts_at'=>now()]);
    }
    public function evaluate(int $id):void {
        DB::transaction(function()use($id){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$n=DB::table('world_negotiations')->where('id',$id)->lockForUpdate()->first();if(!$n||$n->status!=='pending')return;
            $club=OnlineClub::whereKey($n->club_id)->lockForUpdate()->firstOrFail();
            if((int)$club->management_epoch!==$n->management_epoch || ($n->autonomous&&!$club->is_bot)){$this->close($n,'authority_changed');return;}
            if($n->expires_at<=now()){$this->close($n,'expired');return;}
            $agent=WorldAgent::whereKey($n->agent_id)->lockForUpdate()->firstOrFail();$offer=json_decode($n->offer,true);
            if($n->kind==='staff'&&!app(WorldCareers::class)->qualified($agent,$offer['role'])){$this->close($n,'unavailable');return;}
            $evaluation=$this->assess($agent,$club,$offer,$n->kind,$n->player_id);$choice=$evaluation['choice'];
            if($choice==='accept'){
                DB::table('world_negotiations')->where('id',$id)->update(['evaluation'=>json_encode($evaluation)]);
                try{DB::transaction(fn()=>$this->commit($n,$club,$agent,$offer));}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){if(!in_array($e->getStatusCode(),[409,422]))throw $e;$this->close($n,'conditions_changed',['reason'=>$e->getMessage()]);}
            }elseif($choice==='counter'&&$n->round<3){
                $counter=$offer;$counter['weekly_salary']=$evaluation['asking_salary'];
                DB::table('world_negotiations')->where('id',$id)->update(['status'=>'countered','counter'=>json_encode($counter),'evaluation'=>json_encode($evaluation),'round'=>$n->round+1,'updated_at'=>now()]);
                app(WorldAgents::class)->remember($agent,'counter:'.$id.':'.$n->round,'negotiation','countered',['club_id'=>$club->id,'reason'=>$evaluation['reason']],1,.6);
                app(ClubOffice::class)->notify($club->id,'agreement:'.$id.':counter:'.$n->round,'staff','Contract counteroffer',$agent->name.' proposed different terms. Review the salary and duration before accepting.',['type'=>'route','route'=>'squad?tab=staff']);
            }else{$this->close($n,'rejected',$evaluation);}
        },3);
    }
    public function assess(WorldAgent $agent,OnlineClub $club,array $offer,string $kind,?string $playerId=null):array {
        $t=$agent->traits;$existing=$kind==='staff'?app(WorldCareers::class)->askingSalary($agent):$this->salary(OwnedPlayerCard::findOrFail($playerId));
        $trust=(float)(DB::table('world_agent_relationships')->where('agent_id',$agent->id)->where('subject_key','club:'.$club->id)->value('trust')??0);
        $loyal=($agent->club_id===$club->id)?($t['loyalty']??.5):0;
        $representative=DB::table('world_representation as r')->join('world_agents as a','a.id','=','r.representative_id')->where('r.player_agent_id',$agent->id)->whereNull('r.ends_at')->value('a.skills');
        $skill=(json_decode($representative??'{}',true)['negotiation']??5);
        $asking=(int)ceil($existing*(1+.12*($t['ambition']??.5)+.12*($t['thrift']??.5)-.08*$loyal-.03*$trust+.01*max(0,$skill-5))/100)*100;
        $pay=min(1.5,$offer['weekly_salary']/max(1,$asking));$security=min(1,$offer['weeks']/26);
        $opportunity=$kind==='staff'?.6:match($offer['playing_time']){'starter'=>.9,'rotation'=>.65,default=>.35};
        // Only observable roster/tier and this person's actual past interactions enter beliefs.
        if($playerId&&$offer['playing_time']==='starter'&&count($club->starters??[])===5)$opportunity-=.15;
        $growth=(6-$club->tier)/5;
        $accept=.52*$pay+.14*$security+.14*$opportunity+.12*$growth+.08*$loyal+.05*$trust;
        // Explicit alternatives, continuous preferences and bounded confidence. No random odds.
        $counter=.60+.035*($t['patience']??.5)-.04*max(0,$pay-1);
        $reject=.40+.13*max(0,1-$pay)+.06*(1-($t['adaptability']??.5));
        $scores=['accept'=>$accept,'counter'=>$counter,'reject'=>$reject];arsort($scores);$choice=array_key_first($scores);
        return ['choice'=>$choice,'scores'=>array_map(fn($v)=>round($v,4),$scores),'asking_salary'=>$asking,'confidence'=>round(.6+.3*($t['confidence']??.5),3),
            'reason'=>$choice==='accept'?'Compensation, security and opportunity fit the career priorities.':($choice==='counter'?'A more secure compensation package would fit the career priorities.':'The opportunity does not offset the compensation or career cost.'),
            'observations'=>['salary_ratio'=>round($pay,3),'term_weeks'=>$offer['weeks'],'playing_time'=>$offer['playing_time'],'tier'=>$club->tier,'relationship_interactions'=>(int)(DB::table('world_agent_relationships')->where('agent_id',$agent->id)->where('subject_key','club:'.$club->id)->value('interactions')??0)]];
    }
    public function respond(OnlineClub $club,int $id,string $action,?array $terms=null,bool $autonomous=false,?int $epoch=null):void {
        abort_unless(in_array($action,['accept_counter','counter','withdraw']),422,'Choose accept counter, counter or withdraw.');
        DB::transaction(function()use($club,$id,$action,$terms,$autonomous,$epoch){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();app(WorldCareers::class)->authority($club,$autonomous,$epoch);
            $n=DB::table('world_negotiations')->where('id',$id)->where('club_id',$club->id)->lockForUpdate()->first();abort_unless($n,404);
            if(in_array($n->status,['accepted','withdrawn','expired','rejected','authority_changed']))return;
            abort_unless($n->management_epoch===$club->management_epoch,409,'Management authority changed.');
            if($n->expires_at<=now()){$this->close($n,'expired');return;}
            if($action==='withdraw'){$this->close($n,'withdrawn');return;}
            abort_unless($n->status==='countered',409,'Wait for the professional response.');
            if($action==='accept_counter'){$this->commit($n,$club,WorldAgent::whereKey($n->agent_id)->lockForUpdate()->firstOrFail(),json_decode($n->counter,true));return;}
            abort_if($n->round>=3,409,'The negotiation has reached its round limit.');
            $offer=json_decode($n->offer,true);$offer['weekly_salary']=(int)($terms['weekly_salary']??0);$offer['weeks']=(int)($terms['weeks']??0);
            abort_unless($offer['weekly_salary']>0&&$offer['weekly_salary']<=10000000&&$offer['weeks']>=4&&$offer['weeks']<=($n->kind==='staff'?26:52),422,'Counteroffer is outside the contract limits.');
            DB::table('world_negotiations')->where('id',$id)->update(['offer'=>json_encode($offer),'counter'=>null,'status'=>'pending','review_at'=>now(),'updated_at'=>now()]);
        },3);
    }
    private function commit(object $n,OnlineClub $club,WorldAgent $agent,array $offer):void {
        app(WorldDelegation::class)->guardAgreement($offer,$club);
        if($n->kind==='staff'){
            $vacancy=DB::table('world_vacancies')->where('id',$n->vacancy_id)->lockForUpdate()->first();abort_unless($vacancy&&$vacancy->status==='open'&&$vacancy->management_epoch===$club->management_epoch,409,'Vacancy authority changed.');
            $candidate=app(WorldCareers::class)->candidate($agent,$offer['role'],$offer['weekly_salary'],$offer['weeks']);
            app(StaffContracts::class)->hireProfessional($club,$agent,$candidate);
            DB::table('world_vacancies')->where('id',$vacancy->id)->update(['status'=>'filled','open_key'=>null,'updated_at'=>now()]);
            DB::table('world_applications')->where('vacancy_id',$vacancy->id)->update(['status'=>'closed']);
            DB::table('world_applications')->where('vacancy_id',$vacancy->id)->where('agent_id',$agent->id)->update(['status'=>'hired']);
        }else{
            $p=OwnedPlayerCard::whereKey($n->player_id)->lockForUpdate()->firstOrFail();abort_if($offer['weekly_salary']<$this->baseWage($p),422,'Registered base wages are protected.');
            $this->reserveCheck($club,$offer['weekly_salary'],$p,$n->kind==='free_agent');
            if($n->kind==='free_agent'){
                app(ClubMarketService::class)->signFreeAgent($club,$p,$offer['weekly_salary'],$n->id);$this->signPlayer($n,$club,$p,$offer);
            }elseif($n->kind==='player_terms'){
                abort_unless($p->user_id===$club->user_id,409,'Player ownership changed.');$this->signPlayer($n,$club,$p,$offer);
            }else{
                abort_if($p->user_id===$club->user_id,409,'The transfer opportunity changed.');
                // Conditional player consent is not a transfer and never bypasses auction/trade rules.
            }
        }
        DB::table('world_negotiations')->where('id',$n->id)->update(['status'=>'accepted','offer'=>json_encode($offer),'resolved_at'=>now(),'updated_at'=>now()]);
        app(WorldAgents::class)->remember($agent,'agreement:'.$n->id,'negotiation','accepted',['club_id'=>$club->id,'kind'=>$n->kind],1,.8,'club:'.$club->id,.04);
        app(ClubOffice::class)->notify($club->id,'agreement:'.$n->id.':accepted','staff','Contract terms agreed',$agent->name.' accepted the terms.'.($n->kind==='transfer_terms'?' Ownership still requires a legal completed transfer.':' The dated agreement is now in the contract record.'),['type'=>'route','route'=>'squad?tab=staff']);
        if($n->kind==='player_terms')app(WorldActivityService::class)->record('agreement:'.$n->id.':signed','club',$club,$club->name.' agreed player employment terms with '.$agent->name.'.',['player_id'=>$n->player_id]);
    }
    private function signPlayer(object $n,OnlineClub $club,OwnedPlayerCard $p,array $offer):void {
        DB::table('world_player_terms')->where('active_player_id',$p->id)->update(['active_player_id'=>null,'status'=>'superseded','ended_at'=>now()]);
        DB::table('world_player_terms')->insertOrIgnore(['player_id'=>$p->id,'active_player_id'=>$p->id,'club_id'=>$club->id,'negotiation_id'=>$n->id,'weekly_salary'=>$offer['weekly_salary'],'playing_time'=>$offer['playing_time'],'status'=>'active','starts_at'=>now(),'ends_at'=>now()->addWeeks($offer['weeks'])]);
    }
    private function reserveCheck(OnlineClub $club,int $salary,?OwnedPlayerCard $p=null,bool $signingFee=false):void {
        $market=app(ClubMarketService::class);$current=$market->weeklyWages($club);if($p&&$p->user_id===$club->user_id)$current-=$this->salary($p);
        abort_if($market->balance($club->id)<4*($current+$salary)+($signingFee?$salary:0),422,'Keep four weeks of payroll and any registration fee available for the proposed terms.');
    }
    private function close(object $n,string $status,array $evaluation=[]):void {
        DB::table('world_negotiations')->where('id',$n->id)->update(['status'=>$status,'evaluation'=>json_encode($evaluation),'resolved_at'=>now(),'updated_at'=>now()]);
        if($agent=WorldAgent::find($n->agent_id))app(WorldAgents::class)->remember($agent,'agreement-close:'.$n->id,'negotiation',$status,['club_id'=>$n->club_id],1,.5,'club:'.$n->club_id,$status==='rejected'?-.01:0);
    }
    public function consent(OwnedPlayerCard $p,OnlineClub $destination):bool {
        if(!app(WorldAgents::class)->ready())return true;
        $n=DB::table('world_negotiations')->where('kind','transfer_terms')->where('player_id',$p->id)->where('club_id',$destination->id)->where('status','accepted')->where('expires_at','>',now())->where('management_epoch',$destination->management_epoch)->exists();
        if($n)return true;
        $agent=app(WorldAgents::class)->player($p);
        $offer=['weekly_salary'=>$this->salary($p),'weeks'=>8,'playing_time'=>'rotation'];
        return $this->assess($agent,$destination,$offer,'transfer_terms',$p->id)['choice']==='accept';
    }
    public function acceptedTransferTerms(string $player,int $club):?int {
        return DB::table('world_negotiations')->where('kind','transfer_terms')->where('player_id',$player)->where('club_id',$club)->where('management_epoch',OnlineClub::whereKey($club)->value('management_epoch'))->where('status','accepted')->where('expires_at','>',now())->orderByDesc('id')->value('id');
    }
    public function moved(OwnedPlayerCard $p,?OnlineClub $from,OnlineClub $to,string $cause,?int $bindingAgreement=null):void {
        if(!app(WorldAgents::class)->ready())return;
        $previous=DB::table('world_player_terms')->where('active_player_id',$p->id)->first();
        DB::table('world_player_terms')->where('active_player_id',$p->id)->update(['active_player_id'=>null,'status'=>'transferred','ended_at'=>now()]);
        $agent=app(WorldAgents::class)->player($p);app(WorldAgents::class)->employ($agent,$to,'player','movement:'.$cause.':'.$p->id,['method'=>$cause]);
        $n=DB::table('world_negotiations')->where('kind','transfer_terms')->where('player_id',$p->id)->where('club_id',$to->id)->where('status','accepted')
            ->when($bindingAgreement,fn($q)=>$q->where('id',$bindingAgreement),fn($q)=>$q->where('expires_at','>',now()))->orderByDesc('id')->first();
        if($n)$this->signPlayer($n,$to,$p,json_decode($n->offer,true));
        elseif(!str_starts_with($cause,'free-agent:'))DB::table('world_player_terms')->insert(['player_id'=>$p->id,'active_player_id'=>$p->id,'club_id'=>$to->id,'weekly_salary'=>$previous?->weekly_salary??$this->baseWage($p),'playing_time'=>'rotation','status'=>'rolling','starts_at'=>now()]);
        app(WorldAgents::class)->remember($agent,'movement:'.$cause,'transfer','completed',['from'=>$from?->id,'to'=>$to->id],1,1,'club:'.$to->id,.04);
    }
    public function expire(int $id):void {
        DB::transaction(function()use($id){$n=DB::table('world_negotiations')->where('id',$id)->lockForUpdate()->first();if($n&&in_array($n->status,['pending','countered'])&&$n->expires_at<=now())$this->close($n,'expired');});
    }
    public function reconcileTakeover(int $club):void {
        foreach(WorldAgent::where('kind','manager')->where('club_id',$club)->where('status','employed')->get() as $old){
            DB::table('world_employments')->where('active_agent_id',$old->id)->update(['active_agent_id'=>null,'ends_at'=>now(),'end_reason'=>'human_takeover']);$old->update(['club_id'=>null,'status'=>'available']);
        }
        DB::table('world_negotiations')->where('club_id',$club)->where('autonomous',true)->whereIn('status',['pending','countered'])->update(['status'=>'authority_changed','resolved_at'=>now(),'updated_at'=>now()]);
        DB::table('world_vacancies')->where('club_id',$club)->where('autonomous',true)->where('status','open')->update(['status'=>'authority_changed','open_key'=>null,'updated_at'=>now()]);
        foreach(DB::table('world_delegations')->where('club_id',$club)->get() as $d)DB::table('world_permission_history')->insert(['club_id'=>$club,'changed_by'=>OnlineClub::whereKey($club)->value('user_id'),'scope'=>$d->scope,'previous'=>json_encode($d),'current'=>json_encode(['enabled'=>false,'automatic'=>false]),'reason'=>'human_takeover','created_at'=>now()]);
        DB::table('world_delegations')->where('club_id',$club)->update(['enabled'=>false,'automatic'=>false,'updated_at'=>now()]);
        DB::table('world_recommendations')->where('club_id',$club)->where('status','pending')->update(['status'=>'authority_changed','resolved_at'=>now(),'updated_at'=>now()]);
    }
    public function salaryDelta(OnlineClub $club,array $base,?\Carbon\CarbonInterface $from=null,?\Carbon\CarbonInterface $to=null):int {
        if(!app(WorldAgents::class)->ready())return 0;
        $q=DB::table('world_player_terms')->where('club_id',$club->id);
        if(!$from)return (int)$q->whereNotNull('active_player_id')->get()->sum(fn($t)=>isset($base[$t->player_id])?max(0,$t->weekly_salary-$base[$t->player_id]):0);
        $q->where('starts_at','<',$to)->where(fn($q)=>$q->whereNull('ended_at')->orWhere('ended_at','>',$from));$sum=0;
        foreach($q->get() as $t){
            $p=OwnedPlayerCard::withoutGlobalScopes()->find($t->player_id);if(!$p)continue;
            $seconds=max(0,min($to->timestamp,$t->ended_at?\Carbon\Carbon::parse($t->ended_at)->timestamp:$to->timestamp)-max($from->timestamp,\Carbon\Carbon::parse($t->starts_at)->timestamp));
            $sum+=(int)round(max(0,$t->weekly_salary-$this->baseWage($p))*$seconds/604800);
        }return $sum;
    }
    public function basePayrollAdjustment(OnlineClub $club,\Carbon\CarbonInterface $from,\Carbon\CarbonInterface $to):int {
        if(!app(WorldAgents::class)->ready())return 0;
        $currentPlayers=OwnedPlayerCard::where('user_id',$club->user_id)->get();$current=$currentPlayers->mapWithKeys(fn($p)=>[$p->id=>$this->baseWage($p)])->all();
        $known=DB::table('world_employments as e')->join('world_agents as a','a.id','=','e.agent_id')->where('e.club_id',$club->id)->where('e.profession','player')->where('a.kind','player')->whereIn('a.source_id',array_keys($current))->pluck('a.source_id')->flip()->all();$earned=0;
        $rows=DB::table('world_employments as e')->join('world_agents as a','a.id','=','e.agent_id')->where('e.club_id',$club->id)->where('e.profession','player')->where('a.kind','player')->where('e.starts_at','<',$to)->where(fn($q)=>$q->whereNull('e.ends_at')->orWhere('e.ends_at','>',$from))->get(['e.starts_at','e.ends_at','a.source_id']);
        foreach($rows as $r){$p=OwnedPlayerCard::withoutGlobalScopes()->find($r->source_id);if(!$p)continue;$known[$p->id]=true;
            $seconds=max(0,min($to->timestamp,$r->ends_at?\Carbon\Carbon::parse($r->ends_at)->timestamp:$to->timestamp)-max($from->timestamp,\Carbon\Carbon::parse($r->starts_at)->timestamp));$earned+=(int)round($this->baseWage($p)*$seconds/604800);
        }
        // Unobserved legacy memberships retain the existing payroll basis until admitted.
        foreach($currentPlayers as $p)if(!isset($known[$p->id])){
            $seconds=max(0,$to->timestamp-max($from->timestamp,$p->created_at?->timestamp??$from->timestamp));$earned+=(int)round($current[$p->id]*$seconds/604800);
        }
        return $earned-array_sum($current);
    }
}
