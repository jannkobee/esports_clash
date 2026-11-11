<?php
namespace App\Services;

use App\Models\{ClubTournament, CompetitionGeography, NationalTeam, OnlineClub};
use Illuminate\Support\Facades\DB;

class CompetitionQualification
{
    public function eligible(ClubTournament $e,string $type,int $id): array
    {
        abort_unless($type===$e->participant_type,422,'Clubs and national teams cannot mix in an edition.');
        $entity=$type==='club'?OnlineClub::findOrFail($id):NationalTeam::findOrFail($id);
        abort_if($type==='club' && !$entity->tag,422,'Publish a club identity first.');
        $geo=$entity->geography_id?CompetitionGeography::find($entity->geography_id):null;
        $path=$geo?->path()??[];
        $allowed=$e->regulations['geographies']??[];
        abort_if($allowed && !array_intersect($allowed,$path),422,'The entrant does not satisfy the published geographic restrictions.');
        if(isset($e->regulations['tiers']) && $type==='club')abort_unless(in_array($entity->tier,$e->regulations['tiers']),422,'The club tier is ineligible.');
        return $path;
    }

    public function enter(int $eventId,string $type,int $participant,array $source,?int $invitationId=null,?int $managementEpoch=null): void
    {
        DB::transaction(function()use($eventId,$type,$participant,$source,$invitationId,$managementEpoch){
            $e=ClubTournament::whereKey($eventId)->lockForUpdate()->firstOrFail();
            if($type==='club' && ($managementEpoch!==null || !empty($source['bot_fill']))) {
                $controlled=OnlineClub::whereKey($participant)->lockForUpdate()->firstOrFail();
                abort_unless($controlled->is_bot && ($managementEpoch===null || (int)$controlled->management_epoch===$managementEpoch),409,'Management authority changed.');
            }
            abort_if(!$e->definition_id || $e->status!=='registration' || $e->registration_closes_at->lte(now()) || $e->registration_opens_at?->isFuture(),409,'Registration is not open.');
            app(AnnualQualificationGraph::class)->assertBound($e);
            $path=$this->eligible($e,$type,$participant);$field=$type==='club'?'club_id':'national_team_id';
            if(DB::table('club_tournament_entries')->where('tournament_id',$eventId)->where($field,$participant)->where('status','accepted')->exists())return;
            $entries=DB::table('club_tournament_entries')->where('tournament_id',$eventId)->where('status','accepted');
            $pending=DB::table('competition_invitations')->where('tournament_id',$eventId)->where('status','pending')->where('expires_at','>',now());
            if($invitationId){
                $invite=DB::table('competition_invitations')->where('id',$invitationId)->lockForUpdate()->first();
                abort_unless($invite && $invite->tournament_id===$eventId && $invite->participant_id===$participant && $invite->participant_type===$type && $invite->status==='pending' && now()->lt($invite->expires_at),409,'Invitation is unavailable.');
                $source=json_decode($invite->source,true);$pending->where('id','<>',$invite->id);
            }else{
                abort_unless(($source['method']??null)==='open',403,'A reserved qualification place requires an invitation.');
                $open=array_sum(array_map(fn($p)=>$p['method']==='open'?$p['slots']:0,$e->qualification??[]));
                $used=(clone $entries)->where('source->method','open')->count();
                if($type==='club' && !OnlineClub::findOrFail($participant)->is_bot){
                    // Replace an open-place bot before roster lock. Never replace an earned qualifier or allocated match.
                    $botEntry=(clone $entries)->join('online_clubs as bot','bot.id','=','club_tournament_entries.club_id')->where('bot.is_bot',true)->where('source->bot_fill',true)->orderByDesc('club_tournament_entries.seed')->select('club_tournament_entries.*')->first();
                    if($botEntry){DB::table('club_tournament_entries')->where('id',$botEntry->id)->update(['club_id'=>$participant,'source'=>json_encode($source+['replaced_bot_club'=>$botEntry->club_id]),'geography_path'=>json_encode($path)]);return;}
                }
                abort_if($used>=$open,409,'No open registration slots remain.');
            }
            abort_if((clone $entries)->count()+$pending->count()>=$e->capacity,409,'All places are occupied or reserved by live invitations.');
            $seed=1+(int)(DB::table('club_tournament_entries')->where('tournament_id',$eventId)->max('seed')??0);
            DB::table('club_tournament_entries')->updateOrInsert(['tournament_id'=>$eventId,$field=>$participant],['status'=>'accepted','seed'=>$seed,'source'=>json_encode($source),'geography_path'=>json_encode($path)]);
            if($invitationId)app(CompetitionInvitations::class)->transition($invitationId,'accepted');
        },3);
    }

