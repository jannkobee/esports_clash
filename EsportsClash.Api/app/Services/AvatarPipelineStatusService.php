<?php
namespace App\Services;

use Illuminate\Support\Facades\{Cache,DB,Http};

/** One read-only readiness contract for the backoffice and authenticated Web API. */
class AvatarPipelineStatusService {
    private function operations(string $url):?array {
        try {
            $result=Http::withToken(config('avatars.worker_token'))->connectTimeout(3)->timeout(25)->get($url)->throw()->json();
            return is_array($result)?$result:null;
        } catch(\Throwable) { return null; }
    }
    private function cloud(?array $ops):bool {
        return ($ops['compute']['selected']??null)==='google'
            && ($ops['compute']['automatic_fallback']??true)===false;
    }
    private function row(string $id,string $label,?array $ops,string $stage,bool $candidate=false):array {
        $connected=AvatarPreparationService::cloudStageReady($ops,$stage);
        $ready=$connected&&!$candidate;
        $reason=$ops['blocked_reason']??null;
        if($candidate&&$connected)$reason='Raw rig tools are connected. See recorded attempts for inference results; deformation, animation and publication remain separate gates.';
        elseif(!$connected&&!$reason)$reason=$this->cloud($ops)
            ?'This cloud stage has not passed its runtime checks.'
            :'Connect a verified Google Colab stage before processing.';
        return ['id'=>$id,'label'=>$label,'ready'=>$ready,'connected'=>$connected,'candidate'=>$candidate,
            'status'=>$ready?'Ready':($connected?'Connected; review pending':'Blocked'),
            'provider'=>$ops['provider']??'Not connected','compute'=>$this->cloud($ops)?'google':null,
            'reason'=>$ready?'Available for an explicitly started job.':$reason,
            'engine_sha256'=>$connected?($ops['engine_sha256']??null):null];
    }
    public function snapshot():array {
        $router=rtrim(config('avatars.trellis_url'),'/');
        $worker=rtrim(config('avatars.worker_url'),'/');
        $rig=rtrim(config('avatars.unirig_url'),'/');
        // Status is informational. Admission always rechecks the live workers.
        return Cache::remember('avatar-pipeline-readiness-v1:'.hash('sha256',$router.$worker.$rig),15,function()use($router,$worker,$rig){
            $generation=$this->operations($router.'/operations');
            $productionRig=$this->operations($rig.'/operations');
            $preparation=$this->operations($worker.'/preparations/operations');
            $rawRig=$this->operations($router.'/rigging/operations');
            $generatorReady=$this->cloud($generation)&&($generation['compute']['ready']??false)===true
                &&($generation['models']['ready']??false)===true
                &&($generation['gpu_validated']??false)===true
                &&preg_match('/^[a-f0-9]{64}$/',$generation['engine_sha256']??'')===1;
            $rows=[['id'=>'generation','label'=>'3D generation','ready'=>$generatorReady,'connected'=>$generatorReady,
                    'candidate'=>false,'status'=>$generatorReady?'Ready':'Blocked',
                    'provider'=>$generation['generation_model']??'TRELLIS.2','compute'=>$this->cloud($generation)?'google':null,
                    'reason'=>$generatorReady?'Generator connected. Complete pipeline admission remains separate.':($generation['compute']['blocked_reason']??'Reconnect the Google Colab generator.'),
                    'engine_sha256'=>$generatorReady?$generation['engine_sha256']:null],
                $this->row('rigging','Production rigging',$productionRig,'rigging'),
                $this->row('raw_rig_candidate','TokenRig raw rig candidate',$rawRig,'rigging',true),
                $this->row('animation','Animation preparation',$preparation,'animation'),
                $this->row('qualification','Deformation qualification',$preparation,'qualification')];
            $byId=collect($rows)->keyBy('id');
            $ready=$byId['rigging']['ready']&&$byId['animation']['ready']&&$byId['qualification']['ready'];
            return ['schema'=>'avatar-pipeline-readiness-v1','checked_at'=>now()->toIso8601String(),
                'required_compute'=>'google','automatic_fallback'=>false,'owner_started_only'=>true,
                'ready_for_preparation'=>$ready,'stages'=>$rows,
                'raw_rig_attempts'=>\App\Models\AvatarPreparation::where('plan->profile',AvatarCloudRawRigService::PROFILE)->latest()->limit(5)
                    ->get(['id','generation_id','avatar_id','status','plan','state','progress','error','created_at','updated_at'])->toArray(),
                'diagnostics'=>DB::table('evolution_audits')->whereIn('action',[
                    'avatar.pipeline-diagnostic-completed','avatar.pipeline-diagnostic-failed'])->latest('id')->limit(5)->get()->map(function($entry){
                        $details=json_decode($entry->details,true);
                        $plan=$details['plan']??[];
                        return ['id'=>$entry->subject_id,'status'=>$details['status']??'failed',
                            'summary'=>$details['summary']??'Controlled cloud diagnostic recorded.',
                            'compute'=>$plan['compute']??null,'source_sha256'=>$plan['source_sha256']??null,
                            'source_candidate_id'=>$plan['source_candidate_id']??null,
                            'report_sha256'=>$details['artifact']['sha256']??null,
                            'comparisons'=>$details['comparisons']??[],
                            'publication_eligible'=>false,'recorded_at'=>$entry->created_at];
                    })->all(),
                'message'=>$ready?'Cloud preparation stages are connected. Each character still requires its own review.':
                    'Preparation is blocked until production rigging, animation and qualification are connected in Colab.'];
        });
    }
}
