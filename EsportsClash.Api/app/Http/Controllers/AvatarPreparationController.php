<?php
namespace App\Http\Controllers;
use App\Models\{AvatarPreparation,TrellisGeneration};
use App\Services\{AvatarPreparationService,AvatarEvolutionService};
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
class AvatarPreparationController extends Controller {
    public function settings(Request $request){
        $data=['enabled'=>false];\App\Models\AvatarPreparationSetting::current()->update($data);
        app(\App\Services\EvolutionService::class)->audit('preparations','avatar.preparation-settings','user:'.$request->user()->id,$data);
        return back()->with('status','Asset preparation is manual-only. Start jobs explicitly from this page.');
    }
    public function live(Request $request,AvatarEvolutionService $avatars){
        $request->validate(['preparation'=>'nullable|uuid','avatar_id'=>'nullable|string|max:100']);
        if($request->filled('avatar_id'))abort_unless(collect($avatars->catalog())->contains('id',$request->query('avatar_id')),404);
        $reports=app(\App\Services\PreparationReportService::class);
        $runs=$request->filled('preparation')?collect([$reports->forAttempt(AvatarPreparation::findOrFail($request->query('preparation')))]):$reports->recent($request->query('avatar_id'));
        return response()->view('evolution.avatars.preparation-runs',['catalog'=>collect($avatars->catalog())->keyBy('id'),
            'singleReport'=>$request->filled('preparation'),
            'runs'=>$runs])->header('Cache-Control','no-store');
    }
    public function index(Request $request,AvatarEvolutionService $avatars){
        $request->validate(['avatar_id'=>'nullable|string|max:100']);
        if($request->filled('avatar_id'))abort_unless(collect($avatars->catalog())->contains('id',$request->query('avatar_id')),404);
        try{$rigOperations=$avatars->worker()->timeout(3)->get(rtrim(config('avatars.unirig_url'),'/').'/operations')->throw()->json();}catch(\Throwable){$rigOperations=null;}
        return response()->view('evolution.avatars.preparation',[
            'catalog'=>collect($avatars->catalog())->keyBy('id'),
            'sources'=>TrellisGeneration::currentAssets()->where('status','generated_unqualified')->when($request->filled('avatar_id'),fn($query)=>$query->where('avatar_id',$request->query('avatar_id')))->latest()->limit(200)->get(),
            'runs'=>app(\App\Services\PreparationReportService::class)->recent($request->query('avatar_id')),
            'settings'=>\App\Models\AvatarPreparationSetting::current(),
            'rigOperations'=>$rigOperations,
        ])->header('Cache-Control','no-store');
    }
    public function start(Request $request,AvatarPreparationService $service){
        $data=$request->validate(['generation_id'=>['required','uuid'],'profile'=>['required','in:unirig-v1,tokenrig-colab-raw-v1'],
            'yaw'=>['required','numeric','min:-180','max:180'],'attachments'=>['nullable','string','max:16000'],'bone_map'=>['nullable','string','max:16000'],'rig_preparation_id'=>['nullable','uuid'],'fresh_rig'=>['nullable','boolean']]);
        try{$boneMap=json_decode(($data['bone_map']??null)?:'{}',true,flags:JSON_THROW_ON_ERROR);}catch(\Throwable){throw ValidationException::withMessages(['bone_map'=>'Use a JSON object mapping native bone names to UniRig bone names.']);}
        $native=['Root','Hips','Spine','Chest','Head','UpperArmL','ForearmL','HandL','UpperArmR','ForearmR','HandR','ThighL','CalfL','FootL','ThighR','CalfR','FootR'];
        if(!is_array($boneMap)||count($boneMap)>17||array_diff(array_keys($boneMap),$native)||collect($boneMap)->contains(fn($name)=>!is_string($name)||!preg_match('/^[A-Za-z0-9_.:\/-]{1,100}$/',$name)))throw ValidationException::withMessages(['bone_map'=>'Map only the native 17 bones to existing UniRig bone names.']);
        try{$attachments=json_decode(($data['attachments']??null)?:'[]',true,flags:JSON_THROW_ON_ERROR);}catch(\Throwable){throw ValidationException::withMessages(['attachments'=>'Use a JSON list of bone/min/max attachment regions.']);}
        if(!is_array($attachments)||!array_is_list($attachments)||count($attachments)>32)throw ValidationException::withMessages(['attachments'=>'Use at most 32 attachment regions.']);
        foreach($attachments as $item){
            if(!is_array($item)||array_diff(array_keys($item),['bone','min','max'])||!preg_match('/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/',$item['bone']??''))throw ValidationException::withMessages(['attachments'=>'Each attachment needs a native bone name and min/max coordinates.']);
            foreach(['min','max']as $key)if(!is_array($item[$key]??null)||!array_is_list($item[$key])||count($item[$key])!==3||collect($item[$key])->contains(fn($v)=>!is_numeric($v)||!is_finite((float)$v)||$v<0||$v>1))throw ValidationException::withMessages(['attachments'=>'Attachment min/max must contain three numbers between 0 and 1.']);
            for($i=0;$i<3;$i++)if($item['min'][$i]>=$item['max'][$i])throw ValidationException::withMessages(['attachments'=>'Each min coordinate must be smaller than max.']);
        }
        $attachments=array_map(fn($item)=>['bone'=>$item['bone'],'min'=>array_map('floatval',$item['min']),'max'=>array_map('floatval',$item['max'])],$attachments);
        if($attachments)throw ValidationException::withMessages(['attachments'=>'UniRig supplies skin weights. Legacy surface-transfer attachment regions are not applied; leave these empty.']);
        $service->start(TrellisGeneration::findOrFail($data['generation_id']),$data['profile'],(float)$data['yaw'],$attachments,'user:'.$request->user()->id,$boneMap,null,$data['rig_preparation_id']??null,(bool)($data['fresh_rig']??false));
        return redirect()->route('preparations.index')->with('status','Asset preparation queued. Qualification remains deferred until you request it.');
    }
    public function control(Request $request,AvatarPreparation $preparation,\App\Services\AvatarPreparationControlService $service){
        $data=$request->validate(['operation'=>'required|in:pause,resume,resume_in_place,retry,reset,cancel_pending']);
        $service->request($preparation,$data['operation'],'user:'.$request->user()->id);
        $report=app(\App\Services\PreparationReportService::class)->forAttempt($preparation);
        return redirect()->route('preparations.report',$report->report_id)->with('status','Preparation '.$data['operation'].' requested. Updates stay in this report.');
    }
    public function validateAsset(Request $request,AvatarPreparation $preparation,AvatarPreparationService $service){
        $service->validate($preparation,'user:'.$request->user()->id);
        return back()->with('status','Runtime qualification requested for this prepared asset.');
    }
    public function publish(Request $request,AvatarPreparation $preparation,AvatarPreparationService $service){
        $request->validate(['identity_review'=>['accepted']]);$service->publish($preparation,'user:'.$request->user()->id);
        return back()->with('status','Qualified visual version published for new scenes. Previous assets are retained for rollback.');
    }
    public function report(Request $request,AvatarPreparation $preparation,AvatarEvolutionService $avatars){
        $report=app(\App\Services\PreparationReportService::class)->forAttempt($preparation);
        if($request->query('format')==='json'||$request->wantsJson()) return response()->json(['type'=>'asset-preparation','report_id'=>$report->report_id,'preparation'=>$preparation,'attempts'=>$report->reportAttempts],headers:['Cache-Control'=>'no-store','Content-Disposition'=>'attachment; filename="preparation-'.$preparation->id.'.json"']);
        $catalog=collect($avatars->catalog())->keyBy('id');
        return response()->view('evolution.avatars.preparation-report',['preparation'=>$report,'catalog'=>$catalog,'name'=>$catalog[$preparation->avatar_id]['name']??$preparation->avatar_id,'runs'=>collect([$report]),'singleReport'=>true])->header('Cache-Control','no-store');
    }
    public function file(AvatarPreparation $preparation,string $file,AvatarPreparationService $service){
        if(($preparation->plan['profile']??null)===\App\Services\AvatarCloudRawRigService::PROFILE){
            if(preg_match('/^pose-contract-([0-9a-f-]{36})-([a-f0-9]{64})\.(png|glb)$/D',$file,$match)){
                $body=app(\App\Services\AvatarPoseContractReviewService::class)->file($preparation,$match[1],$match[2],$match[3]);
                return response($body,200,['Content-Type'=>$match[3]==='png'?'image/png':'model/gltf-binary','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
            }
            if(preg_match('/^weight-field-([0-9a-f-]{36})-([a-f0-9]{64})\.(png|glb|npz)$/D',$file,$match)){
                $body=app(\App\Services\AvatarWeightFieldComparisonService::class)->file($preparation,$match[1],$match[2],$match[3]);
                return response($body,200,['Content-Type'=>match($match[3]){'png'=>'image/png','glb'=>'model/gltf-binary',default=>'application/octet-stream'},'Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
            }
            if(preg_match('/^weight-fit-bends-([0-9a-f-]{36})-([0-9a-f-]{36})\.glb$/D',$file,$match)){
                $review=$preparation->state['stage_visual_audits'][$match[1]]??[];$proof=$review['fit_bends']??[];
                $candidate=$preparation->state['skinning_reviews'][$match[2]]['report']??[];
                abort_unless(($proof['candidate_id']??null)===$match[2]&&($proof['candidate_sha256']??null)===($candidate['artifact']['sha256']??null)
                    &&($candidate['source_sha256']??null)===($preparation->plan['source_sha256']??null)
                    &&($candidate['rig_sha256']??null)===($preparation->state['cloud_raw_rig']['artifact']['sha256']??null)
                    &&($review['report']['status']??null)==='rendered_for_review'&&($review['publication_eligible']??true)===false,404);
                $disk=\Illuminate\Support\Facades\Storage::disk('local');$path='avatar-preparations/'.$preparation->id.'/diagnostics/'.($proof['sha256']??'').'.glb';
                abort_unless($disk->exists($path),404);$body=$disk->get($path);
                abort_unless(strlen($body)===($proof['bytes']??null)&&hash_equals($proof['sha256'],hash('sha256',$body)),409);
                return response($body,200,['Content-Type'=>'model/gltf-binary','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
            }
            if(preg_match('/^weight-domain-([0-9a-f-]{36})\.npz$/D',$file,$match)){
                $review=$preparation->state['weight_solver_reviews'][$match[1]]['report']??[];$proof=$review['proxy_artifact']??[];
                abort_unless(($review['id']??null)===$match[1]&&($review['compute']??null)==='google'
                    &&($review['method']??null)==='libigl-voxel-volume-correspondence-v1'
                    &&($review['rig_sha256']??null)===($preparation->state['cloud_raw_rig']['artifact']['sha256']??null)
                    &&($review['source_sha256']??null)===($preparation->plan['source_sha256']??null)
                    &&($review['candidate_available']??true)===false&&($review['publication_eligible']??true)===false,404);
                $disk=\Illuminate\Support\Facades\Storage::disk('local');$path='avatar-preparations/'.$preparation->id.'/weight-domains/'.$match[1].'.npz';
                abort_unless($disk->exists($path),404);$body=$disk->get($path);
                abort_unless(strlen($body)===($proof['bytes']??null)&&hash_equals($proof['sha256']??'',hash('sha256',$body)),409);
                return response($body,200,['Content-Type'=>'application/octet-stream','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff','Content-Disposition'=>'attachment; filename="'.$file.'"']);
            }
            if(preg_match('/^stage-visual-([0-9a-f-]{36})-([a-f0-9]{64})\.png$/D',$file,$match)){
                $review=$preparation->state['stage_visual_audits'][$match[1]]??[];$report=$review['report']??[];
                abort_unless(($report['id']??null)===$match[1]&&($report['status']??null)==='rendered_for_review'
                    &&($review['publication_eligible']??true)===false
                    &&collect($report['views']??[])->contains(fn($view)=>($view['sha256']??null)===$match[2]),404);
                $disk=\Illuminate\Support\Facades\Storage::disk('local');$path='avatar-preparations/'.$preparation->id.'/stage-visual/'.$match[1].'/'.$match[2].'.png';
                abort_unless($disk->exists($path),404);$image=$disk->get($path);
                abort_unless(hash_equals($match[2],hash('sha256',$image))&&str_starts_with($image,"\x89PNG\r\n\x1a\n"),409);
                return response($image,200,['Content-Type'=>'image/png','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
            }
            if(preg_match('/^candidate-bends-([0-9a-f-]{36})-([0-9a-f-]{36})\.glb$/D',$file,$match))return response(
                app(\App\Services\AvatarRawRigReviewArtifactService::class)->candidateBends($preparation,$match[1],$match[2]),200,
                ['Content-Type'=>'model/gltf-binary','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
            if(preg_match('/^candidate-([0-9a-f-]{36})\.glb$/D',$file,$match))return response(
                app(\App\Services\AvatarRawRigReviewArtifactService::class)->candidate($preparation,$match[1]),200,
                ['Content-Type'=>'model/gltf-binary','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
            if($file==='stress.glb')return response(app(\App\Services\AvatarRawRigReviewArtifactService::class)->file($preparation),200,
                ['Content-Type'=>'model/gltf-binary','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
            abort_unless($file==='raw-rig.glb',404);
            return response(app(\App\Services\AvatarCloudRawRigService::class)->file($preparation),200,
                ['Content-Type'=>'model/gltf-binary','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
        }
        abort_unless(in_array($file,['unirig-rigged.glb','candidate-01.glb','candidate-01.blend','baseline.glb','candidate-01-front.png','candidate-01-side.png','candidate-01-back.png','candidate-01-strike.png','candidate-01-ability.png'],true),404);
        $response=$service->worker()->timeout(45)->get($service->endpoint('/files/'.$preparation->id.'/'.$file))->throw();
        $body=$response->body();abort_if(strlen($body)>80*1024*1024,413);
        if($file==='candidate-01.glb')abort_unless(hash_equals($preparation->state['preparation']['sha256']??'',hash('sha256',$body)),409);
        if($file==='unirig-rigged.glb')abort_unless(hash_equals($preparation->state['preparation']['unirig']['artifact']['sha256']??'',hash('sha256',$body)),409);
        return response($body,200,['Content-Type'=>$response->header('Content-Type'),'Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
    }
    public function preview(AvatarPreparation $preparation,AvatarEvolutionService $avatars){
        abort_unless(isset($preparation->state['preparation']['sha256']),409);
        $name=collect($avatars->catalog())->firstWhere('id',$preparation->avatar_id)['name']??$preparation->avatar_id;
        if(($preparation->plan['profile']??null)===\App\Services\AvatarCloudRawRigService::PROFILE){
            $artifacts=app(\App\Services\AvatarRawRigReviewArtifactService::class);$candidateBendOptions=[];
            foreach(($preparation->state['candidate_visual_reviews']??[]) as $reviewId=>$review)
                foreach(($review['plan']['candidates']??[]) as $candidate)
                    if($artifacts->candidateBendsAvailable($preparation,$reviewId,$candidate['id']))
                        $candidateBendOptions[]=['review_id'=>$reviewId,'candidate_id'=>$candidate['id']];
            $selectedCandidateBendReviewId=null;$selectedWeightFitVisualId=null;
            if(request()->query('view')==='weight-fit-bends'){
                $id=request()->query('visual_review');$proof=$preparation->state['stage_visual_audits'][$id]['fit_bends']??[];
                abort_unless(isset($proof['candidate_id'])&&$proof['candidate_id']===request()->query('candidate')&&isset($preparation->state['skinning_reviews'][$proof['candidate_id']]['report']['artifact']),404);
                $selectedWeightFitVisualId=$id;
            }
            if(request()->query('view')==='candidate-bends'){
                $selected=collect($candidateBendOptions)->first(fn($entry)=>$entry['candidate_id']===request()->query('candidate')&&$entry['review_id']===request()->query('visual_review'));
                abort_unless($selected,404,'Measured candidate bends are not available.');$selectedCandidateBendReviewId=$selected['review_id'];
            }
            return response()->view('evolution.avatars.cloud-raw-rig-preview',['preparation'=>$preparation,'name'=>$name,
                'stressAvailable'=>$artifacts->available($preparation),'candidateBendOptions'=>$candidateBendOptions,
                'selectedCandidateBendReviewId'=>$selectedCandidateBendReviewId,
                'selectedWeightFitVisualId'=>$selectedWeightFitVisualId,
                'candidateIds'=>collect(array_keys($preparation->state['skinning_reviews']??[]))->filter(fn($id)=>$artifacts->candidateAvailable($preparation,$id))->values()->all(),
                'skinningDiagnostics'=>$preparation->state['skinning_diagnostics']??[]])->header('Cache-Control','no-store');
        }
        return response()->view('evolution.avatars.preparation-preview',['preparation'=>$preparation,'name'=>$name])->header('Cache-Control','no-store');
    }
}
