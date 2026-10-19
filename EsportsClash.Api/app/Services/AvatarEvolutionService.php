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
    public function profiles(): array
    {
        return json_decode(file_get_contents(config('avatars.profiles_path')),true,flags:JSON_THROW_ON_ERROR)['profiles'];
    }
    public function start(string $actor, ?string $avatarId=null, bool $scheduled=false, string $focus='balanced'): ?AvatarEvolutionRun
    {
        if($scheduled)return null; // Owner requested manual-only visual work.
        if(!config('avatars.engine_ready')) {
            if($scheduled)return null;
            throw ValidationException::withMessages(['avatar'=>'The autonomous art worker is being qualified. Existing assets remain active.']);
        }
        AvatarEvolutionSetting::current();
        return DB::transaction(function () use ($actor,$avatarId,$scheduled,$focus) {
            $settings=AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            if($scheduled&&(!$settings->enabled||!$settings->autonomous||$settings->next_cycle_at?->isFuture()))return null;
            if(AvatarEvolutionRun::whereIn('status',[...self::ACTIVE,'complete','cancelling'])->exists()) {
                if($scheduled)return null;
                throw ValidationException::withMessages(['avatar'=>'An art analysis or publication is already active.']);
            }
            $id=$avatarId??$settings->avatar_ids[$settings->cursor%count($settings->avatar_ids)];
            $meta=collect($this->catalog())->firstWhere('id',$id);$profile=$this->profiles()[$id]??null;
            if(!$meta||!$profile){if($scheduled)return null;throw ValidationException::withMessages(['avatar'=>'This avatar has no qualified character-specific art profile yet.']);}
            $parent=AvatarVisualRelease::where('avatar_id',$id)->where('variant',$meta['variant'])->where('active',true)->first();
            $run=AvatarEvolutionRun::create(['id'=>(string)Str::uuid(),'avatar_id'=>$id,'plan'=>[
                'version'=>2,'avatar'=>$meta,'candidates'=>$settings->candidates_per_cycle,'generations'=>1,
                'storage_gib'=>$settings->storage_gib,'parent'=>$parent?['run_id'=>$parent->run_id,'file'=>$parent->file,'sha256'=>$parent->sha256]:null,
                'parent_release_id'=>$parent?->id,'original_sha256'=>$meta['sha256'],'owner_approval_required'=>false,'automatic_publish'=>true,
                'profile_hash'=>hash('sha256',json_encode($profile,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)),
                'profile'=>$profile,'provider'=>'local','external_budget_usd'=>0,'problem_driven'=>true,'focus'=>$focus,
                'revision'=>AvatarEvolutionRun::where('avatar_id',$id)->count()+1,
            ]]);
            $settings->update(['cursor'=>$settings->cursor+1,'next_cycle_at'=>now()->addMinutes($settings->interval_minutes)]);
            app(EvolutionService::class)->audit($run->id,'avatar.analysis-queued',$actor,['avatar_id'=>$id]);
            DB::afterCommit(fn()=>PollAvatarEvolution::dispatch($run->id));
            return $run;
        });
    }
    public function decide(string $id,string $candidateId,string $action,string $feedback,string $actor): void
    {
        throw ValidationException::withMessages(['candidate'=>'Visual upgrades use automatic validation. Manual approval and rejection have been retired.']);
    }
    public function publicationProblems(AvatarEvolutionRun $run,array $candidate): array
    {
        $report=$run->report;$base=$report['baseline']??[];$render=$candidate['render']??[];$profile=$run->plan['profile']??[];$problems=[];
        if(($run->plan['version']??0)!==2||($run->plan['automatic_publish']??false)!==true||($run->plan['owner_approval_required']??true)!==false)$problems[]='Historical or non-autonomous plan';
        if(($report['engine']??'')!=='problem-driven-art-v2'||($report['source_hash']??'')!==($run->plan['parent']['sha256']??$run->plan['original_sha256']))$problems[]='Source/version evidence mismatch';
        if(($report['art_analysis']['profile_hash']??'')!==($run->plan['profile_hash']??null))$problems[]='Art direction profile mismatch';
        if(($candidate['validation']['passed']??false)!==true||($render['passed']??false)!==true||($candidate['gltf']['errors']??1)!==0)$problems[]='Technical/render/glTF validation missing or failed';
        if(($render['gameplay']['passed']??false)!==true||!empty($render['shader_errors'])||($render['textures']['detailed_materials']??0)<1||($render['textures']['missing_detail_maps']??1)!==0)$problems[]='Gameplay-scale/shader/texture validation absent or failed';
        if(($render['worker_memory']['anonymous_mib']??PHP_INT_MAX)>1100)$problems[]='Preview RAM validation absent or exceeded';
        if(($candidate['improvement']['qualifies']??false)!==true||!empty($candidate['improvement']['reasons']))$problems[]='No qualified improvement';
        $addressed=$candidate['issues_addressed']??[];$known=collect($report['art_analysis']['issues']??[])->where('generatable',true)->pluck('id')->all();
        $remaining=array_column($candidate['art_analysis']['issues']??[],'id');
        if(!$addressed||array_diff($addressed,$known)||array_intersect($addressed,$remaining))$problems[]='No supported unresolved issue was demonstrably resolved';
        foreach(['rig_and_bind_matrices_preserved','topology_and_skin_weights_preserved','key_times_and_root_motion_preserved','original_licensed_images_preserved','gameplay_stats_and_hitboxes_untouched']as $key)
            if(($candidate['validation']['checks'][$key]??false)!==true)$problems[]='Preservation witness missing: '.$key;
        if(!preg_match('/^candidate-\d{2}\.glb$/',$candidate['file']??'')||!preg_match('/^[a-f0-9]{64}$/',$candidate['sha256']??''))$problems[]='Invalid immutable artifact identity';
        if(($candidate['bytes']??PHP_INT_MAX)>config('avatars.max_asset_bytes'))$problems[]='Asset size budget exceeded';
        if(!$base||!$profile)$problems[]='Baseline/profile measurements absent';
        else {
            $metrics=$candidate['analysis']['performance']??[];$original=$base['analysis']['performance']??[];$b=$base['render']??[];
            if(($metrics['triangles']??PHP_INT_MAX)>min($original['triangles']??0,$profile['budgets']['max_triangles']))$problems[]='Triangle count increased';
            if(($metrics['materials']??PHP_INT_MAX)>($original['materials']??0)||($render['renderer']['draw_calls']??PHP_INT_MAX)>($b['renderer']['draw_calls']??0))$problems[]='Materials/draw calls increased';
            if(($candidate['added_texture_mib']??PHP_INT_MAX)>$profile['budgets']['max_added_texture_mib'])$problems[]='Texture memory budget exceeded';
            if(($candidate['blender']['bind_pose_intersection_pairs']??PHP_INT_MAX)>($base['blender']['bind_pose_intersection_pairs']??0))$problems[]='Clipping proxy worsened';
            foreach(['planted_foot_step_drift','blend_hand_step_jump']as $metric)if(($render[$metric]??PHP_INT_MAX)>($b[$metric]??0)+.001)$problems[]='Animation metric worsened';
            if(($render['renderer']['mean_frame_ms']??PHP_INT_MAX)>($b['renderer']['mean_frame_ms']??0)*(1+$profile['budgets']['max_frame_regression_fraction']))$problems[]='Local frame-cost regression';
            if(count($render['views']??[])<3)$problems[]='Standardized views absent';
            foreach($render['views']??[]as $index=>$view){$ratio=($view['silhouette']['occupied_pixels']??0)/max(1,$b['views'][$index]['silhouette']['occupied_pixels']??0);
                if($ratio<.98||$ratio>1.02||($view['silhouette']['clipped']??true))$problems[]='Silhouette changed beyond tolerance';}
        }
        return array_unique($problems);
    }
    public function finalize(string $id): void
    {
        $run=AvatarEvolutionRun::findOrFail($id);if($run->status!=='complete')return;
        $remote=$this->worker()->get($this->endpoint('/runs/'.$id))->throw()->json();
        if(($remote['manifest_hash']??null)!==$run->manifest_hash||($remote['report']??null)!==$run->report)throw ValidationException::withMessages(['candidate'=>'Worker evidence no longer matches the frozen manifest.']);
        DB::transaction(function () use ($id) {
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);$run=AvatarEvolutionRun::lockForUpdate()->findOrFail($id);
            if($run->status!=='complete')return;
            $candidate=collect($run->report['candidates']??[])->firstWhere('id',$run->report['selection']??null);
            $problems=$candidate?$this->publicationProblems($run,$candidate):['No eligible candidate; retain the existing model.'];
            $variant=$run->plan['avatar']['variant'];$current=AvatarVisualRelease::where('avatar_id',$run->avatar_id)->where('variant',$variant)->where('active',true)->lockForUpdate()->first();
            if(($current?->sha256??$run->plan['original_sha256'])!==($run->plan['parent']['sha256']??$run->plan['original_sha256']))$problems[]='Current version changed after analysis';
            if($candidate&&AvatarVisualRelease::where('avatar_id',$run->avatar_id)->where('variant',$variant)->where('sha256',$candidate['sha256']??'')->whereNotNull('quarantined_at')->exists())$problems[]='Artifact hash was quarantined and cannot be redeployed';
            if($problems){$run->update(['status'=>'unchanged','decisions'=>['automatic'=>['action'=>'retain-current','reasons'=>$problems,'at'=>now()->toIso8601String()]]]);
                app(EvolutionService::class)->audit($id,'avatar.kept-current','automatic-validation',['reasons'=>$problems]);return;}
            $version=(AvatarVisualRelease::where('avatar_id',$run->avatar_id)->where('variant',$variant)->max('version')??1)+1;
            // The immediately preceding version was just rendered as the frozen
            // baseline. Record that evidence without changing its old decisions.
            $current?->update(['health_status'=>'healthy','health_failures'=>0,'last_checked_at'=>now(),
                'health_report'=>['status'=>'healthy','source'=>'publication-baseline-validation','renderer'=>$run->report['baseline']['render']['renderer']]]);
            AvatarVisualRelease::where('avatar_id',$run->avatar_id)->where('variant',$variant)->update(['active'=>false]);
            $release=AvatarVisualRelease::create(['avatar_id'=>$run->avatar_id,'variant'=>$variant,'version'=>$version,'run_id'=>$id,
                'candidate_id'=>$candidate['id'],'file'=>$candidate['file'],'sha256'=>$candidate['sha256'],'source_sha256'=>$run->report['source_hash'],
                'previous_release_id'=>$current?->id,'validation'=>$candidate['validation'],'approved_by'=>'automatic-validation','health_status'=>'pending']);
            $run->update(['status'=>'deployed','decisions'=>['automatic'=>['action'=>'published','candidate'=>$candidate['id'],'release_id'=>$release->id,'at'=>now()->toIso8601String()]]]);
            app(EvolutionService::class)->audit($id,'avatar.auto-published','automatic-validation',['candidate'=>$candidate['id'],'release_id'=>$release->id]);
            DB::afterCommit(fn()=>\App\Jobs\CheckAvatarVisualHealth::dispatch($release->id)->delay(now()->addSeconds(30)));
        });
    }
    public function recordHealth(int $releaseId,array $report): void
    {
        if(!in_array($report['status']??null,['healthy','failed','inconclusive'],true))return;
        DB::transaction(function () use ($releaseId,$report) {
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);$release=AvatarVisualRelease::lockForUpdate()->findOrFail($releaseId);
            if(!$release->active||($report['release_id']??null)!==$releaseId||($report['sha256']??'')!==$release->sha256)return;
            $release->last_checked_at=now();$release->health_report=$report;
            if($report['status']==='inconclusive'){$release->save();return;}
            if($report['status']==='healthy'){$release->health_failures=0;$release->health_status='healthy';$release->save();return;}
            $release->health_failures++;$release->health_status='suspect';$release->save();
            if($release->health_failures<config('avatars.health_failure_limit'))return;
            $previous=$release->previous_release_id?AvatarVisualRelease::find($release->previous_release_id):null;
            if($previous&&($previous->avatar_id!==$release->avatar_id||$previous->variant!==$release->variant||$previous->version>=$release->version||$previous->quarantined_at||$previous->health_status!=='healthy'))$previous=null;
            AvatarVisualRelease::where('avatar_id',$release->avatar_id)->where('variant',$release->variant)->update(['active'=>false]);
            $previous?->update(['active'=>true]);$release->update(['active'=>false,'health_status'=>'quarantined','quarantined_at'=>now(),'rollback_reason'=>$report['reason']??'Repeated trusted runtime canary failure']);
            app(EvolutionService::class)->audit($release->run_id,'avatar.automatic-rollback','trusted-runtime-canary',['failed_release'=>$release->id,'restored_release'=>$previous?->id,'reason'=>$release->rollback_reason]);
        });
    }
    public function rollback(string $avatarId,?int $releaseId,string $actor): void
    {
        DB::transaction(function () use ($avatarId,$releaseId,$actor) {
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            $meta=collect($this->catalog())->firstWhere('id',$avatarId);
            if(!$meta)throw ValidationException::withMessages(['avatar'=>'Unknown avatar.']);
            $release=$releaseId?AvatarVisualRelease::where('avatar_id',$avatarId)->where('variant',$meta['variant'])->findOrFail($releaseId):null;
            if($release?->quarantined_at)throw ValidationException::withMessages(['avatar'=>'A quarantined artifact cannot be reactivated.']);
            AvatarVisualRelease::where('avatar_id',$avatarId)->where('variant',$meta['variant'])->update(['active'=>false]);
            $release?->update(['active'=>true]);
            app(EvolutionService::class)->audit($avatarId,'avatar.rollback',$actor,['release_id'=>$releaseId,'fallback'=>$releaseId===null]);
        });
    }
}
