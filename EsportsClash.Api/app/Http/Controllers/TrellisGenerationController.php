<?php
namespace App\Http\Controllers;
use App\Models\TrellisGeneration;
use App\Services\TrellisGenerationService;
use Illuminate\Http\Request;
class TrellisGenerationController extends Controller
{
    public function index(Request $request,TrellisGenerationService $service)
    {
        $request->validate(['design'=>'nullable|uuid']);
        $selectedDesign=$request->filled('design') ? \App\Models\ManagedContent::where('kind','avatar')->whereNotNull('source_id')->where('status','<>','archived')->findOrFail($request->query('design')) : null;
        return response()->view('evolution.avatars.trellis',['selectedDesign'=>$selectedDesign,'operations'=>$service->operations(),'localReferences'=>$service->localReferences(),'catalog'=>$service->catalog(),'runs'=>TrellisGeneration::latest()->limit(100)->get(),'completedModels'=>TrellisGeneration::withTrashed()->where('status','generated_unqualified')->latest()->get()->unique('avatar_id')->keyBy('avatar_id')])->header('Cache-Control','no-store');
    }
    public function avatarStatus(string $avatar,TrellisGenerationService $service)
    {
        $meta=collect($service->catalog())->firstWhere('id',$avatar);abort_unless($meta,404);
        return response()->view('evolution.avatars.generation-status',['avatar'=>$meta,'runs'=>TrellisGeneration::where('avatar_id',$avatar)->latest()->limit(100)->get(),'names'=>collect($service->catalog())->pluck('name','id'),'retainedModel'=>TrellisGeneration::withTrashed()->where('avatar_id',$avatar)->where('status','generated_unqualified')->exists()])->header('Cache-Control','no-store');
    }
    public function live(Request $request,TrellisGenerationService $service)
    {
        $request->validate(['avatar_id'=>'nullable|string|max:80']);
        if($request->filled('avatar_id'))abort_unless(collect($service->catalog())->contains('id',$request->query('avatar_id')),404);
        return response()->view('evolution.avatars.generation-runs',['runs'=>TrellisGeneration::when($request->filled('avatar_id'),fn($query)=>$query->where('avatar_id',$request->query('avatar_id')))->latest()->limit(100)->get(),'names'=>collect($service->catalog())->pluck('name','id')])->header('Cache-Control','no-store');
    }
    public function start(Request $request,TrellisGenerationService $service)
    {
        $input=$request->validate(['seed'=>['required','integer','min:0','max:2147483647'],'avatar_id'=>['required','string','max:80']]);
        $service->start('user:'.$request->user()->id,(int)$input['seed'],$input['avatar_id']);
        return redirect()->route('trellis.index')->with('status','Real TRELLIS.2 generation queued. The active game appearance is preserved.');
    }
    public function reference(Request $request,string $avatar,string $digest,TrellisGenerationService $service)
    {
        abort_unless(collect($service->catalog())->contains('id',$avatar)&&preg_match('/^[a-f0-9]{64}$/',$digest),404);
        if($path=$service->localReference($avatar,$digest))return response()->file($path,['Content-Type'=>'image/png','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
        $response=$service->worker()->get($service->endpoint('/references/'.$avatar.'/'.$digest));
        abort_unless($response->successful(),404);
        return response($response->body(),200,['Content-Type'=>'image/png','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
    }
    public function upload(Request $request,TrellisGenerationService $service)
    {
        $input=$request->validate(['avatar_id'=>['required','string','max:80'],'reference'=>['required','file','mimes:png','max:12288'],'prompt'=>['nullable','string','max:8000']],['reference.uploaded'=>'The upload exceeded the server limit or was interrupted. Choose a PNG up to 12 MiB and try again.','reference.max'=>'The reference PNG must be no larger than 12 MiB.']);
        abort_unless(collect($service->catalog())->contains('id',$input['avatar_id']),422);
        $response=$service->worker()->timeout(45)->post($service->endpoint('/references/'.$input['avatar_id']),[
            'png_base64'=>base64_encode(file_get_contents($request->file('reference')->getRealPath())),'provider'=>'owner-upload','prompt'=>$input['prompt']??'']);
        if(!$response->successful())throw \Illuminate\Validation\ValidationException::withMessages(['reference'=>'Reference rejected. Use a transparent full-body RGBA PNG, at least 256 × 512, up to 12 MiB.']);
        app(\App\Services\EvolutionService::class)->audit($input['avatar_id'],'trellis.reference-uploaded','user:'.$request->user()->id,['avatar_id'=>$input['avatar_id'],'sha256'=>$response->json('sha256')]);
        return redirect()->route('trellis.index')->with('status','Versioned reference image saved. Existing generations retain their original image.');
    }
    public function destroyModel(Request $request,TrellisGeneration $generation,TrellisGenerationService $service)
    {
        $request->validate(['confirm_delete'=>'required|accepted']);
        $service->deleteModel($generation,'user:'.$request->user()->id);
        return redirect()->route('trellis.index')->with('status','Generated model deleted. You can manually queue a new generation.');
    }
    public function report(TrellisGeneration $generation)
    {
        return response()->json(['type'=>'trellis2-generation','generation'=>$generation],headers:['Cache-Control'=>'no-store','Content-Disposition'=>'attachment; filename="trellis-report-'.$generation->id.'.json"']);
    }
    public function preview(TrellisGeneration $generation,TrellisGenerationService $service)
    {
        abort_unless($generation->status==='generated_unqualified'&&isset($generation->state['artifact']['sha256']),409,'No generated source is ready to inspect.');
        $name=collect($service->catalog())->firstWhere('id',$generation->avatar_id)['name']??$generation->avatar_id;
        return response()->view('evolution.avatars.generation-preview',['generation'=>$generation,'name'=>$name])->header('Cache-Control','no-store');
    }
    public function asset(TrellisGeneration $generation,TrellisGenerationService $service)
    {
        return response($service->verifiedAsset($generation),200,['Content-Type'=>'model/gltf-binary','Cache-Control'=>'no-store','X-Content-Type-Options'=>'nosniff','Content-Disposition'=>'attachment; filename="'.$generation->avatar_id.'-generated-'.$generation->id.'.glb"']);
    }
}
