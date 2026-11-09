<?php
namespace App\Jobs;
use App\Models\ClubTournament;
use App\Services\{CompetitionCalendar,CompetitionRankings};
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Carbon\CarbonImmutable;
class FinalizeCompetitionYear implements ShouldQueue,ShouldBeUniqueUntilProcessing
{
    use Queueable;
    public int $tries=5;public int $timeout=900;public int $uniqueFor=1200;
    public function __construct(public int $year){$this->onConnection('competition_rankings');}
    public function uniqueId():string{return (string)$this->year;}
    public function middleware():array{return [(new \Illuminate\Queue\Middleware\WithoutOverlapping('competition-year:'.$this->year))->releaseAfter(30)->expireAfter(1200)];}
    public function handle(CompetitionCalendar $calendar,CompetitionRankings $rankings):void{
        if($this->year>=$calendar->year()||$this->year<$calendar->settings()['inaugural_year'])return;
        if(ClubTournament::where('year',$this->year)->whereNotNull('definition_id')->whereNotIn('status',['completed','cancelled'])->exists())return;
        DB::transaction(function()use($rankings){
            DB::table('competition_year_records')->insertOrIgnore(['year'=>$this->year]);
            $year=DB::table('competition_year_records')->where('year',$this->year)->lockForUpdate()->first();if($year->finalized_at)return;
            $cutoff=CarbonImmutable::create($this->year+1,1,1,0,0,0,'UTC')->subMicrosecond();
            $hgr=$rankings->snapshot('HGR','annual:'.$this->year.':HGR',$cutoff);$hnr=$rankings->snapshot('HNR','annual:'.$this->year.':HNR',$cutoff);
            $champions=ClubTournament::where('year',$this->year)->whereNotNull('definition_id')->where('status','completed')->get(['id','name','champion_id','national_champion_id'])->toArray();
            DB::table('competition_year_records')->where('year',$this->year)->update(['status'=>'finalized','club_snapshot_id'=>$hgr,'national_snapshot_id'=>$hnr,'achievements'=>json_encode($champions),'finalized_at'=>now()]);
        },3);
    }
}
