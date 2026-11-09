<?php
namespace App\Jobs;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
class PublishWorldCoverage implements ShouldQueue {
    use Queueable;
    public int $timeout=25;
    public function __construct(public ?string $matchId=null){}
    public function handle(\App\Services\WorldMedia $media):void{if($this->matchId)$media->match($this->matchId);else $media->tick();}
}
