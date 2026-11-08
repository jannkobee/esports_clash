<?php
namespace App\Jobs;
use App\Models\OnlineClub;
use App\Services\CommunityCups;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\DB;
class InviteCommunityClubs implements ShouldQueue,ShouldBeUniqueUntilProcessing {
    use Queueable;
    public int $tries=3;public int $timeout=45;public int $uniqueFor=120;
    public function __construct(public int $weekId){}
    public function uniqueId():string{return (string)$this->weekId;}
    public function middleware():array{return [(new WithoutOverlapping('community-invites:'.$this->weekId))->releaseAfter(10)->expireAfter(60)];}
    public function handle(CommunityCups $cups):void {
        $week=DB::table('community_cup_weeks')->find($this->weekId);
        if(!$week||$week->status!=='inviting'||\Carbon\CarbonImmutable::parse($week->invites_close_at)->isPast())return;
        $clubs=OnlineClub::where('is_bot',false)->whereNotIn('id',DB::table('community_cup_invitations')->where('week_id',$this->weekId)->select('club_id'))->orderBy('id')->limit(config('community.invite_batch'))->get();
        foreach($clubs as $club)$cups->invite($this->weekId,$club);
        if($clubs->count()>=config('community.invite_batch'))self::dispatch($this->weekId)->delay(now()->addSeconds(2));
    }
}
