<?php
namespace App\Http\Controllers;
use App\Models\ManagedContent;
use App\Services\ContentManagementService as Content;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
class ContentManagementController extends Controller {
    public function index(Request $request, string $kind, Content $service) {
        $filters=$request->validate(['q'=>'nullable|string|max:100','status'=>['nullable',Rule::in(['draft','review','archived'])]]);
        $entries=ManagedContent::where('kind',$kind)->when($filters['q']??null,fn($q,$term)=>$q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($term).'%']))->when($filters['status']??null,fn($q,$status)=>$q->where('status',$status))->orderBy('name')->paginate(18)->withQueryString();
        return view('evolution.management.index',compact('kind','entries'));
    }
    public function create(string $kind, Content $service) { return $this->form($kind,null,$service); }
    public function edit(string $kind, ManagedContent $content, Content $service) { abort_unless($content->kind===$kind,404); return $this->form($kind,$content,$service); }
    private function form(string $kind, ?ManagedContent $entry, Content $service) {
        $data=$entry?->payload??$service->defaults($kind);$brief=$data['designBrief']??[];
        $history=$entry?->revisions()->orderByDesc('version')->paginate(10);
        return view('evolution.management.edit',compact('kind','entry','data','brief','history','service'));
    }
    public function import(Request $request, string $kind, Content $service) {
        $count=$service->import($kind,$request->user()->id);
        return back()->with('status',"$count existing $kind designs imported as drafts. Previously imported designs were kept.");
    }
    public function store(Request $request, string $kind, Content $service) { return $this->persist($request,$kind,$service); }
    public function update(Request $request, string $kind, ManagedContent $content, Content $service) { abort_unless($content->kind===$kind,404);return $this->persist($request,$kind,$service,$content); }
    private function persist(Request $request, string $kind, Content $service, ?ManagedContent $entry=null) {
        $rules=['version'=>[$entry?'required':'nullable','integer','min:1'],'brief'=>'required|array:appearancePrompt,passivePrompt,effectPrompt,skills','brief.appearancePrompt'=>'nullable|string|max:6000'];
        if($kind==='avatar') {
            $keys=['displayName','title','primaryRole','secondaryRole','archetype','passiveDesc','primaryColor','accentColor',...array_keys(Content::AVATAR_STATS),...array_keys(Content::SLOTS)];
            $rules+=['data.displayName'=>'required|string|max:80','data.title'=>'required|string|max:120','data.primaryRole'=>['required',Rule::in(Content::ROLES)],'data.secondaryRole'=>['nullable',Rule::in(Content::ROLES),'different:data.primaryRole'],'data.archetype'=>'required|string|max:120','data.passiveDesc'=>'required|string|max:3000','data.primaryColor'=>'required|regex:/^#[a-fA-F0-9]{6}$/','data.accentColor'=>'required|regex:/^#[a-fA-F0-9]{6}$/','brief.passivePrompt'=>'nullable|string|max:6000','brief.skills'=>'nullable|array:skill1,skill2,ultimate'];
            foreach(Content::AVATAR_STATS as $key=>[$min,$max]) $rules['data.'.$key]="required|numeric|between:$min,$max";
            foreach(Content::SLOTS as $slot=>$label) {
                $rules['data.'.$slot]='required|array:name,desc,damage,cooldown,damageType,castType';
                foreach(['name'=>'required|string|max:100','desc'=>'required|string|max:3000','damage'=>'required|numeric|between:0,20000','cooldown'=>'required|numeric|between:0,600','damageType'=>['required',Rule::in(['Physical','Magic','True'])],'castType'=>['required',Rule::in(['unit','point_or_unit','area','no_target','toggle'])]] as $key=>$rule) $rules["data.$slot.$key"]=$rule;
                $rules["brief.skills.$slot"]='nullable|array:gameplayPrompt,appearancePrompt,animationPrompt';
                foreach(['gameplayPrompt','appearancePrompt','animationPrompt'] as $key) $rules["brief.skills.$slot.$key"]='nullable|string|max:6000';
            }
        } else {
            $keys=['name','cost','tier','icon','stats','passiveName','passiveDesc','suitableRoles'];
            $rules+=['data.name'=>'required|string|max:80','data.cost'=>'required|integer|between:0,50000','data.tier'=>['required',Rule::in(['Starting','Component','Legendary','Mythic'])],'data.icon'=>'nullable|string|max:16','data.passiveName'=>'required|string|max:120','data.passiveDesc'=>'required|string|max:3000','data.suitableRoles'=>'required|array|min:1|max:6','data.suitableRoles.*'=>['required','distinct',Rule::in(Content::ROLES)],'data.stats'=>'required|array:'.implode(',',array_keys(Content::ITEM_STATS)),'brief.effectPrompt'=>'nullable|string|max:6000'];
            foreach(Content::ITEM_STATS as $key=>[$min,$max]) $rules['data.stats.'.$key]="nullable|numeric|between:$min,$max";
        }
        $rules['data']='required|array:'.implode(',',$keys);
        $input=$request->validate($rules);
        if($kind==='item') {
            $input['data']['stats']=array_map(fn($v)=>0+$v,array_filter($input['data']['stats'],fn($v)=>$v!==null && $v!==''));
            $input['data']['cost']=(int)$input['data']['cost'];
            $input['data']['icon']=$input['data']['icon']??'';
        } else {
            foreach(array_keys(Content::AVATAR_STATS) as $key) $input['data'][$key]=0+$input['data'][$key];
            foreach(array_keys(Content::SLOTS) as $slot) foreach(['damage','cooldown'] as $key) $input['data'][$slot][$key]=0+$input['data'][$slot][$key];
        }
        $entry=$service->save($kind,$input,$request->user()->id,$entry);
        return redirect()->route('management.edit',[$kind,$entry])->with('status','Draft saved. No live game changes or generation jobs were started.');
    }
    public function action(Request $request, string $kind, ManagedContent $content, Content $service) {
        abort_unless($content->kind===$kind,404);
        $input=$request->validate(['version'=>'required|integer|min:1','action'=>['required',Rule::in(['review','archive','restore','restore_revision'])],'revision'=>'required_if:action,restore_revision|nullable|integer|min:1']);
        $service->transition($content,(int)$input['version'],$input['action'],$request->user()->id,isset($input['revision'])?(int)$input['revision']:null);
        return back()->with('status','Design updated. Live game content is unchanged.');
    }
    public function download(Request $request, string $kind, ManagedContent $content, Content $service) {
        abort_unless($content->kind===$kind,404);
        if($request->query('format')==='prompt') return response($service->prompt($content),200,['Content-Type'=>'text/plain; charset=UTF-8','Content-Disposition'=>'attachment; filename="'.$kind.'-'.$content->id.'-brief.txt"']);
        return response()->streamDownload(function() use($content) {echo json_encode(['schema'=>'esports-clash-content-draft-v1','kind'=>$content->kind,'status'=>$content->status,'version'=>$content->version,'live'=>false,'payload'=>$content->payload],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);},$kind.'-'.$content->id.'-v'.$content->version.'.json',['Content-Type'=>'application/json']);
    }
}
