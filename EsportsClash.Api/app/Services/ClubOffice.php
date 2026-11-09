<?php
namespace App\Services;
use App\Models\{ClubFixture,OnlineClub,OnlineMatch,OwnedPlayerCard};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\{DB,Schema};

class ClubOffice
{
    public function notify(int $club,string $key,string $kind,string $title,string $body,array $action=[],mixed $deadline=null,mixed $occurred=null):void{
        if(!Schema::hasTable('club_inbox'))return;
        DB::table('club_inbox')->insertOrIgnore(['club_id'=>$club,'event_key'=>$key,'kind'=>$kind,'title'=>$title,'body'=>$body,'action'=>json_encode($action),'deadline_at'=>$deadline,'occurred_at'=>$occurred??now()]);
    }
    public function sync(OnlineClub $club):void{
        $active=[];
        foreach(DB::table('competition_invitations as i')->join('club_tournaments as e','e.id','=','i.tournament_id')->where('i.participant_type','club')->where('i.participant_id',$club->id)->where('i.status','pending')->where('i.expires_at','>',now())->get(['i.*','e.name']) as $i){
            $key='invitation:'.$i->id.':'.$i->slot_key.':'.$i->attempt;$active[]=$key;
            $this->notify($club->id,$key,'invitation','Tournament invitation: '.$i->name,'A place is reserved for your club until the invitation expires. Review the published rules before accepting.', ['type'=>'tournament_invitation','id'=>$i->id,'event_id'=>$i->tournament_id,'attempt'=>$i->attempt,'slot_key'=>$i->slot_key],$i->expires_at,$i->issued_at??$i->created_at);
        }
        foreach(DB::table('club_friendly_invites as i')->join('online_clubs as c','c.id','=','i.home_club_id')->where('i.away_club_id',$club->id)->whereNull('i.fixture_id')->where('i.kickoff_at','>',now()->addMinutes(15))->get(['i.*','c.name']) as $i){
            $key='scrimmage:'.$i->id;$active[]=$key;
            $this->notify($club->id,$key,'scrimmage','Scrimmage request from '.$i->name,'Review the proposed kickoff and accept if the slot suits your club.', ['type'=>'scrimmage_invitation','id'=>$i->id,'route'=>'play?club=friendly'],CarbonImmutable::parse($i->kickoff_at)->subMinutes(15),$i->created_at);
        }
        foreach(ClubFixture::where(fn($q)=>$q->where('home_club_id',$club->id)->orWhere('away_club_id',$club->id))->whereNull('match_id')->whereNull('hold_reason')->whereBetween('orders_close_at',[now(),now()->addHours(48)])->get() as $f){
            $key='orders:'.$f->id;$active[]=$key;
            $this->notify($club->id,$key,'orders','Orders deadline: '.$f->competition,'Your saved default lineup is used unless you submit eligible orders for this fixture.', ['type'=>'route','route'=>'play?club=calendar','fixture_id'=>$f->id],$f->orders_close_at);
        }
        DB::table('club_inbox')->where('club_id',$club->id)->whereNull('resolved_at')->whereIn('kind',['invitation','scrimmage','orders'])->whereNotIn('event_key',$active)->update(['resolved_at'=>now()]);
        foreach(ClubFixture::where(fn($q)=>$q->where('home_club_id',$club->id)->orWhere('away_club_id',$club->id))->whereHas('match',fn($q)=>$q->where('status','completed')->where('completed_at','>=',now()->subDays(14)))->with('match')->limit(30)->get() as $f){
            $m=$f->match;$won=($m->result['winner']==='blue'?$f->home_club_id:$f->away_club_id)===$club->id;
            $this->notify($club->id,'result:'.$m->id,'result',($won?'Victory':'Match completed').' — '.$f->competition,'The verified Arena result and exact event report are available.', ['type'=>'match','id'=>$m->id],null,$m->completed_at);
        }
        foreach(DB::table('club_money_entries')->where('club_id',$club->id)->whereIn('kind',['Weekly payroll','Staff payroll'])->where('created_at','>=',now()->subDays(14))->get() as $e)$this->notify($club->id,'payroll:'.$e->id,'money','Weekly wages posted','Your money ledger records the actual payroll charge.',['type'=>'route','route'=>'market'],null,$e->created_at);
    }
    public function inbox(OnlineClub $club,int $page,bool $unread):array{
        $this->sync($club);$q=DB::table('club_inbox')->where('club_id',$club->id);if($unread)$q->whereNull('read_at');
        $count=(clone $q)->count();$rows=$q->orderByDesc('id')->offset(($page-1)*20)->limit(20)->get()->map(function($n){$n->action=json_decode($n->action??'{}',true);foreach(['occurred_at','deadline_at','read_at','resolved_at'] as $key)if($n->$key)$n->$key=CarbonImmutable::parse($n->$key)->toIso8601String();unset($n->club_id,$n->event_key);return $n;});
        return ['items'=>$rows,'unread'=>DB::table('club_inbox')->where('club_id',$club->id)->whereNull('read_at')->count(),'meta'=>['page'=>$page,'last_page'=>max(1,(int)ceil($count/20)),'total'=>$count]];
    }
    public function report(OnlineClub $club,CarbonImmutable $start,bool $complete=false):array{
        $end=$complete?$start->addWeek():CarbonImmutable::now('UTC');
        $money=DB::table('club_money_entries')->where('club_id',$club->id)->where('created_at','>=',$start)->where('created_at','<',$end)->orderBy('id')->get();
        $opening=(int)DB::table('club_money_entries')->where('club_id',$club->id)->where('created_at','<',$start)->sum('amount');
        $games=ClubFixture::where(fn($q)=>$q->where('home_club_id',$club->id)->orWhere('away_club_id',$club->id))->whereHas('match',fn($q)=>$q->where('status','completed')->where('completed_at','>=',$start)->where('completed_at','<',$end))->with('match')->get();
        $players=[];$wins=0;
        foreach($games as $f){$m=$f->match;$side=$f->home_club_id===$club->id?'blue':'red';if($m->result['winner']===$side)$wins++;
            $sessions=DB::table('club_training_sessions')->where('match_id',$m->id)->get()->keyBy('card_id');
            foreach($m->plan[$side] as $i=>$slot){$id=$slot['instance_id'];$name=$m->plan['player_profiles'][$id]['name']??$m->plan['player_identities'][$id]??$m->result['report']['draft'][$side][$i]['player']['name']??'Archived player';
                $players[$id]??=['id'=>$id,'name'=>$name,'appearances'=>0,'earned_xp'=>0,'posted_xp'=>0];$players[$id]['appearances']++;$s=$sessions[$id]??null;if($s){$players[$id]['earned_xp']+=$s->xp;if($s->processed_at)$players[$id]['posted_xp']+=$s->xp;}
            }
        }
        return ['week'=>$start->setTimezone('Asia/Manila')->toDateString(),'starts_at'=>$start->toIso8601String(),'ends_at'=>$end->toIso8601String(),'complete'=>$complete,'generated_at'=>now()->toIso8601String(),
            'money'=>['opening'=>$opening,'closing'=>$opening+(int)$money->sum('amount'),'inflow'=>(int)$money->where('amount','>',0)->sum('amount'),'outflow'=>-(int)$money->where('amount','<',0)->sum('amount'),
                'payroll'=>-(int)$money->whereIn('kind',['Weekly payroll','Staff payroll'])->sum('amount'),'lines'=>$money->groupBy('kind')->map(fn($rows,$kind)=>['kind'=>$kind,'amount'=>(int)$rows->sum('amount')])->values(),'source_entry_ids'=>$money->pluck('id')],
            'matches'=>['played'=>$games->count(),'wins'=>$wins,'losses'=>$games->count()-$wins,'fixture_ids'=>$games->pluck('id')],'players'=>array_values($players),
            'note'=>'XP was earned by the frozen match roster; posting status is observed when this report is generated. Escrow movements are included in available-money cash flow.'];
    }
    public function weekly(OnlineClub $club):void{
        $localWeek=CarbonImmutable::now('Asia/Manila')->startOfWeek();$week=$localWeek->utc();
        DB::transaction(function()use($club,$localWeek){
            $row=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            $cursor=$row->office_report_cursor?CarbonImmutable::parse($row->office_report_cursor,'Asia/Manila')->startOfWeek():CarbonImmutable::instance($row->created_at)->setTimezone('Asia/Manila')->startOfWeek();
            // Recover at most eight closed weeks per job; retain actual observation/generation times.
            for($n=0;$n<8&&$cursor->lt($localWeek);$n++,$cursor=$cursor->addWeek()){
                if(!DB::table('club_weekly_reports')->where('club_id',$club->id)->where('week',$cursor->toDateString())->exists()){
                    $report=$this->report($club,$cursor->utc(),true);
                    DB::table('club_weekly_reports')->insertOrIgnore(['club_id'=>$club->id,'week'=>$cursor->toDateString(),'report'=>json_encode($report),'generated_at'=>now()]);
                }
                $this->notify($club->id,'weekly:'.$cursor->utc()->toDateString(),'report','Your weekly club report is ready','Review match participation, earned training, wages and money movements.',['type'=>'route','route'=>'home?office=reports']);
            }
            $row->update(['office_report_cursor'=>$cursor->toDateString()]);
        },3);
        $catalog=app(OnlineService::class)->activeCatalog();$templates=collect($catalog->payload['cards'])->keyBy('id');
        foreach(OwnedPlayerCard::where('user_id',$club->user_id)->get() as $p){if(!isset($templates[$p->definition_id]))continue;$d=app(WorldPlayerProfiles::class)->definition($p,$templates[$p->definition_id]);
            DB::table('player_progress_snapshots')->insertOrIgnore(['player_id'=>$p->id,'week'=>$week->setTimezone('Asia/Manila')->toDateString(),'training_xp'=>$p->training_xp,'stats'=>json_encode($d['stats']),'overall'=>$d['ovr'],'observed_at'=>now()]);
        }
    }
}
