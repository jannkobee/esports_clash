<?php
namespace App\Http\Controllers;
use App\Services\{AvatarComponentService,TrellisGenerationService};
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
class AvatarComponentController extends Controller {
    public function save(Request $request,string $avatar,AvatarComponentService $service){
        $input=$request->validate([
            'version'=>'required|integer|min:0','component_id'=>['required','regex:/^[a-z][a-z0-9_-]{0,63}$/D',Rule::notIn(['base','primary','secondary'])],
            'label'=>'required|string|max:100','category'=>['required',Rule::in(array_keys($service::CATEGORIES))],
            'binding'=>['required',Rule::in(array_keys($service::BINDINGS))],
            'attachment'=>'nullable|string|max:200','prompt'=>'nullable|string|max:8000','asset'=>'nullable|file|max:20480',
            'reference_purpose'=>['nullable',Rule::in(['design','reconstruction'])],
        ]);
        if(in_array($input['category'],['vehicle','companion'],true)&&$input['binding']!=='independent')
            throw \Illuminate\Validation\ValidationException::withMessages(['binding'=>'Vehicles and companions require an independent rig / actor.']);
        $inventory=$service->save($avatar,$input,$request->file('asset'),$request->user()->id);
        if($request->expectsJson())return response()->json($inventory)->header('Cache-Control','no-store');
        return redirect()->route('trellis.avatar',$avatar)->with('status','Component saved. References and unqualified models remain separate; no processing job was started.');
    }
    public function file(string $avatar,string $hash,string $format,AvatarComponentService $service){
        return response()->file($service->file($avatar,$hash,$format),['Content-Type'=>$format==='png'?'image/png':'model/gltf-binary','Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
    }
    public function summary(string $avatar,AvatarComponentService $service,TrellisGenerationService $source){
        abort_unless(collect($source->catalog())->contains('id',$avatar),404);
        return response()->json($service->summary($avatar))->header('Cache-Control','no-store');
    }
}
