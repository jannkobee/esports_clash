<?php
namespace App\Services;
use App\Models\ClubTournament;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/** One current row per participant; every slot attempt/response is retained separately. */
class CompetitionInvitations {
    public function record(object $i):void{
        DB::table('competition_invitation_history')->insertOrIgnore(['invitation_id'=>$i->id,'tournament_id'=>$i->tournament_id,'slot_key'=>$i->slot_key,'attempt'=>$i->attempt,
            'participant_type'=>$i->participant_type,'participant_id'=>$i->participant_id,'status'=>$i->status,'source'=>$i->source,
            'issued_at'=>$i->issued_at??$i->created_at,'expires_at'=>$i->expires_at,'recorded_at'=>now()]);
    }
    public function transition(int $id,string $status):void{
        $i=DB::table('competition_invitations')->where('id',$id)->lockForUpdate()->first();abort_unless($i,404);
        $this->record($i);
        DB::table('competition_invitations')->where('id',$id)->update(['status'=>$status,'updated_at'=>now()]);
        $this->record(DB::table('competition_invitations')->find($id));
    }
    public function issue(ClubTournament $event,string $slot,int $participant,array $source):int{
        return DB::transaction(function()use($event,$slot,$participant,$source){
            $event=ClubTournament::whereKey($event->id)->lockForUpdate()->firstOrFail();
            app(AnnualQualificationGraph::class)->assertBound($event);
            abort_unless($event->status==='registration'&&$event->registration_closes_at->isFuture(),409,'Registration is closed.');
            $rows=DB::table('competition_invitations')->where('tournament_id',$event->id)->where(fn($q)=>$q->where('slot_key',$slot)->orWhere(fn($p)=>$p->where('participant_type',$event->participant_type)->where('participant_id',$participant)))->lockForUpdate()->get();
            foreach($rows as $row)if($row->status==='pending'&&CarbonImmutable::parse($row->expires_at)->lte(now()))$this->transition($row->id,'expired');
            $occupied=DB::table('competition_invitations')->where('tournament_id',$event->id)->where('slot_key',$slot)->whereIn('status',['pending','accepted'])->exists();
            abort_if($occupied,409,'This invitation slot is occupied.');
            $existing=DB::table('competition_invitations')->where('tournament_id',$event->id)->where('participant_type',$event->participant_type)->where('participant_id',$participant)->first();
            abort_if($existing&&in_array($existing->status,['pending','accepted'],true),409,'This team already has an active invitation.');
            $field=$event->participant_type==='club'?'club_id':'national_team_id';
            $entries=DB::table('club_tournament_entries')->where('tournament_id',$event->id)->where('status','accepted');
            abort_if((clone $entries)->where($field,$participant)->exists(),409,'This team has already entered.');
            $pending=DB::table('competition_invitations')->where('tournament_id',$event->id)->where('status','pending')->where('expires_at','>',now())->count();
            abort_if((clone $entries)->count()+$pending>=$event->capacity,409,'All places are occupied or reserved.');
            $attempt=1+max((int)DB::table('competition_invitation_history')->where('tournament_id',$event->id)->where('slot_key',$slot)->max('attempt'),
                (int)DB::table('competition_invitations')->where('tournament_id',$event->id)->where('slot_key',$slot)->max('attempt'));
            $values=['slot_key'=>$slot,'attempt'=>$attempt,'status'=>'pending','source'=>json_encode($source),'issued_at'=>now(),
                'expires_at'=>CarbonImmutable::now()->addDays(3)->min($event->registration_closes_at),'updated_at'=>now()];
            if($existing){$this->record($existing);$id=$existing->id;DB::table('competition_invitations')->where('id',$id)->update($values);}
            else $id=DB::table('competition_invitations')->insertGetId($values+['tournament_id'=>$event->id,'participant_type'=>$event->participant_type,'participant_id'=>$participant,'created_at'=>now()]);
            $this->record(DB::table('competition_invitations')->find($id));return $id;
        },3);
    }
    public function expire():void{
        foreach(DB::table('competition_invitations')->where('status','pending')->where('expires_at','<=',now())->orderBy('id')->limit(500)->get() as $i){
            DB::transaction(function()use($i){ClubTournament::whereKey($i->tournament_id)->lockForUpdate()->firstOrFail();
                $fresh=DB::table('competition_invitations')->where('id',$i->id)->lockForUpdate()->first();
                if($fresh->status==='pending'&&CarbonImmutable::parse($fresh->expires_at)->lte(now()))$this->transition($fresh->id,'expired');
            },3);
        }
    }
}
