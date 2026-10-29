<?php
namespace App\Http\Controllers;

use App\Models\GameContent;
use App\Services\{ContentManagementService, GameContentService};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Storage};
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class GameContentController extends Controller {
    public function index(Request $request,string $kind) {
        $filters=$request->validate(['q'=>'nullable|string|max:100','status'=>['nullable',Rule::in(['active','deleted'])]]);
        $entries=GameContent::withTrashed()->where('kind',$kind)
            ->when(($filters['status']??'active')==='deleted',fn($q)=>$q->onlyTrashed(),fn($q)=>$q->whereNull('deleted_at'))
            ->when($filters['q']??null,fn($q,$term)=>$q->where('payload','like','%'.addcslashes($term,'%_\\').'%'))
            ->orderBy('id')->paginate(24)->withQueryString();
        return view('evolution.catalog.index',compact('kind','entries'));
    }
    public function create(string $kind) {
        $entry=null;
        $data=$kind==='item'?app(ContentManagementService::class)->defaults('item'):['name'=>'','desc'=>'','damage'=>0,'cooldown'=>8,'slot'=>'library'];
        return view('evolution.catalog.edit',compact('kind','entry','data'));
    }
    public function edit(string $kind,string $content) {
        $entry=$this->entry($kind,$content);$data=$entry->payload;
        return view('evolution.catalog.edit',compact('kind','entry','data'));
    }
    private function entry(string $kind,string $id):GameContent {
        return GameContent::withTrashed()->where('kind',$kind)->findOrFail($id);
    }
    public function store(Request $request,string $kind,GameContentService $service) {
        $data=$this->validated($request,$kind);
        $entry=DB::transaction(function()use($data,$kind,$request,$service){
            $id=($kind==='item'?'item_custom_':'skill_custom_').Str::lower(Str::random(16));
            $payload=$data['data'];$payload['id']=$id;
            if($kind==='skill') $payload['slot']='library';
            $payload=$this->image($request,$payload);
            $entry=GameContent::create(['id'=>$id,'kind'=>$kind,'payload'=>$payload,'updated_by'=>$request->user()->id]);
            $service->revision($entry,'create',$request->user()->id);
            return $entry;
        });
        return redirect()->route('catalog.edit',[$kind,$entry->id])->with('status','Created. The web catalog can now load this entry.');
    }
    public function update(Request $request,string $kind,string $content,GameContentService $service) {
        $entry=$this->entry($kind,$content);$data=$this->validated($request,$kind,$entry);
        $payload=array_replace($entry->payload,$data['data']);
        // No client can rebind a built-in ability or replace its executable metadata.
        if($kind==='item') $payload['stats']=array_filter($payload['stats'],fn($value)=>$value!==null);
        $payload=$this->image($request,$payload);
        $service->mutate($entry,(int)$data['version'],$request->user()->id,'save',$payload);
        return redirect()->route('catalog.edit',[$kind,$entry->id])->with('status','Saved. Reload the web to use these values in new matches. Running matches keep their starting catalog.');
    }
    public function destroy(Request $request,string $kind,string $content,GameContentService $service) {
        $entry=$this->entry($kind,$content);$data=$request->validate(['version'=>'required|integer|min:1']);
        $service->mutate($entry,(int)$data['version'],$request->user()->id,'delete');
        return redirect()->route('catalog.index',$kind)->with('status','Deleted from the catalog for new matches. You can restore it from Deleted entries.');
    }
    public function restore(Request $request,string $kind,string $content,GameContentService $service) {
        $entry=$this->entry($kind,$content);$data=$request->validate(['version'=>'required|integer|min:1']);
        $service->mutate($entry,(int)$data['version'],$request->user()->id,'restore');
        return redirect()->route('catalog.edit',[$kind,$entry->id])->with('status','Entry restored.');
    }
    public function assign(Request $request,string $kind,string $content,GameContentService $service) {
        abort_unless($kind==='skill',404);
        $source=$this->entry($kind,$content);abort_if($source->trashed(),422);
        $input=$request->validate(['version'=>'required|integer|min:1','binding'=>'required|string|max:120']);
        [$targetId,$targetVersion]=array_pad(explode('|',$input['binding'],2),2,'');
        abort_unless(ctype_digit($targetVersion),422);
        $target=$this->entry('skill',$targetId);
        abort_unless(in_array($target->payload['slot'],['skill1','skill2','ultimate'],true)&&!$target->trashed(),422);
        DB::transaction(function()use($source,$target,$input,$targetVersion,$service,$request){
            $source=GameContent::whereKey($source->id)->lockForUpdate()->firstOrFail();
            if($source->version!==(int)$input['version']) throw \Illuminate\Validation\ValidationException::withMessages(['version'=>'The saved skill changed. Reload before assigning it.']);
            $fields=isset($target->payload['abilityRuleset'])?['name','desc','cooldown']:['name','desc','damage','cooldown'];
            $payload=array_replace($target->payload,array_intersect_key($source->payload,array_flip($fields)));
            if(isset($source->payload['image'])) $payload['image']=$source->payload['image'];
            else unset($payload['image']);
            $service->mutate($target,(int)$targetVersion,$request->user()->id,'assign',$payload);
        });
        return redirect()->route('catalog.edit',['skill',$target->id])->with('status','Saved skill values applied to the avatar slot. Its existing effect behavior is preserved.');
    }
    private function validated(Request $request,string $kind,?GameContent $entry=null):array {
        $rules=['version'=>[$entry?'required':'nullable','integer','min:1'],
            'image'=>'nullable|file|mimes:png,jpg,jpeg,webp|max:4096|dimensions:min_width=32,min_height=32,max_width=4096,max_height=4096',
            'remove_image'=>'nullable|boolean','data.name'=>'required|string|max:100'];
        $keys=['name'];
        if($kind==='item') {
            $keys=[...$keys,'cost','tier','icon','stats','passiveName','passiveDesc','suitableRoles'];
            $rules+=['data.cost'=>'required|integer|between:0,50000',
                'data.tier'=>['required',Rule::in(['Starting','Component','Legendary','Mythic'])],
                'data.icon'=>'nullable|string|max:16','data.passiveName'=>'required|string|max:120',
                'data.passiveDesc'=>'required|string|max:3000','data.stats'=>'required|array:'.implode(',',array_keys(ContentManagementService::ITEM_STATS)),
                'data.suitableRoles'=>'required|array|min:1|max:6','data.suitableRoles.*'=>['required','distinct',Rule::in(ContentManagementService::ROLES)]];
            foreach(ContentManagementService::ITEM_STATS as $key=>[$min,$max]) $rules['data.stats.'.$key]="nullable|numeric|between:$min,$max";
        } else {
            $keys[]='desc';$rules['data.desc']='required|string|max:3000';
            if(($entry?->payload['slot']??'library')!=='passive') {
                $keys=[...$keys,'damage','cooldown'];
                $rules+=['data.damage'=>'required|numeric|between:0,20000','data.cooldown'=>'required|numeric|between:0,600'];
            }
        }
        $rules['data']='required|array:'.implode(',',$keys);
        $input=$request->validate($rules);
        if($kind==='item') {
            $input['data']['cost']=(int)$input['data']['cost'];
            $input['data']['icon']=$input['data']['icon']??'';
            $input['data']['stats']=array_map(fn($value)=>0+$value,array_filter($input['data']['stats'],fn($value)=>$value!==null));
        } else foreach(['damage','cooldown'] as $key) if(isset($input['data'][$key])) $input['data'][$key]=0+$input['data'][$key];
        if($kind==='skill'&&isset($entry?->payload['abilityRuleset'])&&isset($input['data']['damage'])&&$input['data']['damage']!=($entry->payload['damage']??0)){
            throw \Illuminate\Validation\ValidationException::withMessages(['data.damage'=>'Original kits use authored effect components. Edit supported cooldown, text and image fields here.']);
        }
        return $input;
    }
    private function image(Request $request,array $payload):array {
        if($request->boolean('remove_image')) unset($payload['image']);
        if($file=$request->file('image')) {
            // Immutable, content-addressed files keep old match/revision images valid.
            $hash=hash_file('sha256',$file->getRealPath());
            $extension=['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp'][$file->getMimeType()];
            $name=$hash.'.'.$extension;
            abort_unless(Storage::disk('local')->putFileAs('catalog-images',$file,$name),500,'Image could not be saved.');
            $payload['image']=$name;
        }
        return $payload;
    }
    public function manifest(GameContentService $service) {
        return response()->json($service->snapshot())->header('Cache-Control','no-store');
    }
    public function imageFile(string $file) {
        abort_unless(preg_match('/^[a-f0-9]{64}\.(png|jpg|webp)$/D',$file),404);
        $disk=Storage::disk('local');abort_unless($disk->exists('catalog-images/'.$file),404);
        return response()->file($disk->path('catalog-images/'.$file),[
            'Cache-Control'=>'public, max-age=31536000, immutable','X-Content-Type-Options'=>'nosniff',
        ]);
    }
}
