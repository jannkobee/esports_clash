<?php
namespace App\Jobs;

use App\Models\ClubTournament;
use App\Services\{CompetitionEngine, CompetitionQualification};
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\DB;

class ProcessCompetitionEdition implements ShouldQueue,ShouldBeUniqueUntilProcessing
{
    use Queueable;
    public int $tries=5; public int $timeout=25; public int $uniqueFor=120;
    public function __construct(public int $editionId) {}
    public function uniqueId(): string { return (string)$this->editionId; }
    public function middleware(): array { return [(new WithoutOverlapping('competition:'.$this->editionId))->releaseAfter(10)->expireAfter(40)]; }
    public function backoff(): array { return [10,30,60,120]; }
    public function handle(CompetitionEngine $engine,CompetitionQualification $qualification): void
    {
        try{
            $qualification->generate($this->editionId);
            app(\App\Services\BotPopulationService::class)->fill($this->editionId);
            $engine->advance($this->editionId);
        }
        catch(\Symfony\Component\HttpKernel\Exception\HttpException|\Illuminate\Validation\ValidationException $e){
            DB::transaction(function()use($e){$event=ClubTournament::whereKey($this->editionId)->lockForUpdate()->firstOrFail();$event->update(['status'=>'review']);
                DB::table('competition_audits')->insert(['action'=>'edition.review','subject'=>(string)$event->id,'details'=>json_encode(['reason'=>$e->getMessage()]),'created_at'=>now()]);});
        }
    }
}
