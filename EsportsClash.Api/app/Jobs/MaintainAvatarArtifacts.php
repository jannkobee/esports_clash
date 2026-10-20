<?php
namespace App\Jobs;

use App\Models\{AvatarEvolutionRun,AvatarVisualRelease,AvatarPreparation};
use App\Services\{AvatarEvolutionService,EvolutionService};
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUnique};
use Illuminate\Foundation\Queue\Queueable;

class MaintainAvatarArtifacts implements ShouldQueue,ShouldBeUnique
{
    use Queueable;
    public int $tries=3;
    public int $timeout=25;
    public int $uniqueFor=3600;
    public function __construct(){ $this->onConnection(config('avatars.queue_connection'))->onQueue(config('avatars.queue')); }
    public function handle(AvatarEvolutionService $service): void
    {
        $keep=AvatarVisualRelease::pluck('run_id')->merge(AvatarEvolutionRun::whereIn('status',[...$service::ACTIVE,'complete'])->pluck('id'))
            ->merge(AvatarEvolutionRun::latest()->limit(5)->pluck('id'));
        foreach(AvatarEvolutionRun::cursor()as $run)if($run->plan['parent']['run_id']??null)$keep->push($run->plan['parent']['run_id']);
        foreach(AvatarPreparation::whereIn('status',[...\App\Services\AvatarPreparationService::ACTIVE,'paused','pausing','cancelling'])->cursor() as $preparation)if($preparation->plan['rig_reuse']['id']??null)$keep->push($preparation->plan['rig_reuse']['id']);
        $keep=$keep->unique()->values()->all();
        $delete=AvatarEvolutionRun::whereIn('status',['failed','unchanged'])->where('created_at','<',now()->subDays(7))
            ->whereNull('artifacts_deleted_at')->whereNotIn('id',$keep)->limit(100)->pluck('id')->all();
        if(!$delete)return;
        $response=$service->worker()->post($service->endpoint('/retention'),['keep'=>$keep,'delete'=>$delete,'apply'=>true]);
        if(!$response->successful())return;
        $deleted=array_values(array_intersect($delete,$response->json('deleted',[])));
        AvatarEvolutionRun::whereIn('id',$deleted)->update(['artifacts_deleted_at'=>now()]);
        app(EvolutionService::class)->audit('avatars','avatar.safe-artifact-cleanup','artifact-maintenance',['deleted'=>$deleted,'protected_count'=>count($keep)]);
    }
}
