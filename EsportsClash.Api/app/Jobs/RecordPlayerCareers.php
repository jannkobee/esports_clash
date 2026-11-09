<?php
namespace App\Jobs;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
class RecordPlayerCareers implements ShouldQueue {
 use Queueable;
 public $tries=3;
 public function __construct(public string $matchId){}
 public function handle(\App\Services\PlayerRecordBook $book):void {$book->capture($this->matchId);}
}
