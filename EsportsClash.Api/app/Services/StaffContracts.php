<?php
namespace App\Services;
use App\Models\{ClubStaff,OnlineCatalog,OnlineClub};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class StaffContracts {
    public function candidates(OnlineClub $club):array{
        $week=now('Asia/Manila')->format('o-W');$result=[];
        foreach(app(ClubStaffService::class)->roster($club) as $member){
            for($i=0;$i<3;$i++){
                $seed=hash('sha256',$club->id.':'.$member['role'].':'.$week.':'.$i);$ratings=[];
                foreach(array_keys($member['attributes']) as $n=>$key)$ratings[$key]=4+hexdec(substr($seed,$n*2,2))%7;
                $names=['Dani Solis','Luca Vale','Emi Rivera','Rin Alonzo','Aden Silva','Mira Chan','Tess Mori','Jules Arden'];
                $mean=array_sum($ratings)/count($ratings);
                $quality=$mean+0.15*(max($ratings)-$mean);
                $salary=(int)(round((80+12*$quality*$quality+25*pow(max(0,$quality-6),3))/10)*1000);
                $tier=$quality>=8.5?'S':($quality>=7.5?'A':($quality>=6.5?'B':'C'));
                $result[]=['id'=>'v2:'.$member['role'].':'.$week.':'.$i,'role'=>$member['role'],'title'=>$member['title'],'name'=>$names[hexdec(substr($seed,12,2))%count($names)],
                    'attributes'=>$ratings,'quality'=>round($quality,2),'tier'=>$tier,'pricing_version'=>'quality-v2','term_cost'=>$salary*10,'weekly_salary'=>$salary,'signing_fee'=>$salary*2,'weeks'=>8,'available_until'=>CarbonImmutable::now('Asia/Manila')->endOfWeek()->toIso8601String()];
            }
        }return $result;
    }
    public function hire(OnlineClub $club,string $candidateId):void{
        $this->sign($club,$candidateId);
    }
    public function hireProfessional(OnlineClub $club,\App\Models\WorldAgent $professional,array $candidate):void{
        if(in_array($candidate['role'],['general_manager','scout']))$this->signOffice($club,$professional,$candidate);
        else $this->sign($club,$candidate['id'],$professional,$candidate);
    }
    private function signOffice(OnlineClub $club,\App\Models\WorldAgent $person,array $offer):void {
        DB::transaction(function()use($club,$person,$offer){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            $person=\App\Models\WorldAgent::whereKey($person->id)->lockForUpdate()->firstOrFail();$offer=app(WorldCareers::class)->candidate($person,$offer['role'],$offer['weekly_salary'],$offer['weeks']);
            $old=DB::table('club_staff_contracts')->where('club_id',$club->id)->where('role',$offer['role'])->where('status','active')->lockForUpdate()->first();
            $market=app(ClubMarketService::class);$cover=4*max(0,$market->weeklyWages($club)-($old?->weekly_salary??0)+$offer['weekly_salary']);
            abort_if($market->balance($club->id)<$offer['signing_fee']+$cover,422,'Keep four weeks of wages after the signing fee.');
            if($old)$this->endOffice($old,'replaced');$start=CarbonImmutable::now('UTC');
            $id=DB::table('club_staff_contracts')->insertGetId(['club_id'=>$club->id,'role'=>$offer['role'],'name'=>$person->name,'ratings'=>json_encode($offer['attributes']),'candidate_key'=>'agent:'.$person->id,'weekly_salary'=>$offer['weekly_salary'],'signing_fee'=>$offer['signing_fee'],'starts_at'=>$start,'ends_at'=>$start->addWeeks($offer['weeks']),'status'=>'active']);
            DB::table('club_money_entries')->insert(['club_id'=>$club->id,'amount'=>-$offer['signing_fee'],'kind'=>'Staff signing fee','reference'=>'staff:'.$id.':signing','created_at'=>now()]);
            app(WorldAgents::class)->employ($person,$club,$offer['role'],'staff-contract:'.$id,['contract_id'=>$id]);
            app(WorldAgents::class)->remember($person,'appointment:'.$id,'employment','accepted',['club_id'=>$club->id,'role'=>$offer['role']],1,.9,'club:'.$club->id,.04);
            $person->refresh();$person->update(['wire_account_id'=>app(WireAccounts::class)->career($person)]);$club->increment('revision');
            app(WorldActivityService::class)->record('staff:'.$id.':signed','club',$club,$club->name.' appointed '.$person->name.' as '.$offer['title'].'.',['team_id'=>$club->id]);
        },3);
    }
    public function endOffice(object $contract,string $reason):void {
        DB::table('club_staff_contracts')->where('id',$contract->id)->where('status','active')->update(['status'=>$reason,'terminated_at'=>now()]);
        $e=DB::table('world_employments')->where('source_key','staff-contract:'.$contract->id)->whereNotNull('active_agent_id')->first();if(!$e)return;
        DB::table('world_employments')->where('id',$e->id)->update(['active_agent_id'=>null,'ends_at'=>now(),'end_reason'=>$reason]);
        \App\Models\WorldAgent::whereKey($e->agent_id)->update(['club_id'=>null,'status'=>'available','review_at'=>now()]);
    }
    public function releaseOffice(OnlineClub $club,int $id):void {
        DB::transaction(function()use($club,$id){OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();$c=DB::table('club_staff_contracts')->where('id',$id)->where('club_id',$club->id)->whereIn('role',['general_manager','scout'])->lockForUpdate()->first();abort_unless($c,404);if($c->status!=='active')return;$this->endOffice($c,'released');$club->increment('revision');},3);
    }
    private function sign(OnlineClub $club,string $candidateId,?\App\Models\WorldAgent $professional=null,?array $agreed=null):void{
        DB::transaction(function()use($club,$candidateId,$professional,$agreed){
            OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            if($professional){
                $professional=\App\Models\WorldAgent::whereKey($professional->id)->lockForUpdate()->firstOrFail();
                $candidate=app(WorldCareers::class)->candidate($professional,$agreed['role'],$agreed['weekly_salary'],$agreed['weeks']);
            }else $candidate=collect($this->candidates($club))->firstWhere('id',$candidateId);
            abort_unless($candidate,422,'This candidate is no longer available. Refresh the staff desk.');
            if(!$professional&&app(WorldCareers::class)->ready()){
                $professional=app(WorldAgents::class)->identity('candidate:'.$club->id.':'.$candidateId,'staff',$candidateId,$candidate['name'],$candidate['role'],$candidate['attributes']);
                $professional=\App\Models\WorldAgent::whereKey($professional->id)->lockForUpdate()->firstOrFail();
                abort_unless($professional->status==='available',409,'This professional already has another active appointment.');
            }
            $staff=ClubStaff::where('club_id',$club->id)->where('role',$candidate['role'])->lockForUpdate()->firstOrFail();
            abort_if($staff->contract_id&&DB::table('club_staff_contracts')->where('id',$staff->contract_id)->where('candidate_key',$candidateId)->exists(),409,'This candidate is already employed.');
            $market=app(ClubMarketService::class);$oldSalary=$staff->contract_id?(int)DB::table('club_staff_contracts')->where('id',$staff->contract_id)->value('weekly_salary'):0;
            $cover=max(0,$market->weeklyWages($club)-$oldSalary+$candidate['weekly_salary'])*4;
            abort_if($market->balance($club->id)<$candidate['signing_fee']+$cover,422,'Keep four weeks of wages available after paying the signing fee.');
            $this->endCurrent($staff,'replaced');$start=CarbonImmutable::now('UTC');
            $id=DB::table('club_staff_contracts')->insertGetId(['club_id'=>$club->id,'role'=>$candidate['role'],'name'=>$candidate['name'],'ratings'=>json_encode($candidate['attributes']),
                'candidate_key'=>$candidateId,'weekly_salary'=>$candidate['weekly_salary'],'signing_fee'=>$candidate['signing_fee'],'starts_at'=>$start,'ends_at'=>$start->addWeeks($candidate['weeks']),'status'=>'active']);
            DB::table('club_money_entries')->insert(['club_id'=>$club->id,'amount'=>-$candidate['signing_fee'],'kind'=>'Staff signing fee','reference'=>'staff:'.$id.':signing','created_at'=>now()]);
            $staff->update(['contract_id'=>$id,'name'=>$candidate['name'],'ratings'=>$candidate['attributes']]);
            app(WorldCareers::class)->appointed($staff,$id,$professional);
            $club->increment('revision');
            app(WorldActivityService::class)->record('staff:'.$id.':signed','club',$club,$club->name.' appointed '.$candidate['name'].' as '.$candidate['title'].'.',['team_id'=>$club->id]);
            app(ClubOffice::class)->notify($club->id,'staff:'.$id.':hired','staff','Staff appointment: '.$candidate['title'],'The dated terms are signed. The signing fee is posted; dated weekly salary accrues from today. Existing locked match snapshots keep their staff.', ['type'=>'route','route'=>'squad?tab=staff']);
        },3);
    }
    private function endCurrent(ClubStaff $staff,string $status):void{
        app(WorldCareers::class)->endStaff($staff,$status);
        if($staff->contract_id)DB::table('club_staff_contracts')->where('id',$staff->contract_id)->where('status','active')->update(['status'=>$status,'terminated_at'=>now()]);
    }
    public function release(OnlineClub $club,string $role):void{
        DB::transaction(function()use($club,$role){OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            $staff=ClubStaff::where('club_id',$club->id)->where('role',$role)->lockForUpdate()->firstOrFail();abort_unless($staff->contract_id,409,'This role already uses the founding staff arrangement.');
            $this->endCurrent($staff,'released');$this->restore($staff);OnlineClub::whereKey($club->id)->increment('revision');
        },3);
    }
    private function restore(ClubStaff $staff):void{
        $base=$staff->founding_profile;$staff->update(['name'=>$base['name'],'ratings'=>$base['ratings'],'contract_id'=>null]);if(app(WorldCareers::class)->ready())app(WorldCareers::class)->staffIdentity($staff);
    }
    public function expire(OnlineClub $club):void{
        DB::transaction(function()use($club){OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            foreach(ClubStaff::where('club_id',$club->id)->whereNotNull('contract_id')->lockForUpdate()->get() as $staff){$c=DB::table('club_staff_contracts')->find($staff->contract_id);
                if(!$c||CarbonImmutable::parse($c->ends_at)->isFuture())continue;
                $this->endCurrent($staff,'expired');$this->restore($staff);
                app(ClubOffice::class)->notify($club->id,'staff:'.$c->id.':expired','staff','Staff contract expired','The founding staff arrangement covers this role again. Earned salary remains in the dated contract record.',['type'=>'route','route'=>'squad?tab=staff']);
            }
        },3);
    }
    public function weeklySalary(int $club):int{return (int)DB::table('club_staff_contracts')->where('club_id',$club)->where('status','active')->where('starts_at','<=',now())->where('ends_at','>',now())->sum('weekly_salary');}
    public function salaryForPeriod(int $club,CarbonImmutable $from,CarbonImmutable $to):int{
        $sum=0;foreach(DB::table('club_staff_contracts')->where('club_id',$club)->where('starts_at','<',$to)->where('ends_at','>',$from)->get() as $c){
            $end=CarbonImmutable::parse($c->ends_at);if($c->terminated_at)$end=$end->min(CarbonImmutable::parse($c->terminated_at));
            $seconds=max(0,$end->min($to)->getTimestamp()-CarbonImmutable::parse($c->starts_at)->max($from)->getTimestamp());$sum+=(int)round($c->weekly_salary*$seconds/(7*86400));
        }return $sum;
    }
    public function history(int $club):array{return DB::table('club_staff_contracts')->where('club_id',$club)->orderByDesc('id')->limit(100)->get()->map(function($c){unset($c->candidate_key);$c->ratings=json_decode($c->ratings,true);return $c;})->all();}
    public function considerBot(OnlineClub $club):?string{
        if(app(WorldCareers::class)->ready())return null; // Persistent applications and consent now own autonomous hiring.
        if(!$club->is_bot||DB::table('club_staff_contracts')->where('club_id',$club->id)->where('starts_at','>=',now('Asia/Manila')->startOfWeek()->utc())->exists())return null;
        $members=collect(app(ClubStaffService::class)->roster($club))->keyBy('role');$market=app(ClubMarketService::class);$balance=$market->balance($club->id);$wages=$market->weeklyWages($club);
        $best=null;$gain=0;
        foreach($this->candidates($club) as $c){$improvement=array_sum($c['attributes'])-array_sum($members[$c['role']]['attributes']);
            if($improvement<$gain||$improvement<6||$balance<$c['signing_fee']+8*($wages+$c['weekly_salary']))continue;
            $best=$c;$gain=$improvement;
        }
        if(!$best)return null;$this->hire($club,$best['id']);return 'Funded an eight-week '.$best['title'].' contract with eight weeks of payroll cover.';
    }
}
