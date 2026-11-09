<?php
namespace App\Services;

use App\Models\{ClubTournament,CompetitionDefinition,OnlineClub};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class CommunityCups
{
    public const ACCREDITATION='community_fun';
    public static function isFun(?ClubTournament $event):bool {return $event?->accreditation===self::ACCREDITATION;}
    public static function progression():array {return ['kind'=>'community_fun','training'=>false,'player_ratings'=>false,'ranked'=>false];}

    public function tick():void {
        if(!config('community.enabled'))return;
        $week=CarbonImmutable::now('Asia/Manila')->startOfWeek();
        if(now()->gte($week->addDays(2)->setTime(18,0)))$week=$week->addWeek();
        DB::table('community_cup_weeks')->insertOrIgnore(['week'=>$week->toDateString(),'invites_close_at'=>$week->addDays(2)->setTime(18,0)->utc(),'starts_at'=>$week->addDays(4)->setTime(18,0)->utc(),
            'ends_at'=>$week->addDays(13)->setTime(23,0)->utc(),'status'=>'inviting','created_at'=>now(),'updated_at'=>now()]);
        foreach(DB::table('community_cup_weeks')->where('status','inviting')->where('invites_close_at','>',now())->get() as $w)\App\Jobs\InviteCommunityClubs::dispatch($w->id);
        foreach(DB::table('community_cup_weeks')->whereIn('status',['inviting','forming'])->where('invites_close_at','<=',now())->where('ends_at','>',now())->get() as $w){
            DB::table('community_cup_weeks')->where('id',$w->id)->update(['status'=>'forming','updated_at'=>now()]);
            DB::table('community_cup_invitations')->where('week_id',$w->id)->where('status','invited')->update(['status'=>'expired','updated_at'=>now()]);
            foreach(range(1,5) as $tier)\App\Jobs\BuildCommunityPods::dispatch($w->id,$tier);
        }
        DB::table('community_cup_invitations')->where('status','accepted')->whereIn('week_id',DB::table('community_cup_weeks')->where('ends_at','<=',now())->select('id'))->update(['status'=>'unplaced','updated_at'=>now()]);
        DB::table('community_cup_weeks')->where('ends_at','<=',now())->whereIn('status',['inviting','forming'])->update(['status'=>'closed','updated_at'=>now()]);
        // Community play is independent of the official annual-circuit processing switch.
        ClubTournament::where('accreditation',self::ACCREDITATION)->whereIn('status',['registration','active'])->orderBy('id')->chunkById(100,function($events){foreach($events as $e)\App\Jobs\ProcessCompetitionEdition::dispatch($e->id);});
    }

    public function invite(int $weekId,OnlineClub $club):void {
        $w=DB::table('community_cup_weeks')->find($weekId);
        if(!$w||$club->is_bot||$w->status!=='inviting'||CarbonImmutable::parse($w->invites_close_at)->isPast())return;
        $inserted=DB::table('community_cup_invitations')->insertOrIgnore(['week_id'=>$weekId,'club_id'=>$club->id,'tier'=>max(1,min(5,$club->tier)),'status'=>'invited','created_at'=>now(),'updated_at'=>now()]);
        if($inserted)app(ClubOffice::class)->notify($club->id,'community:'.$weekId.':invite','competition','Your Hexa Weeklies invitation','Accept or decline this week\'s free tier-based cup. Cosmetic trophies only; no training, form or ranking gains. Accepting requests a place; the bracket confirms your fixture times.',['type'=>'route','route'=>'play?community=cups']);
    }

    public function respond(OnlineClub $club,int $id,bool $accept):void {
        abort_unless(config('community.enabled'),409,'Community invitations are currently paused.');
        DB::transaction(function()use($club,$id,$accept){
            $i=DB::table('community_cup_invitations')->where('id',$id)->where('club_id',$club->id)->first();abort_unless($i,404);
            $w=DB::table('community_cup_weeks')->where('id',$i->week_id)->lockForUpdate()->first();
            $i=DB::table('community_cup_invitations')->where('id',$id)->lockForUpdate()->first();
            abort_unless($w->status==='inviting'&&CarbonImmutable::parse($w->invites_close_at)->isFuture()&&in_array($i->status,['invited','accepted','declined'],true),409,'The invitation window has closed.');
            abort_if($accept&&!$club->tag,422,'Publish your club name and tag in Club identity before accepting.');
            DB::table('community_cup_invitations')->where('id',$id)->update(['status'=>$accept?'accepted':'declined','tier'=>max(1,min(5,$club->tier)),'responded_at'=>now(),'updated_at'=>now()]);
        },3);
    }

    private function definition():CompetitionDefinition {
        DB::table('competition_organizers')->insertOrIgnore(['slug'=>'hexa-community','name'=>'Hexa Community Collective','category'=>'community','status'=>'verified','created_at'=>now(),'updated_at'=>now()]);
        return CompetitionDefinition::firstOrCreate(['slug'=>'hexa-weeklies'],['organizer_id'=>DB::table('competition_organizers')->where('slug','hexa-community')->value('id'),
            'name'=>'Hexa Weeklies','category'=>'community_weekly','participant_type'=>'club','official'=>false,'ranked'=>false,'status'=>'approved','version'=>1,
            'rules'=>['community_fun'=>true],'schedule'=>['cadence'=>'weekly','timezone'=>'Asia/Manila'],'sponsors'=>[]]);
    }

    /** One small pod per transaction; retries cannot assign the same invitation twice. */
    public function buildPod(int $weekId,int $tier):bool {
        return DB::transaction(function()use($weekId,$tier){
            $w=DB::table('community_cup_weeks')->where('id',$weekId)->lockForUpdate()->first();
            if(!$w||$w->status!=='forming'||CarbonImmutable::parse($w->invites_close_at)->isFuture()||CarbonImmutable::parse($w->ends_at)->lte(now()->addDays(3)))return false;
            $podCount=ClubTournament::where('accreditation',self::ACCREDITATION)->where('scope','like','weekly:'.$weekId.':%')->count();
            if($podCount>=max(1,config('community.max_pods_per_week')))return false;
            $invites=DB::table('community_cup_invitations')->where('week_id',$weekId)->where('tier',$tier)->where('status','accepted')->orderBy('id')->lockForUpdate()->limit(8)->get();
            if($invites->isEmpty())return false;
            $size=$invites->count()>=8?8:($invites->count()>=4?4:2);$invites=$invites->take($size);
            $ids=$invites->pluck('club_id')->all();
            if(count($ids)===1){
                $bot=OnlineClub::where('is_bot',true)->where('tier',$tier)->whereNotNull('tag')->whereNotIn('id',DB::table('community_cup_invitations')->where('week_id',$weekId)->select('club_id'))->orderBy('id')->first();
                if(!$bot)return false;
                $ids[]=$bot->id;
            }
            $definition=$this->definition();$start=CarbonImmutable::parse($w->starts_at)->max(CarbonImmutable::now('UTC')->addHours(2)->startOfHour());
            $rules=['minimum'=>$size,'capacity'=>$size,'stages'=>[['format'=>'single_elimination','advance'=>1]],'qualification'=>[['method'=>'invitation','slots'=>$size]],
                'round_interval_hours'=>24,'fixture_interval_hours'=>1,'circuit_points'=>[],'progression'=>self::progression(),
                'prizes'=>['champion'=>'Weekly champion cosmetic trophy','finalist'=>'Weekly finalist cosmetic badge'],
                'terms'=>'Free entry. One place per club per week, tier fixed at acceptance. One Arena game per round. Normal player skills apply, but no training, attributes, form, ranked or circuit gains. Cosmetic rewards have no cash value. Official recovery/calendar restrictions remain. Conflicts and stalled games require review; future winners are never invented.'];
            $event=ClubTournament::create(['definition_id'=>$definition->id,'year'=>$start->year,'tier'=>$tier,'name'=>'Hexa Weeklies - Tier '.$tier.' - '.$w->week.' - Cup '.($podCount+1),
                'scope'=>'weekly:'.$weekId.':'.($podCount+1),'participant_type'=>'club','capacity'=>$size,'rules_version'=>1,'regulations'=>$rules,'qualification'=>[],
                'ranked'=>false,'accreditation'=>self::ACCREDITATION,'registration_opens_at'=>now(),'registration_closes_at'=>now(),'starts_at'=>$start,'ends_at'=>$w->ends_at,
                'semifinals_at'=>$start,'final_at'=>$start->addDays(2),'champion_prize'=>0,'runner_up_prize'=>0,'status'=>'registration','sponsors'=>[]]);
            foreach($ids as $seed=>$clubId){
                DB::table('club_tournament_entries')->insert(['tournament_id'=>$event->id,'club_id'=>$clubId,'status'=>'accepted','seed'=>$seed+1,'source'=>json_encode(['method'=>'community_invitation','week_id'=>$weekId]),'geography_path'=>'[]']);
                DB::table('community_cup_invitations')->updateOrInsert(['week_id'=>$weekId,'club_id'=>$clubId],['tier'=>$tier,'status'=>'assigned','tournament_id'=>$event->id,'created_at'=>now(),'updated_at'=>now()]);
                app(ClubOffice::class)->notify($clubId,'community:'.$weekId.':pod','competition','Your weekly cup is ready','Your tier-based cup field is confirmed. Fixture times are published by the server, subject to official recovery and calendar availability.',['type'=>'route','route'=>'play?community=cups']);
            }
            \App\Jobs\ProcessCompetitionEdition::dispatch($event->id)->afterCommit();
            return true;
        },3);
    }

    public function award(ClubTournament $event,?int $winner,?int $runner):void {
        if(!self::isFun($event))return;
        foreach([[$winner,'champion'],[$runner,'finalist']] as [$club,$place])if($club){
            DB::table('community_cup_rewards')->insertOrIgnore(['tournament_id'=>$event->id,'club_id'=>$club,'place'=>$place,'badge'=>'hexa-weekly-'.$place,'awarded_at'=>now()]);
        }
    }

    public function desk(OnlineClub $club):array {
        $next=DB::table('community_cup_weeks')->where('status','inviting')->where('invites_close_at','>',now())->orderBy('week')->first();
        if($next)$this->invite($next->id,$club);
        $invitations=DB::table('community_cup_invitations as i')->join('community_cup_weeks as w','w.id','=','i.week_id')->leftJoin('club_tournaments as t','t.id','=','i.tournament_id')
            ->where('i.club_id',$club->id)->orderByDesc('i.id')->limit(12)->get(['i.id','i.tier','i.status','i.tournament_id','w.week','w.invites_close_at','w.starts_at','w.ends_at','t.name','t.status as tournament_status']);
        $rewards=DB::table('community_cup_rewards as r')->join('club_tournaments as t','t.id','=','r.tournament_id')->where('r.club_id',$club->id)->orderByDesc('r.id')->limit(30)->get(['r.*','t.name']);
        return ['enabled'=>(bool)config('community.enabled'),'invitations'=>$invitations,'rewards'=>$rewards,'timezone'=>'Asia/Manila','format'=>'2, 4 or 8 clubs per tier-based single-elimination cup','progression'=>self::progression(),
            'terms'=>'Free weekly invitations; accepting requests a bracket place. Capacity, eligible opponents and official calendar restrictions can delay placement. Cosmetic trophies only, no cash value. Three wins maximum in an eight-club cup. No training, attribute, form, ranking or circuit-point gains.'];
    }
}
