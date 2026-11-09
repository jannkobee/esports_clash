<?php
namespace App\Jobs;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
class RecordManagerCareers implements ShouldQueue {
 use Queueable;
 public $tries=3;
 public function __construct(public int $resultId){}
 public function handle(\App\Services\ManagerRecordBook $records):void {$records->capture($this->resultId);}
}
