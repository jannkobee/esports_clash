<?php
namespace App\Services;

use App\Models\{ClubStaff,OnlineCatalog,OnlineClub,OwnedPlayerCard,WorldAgent};
use Illuminate\Support\Facades\{DB,Schema};

class WorldCareers {
    public const ROLES=['head_coach','assistant_coach','analyst','performance_coach','psychologist','general_manager','scout'];
    public function definitions():array {
        return app(ClubStaffService::class)->definitions()+[
            'general_manager'=>['title'=>'General manager','attributes'=>['planning','negotiation','leadership','financial_discipline']],
            'scout'=>['title'=>'Scout','attributes'=>['scouting','analysis','data_quality','judgement']]];
    }
    public function ready():bool{return app(WorldAgents::class)->ready();}
    public function authority(OnlineClub $club,bool $autonomous,?int $epoch=null):void {
        if($epoch!==null)abort_unless((int)$club->management_epoch===$epoch,409,'Management authority changed.');
        if($autonomous)abort_unless($club->is_bot&&app(LivingWorldEngine::class)->managementAllowed(),409,'Human management takes precedence.');
    }
    public function syncClub(OnlineClub $club):void {
        foreach(OwnedPlayerCard::where('user_id',$club->user_id)->orderBy('id')->limit(12)->get() as $p)app(WorldAgents::class)->player($p);
        foreach(ClubStaff::where('club_id',$club->id)->get() as $staff)$this->staffIdentity($staff);
        $manager=app(WorldAgents::class)->identity('manager-user:'.$club->user_id,'manager',(string)$club->user_id,$club->user->name,'general_manager',['negotiation'=>6,'planning'=>6],$club->id);
        if(!DB::table('world_employments')->where('active_agent_id',$manager->id)->exists())app(WorldAgents::class)->employ($manager,$club,'general_manager','management-admission:'.$club->id.':'.$club->user_id,['control'=>$club->is_bot?'bot':'human']);
        if(!$club->is_bot)$manager->update(['status'=>'human_controlled']);
    }
    public function staffIdentity(ClubStaff $staff):WorldAgent {
        $contract=$staff->contract_id?DB::table('club_staff_contracts')->find($staff->contract_id):null;
        $key=$contract?('candidate:'.$staff->club_id.':'.$contract->candidate_key):('founding-staff:'.$staff->id);
        $agent=$contract&&str_starts_with($contract->candidate_key,'agent:')?WorldAgent::findOrFail(substr($contract->candidate_key,6)):
            app(WorldAgents::class)->identity($key,'staff',(string)$staff->id,$staff->name,$staff->role,$staff->ratings,$staff->club_id);
        if(!DB::table('world_employments')->where('active_agent_id',$agent->id)->exists())app(WorldAgents::class)->employ($agent,OnlineClub::findOrFail($staff->club_id),$staff->role,
            $contract?'staff-contract:'.$contract->id:'staff-founding:'.$staff->id.':'.\Illuminate\Support\Str::uuid(),['contract_id'=>$contract?->id,'arrangement'=>$contract?'Paid staff':'Founding staff']);
        return $agent;
    }
    public function endStaff(ClubStaff $staff,string $reason):void {
        if(!$this->ready())return;
        $current=$this->staffIdentity($staff);
        $employment=DB::table('world_employments')->where('active_agent_id',$current->id)->first();
        if(!$employment)return;
        DB::table('world_employments')->where('id',$employment->id)->update(['active_agent_id'=>null,'ends_at'=>now(),'end_reason'=>$reason]);
        $agent=WorldAgent::findOrFail($employment->agent_id);$agent->update(['club_id'=>null,'status'=>'available','review_at'=>now()]);
        if($reason==='expired'){
            $games=DB::table('club_player_match_ratings')->where('club_id',$staff->club_id)->whereBetween('created_at',[$employment->starts_at,now()])->distinct()->count('match_id');
            if($games){$skills=$agent->skills;foreach($skills as $k=>$v)$skills[$k]=round(min(10,$v+min(.1,$games*.005)),4);$agent->update(['skills'=>$skills]);}
        }
        app(WorldAgents::class)->remember($agent,'staff-end:'.$employment->id,'employment',$reason,['club_id'=>$staff->club_id],1,.8,'club:'.$staff->club_id,$reason==='expired'?.02:-.03);
    }
    public function appointed(ClubStaff $staff,int $contractId,?WorldAgent $agent=null):void {
        if(!$this->ready())return;
        $agent??=$this->staffIdentity($staff);
        app(WorldAgents::class)->employ($agent,OnlineClub::findOrFail($staff->club_id),$staff->role,'staff-contract:'.$contractId,['contract_id'=>$contractId]);
        app(WorldAgents::class)->remember($agent,'appointment:'.$contractId,'employment','accepted',['club_id'=>$staff->club_id,'role'=>$staff->role],1,.9,'club:'.$staff->club_id,.04);
        $agent->refresh();$agent->update(['wire_account_id'=>app(WireAccounts::class)->career($agent)]);
    }
    public function seedProfessionals():void {
        // A finite founding job market, not a replenished target population. New entrants must
        // subsequently come from real career transitions or explicit owner admission.
        $names=['Sena Arden','Ilan Mora','Vera Jun','Kian Solis','Nara Vale','Tavi Reed','Asha Lin','Remy Hale'];
        $definitions=$this->definitions();
        foreach(self::ROLES as $role)foreach($names as $i=>$name){
            $key='professional:v1:'.$role.':'.$i;$skills=[];
            foreach($definitions[$role]['attributes'] as $attribute)$skills[$attribute]=4+6*app(WorldSocialMind::class)->noise($key.':'.$attribute);
            app(WorldAgents::class)->identity($key,'staff',$key,$name.' '.strtoupper(substr(hash('sha256',$role),0,2)),$role,$skills);
        }
    }
    public function qualified(WorldAgent $agent,string $role):bool {
        if(!in_array($role,self::ROLES,true)||$agent->status!=='available')return false;
        if($agent->wire_account_id){
            $wire=DB::table('world_wire_accounts')->find($agent->wire_account_id);
            if($wire?->kind==='talent'&&DB::table('fixture_talent_assignments as a')->join('club_fixtures as f','f.id','=','a.fixture_id')->where('a.talent_id',(int)$wire->source_id)->whereBetween('f.kickoff_at',[now(),now()->addWeeks(26)])->exists())return false;
        }
        if($agent->kind==='player'){
            $player=OwnedPlayerCard::withoutGlobalScopes()->find($agent->source_id);
            if(!$player?->retired_at || DB::table('club_player_match_ratings')->where('card_id',$player->id)->whereIn('match_id',DB::table('online_matches')->where('status','completed')->select('id'))->count()<10)return false;
        }
        $mean=array_sum($agent->skills)/max(1,count($agent->skills));
        if($agent->profession===$role)return $mean>=4;
        $threshold=match($role){'head_coach'=>7,'analyst'=>6,'assistant_coach'=>5.5,'general_manager'=>7,'scout'=>6,default=>8};
        // Career mobility requires relevant skills, not merely the highest global score.
        $relevant=match($role){'head_coach'=>$agent->skills['leadership']??$agent->skills['coaching']??(isset($agent->skills['meta_reading'],$agent->skills['data_quality'])?($agent->skills['meta_reading']+$agent->skills['data_quality'])/2-1:0),
            'analyst'=>$agent->skills['data_quality']??$agent->skills['analysis']??$agent->skills['meta_reading']??0,
            'assistant_coach'=>$agent->skills['communication']??$agent->skills['coaching']??($agent->skills['meta_reading']??0),
            'general_manager'=>$agent->skills['planning']??(isset($agent->skills['scouting'],$agent->skills['analysis'])?($agent->skills['scouting']+$agent->skills['analysis'])/2-1:0),
            'scout'=>$agent->skills['scouting']??$agent->skills['analysis']??0,default=>0};
        return $relevant>=$threshold && $agent->experience>=4;
    }
    public function vacancy(OnlineClub $club,string $role,int $salary,int $weeks,int $minimum=4,bool $autonomous=false,?int $epoch=null):int {
        abort_unless(in_array($role,self::ROLES,true)&&$salary>=1000&&$salary<=10000000&&$weeks>=4&&$weeks<=26&&$minimum>=4&&$minimum<=10,422,'Choose a staff role, a valid salary, 4–26 weeks and skill 4–10.');
        return DB::transaction(function()use($club,$role,$salary,$weeks,$minimum,$autonomous,$epoch){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();$this->authority($club,$autonomous,$epoch);
            $this->seedProfessionals();$key=$club->id.':'.$role;
            $existing=DB::table('world_vacancies')->where('open_key',$key)->first();
            if($existing&&$existing->expires_at>now()&&$existing->weekly_salary===$salary&&$existing->weeks===$weeks&&$existing->minimum_skill===$minimum)return $existing->id;
            if($existing)DB::table('world_negotiations')->where('vacancy_id',$existing->id)->whereIn('status',['pending','countered'])->update(['status'=>'withdrawn','resolved_at'=>now(),'updated_at'=>now()]);
            if($existing)DB::table('world_vacancies')->where('id',$existing->id)->update(['open_key'=>null,'status'=>'expired','updated_at'=>now()]);
            $market=app(ClubMarketService::class);abort_if($market->balance($club->id)<$salary*2+4*($market->weeklyWages($club)+$salary),422,'Keep four weeks of payroll and the signing fee available.');
            return DB::table('world_vacancies')->insertGetId(['club_id'=>$club->id,'role'=>$role,'open_key'=>$key,'weekly_salary'=>$salary,'weeks'=>$weeks,'minimum_skill'=>$minimum,'management_epoch'=>$club->management_epoch,'autonomous'=>$autonomous,'expires_at'=>now()->addDays(7),'review_at'=>now(),'created_at'=>now(),'updated_at'=>now()]);
        },3);
    }
    public function applications(int $vacancyId):array {
        $vacancy=DB::table('world_vacancies')->find($vacancyId);abort_unless($vacancy&&$vacancy->status==='open'&&$vacancy->expires_at>now(),409,'Vacancy is closed.');
        $club=OnlineClub::findOrFail($vacancy->club_id);$ranked=[];
        foreach(WorldAgent::where('status','available')->where(fn($q)=>$q->whereIn('profession',[$vacancy->role,'analyst','assistant_coach','scout'])->orWhere(fn($q)=>$q->where('profession','player')->whereIn('source_id',DB::table('owned_player_cards')->whereNotNull('retired_at')->selectRaw('CAST(id AS VARCHAR)'))))
            ->orderByRaw('CASE WHEN profession = ? THEN 0 ELSE 1 END',[$vacancy->role])->orderBy('review_at')->orderBy('id')->limit(24)->get() as $agent){
            if(!$this->qualified($agent,$vacancy->role))continue;
            $mean=array_sum($agent->skills)/max(1,count($agent->skills));if($mean<$vacancy->minimum_skill)continue;
            $expected=$this->askingSalary($agent);$pay=min(1.5,$vacancy->weekly_salary/max(1,$expected));$t=$agent->traits;
            $utility=.4*$pay+.25*($mean/10)+.15*(6-$club->tier)/5+.1*($t['ambition']??.5)+.1*($t['adaptability']??.5);
            $quality=(float)(\App\Models\ClubStaff::where('club_id',$club->id)->where('role','analyst')->first()?->ratings['data_quality']??4);
            $error=(app(WorldSocialMind::class)->noise('assessment:'.$club->id.':'.$agent->source_key.':'.$vacancy->id)-.5)*(10-$quality)*.25;
            $reasons=['salary_ratio'=>round($pay,3),'relevant_skill'=>round(max(1,min(10,$mean+$error)),2),'assessment_confidence'=>round(.4+.05*$quality,2),'tier'=>$club->tier,'fit'=>$agent->profession===$vacancy->role?'current profession':'qualified career move'];
            if($utility<.5)continue;
            $new=DB::table('world_applications')->insertOrIgnore(['vacancy_id'=>$vacancyId,'agent_id'=>$agent->id,'utility'=>$utility,'reasons'=>json_encode($reasons),'status'=>'applied','created_at'=>now()]);
            if($new)app(WorldAgents::class)->remember($agent,'application:'.$vacancyId,'employment','applied',['club_id'=>$club->id,'role'=>$vacancy->role],.9,.5);
            $ranked[]=['agent'=>app(WorldAgents::class)->publicProfile($agent),'utility'=>round($utility,4),'reasons'=>$reasons,'asking_salary'=>$expected];
        }
        usort($ranked,fn($a,$b)=>$b['utility']<=>$a['utility']);return $ranked;
    }
    public function askingSalary(WorldAgent $agent):int {
        $q=array_sum($agent->skills)/max(1,count($agent->skills));
        return (int)(round((80+12*$q*$q+25*pow(max(0,$q-6),3))/10)*1000);
    }
    public function closeVacancy(OnlineClub $club,int $id):void {
        DB::transaction(function()use($club,$id){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            $v=DB::table('world_vacancies')->where('id',$id)->where('club_id',$club->id)->lockForUpdate()->first();abort_unless($v,404);if($v->status!=='open')return;
            DB::table('world_vacancies')->where('id',$id)->update(['status'=>'withdrawn','open_key'=>null,'updated_at'=>now()]);
            DB::table('world_negotiations')->where('vacancy_id',$id)->whereIn('status',['pending','countered'])->update(['status'=>'withdrawn','resolved_at'=>now(),'updated_at'=>now()]);
        },3);
    }
    public function candidate(WorldAgent $agent,string $role,int $salary,int $weeks):array {
        abort_unless($this->qualified($agent,$role),409,'The professional is unavailable or lacks the required experience.');
        $attributes=$this->definitions()[$role]['attributes'];$ratings=[];
        foreach($attributes as $key)$ratings[$key]=round(max(1,min(10,$agent->skills[$key]??array_sum($agent->skills)/max(1,count($agent->skills)))));
        return ['id'=>'agent:'.$agent->id,'role'=>$role,'title'=>$this->definitions()[$role]['title'],'name'=>$agent->name,'attributes'=>$ratings,'weekly_salary'=>$salary,'signing_fee'=>$salary*2,'weeks'=>$weeks];
    }
    public function reviewClub(OnlineClub $club):void {
        if(!$this->ready())return;
        $this->syncClub($club);
        if(!$club->is_bot)return;
        $manager=WorldAgent::where('source_key','manager-user:'.$club->user_id)->firstOrFail();$market=app(ClubMarketService::class);$wages=$market->weeklyWages($club);$cover=$market->balance($club->id)/max(1,$wages);
        $cause='financial-review:'.$club->id.':'.now('UTC')->toDateString();
        if(!DB::table('world_agent_memories')->where('agent_id',$manager->id)->where('cause_key',$cause)->exists()){
            $policy=$manager->policy;$adjust=$policy['manager_adjustments']??[];
            $adjust['thrift']=max(-.1,min(.1,($adjust['thrift']??0)+($cover<4?.002:($cover>12?-.001:0))));$policy['manager_adjustments']=$adjust;$manager->update(['policy'=>$policy]);
            app(WorldAgents::class)->remember($manager,$cause,'financial_review','completed',['payroll_cover_weeks'=>round($cover,2),'basis'=>'Actual available ledger and current payroll; no opponent private data.'],.9,.7);
        }
        if(DB::table('world_vacancies')->where('club_id',$club->id)->where('status','open')->where('expires_at','>',now())->exists())return;
        if(DB::table('world_negotiations')->where('club_id',$club->id)->whereIn('status',['pending','countered'])->exists())return;
        $members=app(ClubStaffService::class)->roster($club);$profile=app(WorldManagerPolicy::class)->profile($club->id);$choices=[];
        $available=max(0,$market->balance($club->id)-8*$wages);$ceiling=(int)floor($available/10);
        $this->seedProfessionals();
        foreach($this->definitions() as $role=>$definition){
            $member=collect($members)->firstWhere('role',$role);
            if($member&&$member['contract_id'])continue;
            if(!$member&&DB::table('club_staff_contracts')->where('club_id',$club->id)->where('role',$role)->where('status','active')->where('ends_at','>',now())->exists())continue;
            $current=$member?array_sum($member['attributes'])/4:5.5;
            foreach(WorldAgent::where('status','available')->where('profession',$role)->orderBy('id')->limit(8)->get() as $candidate){
                $quality=array_sum($candidate->skills)/max(1,count($candidate->skills));$salary=$this->askingSalary($candidate);
                if($quality<$current+.5||$salary>$ceiling)continue;
                $fit=match($role){'performance_coach','scout'=>$profile['traits']['development'],'general_manager'=>$profile['traits']['thrift'],'psychologist','assistant_coach'=>$profile['traits']['patience'],default=>$profile['traits']['ambition']};
                $score=.6*($quality-$current)/10+.4*$fit-.3*$salary*10/max(1,$available)*$profile['traits']['thrift'];
                $choices[]=['role'=>$role,'salary'=>$salary,'quality'=>$quality,'score'=>$score];
            }
        }
        usort($choices,fn($a,$b)=>$b['score']<=>$a['score']);
        if(!$choices||$choices[0]['score']<.03+.03*$profile['traits']['patience'])return;
        $choice=$choices[0];
        try{
            $id=$this->vacancy($club,$choice['role'],$choice['salary'],8,max(4,(int)floor($choice['quality'])),true,(int)$club->management_epoch);
            $applicants=$this->applications($id);if($applicants)app(WorldCareerContracts::class)->offerStaff($club,WorldAgent::findOrFail($applicants[0]['agent']['id']),$id,'vacancy:'.$id,true,(int)$club->management_epoch);
        }catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){if(!in_array($e->getStatusCode(),[409,422]))throw $e;}
    }

    public function retire(OnlineClub $club,string $playerId):void {
        DB::transaction(function()use($club,$playerId){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            abort_unless(app(WorldPlayerProfiles::class)->enabled(),409,'Retirement requires the active world-player profile rules.');
            $player=OwnedPlayerCard::whereKey($playerId)->where('user_id',$club->user_id)->lockForUpdate()->firstOrFail();
            $age=\Carbon\Carbon::parse($player->world_profile['birth_date']??now()->toDateString())->diffInYears(now(),true);
            abort_unless($age>=32,422,'The player has not reached a retirement decision.');
            app(ClubMarketService::class)->assertCareerRelease($club,[$playerId]);
            $agent=app(WorldAgents::class)->player($player);$notice=$agent->policy['retirement_notice_at']??null;
            abort_if(DB::table('world_player_terms')->where('active_player_id',$playerId)->where('status','active')->where('ends_at','>',now())->exists(),409,'Complete the agreed minimum employment term before retirement.');
            abort_unless($notice&&\Carbon\Carbon::parse($notice)->lte(now()->subDays(14)),409,'The player must first give fourteen days of retirement notice.');
            $player->update(['retired_at'=>now()]);
            DB::table('world_player_terms')->where('active_player_id',$playerId)->update(['active_player_id'=>null,'status'=>'retired','ended_at'=>now()]);
            DB::table('world_employments')->where('active_agent_id',$agent->id)->update(['active_agent_id'=>null,'ends_at'=>now(),'end_reason'=>'retired']);
            $agent->update(['club_id'=>null,'status'=>'available','review_at'=>now()]);
            app(WorldAgents::class)->remember($agent,'retired:'.$playerId,'career','completed',['club_id'=>$club->id],1,1,'club:'.$club->id,.03);
            app(WorldActivityService::class)->record('career:'.$playerId.':retired','club',$club,$agent->name.' retired from the active player roster.',['player_id'=>$playerId]);
        },3);
    }
}
