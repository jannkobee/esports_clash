<?php
namespace App\Services;

use App\Jobs\PollAvatarEvolution;
use App\Models\{AvatarEvolutionRun,AvatarEvolutionSetting,AvatarVisualRelease};
use Illuminate\Support\Facades\{DB,Http};
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AvatarEvolutionService
{
    public const ACTIVE = ['queued','running','paused_resource'];
    public function catalog(): array { return json_decode(file_get_contents(resource_path('avatars/catalog.json')),true,flags:JSON_THROW_ON_ERROR)['avatars']; }
    public function worker() { return Http::withToken(config('avatars.worker_token'))->connectTimeout(3)->timeout(15); }
    public function endpoint(string $path): string { return rtrim(config('avatars.worker_url'),'/').$path; }
    public function start(string $actor, ?string $avatarId=null, bool $scheduled=false, string $focus='balanced'): ?AvatarEvolutionRun
    {
        AvatarEvolutionSetting::current();
        return DB::transaction(function () use ($actor,$avatarId,$scheduled,$focus) {
            $settings=AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            if($scheduled&&(!$settings->enabled||$settings->next_cycle_at?->isFuture()))return null;
            if(AvatarEvolutionRun::whereIn('status',self::ACTIVE)->exists()) {
                if($scheduled)return null;
                throw ValidationException::withMessages(['avatar'=>'An avatar cycle is already active.']);
            }
            if(AvatarEvolutionRun::where('status','review')->count()>=$settings->max_pending) {
                if($scheduled)return null;
                throw ValidationException::withMessages(['avatar'=>'Review existing candidates before generating more.']);
            }
            $id=$avatarId??$settings->avatar_ids[$settings->cursor%count($settings->avatar_ids)];
            if($scheduled&&AvatarEvolutionRun::where('avatar_id',$id)->where('status','review')->exists())return null;
            $meta=collect($this->catalog())->firstWhere('id',$id);
            if(!$meta)throw ValidationException::withMessages(['avatar'=>'Unknown avatar.']);
            $parent=AvatarVisualRelease::where('avatar_id',$id)->where('variant',$meta['variant'])->where('active',true)->first();
            $feedback=AvatarEvolutionRun::where('avatar_id',$id)->whereNotNull('decisions')->latest()->limit(10)->get()->map(fn($r)=>['run'=>$r->id,'decisions'=>$r->decisions])->all();
            $run=AvatarEvolutionRun::create(['id'=>(string)Str::uuid(),'avatar_id'=>$id,'plan'=>[
                'version'=>1,'avatar'=>$meta,'candidates'=>$settings->candidates_per_cycle,'generations'=>$settings->generations,
                'storage_gib'=>$settings->storage_gib,'parent'=>$parent?['run_id'=>$parent->run_id,'file'=>$parent->file,'sha256'=>$parent->sha256]:null,
                'original_sha256'=>$meta['sha256'],'feedback'=>$feedback,'owner_approval_required'=>true,'automatic_publish'=>false,
                'revision'=>AvatarEvolutionRun::where('avatar_id',$id)->count()+1,'focus'=>$focus,
            ]]);
            $settings->update(['cursor'=>$settings->cursor+1,'next_cycle_at'=>now()->addMinutes($settings->interval_minutes)]);
            app(EvolutionService::class)->audit($run->id,'avatar.queued',$actor,['avatar_id'=>$id]);
            DB::afterCommit(fn()=>PollAvatarEvolution::dispatch($run->id));
            return $run;
        });
    }
    public function decide(string $id,string $candidateId,string $action,string $feedback,string $actor): void
    {
        $run=AvatarEvolutionRun::findOrFail($id);
        if($action==='approve') {
            $remote=$this->worker()->get($this->endpoint('/runs/'.$id))->throw()->json();
            if(($remote['manifest_hash']??null)!==$run->manifest_hash||($remote['report']??null)!==$run->report)throw ValidationException::withMessages(['candidate'=>'Worker evidence no longer matches the reviewed manifest.']);
        }
        DB::transaction(function () use ($id,$candidateId,$action,$feedback,$actor) {
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            $run=AvatarEvolutionRun::lockForUpdate()->findOrFail($id);
            $candidate=collect($run->report['candidates']??[])->firstWhere('id',$candidateId);
            $decisions=$run->decisions??[];
            if($run->status!=='review'||!$candidate||isset($decisions[$candidateId]))throw ValidationException::withMessages(['candidate'=>'Choose an undecided candidate from this review.']);
            if($action==='approve') {
                if(!($candidate['validation']['passed']??false)||!($candidate['render']['passed']??false))throw ValidationException::withMessages(['candidate'=>'Technical and rendered validation must both pass.']);
                $current=AvatarVisualRelease::where('avatar_id',$run->avatar_id)->where('variant',$run->plan['avatar']['variant'])->where('active',true)->lockForUpdate()->first();
                if(($current?->sha256??$run->plan['original_sha256'])!==($run->plan['parent']['sha256']??$run->plan['original_sha256']))throw ValidationException::withMessages(['candidate'=>'The visual version changed after this cycle. Regenerate from the current version.']);
                $version=(AvatarVisualRelease::where('avatar_id',$run->avatar_id)->where('variant',$run->plan['avatar']['variant'])->max('version')??1)+1;
                AvatarVisualRelease::where('avatar_id',$run->avatar_id)->where('variant',$run->plan['avatar']['variant'])->update(['active'=>false]);
                AvatarVisualRelease::create(['avatar_id'=>$run->avatar_id,'variant'=>$run->plan['avatar']['variant'],'version'=>$version,
                    'run_id'=>$id,'candidate_id'=>$candidateId,'file'=>$candidate['file'],'sha256'=>$candidate['sha256'],
                    'validation'=>$candidate['validation'],'approved_by'=>$actor]);
                foreach($run->report['candidates'] as $other)if($other['id']!==$candidateId&&!isset($decisions[$other['id']]))$decisions[$other['id']]=['action'=>'not-selected','at'=>now()->toIso8601String()];
            }
            $decisions[$candidateId]=['action'=>$action,'feedback'=>$feedback,'actor'=>$actor,'at'=>now()->toIso8601String()];
            $run->update(['decisions'=>$decisions,'status'=>count($decisions)>=count($run->report['candidates'])?'reviewed':'review']);
            app(EvolutionService::class)->audit($id,'avatar.'.$action,$actor,['candidate'=>$candidateId,'feedback'=>$feedback]);
        });
    }
    public function rollback(string $avatarId,?int $releaseId,string $actor): void
    {
        DB::transaction(function () use ($avatarId,$releaseId,$actor) {
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            $meta=collect($this->catalog())->firstWhere('id',$avatarId);
            if(!$meta)throw ValidationException::withMessages(['avatar'=>'Unknown avatar.']);
            $release=$releaseId?AvatarVisualRelease::where('avatar_id',$avatarId)->where('variant',$meta['variant'])->findOrFail($releaseId):null;
            AvatarVisualRelease::where('avatar_id',$avatarId)->where('variant',$meta['variant'])->update(['active'=>false]);
            $release?->update(['active'=>true]);
            app(EvolutionService::class)->audit($avatarId,'avatar.rollback',$actor,['release_id'=>$releaseId,'fallback'=>$releaseId===null]);
        });
    }
}
