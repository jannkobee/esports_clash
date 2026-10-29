<?php
namespace App\Services;

use App\Models\AvatarPreparation;
use Illuminate\Support\Collection;

class PreparationReportService {
    /** One stable report per generated model, with immutable executions underneath. */
    public function recent(?string $avatarId=null): Collection {
        $sources=AvatarPreparation::when($avatarId,fn($query)=>$query->where('avatar_id',$avatarId))->select('generation_id')->groupBy('generation_id')
            ->orderByRaw('MAX(created_at) desc')->limit(100)->pluck('generation_id');
        return $this->group(AvatarPreparation::whereIn('generation_id',$sources)->get());
    }

    public function forAttempt(AvatarPreparation $attempt): AvatarPreparation {
        return $this->group(AvatarPreparation::where('generation_id',$attempt->generation_id)->get())->first();
    }

    private function group(Collection $runs): Collection {
        return $runs->groupBy('generation_id')->map(function(Collection $attempts) {
            $byId=$attempts->keyBy('id');
            $depth=function($run)use($byId) {
                $seen=[];
                while($run && !isset($seen[$run->id])) {
                    $seen[$run->id]=true;
                    $run=$byId->get($run->previous_preparation_id);
                }
                return count($seen);
            };
            $attempts=$attempts->sortBy(fn($run)=>[$run->created_at->getTimestamp(),$depth($run),$run->id])->values();
            // A running execution takes priority over historical terminal results.
            $current=clone ($attempts->last(fn($run)=>in_array($run->status,[...AvatarPreparationService::ACTIVE,'pausing','cancelling'],true))??$attempts->last());
            $current->setRelation('reportAttempts',$attempts);
            $current->setAttribute('report_id',$attempts->first()->id);
            $current->setAttribute('report_started_at',$attempts->first()->created_at);
            return $current;
        })->sortBy(fn($run)=>$run->report_started_at)->values();
    }
}
