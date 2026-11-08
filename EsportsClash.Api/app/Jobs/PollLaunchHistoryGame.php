<?php
namespace App\Jobs;
use App\Services\LaunchChampionship;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\{DB,Http};
class PollLaunchHistoryGame implements ShouldQueue,ShouldBeUniqueUntilProcessing
{
    use Queueable;
    public int $timeout=25;public int $tries=8;public int $uniqueFor=90;
    public function __construct(public int $gameId){}
    public function uniqueId():string{return (string)$this->gameId;}
    public function middleware():array{return [(new WithoutOverlapping('archive:'.$this->gameId))->releaseAfter(15)->expireAfter(40)];}
    public function handle(LaunchChampionship $archive):void{
        $game=DB::table('launch_history_games')->find($this->gameId);if(!$game||$game->winner_id||$game->status==='failed')return;
        $game=$archive->allocation($this->gameId);$http=Http::withToken(config('online.worker_token'))->connectTimeout(3)->timeout(10);
        $url=rtrim(config('online.history_worker_url'),'/').'/history/'.$game->run_id;
        $start=$http->post($url,['plan'=>json_decode($game->allocation,true),'plan_hash'=>$game->allocation_hash]);
        if($start->status()===409){self::dispatch($this->gameId)->delay(now()->addSeconds(20));return;}$start->throw();
        $state=$http->get($url)->throw()->json();
        if($state['status']==='completed'){$archive->settle($this->gameId,$state['result']);$archive->tick();}
        elseif($state['status']==='failed')DB::table('launch_history_games')->where('id',$this->gameId)->update(['status'=>'failed','error'=>mb_substr($state['error']??'Archive worker failed',0,500)]);
        else {DB::table('launch_history_games')->where('id',$this->gameId)->update(['status'=>$state['status']==='running'?'running':'queued']);self::dispatch($this->gameId)->delay(now()->addSeconds(10));}
    }
}
