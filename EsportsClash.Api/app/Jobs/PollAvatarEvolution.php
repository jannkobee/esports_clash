<?php
namespace App\Jobs;
use App\Models\AvatarEvolutionRun;
use App\Services\AvatarEvolutionService;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUniqueUntilProcessing};
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
class PollAvatarEvolution implements ShouldQueue,ShouldBeUniqueUntilProcessing
{
    use Queueable;
    public int $tries=10;
    public int $timeout=25;
    public int $uniqueFor=90;
    public function __construct(public string $runId) {}
    public function uniqueId(): string { return $this->runId; }
    public function backoff(): array { return [15,30,60]; }
    public function handle(AvatarEvolutionService $service): void
    {
        $run=AvatarEvolutionRun::findOrFail($this->runId);
        if(!in_array($run->status,AvatarEvolutionService::ACTIVE,true))return;
        $service->worker()->post($service->endpoint('/runs/'.$run->id),$run->plan)->throw();
        $state=$service->worker()->get($service->endpoint('/runs/'.$run->id))->throw()->json();
        DB::transaction(function () use ($state) {
            $run=AvatarEvolutionRun::lockForUpdate()->findOrFail($this->runId);
            if(!in_array($run->status,AvatarEvolutionService::ACTIVE,true))return;
            $run->update(['status'=>$state['status'],'report'=>$state['report']??null,'manifest_hash'=>$state['manifest_hash']??null,'error'=>$state['error']??null]);
        });
        if(in_array($state['status'],AvatarEvolutionService::ACTIVE,true))self::dispatch($run->id)->delay(now()->addSeconds(20));
    }
}
