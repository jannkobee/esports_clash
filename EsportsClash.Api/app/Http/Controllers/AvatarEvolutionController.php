<?php
namespace App\Http\Controllers;
use App\Models\{AvatarEvolutionSetting,AvatarEvolutionRun,AvatarVisualRelease};
use App\Services\{AvatarEvolutionService,EvolutionService};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AvatarEvolutionController extends Controller
{
    public function index(AvatarEvolutionService $service)
    {
        try{$operations=$service->worker()->get($service->endpoint('/operations'))->throw()->json();}catch(\Throwable){$operations=null;}
        return view('evolution.avatars.index',['settings'=>AvatarEvolutionSetting::current(),'catalog'=>$service->catalog(),
            'runs'=>AvatarEvolutionRun::latest()->limit(30)->get(),'releases'=>AvatarVisualRelease::latest()->limit(50)->get(),'operations'=>$operations]);
    }
    public function show(AvatarEvolutionRun $run) { return view('evolution.avatars.show',['run'=>$run,'releases'=>AvatarVisualRelease::where('avatar_id',$run->avatar_id)->latest()->get()]); }
    public function reports()
    {
        return response()->view('evolution.avatars.reports',[
            'runs'=>AvatarEvolutionRun::latest()->paginate(20),
            'runCount'=>AvatarEvolutionRun::count(),
            'reviewCount'=>AvatarEvolutionRun::where('status','review')->count(),
            'releaseCount'=>AvatarVisualRelease::count(),
        ])->header('Cache-Control','no-store');
    }
    public function download(AvatarEvolutionRun $run)
    {
        return response()->json(['type'=>'avatar-model','id'=>$run->id,'avatar_id'=>$run->avatar_id,
            'status'=>$run->status,'plan'=>$run->plan,'report'=>$run->report,'decisions'=>$run->decisions,
            'manifest_hash'=>$run->manifest_hash,'error'=>$run->error,'created_at'=>$run->created_at,
            'updated_at'=>$run->updated_at],headers:[
                'Content-Disposition'=>'attachment; filename="model-report-'.$run->id.'.json"','Cache-Control'=>'no-store']);
    }
    public function start(Request $request,AvatarEvolutionService $service)
    {
        $data=$request->validate(['avatar_id'=>['required','string'],'focus'=>['required','in:balanced,silhouette,equipment,motion']]);
        $run=$service->start('user:'.$request->user()->id,$data['avatar_id'],focus:$data['focus']);
        return redirect()->route('avatars.show',$run)->with('status','Avatar analysis and candidate generation queued.');
    }
    public function regenerate(Request $request,AvatarEvolutionRun $run,AvatarEvolutionService $service)
    {
        $focus=$request->validate(['focus'=>['required','in:balanced,silhouette,equipment,motion']])['focus'];
        $new=DB::transaction(function()use($run,$service,$request,$focus){
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            $old=AvatarEvolutionRun::lockForUpdate()->findOrFail($run->id);
            if(in_array($old->status,AvatarEvolutionService::ACTIVE,true))throw ValidationException::withMessages(['avatar'=>'Let the current generation finish first.']);
            if($old->status==='review')$old->update(['status'=>'superseded']);
            return $service->start('user:'.$request->user()->id,$old->avatar_id,focus:$focus);
        });
        return redirect()->route('avatars.show',$new);
    }
    public function settings(Request $request,EvolutionService $audit)
    {
        $data=$request->validate(['enabled'=>['sometimes','boolean'],'interval_minutes'=>['sometimes','integer','min:5','max:10080'],
            'candidates_per_cycle'=>['sometimes','integer','min:3','max:10'],'generations'=>['sometimes','integer','min:1','max:3'],
            'storage_gib'=>['sometimes','integer','min:1','max:20'],'avatar_ids'=>['sometimes','array','min:1','max:45'],'avatar_ids.*'=>['string','distinct']]);
        $allowed=array_column(app(AvatarEvolutionService::class)->catalog(),'id');
        if(array_diff($data['avatar_ids']??[],$allowed))throw ValidationException::withMessages(['avatar_ids'=>'Select shipped avatars.']);
        AvatarEvolutionSetting::current()->update($data);$audit->audit('avatars','avatar.settings','user:'.$request->user()->id,$data);
        return redirect()->route('avatars.index')->with('status','Avatar automation settings saved. Publishing requires owner approval.');
    }
    public function decide(Request $request,AvatarEvolutionRun $run,AvatarEvolutionService $service)
    {
        $data=$request->validate(['candidate'=>['required','regex:/^candidate-\d{2}$/'],'action'=>['required','in:approve,reject'],'feedback'=>['nullable','string','max:1000']]);
        $service->decide($run->id,$data['candidate'],$data['action'],$data['feedback']??'','user:'.$request->user()->id);
        return redirect()->route('avatars.show',$run)->with('status',$data['action']==='approve'?'Visual version published for new renderers. Existing scenes keep their version.':'Candidate rejected; assets and feedback retained.');
    }
    public function rollback(Request $request,AvatarEvolutionService $service)
    {
        $data=$request->validate(['avatar_id'=>['required','string'],'release_id'=>['nullable','integer','min:1']]);
        $service->rollback($data['avatar_id'],$data['release_id']??null,'user:'.$request->user()->id);
        return back()->with('status','Visual rollback recorded. New renderers use the selected version.');
    }
    public function viewer(Request $request,AvatarEvolutionService $service,string $path='avatar-review.html')
    {
        abort_if(str_contains($path,'..')||!preg_match('/^[A-Za-z0-9_.\/-]+$/',$path),404);
        $response=$service->worker()->get($service->endpoint('/viewer/'.$path));abort_unless($response->successful(),$response->status());
        return response($response->body())->header('Content-Type',$response->header('Content-Type'))->header('X-Content-Type-Options','nosniff');
    }
    public function file(AvatarEvolutionService $service,string $id,string $file)
    {
        abort_unless(\Illuminate\Support\Str::isUuid($id)&&preg_match('/^[a-z0-9-]+\.(glb|blend|png|json)$/',$file),404);
        AvatarEvolutionRun::findOrFail($id);
        return $this->assetResponse($service,$id,$file,false);
    }
    public function manifest()
    {
        return response()->json(['releases'=>AvatarVisualRelease::where('active',true)->get(['id','avatar_id','variant','version','sha256'])])->header('Cache-Control','no-store');
    }
    public function published(AvatarEvolutionService $service,AvatarVisualRelease $release,string $hash)
    {
        abort_unless(hash_equals($release->sha256,$hash),404);
        return $this->assetResponse($service,$release->run_id,$release->file,true,$hash);
    }
    private function assetResponse(AvatarEvolutionService $service,string $id,string $file,bool $published,?string $hash=null)
    {
        $response=$service->worker()->get($service->endpoint('/files/'.$id.'/'.$file));abort_unless($response->successful(),$response->status());
        $body=$response->body();abort_if(strlen($body)>config('avatars.max_asset_bytes'),413);
        if($hash)abort_unless(hash_equals($hash,hash('sha256',$body)),409,'Visual artifact integrity check failed');
        return response($body)->header('Content-Type',$response->header('Content-Type'))->header('X-Content-Type-Options','nosniff')
            ->header('Cache-Control',$published?'public, max-age=31536000, immutable':'private, max-age=60');
    }
}
