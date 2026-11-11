<?php
namespace App\Jobs;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
class PublishWorldCoverage implements ShouldQueue,ShouldBeUniqueUntilProcessing {
    use Queueable;
    public int $timeout=25;
    public int $uniqueFor=120;
    public function uniqueId():string{return $this->matchId??'world-coverage';}
    public function middleware():array{return [(new \Illuminate\Queue\Middleware\WithoutOverlapping('world-coverage'))->shared()->releaseAfter(10)->expireAfter(45)];}
    public function __construct(public ?string $matchId=null){}
    public function handle(\App\Services\WorldMedia $media):void{if($this->matchId)$media->match($this->matchId);else AdvanceLivingWorld::enqueue();}
}
