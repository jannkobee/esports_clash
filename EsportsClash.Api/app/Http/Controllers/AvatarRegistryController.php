<?php
namespace App\Http\Controllers;

use App\Models\{GameContent,ManagedContent,AvatarPreparation,TrellisGeneration,AvatarVisualRelease};
use App\Services\{AvatarRegistryService,ContentManagementService,GameContentService};
use Illuminate\Http\Request;

class AvatarRegistryController extends Controller {
    public function index(Request $request,AvatarRegistryService $registry) {
        $q=$request->validate(['q'=>'nullable|string|max:100'])['q']??'';
        $entries=$registry->records()->filter(fn($entry)=>$q===''||str_contains(mb_strtolower(json_encode($entry->payload)),mb_strtolower($q)));
        $hash=app(GameContentService::class)->snapshot()['hash'];
        return view('evolution.registry.index',compact('entries','hash'));
    }
    private function entry(string $avatar):GameContent {
        return GameContent::where('kind','avatar')->findOrFail($avatar);
    }
    public function edit(string $avatar) {
        $entry=$this->entry($avatar);$data=$entry->payload;
        $skills=GameContent::withTrashed()->where('kind','skill')->whereIn('id',array_map(fn($slot)=>$avatar.':'.$slot,['passive','skill1','skill2','ultimate']))->get();
        $draft=ManagedContent::where('kind','avatar')->where('source_id',$avatar)->first();
        $generation=TrellisGeneration::currentAssets()->where('avatar_id',$avatar)->latest()->first();
        $preparation=$generation?AvatarPreparation::where('generation_id',$generation->id)->latest()->first():null;
        $release=AvatarVisualRelease::where('avatar_id',$avatar)->where('active',true)->latest()->first();
        $candidate=\App\Models\AvatarBaseCandidate::where('avatar_id',$avatar)->latest()->first();
        $history=\Illuminate\Support\Facades\DB::table('game_content_revisions')->where('content_id',$avatar)->orderByDesc('version')->limit(10)->get();
        return view('evolution.registry.edit',compact('entry','data','skills','draft','generation','preparation','release','history','candidate'));
    }
    public function update(Request $request,string $avatar,GameContentService $service) {
        $entry=$this->entry($avatar);
        $rules=['version'=>'required|integer|min:1','data'=>'required|array:displayName,title,archetype,lore,primaryColor,accentColor,'.implode(',',array_keys(ContentManagementService::AVATAR_STATS)),
            'data.displayName'=>'required|string|max:80','data.title'=>'required|string|max:120','data.archetype'=>'required|string|max:120',
            'data.lore'=>'nullable|string|max:6000','data.primaryColor'=>'required|regex:/^#[a-fA-F0-9]{6}$/','data.accentColor'=>'required|regex:/^#[a-fA-F0-9]{6}$/'];
        foreach(ContentManagementService::AVATAR_STATS as $key=>[$min,$max])$rules['data.'.$key]="required|numeric|between:$min,$max";
        $input=$request->validate($rules);
        foreach(ContentManagementService::AVATAR_STATS as $key=>$limits)$input['data'][$key]=0+$input['data'][$key];
        $payload=array_replace($entry->payload,$input['data']);$payload['name']=$payload['displayName'];$payload['lore']=$payload['lore']??'';
        $service->mutate($entry,(int)$input['version'],$request->user()->id,'publish',$payload);
        return back()->with('status','Avatar published. Connected engines refresh automatically; active matches retain their starting catalog.');
    }
}
