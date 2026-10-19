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
    public function live(AvatarEvolutionService $avatars){return response()->view('evolution.avatars.preparation-runs',['catalog'=>collect($avatars->catalog())->keyBy('id'),'runs'=>AvatarPreparation::latest()->limit(100)->get()])->header('Cache-Control','no-store');}
    public function index(AvatarEvolutionService $avatars){
        try{$rigOperations=$avatars->worker()->timeout(3)->get(rtrim(config('avatars.unirig_url'),'/').'/operations')->throw()->json();}catch(\Throwable){$rigOperations=null;}
        return response()->view('evolution.avatars.preparation',[
            'catalog'=>collect($avatars->catalog())->keyBy('id'),
            'sources'=>TrellisGeneration::where('status','generated_unqualified')->latest()->limit(200)->get(),
            'runs'=>AvatarPreparation::latest()->limit(100)->get(),
            'settings'=>\App\Models\AvatarPreparationSetting::current(),
            'rigOperations'=>$rigOperations,
        ])->header('Cache-Control','no-store');
    }
    public function start(Request $request,AvatarPreparationService $service){
        $data=$request->validate(['generation_id'=>['required','uuid'],'profile'=>['required','in:unirig-v1'],
            'yaw'=>['required','numeric','min:-180','max:180'],'attachments'=>['nullable','string','max:16000'],'bone_map'=>['nullable','string','max:16000']]);
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
        $service->start(TrellisGeneration::findOrFail($data['generation_id']),$data['profile'],(float)$data['yaw'],$attachments,'user:'.$request->user()->id,$boneMap);
        return redirect()->route('preparations.index')->with('status','Asset preparation queued. Qualification remains deferred until you request it.');
    }
    public function control(Request $request,AvatarPreparation $preparation,\App\Services\AvatarPreparationControlService $service){
        $data=$request->validate(['operation'=>'required|in:pause,resume,retry,cancel_pending']);
        $service->request($preparation,$data['operation'],'user:'.$request->user()->id);
        return back()->with('status','Preparation '.$data['operation'].' requested. Pause/retry waits for both workers to stop; resume/retry uses a linked attempt and may repeat unfinished work.');
    }
    public function validateAsset(Request $request,AvatarPreparation $preparation,AvatarPreparationService $service){
        $service->validate($preparation,'user:'.$request->user()->id);
        return back()->with('status','Runtime qualification requested for this prepared asset.');
    }
    public function publish(Request $request,AvatarPreparation $preparation,AvatarPreparationService $service){
        $request->validate(['identity_review'=>['accepted']]);$service->publish($preparation,'user:'.$request->user()->id);
        return back()->with('status','Qualified visual version published for new scenes. Previous assets are retained for rollback.');
    }
    public function report(AvatarPreparation $preparation){return response()->json(['type'=>'asset-preparation','preparation'=>$preparation],headers:['Cache-Control'=>'no-store']);}
    public function file(AvatarPreparation $preparation,string $file,AvatarPreparationService $service){
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
        return response()->view('evolution.avatars.preparation-preview',['preparation'=>$preparation,'name'=>$name])->header('Cache-Control','no-store');
    }
}
