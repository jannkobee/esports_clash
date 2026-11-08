<?php
namespace App\Jobs;
use App\Services\CommunityCups;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
class BuildCommunityPods implements ShouldQueue,ShouldBeUniqueUntilProcessing {
    use Queueable;
    public int $tries=3;public int $timeout=30;public int $uniqueFor=120;
    public function __construct(public int $weekId,public int $tier){}
    public function uniqueId():string{return $this->weekId.':'.$this->tier;}
    public function middleware():array{return [(new WithoutOverlapping('community-pods:'.$this->weekId.':'.$this->tier))->releaseAfter(10)->expireAfter(45)];}
    public function handle(CommunityCups $cups):void {if($cups->buildPod($this->weekId,$this->tier))self::dispatch($this->weekId,$this->tier)->delay(now()->addSeconds(2));}
}
