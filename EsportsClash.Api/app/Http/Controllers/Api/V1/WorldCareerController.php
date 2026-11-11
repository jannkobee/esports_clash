<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\{OnlineClub,OwnedPlayerCard,WorldAgent};
use App\Services\{OnlineService,WorldAgents,WorldCareers,WorldCareerContracts,WorldDelegation,WorldSponsorships};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorldCareerController extends Controller {
    private function club(Request $r):OnlineClub {
        abort_unless(app(WorldCareers::class)->ready(),503,'Career services are being upgraded.');
        $club=app(OnlineService::class)->provision($r->user());
        DB::table('online_clubs')->where('id',$club->id)->where(fn($q)=>$q->whereNull('manager_seen_at')->orWhere('manager_seen_at','<',now()->subMinutes(10)))->update(['manager_seen_at'=>now()]);
        return $club;
    }
    public function index(Request $r) {
        $club=$this->club($r);app(WorldCareers::class)->syncClub($club);
        $negotiations=DB::table('world_negotiations as n')->join('world_agents as a','a.id','=','n.agent_id')->where('n.club_id',$club->id)->orderByDesc('n.id')->limit(30)->get(['n.*','a.name'])->map(function($n){foreach(['offer','counter','evaluation'] as $k)$n->$k=$n->$k?json_decode($n->$k,true):null;$n->evaluation=$n->evaluation?array_intersect_key($n->evaluation,array_flip(['choice','reason','observations'])):null;return $n;});
        $vacancies=DB::table('world_vacancies')->where('club_id',$club->id)->where('status','open')->where('expires_at','>',now())->orderByDesc('id')->limit(5)->get()->map(fn($v)=>['id'=>$v->id,'role'=>$v->role,'weekly_salary'=>$v->weekly_salary,'weeks'=>$v->weeks,'expires_at'=>$v->expires_at,'applicants'=>app(WorldCareers::class)->applications($v->id)]);
        return ['data'=>['club_id'=>$club->id,'players'=>OwnedPlayerCard::where('user_id',$club->user_id)->orderBy('persona_name')->limit(30)->get()->map(function($p)use($club){$a=WorldAgent::where('source_key','player:'.$p->id)->first();return ['id'=>$p->id,'name'=>$p->persona_name,'weekly_salary'=>app(WorldCareerContracts::class)->salary($p),'agent_id'=>$a?->id,'retirement_notice_at'=>$a?->policy['retirement_notice_at']??null,'release_cost'=>app(\App\Services\WorldFreeAgency::class)->releaseCost($p),'starter'=>in_array($p->id,array_column($club->starters??[],'instance_id'),true)];}),
            'free_agents'=>DB::table('world_free_agents as f')->join('owned_player_cards as p','p.id','=','f.player_id')->where('f.status','available')->whereNull('p.retired_at')->orderBy('f.available_at')->limit(20)->get(['p.id','p.persona_name as name','f.available_at']),
            'negotiations'=>$negotiations,'vacancies'=>$vacancies,'roles'=>WorldCareers::ROLES,
            'terms'=>DB::table('world_player_terms')->where('club_id',$club->id)->orderByDesc('id')->limit(30)->get(),
            'office'=>DB::table('club_staff_contracts')->where('club_id',$club->id)->whereIn('role',['general_manager','scout'])->orderByDesc('id')->limit(15)->get(['id','name','role','weekly_salary','ends_at','status']),
            'sponsors'=>DB::table('world_sponsor_deals as d')->join('world_sponsors as s','s.id','=','d.sponsor_id')->where('d.club_id',$club->id)->orderByDesc('d.id')->limit(12)->get(['d.*','s.name']),
            'delegations'=>DB::table('world_delegations')->where('club_id',$club->id)->orderBy('scope')->get(),
            'recommendations'=>DB::table('world_recommendations')->where('club_id',$club->id)->orderByDesc('id')->limit(15)->get()->map(function($row){$row->proposal=json_decode($row->proposal,true);$row->diagnostics=json_decode($row->diagnostics,true);return $row;}),
            'spending'=>DB::table('world_delegated_spending')->where('club_id',$club->id)->where('created_at','>=',now('UTC')->startOfWeek())->select('scope')->selectRaw('SUM(amount) AS amount')->groupBy('scope')->get(),
            'rules'=>['currency'=>'PHP','amounts'=>'minor units','player_terms'=>'The agreed wage continues on rolling terms after the review date. Transfers require a legal market settlement; conditional consent alone never moves a player.','sponsorship'=>'Sponsor funds are reserved before an offer. Instalments are paid weekly. Termination returns unpaid escrow; earned payments are retained.','delegation'=>'Recommendations are the default. Automatic scouting or staff offers require an explicit weekly commitment limit. Human decisions and permission revocation take precedence.']]];
    }
    public function player(Request $r,string $id) {
        $club=$this->club($r);$v=$r->validate(['weekly_salary'=>'required|integer|min:1|max:10000000','weeks'=>'required|integer|min:4|max:52','playing_time'=>'required|in:starter,rotation,development','request_key'=>'required|string|min:4|max:100']);
        $n=app(WorldCareerContracts::class)->offerPlayer($club,OwnedPlayerCard::findOrFail($id),$v['weekly_salary'],$v['weeks'],$v['playing_time'],$v['request_key']);return response()->json(['data'=>['id'=>$n]],201);
    }
    public function search(Request $r) {
        $this->club($r);$v=$r->validate(['q'=>'required|string|min:2|max:80']);
        return ['data'=>OwnedPlayerCard::query()->leftJoin('online_clubs as c','c.user_id','=','owned_player_cards.user_id')->leftJoin('world_free_agents as f','f.player_id','=','owned_player_cards.id')->where(fn($q)=>$q->whereNotNull('c.id')->orWhere('f.status','available'))->whereRaw('LOWER(owned_player_cards.persona_name) LIKE ?',['%'.mb_strtolower($v['q']).'%'])->orderBy('owned_player_cards.persona_name')->limit(12)->select(['owned_player_cards.id','owned_player_cards.persona_name as name'])->selectRaw("COALESCE(c.name,'Free agent') AS club")->get()];
    }
    public function respond(Request $r,int $id) {
        $v=$r->validate(['action'=>'required|in:accept_counter,counter,withdraw','weekly_salary'=>'nullable|integer|min:1|max:10000000','weeks'=>'nullable|integer|min:4|max:52']);
        app(WorldCareerContracts::class)->respond($this->club($r),$id,$v['action'],$v);return response()->noContent();
    }
    public function vacancy(Request $r) {
        $v=$r->validate(['role'=>'required|string','weekly_salary'=>'required|integer|min:1000|max:10000000','weeks'=>'required|integer|min:4|max:26','minimum_skill'=>'required|integer|min:4|max:10']);
        $id=app(WorldCareers::class)->vacancy($this->club($r),$v['role'],$v['weekly_salary'],$v['weeks'],$v['minimum_skill']);return response()->json(['data'=>['id'=>$id]],201);
    }
    public function staff(Request $r,int $id) {
        $v=$r->validate(['agent_id'=>'required|uuid','request_key'=>'required|string|min:4|max:100']);
        $n=app(WorldCareerContracts::class)->offerStaff($this->club($r),WorldAgent::findOrFail($v['agent_id']),$id,$v['request_key']);return response()->json(['data'=>['id'=>$n]],201);
    }
    public function closeVacancy(Request $r,int $id){app(WorldCareers::class)->closeVacancy($this->club($r),$id);return response()->noContent();}
    public function sponsor(Request $r) {
        $v=$r->validate(['request_key'=>'required|string|min:4|max:100']);$id=app(WorldSponsorships::class)->offer($this->club($r),$v['request_key']);return response()->json(['data'=>['id'=>$id]],201);
    }
    public function sponsorResponse(Request $r,int $id) {
        $v=$r->validate(['action'=>'required|in:accept,decline,terminate']);app(WorldSponsorships::class)->respond($this->club($r),$id,$v['action']);return response()->noContent();
    }
    public function delegate(Request $r) {
        $v=$r->validate(['scope'=>'required|string','enabled'=>'required|boolean','automatic'=>'required|boolean','weekly_limit'=>'required|integer|min:0|max:100000000','inactive_days'=>'required|integer|min:0|max:365']);
        app(WorldDelegation::class)->configure($this->club($r),$v['scope'],$v['enabled'],$v['automatic'],$v['weekly_limit'],$v['inactive_days']);return response()->noContent();
    }
    public function recommendation(Request $r,int $id) {
        $v=$r->validate(['action'=>'required|in:approve,dismiss']);$club=$this->club($r);
        if($v['action']==='approve')app(WorldDelegation::class)->execute($club,$id);else app(WorldDelegation::class)->reject($club,$id);
        return response()->noContent();
    }
    public function retire(Request $r,string $id) {app(WorldCareers::class)->retire($this->club($r),$id);return response()->noContent();}
    public function release(Request $r,string $id){app(\App\Services\ClubMarketService::class)->releaseReserve($this->club($r),$id);return response()->noContent();}
    public function releaseOffice(Request $r,int $id) {app(\App\Services\StaffContracts::class)->releaseOffice($this->club($r),$id);return response()->noContent();}
    public function profile(string $id) {
        abort_unless(app(WorldCareers::class)->ready(),503);return ['data'=>app(WorldAgents::class)->publicProfile(WorldAgent::findOrFail($id))];
    }
}