    public function generate(int $eventId): void
    {
        $event=ClubTournament::findOrFail($eventId);
        if($event->status!=='registration' || $event->registration_closes_at->isPast())return;
        app(AnnualQualificationGraph::class)->assertBound($event);
        foreach($event->qualification??[] as $path){
            if(!in_array($path['method'],['ranking','results','automatic'],true))continue;
            if($path['method']==='ranking' && now()->lt($event->registration_closes_at->subDays($event->regulations['invitation_lead_days']??7)))continue;
            $snapshot=null;
            if($path['method']==='ranking'){
                $snapshot=app(CompetitionRankings::class)->requestSnapshot($event->participant_type==='club'?'HGR':'HNR',"edition:$eventId:ranking");
                if(!$snapshot)continue;
            }
            for($i=1;$i<=$path['slots'];$i++)$this->fillSlot($eventId,$path,$i,$snapshot);
        }
        foreach(DB::table('competition_invitations')->where('tournament_id',$eventId)->whereIn('status',['expired','rejected','withdrawn'])->cursor() as $invite){
            $source=json_decode($invite->source,true);
            if(isset($source['path'],$source['slot']))$this->fillSlot($eventId,$source['path'],$source['slot'],$source['snapshot_id']??null);
        }
        // Unattended clubs/nations use the same accepted invitation path, never invented results.
        foreach(DB::table('competition_invitations')->where('tournament_id',$eventId)->where('status','pending')->where('expires_at','>',now())->get() as $invite){
            $bot=$invite->participant_type==='club'?OnlineClub::whereKey($invite->participant_id)->where('is_bot',true)->first():null;
            $automated=$invite->participant_type==='club' ? $bot!==null
                : !DB::table('national_manager_terms')->where('national_team_id',$invite->participant_id)->where('status','appointed')->where('ends_at','>',now())->exists();
            if($automated){
                try{$this->enter($eventId,$invite->participant_type,$invite->participant_id,[], $invite->id,$bot?(int)$bot->management_epoch:null);}
                catch(\Symfony\Component\HttpKernel\Exception\HttpException $error){if($error->getStatusCode()!==409)throw $error;}
            }
        }
    }

