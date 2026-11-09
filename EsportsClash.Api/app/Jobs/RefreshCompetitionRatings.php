<?php
namespace App\Jobs;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Carbon\CarbonImmutable;

class RefreshCompetitionRatings implements ShouldQueue,ShouldBeUniqueUntilProcessing
{
    use Queueable;
    public int $tries=4;public int $timeout=25;public int $uniqueFor=300;
    public function __construct(public int $afterId=0){}
    public function uniqueId():string{return (string)$this->afterId;}
    public function handle():void {
        $settings=app(\App\Services\CompetitionCalendar::class)->settings();
        $rows=DB::table('competition_ratings')->where('id','>',$this->afterId)->orderBy('id')->limit(500)->get();
        foreach($rows as $row){
            $days=$row->last_played_at?CarbonImmutable::parse($row->last_played_at)->diffInDays(now('UTC')):0;
            $deviation=min(350,sqrt($row->deviation**2+($row->volatility*173.7178)**2*($days/7)));
            $achievement=$row->achievement*pow(0.5,$days/$settings['achievement_half_life_days']);
            $skill=1000/(1+exp(-(($row->rating-2*$deviation)-1500)/350));
            DB::table('competition_ratings')->where('id',$row->id)->where('last_played_at',$row->last_played_at)->update(['score'=>$settings['skill_weight']*$skill+$settings['achievement_weight']*$achievement]);
        }
        if($rows->count()===500)self::dispatch($rows->last()->id);
    }
}
