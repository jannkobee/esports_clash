<?php
namespace App\Services;

use App\Models\{OnlineCatalog,OnlineClub};
use Illuminate\Support\Facades\DB;

/** Finite sponsor capital -> escrow -> canonical club/organizer ledgers. No daily money mint. */
class WorldSponsorships {
    public function install():void {
        foreach([['relay-foundation','Relay Foundation','development'],['switchboard','Switchboard Systems','competition'],['lantern-travel','Lantern Travel','regional']] as [$slug,$name,$objective]){
            DB::table('world_sponsors')->insertOrIgnore(['slug'=>$slug,'name'=>$name,'objective'=>$objective,'preferences'=>json_encode(['term_weeks'=>4,'initial_capital'=>8000000]),'created_at'=>now(),'updated_at'=>now()]);
            $id=DB::table('world_sponsors')->where('slug',$slug)->value('id');
            DB::table('world_sponsor_entries')->insertOrIgnore(['sponsor_id'=>$id,'reference'=>'sponsor:'.$slug.':founding-capital-v1','kind'=>'Finite founding capital','amount'=>8000000,'created_at'=>now()]);
        }
    }
    public function balance(int $id):int {return (int)DB::table('world_sponsor_entries')->where('sponsor_id',$id)->sum('amount');}
    public function assess(OnlineClub $club,object $sponsor):array {
        $games=DB::table('club_player_match_ratings')->where('club_id',$club->id)->whereIn('match_id',DB::table('online_matches')->where('status','completed')->select('id'))->where('created_at','>=',now()->subDays(90))->distinct()->count('match_id');
        $fixtures=DB::table('club_fixtures')->where(fn($q)=>$q->where('home_club_id',$club->id)->orWhere('away_club_id',$club->id))->whereNull('hold_reason')->whereBetween('kickoff_at',[now(),now()->addDays(60)])->count();
        $young=0;$roster=\App\Models\OwnedPlayerCard::where('user_id',$club->user_id)->limit(20)->get();
        foreach($roster as $p)if(!empty($p->world_profile['birth_date'])&&\Carbon\Carbon::parse($p->world_profile['birth_date'])->diffInYears(now(),true)<=22)$young++;
        $exposure=min(1,($games+$fixtures)/8);$fit=match($sponsor->objective){'development'=>$young/max(1,$roster->count()),'competition'=>(6-$club->tier)/5,'regional'=>$club->geography_id?1:.2};
        $utility=.6*$exposure+.4*$fit;
        return ['utility'=>round($utility,4),'verified_games_90d'=>$games,'published_fixtures_60d'=>$fixtures,'objective'=>$sponsor->objective,'fit'=>round($fit,3),'weekly_amount'=>(int)(10000+40000*$utility),'weeks'=>4];
    }
    public function offer(OnlineClub $club,string $request,bool $autonomous=false,?int $epoch=null):int {
        return DB::transaction(function()use($club,$request,$autonomous,$epoch){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();app(WorldCareers::class)->authority($club,$autonomous,$epoch);
            $this->install();$key='sponsor:'.$club->id.':'.$request;
            if($id=DB::table('world_sponsor_deals')->where('request_key',$key)->value('id'))return $id;
            abort_if(DB::table('world_sponsor_deals')->where('active_club_key',(string)$club->id)->exists(),409,'Review or complete the current sponsorship first.');
            $choices=[];
            foreach(DB::table('world_sponsors')->orderBy('id')->lockForUpdate()->get() as $s){$a=$this->assess($club,$s);$cost=$a['weekly_amount']*$a['weeks'];if(($a['verified_games_90d']+$a['published_fixtures_60d'])>0&&$a['utility']>=.3&&$this->balance($s->id)>=$cost)$choices[]=['sponsor'=>$s,'assessment'=>$a,'cost'=>$cost];}
            usort($choices,fn($a,$b)=>$b['assessment']['utility']<=>$a['assessment']['utility']);abort_unless($choices,409,'No funded sponsor sees sufficient published competitive exposure yet.');
            $choice=$choices[0];$s=$choice['sponsor'];$a=$choice['assessment'];
            $id=DB::table('world_sponsor_deals')->insertGetId(['sponsor_id'=>$s->id,'club_id'=>$club->id,'active_club_key'=>(string)$club->id,'request_key'=>$key,'status'=>'offered','management_epoch'=>$club->management_epoch,'autonomous'=>$autonomous,
                'weekly_amount'=>$a['weekly_amount'],'weeks'=>4,'assessment'=>json_encode($a),'reserved_amount'=>$choice['cost'],'expires_at'=>now()->addDays(3),'created_at'=>now(),'updated_at'=>now()]);
            DB::table('world_sponsor_entries')->insert(['sponsor_id'=>$s->id,'reference'=>'deal:'.$id.':escrow','kind'=>'Reserved sponsorship','amount'=>-$choice['cost'],'created_at'=>now()]);
            app(ClubOffice::class)->notify($club->id,'sponsor:'.$id.':offered','finance','Funded sponsorship offer',$s->name.' has reserved a four-week sponsorship. Review the funded amount and terms before accepting.',['type'=>'route','route'=>'squad?tab=staff']);
            return $id;
        },3);
    }
    public function respond(OnlineClub $club,int $id,string $action,bool $autonomous=false,?int $epoch=null):void {
        abort_unless(in_array($action,['accept','decline','terminate']),422);
        DB::transaction(function()use($club,$id,$action,$autonomous,$epoch){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();app(WorldCareers::class)->authority($club,$autonomous,$epoch);
            $deal=DB::table('world_sponsor_deals')->where('id',$id)->where('club_id',$club->id)->lockForUpdate()->first();abort_unless($deal,404);
            if(in_array($deal->status,['declined','terminated','expired','completed']))return;
            if($action==='terminate'){abort_unless($deal->status==='active',409);$this->refund($deal,'terminated');return;}
            abort_unless($deal->status==='offered',409,'The offer has already been resolved.');
            if($deal->expires_at<=now()){$this->refund($deal,'expired');return;}
            // Human owners can deliberately adopt an inherited offer, but no stale bot may do so.
            if($autonomous)abort_unless($deal->management_epoch===$club->management_epoch,409,'Management authority changed.');
            if($action==='decline'){$this->refund($deal,'declined');return;}
            DB::table('world_sponsor_deals')->where('id',$id)->update(['status'=>'active','management_epoch'=>$club->management_epoch,'autonomous'=>$autonomous,'starts_at'=>now(),'ends_at'=>now()->addWeeks($deal->weeks),'next_payment_at'=>now()->addWeek(),'updated_at'=>now()]);
            $s=DB::table('world_sponsors')->find($deal->sponsor_id);
            app(WorldActivityService::class)->record('sponsor:'.$id.':signed','club',$club,$club->name.' signed a funded four-week partnership with '.$s->name.'.',['team_id'=>$club->id]);
        },3);
    }
    private function refund(object $deal,string $status):void {
        DB::table('world_sponsor_entries')->insertOrIgnore(['sponsor_id'=>$deal->sponsor_id,'reference'=>'deal:'.$deal->id.':refund','kind'=>'Unearned escrow returned','amount'=>max(0,$deal->reserved_amount-$deal->paid_amount),'created_at'=>now()]);
        DB::table('world_sponsor_deals')->where('id',$deal->id)->update(['status'=>$status,'active_club_key'=>null,'next_payment_at'=>null,'updated_at'=>now()]);
    }
    /** Binding obligations, independent of autonomy enablement or manager retirement. */
    public function settle(int $limit=30):int {
        $count=0;
        foreach(DB::table('world_sponsor_deals')->where(fn($q)=>$q->where(fn($q)=>$q->where('status','offered')->where('expires_at','<=',now()))->orWhere(fn($q)=>$q->where('status','active')->where('next_payment_at','<=',now())))->orderBy('next_payment_at')->limit($limit)->pluck('id') as $id){
            DB::transaction(function()use($id,&$count){
                OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$d=DB::table('world_sponsor_deals')->where('id',$id)->lockForUpdate()->first();
                if($d->status==='offered'&&$d->expires_at<=now()){$this->refund($d,'expired');$count++;return;}
                if($d->status!=='active'||$d->next_payment_at>now())return;
                $date=\Carbon\Carbon::parse($d->next_payment_at);$amount=min($d->weekly_amount,$d->reserved_amount-$d->paid_amount);
                if($amount<=0){DB::table('world_sponsor_deals')->where('id',$id)->update(['status'=>'completed','active_club_key'=>null,'next_payment_at'=>null,'updated_at'=>now()]);return;}
                $inserted=DB::table('club_money_entries')->insertOrIgnore(['club_id'=>$d->club_id,'amount'=>$amount,'kind'=>'Sponsorship instalment','reference'=>'sponsor-deal:'.$id.':'.$date->format('YmdHis'),'created_at'=>now()]);
                if(!$inserted)return;
                $paid=$d->paid_amount+$amount;$complete=$paid>=$d->reserved_amount;
                DB::table('world_sponsor_deals')->where('id',$id)->update(['paid_amount'=>$paid,'status'=>$complete?'completed':'active','active_club_key'=>$complete?null:(string)$d->club_id,'next_payment_at'=>$complete?null:$date->addWeek(),'updated_at'=>now()]);$count++;
            },3);
        }return $count;
    }
    public function fundOrganizer(int $organizer,int $amount,string $cause):bool {
        $this->install();
        return DB::transaction(function()use($organizer,$amount,$cause){
            $org=DB::table('competition_organizers')->where('id',$organizer)->lockForUpdate()->first();if(!$org||$org->user_id!==null)return false;
            if(DB::table('world_sponsor_ledger')->where('reference',$cause)->exists())return true;
            foreach(DB::table('world_sponsors')->orderBy('id')->lockForUpdate()->get() as $s){
                if($this->balance($s->id)<$amount)continue;
                DB::table('world_sponsor_entries')->insert(['sponsor_id'=>$s->id,'reference'=>$cause,'kind'=>'Organizer grant','amount'=>-$amount,'created_at'=>now()]);
                DB::table('world_sponsor_ledger')->insert(['organizer_id'=>$organizer,'reference'=>$cause,'kind'=>'Funded sponsor grant','amount'=>$amount,'created_at'=>now()]);return true;
            }return false;
        },3);
    }
}
