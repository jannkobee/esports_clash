<?php
namespace App\Services;
use App\Models\{OnlineCatalog,OnlineClub,OwnedPlayerCard,User,WorldAgent};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Canonical market extension; the registry account is not a club or a replacement bot. */
class WorldFreeAgency {
    public function releaseCost(OwnedPlayerCard $p):int {
        $salary=app(WorldCareerContracts::class)->salary($p);$term=DB::table('world_player_terms')->where('active_player_id',$p->id)->first();$remaining=0;
        if($term&&$term->status==='active'&&$term->ends_at&&\Carbon\Carbon::parse($term->ends_at)->isFuture())$remaining=(int)ceil($salary*(\Carbon\Carbon::parse($term->ends_at)->timestamp-now()->timestamp)/604800);
        return $salary*4+$remaining;
    }
    public function release(OnlineClub $club,string $playerId,bool $autonomous=false,?int $epoch=null):void {
        DB::transaction(function()use($club,$playerId,$autonomous,$epoch){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();app(WorldCareers::class)->authority($club,$autonomous,$epoch);
            $existing=DB::table('world_free_agents')->where('player_id',$playerId)->lockForUpdate()->first();if($existing&&$existing->status==='available'&&$existing->released_from===$club->id)return;
            $p=OwnedPlayerCard::whereKey($playerId)->where('user_id',$club->user_id)->lockForUpdate()->firstOrFail();app(ClubMarketService::class)->assertCareerRelease($club,[$p->id]);
            $salary=app(WorldCareerContracts::class)->salary($p);$cost=$this->releaseCost($p);$market=app(ClubMarketService::class);abort_if($market->balance($club->id)<$cost,422,'Pay the remaining minimum term and four weeks of separation compensation first.');
            $agent=app(WorldAgents::class)->player($p);
            $registry=DB::table('world_registry_accounts')->where('role','free_agency')->first();$custodian=$registry?User::findOrFail($registry->user_id):null;
            if(!$custodian){$custodian=User::create(['email'=>'free-agency-'.Str::uuid().'@registry.invalid','name'=>'Free-agent registration office','password'=>Str::random(64)]);DB::table('world_registry_accounts')->insert(['role'=>'free_agency','user_id'=>$custodian->id,'created_at'=>now()]);}
            abort_if(OnlineClub::where('user_id',$custodian->id)->exists(),409,'The registration office must not own a club.');
            $cause='player-release:'.$p->id.':'.Str::uuid();
            DB::table('club_money_entries')->insert(['club_id'=>$club->id,'amount'=>-$cost,'kind'=>'Player separation compensation','reference'=>$cause,'created_at'=>now()]);
            DB::table('world_player_terms')->where('active_player_id',$p->id)->update(['active_player_id'=>null,'status'=>'released','ended_at'=>now()]);
            DB::table('world_employments')->where('active_agent_id',$agent->id)->update(['active_agent_id'=>null,'ends_at'=>now(),'end_reason'=>'released']);
            DB::table('world_free_agents')->updateOrInsert(['player_id'=>$p->id],['released_from'=>$club->id,'previous_weekly_salary'=>$salary,'compensation'=>$cost,'status'=>'available','available_at'=>now(),'signed_at'=>null]);
            $p->update(['user_id'=>$custodian->id]);$agent->update(['club_id'=>null,'status'=>'available','review_at'=>now()]);
            if($agent->wire_account_id)app(WireAccounts::class)->player($p);
            app(WorldAgents::class)->remember($agent,$cause,'employment','released',['from'=>$club->id,'compensation'=>$cost,'reason'=>'Contractual paid departure; all minimum wages protected.'],1,.9,'club:'.$club->id,-.02);
            app(WorldActivityService::class)->record($cause,'transfer',$club,$agent->name.' left '.$club->name.' and became a free agent.',['player_id'=>$p->id,'seller_id'=>$club->id]);$club->increment('revision');
        },3);
    }
    public function sign(OnlineClub $club,OwnedPlayerCard $p,int $salary,int $agreement):void {
        // Called only from the common negotiated agreement transaction, under the catalog lock.
        $free=DB::table('world_free_agents')->where('player_id',$p->id)->where('status','available')->lockForUpdate()->first();abort_unless($free,409,'The player is no longer a free agent.');
        $n=DB::table('world_negotiations')->where('id',$agreement)->where('club_id',$club->id)->where('player_id',$p->id)->where('kind','free_agent')->first();abort_unless($n&&in_array($n->status,['pending','countered']),409,'Agreed player consent is required.');
        $market=app(ClubMarketService::class);abort_if($market->balance($club->id)<$salary+4*($market->weeklyWages($club)+$salary),422,'Keep four weeks of payroll after the one-week registration signing fee.');
        DB::table('club_money_entries')->insert(['club_id'=>$club->id,'amount'=>-$salary,'kind'=>'Free-agent signing fee','reference'=>'free-agent-agreement:'.$agreement,'created_at'=>now()]);
        $p->update(['user_id'=>$club->user_id]);DB::table('world_free_agents')->where('player_id',$p->id)->update(['status'=>'signed','signed_at'=>now()]);
        app(WorldCareerContracts::class)->moved($p,null,$club,'free-agent:'.$agreement);$club->increment('revision');
        app(WorldActivityService::class)->record('free-agent:'.$agreement.':signed','recruitment',$club,$club->name.' signed free agent '.$p->persona_name.'.',['player_id'=>$p->id,'buyer_id'=>$club->id]);
    }
    public function retire(OwnedPlayerCard $p):void {
        DB::transaction(function()use($p){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$free=DB::table('world_free_agents')->where('player_id',$p->id)->where('status','available')->lockForUpdate()->first();if(!$free)return;
            $p=OwnedPlayerCard::whereKey($p->id)->lockForUpdate()->firstOrFail();$agent=WorldAgent::where('source_key','player:'.$p->id)->lockForUpdate()->firstOrFail();
            $notice=$agent->policy['retirement_notice_at']??null;abort_unless($notice&&\Carbon\Carbon::parse($notice)->lte(now()->subDays(14)),409,'Retirement notice is not complete.');
            abort_unless(\Carbon\Carbon::parse($p->world_profile['birth_date']??now())->diffInYears(now(),true)>=32,422,'Retirement is not eligible.');
            $p->update(['retired_at'=>now()]);DB::table('world_free_agents')->where('player_id',$p->id)->update(['status'=>'retired']);$agent->update(['review_at'=>now(),'status'=>'available']);
            app(WorldAgents::class)->remember($agent,'free-agent-retirement:'.$p->id,'career','completed',['from'=>'free_agency'],1,.9);
            app(WorldActivityService::class)->record('free-agent-retirement:'.$p->id,'club',null,$agent->name.' retired from professional play.',['player_id'=>$p->id]);
        },3);
    }
}
