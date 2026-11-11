<?php
namespace App\Services;

use App\Models\{OnlineClub,OwnedPlayerCard,WorldAgent,ClubTradeProposal};
use Illuminate\Support\Facades\DB;

/** Bounded careers/agreements stage inside the existing coordinator, never a per-agent job loop. */
class WorldBusinessEngine {
    public function tick(float $deadline):array {
        $out=['career_decisions'=>0,'career_admissions'=>0];if(!app(WorldAgents::class)->ready())return $out;
        foreach(DB::table('world_negotiations')->whereIn('status',['pending','countered'])->where('review_at','<=',now())->where('expires_at','>',now())->orderBy('expires_at')->orderBy('id')->limit(3)->get() as $n){
            if(microtime(true)>=$deadline)return $out;
            try{
                if($n->status==='pending')app(WorldCareerContracts::class)->evaluate($n->id);
                elseif($n->autonomous){
                    $club=OnlineClub::findOrFail($n->club_id);$counter=json_decode($n->counter,true);$market=app(ClubMarketService::class);
                    $safe=$market->balance($club->id)>=$counter['weekly_salary']*2+8*($market->weeklyWages($club)+$counter['weekly_salary']);
                    app(WorldCareerContracts::class)->respond($club,$n->id,$safe?'accept_counter':'withdraw',null,true,$n->management_epoch);
                }else DB::table('world_negotiations')->where('id',$n->id)->update(['review_at'=>$n->expires_at]);
                $out['career_decisions']++;
            }catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){
                if(!in_array($e->getStatusCode(),[404,409,422]))throw $e;
                DB::table('world_negotiations')->where('id',$n->id)->whereIn('status',['pending','countered'])->update(['status'=>'conditions_changed','resolved_at'=>now(),'updated_at'=>now()]);
            }
        }
        foreach(DB::table('world_delegations')->where('enabled',true)->where(fn($q)=>$q->whereNull('review_at')->orWhere('review_at','<=',now()))->orderBy('review_at')->orderBy('id')->limit(2)->pluck('id') as $id){
            if(microtime(true)>=$deadline)return $out;app(WorldDelegation::class)->review($id);$out['career_decisions']++;
        }
        foreach(DB::table('world_vacancies')->where('status','open')->where('expires_at','>',now())->where(fn($q)=>$q->whereNull('review_at')->orWhere('review_at','<=',now()))->orderBy('review_at')->orderBy('id')->limit(2)->get() as $v){
            if(microtime(true)>=$deadline)return $out;
            DB::table('world_vacancies')->where('id',$v->id)->update(['review_at'=>now()->addDay()]);$applicants=app(WorldCareers::class)->applications($v->id);
            if($v->autonomous&&$applicants&&!DB::table('world_negotiations')->where('vacancy_id',$v->id)->whereIn('status',['pending','countered','accepted'])->exists()){
                try{app(WorldCareerContracts::class)->offerStaff(OnlineClub::findOrFail($v->club_id),WorldAgent::findOrFail($applicants[0]['agent']['id']),$v->id,'vacancy:'.$v->id,true,$v->management_epoch);}
                catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){if(!in_array($e->getStatusCode(),[409,422]))throw $e;}
            }$out['career_decisions']++;
        }
        foreach(ClubTradeProposal::where('status','pending')->where('expires_at','>',now())->whereIn('recipient_id',OnlineClub::where('is_bot',true)->select('id'))->orderBy('expires_at')->limit(2)->get() as $trade){
            if(microtime(true)>=$deadline)return $out;
            $club=OnlineClub::findOrFail($trade->recipient_id);$comparison=$trade->comparison;
            // Publicly offered players/cash and this club's actual needs; no rival wallet access.
            $offer=(int)($comparison['offered_value']??0);$request=(int)($comparison['requested_value']??0);
            $profile=app(WorldManagerPolicy::class)->profile($club->id);$relative=($offer-$request)/max(1,$request);
            $accept=.6*$relative+.05*$profile['traits']['development']-.04*$profile['traits']['thrift'];
            $decline=.02*$profile['traits']['patience'];$action=$accept>=$decline?'accept':'decline';
            try{app(ClubMarketService::class)->respondToTrade($club,$trade->id,$action,(int)$trade->recipient_epoch);}
            catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){if(!in_array($e->getStatusCode(),[409,422]))throw $e;}
            $out['career_decisions']++;
        }
        foreach(WorldAgent::where('kind','player')->where('profession','player')->where('review_at','<=',now())->orderBy('review_at')->orderBy('id')->limit(2)->get() as $agent){
            if(microtime(true)>=$deadline)return $out;$this->reviewPerson($agent);$out['career_decisions']++;
        }
        if(microtime(true)<$deadline){
            $club=OnlineClub::where('is_bot',true)->where(fn($q)=>$q->whereNull('world_career_review_at')->orWhere('world_career_review_at','<=',now()))
                ->orderByRaw('CASE WHEN world_career_review_at IS NULL THEN 0 ELSE 1 END')->orderBy('world_career_review_at')->orderBy('id')->first();
            if($club){
                // One career office review, daily per club, fairly staggered across the world.
                DB::table('online_clubs')->where('id',$club->id)->where('is_bot',true)->update(['world_career_review_at'=>now()->addDay()]);
                app(WorldCareers::class)->reviewClub($club);
                try{
                    if(!DB::table('world_sponsor_deals')->where('club_id',$club->id)->where('created_at','>=',now()->subDays(28))->exists()){
                        $deal=app(WorldSponsorships::class)->offer($club,'review:'.now('UTC')->format('Y-m'),true,(int)$club->management_epoch);
                        app(WorldSponsorships::class)->respond($club,$deal,'accept',true,(int)$club->management_epoch);
                    }
                }catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){if(!in_array($e->getStatusCode(),[409,422]))throw $e;}
                $out['career_decisions']++;
            }
        }
        if(microtime(true)<$deadline)$out['career_admissions']=$this->admit($deadline);
        return $out;
    }
    public function admit(float $deadline):int {
        $cursor=(int)DB::table('living_world_runtime')->value('agent_cursor');$count=0;
        foreach(DB::table('world_wire_accounts')->where('id','>',$cursor)->orderBy('id')->limit(8)->get() as $a){
            if(microtime(true)>=$deadline)break;
            if($a->kind==='player'){
                if($p=OwnedPlayerCard::find($a->source_id))app(WorldAgents::class)->player($p);
            }elseif(in_array($a->kind,['talent','organizer'])){
                $p=json_decode($a->profile,true)??[];$skills=['analysis'=>6,'communication'=>6,'data_quality'=>6,'scouting'=>6];
                $profession=$a->role==='manager'?'general_manager':$a->role;
                if($a->role==='manager'&&!empty($p['club_id'])){
                    $club=OnlineClub::whereKey($p['club_id'])->where('is_bot',true)->first();
                    if($club)app(WorldAgents::class)->identity('manager-user:'.$club->user_id,'manager',(string)$club->user_id,$a->name,$profession,$skills,$club->id,$a->id);
                }else app(WorldAgents::class)->identity('wire:'.$a->source_key,$a->kind,$a->source_id,$a->name,$profession,$skills,$p['club_id']??null,$a->id);
            }
            DB::table('living_world_runtime')->where('id',1)->update(['agent_cursor'=>$a->id]);$count++;
        }return $count;
    }
    private function reviewPerson(WorldAgent $agent):void {
        $p=OwnedPlayerCard::withoutGlobalScopes()->find($agent->source_id);$agent->update(['review_at'=>now()->addWeek()]);if(!$p)return;
        if(!$p->retired_at){
            $catalog=app(OnlineService::class)->activeCatalog();$template=collect($catalog->payload['cards'])->firstWhere('id',$p->definition_id);$stats=app(WorldPlayerProfiles::class)->definition($p,$template)['stats']??[];
            if($stats)$agent->update(['skills'=>['analysis'=>($stats['iq']??20)/10,'coaching'=>($stats['ldr']??20)/10,'development'=>($stats['flx']??20)/10,'competition'=>array_sum($stats)/max(10,count($stats)*10)]]);
        }
        if($p->retired_at){
            foreach(['analyst','assistant_coach','head_coach'] as $role)if(app(WorldCareers::class)->qualified($agent,$role)){
                $agent->update(['profession'=>$role,'status'=>'available']);
                $agent->refresh();$agent->update(['wire_account_id'=>app(WireAccounts::class)->career($agent)]);
                app(WorldAgents::class)->remember($agent,'career-transition:'.$role,'career','completed',['profession'=>$role,'basis'=>'Retired player with relevant skills and verified match experience.'],1,.9);break;
            }return;
        }
        $club=OnlineClub::where('user_id',$p->user_id)->first();
        if(!$club){
            $age=\Carbon\Carbon::parse($p->world_profile['birth_date']??now())->diffInYears(now(),true);
            if($age>=38&&DB::table('world_free_agents')->where('player_id',$p->id)->where('status','available')->exists()){
                $policy=$agent->policy;if(empty($policy['retirement_notice_at'])){$policy['retirement_notice_at']=now()->toIso8601String();$agent->update(['policy'=>$policy]);}
                elseif(\Carbon\Carbon::parse($policy['retirement_notice_at'])->lte(now()->subDays(14)))app(WorldFreeAgency::class)->retire($p);
            }return;
        }
        $evidence=DB::table('club_player_match_ratings as r')->join('online_matches as m','m.id','=','r.match_id')->where('m.status','completed')->where('r.card_id',$p->id)->where('r.created_at','>=',now()->subDays(90))->orderByDesc('r.id')->limit(12)->get(['r.match_id','r.rating','r.won','r.created_at']);
        if($evidence->isNotEmpty()){
            $policy=$agent->policy;$policy['reputation']=['samples'=>$evidence->count(),'mean_rating'=>round($evidence->avg('rating'),2),'verified_wins'=>$evidence->where('won',true)->count()];$agent->update(['policy'=>$policy]);
            app(WorldAgents::class)->remember($agent,'match-observation:'.$evidence->first()->match_id,'match_experience','observed',['rating'=>(float)$evidence->first()->rating,'won'=>(bool)$evidence->first()->won],.9,.7);
        }
        $teamGames=DB::table('club_player_match_ratings as r')->join('online_matches as m','m.id','=','r.match_id')->where('m.status','completed')->where('r.club_id',$club->id)->where('r.created_at','>=',now()->subDays(30))->distinct()->count('r.match_id');
        $appearances=$evidence->filter(fn($e)=>\Carbon\Carbon::parse($e->created_at)->gte(now()->subDays(30)))->count();
        if($teamGames>=4 && $appearances/max(1,$teamGames)<.25 && ($agent->traits['ambition']??.5)>.45 && app(WorldAgents::class)->joinedAt($p,$club)->lte(now()->subDays(28))){
            $cause='playing-time:'.$p->id.':'.now()->format('Y-m');$policy=$agent->fresh()->policy;$policy['playing_time_concern']=['team_games'=>$teamGames,'appearances'=>$appearances,'observed_at'=>now()->toIso8601String()];$agent->update(['policy'=>$policy,'goals'=>['playing_time','develop','financial_security']]);
            app(WorldAgents::class)->remember($agent,$cause,'career_concern','requested',['team_games'=>$teamGames,'appearances'=>$appearances],.9,.8,'club:'.$club->id,-.02);
            app(ClubOffice::class)->notify($club->id,$cause,'staff','Player asks to discuss playing time',$agent->name.' has had limited involvement across recent verified team games and wants a career discussion. This is private correspondence, not a transfer announcement.',['type'=>'route','route'=>'squad?tab=staff']);
        }
        $age=\Carbon\Carbon::parse($p->world_profile['birth_date']??now()->toDateString())->diffInYears(now(),true);
        $utility=($age-30)/12+.12*(1-($agent->traits['ambition']??.5));
        if($age<32||$utility<.6)return;
        $policy=$agent->policy;
        if(empty($policy['retirement_notice_at'])){
            $policy['retirement_notice_at']=now()->toIso8601String();$agent->update(['policy'=>$policy]);
            app(ClubOffice::class)->notify($club->id,'retirement-notice:'.$p->id,'staff','Player retirement notice',$agent->name.' is considering retirement after fourteen days. Starting-five, fixture, contract and market commitments remain protected.',['type'=>'route','route'=>'squad?tab=staff']);
        }elseif(\Carbon\Carbon::parse($policy['retirement_notice_at'])->lte(now()->subDays(14))){
            try{app(WorldCareers::class)->retire($club,$p->id);}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){if(!in_array($e->getStatusCode(),[409,422]))throw $e;}
        }
    }
    public function obligations():array {
        if(!app(WorldAgents::class)->ready())return ['payments'=>0];
        $paid=app(WorldSponsorships::class)->settle();
        foreach(DB::table('club_staff_contracts')->whereIn('role',['general_manager','scout'])->where('status','active')->where('ends_at','<=',now())->orderBy('ends_at')->limit(30)->get() as $c){
            DB::transaction(function()use($c){$fresh=DB::table('club_staff_contracts')->where('id',$c->id)->where('status','active')->lockForUpdate()->first();if($fresh)app(StaffContracts::class)->endOffice($fresh,'expired');});
        }
        foreach(DB::table('world_negotiations')->whereIn('status',['pending','countered'])->where('expires_at','<=',now())->orderBy('expires_at')->limit(30)->pluck('id') as $id)app(WorldCareerContracts::class)->expire($id);
        DB::table('world_vacancies')->where('status','open')->where('expires_at','<=',now())->update(['status'=>'expired','open_key'=>null,'updated_at'=>now()]);
        DB::table('world_recommendations')->where('status','pending')->where('expires_at','<=',now())->update(['status'=>'expired','resolved_at'=>now(),'updated_at'=>now()]);
        foreach(DB::table('world_player_terms')->where('status','active')->where('ends_at','<=',now())->orderBy('ends_at')->limit(30)->get() as $t){
            if(DB::table('world_player_terms')->where('id',$t->id)->where('status','active')->update(['status'=>'rolling']))
                app(ClubOffice::class)->notify($t->club_id,'player-terms:'.$t->id.':rolling','staff','Player terms reached review date','The agreed minimum term has ended. The same wage continues on rolling terms; roster ownership is preserved. Review renewal or a legal departure.',['type'=>'route','route'=>'squad?tab=staff']);
        }
        return ['payments'=>$paid];
    }
}
