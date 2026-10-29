<?php
namespace App\Services;
use App\Models\{EvolutionRun,TrellisGeneration,AvatarPreparation,AvatarEvolutionRun,AvatarEvolutionSetting,BalanceReview};
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReportDeletionService {
    public const MODELS=['ml'=>EvolutionRun::class,'generation'=>TrellisGeneration::class,'preparation'=>AvatarPreparation::class,'enhancement'=>AvatarEvolutionRun::class];
    public function canDelete(string $type, string $status,?array $control=null): bool {
        if($type==='preparation'&&!empty($control['intent']))return false;
        $busy=$type==='ml'?['queued','running','stopping','paused_resource','paused_budget']:array_diff(AvatarJobCancellationService::CANCELLABLE,['ready','needs_review','awaiting_retarget','awaiting_validation','complete']);
        return !in_array($status,$busy,true)&&!($type==='enhancement'&&$status==='complete');
    }
    public function delete(string $type, array $ids): void {
        abort_unless(isset(self::MODELS[$type]),404);
        $model=self::MODELS[$type];sort($ids);
        DB::transaction(function()use($type,$ids,$model){
            if($type==='preparation') {
                // Serialize against admission: a new retry cannot appear halfway
                // through clearing its report and make an older row reappear.
                AvatarEvolutionSetting::current();
                AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
                $selected=AvatarPreparation::whereKey($ids)->get();
                if($selected->count()!==count(array_unique($ids)))throw (new \Illuminate\Database\Eloquent\ModelNotFoundException)->setModel(AvatarPreparation::class,$ids);
                $ids=AvatarPreparation::whereIn('generation_id',$selected->pluck('generation_id'))->orderBy('id')->pluck('id')->all();
            }
            // Validate every locked row before changing any row. Mixed active/finished
            // selections fail atomically, including status races after page rendering.
            $runs=[];
            foreach($ids as $id) {
                $run=$model::lockForUpdate()->findOrFail($id);
                if(!$this->canDelete($type,$run->status,$type==='preparation'?$run->control:null)) throw ValidationException::withMessages(['report'=>'Stop or cancel active jobs before deleting reports. Nothing in this selection was deleted.']);
                if($type==='ml'&&BalanceReview::where('run_id',$id)->where('status','open')->exists())throw ValidationException::withMessages(['report'=>'Resolve this study\'s open balance review before deleting its report.']);
                if($type==='ml'&&!in_array($run->plan['version']??0,[3,4],true)&&$run->status==='completed'&&!BalanceReview::where('run_id',$id)->exists())throw ValidationException::withMessages(['report'=>'The completed study is still creating its review. Wait for that review before deleting its report.']);
                $runs[]=$run;
            }
            foreach($runs as $run) {
                $fields=match($type){'ml'=>['progress'=>[],'result'=>null,'error'=>null],'preparation'=>['control'=>null,'progress'=>null,'state'=>null,'error'=>null],'generation'=>['state'=>null,'error'=>null],default=>['report'=>null,'decisions'=>null,'error'=>null]};
                $run->update([...$fields,'plan'=>['report_deleted'=>true]]);$run->delete();
                if($type==='preparation') {
                    $mirror=AvatarEvolutionRun::where('id',$run->id)->where('plan->version',3)->lockForUpdate()->first();
                    if($mirror){$mirror->update(['report'=>null,'decisions'=>null,'error'=>null,'plan'=>['version'=>3,'report_deleted'=>true]]);$mirror->delete();}
                }
                DB::table('evolution_audits')->where('subject_id',$run->id)->update(['details'=>'{}']);
            }
        });
    }
}
