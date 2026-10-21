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
        $operations=$service->operations();
        return response()->view('evolution.avatars.trellis',[
            'selectedDesign'=>$selectedDesign,
            'operations'=>$operations,
            'computePreference'=>$service->computePreference(),
            'assetReferences'=>$service->references($operations),
            'localReferences'=>$service->localReferences(),
            'weaponReferences'=>$service->weaponReferences(),
            'activeRuns'=>TrellisGeneration::whereIn('status',[...TrellisGenerationService::ACTIVE,'cancelling'])->get(),
            'catalog'=>collect($service->catalog())->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values()->all(),
            'runs'=>TrellisGeneration::latest()->limit(100)->get()->sortBy('created_at')->values(),
            'completedModels'=>TrellisGeneration::withTrashed()->where('status','generated_unqualified')->latest()->get()->unique('avatar_id')->keyBy('avatar_id')
        ])->header('Cache-Control','no-store');
    }
    public function avatarStatus(Request $request,string $avatar,TrellisGenerationService $service)
    {
        $request->validate(['design'=>'nullable|uuid','model'=>'nullable|uuid']);
        $selectedDesign=$request->filled('design') ? \App\Models\ManagedContent::where('kind','avatar')->where('source_id',$avatar)->where('status','<>','archived')->findOrFail($request->query('design')) : null;
        $meta=collect($service->catalog())->firstWhere('id',$avatar);abort_unless($meta,404);
        $weapon=$service->weaponReferences()[$avatar]??null;
        $operations=$service->operations();
        $currentReference=$service->currentReference($avatar,$operations??[]);
        $models=TrellisGeneration::withTrashed()->where('avatar_id',$avatar)->where('status','generated_unqualified')->oldest()->get();
        $completedModel=$request->filled('model') ? $models->firstWhere('id',$request->query('model')) : $models->last();
        if ($request->filled('model')) abort_unless($completedModel,404);
        return response()->view('evolution.avatars.generation-status',[
            'avatar'=>$meta,
            'selectedDesign'=>$selectedDesign,
            'runs'=>TrellisGeneration::where('avatar_id',$avatar)->latest()->limit(100)->get()->sortBy('created_at')->values(),
            'names'=>collect($service->catalog())->pluck('name','id'),
            'retainedModel'=>TrellisGeneration::withTrashed()->where('avatar_id',$avatar)->where('status','generated_unqualified')->exists(),
            'completedModel'=>$completedModel,
            'preparedModel'=>$completedModel?\App\Models\AvatarPreparation::where('generation_id',$completedModel->id)->whereIn('status',['validating','awaiting_validation','needs_review','ready','published'])->where('state->preparation->runtime_compatible',true)->latest()->first():null,
            'models'=>$models,
            'weapon'=>$weapon,
            'equipmentRuns'=>\App\Models\AvatarEquipmentGeneration::where('avatar_id',$avatar)->oldest()->get()->groupBy('slot'),
            'currentReference'=>$currentReference,
            'operations'=>$operations,
            'computePreference'=>$service->computePreference()
        ])->header('Cache-Control','no-store');
    }
    public function live(Request $request,TrellisGenerationService $service)
    {
        $request->validate(['avatar_id'=>'nullable|string|max:80']);
        if($request->filled('avatar_id'))abort_unless(collect($service->catalog())->contains('id',$request->query('avatar_id')),404);
        return response()->view('evolution.avatars.generation-runs',['runs'=>TrellisGeneration::when($request->filled('avatar_id'),fn($query)=>$query->where('avatar_id',$request->query('avatar_id')))->latest()->limit(100)->get()->sortBy('created_at')->values(),'names'=>collect($service->catalog())->pluck('name','id')])->header('Cache-Control','no-store');
    }
    public function start(Request $request,TrellisGenerationService $service)
    {
        $input=$request->validate([
            'seed'=>['nullable','integer','min:0','max:2147483647'],
            'avatar_id'=>['required','string','max:80'],
            'allow_new_instance'=>['nullable','boolean'],
        ]);
        $allowNewInstance = $request->boolean('allow_new_instance');
        $seed = app()->environment('testing') && isset($input['seed'])
            ? (int)$input['seed']
            : random_int(0,2147483647);
        $service->start('user:'.$request->user()->id,$seed,$input['avatar_id'],$allowNewInstance);
        return redirect()->back(fallback: route('trellis.index'))->with('status','3D source job queued. Review the generated source before rigging and live use.');
    }
    public function compute(Request $request, TrellisGenerationService $service)
    {
        $input = $request->validate(['compute_preference'=>['required','in:google,local']]);
        $service->saveComputePreference($input['compute_preference'], 'user:'.$request->user()->id);
        return redirect()->back(fallback: route('trellis.index'))->with('status', 'Generation compute saved for new jobs. Google failures automatically use Local.');
    }
    public function colabSetup()
    {
        $path = resource_path('avatars/trellis2-colab.ipynb');
        abort_unless(is_file($path), 503, 'The reviewed Colab setup notebook is unavailable.');
        return response()->download($path, 'EsportsClash-TRELLIS2-Colab.ipynb', ['Cache-Control'=>'private, no-store']);
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
        $service->saveReferenceAsset($input['avatar_id'], $request->file('reference'), $input['prompt'] ?? null, 'user:'.$request->user()->id);
        return redirect()->back(fallback: route('trellis.index'))->with('status','Neutral T-pose reference image saved. Ready for mesh reconstruction and skeletal joint detection.');
    }
    public function uploadWeapon(Request $request,TrellisGenerationService $service)
    {
        $input=$request->validate([
            'avatar_id'=>['required','string','max:80'],
            'weapon_file'=>['nullable','file','max:20480'],
            'height_cm'=>['nullable','numeric','min:5','max:300'],
            'weapon_slot'=>['required','string','in:primary,secondary'],
            'weapon_type'=>['nullable','string','in:generic,one_handed_sword,dual_daggers,staff,bow,two_handed,gun,shield,orb'],
            'socket_name'=>['nullable','string','in:right_hand_socket,left_hand_socket,weapon_primary,weapon_secondary,weapon_muzzle,weapon_tip,projectile_origin'],
        ]);
        $expectedSocket = $input['weapon_slot'] === 'primary' ? 'right_hand_socket' : 'left_hand_socket';
        if (isset($input['socket_name']) && $input['socket_name'] !== $expectedSocket) {
            throw \Illuminate\Validation\ValidationException::withMessages(['socket_name' => 'Choose the matching hand socket for this weapon slot.']);
        }
        $existing = $service->weaponReferences()[$input['avatar_id']][$input['weapon_slot']] ?? [];
        $input['weapon_type'] = $input['weapon_type'] ?? (($existing['weapon_type']??'none') !== 'none' ? $existing['weapon_type'] : 'generic');
        $input['socket_name'] = $expectedSocket;
        if (!$request->hasFile('weapon_file')) {
            abort_unless(collect($service->catalog())->contains('id', $input['avatar_id']), 422);
            $service->updateWeapon($input['avatar_id'], $input['weapon_slot'], $input['weapon_type'], 'user:'.$request->user()->id, isset($input['height_cm'])?(float)$input['height_cm']:null);
            return back()->with('status', 'Weapon settings saved.');
        }
        $ext=strtolower($request->file('weapon_file')->getClientOriginalExtension());
        if(!in_array($ext,['png','glb','gltf'])){
            throw \Illuminate\Validation\ValidationException::withMessages([
                'weapon_file'=>'Weapon asset must be a transparent PNG concept image or a 3D GLB/glTF model (up to 20 MiB).'
            ]);
        }
        $meta=$service->saveWeaponAsset(
            $input['avatar_id'],
            $request->file('weapon_file'),
            $input['weapon_slot'],
            $input['weapon_type'],
            $input['socket_name'],
            'user:'.$request->user()->id
        );
        if(isset($input['height_cm']))$service->updateWeapon($input['avatar_id'],$input['weapon_slot'],$input['weapon_type'],'user:'.$request->user()->id,(float)$input['height_cm']);
        $name=collect($service->catalog())->firstWhere('id',$input['avatar_id'])['name']??$input['avatar_id'];
        return redirect()->back(fallback: route('trellis.index'))
            ->with('status',($input['weapon_slot']==='primary'?'Right':'Left')." hand equipment saved for {$name}.");
    }
    public function generateWeapon(Request $request,string $avatar,string $slot,\App\Services\AvatarEquipmentService $equipment)
    {
        $equipment->start($avatar,$slot,'user:'.$request->user()->id);
        return back()->with('status','3D equipment queued. It will be saved to this hand when generation completes. Prepare the avatar again to fit and qualify it.');
    }
    public function weaponAsset(Request $request,string $avatar,TrellisGenerationService $service,string $slot='primary')
    {
        $info=$service->weaponFile($avatar,$slot);
        abort_unless($info&&is_file($info['path']),404,'No separate weapon asset found for this avatar.');
        return response()->file($info['path'],[
            'Content-Type'=>$info['mime'],
            'Cache-Control'=>'no-cache, no-store',
            'X-Content-Type-Options'=>'nosniff',
        ]);
    }
    public function savePrompts(Request $request, string $avatar, TrellisGenerationService $service, \App\Services\AvatarAssetPromptService $prompts)
    {
        abort_unless(collect($service->catalog())->contains('id', $avatar), 404);
        $input = $request->validate(['body' => 'required|string|max:8000', 'primary' => 'required|string|max:8000', 'secondary' => 'required|string|max:8000']);
        $prompts->save($avatar, $input, 'user:'.$request->user()->id);
        return back()->with('status', 'Asset prompts saved. Use them in your image tool, then upload the resulting files.');
    }
    public function destroyReference(Request $request, string $avatar, TrellisGenerationService $service)
    {
        abort_unless(collect($service->catalog())->contains('id', $avatar), 404);
        $request->validate(['confirm_delete' => 'required|accepted']);
        $service->removeReference($avatar, 'user:'.$request->user()->id);
        return back()->with('status', 'Active body reference removed. Historical generation inputs are retained. Upload a body before generating again.');
    }
    public function updateWeapon(Request $request, string $avatar, string $slot, TrellisGenerationService $service)
    {
        abort_unless(collect($service->catalog())->contains('id', $avatar), 404);
        $input = $request->validate(['weapon_type' => 'required|in:generic,one_handed_sword,dual_daggers,staff,bow,two_handed,gun,shield,orb']);
        $service->updateWeapon($avatar, $slot, $input['weapon_type'], 'user:'.$request->user()->id, isset($input['height_cm'])?(float)$input['height_cm']:null);
        return back()->with('status', 'Weapon settings saved.');
    }
    public function destroyWeapon(Request $request, string $avatar, string $slot, TrellisGenerationService $service)
    {
        abort_unless(collect($service->catalog())->contains('id', $avatar), 404);
        $request->validate(['confirm_delete' => 'required|accepted']);
        $service->removeWeapon($avatar, $slot, 'user:'.$request->user()->id);
        return back()->with('status', 'Custom weapon removed. This hand will use its default equipment or unarmed presentation.');
    }
    public function destroyModel(Request $request,TrellisGeneration $generation,TrellisGenerationService $service)
    {
        $request->validate(['confirm_delete'=>'required|accepted']);
        $force = $request->has('force') ? $request->boolean('force') : false;
        $service->deleteModel($generation,'user:'.$request->user()->id, $force);
        return redirect()->route('trellis.index')->with('status','Generated model deleted. You can manually queue a new generation.');
    }
    public function report(TrellisGeneration $generation)
    {
        return response()->json(['type'=>'trellis2-generation','generation'=>$generation],headers:['Cache-Control'=>'no-store','Content-Disposition'=>'attachment; filename="trellis-report-'.$generation->id.'.json"']);
    }
    public function preview(TrellisGeneration $generation,TrellisGenerationService $service)
    {
        abort_unless($generation->status==='generated_unqualified'&&isset($generation->state['artifact']['sha256']),409,'No generated source is ready to inspect.');
        return redirect()->route('trellis.avatar',[$generation->avatar_id,'model'=>$generation->id])->withFragment('models');
    }
    public function asset(TrellisGeneration $generation,TrellisGenerationService $service)
    {
        return response($service->verifiedAsset($generation),200,['Content-Type'=>'model/gltf-binary','Cache-Control'=>'no-store','X-Content-Type-Options'=>'nosniff','Content-Disposition'=>'attachment; filename="'.$generation->avatar_id.'-generated-'.$generation->id.'.glb"']);
    }
}
