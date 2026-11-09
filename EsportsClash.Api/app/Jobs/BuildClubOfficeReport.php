<?php
namespace App\Jobs;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUnique};
use Illuminate\Foundation\Queue\Queueable;
class BuildClubOfficeReport implements ShouldQueue,ShouldBeUnique {
    use Queueable;
    public int $timeout=25;public int $uniqueFor=300;
    public function __construct(public int $clubId){}
    public function uniqueId():string{return (string)$this->clubId;}
    public function handle(\App\Services\ClubOffice $office):void{if($club=\App\Models\OnlineClub::find($this->clubId)){$office->sync($club);$office->weekly($club);}}
}
