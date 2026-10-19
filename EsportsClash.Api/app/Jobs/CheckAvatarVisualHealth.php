<?php
namespace App\Jobs;

use App\Models\AvatarVisualRelease;
use App\Services\AvatarEvolutionService;
use Illuminate\Contracts\Queue\{ShouldQueue,ShouldBeUnique};
use Illuminate\Foundation\Queue\Queueable;

class CheckAvatarVisualHealth implements ShouldQueue,ShouldBeUnique
{
    use Queueable;
    public int $tries=3;
    public int $timeout=110;
    public int $uniqueFor=600;
    public function __construct(public int $releaseId) { $this->onConnection(config('avatars.queue_connection'))->onQueue(config('avatars.queue')); }
    public function uniqueId(): string { return 'visual-health:'.$this->releaseId; }
    public function handle(AvatarEvolutionService $service): void
    {
        $release=AvatarVisualRelease::find($this->releaseId);if(!$release?->active)return;
        try {
            $response=$service->worker()->timeout(95)->post($service->endpoint('/probes'),[
                'release_id'=>$release->id,'run_id'=>$release->run_id,'file'=>$release->file,'sha256'=>$release->sha256]);
            $report=$response->successful()?$response->json():['status'=>'inconclusive','reason'=>'Worker busy or unavailable'];
        }catch(\Throwable){$report=['status'=>'inconclusive','reason'=>'Runtime canary unavailable; no rollback from infrastructure failure alone.'];}
        if(($report['status']??null)==='inconclusive')$report+=['release_id'=>$release->id,'sha256'=>$release->sha256];
        $service->recordHealth($release->id,$report);
    }
}
