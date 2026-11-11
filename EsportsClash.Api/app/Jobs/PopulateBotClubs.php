<?php
namespace App\Jobs;
use App\Services\BotPopulationService;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
class PopulateBotClubs implements ShouldQueue,ShouldBeUniqueUntilProcessing
{
    use Queueable;
    public int $tries=4;public int $timeout=25;public int $uniqueFor=120;
    public function __construct(public int $target, public bool $ownerRequested=false){}
    public function uniqueId():string{return (string)$this->target;}
    public function middleware():array{return [(new WithoutOverlapping('world:population'))->releaseAfter(10)->expireAfter(40)];}
    public function handle(BotPopulationService $population):void{
        // Old serialized replenishment jobs must not create replacement bots after a takeover.
        if(!($this->ownerRequested??false)||!app(\App\Services\LivingWorldEngine::class)->managementAllowed())return;
        $current=\App\Models\OnlineClub::where('is_bot',true)->count();$result=$population->populate(min($this->target,$current+20));
        \App\Models\ClubTournament::where('status','registration')->chunkById(100,function($events)use($population){foreach($events as $e)$population->fill($e->id);});
        if($result['bot_clubs']<$this->target)self::dispatch($this->target,true)->delay(now()->addSeconds(5));
    }
}
