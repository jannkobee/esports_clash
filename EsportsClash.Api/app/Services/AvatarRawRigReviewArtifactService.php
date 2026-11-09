<?php
namespace App\Services;

use App\Models\AvatarPreparation;
use Illuminate\Support\Facades\Storage;

/** Retained diagnostic playback, never a qualified animation artifact. */
class AvatarRawRigReviewArtifactService {
    private function proof(AvatarPreparation $run):array {
        $review=$run->state['raw_review']??[];
        $report=$review['report']??[];
        abort_unless(($run->plan['profile']??null)===AvatarCloudRawRigService::PROFILE
            &&($review['status']??null)==='completed'
            &&($report['compute']??null)==='google'
            &&($report['source_sha256']??null)===($run->plan['source_sha256']??null)
            &&($report['rig_sha256']??null)===($run->state['cloud_raw_rig']['artifact']['sha256']??null)
            &&($report['publication_eligible']??true)===false,409,'Diagnostic lineage mismatch.');
        $proof=$report['stress_artifact']??[];
        abort_unless(preg_match('/^[a-f0-9]{64}$/',$proof['sha256']??'')
            &&is_int($proof['bytes']??null)&&$proof['bytes']>=20&&$proof['bytes']<=64*1024**2,409);
        return $proof;
    }
    private function path(AvatarPreparation $run,array $proof):string {
        return 'avatar-preparations/'.$run->id.'/diagnostics/'.$proof['sha256'].'.glb';
    }
    private function candidateProof(AvatarPreparation $run,string $reviewId):array {
        abort_unless(\Illuminate\Support\Str::isUuid($reviewId),404);
        $details=$run->state['skinning_reviews'][$reviewId]??[];$report=$details['report']??[];$proof=$report['artifact']??[];
        abort_unless(($run->plan['profile']??null)===AvatarCloudRawRigService::PROFILE
            &&($details['plan']['id']??null)===$reviewId&&($details['plan']['compute']??null)==='google'
            &&($report['compute']??null)==='google'&&($report['qualification_complete']??true)===false
            &&($report['publication_eligible']??true)===false
            &&($report['source_sha256']??null)===($run->plan['source_sha256']??null)
            &&($report['rig_sha256']??null)===($run->state['cloud_raw_rig']['artifact']['sha256']??null)
            &&preg_match('/^[a-f0-9]{64}$/',$proof['sha256']??'')&&is_int($proof['bytes']??null)
            &&$proof['bytes']>=20&&$proof['bytes']<=64*1024**2,409,'Candidate lineage mismatch.');
        return $proof;
    }
    private function candidatePath(AvatarPreparation $run,array $proof):string {
        return 'avatar-preparations/'.$run->id.'/diagnostics/'.$proof['sha256'].'.glb';
    }
    private function verify(string $bytes,array $proof):void {
        abort_unless(strlen($bytes)===$proof['bytes']&&hash_equals($proof['sha256'],hash('sha256',$bytes))
            &&substr($bytes,0,4)==='glTF',409,'Diagnostic artifact hash mismatch.');
    }
    public function retain(AvatarPreparation $run,string $bytes):void {
        $proof=$this->proof($run);$this->verify($bytes,$proof);$path=$this->path($run,$proof);
        $disk=Storage::disk('local');
        if($disk->exists($path)){$this->verify($disk->get($path),$proof);return;}
        if(!$disk->put($path,$bytes))throw new \RuntimeException('Could not retain diagnostic artifact.');
        $this->verify($disk->get($path),$proof);
    }
    public function retainCandidate(AvatarPreparation $run,string $reviewId,string $bytes):void {
        $proof=$this->candidateProof($run,$reviewId);$this->verify($bytes,$proof);$path=$this->candidatePath($run,$proof);$disk=Storage::disk('local');
        if($disk->exists($path)){$this->verify($disk->get($path),$proof);return;}
        if(!$disk->put($path,$bytes))throw new \RuntimeException('Could not retain candidate artifact.');
        $this->verify($disk->get($path),$proof);
    }
    public function candidate(AvatarPreparation $run,string $reviewId):string {
        $proof=$this->candidateProof($run,$reviewId);$disk=Storage::disk('local');$path=$this->candidatePath($run,$proof);
        abort_unless($disk->exists($path),404,'Candidate artifact is not retained.');$bytes=$disk->get($path);$this->verify($bytes,$proof);return $bytes;
    }
    public function candidateAvailable(AvatarPreparation $run,string $reviewId):bool {
        try{$proof=$this->candidateProof($run,$reviewId);return Storage::disk('local')->exists($this->candidatePath($run,$proof));}
        catch(\Symfony\Component\HttpKernel\Exception\HttpException){return false;}
    }
    private function candidateBendProof(AvatarPreparation $run,string $visualReviewId,string $candidateId):array {
        abort_unless(\Illuminate\Support\Str::isUuid($visualReviewId),404);
        $candidate=$this->candidateProof($run,$candidateId);
        $review=$run->state['candidate_visual_reviews'][$visualReviewId]??[];
        $plan=$review['plan']??[];$export=$review['bend_export']??[];$render=$review['render']??[];
        $label=null;$source=[];
        foreach(($plan['candidates']??[]) as $key=>$entry)if(($entry['id']??null)===$candidateId){$label=$key;$source=$entry;break;}
        $asset=collect($export['assets']??[])->firstWhere('label',$label)??[];
        abort_unless(($plan['id']??null)===$visualReviewId&&($plan['preparation_id']??null)===$run->id
            &&($plan['compute']??null)==='google'&&($plan['publication_eligible']??true)===false
            &&($plan['qualification_complete']??true)===false&&($export['id']??null)===$visualReviewId
            &&($export['compute']??null)==='google'&&($export['status']??null)==='diagnostic_clips_exported'
            &&($export['publication_eligible']??true)===false&&($export['qualification_complete']??true)===false
            &&($render['id']??null)===$visualReviewId&&($render['compute']??null)==='google'
            &&($render['status']??null)==='rendered_for_review'&&($render['publication_eligible']??true)===false
            &&($render['qualification_complete']??true)===false&&$label!==null
            &&($source['artifact_sha256']??null)===$candidate['sha256']
            &&($asset['source_sha256']??null)===$candidate['sha256']&&($asset['baseline_reproduced']??false)===true,
            409,'Candidate bend lineage mismatch.');
        $proof=['sha256'=>$asset['stress_sha256']??null,'bytes'=>$asset['stress_bytes']??null];
        abort_unless(preg_match('/^[a-f0-9]{64}$/',$proof['sha256']??'')&&is_int($proof['bytes'])
            &&$proof['bytes']>=20&&$proof['bytes']<=64*1024**2,409,'Invalid candidate bend artifact.');
        $report=$run->state['skinning_reviews'][$candidateId]['report'];
        if(isset($report['corrective_recipe'])){
            $baked=$report['corrective_stress_artifact']??[];
            abort_unless(($baked['source_candidate_sha256']??null)===$candidate['sha256']
                &&($baked['sha256']??null)===$proof['sha256']&&($baked['bytes']??null)===$proof['bytes'],
                409,'Corrective bend playback must use the exact retained morph bake.');
        }
        return $proof;
    }
    public function retainCandidateBends(AvatarPreparation $run,string $visualReviewId,string $candidateId,string $bytes):void {
        $proof=$this->candidateBendProof($run,$visualReviewId,$candidateId);$this->verify($bytes,$proof);
        $disk=Storage::disk('local');$path=$this->candidatePath($run,$proof);
        if($disk->exists($path)){$this->verify($disk->get($path),$proof);return;}
        if(!$disk->put($path,$bytes))throw new \RuntimeException('Could not retain candidate bends.');
        $this->verify($disk->get($path),$proof);
    }
    public function candidateBends(AvatarPreparation $run,string $visualReviewId,string $candidateId):string {
        $proof=$this->candidateBendProof($run,$visualReviewId,$candidateId);$disk=Storage::disk('local');$path=$this->candidatePath($run,$proof);
        abort_unless($disk->exists($path),404,'Candidate bends are not retained.');$bytes=$disk->get($path);$this->verify($bytes,$proof);return $bytes;
    }
    public function candidateBendsAvailable(AvatarPreparation $run,string $visualReviewId,string $candidateId):bool {
        try{$proof=$this->candidateBendProof($run,$visualReviewId,$candidateId);return Storage::disk('local')->exists($this->candidatePath($run,$proof));}
        catch(\Symfony\Component\HttpKernel\Exception\HttpException){return false;}
    }
    public function file(AvatarPreparation $run):string {
        $proof=$this->proof($run);$disk=Storage::disk('local');$path=$this->path($run,$proof);
        abort_unless($disk->exists($path),404,'Diagnostic artifact is not retained.');
        $bytes=$disk->get($path);$this->verify($bytes,$proof);return $bytes;
    }
    public function available(AvatarPreparation $run):bool {
        try{return Storage::disk('local')->exists($this->path($run,$this->proof($run)));}
        catch(\Symfony\Component\HttpKernel\Exception\HttpException){return false;}
    }
}
