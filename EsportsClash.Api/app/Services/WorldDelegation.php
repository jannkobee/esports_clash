<?php
namespace App\Services;

use App\Models\{OnlineCatalog,OnlineClub};
use Illuminate\Support\Facades\DB;

class WorldDelegation {
    public const SCOPES=['scouting','training','analysis','contracts','staff','finance'];
    public function configure(OnlineClub $club,string $scope,bool $enabled,bool $automatic,int $limit,int $inactiveDays):void {
        abort_unless(in_array($scope,self::SCOPES)&&$limit>=0&&$limit<=100000000&&($inactiveDays===0||($inactiveDays>=7&&$inactiveDays<=365)),422,'Choose a valid scope, weekly limit and optional 7–365 day caretaker delay.');
        abort_if($automatic&&!in_array($scope,['scouting','staff','finance']),422,'This responsibility supports recommendations only.');
        DB::transaction(function()use($club,$scope,$enabled,$automatic,$limit,$inactiveDays){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            $previous=DB::table('world_delegations')->where('club_id',$club->id)->where('scope',$scope)->first();$current=['enabled'=>$enabled,'automatic'=>$automatic,'weekly_limit'=>$limit,'inactive_days'=>$inactiveDays,'management_epoch'=>$club->management_epoch];
            DB::table('world_permission_history')->insert(['club_id'=>$club->id,'changed_by'=>$club->user_id,'scope'=>$scope,'previous'=>$previous?json_encode($previous):null,'current'=>json_encode($current),'reason'=>'manager_configuration','created_at'=>now()]);
            DB::table('world_delegations')->updateOrInsert(['club_id'=>$club->id,'scope'=>$scope],$current+['review_at'=>now(),'created_at'=>$previous?->created_at??now(),'updated_at'=>now()]);
            if(!$enabled)DB::table('world_recommendations')->where('club_id',$club->id)->where('scope',$scope)->where('status','pending')->update(['status'=>'revoked','resolved_at'=>now(),'updated_at'=>now()]);
        },3);
    }
    public function review(int $delegationId):void {
        $d=DB::table('world_delegations')->find($delegationId);if(!$d||!$d->enabled)return;
        $club=OnlineClub::findOrFail($d->club_id);
        DB::table('world_delegations')->where('id',$d->id)->update(['review_at'=>now()->addDay()]);
        if($club->is_bot||$club->management_epoch!==$d->management_epoch)return;
        if($d->inactive_days&&(!$club->manager_seen_at||\Carbon\Carbon::parse($club->manager_seen_at)->gt(now()->subDays($d->inactive_days))))return;
        $week=now('UTC')->format('o-W');$key='delegation:'.$d->id.':'.$week;
        if(DB::table('world_recommendations')->where('cause_key',$key)->exists())return;
        $proposal=[];$cost=0;$action='advice';$diagnostics=[];
        if($d->scope==='finance'){
            $market=app(ClubMarketService::class);$runway=$market->balance($club->id)/max(1,$market->weeklyWages($club));
            if($club->academy_opened_at&&$runway<16){$action='close_academy';$proposal=['academy'=>false];$diagnostics=['reason'=>'Available funds cover fewer than sixteen weeks of current payroll. Closing the optional academy stops future coach costs; earned wages and player ownership stay intact.','payroll_cover_weeks'=>round($runway,2)];}
            else{$diagnostics=['reason'=>'Keep monitoring available cash, payroll cover and the optional academy. No cost-cutting action is currently needed.','payroll_cover_weeks'=>round($runway,2)];}
        }
        elseif($d->scope==='scouting'){$action='scout';$cost=ClubMarketService::SCOUT_COST;$proposal=['academy'=>false];$diagnostics=['reason'=>'The scouting department can use the existing weekly recruitment channel.','cost'=>$cost];}
        elseif($d->scope==='staff'){
            $staff=app(ClubStaffService::class)->roster($club);usort($staff,fn($a,$b)=>array_sum($a['attributes'])<=>array_sum($b['attributes']));
            $action='vacancy';$salary=100000;$proposal=['role'=>$staff[0]['role'],'weekly_salary'=>$salary,'weeks'=>8,'minimum_skill'=>min(10,max(4,(int)ceil(array_sum($staff[0]['attributes'])/4)))];$cost=$salary*10;
            $diagnostics=['reason'=>'Consider applicants for the currently lowest-rated staff responsibility. Existing staff remain until a legal signed appointment.','estimated_commitment'=>$cost];
        }else{
            $games=DB::table('club_player_match_ratings')->where('club_id',$club->id)->orderByDesc('id')->limit(15)->get(['card_id','rating','won','created_at']);
            $diagnostics=['reason'=>match($d->scope){'analysis'=>'Compare the recent verified performance record before adjusting match preparation.','training'=>'Review recent development observations and role coverage. Training rules remain unchanged.',default=>'Review compensation and promised playing time before making a retention offer.'},'verified_samples'=>$games->count(),'mean_rating'=>$games->isEmpty()?null:round($games->avg('rating'),2)];
            $proposal=['player_ids'=>$games->pluck('card_id')->unique()->values()->all()];
        }
        $id=DB::table('world_recommendations')->insertGetId(['club_id'=>$club->id,'cause_key'=>$key,'scope'=>$d->scope,'action'=>$action,'proposal'=>json_encode($proposal),'diagnostics'=>json_encode($diagnostics),'status'=>'pending','management_epoch'=>$club->management_epoch,'club_revision'=>$club->revision,'commitment_cost'=>$cost,'expires_at'=>now()->addDays(7),'created_at'=>now(),'updated_at'=>now()]);
        if($d->automatic){try{$this->execute($club,$id,true);}catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){if(!in_array($e->getStatusCode(),[409,422]))throw $e;}}
        app(ClubOffice::class)->notify($club->id,'recommendation:'.$id,'staff','Staff recommendation',$diagnostics['reason'],['type'=>'route','route'=>'squad?tab=staff']);
    }
    public function execute(OnlineClub $club,int $id,bool $automatic=false):void {
        DB::transaction(function()use($club,$id,$automatic){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            $r=DB::table('world_recommendations')->where('id',$id)->where('club_id',$club->id)->lockForUpdate()->first();abort_unless($r,404);if($r->status!=='pending')return;
            abort_unless($r->management_epoch===$club->management_epoch&&$r->club_revision===$club->revision&&$r->expires_at>now(),409,'Club decisions changed or the recommendation expired. Request a fresh review.');
            if($automatic){
                $d=DB::table('world_delegations')->where('club_id',$club->id)->where('scope',$r->scope)->lockForUpdate()->first();abort_unless($d&&$d->enabled&&$d->automatic&&$d->management_epoch===$club->management_epoch,409,'Permission was revoked.');
                if($d->inactive_days)abort_unless($club->manager_seen_at&&\Carbon\Carbon::parse($club->manager_seen_at)->lte(now()->subDays($d->inactive_days)),409,'Caretaker permission is not active.');
                $spent=(int)DB::table('world_delegated_spending')->where('club_id',$club->id)->where('scope',$r->scope)->where('created_at','>=',now('UTC')->startOfWeek())->sum('amount');
                abort_if($spent+$r->commitment_cost>$d->weekly_limit,422,'The weekly authorization limit would be exceeded.');
            }
            $p=json_decode($r->proposal,true);
            if($r->action==='scout')app(ClubMarketService::class)->scout($club,false);
            elseif($r->action==='close_academy')app(ClubMarketService::class)->setAcademy($club,false);
            elseif($r->action==='vacancy'){
                $v=app(WorldCareers::class)->vacancy($club,$p['role'],$p['weekly_salary'],$p['weeks'],$p['minimum_skill']);
                $applicants=app(WorldCareers::class)->applications($v);
                if($applicants){$n=app(WorldCareerContracts::class)->offerStaff($club,\App\Models\WorldAgent::findOrFail($applicants[0]['agent']['id']),$v,'recommendation:'.$id);
                    $offer=json_decode(DB::table('world_negotiations')->where('id',$n)->value('offer'),true);$offer['recommendation_id']=$id;
                    DB::table('world_negotiations')->where('id',$n)->update(['offer'=>json_encode($offer)]);
                }
            }
            DB::table('world_delegated_spending')->insertOrIgnore(['club_id'=>$club->id,'recommendation_id'=>$id,'scope'=>$r->scope,'amount'=>$r->commitment_cost,'created_at'=>now()]);
            DB::table('world_recommendations')->where('id',$id)->update(['status'=>$automatic?'delegated':'approved','resolved_at'=>now(),'updated_at'=>now()]);
        },3);
    }
    public function guardAgreement(array $offer,OnlineClub $club):void {
        if(empty($offer['recommendation_id']))return;
        $r=DB::table('world_recommendations')->where('id',$offer['recommendation_id'])->where('club_id',$club->id)->first();abort_unless($r&&$r->management_epoch===$club->management_epoch&&$r->club_revision===$club->revision,409,'Delegated authority or club decisions changed.');
        if($r->status==='approved')return; // Concrete human approval remains authoritative.
        $d=DB::table('world_delegations')->where('club_id',$club->id)->where('scope',$r->scope)->first();
        abort_unless($r->status==='delegated'&&$d&&$d->enabled&&$d->automatic&&$d->management_epoch===$club->management_epoch,409,'Delegated permission was revoked.');
        if($d->inactive_days)abort_unless($club->manager_seen_at&&$club->manager_seen_at->lte(now()->subDays($d->inactive_days)),409,'The manager has returned; caretaker authority is paused.');
    }
    public function reject(OnlineClub $club,int $id):void {
        DB::table('world_recommendations')->where('club_id',$club->id)->where('id',$id)->where('status','pending')->update(['status'=>'dismissed','resolved_at'=>now(),'updated_at'=>now()]);
    }
}