    private function fillSlot(int $eventId,array $path,int $slot,?int $snapshot): void
    {
        DB::transaction(function()use($eventId,$path,$slot,$snapshot){
            $e=ClubTournament::whereKey($eventId)->lockForUpdate()->firstOrFail();$key=$path['key'].':'.$slot;
            $existing=DB::table('competition_invitations')->where('tournament_id',$eventId)->where('slot_key',$key)->orderByDesc('attempt')->first();
            if($existing && in_array($existing->status,['pending','accepted'],true))return;
            $used=DB::table('competition_invitations')->where('tournament_id',$eventId)->pluck('participant_id')->all();
            $field=$e->participant_type==='club'?'club_id':'national_team_id';
            $used=[...$used,...DB::table('club_tournament_entries')->where('tournament_id',$eventId)->pluck($field)->filter()->all()];
            if($snapshot){$query=DB::table('competition_ranking_snapshot_rows')->where('snapshot_id',$snapshot)->whereNotIn('participant_id',$used);if(isset($path['geography_id']))$query->whereJsonContains('geography_path',$path['geography_id']);if($e->participant_type==='club'&&isset($e->regulations['tiers']))$query->whereIn('participant_id',OnlineClub::whereIn('tier',$e->regulations['tiers'])->select('id'));$candidates=$query->orderBy('position')->limit(1000)->pluck('participant_id');}
            elseif($path['method']==='results'){
                $q=ClubTournament::whereIn('id',$path['editions']??[])->where('status','completed')->where('year',$e->year);
                $candidates=$q->orderBy('id')->limit(1000)->pluck($e->participant_type==='club'?'champion_id':'national_champion_id')->filter();
                $available=$candidates->diff($used)->filter(function($participant)use($e,$path){
                    try{$this->eligible($e,$e->participant_type,$participant);}catch(\Symfony\Component\HttpKernel\Exception\HttpException){return false;}
                    if(!isset($path['geography_id']))return true;
                    $entity=$e->participant_type==='club'?OnlineClub::find($participant):NationalTeam::find($participant);
                    return $entity?->geography_id && in_array($path['geography_id'],CompetitionGeography::find($entity->geography_id)->path());
                });
                $exhausted=$available->isEmpty();
                $unresolved=ClubTournament::whereIn('id',$path['editions']??[])->whereNotIn('status',['completed','cancelled'])->exists();
                if($exhausted&&!$unresolved&&($path['fallback_method']??null)==='ranking'){
                    $snapshot=app(CompetitionRankings::class)->requestSnapshot($e->participant_type==='club'?'HGR':'HNR',"edition:$eventId:ranking");
                    if(!$snapshot)return;
                    $query=DB::table('competition_ranking_snapshot_rows')->where('snapshot_id',$snapshot)->whereNotIn('participant_id',$used);
                    if(isset($path['geography_id']))$query->whereJsonContains('geography_path',$path['geography_id']);
                    if($e->participant_type==='club'&&isset($e->regulations['tiers']))$query->whereIn('participant_id',OnlineClub::whereIn('tier',$e->regulations['tiers'])->select('id'));$candidates=$query->orderBy('position')->limit(1000)->pluck('participant_id');$path['resolved_method']='ranking_fallback';
                }
            }else $candidates=collect($path['participants']??[]);
            foreach($candidates as $participant){
                if(in_array($participant,$used))continue;
                try{$this->eligible($e,$e->participant_type,$participant);}catch(\Symfony\Component\HttpKernel\Exception\HttpException){continue;}
                if(isset($path['geography_id'])){
                    $entity=$e->participant_type==='club'?OnlineClub::find($participant):NationalTeam::find($participant);
                    if(!$entity?->geography_id || !in_array($path['geography_id'],CompetitionGeography::find($entity->geography_id)->path()))continue;
                }
                $reserved=DB::table('competition_invitations')->where('tournament_id',$eventId)->where('status','pending')->count();
                $entered=DB::table('club_tournament_entries')->where('tournament_id',$eventId)->where('status','accepted')->count();
                if($reserved+$entered>=$e->capacity)return;
                app(CompetitionInvitations::class)->issue($e,$key,$participant,['method'=>$path['method'],'path'=>$path,'slot'=>$slot,'snapshot_id'=>$snapshot]);
                return;
            }
        },3);
    }

    public function respond(int $id,bool $accept,int $userId,?int $attempt=null,?string $slot=null): void
    {
        DB::transaction(function()use($id,$accept,$userId,$attempt,$slot){
            $initial=DB::table('competition_invitations')->find($id);abort_unless($initial,404);
            ClubTournament::whereKey($initial->tournament_id)->lockForUpdate()->firstOrFail();
            $invite=DB::table('competition_invitations')->where('id',$id)->lockForUpdate()->first();
            if($invite->participant_type==='club')abort_unless(OnlineClub::whereKey($invite->participant_id)->where('user_id',$userId)->exists(),403);
            else app(NationalTeamService::class)->authorizeManager($invite->participant_id,$userId);
            $reissued=DB::table('competition_invitation_history')->where('invitation_id',$id)->where(fn($q)=>$q->where('slot_key','<>',$invite->slot_key)->orWhere('attempt','<>',$invite->attempt))->exists();
            abort_if(($attempt!==null&&(int)$invite->attempt!==$attempt)||($slot!==null&&$invite->slot_key!==$slot)||($reissued&&($attempt===null||$slot===null)),409,'This invitation has changed. Refresh the competition or inbox before answering.');
            if($invite->status==='accepted' && $accept)return;
            abort_unless($invite->status==='pending' && now()->lt($invite->expires_at),409,'Invitation expired or already answered.');
            if($accept)$this->enter($invite->tournament_id,$invite->participant_type,$invite->participant_id,[], $id);
            else app(CompetitionInvitations::class)->transition($id,'rejected');
        },3);
    }
}
