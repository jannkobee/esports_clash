<?php
namespace App\Jobs;
use App\Services\CompetitionRankings;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
class BuildCompetitionRankingSnapshot implements ShouldQueue,ShouldBeUniqueUntilProcessing
{
    use Queueable;
    public int $tries=4;public int $timeout=900;public int $uniqueFor=1200;
    public function __construct(public string $system,public string $purpose){$this->onConnection('competition_rankings');}
    public function uniqueId():string{return $this->purpose;}
    public function middleware():array{return [(new WithoutOverlapping('ranking-snapshot:'.$this->purpose))->releaseAfter(30)->expireAfter(1200)];}
    public function handle(CompetitionRankings $rankings):void{$rankings->snapshot($this->system,$this->purpose);}
}
